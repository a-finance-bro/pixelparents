"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Accept / Decline buttons shown to the ASKER on each still-"offered" response.
// POSTs the decision to the decide route then refreshes the page.
export function ResponseDecisionButtons({
  askId,
  responseId,
}: {
  askId: string;
  responseId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "accept" | "decline") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/asks/${askId}/responses/${responseId}/decide`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError("Couldn't save. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => decide("accept")}
        disabled={busy}
        className="rounded border border-emerald-600 bg-emerald-600/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-600/25 disabled:opacity-50"
      >
        Accept
      </button>
      <button
        type="button"
        onClick={() => decide("decline")}
        disabled={busy}
        className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
      >
        Decline
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
