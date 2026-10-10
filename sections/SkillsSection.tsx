"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type Variants } from "framer-motion";

import { Section } from "@/components/Section";
import { SkillCategoryCard } from "@/components/SkillCategoryCard";
import { useReducedMotionSafe } from "@/components/film/ScrollFilm";
import { skillCategories } from "@/content/skills";

const skillsWrap: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

export function SkillsSection() {
  // Subtle parallax: the card grid drifts 20 px against the scroll across its pass through the viewport.
  const gridRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: gridRef, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [20, -20]);

  return (
    <Section
      id="skills"
      title="Skills"
      subtitle="A curated stack for building reliable, secure, and production-ready cloud systems."
    >
      <motion.div
        ref={gridRef}
        style={{ y }}
        variants={skillsWrap}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="grid gap-4 md:grid-cols-2 items-stretch auto-rows-fr"
      >
        {skillCategories.map((cat) => (
          <SkillCategoryCard key={cat.title} cat={cat} />
        ))}
      </motion.div>
    </Section>
  );
}
