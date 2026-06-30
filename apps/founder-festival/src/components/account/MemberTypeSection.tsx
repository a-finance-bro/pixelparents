"use client";

import { useState } from "react";
import {
  MEMBER_TYPES,
  MEMBER_TYPE_LABELS,
  type MemberType,
} from "@/lib/member-type";

// Account section (connect-mode only) where a claimed member picks how they
// relate to OHS. Drives the asks connector: students seek help, everyone else
// can also offer it. Saves via POST /api/account/member-type.
export function MemberTypeSection({ initial }: { initial: MemberType }) {
  const [memberType, setMemberType] = useState<MemberType>(initial);
  // Saved baseline — bumped on a successful save so the dirty check resets
  // without a page reload (mirrors ProfileSettingsSection's approach).
  const [baseline, setBaseline] = useState<MemberType>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = memberType !== baseline;

  async function onSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch("/api/account/member-type", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberType }),
      });
      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError("Couldn't save. Try again.");
        return;
      }
      setSavedAt(Date.now());
      // Re-baseline so the dirty check resets.
      setBaseline(memberType);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        value={memberType}
        onChange={(e) => setMemberType(e.target.value as MemberType)}
        className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 max-w-xs"
      >
        {MEMBER_TYPES.map((t) => (
          <option key={t} value={t}>
            {MEMBER_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="bg-zinc-100 text-zinc-950 hover:bg-white disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {savedAt && !dirty && <span className="text-xs text-emerald-400">Saved.</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
