import { serializeMention } from "@/lib/mentions";

// Pure helpers for the GUIDED "Connect with <person>" composer state. Kept out of
// the React component so the pre-scope + topic-selection logic is unit-testable
// without rendering. The composer is just the normal Ask post form pre-filled to
// be explicitly about connecting with ONE specific member: the target is auto
// @-mentioned (so createAskAction notifies them via the existing community_mention
// path) and their own topics become click-to-select chips that shape the message.

export type ConnectTarget = {
  signupId: string;
  name: string;
  topics: string[];
};

// The inline mention marker (@[Name](id)) that references the target. Placed in
// the BODY so processMentions() in createAskAction resolves + notifies them — the
// exact same path a hand-typed @-mention uses, so no new notification model.
export function connectMentionMarker(target: ConnectTarget): string {
  return serializeMention(target.name, target.signupId);
}

// Pre-filled TITLE for a fresh connection post. Short + editable.
export function connectInitialTitle(target: ConnectTarget): string {
  return `Connect with ${target.name}`;
}

// Pre-filled, editable BODY for the connection post, given the topics the user
// has selected (tapped). Always leads with the target's @-mention so they're
// referenced + notified; appends the chosen topics as readable context. Minimal
// typing: this is a complete, sendable message on its own.
export function connectComposeBody(target: ConnectTarget, selectedTopics: string[]): string {
  const marker = connectMentionMarker(target);
  const topics = selectedTopics.map((t) => t.trim()).filter(Boolean);
  if (topics.length === 0) {
    return `Hi ${marker} — I'd love to connect.`;
  }
  return `Hi ${marker} — I'd love to connect about ${joinTopics(topics)}.`;
}

// Human-readable list join: "a", "a and b", "a, b, and c".
export function joinTopics(topics: string[]): string {
  const t = topics.filter(Boolean);
  if (t.length === 0) return "";
  if (t.length === 1) return t[0]!;
  if (t.length === 2) return `${t[0]} and ${t[1]}`;
  return `${t.slice(0, -1).join(", ")}, and ${t[t.length - 1]}`;
}

// Toggle a topic in/out of the selected set, preserving the original topic order
// (so re-selecting doesn't reshuffle the chips). Case-insensitive de-dupe.
export function toggleTopic(
  allTopics: string[],
  selected: string[],
  topic: string,
): string[] {
  const key = topic.toLowerCase();
  if (selected.some((s) => s.toLowerCase() === key)) {
    return selected.filter((s) => s.toLowerCase() !== key);
  }
  // Re-derive from allTopics order so selection order is stable + deterministic.
  const nextKeys = new Set([...selected.map((s) => s.toLowerCase()), key]);
  return allTopics.filter((t) => nextKeys.has(t.toLowerCase()));
}
