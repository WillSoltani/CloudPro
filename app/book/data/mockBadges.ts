export type BadgeCategory = "Streak" | "Quiz" | "Books" | "Milestone";

export type BadgeDefinition = {
  id: string;
  name: string;
  description: string;
  howToEarn: string;
  icon: string;
  category: BadgeCategory;
};

export type BadgeProgressStats = {
  totalCompletedChapters: number;
  completedBooks: number;
  streakDays: number;
  avgQuizScore: number;
  maxQuizScore: number;
  longestStreak: number;
};

export type BadgeState = BadgeDefinition & {
  earned: boolean;
  earnedAt: string | null;
};

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "first-chapter",
    name: "First Chapter",
    description: "Completed your first chapter with a passing quiz.",
    howToEarn: "Complete one chapter and pass the quiz.",
    icon: "📘",
    category: "Milestone",
  },
  {
    id: "week-streak",
    name: "7-Day Streak",
    description: "Stayed consistent for a full week.",
    howToEarn: "Reach a 7-day reading streak.",
    icon: "🔥",
    category: "Streak",
  },
  {
    id: "first-book",
    name: "First Book",
    description: "Finished your first complete book.",
    howToEarn: "Complete every chapter in one book.",
    icon: "🏁",
    category: "Books",
  },
  {
    id: "quiz-master",
    name: "Quiz Master",
    description: "Proved strong retention with top quiz accuracy.",
    howToEarn: "Maintain at least 90% average quiz score.",
    icon: "💯",
    category: "Quiz",
  },
  {
    id: "deep-runner",
    name: "Deep Runner",
    description: "Built long-term momentum through consistency.",
    howToEarn: "Reach a 21-day streak.",
    icon: "🏃",
    category: "Streak",
  },
  {
    id: "library-climber",
    name: "Library Climber",
    description: "Built serious progress across multiple books.",
    howToEarn: "Finish 3 books.",
    icon: "🧗",
    category: "Books",
  },
  {
    id: "chapter-hundred",
    name: "Century Chapter",
    description: "Crossed a major chapter completion milestone.",
    howToEarn: "Complete 25 chapters.",
    icon: "🎯",
    category: "Milestone",
  },
  {
    id: "perfect-pass",
    name: "Perfect Pass",
    description: "Scored at least one perfect quiz.",
    howToEarn: "Get 100% on any chapter quiz.",
    icon: "✨",
    category: "Quiz",
  },
];

function isEarned(definition: BadgeDefinition, stats: BadgeProgressStats): boolean {
  switch (definition.id) {
    case "first-chapter":
      return stats.totalCompletedChapters >= 1;
    case "week-streak":
      return stats.streakDays >= 7;
    case "first-book":
      return stats.completedBooks >= 1;
    case "quiz-master":
      return stats.avgQuizScore >= 90;
    case "deep-runner":
      return stats.longestStreak >= 21;
    case "library-climber":
      return stats.completedBooks >= 3;
    case "chapter-hundred":
      return stats.totalCompletedChapters >= 25;
    case "perfect-pass":
      return stats.maxQuizScore >= 100;
    default:
      return false;
  }
}

export function evaluateBadges(stats: BadgeProgressStats): BadgeState[] {
  return BADGE_DEFINITIONS.map((definition) => {
    const earned = isEarned(definition, stats);
    return {
      ...definition,
      earned,
      earnedAt: null,
    };
  });
}
