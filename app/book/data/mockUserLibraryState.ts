import {
  type BookCatalogItem,
  type BookDifficulty,
  BOOKS_CATALOG,
} from "@/app/book/data/booksCatalog";
import { getBookChaptersBundle } from "@/app/book/data/mockChapters";

export type LibraryBookStatus = "in_progress" | "completed" | "not_started";

export type LibraryBookEntry = BookCatalogItem & {
  status: LibraryBookStatus;
  progressPercent: number;
  chaptersTotal: number;
  chaptersCompleted: number;
  isNew?: boolean;
  lastActivityAt: string;
};

const DEFAULT_LAST_ACTIVITY = "1970-01-01T00:00:00.000Z";

function initialChaptersTotal(book: BookCatalogItem): number {
  const bundleSize = getBookChaptersBundle(book.id).chapters.length;
  if (bundleSize > 0) return bundleSize;
  return Math.max(8, Math.round(book.estimatedMinutes / 18));
}

export function buildLibraryCatalog(): LibraryBookEntry[] {
  return BOOKS_CATALOG.map((book) => ({
    ...book,
    status: "not_started",
    progressPercent: 0,
    chaptersTotal: initialChaptersTotal(book),
    chaptersCompleted: 0,
    isNew: true,
    lastActivityAt: DEFAULT_LAST_ACTIVITY,
  }));
}

export function getLibraryBookById(bookId: string): LibraryBookEntry | undefined {
  return buildLibraryCatalog().find((entry) => entry.id === bookId);
}

export const LIBRARY_CATEGORY_OPTIONS = [
  "All",
  "Productivity",
  "Business",
  "Psychology",
  "History",
  "Philosophy",
  "Tech",
] as const;

export const LIBRARY_DIFFICULTY_OPTIONS = [
  "All",
  "Easy",
  "Medium",
  "Hard",
] as const;

export const LIBRARY_STATUS_OPTIONS = [
  "All",
  "In Progress",
  "Completed",
  "Not Started",
] as const;

export type LibraryCategoryFilter = (typeof LIBRARY_CATEGORY_OPTIONS)[number];
export type LibraryDifficultyFilter = (typeof LIBRARY_DIFFICULTY_OPTIONS)[number];
export type LibraryStatusFilter = (typeof LIBRARY_STATUS_OPTIONS)[number];

export type LibrarySortOption =
  | "most_recent"
  | "progress_desc"
  | "title_asc"
  | "difficulty";

export const LIBRARY_SORT_OPTIONS: Array<{
  value: LibrarySortOption;
  label: string;
}> = [
  { value: "most_recent", label: "Most recent" },
  { value: "progress_desc", label: "Progress (high → low)" },
  { value: "title_asc", label: "Title (A → Z)" },
  { value: "difficulty", label: "Difficulty" },
];

export function difficultyRank(value: BookDifficulty): number {
  if (value === "Easy") return 1;
  if (value === "Medium") return 2;
  return 3;
}
