"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ASK_PROPOSALS, ASK_PROPOSAL_LABELS, type ResponseProposal } from "@/lib/asks";
import { validateAskOffer, ASK_OFFER_MAX } from "@/lib/ask-validate";

const ERROR_COPY: Record<string, string> = {
  offer_empty: "Write a short offer (a sentence or two).",
  offer_too_long: `Offer is too long (max ${ASK_OFFER_MAX} characters).`,
  already_responded: "You've already offered to help on this ask.",
  cannot_respond_own_ask: "You can't respond to your own ask.",
  students_cannot_help: "Students post asks; they don't offer help.",
  ask_not_open: "This ask is no longer accepting offers.",
  rate_limited: "You've offered on a lot of asks recently. Try again later.",
  not_claimed: "Claim your profile before offering to help.",
};

// "Offer to help" form shown on an ask-detail page to a logged-in helper who
// hasn't yet responded. POSTs to /api/asks/[id]/respond then refreshes.
export function OfferHelpForm({ askId }: { askId: string }) {
  const router = useRouter();
  const [offer, setOffer] = useState("");
  const [proposes, setProposes] = useState<ResponseProposal>("async_advice");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offerCheck = validateAskOffer(offer);
  const offerErr = !offerCheck.ok && offer.trim() ? ERROR_COPY[offerCheck.error] : null;
  const canSave = offerCheck.ok && !saving;

  async function onSubmit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/asks/${askId}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          offer: offerCheck.ok ? offerCheck.value : offer,
          proposes,
        }),
      });
      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(ERROR_COPY[data.error ?? ""] ?? "Couldn't send your offer. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg font-semibold">Offer to help</h3>
        <p className="text-xs text-zinc-500">
          Two sentences is plenty — how you can help and what you&apos;d suggest.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <textarea
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          maxLength={ASK_OFFER_MAX + 50}
          rows={3}
          placeholder="I led EdTech investments at my fund and angel-invest in early tutoring startups. Happy to give 20 minutes of feedback on your wedge and intros."
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
        />
        {offerErr && <p className="text-xs text-red-400">{offerErr}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="offer-proposes" className="text-sm font-medium text-zinc-200">
          What are you proposing?
        </label>
        <select
          id="offer-proposes"
          value={proposes}
          onChange={(e) => setProposes(e.target.value as ResponseProposal)}
          className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
        >
          {ASK_PROPOSALS.map((p) => (
            <option key={p} value={p}>
              {ASK_PROPOSAL_LABELS[p]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSave}
          className="bg-zinc-100 text-zinc-950 hover:bg-white disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          {saving ? "Sending…" : "Send offer"}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
