// Pure validators for ask + ask-response input. No DB / no I/O so they're shared
// by the API routes (authoritative) and unit tests. Keeps the limits in one
// place. Mirrors the validate* pattern in profile-slug-validate.ts.

import { INDUSTRY_SLUGS } from "./industries";
import { ASK_PROPOSALS, type ResponseProposal } from "./ask-constants";

export const ASK_TITLE_MAX = 140;
export const ASK_BODY_MAX = 2000;
export const ASK_OFFER_MAX = 600;
export const ASK_MAX_TAGS = 8;

export type Ok<T> = { ok: true; value: T };
export type Err<E extends string> = { ok: false; error: E };

export type AskTitleError = "title_empty" | "title_too_long";
export type AskBodyError = "body_empty" | "body_too_long";
export type AskTagsError = "tags_invalid" | "tags_too_many";
export type AskOfferError = "offer_empty" | "offer_too_long";
export type AskProposalError = "proposal_invalid";

// Collapse all whitespace runs (incl. newlines) to a single space and trim —
// titles are single-line.
function cleanSingleLine(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

// Multi-line clean: normalize CRLF to LF, then strip control chars while
// keeping tab and newline. Then trim. Bodies/offers may contain line breaks.
function cleanMultiLine(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

export function validateAskTitle(raw: unknown): Ok<string> | Err<AskTitleError> {
  const v = cleanSingleLine(raw);
  if (!v) return { ok: false, error: "title_empty" };
  if (v.length > ASK_TITLE_MAX) return { ok: false, error: "title_too_long" };
  return { ok: true, value: v };
}

export function validateAskBody(raw: unknown): Ok<string> | Err<AskBodyError> {
  const v = cleanMultiLine(raw);
  if (!v) return { ok: false, error: "body_empty" };
  if (v.length > ASK_BODY_MAX) return { ok: false, error: "body_too_long" };
  return { ok: true, value: v };
}

// Tags must be a subset of the canonical industry taxonomy, deduped, capped.
// Empty is allowed (an untagged ask just won't match anyone). Unknown slugs are
// rejected (rather than silently dropped) so the UI can surface a clear error.
export function validateAskTags(raw: unknown): Ok<string[]> | Err<AskTagsError> {
  if (raw == null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "tags_invalid" };
  const valid = new Set<string>(INDUSTRY_SLUGS as readonly string[]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (typeof t !== "string") return { ok: false, error: "tags_invalid" };
    const v = t.trim().toLowerCase();
    if (!valid.has(v)) return { ok: false, error: "tags_invalid" };
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  if (out.length > ASK_MAX_TAGS) return { ok: false, error: "tags_too_many" };
  return { ok: true, value: out };
}

export function validateAskOffer(raw: unknown): Ok<string> | Err<AskOfferError> {
  const v = cleanMultiLine(raw);
  if (!v) return { ok: false, error: "offer_empty" };
  if (v.length > ASK_OFFER_MAX) return { ok: false, error: "offer_too_long" };
  return { ok: true, value: v };
}

export function validateProposal(
  raw: unknown,
): Ok<ResponseProposal> | Err<AskProposalError> {
  if (typeof raw === "string" && (ASK_PROPOSALS as string[]).includes(raw)) {
    return { ok: true, value: raw as ResponseProposal };
  }
  return { ok: false, error: "proposal_invalid" };
}
