// app/app/projects/[projectId]/page.tsx
export default async function AppProjectDetailPage({
    params,
  }: {
    params: Promise<{ projectId: string }>;
  }) {
    const { projectId } = await params;
  
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Project</h1>
          <p className="mt-2 text-sm text-slate-300">ID: {projectId}</p>
        </div>
  
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-300">Files list will go here.</p>
        </div>
      </div>
    );
  }
  