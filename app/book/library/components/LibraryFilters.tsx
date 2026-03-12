"use client";

import type {
  LibraryCategoryFilter,
  LibraryDifficultyFilter,
  LibraryStatusFilter,
} from "@/app/book/data/mockUserLibraryState";

type FilterChipProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

function FilterChip({ label, selected, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-3.5 py-1.5 text-sm transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45",
        selected
          ? "border-sky-300/55 bg-sky-400/20 text-sky-100"
          : "border-white/35 bg-white/[0.02] text-slate-300 hover:border-white/50 hover:text-slate-100",
      ].join(" ")}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

type FilterGroupProps<T extends string> = {
  label: string;
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
};

function FilterGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: FilterGroupProps<T>) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <p className="min-w-24 text-sm font-medium text-slate-300">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <FilterChip
            key={option}
            label={option}
            selected={selected === option}
            onClick={() => onSelect(option)}
          />
        ))}
      </div>
    </div>
  );
}

type LibraryFiltersProps = {
  category: LibraryCategoryFilter;
  difficulty: LibraryDifficultyFilter;
  status: LibraryStatusFilter;
  categoryOptions: readonly LibraryCategoryFilter[];
  difficultyOptions: readonly LibraryDifficultyFilter[];
  statusOptions: readonly LibraryStatusFilter[];
  onCategoryChange: (value: LibraryCategoryFilter) => void;
  onDifficultyChange: (value: LibraryDifficultyFilter) => void;
  onStatusChange: (value: LibraryStatusFilter) => void;
  showClearFilters: boolean;
  onClearFilters: () => void;
};

export function LibraryFilters({
  category,
  difficulty,
  status,
  categoryOptions,
  difficultyOptions,
  statusOptions,
  onCategoryChange,
  onDifficultyChange,
  onStatusChange,
  showClearFilters,
  onClearFilters,
}: LibraryFiltersProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-4 sm:p-5">
      <div className="space-y-4">
        <FilterGroup
          label="Category"
          options={categoryOptions}
          selected={category}
          onSelect={onCategoryChange}
        />

        <FilterGroup
          label="Difficulty"
          options={difficultyOptions}
          selected={difficulty}
          onSelect={onDifficultyChange}
        />

        <FilterGroup
          label="Status"
          options={statusOptions}
          selected={status}
          onSelect={onStatusChange}
        />
      </div>

      {showClearFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-4 text-sm text-sky-200 transition hover:text-sky-100"
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

