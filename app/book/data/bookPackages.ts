import friendsAndInfluencePackageJson from "@/book-packages/friends-and-influence-student-edition.student.json";
import artOfWarPackageJson from "@/book-packages/art-of-war.modern.json";
import thePrincePackageJson from "@/book-packages/the-prince.modern.json";
import strategiesOfWarPackageJson from "@/book-packages/33-strategies-of-war.modern.json";
import influencePackageJson from "@/book-packages/influence.modern.json";
import lawsOfHumanNaturePackageJson from "@/book-packages/laws-of-human-nature.modern.json";
import preSuasionPackageJson from "@/book-packages/pre-suasion.modern.json";
import neverSplitTheDifferencePackageJson from "@/book-packages/never-split-the-difference.modern.json";
import gamesPeoplePlayPackageJson from "@/book-packages/games-people-play.modern.json";
import crucialConversationsPackageJson from "@/book-packages/crucial-conversations.modern.json";
import difficultConversationsPackageJson from "@/book-packages/difficult-conversations.modern.json";
import charismaMythPackageJson from "@/book-packages/the-charisma-myth.modern.json";
import whatEveryBodyIsSayingPackageJson from "@/book-packages/what-every-body-is-saying.modern.json";
import powerOfHabitPackageJson from "@/book-packages/the-power-of-habit.modern.json";
import tinyHabitsPackageJson from "@/book-packages/tiny-habits.modern.json";
import essentialismPackageJson from "@/book-packages/essentialism.modern.json";
import deepWorkPackageJson from "@/book-packages/deep-work.modern.json";
import makeTimePackageJson from "@/book-packages/make-time.modern.json";
import psychologyOfMoneyPackageJson from "@/book-packages/the-psychology-of-money.modern.json";
import thinkingFastAndSlowPackageJson from "@/book-packages/thinking-fast-and-slow.modern.json";
import predictablyIrrationalPackageJson from "@/book-packages/predictably-irrational.modern.json";
import almanackOfNavalRavikantPackageJson from "@/book-packages/the-almanack-of-naval-ravikant.modern.json";
import extremeOwnershipPackageJson from "@/book-packages/extreme-ownership.modern.json";
import hardThingAboutHardThingsPackageJson from "@/book-packages/the-hard-thing-about-hard-things.modern.json";
import goodToGreatPackageJson from "@/book-packages/good-to-great.modern.json";
import lawsOfPowerPackageJson from "@/book-packages/the-48-laws-of-power.modern.json";
import atomicHabitsPackageJson from "@/book-packages/atomic-habits.modern.json";
import oneThingPackageJson from "@/book-packages/the-one-thing.modern.json";

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
export const GAMES_PEOPLE_PLAY_PACKAGE =
  gamesPeoplePlayPackageJson as BookPackage;
export const CRUCIAL_CONVERSATIONS_PACKAGE =
  crucialConversationsPackageJson as BookPackage;
export const DIFFICULT_CONVERSATIONS_PACKAGE =
  difficultConversationsPackageJson as BookPackage;
export const CHARISMA_MYTH_PACKAGE = charismaMythPackageJson as BookPackage;
export const WHAT_EVERY_BODY_IS_SAYING_PACKAGE =
  whatEveryBodyIsSayingPackageJson as BookPackage;
export const POWER_OF_HABIT_PACKAGE = powerOfHabitPackageJson as BookPackage;
export const TINY_HABITS_PACKAGE = tinyHabitsPackageJson as BookPackage;
export const ESSENTIALISM_PACKAGE = essentialismPackageJson as BookPackage;
export const DEEP_WORK_PACKAGE = deepWorkPackageJson as BookPackage;
export const MAKE_TIME_PACKAGE = makeTimePackageJson as BookPackage;
export const PSYCHOLOGY_OF_MONEY_PACKAGE =
  psychologyOfMoneyPackageJson as BookPackage;
export const THINKING_FAST_AND_SLOW_PACKAGE =
  thinkingFastAndSlowPackageJson as BookPackage;
export const PREDICTABLY_IRRATIONAL_PACKAGE =
  predictablyIrrationalPackageJson as BookPackage;
export const ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE =
  almanackOfNavalRavikantPackageJson as BookPackage;
export const EXTREME_OWNERSHIP_PACKAGE =
  extremeOwnershipPackageJson as BookPackage;
export const HARD_THING_ABOUT_HARD_THINGS_PACKAGE =
  hardThingAboutHardThingsPackageJson as BookPackage;
export const GOOD_TO_GREAT_PACKAGE = goodToGreatPackageJson as BookPackage;
export const LAWS_OF_POWER_PACKAGE = lawsOfPowerPackageJson as BookPackage;
export const ATOMIC_HABITS_PACKAGE = atomicHabitsPackageJson as BookPackage;
export const ONE_THING_PACKAGE = oneThingPackageJson as BookPackage;

export const BOOK_PACKAGES: BookPackage[] = [
  FRIENDS_AND_INFLUENCE_PACKAGE,
  ART_OF_WAR_PACKAGE,
  THE_PRINCE_PACKAGE,
  STRATEGIES_OF_WAR_PACKAGE,
  INFLUENCE_PACKAGE,
  LAWS_OF_HUMAN_NATURE_PACKAGE,
  PRE_SUASION_PACKAGE,
  NEVER_SPLIT_THE_DIFFERENCE_PACKAGE,
  GAMES_PEOPLE_PLAY_PACKAGE,
  CRUCIAL_CONVERSATIONS_PACKAGE,
  DIFFICULT_CONVERSATIONS_PACKAGE,
  CHARISMA_MYTH_PACKAGE,
  WHAT_EVERY_BODY_IS_SAYING_PACKAGE,
  POWER_OF_HABIT_PACKAGE,
  TINY_HABITS_PACKAGE,
  ESSENTIALISM_PACKAGE,
  DEEP_WORK_PACKAGE,
  MAKE_TIME_PACKAGE,
  PSYCHOLOGY_OF_MONEY_PACKAGE,
  THINKING_FAST_AND_SLOW_PACKAGE,
  PREDICTABLY_IRRATIONAL_PACKAGE,
  ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE,
  EXTREME_OWNERSHIP_PACKAGE,
  HARD_THING_ABOUT_HARD_THINGS_PACKAGE,
  GOOD_TO_GREAT_PACKAGE,
  LAWS_OF_POWER_PACKAGE,
  ATOMIC_HABITS_PACKAGE,
  ONE_THING_PACKAGE,
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
  "games-people-play": {
    icon: "♟️",
    coverImage: "/book-covers/games-people-play.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of transactional analysis, repeated social scripts, hidden payoffs, and autonomy for students and early career builders.",
    pages: 272,
  },
  "crucial-conversations": {
    icon: "💬",
    coverImage: "/book-covers/crucial-conversations.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of dialogue, shared meaning, safety, accountability, and high stakes communication for students and early career builders.",
    pages: 336,
  },
  "difficult-conversations": {
    icon: "🧩",
    coverImage: "/book-covers/difficult-conversations.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of hard conversations, contribution, feelings, identity, and learning under pressure for students and early career builders.",
    pages: 400,
  },
  "the-charisma-myth": {
    icon: "✨",
    coverImage: "/book-covers/the-charisma-myth.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of presence, power, warmth, composure, social perception, and ethical influence for students and early career builders.",
    pages: 320,
  },
  "what-every-body-is-saying": {
    icon: "👁️",
    coverImage: "/book-covers/what-every-body-is-saying.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of body language, nonverbal signals, observation, baseline, context, and ethical interpretation for students and early career builders.",
    pages: 304,
  },
  "the-power-of-habit": {
    icon: "🔁",
    coverImage: "/book-covers/the-power-of-habit.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of cue, routine, reward, craving, willpower, keystone habits, and behavioral design for students and early career builders.",
    pages: 384,
  },
  "tiny-habits": {
    icon: "🌱",
    coverImage: "/book-covers/tiny-habits.svg",
    difficulty: "Easy",
    synopsis:
      "A modern reading of behavior design, prompts, tiny actions, celebration, scaling, and compassionate habit change for students and early career builders.",
    pages: 320,
  },
  essentialism: {
    icon: "🎯",
    coverImage: "/book-covers/essentialism.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of focus, priorities, tradeoffs, boundaries, editing, and disciplined selection for students and early career builders.",
    pages: 272,
  },
  "deep-work": {
    icon: "🌊",
    coverImage: "/book-covers/deep-work.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of concentration, cognitive depth, digital discipline, shallow work reduction, and focused value creation for students and early career builders.",
    pages: 304,
  },
  "make-time": {
    icon: "⏳",
    coverImage: "/book-covers/make-time.svg",
    difficulty: "Easy",
    synopsis:
      "A modern reading of daily highlights, distraction defense, energy design, reflection, and practical attention management for students and early career builders.",
    pages: 304,
  },
  "the-psychology-of-money": {
    icon: "💸",
    coverImage: "/book-covers/the-psychology-of-money.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of money behavior, risk, patience, enough, visible status, and financial resilience for students and early career builders.",
    pages: 256,
  },
  "thinking-fast-and-slow": {
    icon: "🧠",
    coverImage: "/book-covers/thinking-fast-and-slow.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of judgment, bias, intuition, framing, risk, prediction, and the limits of confidence for students and early career builders.",
    pages: 512,
  },
  "predictably-irrational": {
    icon: "🎲",
    coverImage: "/book-covers/predictably-irrational.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of behavioral economics, anchoring, pricing, self control, honesty, social norms, and choice design for students and early career builders.",
    pages: 384,
  },
  "the-almanack-of-naval-ravikant": {
    icon: "📘",
    coverImage: "/book-covers/the-almanack-of-naval-ravikant.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of wealth, leverage, judgment, happiness, freedom, and practical philosophy for students and early career builders.",
    pages: 242,
  },
  "extreme-ownership": {
    icon: "🪖",
    coverImage: "/book-covers/extreme-ownership.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of accountability, leadership, team clarity, execution, discipline, and calm decision making under pressure for students and early career builders.",
    pages: 320,
  },
  "the-hard-thing-about-hard-things": {
    icon: "🧱",
    coverImage: "/book-covers/the-hard-thing-about-hard-things.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of startup leadership, crisis management, truth telling, painful decisions, and management under pressure for students and early career builders.",
    pages: 304,
  },
  "good-to-great": {
    icon: "📈",
    coverImage: "/book-covers/good-to-great.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of disciplined leadership, people choices, brutal facts, strategic focus, and momentum building for students and early career builders.",
    pages: 320,
  },
  "the-48-laws-of-power": {
    icon: "♜",
    coverImage: "/book-covers/the-48-laws-of-power.svg",
    difficulty: "Hard",
    synopsis:
      "A modern reading of power, timing, reputation, influence, and strategic awareness for students and early career builders.",
    pages: 480,
  },
  "atomic-habits": {
    icon: "⚛️",
    coverImage: "/book-covers/atomic-habits.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of habit loops, identity based change, environment design, and compounding improvement for students and early career builders.",
    pages: 320,
  },
  "the-one-thing": {
    icon: "🎯",
    coverImage: "/book-covers/the-one-thing.svg",
    difficulty: "Medium",
    synopsis:
      "A modern reading of focus, leverage, time blocking, tradeoffs, and extraordinary results through strategic simplicity for students and early career builders.",
    pages: 240,
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
