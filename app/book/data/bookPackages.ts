import friendsAndInfluencePackageJson from "@/book-packages/friends-and-influence-student-edition.student.json";
import artOfWarPackageJson from "@/book-packages/art-of-war.modern.json";
import thePrincePackageJson from "@/book-packages/the-prince.modern.json";
import strategiesOfWarPackageJson from "@/book-packages/33-strategies-of-war.modern.json";
import influencePackageJson from "@/book-packages/influence.modern.json";
import lawsOfHumanNaturePackageJson from "@/book-packages/laws-of-human-nature.modern.json";
import preSuasionPackageJson from "@/book-packages/pre-suasion.modern.json";
import neverSplitTheDifferencePackageJson from "@/book-packages/never-split-the-difference.modern.json";

export type VariantFamily = "EMH" | "PBC";
export type VariantKey =
  | "easy"
  | "medium"
  | "hard"
  | "precise"
  | "balanced"
  | "challenging";

export type PackageVariantContent = {
  importantSummary?: string;
  summaryBullets?: string[];
  keyTakeaways?: string[];
  takeaways?: string[];
  practice?: string[];
};

export type PackageQuizQuestion = {
  questionId: string;
  prompt: string;
  choices: string[];
  correctIndex?: number;
  correctAnswerIndex?: number;
  explanation?: string;
};

export type PackageQuiz = {
  passingScorePercent: number;
  questions: PackageQuizQuestion[];
};

export type PackageExample = {
  exampleId: string;
  title: string;
  scenario: string;
  whatToDo: string[];
  whyItMatters: string;
  contexts?: string[];
};

export type PackageChapter = {
  chapterId: string;
  number: number;
  title: string;
  readingTimeMinutes: number;
  contentVariants: Partial<Record<VariantKey, PackageVariantContent>>;
  examples: PackageExample[];
  quiz: PackageQuiz;
};

export type PackageBook = {
  bookId: string;
  title: string;
  author: string;
  categories: string[];
  tags?: string[];
  edition?: string | { name: string; publishedYear?: number };
  variantFamily: VariantFamily;
};

export type BookPackage = {
  schemaVersion: string;
  packageId: string;
  createdAt: string;
  contentOwner: string;
  book: PackageBook;
  chapters: PackageChapter[];
};

export type BookPackagePresentation = {
  icon: string;
  coverImage: string;
  difficulty: "Easy" | "Medium" | "Hard";
  synopsis: string;
  pages?: number;
};

export const FRIENDS_AND_INFLUENCE_PACKAGE =
  friendsAndInfluencePackageJson as BookPackage;
export const ART_OF_WAR_PACKAGE = artOfWarPackageJson as BookPackage;
export const THE_PRINCE_PACKAGE = thePrincePackageJson as BookPackage;
export const STRATEGIES_OF_WAR_PACKAGE =
  strategiesOfWarPackageJson as BookPackage;
export const INFLUENCE_PACKAGE = influencePackageJson as BookPackage;
export const LAWS_OF_HUMAN_NATURE_PACKAGE =
  lawsOfHumanNaturePackageJson as BookPackage;
export const PRE_SUASION_PACKAGE = preSuasionPackageJson as BookPackage;
export const NEVER_SPLIT_THE_DIFFERENCE_PACKAGE =
  neverSplitTheDifferencePackageJson as BookPackage;

export const BOOK_PACKAGES: BookPackage[] = [
  FRIENDS_AND_INFLUENCE_PACKAGE,
  ART_OF_WAR_PACKAGE,
  THE_PRINCE_PACKAGE,
  STRATEGIES_OF_WAR_PACKAGE,
  INFLUENCE_PACKAGE,
  LAWS_OF_HUMAN_NATURE_PACKAGE,
  PRE_SUASION_PACKAGE,
  NEVER_SPLIT_THE_DIFFERENCE_PACKAGE,
];

export const BOOK_PACKAGE_PRESENTATION: Record<string, BookPackagePresentation> = {
  "friends-and-influence-student-edition": {
    icon: "🤝",
    coverImage: "/book-covers/friends-and-influence-student-edition.svg",
    difficulty: "Medium",
    synopsis:
      "A classic communication guide focused on first impressions, attentive listening, better questions, respectful disagreement, and the habits that make relationships stronger over time.",
    pages: 304,
  },
  "art-of-war": {
    icon: "🐉",
    coverImage: "/book-covers/art-of-war.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of strategy, incentives, leadership, legitimacy, coalition management, and ethical tradeoffs for students and early career builders.",
    pages: 288,
  },
  "the-prince": {
    icon: "👑",
    coverImage: "/book-covers/the-prince.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of leadership, legitimacy, incentives, reputation, and ethical tradeoffs in governance for students and early career builders.",
    pages: 272,
  },
  "33-strategies-of-war": {
    icon: "🛡️",
    coverImage: "/book-covers/33-strategies-of-war.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of conflict, leverage, reputation, timing, coalition building, and strategic discipline for students and early career builders.",
    pages: 336,
  },
  influence: {
    icon: "🧠",
    coverImage: "/book-covers/influence.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of persuasion, reciprocity, consistency, social proof, authority, scarcity, and ethical influence for students and early career builders.",
    pages: 336,
  },
  "laws-of-human-nature": {
    icon: "🫀",
    coverImage: "/book-covers/laws-of-human-nature.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of self awareness, group dynamics, hidden motives, insecurity, ambition, and leadership for students and early career builders.",
    pages: 624,
  },
  "pre-suasion": {
    icon: "🎯",
    coverImage: "/book-covers/pre-suasion.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of attention, framing, timing, readiness, unity, and ethical persuasion for students and early career builders.",
    pages: 432,
  },
  "never-split-the-difference": {
    icon: "🗣️",
    coverImage: "/book-covers/never-split-the-difference.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of negotiation, tactical empathy, calibrated questions, commitment, and leverage for students and early career builders.",
    pages: 320,
  },
};

export function getBookPackageById(bookId: string): BookPackage | undefined {
  return BOOK_PACKAGES.find((pkg) => pkg.book.bookId === bookId);
}

export function getBookPackagePresentation(bookId: string): BookPackagePresentation {
  return (
    BOOK_PACKAGE_PRESENTATION[bookId] ?? {
      icon: "📘",
      coverImage: `/book-covers/${bookId}.svg`,
      difficulty: "Medium",
      synopsis:
        "A focused, chapter-based learning experience with examples, quizzes, and measurable progress.",
    }
  );
}
