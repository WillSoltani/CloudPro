"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Image as ImageIcon } from "lucide-react";

function isImageLike(file: File) {
  const ct = (file.type || "").toLowerCase();
  return ct.startsWith("image/");
}

export function Thumb({ file }: { file: File }) {
  const url = useMemo(() => {
    if (!isImageLike(file)) return "";
    const u = URL.createObjectURL(file);
    return u;
  }, [file]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const icon = useMemo(() => {
    return isImageLike(file) ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />;
  }, [file]);

  if (!isImageLike(file) || !url) {
    return (
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200">
        {icon}
      </div>
    );
  }

  return (
    <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
    </div>
  );
}
