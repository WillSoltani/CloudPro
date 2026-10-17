"use client";

import { usePathname } from "next/navigation";
import { InteractiveBackground } from "@/components/InteractiveBackground";

/** The particle canvas everywhere on the portfolio except the homepage, where the film plays. */
export function PortfolioBackground() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <InteractiveBackground />;
}
