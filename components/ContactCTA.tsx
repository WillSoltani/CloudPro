"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Github, Linkedin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  email: string;
  githubUrl: string;
  linkedinUrl: string;
};

export function ContactCTA({ email, githubUrl, linkedinUrl }: Props) {
  return (
    <Card className="group relative overflow-hidden border-white/10 bg-white/5 p-8 text-center backdrop-blur">
      {/* Subtle section gradient */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(800px_circle_at_50%_10%,rgba(56,189,248,0.10),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_120%,rgba(139,92,246,0.08),transparent_55%)]" />

      <div className="relative">
        <h3 className="text-2xl font-semibold bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">Let’s Connect</h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300">
          I’m looking for cloud roles and I love building production-style AWS projects.
          Reach out for opportunities, collaborations, or code reviews.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {/* Gradient CTA button */}
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
            <Button
              asChild
              className="relative overflow-hidden border border-white/10 bg-gradient-to-r from-sky-500/20 via-emerald-500/15 to-violet-500/20 text-slate-100 shadow-[0_0_0_rgba(0,0,0,0)] hover:shadow-[0_12px_50px_rgba(56,189,248,0.18)]"
            >
              <a href={`mailto:${email}`}>
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </span>
              </a>
            </Button>
          </motion.div>

          {/* GitHub */}
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
            <Button
              asChild
              className="relative overflow-hidden border border-white/10
                bg-gradient-to-r from-slate-500/20 via-slate-400/10 to-slate-500/20
                text-slate-100
                shadow-[0_0_0_rgba(0,0,0,0)]
                hover:shadow-[0_12px_50px_rgba(148,163,184,0.20)]"
            >
              <a href={githubUrl} target="_blank" rel="noreferrer">
                <span className="inline-flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  GitHub
                </span>
              </a>
            </Button>
          </motion.div>


          {/* LinkedIn */}
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>
            <Button
              asChild
              className="relative overflow-hidden border border-white/10
                bg-gradient-to-r from-sky-500/25 via-blue-500/15 to-indigo-500/20
                text-slate-100
                shadow-[0_0_0_rgba(0,0,0,0)]
                hover:shadow-[0_12px_50px_rgba(56,189,248,0.25)]"
            >
              <a href={linkedinUrl} target="_blank" rel="noreferrer">
                <span className="inline-flex items-center gap-2">
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </span>
              </a>
            </Button>
          </motion.div>

        </div>
      </div>
    </Card>
  );
}
