import { describe, it, expect } from "vitest";
import {
  validateAskTitle,
  validateAskBody,
  validateAskTags,
  validateAskOffer,
  validateProposal,
  ASK_TITLE_MAX,
  ASK_BODY_MAX,
  ASK_OFFER_MAX,
  ASK_MAX_TAGS,
} from "@/lib/ask-validate";

describe("validateAskTitle", () => {
  it("rejects empty / whitespace-only", () => {
    expect(validateAskTitle("")).toEqual({ ok: false, error: "title_empty" });
    expect(validateAskTitle("   ")).toEqual({ ok: false, error: "title_empty" });
  });
  it("collapses whitespace and trims", () => {
    expect(validateAskTitle("  hi   there \n ")).toEqual({ ok: true, value: "hi there" });
  });
  it("rejects over-length", () => {
    const long = "a".repeat(ASK_TITLE_MAX + 1);
    expect(validateAskTitle(long)).toEqual({ ok: false, error: "title_too_long" });
  });
});

describe("validateAskBody", () => {
  it("keeps newlines but strips control chars", () => {
    const res = validateAskBody("line one\nline two");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe("line one\nline two");
  });
  it("normalizes CRLF to LF", () => {
    const res = validateAskBody("a\r\nb");
    expect(res.ok && res.value).toBe("a\nb");
  });
  it("rejects empty and over-length", () => {
    expect(validateAskBody("  ")).toEqual({ ok: false, error: "body_empty" });
    expect(validateAskBody("x".repeat(ASK_BODY_MAX + 1))).toEqual({
      ok: false,
      error: "body_too_long",
    });
  });
});

describe("validateAskTags", () => {
  it("allows empty / null", () => {
    expect(validateAskTags(null)).toEqual({ ok: true, value: [] });
    expect(validateAskTags([])).toEqual({ ok: true, value: [] });
  });
  it("accepts valid canonical slugs and dedupes (case-insensitive)", () => {
    expect(validateAskTags(["edtech", "EDTECH", "fintech"])).toEqual({
      ok: true,
      value: ["edtech", "fintech"],
    });
  });
  it("rejects unknown slugs", () => {
    expect(validateAskTags(["not-a-real-slug"])).toEqual({ ok: false, error: "tags_invalid" });
  });
  it("rejects non-array and non-string entries", () => {
    expect(validateAskTags("edtech")).toEqual({ ok: false, error: "tags_invalid" });
    expect(validateAskTags([1, 2])).toEqual({ ok: false, error: "tags_invalid" });
  });
  it("rejects too many tags", () => {
    // Use distinct valid slugs beyond the cap.
    const many = ["ai-ml", "fintech", "healthcare", "biotech", "saas", "enterprise", "devtools", "security", "data"];
    expect(many.length).toBeGreaterThan(ASK_MAX_TAGS);
    expect(validateAskTags(many)).toEqual({ ok: false, error: "tags_too_many" });
  });
});

describe("validateAskOffer", () => {
  it("rejects empty and over-length", () => {
    expect(validateAskOffer("")).toEqual({ ok: false, error: "offer_empty" });
    expect(validateAskOffer("o".repeat(ASK_OFFER_MAX + 1))).toEqual({
      ok: false,
      error: "offer_too_long",
    });
  });
  it("accepts a normal offer", () => {
    const res = validateAskOffer("I can help with EdTech intros.");
    expect(res.ok).toBe(true);
  });
});

describe("validateProposal", () => {
  it("accepts the known proposals", () => {
    for (const p of ["async_advice", "zoom", "dinner", "other"]) {
      expect(validateProposal(p)).toEqual({ ok: true, value: p });
    }
  });
  it("rejects anything else", () => {
    expect(validateProposal("coffee")).toEqual({ ok: false, error: "proposal_invalid" });
    expect(validateProposal(null)).toEqual({ ok: false, error: "proposal_invalid" });
  });
});
