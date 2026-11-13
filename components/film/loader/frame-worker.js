/**
 * The film worker and its frame store: fetches frames' compressed bytes, keeps them, and decodes them with
 * createImageBitmap on request, transferring each bitmap to the page; so neither the network reads nor the decodes run
 * on the thread that scrolls the page. Protocol: ./frame-worker-protocol.ts; types: ./frame-worker.d.ts.
 *
 * ONE FILE, TWO USES, AND WHY IT IS PLAIN JAVASCRIPT WITH NO IMPORTS
 * - The budget loader (./budget.ts) starts it with `new Worker(new URL("./frame-worker.js", import.meta.url),
 *   { type: "module" })`. The production build (Next 16.1, Turbopack) does not compile a file named that way into a
 *   worker chunk: it copies it as it is to `/_next/static/media/frame-worker.<hash>.js` (a .ts file would be copied as
 *   TypeScript, which no browser runs). So this file is what the browser loads: plain JavaScript, self-contained.
 * - Where a worker cannot run, the loader imports `createFrameStore` from this same file and runs the store on the
 *   page, so the main-thread fallback answers exactly as the worker does. The worker wiring at the end runs only inside
 *   a worker.
 *
 * The store decides nothing about which frames or when: the page's planner does (./budget-plan.ts), and it sends no
 * more jobs than the limits it gave; the queues here only hold jobs above those limits and are what `cancel` works on.
 * Fetches are CORS with no credentials, so a frame decoded from the bytes keeps the canvas readable (getImageData).
 * On `init` the store answers `ready: false` when it lacks fetch, Blob or createImageBitmap.
 */

/** A 408, a 429 and any 5xx are worth another try; any other failed answer is final (the frame does not exist). */
export const retryableStatus = (status) => status === 408 || status === 429 || status >= 500;

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
            if (!b) continue;
            held -= b.size;
            bytes.delete(key);
          }
          deps.emit({ t: "held", held });
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
