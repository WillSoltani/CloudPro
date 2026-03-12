export type BookDifficulty = "Easy" | "Medium" | "Hard";

export type BookCatalogItem = {
  id: string;
  icon: string;
  title: string;
  author: string;
  category: string;
  difficulty: BookDifficulty;
  estimatedMinutes: number;
};

export const BOOKS_CATALOG: BookCatalogItem[] = [
  {
    id: "deep-work",
    icon: "🌊",
    title: "Deep Work",
    author: "Cal Newport",
    category: "Productivity",
    difficulty: "Medium",
    estimatedMinutes: 180,
  },
  {
    id: "atomic-habits",
    icon: "⚡",
    title: "Atomic Habits",
    author: "James Clear",
    category: "Productivity",
    difficulty: "Easy",
    estimatedMinutes: 150,
  },
  {
    id: "zero-to-one",
    icon: "💼",
    title: "Zero to One",
    author: "Peter Thiel",
    category: "Business",
    difficulty: "Easy",
    estimatedMinutes: 120,
  },
  {
    id: "lean-startup",
    icon: "🚀",
    title: "The Lean Startup",
    author: "Eric Ries",
    category: "Business",
    difficulty: "Medium",
    estimatedMinutes: 210,
  },
  {
    id: "power-of-habit",
    icon: "🧠",
    title: "The Power of Habit",
    author: "Charles Duhigg",
    category: "Psychology",
    difficulty: "Easy",
    estimatedMinutes: 150,
  },
  {
    id: "thinking-fast-slow",
    icon: "🧩",
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    category: "Psychology",
    difficulty: "Hard",
    estimatedMinutes: 360,
  },
  {
    id: "how-to-win-friends",
    icon: "🤝",
    title: "How to Win Friends and Influence People",
    author: "Dale Carnegie",
    category: "Communication",
    difficulty: "Easy",
    estimatedMinutes: 240,
  },
  {
    id: "leaders-eat-last",
    icon: "🧭",
    title: "Leaders Eat Last",
    author: "Simon Sinek",
    category: "Leadership",
    difficulty: "Medium",
    estimatedMinutes: 300,
  },
  {
    id: "psychology-of-money",
    icon: "💸",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    category: "Finance",
    difficulty: "Easy",
    estimatedMinutes: 180,
  },
  {
    id: "why-we-sleep",
    icon: "🌙",
    title: "Why We Sleep",
    author: "Matthew Walker",
    category: "Health",
    difficulty: "Medium",
    estimatedMinutes: 300,
  },
  {
    id: "meditations",
    icon: "🏛️",
    title: "Meditations",
    author: "Marcus Aurelius",
    category: "Philosophy",
    difficulty: "Medium",
    estimatedMinutes: 180,
  },
  {
    id: "art-of-war",
    icon: "⚔️",
    title: "The Art of War",
    author: "Sun Tzu",
    category: "Strategy",
    difficulty: "Medium",
    estimatedMinutes: 140,
  },
  {
    id: "so-good",
    icon: "🎯",
    title: "So Good They Can't Ignore You",
    author: "Cal Newport",
    category: "Career",
    difficulty: "Medium",
    estimatedMinutes: 240,
  },
  {
    id: "steal-like-an-artist",
    icon: "🎨",
    title: "Steal Like an Artist",
    author: "Austin Kleon",
    category: "Creativity",
    difficulty: "Easy",
    estimatedMinutes: 130,
  },
  {
    id: "pragmatic-programmer",
    icon: "💻",
    title: "The Pragmatic Programmer",
    author: "Andrew Hunt & David Thomas",
    category: "Tech",
    difficulty: "Hard",
    estimatedMinutes: 330,
  },
];

export function getBookById(bookId: string): BookCatalogItem | undefined {
  return BOOKS_CATALOG.find((book) => book.id === bookId);
}

const SYNOPSIS_BY_BOOK_ID: Record<string, string> = {
  "deep-work":
    "A practical blueprint for building distraction-free concentration and producing high-value work in a noisy world.",
  "atomic-habits":
    "A systems-first approach to behavior design that turns tiny actions into long-term identity change.",
  "zero-to-one":
    "A startup lens on building unique products and escaping incremental competition.",
  "lean-startup":
    "A framework for building products with rapid feedback loops and validated learning.",
  "power-of-habit":
    "An exploration of how cue-routine-reward loops shape personal and organizational behavior.",
  "thinking-fast-slow":
    "A deep dive into cognitive biases, decision-making, and the dual-system mind.",
  "how-to-win-friends":
    "Timeless relationship principles for communication, trust, and influence.",
  "leaders-eat-last":
    "A leadership playbook focused on trust, culture, and long-term team resilience.",
  "psychology-of-money":
    "Behavioral lessons about wealth, risk, and long-horizon financial decision-making.",
  "why-we-sleep":
    "A science-backed case for better sleep and its impact on focus, health, and performance.",
  meditations:
    "A stoic collection of reflections on discipline, perspective, and personal responsibility.",
  "art-of-war":
    "Compact strategic principles about leverage, timing, and situational awareness.",
  "so-good":
    "A career strategy that prioritizes rare, valuable skills over passion-first planning.",
  "steal-like-an-artist":
    "A creative manifesto on remixing influences into authentic, repeatable output.",
  "pragmatic-programmer":
    "A software craftsmanship guide for pragmatic thinking, habits, and maintainable systems.",
};

export function getBookSynopsis(bookId: string): string {
  return (
    SYNOPSIS_BY_BOOK_ID[bookId] ??
    "A focused, chapter-based learning experience with examples, quizzes, and measurable progress."
  );
}
