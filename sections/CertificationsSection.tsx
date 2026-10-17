"use client";

import { FilmChapter } from "@/components/film/FilmChapter";
import { ChapterHead } from "@/components/film/ChapterHead";
import { BlockTone, FrameBand, FrameColumns } from "@/components/film/FrameLayout";
import { Reveal } from "@/components/film/Reveal";
import { RackPlate } from "@/components/film/RackPlate";
import { RideAnchor } from "@/components/film/RideAnchor";
import { ANCHORS, CHOREO, type FrameWindow } from "@/components/film/choreo";
import { RACK_CAPTIONS } from "@/components/film/rackCaptions";
import { REEL, REEL_INDEX, breathOf, moveVhOf, tailOf } from "@/components/film/reel";
import { FILM_LINK, ITEM_META, ITEM_NAME } from "@/components/film/sectionTokens";
import { certifications, type Certification } from "@/content/certifications";

const FILM = REEL[REEL_INDEX.certifications];
const CHOREO_CERTS = CHOREO.certifications;
const PLATE = RACK_CAPTIONS.plates[1];
/** Column centres on the four cartridges at rest (the renderer's exported anchors, choreo.ts ANCHORS). */
const CARTRIDGES = ANCHORS.cartridges.map(([x]) => x);
/** Each column's width as a share of the frame (the cartridges sit 0.19 apart). */
const COLUMN_WIDTH = 0.17;

function CertificationItem({ c, at }: { c: Certification; at: FrameWindow }) {
  const meta = [c.issuer, c.year].filter(Boolean).join(" · ");
  return (
    <Reveal at={at} data-halo="">
      <p className={ITEM_META}>{meta}</p>
      <h3 className={ITEM_NAME}>{c.name}</h3>
      {c.verifyUrl ? (
        <a
          href={c.verifyUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Verify ${c.name} (opens in a new tab)`}
          className={`mt-3 ${FILM_LINK}`}
        >
          Verify <span aria-hidden>↗</span>
        </a>
      ) : null}
    </Reveal>
  );
}

/**
 * 02 Certifications, the first chapter of part five (§2f): rack-02 opens the security unit and the
 * section arrives with it. f26 the unit lights (plate 02 on its label well, nav → Certifications); the
 * plate lifts at f66 and lands in the heading at f84 while the camera settles straight down over the
 * carrier; each certification arrives once its cartridge has tipped face-up and the carrier has come to
 * rest ([74 + 5k, 80 + 5k]), in a column centred on that cartridge, riding the cartridge's exported track
 * until the camera rests (f84); then the h2, "● SECURITY" and the lede; a 0.5 vh read pin; no body.
 *
 * Desktop: head at frame x 0.13, y 0.17–0.33; the cartridges (y 0.34–0.54) stay clear; the four columns
 * y 0.57–0.80. Phones (portrait film) and anything the fit guard stacks: one block from y 0.62 over the
 * block tone, the four certifications as rows (same windows); what does not fit enters on release.
 */
export function CertificationsSection() {
  return (
    <FilmChapter
      film={FILM}
      id={PLATE.section}
      moveVh={moveVhOf(FILM)}
      choreo={CHOREO_CERTS}
      section={PLATE.section}
      breath={breathOf(FILM)}
      tail={tailOf(FILM)}
      plate={<RackPlate index={2} n={PLATE.n} name={PLATE.headingText} handoff />}
    >
      <BlockTone top={0.62} />
      <FrameBand from={0.17} to={0.33} x={0.13} right={0.62}>
        <ChapterHead
          n={PLATE.n}
          title={PLATE.headingText}
          support={PLATE.machine}
          lede="Verified credentials with direct issuer verification links."
        />
      </FrameBand>
      <FrameBand from={0.57} to={0.8} after={0.33}>
        <FrameColumns
          anchors={CARTRIDGES}
          width={COLUMN_WIDTH}
          items={certifications.map((c, k) => {
            const at = CHOREO_CERTS.items[Math.min(k, CHOREO_CERTS.items.length - 1)];
            const slot = Math.min(k, CARTRIDGES.length - 1);
            return {
              key: c.name,
              node: (
                <RideAnchor
                  film={CHOREO_CERTS.film}
                  anchor={`cartridge_${slot}`}
                  rest={ANCHORS.cartridges[slot]}
                  from={at[0] - 1}
                >
                  <CertificationItem c={c} at={at} />
                </RideAnchor>
              ),
            };
          })}
        />
      </FrameBand>
    </FilmChapter>
  );
}
