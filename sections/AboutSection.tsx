"use client";

import { FilmChapter } from "@/components/film/FilmChapter";
import { ChapterHead } from "@/components/film/ChapterHead";
import { BlockTone, FrameBand } from "@/components/film/FrameLayout";
import { FlowReveal, Reveal } from "@/components/film/Reveal";
import { RackPlate } from "@/components/film/RackPlate";
import { CHOREO } from "@/components/film/choreo";
import { RACK_CAPTIONS } from "@/components/film/rackCaptions";
import { REEL, REEL_INDEX, breathOf, moveVhOf, tailOf } from "@/components/film/reel";
import { BODY_TEXT, ITEM_META, MONO_LABEL, TEXT_LINK } from "@/components/film/sectionTokens";
import { about } from "@/content/about";
import { delivery } from "@/content/delivery";

const FILM = REEL[REEL_INDEX.about];
const C = CHOREO.about;
const PLATE = RACK_CAPTIONS.plates[0];

/** The ProofStrip's four tokens (folded into About: they arrive on the read pin, one line above the ports). */
const PROOF = ["AWS Certified ×3", "Web, mobile and AI", "Least-privilege IAM, KMS", "Alarms and runbooks"];
const LINKEDIN = RACK_CAPTIONS.contact.links.find((l) => l.id === "linkedin")!;

/** About's body: the references line, then DeliveryStrip (how the site itself ships). */
function DeliveryBody() {
  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
      <FlowReveal>
        <p className={BODY_TEXT}>
          {about.references}:{" "}
          <a
            href={LINKEDIN.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${about.references}: LinkedIn (opens in a new tab)`}
            className={TEXT_LINK}
          >
            LinkedIn <span aria-hidden>↗</span>
          </a>
        </p>
      </FlowReveal>
      <FlowReveal>
        <h3 className={`mt-12 ${MONO_LABEL} text-slate-300`}>How this site ships</h3>
      </FlowReveal>
      <ul className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {delivery.map((d) => (
          <FlowReveal as="li" key={d.title}>
            <p className={MONO_LABEL}>{d.title}</p>
            <p className={`mt-2 ${BODY_TEXT}`}>{d.body}</p>
          </FlowReveal>
        ))}
      </ul>
    </div>
  );
}

/**
 * 01 About, joined to the hero (§2f): rack-01 opens the switch while the hero's line and CTA ride out over
 * the door; plate 01 on the unit at f20 (nav → About), lifting at f75 and landing in the heading at f96 as
 * the lid rises; "● SWITCH", the lede, then the three bullets on the board; at the read pin the four proof
 * tokens arrive in one line above the port cages; on release the delivery notes follow as the body.
 *
 * Desktop: head x 0.18, y 0.19–0.36 · bullets x 0.18–0.60, y 0.38–0.66 · tokens y 0.70–0.76; the board's
 * right half stays empty. Phones: one block from y 0.60 (heading no earlier than f40); bullets 1–2 in the
 * block, the rest flows.
 */
export function AboutSection() {
  return (
    <FilmChapter
      film={FILM}
      id={PLATE.section}
      moveVh={moveVhOf(FILM)}
      choreo={C}
      section={PLATE.section}
      breath={breathOf(FILM)}
      tail={tailOf(FILM)}
      join
      plate={<RackPlate index={REEL_INDEX.about} n={PLATE.n} name={PLATE.headingText} handoff />}
      body={<DeliveryBody />}
    >
      <BlockTone top={0.6} />
      <FrameBand from={0.19} to={0.36} x={0.18} right={0.6} stackedTop={0.6}>
        <ChapterHead
          n={PLATE.n}
          title={PLATE.headingText}
          support={PLATE.machine}
          lede="How I build and run AWS systems for clients."
        />
      </FrameBand>
      <FrameBand from={0.38} to={0.66} after={0.36} x={0.18} right={0.6}>
        <ul className="max-w-[40rem] space-y-4 wide:space-y-5">
          {about.bullets.map((b, k) => (
            <Reveal as="li" key={b} at={C.items[k]} data-halo="" className={BODY_TEXT}>
              {b}
            </Reveal>
          ))}
        </ul>
      </FrameBand>
      <FrameBand from={0.7} to={0.76} after={0.66} x={0.18} right={0.86}>
        <ul aria-label="At a glance" className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          {PROOF.map((t, k) => (
            <Reveal
              as="li"
              key={t}
              pin={C.pins?.[k]}
              stackedPin={C.stacked?.pins?.[k]}
              className={`${ITEM_META} flex items-baseline gap-x-3`}
            >
              {k > 0 ? (
                <span aria-hidden className="text-slate-500">
                  ·
                </span>
              ) : null}
              {t}
            </Reveal>
          ))}
        </ul>
      </FrameBand>
    </FilmChapter>
  );
}
