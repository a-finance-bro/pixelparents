"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// Debounced auto-save. `save` receives the merged pending patch. Call
// `queue(patch)` on every field change (text debounces ~600ms); pass
// `immediate` for selects/checkboxes to flush right away. Last-write-wins; on
// error the status flips to "error" and the next queue() retries (the merged
// patch is preserved until a save succeeds).
export function useAutoSave<P extends Record<string, unknown>>(
  save: (patch: P) => Promise<void>,
  delay = 600,
) {
  const pending = useRef<Partial<P>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;
    pending.current = {};
    setStatus("saving");
    try {
      await saveRef.current(patch as P);
      // Only show "saved" if nothing new queued while we were saving.
      setStatus((s) => (s === "saving" ? "saved" : s));
    } catch {
      // Re-merge so the failed patch retries on the next change/flush.
      pending.current = { ...patch, ...pending.current };
      setStatus("error");
    }
  }, []);

  const queue = useCallback(
    (patch: Partial<P>, immediate = false) => {
      pending.current = { ...pending.current, ...patch };
      setStatus("saving");
      if (timer.current) clearTimeout(timer.current);
      if (immediate) void flush();
      else timer.current = setTimeout(() => void flush(), delay);
    },
    [flush, delay],
  );

  // Flush any pending edit before the tab is hidden/closed.
  useEffect(() => {
    const onHide = () => {
      if (Object.keys(pending.current).length) void flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  return { queue, flush, status };
}
