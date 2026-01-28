// app/app/page.tsx
export default function AppDashboardPage() {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            Recent artifacts will show here (last 20).
          </p>
        </div>
  
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-300">No data yet.</p>
        </div>
      </div>
    );
  }
  