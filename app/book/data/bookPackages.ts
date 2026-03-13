import friendsAndInfluencePackageJson from "@/book-packages/friends-and-influence-student-edition.student.json";

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

export const BOOK_PACKAGES: BookPackage[] = [FRIENDS_AND_INFLUENCE_PACKAGE];

export const BOOK_PACKAGE_PRESENTATION: Record<string, BookPackagePresentation> = {
  "friends-and-influence-student-edition": {
    icon: "🤝",
    coverImage: "/book-covers/friends-and-influence-student-edition.svg",
    difficulty: "Medium",
    synopsis:
      "A classic communication guide focused on first impressions, attentive listening, better questions, respectful disagreement, and the habits that make relationships stronger over time.",
    pages: 304,
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
