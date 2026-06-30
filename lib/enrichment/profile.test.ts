import { describe, it, expect } from "vitest";
import {
  websiteUrlOf,
  enrichmentOptInOf,
  normalizeWebsiteUrl,
  mergeOwnerEdit,
  curatedEnrichmentOf,
  preserveOwnerEdit,
  type StoredEnrichment,
} from "./profile";
import type { InfoProfile } from "./info-extract";
import type { FullEnrichment } from "./subject";

const info: InfoProfile = {
  identity: {
    name: "Ada Lovelace",
    headline: "Engineer",
    currentRole: "Founder",
    currentCompany: "Acme",
    location: "London",
    education: ["Cambridge"],
  },
  bio: "Builds compilers.",
  expertiseTags: ["compilers", "math"],
  canHelpWith: ["mentoring", "career advice"],
};

function stored(overrides: Partial<StoredEnrichment> = {}): StoredEnrichment {
  return {
    enrichedAt: "2026-06-30T00:00:00.000Z",
    subject: { name: "Ada Lovelace" },
    info,
    infoExtracted: true,
    factsBySource: [{ source: "github", facts: ["100 repos"] }],
    statuses: [
      { source: "github", status: "ok", factCount: 1 },
      { source: "brightdata", status: "no_api_key", note: "API key not set", factCount: 0 },
    ],
    citations: ["https://github.com/ada"],
    buildStatus: "ready",
    ...overrides,
  };
}

describe("websiteUrlOf / enrichmentOptInOf", () => {
  it("reads website url, trimming and nulling blanks", () => {
    expect(websiteUrlOf({ websiteUrl: " https://x.com " })).toBe("https://x.com");
    expect(websiteUrlOf({ websiteUrl: "   " })).toBeNull();
    expect(websiteUrlOf({})).toBeNull();
    expect(websiteUrlOf(null)).toBeNull();
  });

  it("opt-in defaults OFF — only an explicit true opts in", () => {
    expect(enrichmentOptInOf({})).toBe(false);
    expect(enrichmentOptInOf(null)).toBe(false);
    expect(enrichmentOptInOf({ enrichmentOptIn: "true" })).toBe(false);
    expect(enrichmentOptInOf({ enrichmentOptIn: true })).toBe(true);
  });
});

describe("normalizeWebsiteUrl", () => {
  it("adds https:// to a bare host", () => {
    expect(normalizeWebsiteUrl("example.com")).toBe("https://example.com/");
  });
  it("keeps an http(s) url", () => {
    expect(normalizeWebsiteUrl("http://example.org/path")).toBe("http://example.org/path");
  });
  it("rejects non-http(s) schemes (xss vectors)", () => {
    expect(normalizeWebsiteUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsiteUrl("data:text/html,x")).toBeNull();
    expect(normalizeWebsiteUrl("mailto:a@b.com")).toBeNull();
  });
  it("rejects bare/dotless hosts and blanks", () => {
    expect(normalizeWebsiteUrl("localhost")).toBeNull();
    expect(normalizeWebsiteUrl("")).toBeNull();
    expect(normalizeWebsiteUrl(null)).toBeNull();
  });
});

describe("mergeOwnerEdit (owner text wins per-field)", () => {
  it("uses AI output when no owner edit", () => {
    const m = mergeOwnerEdit(info);
    expect(m.bio).toBe("Builds compilers.");
    expect(m.expertiseTags).toEqual(["compilers", "math"]);
    expect(m.editedByOwner).toBe(false);
  });
  it("prefers owner's non-empty fields", () => {
    const m = mergeOwnerEdit(info, {
      bio: "My own bio.",
      expertiseTags: ["rust"],
      canHelpWith: [],
      editedByOwner: true,
    });
    expect(m.bio).toBe("My own bio.");
    expect(m.expertiseTags).toEqual(["rust"]);
    // Empty owner list falls back to AI output.
    expect(m.canHelpWith).toEqual(["mentoring", "career advice"]);
    expect(m.editedByOwner).toBe(true);
  });
});

describe("curatedEnrichmentOf — only curated info, never facts/statuses", () => {
  it("returns the curated slice and no raw facts/status fields", () => {
    const c = curatedEnrichmentOf(stored());
    expect(c).not.toBeNull();
    expect(Object.keys(c!).sort()).toEqual(
      ["bio", "canHelpWith", "editedByOwner", "expertiseTags"].sort(),
    );
    expect(c).not.toHaveProperty("factsBySource");
    expect(c).not.toHaveProperty("statuses");
    expect(c).not.toHaveProperty("citations");
  });
  it("returns null when there is nothing to show", () => {
    expect(curatedEnrichmentOf(null)).toBeNull();
    const empty = stored({ info: { ...info, bio: "", expertiseTags: [], canHelpWith: [] } });
    expect(curatedEnrichmentOf(empty)).toBeNull();
  });
});

describe("preserveOwnerEdit — refresh never clobbers a manual edit", () => {
  const fresh: FullEnrichment = {
    enrichedAt: "2026-07-01T00:00:00.000Z",
    subject: { name: "Ada Lovelace" },
    info: { ...info, bio: "Fresh AI bio." },
    infoExtracted: true,
    factsBySource: [{ source: "github", facts: ["200 repos"] }],
    statuses: [{ source: "github", status: "ok", factCount: 1 }],
    citations: [],
  };

  it("carries the owner edit forward when editedByOwner", () => {
    const previous = stored({
      ownerEdit: { bio: "Owner bio.", editedByOwner: true, editedAt: "x" },
    });
    const merged = preserveOwnerEdit(fresh, previous);
    expect(merged.ownerEdit?.bio).toBe("Owner bio.");
    // The merged curated view still shows the owner's bio over the fresh AI bio.
    expect(curatedEnrichmentOf(merged)!.bio).toBe("Owner bio.");
    expect(merged.buildStatus).toBe("ready");
  });

  it("does not carry forward a non-owner-edited block", () => {
    const previous = stored({ ownerEdit: { bio: "stale", editedByOwner: false } });
    const merged = preserveOwnerEdit(fresh, previous);
    expect(merged.ownerEdit).toBeUndefined();
    expect(curatedEnrichmentOf(merged)!.bio).toBe("Fresh AI bio.");
  });
});
