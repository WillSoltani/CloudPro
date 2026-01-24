import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Section } from "@/src/components/Section";
import { certifications } from "@/src/content/certifications";
import { Chip } from "@/src/components/Chip";
import { skillCategories } from "@/src/content/skills";
import { projects } from "@/src/content/projects";
import { ProjectCard } from "@/src/components/ProjectCard";
import { Navbar } from "@/src/components/Navbar";
import { ExperienceCard } from "@/src/components/ExperienceCard";
import { ContactCTA } from "@/src/components/ContactCTA";
import { experience } from "@/src/content/experience";
import { DeliveryStrip } from "@/src/components/DeliveryStrip";
import { delivery } from "@/src/content/delivery";
import { about } from "@/src/content/about";
import { PageShell } from "@/src/components/PageShell";
import { Github, Linkedin } from "lucide-react";
import { BadgeCheck } from "lucide-react";








export default function Home() {
  return (
    <PageShell>

      {/* Hero */}
      <section className="relative">
        {/* subtle glow background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_20%,rgba(59,130,246,0.18),transparent_55%)]" />

        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 py-24 text-center">
          <Badge className="mb-6 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10">
            Available for full-time opportunities
          </Badge>

          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Will Soltani
          </h1>

          <p className="mt-4 text-xl text-sky-300">
            Cloud Engineer | AWS Solutions Architect
          </p>

          <p className="mt-8 max-w-2xl text-base leading-relaxed text-slate-300">
            I build reliable, scalable, cost-aware cloud systems on AWS and ship
            portfolio-grade projects with real security, observability, and CI/CD.
          </p>

          <p className="mt-4 text-sm text-slate-400">Halifax, NS | Open to Remote</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="outline" className="border-white/10 bg-white/5">
              <a href="https://github.com/WillSoltani" target="_blank" rel="noreferrer">
                <span className="inline-flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  GitHub
                </span>
              </a>
            </Button>

            <Button asChild variant="outline" className="border-white/10 bg-white/5">
              <a
                href="https://www.linkedin.com/in/will-soltani"
                target="_blank"
                rel="noreferrer"
              >
                <span className="inline-flex items-center gap-2">
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </span>
              </a>
            </Button>

          </div>


          <div className="mt-6">
            <Button asChild className="bg-white/10 text-slate-100 hover:bg-white/15">
              <a href="#projects">View Projects &amp; Case Studies</a>
            </Button>

          </div>

          {/* a placeholder card so you see the “glass” style */}
          <Card className="mt-12 w-full max-w-2xl border-white/10 bg-white/5 p-6 text-left">
            <p className="text-sm text-slate-300">
              Next: we’ll add Certifications, Skills, Projects, Experience, and
              Contact sections using reusable components so updating the site is easy.
            </p>
          </Card>
        </div>
      </section>
      <DeliveryStrip items={delivery} />






      {/* Placeholder sections so nav anchors work */}
      <Section id="about" title={about.headline} subtitle="How I approach building cloud systems.">
        <Card className="border-white/10 bg-white/5 p-6 backdrop-blur">
          <ul className="list-disc space-y-3 pl-5 text-sm text-slate-300">
            {about.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-slate-300">{about.closing}</p>
        </Card>
      </Section>

      <Section
        id="certifications"
        title="Certifications"
        subtitle="Verified AWS certifications. Links go to Credly verification pages."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {certifications.map((c) => (
            <Card
              key={c.name}
              className="border-white/10 bg-white/5 p-6 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">{c.issuer}</p>
                  <h3 className="mt-1 text-base font-semibold leading-snug">
                    {c.name}
                  </h3>
                  {c.year ? (
                    <p className="mt-2 text-xs text-slate-400">{c.year}</p>
                  ) : null}
                </div>

                {c.verifyUrl ? (
                  <Button asChild variant="outline" className="border-white/10 bg-white/5">
                    <Link href={c.verifyUrl} target="_blank" rel="noreferrer">
                      <span className="inline-flex items-center gap-2">
                        <BadgeCheck className="h-4 w-4" />
                        Verify
                      </span>
                    </Link>
                  </Button>

                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </Section>


      <Section
        id="skills"
        title="Skills"
        subtitle="Tools and services I use to build secure, observable, cost-aware systems."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {skillCategories.map((cat) => (
            <Card
              className="border-white/10 bg-white/5 p-6 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/7"
              key={cat.title}
                          >
              <h3 className="text-base font-semibold">{cat.title}</h3>

              <div className="mt-4 flex flex-wrap gap-2">
                {cat.items.map((item) => (
                  <Chip key={item}>{item}</Chip>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </Section>


      <Section
        id="projects"
        title="Projects"
        subtitle="Portfolio-grade builds with real security, reliability, and observability. Click into a case study for architecture + tradeoffs."
      >
        <div className="grid gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      </Section>


      <Section
        id="experience"
        title="Experience"
        subtitle="Highlights that show operational maturity, communication, and consistency."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ExperienceCard title="Work" items={experience.work} />
          <ExperienceCard title="Education" items={experience.education} />
        </div>
      </Section>


      <Section id="contact" title="Contact">
        <ContactCTA
          email="you@example.com"
          githubUrl="https://github.com/"
          linkedinUrl="https://www.linkedin.com/"
        />
        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Will Soltani. Built with Next.js + Tailwind. Hosted on AWS.
        </p>
      </Section>

      </PageShell>
  );
}
