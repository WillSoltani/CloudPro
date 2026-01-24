import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/src/components/Chip";
import type { Project } from "@/src/content/projects";

type Props = {
  project: Project;
};

export function ProjectCard({ project }: Props) {
  return (
    <Card className="border-white/10 bg-white/5 p-6 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{project.title}</h3>
            {project.featured ? (
              <Badge className="bg-sky-500/10 text-sky-300 hover:bg-sky-500/10">
                Featured
              </Badge>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {project.summary}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {project.tags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <Button asChild className="bg-white/10 text-slate-100 hover:bg-white/15">
            <Link href={`/projects/${project.slug}`}>Case Study</Link>
          </Button>

          {project.repoUrl ? (
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

          {project.liveUrl ? (
            <Button
              asChild
              variant="outline"
              className="border-white/10 bg-white/5"
            >
              <Link href={project.liveUrl} target="_blank" rel="noreferrer">
                Live
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
