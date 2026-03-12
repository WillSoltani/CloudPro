export type ReadingDepth = "simple" | "standard" | "deeper";
export type ExampleScope = "work" | "school" | "personal";

export type ChapterQuizQuestion = {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
};

export type ChapterExample = {
  id: string;
  title: string;
  scope: ExampleScope;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
};

export type BookChapter = {
  id: string;
  order: number;
  code: string;
  title: string;
  minutes: number;
  summaryByDepth: Record<ReadingDepth, string[]>;
  takeaways: string[];
  keyQuote?: string;
  recap?: string;
  examplesDetailed: ChapterExample[];
  quiz: ChapterQuizQuestion[];
};

type BookChapterBundle = {
  pages: number;
  chapters: BookChapter[];
};

function chapterId(order: number): string {
  return `ch-${String(order).padStart(2, "0")}`;
}

function chapterCode(order: number): string {
  return `CH.${String(order).padStart(2, "0")}`;
}

function buildGenericChapter(order: number, title: string, minutes = 10): BookChapter {
  return {
    id: chapterId(order),
    order,
    code: chapterCode(order),
    title,
    minutes,
    summaryByDepth: {
      simple: [
        "Deep work creates more value than fragmented effort.",
        "Guard your attention like a core professional asset.",
        "Small daily focus rituals outperform occasional marathons.",
      ],
      standard: [
        "Deep work produces high-value output by reducing context switching.",
        "Sustained concentration needs explicit boundaries around communication.",
        "Ritualized start times lower friction and increase consistency.",
        "Shallow work expands unless constrained by schedule.",
        "Recovery blocks preserve long-term cognitive capacity.",
        "Progress should be measured in focused minutes and outcomes.",
      ],
      deeper: [
        "Deep work is best treated as a trainable operating system, not inspiration.",
        "Teams need explicit agreements so collaboration does not collapse into interruption.",
        "Synchronous channels should be reserved for high-urgency coordination only.",
        "A weekly review of focus metrics helps calibrate workload quality.",
        "Shallow tasks are not evil, but they must be intentionally bounded.",
        "Attention residue from frequent switching lowers problem-solving depth.",
        "Defaulting to asynchronous communication preserves maker-time windows.",
        "Environmental cues (location, time, tooling) reinforce deep-work identity.",
        "Leaders should model focus-protective behavior to normalize it culturally.",
        "Deep work becomes compounding when paired with deliberate reflection loops.",
      ],
    },
    takeaways: [
      "Protected focus blocks",
      "Intentional async defaults",
      "Measure deep output",
      "Reduce context switching",
    ],
    keyQuote:
      "Clarity and output rise when attention is protected by design.",
    recap:
      "Pick one daily focus ritual, schedule it, and defend it for one week.",
    examplesDetailed: [
      {
        id: `${chapterId(order)}-ex-work`,
        title: "Team focus window",
        scope: "work",
        scenario:
          "Your team keeps losing momentum due to constant pings and ad-hoc calls.",
        whatToDo:
          "Set a shared 2-hour async window each morning and move non-urgent requests out of chat.",
        whyItMatters:
          "Shared guardrails preserve collaboration without sacrificing concentration.",
      },
      {
        id: `${chapterId(order)}-ex-school`,
        title: "Exam prep batching",
        scope: "school",
        scenario:
          "Study sessions feel long but retention remains low due to frequent interruptions.",
        whatToDo:
          "Batch notifications and run two uninterrupted 40-minute blocks with active recall.",
        whyItMatters:
          "Deep focus increases comprehension and reduces total study time.",
      },
      {
        id: `${chapterId(order)}-ex-personal`,
        title: "Personal learning sprint",
        scope: "personal",
        scenario:
          "You want to finish a hard non-fiction book but keep losing consistency.",
        whatToDo:
          "Lock one fixed evening slot with devices on Do Not Disturb and a visible reading target.",
        whyItMatters:
          "Consistency beats intensity for long-term learning habits.",
      },
    ],
    quiz: [
      {
        id: `${chapterId(order)}-q1`,
        prompt: "What most reliably improves deep-work consistency?",
        options: [
          "Waiting for motivation",
          "Scheduling fixed focus sessions",
          "Keeping all channels open",
          "Multi-tasking routine tasks",
        ],
        correctIndex: 1,
        explanation: "Ritualized time blocks reduce decision friction and protect focus.",
      },
      {
        id: `${chapterId(order)}-q2`,
        prompt: "Why limit shallow work windows?",
        options: [
          "To avoid collaboration entirely",
          "To make inbox zero mandatory",
          "To create cognitive space for high-value output",
          "To increase meeting count",
        ],
        correctIndex: 2,
        explanation: "Shallow tasks expand by default and crowd out deep output if unconstrained.",
      },
      {
        id: `${chapterId(order)}-q3`,
        prompt: "Which team default best supports deep work?",
        options: [
          "Immediate response expectation for all messages",
          "Asynchronous-first communication",
          "Hourly status calls",
          "No documentation",
        ],
        correctIndex: 1,
        explanation: "Async-first norms minimize interruptions and preserve maker time.",
      },
      {
        id: `${chapterId(order)}-q4`,
        prompt: "What should be measured weekly?",
        options: [
          "Number of browser tabs open",
          "Focused minutes and meaningful outcomes",
          "Messages sent before noon",
          "Coffee consumed",
        ],
        correctIndex: 1,
        explanation: "Tracking focused input and output provides useful feedback for improvement.",
      },
      {
        id: `${chapterId(order)}-q5`,
        prompt: "What is the best first action after this chapter?",
        options: [
          "Add more tools",
          "Choose one daily focus ritual and schedule it",
          "Remove all collaboration",
          "Delay changes until next month",
        ],
        correctIndex: 1,
        explanation: "A concrete scheduled behavior creates immediate momentum.",
      },
    ],
  };
}

const deepWorkChapter7: BookChapter = {
  id: chapterId(7),
  order: 7,
  code: chapterCode(7),
  title: "Collaborative Deep Work",
  minutes: 14,
  summaryByDepth: {
    simple: [
      "Collaboration and depth can coexist with clear rules.",
      "Use async-first defaults to protect focus time.",
      "Short structured syncs can amplify deep work.",
    ],
    standard: [
      "Collaboration and deep work are not opposites when teams design for both.",
      "The hub-and-spoke model creates idea collisions without endless interruption.",
      "Open collaboration spaces can damage depth when norms are undefined.",
      "Explicit DND signals and async-first defaults protect attention.",
      "Short structured collaboration can improve clarity before solo deep blocks.",
      "Teams should route urgent requests through designated channels only.",
    ],
    deeper: [
      "Collaboration and deep work are not opposites; architecture and norms decide the outcome.",
      "A hub-and-spoke model (central sync points, private deep blocks) increases throughput.",
      "Most open-office 'creativity' is accidental interruption with weak accountability.",
      "Async-first defaults preserve cognition by reducing context fragmentation.",
      "Do Not Disturb signals need social legitimacy, not just personal discipline.",
      "Short, high-signal collaborative sessions should end with explicit next deep steps.",
      "Collaboration quality improves when participants arrive pre-thought and pre-written.",
      "Urgent work must be routed through clear escalation channels to avoid false emergencies.",
      "Depth does not require isolation; it requires protected attention contracts.",
      "Teams that standardize focus rituals produce compounding gains in strategic work.",
    ],
  },
  takeaways: [
    "Hub & Spoke model",
    "Async-first defaults",
    "Depth ≠ isolation",
    "Structured collaboration",
    "Focus blocks",
  ],
  keyQuote:
    "Depth does not require isolation. It requires agreements that protect attention.",
  recap:
    "Define one team-level async window and one weekly high-signal collaboration block.",
  examplesDetailed: [
    {
      id: "ch-07-ex-1",
      title: "Remote team morning ritual",
      scope: "work",
      scenario:
        "A distributed team starts with Slack check-ins, then struggles to make deep progress.",
      whatToDo:
        "Run a 15-minute sync, then enforce an async-only focus window from 9 AM–12 PM.",
      whyItMatters:
        "You preserve deep morning cognition while still aligning on priorities.",
    },
    {
      id: "ch-07-ex-2",
      title: "Whiteboard session with a colleague",
      scope: "work",
      scenario:
        "You need to solve a difficult architecture issue without turning it into a long meeting.",
      whatToDo:
        "Book a 45-minute focused whiteboard session; both sides prepare independently first.",
      whyItMatters:
        "Prepared collaboration amplifies depth instead of replacing it.",
    },
    {
      id: "ch-07-ex-3",
      title: "Student project sprint",
      scope: "school",
      scenario:
        "Group assignment chatter constantly interrupts actual writing and analysis.",
      whatToDo:
        "Use one structured planning call, then assign independent deep-work blocks with async updates.",
      whyItMatters:
        "Clear handoffs reduce social overhead and improve quality of individual output.",
    },
    {
      id: "ch-07-ex-4",
      title: "Open plan office distractions",
      scope: "work",
      scenario:
        "Unplanned desk interruptions make concentrated design work nearly impossible.",
      whatToDo:
        "Introduce desk signal cards for focus mode and batch non-urgent questions into office hours.",
      whyItMatters:
        "Visible norms reduce interruption friction and keep collaboration intentional.",
    },
  ],
  quiz: [
    {
      id: "ch-07-q1",
      prompt: 'What is "deep work" as defined by Newport?',
      options: [
        "Intense physical labor",
        "Focused, distraction-free cognitively demanding work",
        "Working in solitude only",
        "Multi-hour unstructured thinking sessions",
      ],
      correctIndex: 1,
      explanation: "Deep work is sustained cognitive effort without distraction.",
    },
    {
      id: "ch-07-q2",
      prompt: 'Which scheduling philosophy does Newport call "rhythmic"?',
      options: ["Bimodal", "Journalistic", "Rhythmic", "Monastic"],
      correctIndex: 2,
      explanation:
        "Rhythmic scheduling builds a repeatable daily cadence for deep work.",
    },
    {
      id: "ch-07-q3",
      prompt: "Why does social media often hurt deep work?",
      options: [
        "It fragments attention needed for deep work",
        "It reduces IQ over time",
        "It makes communication shallow",
        "It is always unprofessional",
      ],
      correctIndex: 0,
      explanation: "The core issue is fractured attention and context switching.",
    },
    {
      id: "ch-07-q4",
      prompt: 'The "any-benefit" approach to tool selection means...',
      options: [
        "Using any tool that has some benefit",
        "Only using tools that outweigh their costs",
        "Maximising free tools",
        "Avoiding all digital tools",
      ],
      correctIndex: 0,
      explanation:
        "The any-benefit trap accepts tools on small upside while ignoring attention cost.",
    },
    {
      id: "ch-07-q5",
      prompt: 'What does Newport mean by "draining the shallows"?',
      options: [
        "Delegating shallow tasks",
        "Reducing low-value work time to expand deep work capacity",
        "Eliminating all meetings",
        "Focusing on email productivity",
      ],
      correctIndex: 1,
      explanation:
        "The goal is to shrink low-value workload so deep work has protected capacity.",
    },
  ],
};

const deepWorkChapter8: BookChapter = {
  ...buildGenericChapter(8, "Attention Training", 10),
  title: "Attention Training",
  summaryByDepth: {
    simple: [
      "Attention is trainable through deliberate constraints.",
      "Discomfort from boredom is part of focus growth.",
      "Short concentration sprints build long-term stamina.",
    ],
    standard: [
      "Attention is a skill that improves when distraction impulses are resisted.",
      "Boredom tolerance increases your ability to stay in cognitively demanding work.",
      "Context switching taxes working memory and quality.",
      "Intentional transitions reduce residue from previous tasks.",
      "Short high-quality deep blocks beat long distracted sessions.",
      "Recovery windows improve next-session quality.",
    ],
    deeper: [
      "Attention control compounds over time and should be trained deliberately.",
      "Boredom is not a bug; it is a conditioning layer for focus endurance.",
      "Notification reflexes are learned behaviors that can be reversed.",
      "Single-task warmups reduce entry cost into deep sessions.",
      "Boundary rituals protect the cognitive runway needed for difficult thinking.",
      "Shallow interruptions create residue that can linger for many minutes.",
      "Measuring attention quality drives better habits than measuring time only.",
      "Deep work should be paired with intentional recovery to sustain output.",
      "Identity-level commitments ('I protect focus') outperform short-term hacks.",
      "Training attention is prerequisite infrastructure for advanced creative work.",
    ],
  },
  takeaways: [
    "Attention is trainable",
    "Boredom tolerance",
    "Single-task warmups",
    "Recovery cycles",
  ],
};

const deepWorkChapter9: BookChapter = {
  ...buildGenericChapter(9, "The Any-Benefit Approach", 11),
  title: "The Any-Benefit Approach",
  takeaways: [
    "Tool cost awareness",
    "Intentional defaults",
    "Attention budgeting",
    "High-signal communication",
  ],
};

const DEEP_WORK_CHAPTER_TITLES = [
  "Introduction to Deep Work",
  "Deep Work Is Rare",
  "Deep Work Is Meaningful",
  "The Principle of Least Resistance",
  "The Rhythmic Deep Work Scheduling",
  "The Grand Gesture",
  "Collaborative Deep Work",
  "Attention Training",
  "The Any-Benefit Approach",
  "Drain the Shallows",
  "Work Deeply",
  "Embrace Boredom",
  "Quit Social Media",
  "Execute Like a Business",
];

function buildDeepWorkChapters(): BookChapter[] {
  return DEEP_WORK_CHAPTER_TITLES.map((title, index) => {
    const order = index + 1;
    if (order === 7) return deepWorkChapter7;
    if (order === 8) return deepWorkChapter8;
    if (order === 9) return deepWorkChapter9;
    return buildGenericChapter(order, title, [8, 10, 12, 9, 11, 8, 14, 10, 11, 13, 9, 10, 8, 12][index] ?? 10);
  });
}

const deepWorkBundle: BookChapterBundle = {
  pages: 296,
  chapters: buildDeepWorkChapters(),
};

const FALLBACK_BUNDLE: BookChapterBundle = {
  pages: 240,
  chapters: Array.from({ length: 12 }).map((_, index) =>
    buildGenericChapter(index + 1, `Core Idea ${index + 1}`)
  ),
};

const CHAPTERS_BY_BOOK_ID: Record<string, BookChapterBundle> = {
  "deep-work": deepWorkBundle,
};

export function getBookChaptersBundle(bookId: string): BookChapterBundle {
  return CHAPTERS_BY_BOOK_ID[bookId] ?? FALLBACK_BUNDLE;
}

export function getChapterById(
  bookId: string,
  chapterId: string
): BookChapter | undefined {
  return getBookChaptersBundle(bookId).chapters.find(
    (chapter) => chapter.id === chapterId
  );
}

