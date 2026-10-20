import { Fraunces } from "next/font/google";

/**
 * The portfolio's display face, one instance for every page that uses it (the homepage, the case studies,
 * the 404), so they share one font stylesheet: separate instances each got a chunk, and the 404's was
 * preloaded on the homepage without being used (a console warning). Applied per page (`fraunces.variable`
 * on the page's root), so ChapterFlow's routes never load it; `font-serif` reads --font-fraunces.
 */
export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  style: "normal",
  axes: ["opsz"],
  display: "swap",
  variable: "--font-fraunces",
});
