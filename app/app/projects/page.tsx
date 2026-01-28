// app/app/projects/page.tsx
import Link from "next/link";

export default function AppProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="mt-2 text-sm text-slate-300">
            Create a project and upload files to it.
          </p>
        </div>

        <button className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/15">
          New Project
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm text-slate-300">No projects yet.</p>
        <div className="mt-4">
          <Link href="/app/upload" className="text-sm text-sky-300 hover:text-sky-200">
            Upload a file →
          </Link>
        </div>
      </div>
    </div>
  );
}
