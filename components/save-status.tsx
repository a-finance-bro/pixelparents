"use client";

import type { SaveStatus as Status } from "@/lib/use-auto-save";

// Small inline auto-save indicator. Renders nothing until the first save.
export function SaveStatus({ status }: { status: Status }) {
  if (status === "idle") return null;
  const map = {
    saving: { text: "Saving…", cls: "text-white/40" },
    saved: { text: "✓ Saved", cls: "text-emerald-400/80" },
    error: { text: "Couldn’t save — will retry", cls: "text-red-400" },
  } as const;
  const { text, cls } = map[status];
  return <span className={`text-xs ${cls}`} aria-live="polite">{text}</span>;
}
