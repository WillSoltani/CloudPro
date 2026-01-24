import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { projects } from "@/src/content/projects";
import { PageShell } from "@/src/components/PageShell";
import { Chip } from "@/src/components/Chip";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Props = {
  params: { slug: string };
};

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

export default function ProjectPage({ params }: Props) {
  const project = projects.find((p) => p.slug === params.slug);
  if (!project) return notFound();

  const cs = project.caseStudy;

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[260px]">
            <p className="text-sm text-slate-400">Project Case Study</p>
            <h1 className="mt-2 text-3xl font-semibold">{project.title}</h1>
            <p className="mt-3 max-w-2xl text-slate-300">{project.summary}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {project.tags.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                asChild
                variant="outline"
                className="border-white/10 bg-white/5"
              >
                <Link href="/#projects">Back to Projects</Link>
              </Button>

              {project.repoUrl && project.repoUrl !== "#" ? (
                <Button
                  asChild
                  variant="outline"
                  className="border-white/10 bg-white/5"
                >
                  <Link href={project.repoUrl} target="_blank" rel="noreferrer">
                    Repo
                  </Link>
                </Button>
              ) : null}

              {project.liveUrl && project.liveUrl !== "#" ? (
                <Button
                  asChild
                  variant="outline"
                  className="border-white/10 bg-white/5"
                >
                  <Link href={project.liveUrl} target="_blank" rel="noreferrer">
                    Live Demo
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          {project.diagramPath ? (
            <Card className="w-full border-white/10 bg-white/5 p-4 md:w-[520px]">
              <p className="mb-3 text-xs font-semibold text-slate-200">
                Architecture Diagram
              </p>
              <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-white/10">
                <Image
                  src={project.diagramPath}
                  alt={`${project.title} architecture diagram`}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <p className="mt-3 text-xs text-slate-400">
                Put your exported Lucidchart diagram here.
              </p>
            </Card>
          ) : null}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Card className="border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Problem</h2>
            <p className="mt-3 text-sm text-slate-300">{cs.problem}</p>
          </Card>

          <Card className="border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Approach</h2>
            <p className="mt-3 text-sm text-slate-300">{cs.approach}</p>
          </Card>

          <Card className="border-white/10 bg-white/5 p-6 md:col-span-2">
            <h2 className="text-lg font-semibold">Architecture</h2>
            <p className="mt-3 text-sm text-slate-300">{cs.architecture.overview}</p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {cs.architecture.services.map((s) => (
                <Card
                  key={s.name}
                  className="border-white/10 bg-white/5 p-4"
                >
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="mt-2 text-sm text-slate-300">{s.why}</p>
                </Card>
              ))}
            </div>
          </Card>

          <Card className="border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Security</h2>
            <div className="mt-3">
              <List items={cs.security} />
            </div>
          </Card>

          <Card className="border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Reliability</h2>
            <div className="mt-3">
              <List items={cs.reliability} />
            </div>
          </Card>

          <Card className="border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Observability</h2>
            <div className="mt-3">
              <List items={cs.observability} />
            </div>
          </Card>

          <Card className="border-white/10 bg-white/5 p-6">
            <h2 className="text-lg font-semibold">Cost Controls</h2>
            <div className="mt-3">
              <List items={cs.cost} />
            </div>
          </Card>

          {cs.demoNotes && cs.demoNotes.length > 0 ? (
            <Card className="border-white/10 bg-white/5 p-6 md:col-span-2">
              <h2 className="text-lg font-semibold">Demo Notes</h2>
              <div className="mt-3">
                <List items={cs.demoNotes} />
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
