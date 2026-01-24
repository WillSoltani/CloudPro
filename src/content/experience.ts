export type ExperienceItem = {
    title: string;
    org: string;
    location?: string;
    dates?: string;
    bullets: string[];
  };
  
  export const experience = {
    work: [
      {
        title: "Software Developer",
        org: "Silicon X",
        location: "Halifax, NS",
        dates: "2022 – Present",
        bullets: [
          "Handled high-volume operations in a time-sensitive environment.",
          "Trained new staff and supported process improvements.",
          "Maintained accuracy and confidentiality with sensitive records.",
        ],
      },
    ] satisfies ExperienceItem[],
  
    education: [
      {
        title: "Bachelors Degree, Computer Science",
        org: "University of British Columbia",
        location: "Canada",
        dates: "2019 – 2024",
        bullets: [
          "Foundations in programming, databases, and systems.",
          "Focused self-study on AWS and modern cloud architecture.",
        ],
      },
    ] satisfies ExperienceItem[],
  };
  