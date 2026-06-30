import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB layer: getSql returns a tagged-template fn we drive per-call, and
// ensureFamiliesSchema is a no-op. We assert read-modify-write semantics without
// touching a real database.
const calls: Array<{ strings: string[]; values: unknown[] }> = [];
let queue: unknown[][] = [];

const sqlMock = (strings: TemplateStringsArray, ...values: unknown[]) => {
  calls.push({ strings: [...strings], values });
  return Promise.resolve(queue.shift() ?? []);
};

vi.mock("@/lib/db", () => ({ getSql: () => sqlMock }));
vi.mock("@/lib/db/ensure", () => ({ ensureFamiliesSchema: vi.fn(async () => {}) }));

import { saveEnrichment, getEnrichment } from "./enrichment";
import { ensureFamiliesSchema } from "@/lib/db/ensure";
import type { FullEnrichment } from "@/lib/enrichment/subject";

const enrichment = {
  enrichedAt: "2026-06-30T00:00:00.000Z",
  subject: { name: "Public Figure" },
  info: {
    identity: { name: "Public Figure", headline: null, currentRole: null, currentCompany: null, location: null, education: [] },
    bio: "A public figure.",
    expertiseTags: ["x"],
    canHelpWith: [],
  },
  infoExtracted: true,
  factsBySource: [{ source: "github" as const, facts: ["fact"] }],
  statuses: [{ source: "github" as const, status: "ok" as const, factCount: 1 }],
  citations: ["https://example.com"],
} satisfies FullEnrichment;

beforeEach(() => {
  calls.length = 0;
  queue = [];
});

describe("saveEnrichment", () => {
  it("read-modify-writes extra.enrichment, preserving existing extra keys", async () => {
    queue = [
      [{ extra: { builderInterest: "builder" } }], // SELECT extra
      [{ id: "sid" }], // UPDATE ... RETURNING id
    ];
    const okSave = await saveEnrichment("sid", enrichment);
    expect(okSave).toBe(true);
    expect(ensureFamiliesSchema).toHaveBeenCalled();

    // The UPDATE (2nd call) must carry a merged extra: existing key + enrichment.
    const update = calls[1]!;
    const merged = JSON.parse(update.values[0] as string);
    expect(merged.builderInterest).toBe("builder");
    expect(merged.enrichment.info.bio).toBe("A public figure.");
    expect(merged.enrichment.statuses[0].source).toBe("github");
  });

  it("handles a null existing extra (first-ever enrichment)", async () => {
    queue = [[{ extra: null }], [{ id: "sid" }]];
    await saveEnrichment("sid", enrichment);
    const merged = JSON.parse(calls[1]!.values[0] as string);
    expect(merged.enrichment).toBeTruthy();
  });

  it("returns false when the signup does not exist", async () => {
    queue = [[]]; // SELECT returns no rows
    expect(await saveEnrichment("missing", enrichment)).toBe(false);
    // Should NOT have issued an UPDATE.
    expect(calls).toHaveLength(1);
  });
});

describe("getEnrichment", () => {
  it("returns the stored enrichment", async () => {
    queue = [[{ enrichment }]];
    const got = await getEnrichment("sid");
    expect(got?.info.bio).toBe("A public figure.");
  });

  it("returns null when absent", async () => {
    queue = [[{ enrichment: null }]];
    expect(await getEnrichment("sid")).toBeNull();
    queue = [[]];
    expect(await getEnrichment("sid")).toBeNull();
  });
});
