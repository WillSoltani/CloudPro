"use client";

import { useEffect, useState } from "react";

export function ClientDate({ iso }: { iso: string }) {
  const [text, setText] = useState<string>("—");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(new Date(iso).toLocaleString());
    } catch {
      setText("—");
    }
  }, [iso]);
  return <span>{text}</span>;
}
