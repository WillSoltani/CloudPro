export type Engagement = {
  title: string;
  body: string;
};

/**
 * About's "Ways to work together" grid (sections/AboutSection.tsx, the four-column grid that held "How this site
 * ships"). The same four names and lines feed the ProfessionalService offers in the homepage JSON-LD.
 */
export const engagements: Engagement[] = [
  {
    title: "Architecture review",
    body: "A written review of your AWS setup: security, cost and reliability, with fixes ranked.",
  },
  {
    title: "Build a product",
    body: "From first sketch to a live web or mobile product on AWS, with sign-in and payments.",
  },
  {
    title: "Fix or scale a system",
    body: "Find out why a system is slow, costly or fragile, fix it, and leave alarms behind.",
  },
  {
    title: "Add AI features",
    body: "LLM features inside your product, with checks on what the model sends back.",
  },
];

/** The two lines under the grid (BODY_TEXT). */
export const engagementProcess = "How a project runs: a short call, a written scope, then a demo every week. The code and the AWS account stay yours.";
export const replyTime = "I reply within one business day.";
