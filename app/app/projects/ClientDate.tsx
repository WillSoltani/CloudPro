"use client";

import { useEffect, useState } from "react";

type Props = {
  iso: string;
};

export function ClientDate({ iso }: Props) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    const d = new Date(iso);
    // Use browser locale consistently (client-only)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(d.toLocaleString());
  }, [iso]);

  // Render stable placeholder on the server to avoid mismatch.
  // After mount, it updates to the client locale string.
  return <>{text || "—"}</>;
}
