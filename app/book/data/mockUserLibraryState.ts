import {
  type BookCatalogItem,
  type BookDifficulty,
  BOOKS_CATALOG,
} from "@/app/book/data/booksCatalog";

export type LibraryBookStatus = "in_progress" | "completed" | "not_started";

export type LibraryBookEntry = BookCatalogItem & {
  status: LibraryBookStatus;
  progressPercent: number;
  chaptersTotal: number;
  chaptersCompleted: number;
  isNew?: boolean;
  lastActivityAt: string;
};

type LibrarySeed = {
  status: LibraryBookStatus;
  progressPercent: number;
  chaptersTotal: number;
  chaptersCompleted: number;
  isNew?: boolean;
  lastActivityAt: string;
  categoryOverride?: string;
};

const SEED_BY_BOOK_ID: Record<string, LibrarySeed> = {
  "deep-work": {
    status: "in_progress",
    progressPercent: 62,
    chaptersTotal: 18,
    chaptersCompleted: 7,
    lastActivityAt: "2026-03-12T09:45:00.000Z",
  },
  "atomic-habits": {
    status: "in_progress",
    progressPercent: 28,
    chaptersTotal: 16,
    chaptersCompleted: 4,
    lastActivityAt: "2026-03-11T18:20:00.000Z",
  },
  "zero-to-one": {
    status: "completed",
    progressPercent: 100,
    chaptersTotal: 14,
    chaptersCompleted: 14,
    lastActivityAt: "2026-03-10T11:00:00.000Z",
  },
  "lean-startup": {
    status: "not_started",
    progressPercent: 0,
    chaptersTotal: 15,
    chaptersCompleted: 0,
    isNew: true,
    lastActivityAt: "2026-02-27T10:10:00.000Z",
  },
  "power-of-habit": {
    status: "completed",
    progressPercent: 100,
    chaptersTotal: 13,
    chaptersCompleted: 13,
    lastActivityAt: "2026-03-01T16:20:00.000Z",
  },
  "thinking-fast-slow": {
    status: "not_started",
    progressPercent: 0,
    chaptersTotal: 20,
    chaptersCompleted: 0,
    isNew: true,
    lastActivityAt: "2026-03-09T15:00:00.000Z",
  },
  "how-to-win-friends": {
    status: "in_progress",
    progressPercent: 45,
    chaptersTotal: 12,
    chaptersCompleted: 5,
    lastActivityAt: "2026-03-08T17:05:00.000Z",
  },
  "leaders-eat-last": {
    status: "not_started",
    progressPercent: 0,
    chaptersTotal: 14,
    chaptersCompleted: 0,
    lastActivityAt: "2026-02-24T14:00:00.000Z",
  },
  "psychology-of-money": {
    status: "in_progress",
    progressPercent: 73,
    chaptersTotal: 19,
    chaptersCompleted: 13,
    lastActivityAt: "2026-03-06T08:35:00.000Z",
  },
  "why-we-sleep": {
    status: "not_started",
    progressPercent: 0,
    chaptersTotal: 17,
    chaptersCompleted: 0,
    lastActivityAt: "2026-02-21T09:00:00.000Z",
  },
  meditations: {
    status: "completed",
    progressPercent: 100,
    chaptersTotal: 12,
    chaptersCompleted: 12,
    lastActivityAt: "2026-02-18T07:30:00.000Z",
  },
  "art-of-war": {
    status: "in_progress",
    progressPercent: 33,
    chaptersTotal: 13,
    chaptersCompleted: 4,
    categoryOverride: "History",
    lastActivityAt: "2026-03-04T20:15:00.000Z",
  },
  "so-good": {
    status: "not_started",
    progressPercent: 0,
    chaptersTotal: 14,
    chaptersCompleted: 0,
    lastActivityAt: "2026-02-19T19:00:00.000Z",
  },
  "steal-like-an-artist": {
    status: "completed",
    progressPercent: 100,
    chaptersTotal: 10,
    chaptersCompleted: 10,
    lastActivityAt: "2026-02-28T13:05:00.000Z",
  },
  "pragmatic-programmer": {
    status: "in_progress",
    progressPercent: 18,
    chaptersTotal: 22,
    chaptersCompleted: 4,
    lastActivityAt: "2026-03-02T21:25:00.000Z",
  },
};

function defaultSeed(book: BookCatalogItem): LibrarySeed {
  return {
    status: "not_started",
    progressPercent: 0,
    chaptersTotal: Math.max(10, Math.round(book.estimatedMinutes / 18)),
    chaptersCompleted: 0,
    lastActivityAt: "2026-01-01T00:00:00.000Z",
  };
}

export function buildLibraryCatalog(): LibraryBookEntry[] {
  return BOOKS_CATALOG.map((book) => {
    const seed = SEED_BY_BOOK_ID[book.id] ?? defaultSeed(book);
    return {
      ...book,
      category: seed.categoryOverride ?? book.category,
      status: seed.status,
      progressPercent: seed.progressPercent,
      chaptersTotal: seed.chaptersTotal,
      chaptersCompleted: seed.chaptersCompleted,
      isNew: seed.isNew,
      lastActivityAt: seed.lastActivityAt,
    };
  });
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
