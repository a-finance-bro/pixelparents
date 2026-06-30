// Info extraction — ONE Claude pass over the `ok` enrichment facts to produce a
// DE-SCORED info profile: identity, a short neutral bio, expertise/topic tags, and
// an "areas of expertise / how they can help" list. NO numbers, NO scores.
//
// Talks to Claude via the Vercel AI Gateway (OpenAI-compatible chat completions),
// mirroring the existing scripts/build-changelog.mjs pattern — the main app has no
// `ai` SDK installed, so we use a plain fetch with the VERCEL_AI_GATEWAY key. Falls
// back to a direct Anthropic call when only ANTHROPIC_API_KEY is set.

import { z } from "zod";
import type { EnrichmentRun } from "./index";
import type { EnrichmentSubject } from "./types";

// Read env LAZILY (inside functions), not at module load — a proof script /
// serverless cold start may populate process.env (e.g. via dotenv) AFTER this
// module is imported. Gateway uses "provider/model"; direct Anthropic uses the
// bare model id.
const gwKey = () => process.env.VERCEL_AI_GATEWAY || process.env.AI_GATEWAY_API_KEY;
const antKey = () => process.env.ANTHROPIC_API_KEY;
const gwModel = () => process.env.ENRICHMENT_MODEL || "anthropic/claude-haiku-4-5";
const antModel = () => process.env.ENRICHMENT_MODEL || "claude-haiku-4-5-20251001";

// The de-scored info profile. Every field is informational; there are no points.
export const InfoProfileSchema = z.object({
  identity: z.object({
    name: z.string().nullable(),
    headline: z.string().nullable(),
    currentRole: z.string().nullable(),
    currentCompany: z.string().nullable(),
    location: z.string().nullable(),
    education: z.array(z.string()).default([]),
  }),
  bio: z.string(),
  expertiseTags: z.array(z.string()).default([]),
  canHelpWith: z.array(z.string()).default([]),
});
export type InfoProfile = z.infer<typeof InfoProfileSchema>;

// An empty profile used when there are no facts / no model key. Keeps the
// pipeline non-throwing so the status roster is still returned.
export function emptyInfoProfile(subject: EnrichmentSubject): InfoProfile {
  return {
    identity: {
      name: subject.name ?? null,
      headline: null,
      currentRole: null,
      currentCompany: null,
      location: null,
      education: [],
    },
    bio: "",
    expertiseTags: [],
    canHelpWith: [],
  };
}

function buildPrompt(subject: EnrichmentSubject, run: EnrichmentRun): string {
  const factBlock = run.factsBySource
    .map((g) => `[${g.source}]\n${g.facts.map((f) => `  ${f}`).join("\n")}`)
    .join("\n\n");
  return `You are summarizing PUBLIC information about a person for a school-community member directory. Below are verified facts gathered from public third-party sources. Produce a NEUTRAL, INFORMATIONAL profile — do NOT rate, rank, or score the person in any way, and do NOT invent anything not supported by the facts.

Subject name (as provided): ${subject.name ?? "(unknown)"}

VERIFIED PUBLIC FACTS:
${factBlock || "(no facts were gathered)"}

Return ONLY a single JSON object (no prose, no markdown fences) matching this TypeScript shape:
{
  "identity": {
    "name": string | null,
    "headline": string | null,        // a one-line professional headline
    "currentRole": string | null,     // e.g. "Engineering Lead"
    "currentCompany": string | null,
    "location": string | null,
    "education": string[]             // schools/degrees mentioned
  },
  "bio": string,                       // 1-3 NEUTRAL sentences, no superlatives, no scoring
  "expertiseTags": string[],           // short topic tags, e.g. ["Rust", "open source", "ML"]
  "canHelpWith": string[]              // concrete "areas of expertise / how they can help others" bullets
}

Rules: Use null / empty arrays when the facts don't support a field. NO numbers-as-judgments, NO "top", "best", "impressive". Keep it factual and brief.`;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("No JSON object in model response");
  return JSON.parse(text.slice(start, end + 1));
}

// Override hook for tests: inject a fake model callable instead of hitting the network.
export type ModelCall = (prompt: string) => Promise<string>;

async function callModel(prompt: string): Promise<string> {
  const gw = gwKey();
  if (gw) {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${gw}` },
      body: JSON.stringify({
        model: gwModel(),
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`AI Gateway ${res.status}: ${await res.text().catch(() => "")}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  }
  const ant = antKey();
  if (ant) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ant,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: antModel(),
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? "";
  }
  throw new Error("No model key (set VERCEL_AI_GATEWAY or ANTHROPIC_API_KEY)");
}

export function hasModelKey(): boolean {
  return Boolean(gwKey() || antKey());
}

// Run the single Claude pass. `model` is injectable for tests. On any failure
// (no key, parse error) returns null so the caller can fall back to an empty
// profile rather than throwing.
export async function extractInfoProfile(
  subject: EnrichmentSubject,
  run: EnrichmentRun,
  model: ModelCall = callModel,
): Promise<InfoProfile | null> {
  if (run.factsBySource.length === 0) return null;
  try {
    const text = await model(buildPrompt(subject, run));
    const parsed = InfoProfileSchema.safeParse(extractJson(text));
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
