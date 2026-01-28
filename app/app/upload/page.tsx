// app/app/upload/page.tsx
export default function AppUploadPage() {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Upload</h1>
          <p className="mt-2 text-sm text-slate-300">
            This will request a presigned URL and upload directly to S3.
          </p>
        </div>
  
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-slate-300">
            Upload form placeholder.
          </p>
        </div>
      </div>
    );
  }
  