/**
 * The film worker and its frame store: fetches frames' compressed bytes (one file per frame, or a film's pack read as a
 * stream), keeps them, and decodes them with createImageBitmap on request, transferring each bitmap to the page; so
 * neither the network reads nor the decodes run on the thread that scrolls the page. Protocol:
 * ./frame-worker-protocol.ts; types: ./frame-worker.d.ts.
 *
 * ONE FILE, TWO USES
 * - The budget loader (./budget.ts) starts it with `new Worker(new URL("./frame-worker.js", import.meta.url),
 *   { type: "module" })`. Measured in production builds (Next 16.1.6, 2026-11-13): Turbopack compiles this file and
 *   its imports into a worker chunk that a `blob:` worker loads (the raw copy it also emits to /_next/static/media is
 *   not what runs), so a static import of ./pack-format.mjs works here. It stays plain JavaScript (types in
 *   ./frame-worker.d.ts) so Node's tests and the page import the same file.
 * - Where a worker cannot run, the loader imports `createFrameStore` from this same file and runs the store on the
 *   page, so the main-thread fallback answers exactly as the worker does. The worker wiring at the end runs only inside
 *   a worker.
 *
 * The store decides nothing about which frames or when: the page's planner does (./budget-plan.ts), and it sends no
 * more jobs than the limits it gave; the queues here only hold jobs above those limits and are what `cancel` works on.
 * Fetches are CORS with no credentials, so a frame decoded from the bytes keeps the canvas readable (getImageData).
 * On `init` the store answers `ready: false` when it lacks fetch, Blob or createImageBitmap.
 *
 * PACK READS (stage 7, `pack` / `pack-to` / `pack-stop` / `pack-forget`): one PackBytes (./pack-format.mjs) per pack
 * URL keeps the header and the bytes of frames still arriving. A read starts at the first byte not held. Only a read from
 * byte 0 to the end of the file is a plain GET (no Range header, so a complete 200 can be stored by the HTTP cache); a
 * read that stops before the end of the file asks for that closed range (`Range: bytes=n-m`; before the header is known,
 * up to the page's estimate `est`), and one from a later byte to the end asks for `bytes=n-`. It stops (abort) before
 * the next byte held, at its `to`, or when the page says. A 206 must name the range asked for in a
 * readable Content-Range; where that header is unreadable, its Content-Length (or, failing that, the bytes of a body
 * read to its end) must match. A 200 to a Range request is the whole file from byte 0: the bytes held already are
 * counted as read twice and skipped, and the pack is read from 0 from then on (`rangeless`). Each frame whose bytes are
 * all in is copied into the same keyed store the per-frame fetches fill (`prefix + frame`) and handed over by
 * PackBytes, so its bytes are held once. The pack reads run beside the per-frame fetches, outside their limits (the
 * page opens at most two).
 */
import { PackBytes } from "./pack-format.mjs";

/** A 408, a 429 and any 5xx are worth another try; any other failed answer is final (the frame does not exist). */
export const retryableStatus = (status) => status === 408 || status === 429 || status >= 500;

// `to` of a pack read while the page has not seen the header (./frame-worker-protocol.ts PACK_TO_*).
const PACK_TO_SKELETON = -1;
const PACK_TO_HOLD = -2;
const PACK_TO_END = -3;

/** @param {import("./frame-worker").StoreDeps} deps */
export function createFrameStore(deps) {
  const bytes = new Map();
  let held = 0;
  let maxFetches = 6;
  let maxDecodes = 3;
  let fetching = 0;
  let decoding = 0;
  const fetchQueue = [];
  const decodeQueue = [];
  let disposed = false;

  const missing = () => {
    const m = [];
    if (typeof deps.fetch !== "function") m.push("fetch");
    if (typeof Blob !== "function") m.push("Blob");
    if (typeof deps.createImageBitmap !== "function") m.push("createImageBitmap");
    return m;
  };

  const runFetch = async (job) => {
    fetching++;
    const t0 = deps.now();
    let answer;
    try {
      const res = await deps.fetch(job.url, { mode: "cors", credentials: "omit" });
      if (!res.ok) {
        answer = { t: "fetched", id: job.id, ok: false, retryable: retryableStatus(res.status), status: res.status };
      } else {
        const blob = await res.blob();
        if (disposed) return;
        const old = bytes.get(job.key);
        if (old) held -= old.size;
        bytes.set(job.key, blob);
        held += blob.size;
        answer = { t: "fetched", id: job.id, ok: true, size: blob.size, ms: deps.now() - t0, held };
      }
    } catch {
      answer = { t: "fetched", id: job.id, ok: false, retryable: true };
    } finally {
      fetching--;
    }
    if (disposed) return;
    deps.emit(answer);
    pump();
  };

  const runDecode = async (job) => {
    decoding++;
    try {
      // Answered after this call returns, never inside it (the page may be in the middle of its own pump).
      await Promise.resolve();
      const blob = bytes.get(job.key);
      if (!blob) {
        if (!disposed) deps.emit({ t: "decoded", id: job.id, ok: false, reason: "missing" });
        return;
      }
      const t0 = deps.now();
      let bitmap;
      try {
        bitmap = await deps.createImageBitmap(blob);
      } catch {
        if (!disposed) deps.emit({ t: "decoded", id: job.id, ok: false, reason: "error" });
        return;
      }
      if (disposed) {
        bitmap.close();
        return;
      }
      deps.emit({ t: "decoded", id: job.id, ok: true, bitmap, ms: deps.now() - t0 }, [bitmap]);
    } finally {
      decoding--;
      pump();
    }
  };

  function pump() {
    if (disposed) return;
    while (fetching < maxFetches && fetchQueue.length) void runFetch(fetchQueue.shift());
    while (decoding < maxDecodes && decodeQueue.length) void runDecode(decodeQueue.shift());
  }

  // ---------------------------------------------------------------- pack reads

  /** Per pack URL: its PackBytes, whether its server ignores Range, which slots were ever read, who got the header. */
  const packs = new Map();
  /** Key prefix (the page's segment epoch) → the pack URL its frames come from (so a `drop` reaches the pack too). */
  const prefixUrl = new Map();
  /** Pack reads running, by id. */
  const reads = new Map();

  const packOf = (url) => {
    let p = packs.get(url);
    if (!p) {
      p = { store: new PackBytes(), rangeless: false, ever: null, told: new Set() };
      packs.set(url, p);
    }
    return p;
  };

  const keepBytes = (key, blob) => {
    const old = bytes.get(key);
    if (old) held -= old.size;
    bytes.set(key, blob);
    held += blob.size;
  };

  const headerMessage = (id, h) => ({
    t: "pack-header",
    id,
    count: h.count,
    header: h.header,
    skeletonEnd: h.skeletonEnd,
    bytes: h.bytes,
    slotFrame: Int32Array.from(h.slots, (s) => s.index),
    slotOffset: Uint32Array.from(h.slots, (s) => s.offset),
  });

  const headerOf = (res, name) => {
    try {
      return res.headers?.get?.(name) ?? null;
    } catch {
      return null;
    }
  };

  const runPack = async (read) => {
    const p = packOf(read.url);
    const st = p.store;
    prefixUrl.set(read.prefix, read.url);
    const t0 = deps.now();
    let got = 0;
    let repeated = 0;
    let rangeless = false;
    let ctrl = null;
    let reader = null;

    // Where this read stops: its `to` (resolved against the header once known), and before the next byte held.
    const bound = () => {
      const h = st.header;
      if (read.to >= 0) return h ? Math.min(read.to, h.bytes) : read.to;
      if (!h || read.to === PACK_TO_END) return h ? h.bytes : Infinity;
      if (read.to === PACK_TO_SKELETON) return h.skeletonEnd;
      if (read.to === PACK_TO_HOLD) {
        const s = h.slots[Math.min(Math.max(1, read.hold), h.slots.length) - 1];
        return s.offset + s.length;
      }
      return h.bytes;
    };
    const limit = () => {
      const b = bound();
      return st.header && !p.rangeless ? st.nextHeld(read.pos, b) : b;
    };

    const finish = (ok, extra) => {
      if (read.answered) return;
      read.answered = true;
      reads.delete(read.id);
      try {
        ctrl?.abort();
      } catch {
        // already settled
      }
      reader?.cancel().catch(() => {});
      if (disposed) return;
      deps.emit({ t: "pack-done", id: read.id, ok, pos: read.pos, got, repeated, held, ...(rangeless ? { rangeless } : {}), ...extra });
      got = repeated = 0;
    };
    read.finish = finish;
    read.check = () => {
      if (read.pos >= limit()) finish(true);
    };
    const fail = (failure, reason, status) => finish(false, { failure, reason, ...(status ? { status } : {}) });

    if (st.error) return fail("final", st.error);
    if (st.header && !p.told.has(read.prefix)) {
      p.told.add(read.prefix);
      deps.emit(headerMessage(read.id, st.header));
    }
    // The first byte not held at or after `from` (before the header is known: the first header byte not held).
    const start = p.rangeless ? 0 : st.header ? st.firstMissing(Math.max(0, read.from), bound()) : st.headerFilled;
    if (start < 0 || start >= bound()) return finish(true);
    read.pos = start;

    // The request: a read that ends before the end of the file asks for a closed range (stopping an open-ended read
    // costs what is in flight when the abort lands, the whole file on a fast link); before the header is known the
    // page's estimate of the end (`est`, from the manifest's hints) bounds it. A read from byte 0 to the end of the
    // file is a plain GET (no Range header), so a complete 200 can be stored by the HTTP cache.
    const lim = limit();
    let reqEnd = -1; // exclusive; -1: to the end of the file
    if (Number.isFinite(lim)) {
      if (!(st.header && lim >= st.header.bytes)) reqEnd = lim;
    } else if (read.est > start) {
      reqEnd = read.est;
    }
    ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const init = { mode: "cors", credentials: "omit" };
    if (ctrl) init.signal = ctrl.signal;
    if (start > 0 || reqEnd > 0) init.headers = { Range: reqEnd > 0 ? `bytes=${start}-${reqEnd - 1}` : `bytes=${start}-` };
    const asked = init.headers ? init.headers.Range : "";
    let res;
    try {
      res = await deps.fetch(read.url, init);
    } catch {
      return read.answered ? undefined : fail("retry", "network error");
    }
    if (read.answered || disposed) {
      res.body?.cancel?.().catch?.(() => {});
      return;
    }
    const total = st.header ? st.header.bytes : -1;
    let expect = -1; // body bytes a 206 must carry when its Content-Range is unreadable
    if (res.status === 206) {
      const cr = headerOf(res, "content-range");
      if (cr !== null) {
        const m = /^bytes (\d+)-(\d+)\/(\d+|\*)$/i.exec(cr.trim());
        if (!m || Number(m[1]) !== start) return fail("final", `206 for ${asked} came back as "${cr}"`, 206);
        if (total >= 0 && m[3] !== "*" && Number(m[3]) !== total) return fail("final", `pack is ${m[3]} bytes, its header says ${total}`, 206);
      } else if (total >= 0) {
        const cl = headerOf(res, "content-length");
        expect = (reqEnd > 0 ? Math.min(reqEnd, total) : total) - start;
        if (cl !== null && Number(cl) !== expect) return fail("final", `206 for ${asked} carries ${cl} bytes, expected ${expect}`, 206);
      }
    } else if (res.status === 200) {
      // A 200 is the whole file from byte 0 (asked for a range, the server ignored Range).
      reqEnd = -1;
      if (start > 0) {
        p.rangeless = rangeless = true;
        read.pos = 0;
      }
      const cl = headerOf(res, "content-length");
      if (total >= 0 && cl !== null && Number(cl) !== total) return fail("final", `pack is ${cl} bytes, its header says ${total}`, 200);
    } else if (!res.ok) {
      return fail(retryableStatus(res.status) ? "retry" : "final", `pack answered ${res.status}`, res.status);
    } else {
      return fail("final", `pack answered ${res.status}`, res.status);
    }
    const body = res.body;
    if (!body || typeof body.getReader !== "function") return fail("final", "no streaming response body");
    reader = body.getReader();
    let received = 0;
    for (;;) {
      let r;
      try {
        r = await reader.read();
      } catch {
        return read.answered ? undefined : fail("retry", "body read error");
      }
      if (read.answered || disposed) return;
      if (r.done) break;
      const chunk = r.value;
      received += chunk.length;
      const hadHeader = !!st.header;
      const rep0 = st.repeatedBytes;
      const w = st.write(read.pos, chunk);
      read.pos += chunk.length;
      got += chunk.length;
      repeated += st.repeatedBytes - rep0;
      if (w.error) return fail("final", w.error);
      if (!hadHeader && st.header) {
        p.told.add(read.prefix);
        p.ever = new Uint8Array(st.header.slots.length);
        deps.emit(headerMessage(read.id, st.header));
      }
      if (w.completed.length) {
        const frames = [];
        const sizes = [];
        for (const f of w.completed) {
          const view = st.release(f);
          if (!view) continue;
          const slot = st.header.slotOf[f];
          if (p.ever?.[slot]) repeated += view.length;
          else if (p.ever) p.ever[slot] = 1;
          keepBytes(read.prefix + f, new Blob([view], read.type ? { type: read.type } : undefined));
          frames.push(f);
          sizes.push(view.length);
        }
        if (frames.length) {
          deps.emit({ t: "pack-frames", id: read.id, frames, sizes, pos: read.pos, got, repeated, ms: deps.now() - t0, held });
          got = repeated = 0;
        }
      }
      if (read.answered) return;
      if (read.pos >= limit()) return finish(true);
    }
    if (expect >= 0 && received > expect) return fail("final", `206 for ${asked} carried ${received} bytes, expected ${expect}`, 206);
    const h = st.header;
    // The end of the read, of the file, or of the closed range asked for (an estimate that fell short: the page reads on).
    if (read.pos >= limit() || (h && read.pos >= h.bytes) || (reqEnd > 0 && read.pos >= reqEnd)) return finish(true);
    return fail("retry", "body ended early");
  };

  return {
    /** Compressed bytes held now. */
    get held() {
      return held;
    },

    handle(m) {
      if (disposed) return;
      switch (m.t) {
        case "init": {
          maxFetches = m.maxFetches;
          maxDecodes = m.maxDecodes;
          const lacks = missing();
          deps.emit(lacks.length ? { t: "ready", ok: false, missing: lacks.join(", ") } : { t: "ready", ok: true });
          return;
        }
        case "limits":
          maxFetches = m.maxFetches;
          maxDecodes = m.maxDecodes;
          return pump();
        case "fetch":
          fetchQueue.push({ id: m.id, key: m.key, url: m.url });
          return pump();
        case "decode":
          decodeQueue.push({ id: m.id, key: m.key });
          return pump();
        case "drop": {
          for (const key of m.keys) {
            const b = bytes.get(key);
            if (b) {
              held -= b.size;
              bytes.delete(key);
            }
            // A frame that came from a pack: its slot is no longer held there either (a later read fetches it again).
            const cut = key.lastIndexOf("/") + 1;
            const url = cut > 0 ? prefixUrl.get(key.slice(0, cut)) : undefined;
            if (url) packs.get(url)?.store.dropFrame(Number(key.slice(cut)));
          }
          deps.emit({ t: "held", held });
          return;
        }
        case "pack": {
          const read = { id: m.id, url: m.url, prefix: m.prefix, from: m.from, to: m.to, hold: m.hold, est: m.est ?? -1, type: m.type, pos: m.from, answered: false };
          reads.set(m.id, read);
          void runPack(read).catch((e) => {
            // runPack answers its own failures; this keeps a bug from becoming an unhandled rejection.
            read.finish?.(false, { failure: "retry", reason: String(e?.message ?? e) });
          });
          return;
        }
        case "pack-to": {
          const read = reads.get(m.id);
          if (!read) return;
          read.to = m.to;
          read.check?.();
          return;
        }
        case "pack-stop":
          reads.get(m.id)?.finish?.(false, { cancelled: true });
          return;
        case "pack-forget": {
          packs.delete(m.url);
          for (const [prefix, url] of prefixUrl) if (url === m.url) prefixUrl.delete(prefix);
          return;
        }
        case "cancel": {
          const ids = new Set(m.ids);
          for (let k = fetchQueue.length - 1; k >= 0; k--) {
            if (!ids.has(fetchQueue[k].id)) continue;
            deps.emit({ t: "fetched", id: fetchQueue[k].id, ok: false, retryable: true, cancelled: true });
            fetchQueue.splice(k, 1);
          }
          for (let k = decodeQueue.length - 1; k >= 0; k--) {
            if (!ids.has(decodeQueue[k].id)) continue;
            deps.emit({ t: "decoded", id: decodeQueue[k].id, ok: false, reason: "cancelled" });
            decodeQueue.splice(k, 1);
          }
          return;
        }
        case "dispose":
          disposed = true;
          for (const read of [...reads.values()]) read.finish?.(false, { cancelled: true });
          reads.clear();
          packs.clear();
          prefixUrl.clear();
          bytes.clear();
          held = 0;
          fetchQueue.length = 0;
          decodeQueue.length = 0;
          return;
      }
    },
  };
}

// Inside a worker only (never on the page, never in Node): answer the page's messages with the store.
if (typeof WorkerGlobalScope !== "undefined" && typeof self !== "undefined" && self instanceof WorkerGlobalScope) {
  const store = createFrameStore({
    fetch: typeof fetch === "function" ? (url, init) => fetch(url, init) : undefined,
    createImageBitmap: typeof createImageBitmap === "function" ? (blob) => createImageBitmap(blob) : undefined,
    now: () => performance.now(),
    emit: (m, transfer) => self.postMessage(m, transfer ?? []),
  });
  self.addEventListener("message", (ev) => {
    store.handle(ev.data);
    if (ev.data.t === "dispose") self.close();
  });
}
