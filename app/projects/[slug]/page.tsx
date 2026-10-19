import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fraunces } from "@/app/_lib/fraunces";

import { projects } from "@/content/projects";
import type { Project } from "@/types/project";
import { ITEM_META, TEXT_LINK } from "@/components/film/sectionTokens";


/** The one real picture under each title: a capture of the live product (phones get the portrait capture). */
type Picture = {
  alt: string;
  caption: string;
  wide: { src: string; width: number; height: number };
  narrow?: { src: string; width: number; height: number };
};
const PICTURES: Record<string, Picture> = {
  "serverless-file-pipeline": {
    alt: "The guest converter at soltani.org/test with one finished job: a PNG converted to WebP.",
    caption: "The guest demo on this site, after a 35 KB PNG became a 9 KB WebP.",
    wide: { src: "/case-studies/pipeline-job-done-1440.webp", width: 1440, height: 900 },
    narrow: { src: "/case-studies/pipeline-job-done-390.webp", width: 780, height: 1688 },
  },
  chapterflow: {
    alt: "The library section of chapterflow.ca, with a carousel of book covers.",
    caption: "chapterflow.ca: the library, over 130 books in guided chapters.",
    wide: { src: "/case-studies/chapterflow-library-1440.webp", width: 1440, height: 900 },
    narrow: { src: "/case-studies/chapterflow-library-390.webp", width: 780, height: 1688 },
  },
  "soltani-org": {
    alt: "The first frame of the soltani.org film, a dark data hall, with the name set over it.",
    caption: "The page's first frame, as it appears in a link preview.",
    wide: { src: "/og/soltani-og.png", width: 1200, height: 630 },
  },
};

function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

type ParamsPromise = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: ParamsPromise }): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) return { title: "Not found · Will Soltani" };

  // Each case study unfurls as itself, with its own preview image (public/og/case-<slug>.png; soltani.org
  // uses the homepage's).
  const title = `${project.title} · Case study`;
  const image = slug === "soltani-org" ? "/og/soltani-og.png" : `/og/case-${slug}.png`;
  return {
    title: `${title} · Will Soltani`,
    description: project.description,
    alternates: { canonical: `/projects/${slug}` },
    openGraph: {
      title,
      description: project.description,
      type: "article",
      url: `/projects/${slug}`,
      siteName: "Will Soltani",
      locale: "en_CA",
      images: [{ url: image, width: 1200, height: 630, alt: `${project.title}, a case study on soltani.org` }],
    },
    twitter: { card: "summary_large_image" },
  };
}

/* The page's type: one serif for the title and the section headings, Geist Sans for reading. */
const H2 = "font-serif text-[1.75rem] font-normal leading-tight text-slate-50 sm:text-[2rem]";
const BODY = "text-[17px] leading-[1.7] text-slate-200";
// ≤ 72 characters a line at 17 px (Geist averages ≈ 7.2 px a character there; 68ch ran to ≈ 93).
const MEASURE = "max-w-[32.5rem]";
const isExternal = (href: string) => /^https?:\/\//.test(href);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-16 sm:mt-20">
      <h2 className={H2}>{title}</h2>
      <div className={`mt-5 ${MEASURE}`}>{children}</div>
    </section>
  );
}

/** A plain list of lines (failure modes, next steps). */
function Lines({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((line) => (
        <li key={line} className={`${BODY} relative pl-5`}>
          <span aria-hidden className="absolute left-0 top-[0.72em] h-1 w-1 rounded-full bg-slate-300" />
          {line}
        </li>
      ))}
    </ul>
  );
}

/** A text link that opens in a new tab: the arrow, and the hint read aloud. */
function NewTabLink({ href, children, className = TEXT_LINK }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children} <span aria-hidden>↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export default async function ProjectPage({ params }: { params: ParamsPromise }) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  const cs = project.caseStudy;
  const picture = PICTURES[project.slug];
  const next = projects[(projects.indexOf(project) + 1) % projects.length];
  const email = `mailto:will@soltani.org?subject=${encodeURIComponent(`Project enquiry: ${project.title}`)}`;
  const step = project.nextStep;

  return (
    <main className={`${fraunces.variable} relative px-5 pb-28 pt-8 sm:px-8 sm:pt-10`}>
      <div className="mx-auto max-w-[68rem]">
        <Link href="/#projects" className={`${TEXT_LINK} text-[15px]`}>
          Back to soltani.org
        </Link>

        <header className="mt-14 sm:mt-20">
          <h1 className="max-w-[18ch] font-serif text-[2.75rem] font-normal leading-[1.02] tracking-[-0.015em] text-slate-50 [font-variation-settings:'opsz'_144] sm:text-[clamp(3.5rem,7vw,5.5rem)]">
            {project.title}
          </h1>
          <p className="mt-6 max-w-[40rem] font-serif text-xl leading-snug text-slate-200 sm:text-[1.5rem]">
            {project.description}
          </p>
          {project.byline ? (
            <p className="mt-4 max-w-[29rem] text-[15px] leading-relaxed text-slate-300">{project.byline}</p>
          ) : null}
        </header>

        {picture ? (
          <figure className="mt-12 sm:mt-14">
            <picture>
              {picture.narrow ? (
                <source
                  media="(max-width: 640px)"
                  srcSet={picture.narrow.src}
                  width={picture.narrow.width}
                  height={picture.narrow.height}
                />
              ) : null}
              {/* A plain <img> in a <picture> (art direction: the portrait capture on phones); the captures are
                  already sized WebP, and width/height reserve the box, so nothing shifts as it loads. */}
              <img
                src={picture.wide.src}
                width={picture.wide.width}
                height={picture.wide.height}
                alt={picture.alt}
                decoding="async"
                fetchPriority="high"
                className="h-auto w-full rounded-sm bg-[#0b1020]"
              />
            </picture>
            <figcaption className="mt-3 text-[15px] leading-relaxed text-slate-300">{picture.caption}</figcaption>
          </figure>
        ) : null}

        {project.stack ? (
          <p className={`mt-10 ${ITEM_META}`}>
            <span aria-hidden className="mr-2 text-lamp">
              ●
            </span>
            {project.stack}
          </p>
        ) : null}

        {cs?.overview ? (
          <Section title="What it does">
            <p className={BODY}>{cs.overview}</p>
          </Section>
        ) : null}

        {cs?.architecture?.length ? (
          <Section title="How it works">
            <ol className="space-y-4">
              {cs.architecture.map((line, i) => (
                <li key={line} className={`${BODY} grid grid-cols-[2.25rem_1fr]`}>
                  <span aria-hidden className="pt-[0.2em] font-mono text-[13px] text-slate-300">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </Section>
        ) : null}

        {cs?.decisions?.length ? (
          <Section title="Decisions and tradeoffs">
            <div className="space-y-8">
              {cs.decisions.map((d) => (
                <div key={d.title}>
                  <h3 className="text-[17px] font-semibold leading-snug text-slate-50">{d.title}</h3>
                  <p className={`mt-2 ${BODY}`}>{d.detail}</p>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {cs?.failureModes?.length ? (
          <Section title="What can go wrong">
            <Lines items={cs.failureModes} />
          </Section>
        ) : null}

        {cs?.next?.length ? (
          <Section title="What's next">
            <Lines items={cs.next} />
          </Section>
        ) : null}

        {/* The close, in the homepage Contact's voice: one line, the next step, the email, the next case study. */}
        <section className="mt-20 sm:mt-28" aria-labelledby="case-close">
          <h2 id="case-close" className={`${H2} max-w-[24ch]`}>
            Need something like this built or reviewed?
          </h2>
          <p className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-[17px]">
            {step ? (
              isExternal(step.href) ? (
                <NewTabLink href={step.href}>{step.label}</NewTabLink>
              ) : (
                <Link href={step.href} rel={step.href === "/test" ? "nofollow" : undefined} prefetch={false} className={TEXT_LINK}>
                  {step.label}
                </Link>
              )
            ) : null}
            <a href={email} aria-label="Email will@soltani.org" className={TEXT_LINK}>
              will@soltani.org
            </a>
            {project.githubUrl ? <NewTabLink href={project.githubUrl}>Source on GitHub</NewTabLink> : null}
          </p>
          {next && next.slug !== project.slug ? (
            <p className="mt-12 text-[15px] text-slate-300">
              <Link href={`/projects/${next.slug}`} className={TEXT_LINK}>
                Next case study: {next.title}
              </Link>
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
