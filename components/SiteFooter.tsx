"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";

export function SiteFooter() {
  return (
    <div className="mt-10 flex flex-col items-center justify-center gap-2 text-center">
      <div className="h-px w-full max-w-6xl bg-white/5" />

      <p className="mt-6 text-xs text-slate-500">
        © {new Date().getFullYear()} Will Soltani. Built with Next.js + Tailwind. Hosted on AWS.
      </p>

      <p className="flex items-center gap-2 text-xs text-slate-500">
        Crafted with
        <motion.span
          animate={{ scale: [1, 1.25, 1], opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="inline-flex"
        >
          <Heart className="h-4 w-4 text-rose-400" />
        </motion.span>
        and unhealthy curiosity.
      </p>
    </div>
  );
}
