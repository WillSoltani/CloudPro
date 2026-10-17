/** External profiles shown in the navbar (and quoted by the Contact section). */
export const social = [
  { id: "github", label: "GitHub", href: "https://github.com/WillSoltani" },
  { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/will-soltani" },
] as const;

export type SocialId = (typeof social)[number]["id"];
