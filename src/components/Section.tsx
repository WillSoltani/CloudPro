import type { ReactNode } from "react";

type Props = {
  id?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function Section({ id, title, subtitle, children }: Props) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm text-slate-300">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
