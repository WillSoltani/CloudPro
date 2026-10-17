"use client";

import type { CSSProperties } from "react";

import { FilmChapter } from "@/components/film/FilmChapter";
import { ChapterHead } from "@/components/film/ChapterHead";
import { FrameBand } from "@/components/film/FrameLayout";
import { Reveal } from "@/components/film/Reveal";
import { CHOREO } from "@/components/film/choreo";
import { RACK_CAPTIONS } from "@/components/film/rackCaptions";
import { REEL, REEL_INDEX, breathOf, moveVhOf } from "@/components/film/reel";
import { BODY_TEXT, FILM_LINK, LEDE } from "@/components/film/sectionTokens";
import { NIGHT, boxHalo, closingBand } from "@/components/film/tones";

const FILM = REEL[REEL_INDEX.contact];
const C = CHOREO.contact;
const PLATE = RACK_CAPTIONS.plates[4];
const EXTRA = C.head.plate.extra ?? {};
const LINKS = RACK_CAPTIONS.contact.links;
/** The lamp's distance from the bottom of the viewport (frame y 0.848; frameBox vars): the band's clear disc. */
const LAMP_FROM_BOTTOM = "calc(100dvh - var(--fy0) - var(--fh) * 0.848)";
/** One side of the split footer (`lamp-low`): never within 7svh of the lamp's x (the centre). */
const FOOTER_SIDE = "lamp-low:block lamp-low:max-w-[calc(50%-7svh)] lamp-low:text-left";
/**
 * Short phones (`phone-short`), where the paragraph and the links sit over brighter sky: the paragraph's halo
 * becomes a soft box and the links' halos deepen (app/globals.css reads these; elsewhere the plain halo).
 */
const PARAGRAPH_BOX = boxHalo(0.7, [48, 80, 48, 80]);
const PARAGRAPH_SHORT = {
  "--halo-inset-s": PARAGRAPH_BOX["--box-inset"],
  "--halo-s": PARAGRAPH_BOX["--box-bg"],
  "--halo-mask-s": PARAGRAPH_BOX["--box-mask"],
} as CSSProperties;
const LINK_SHORT = {
  // Its foot stops 10 px under the line: on the second row at 320×568 it would otherwise reach the lamp's halo.
  "--halo-inset-s": "-10px -44px",
  "--halo-s": `radial-gradient(closest-side, rgb(${NIGHT} / 0.9), rgb(${NIGHT} / 0.63) 55%, rgb(${NIGHT} / 0) 100%)`,
} as CSSProperties;

/**
 * 05 Contact and the footer, the page's last chapter (§2f) on tower-04, joined to the bridge: the camera
 * cranes up into the cloud to the lamp; as the lamp settles (S) "05" and the name arrive, then "Start a
 * project", the offer line, the paragraph and the three links one by one; at rest tower-K4 breathes about the lamp and the footer
 * arrives in the bottom band. The page ends inside this chapter's read pin (0.6 vh), so the composition is
 * still pinned at the bottom of the page.
 *
 * Each destination appears once (the old ContactCTA and the rack's Contact caption merged): email, GitHub,
 * LinkedIn, all live anchors outside any aria-hidden block.
 *
 * Desktop: one centred column x 0.30–0.70, y 0.14–0.52 (the dark sky above the cloud) · the links in one
 * row · the footer in the bottom band (night 0.88, clear from 136 px up and in a disc round the lamp; on the
 * windows much wider than 16:9 the footer takes the bottom corners). Phones: the top block from y 0.10 (no
 * text near the lamp at 0.85 of the height) · the footer band.
 */
export function ContactSection() {
  return (
    <FilmChapter
      film={FILM}
      id={PLATE.section}
      moveVh={moveVhOf(FILM)}
      choreo={C}
      section={PLATE.section}
      breath={breathOf(FILM)}
      // Joined to the bridge (no hold between): its move starts where tower-01's ends.
      join
      // tower-04's first frame matches tower-K3 only at SSIM 0.95 (not a byte join): dissolve out of the key,
      // over 0.1 of the move (the key gone by f14, before the crane starts moving at f16: no doubled roofs).
      dissolveIn={0.1}
    >
      <FrameBand from={0.14} to={0.52} x={0.3} right={0.7} stackedTop={0.1}>
        <div className="mx-auto max-w-[36rem] text-center">
          <ChapterHead n={PLATE.n} title={PLATE.headingText} plateTarget={false} />
          {EXTRA.kicker ? (
            // On the short laptop windows (`wide-tight`) the column sits lower in the frame (the 96 px line falls
            // at frame y 0.13–0.19), over a brighter sky: its rhythm tightens so the paragraph and the links stay
            // in the darker part and end by the band's frame y 0.52 (1280×650, 1366×657).
            <Reveal at={EXTRA.kicker} className="mt-6 wide:mt-8 wide-tight:mt-3">
              <h3 className="font-serif text-[1.75rem] font-normal leading-tight text-slate-50 wide:text-[clamp(1.6rem,2vw,2.2rem)]">
                Start a project
              </h3>
            </Reveal>
          ) : null}
          {EXTRA.line ? (
            <Reveal as="p" at={EXTRA.line} data-halo="" className={`${LEDE} mx-auto text-balance`}>
              {RACK_CAPTIONS.contact.line}
            </Reveal>
          ) : null}
          {EXTRA.paragraph ? (
            <Reveal
              as="p"
              at={EXTRA.paragraph}
              data-halo=""
              className={`mx-auto mt-4 max-w-[32rem] ${BODY_TEXT} wide-tight:mt-2`}
              style={PARAGRAPH_SHORT}
            >
              I work with companies, founders and teams on AWS architecture, web and mobile products, AI
              features, and systems already in production.
            </Reveal>
          ) : null}
          <ul className="mt-7 flex flex-wrap items-baseline justify-center gap-x-6 gap-y-3 wide-tight:mt-2">
            {LINKS.map((l, k) => {
              const external = /^https?:\/\//.test(l.href);
              return (
                // Each link over its own halo (§2c): at 1366×768 the row sits at frame y 0.49, just above the cloud.
                <Reveal as="li" key={l.id} at={C.items[Math.min(k, C.items.length - 1)]} data-halo="" style={LINK_SHORT}>
                  <a
                    href={l.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                    aria-label={external ? `${l.label} (opens in a new tab)` : `Email ${l.label}`}
                    className={`${FILM_LINK} normal-case tracking-[0.12em]`}
                  >
                    {l.label}
                    {external ? <span aria-hidden>↗</span> : null}
                  </a>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </FrameBand>
      {/* The closing band: night under the footer line, clear from 136 px up. It lies beneath the composition
          (−z-10 in the compose box's stacking context), so where the links' second row reaches into it (320×568)
          it darkens the film behind them, never the links (which stay on top for taps too), and it opens a clear
          disc round the lamp at every size (app/globals.css). Where the lamp sits on the footer's row (`lamp-low`:
          the short phones, iPhone SE class, and landscape windows much wider than 16:9, where the cover-fit puts
          the lamp 55–105 px from the bottom) the line splits into the two bottom corners, each kept ≥ 7svh clear
          of the lamp's x, so the lamp shines between them. */}
      <Reveal
        pin={C.pins?.[0]}
        y={0}
        aria-hidden="true"
        data-closing-band=""
        className="absolute inset-x-0 bottom-0 -z-10 h-[136px]"
        style={{ backgroundImage: closingBand(), "--lamp-b": LAMP_FROM_BOTTOM } as CSSProperties}
      />
      <Reveal pin={C.pins?.[0]} y={0} className="absolute inset-x-0 bottom-0">
        <footer className="px-5 wide:px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-slate-300 phone-short:tracking-[0.08em]">
            {/* The text's own box: ScrollToTop steps aside where it would cover it (phones). */}
            <span
              data-page-footer=""
              className="lamp-low:flex lamp-low:w-full lamp-low:items-end lamp-low:justify-between"
            >
              <span className={FOOTER_SIDE}>
                <span className="whitespace-nowrap">© {new Date().getFullYear()}</span>{" "}
                <span className="whitespace-nowrap">Will Soltani</span>
              </span>
              <span aria-hidden className="lamp-low:hidden">
                {" · "}
              </span>
              <span className={`${FOOTER_SIDE} lamp-low:text-right`}>
                <span className="whitespace-nowrap">Hosted on</span> <span className="whitespace-nowrap">AWS</span>
              </span>
            </span>
          </p>
        </footer>
      </Reveal>
    </FilmChapter>
  );
}
