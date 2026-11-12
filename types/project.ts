export type CaseStudyDecision = {
  title: string;
  detail: string;
};

export type CaseStudy = {
  /** "What it does" (the section formerly titled Problem Statement). */
  overview: string;
  /** "How it works": rendered as a numbered list straight after the overview. */
  architecture: string[];
  decisions: CaseStudyDecision[];
  security: string[];
  observability: string[];
  /** "When things fail". */
  failureModes: string[];
  cost: string[];
  next: string[];

  problem?: string;
  solution?: string;
  diagram?: {
    src: string;
    alt?: string;
    caption?: string;
    width?: number;
    height?: number;
    priority?: boolean;
  };
  takeaways?: string[];
};

export type Project = {
  slug: string;
  title: string;
  description: string;

  githubUrl?: string;
  demoUrl?: string;
  /** Link text for an internal demoUrl (a relative URL has no host to show). */
  demoLabel?: string;
  tags?: string[];
  featured?: boolean;

  type?: string;
  stack?: string;
  status?: string;
  /** The facts line under the case-study h1. */
  byline?: string;
  /** The closing action on the case-study page, after the email. */
  nextStep?: { label: string; href: string };

  caseStudy?: CaseStudy;
};
