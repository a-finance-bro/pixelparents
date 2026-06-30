import { describe, expect, it } from "vitest";
import {
  familiesToRepoint,
  lowerEmail,
  pickCanonicalFamily,
  type FamilyAge,
} from "@/lib/family-merge";

// Only the PURE decision bits are unit-tested here (the DB-driven
// mergeFamiliesByVerifiedEmail needs a live Neon instance, which the test env
// doesn't have — same convention as the rest of lib/*.test.ts, which test pure
// helpers and let the DB paths degrade gracefully untested).

const STANFORD = "stanford.edu";
const mk = (local: string, domain: string) => `${local}@${domain}`;

describe("lowerEmail", () => {
  it("trims and lowercases", () => {
    expect(lowerEmail(`  ${mk("Foo", "OHS.Stanford.EDU")} `)).toBe(mk("foo", `ohs.${STANFORD}`));
  });

  it("returns empty for blank input", () => {
    expect(lowerEmail("   ")).toBe("");
    expect(lowerEmail("")).toBe("");
  });
});

describe("pickCanonicalFamily", () => {
  it("returns null for an empty set", () => {
    expect(pickCanonicalFamily([])).toBeNull();
  });

  it("picks the oldest family by created_at", () => {
    const families: FamilyAge[] = [
      { id: "b", createdAt: "2026-02-01T00:00:00.000Z" },
      { id: "a", createdAt: "2026-01-01T00:00:00.000Z" }, // oldest
      { id: "c", createdAt: "2026-03-01T00:00:00.000Z" },
    ];
    expect(pickCanonicalFamily(families)?.id).toBe("a");
  });

  it("is order-independent (deterministic)", () => {
    const a: FamilyAge = { id: "a", createdAt: "2026-01-01T00:00:00.000Z" };
    const b: FamilyAge = { id: "b", createdAt: "2026-02-01T00:00:00.000Z" };
    expect(pickCanonicalFamily([a, b])?.id).toBe("a");
    expect(pickCanonicalFamily([b, a])?.id).toBe("a");
  });

  it("tie-breaks equal timestamps by the smaller id", () => {
    const ts = "2026-01-01T00:00:00.000Z";
    expect(
      pickCanonicalFamily([
        { id: "zzz", createdAt: ts },
        { id: "aaa", createdAt: ts },
        { id: "mmm", createdAt: ts },
      ])?.id,
    ).toBe("aaa");
  });

  it("accepts Date objects as well as ISO strings", () => {
    const families: FamilyAge[] = [
      { id: "b", createdAt: new Date("2026-02-01T00:00:00.000Z") },
      { id: "a", createdAt: new Date("2026-01-01T00:00:00.000Z") },
    ];
    expect(pickCanonicalFamily(families)?.id).toBe("a");
  });

  it("handles a single-element set", () => {
    expect(pickCanonicalFamily([{ id: "solo", createdAt: "2026-01-01T00:00:00.000Z" }])?.id).toBe(
      "solo",
    );
  });
});

describe("familiesToRepoint", () => {
  it("excludes the canonical id", () => {
    expect(familiesToRepoint("a", ["a", "b", "c"])).toEqual(["b", "c"]);
  });

  it("dedupes and sorts for determinism", () => {
    expect(familiesToRepoint("a", ["c", "b", "b", "c", "a"])).toEqual(["b", "c"]);
  });

  it("returns empty when only the canonical is present (self-match-safe)", () => {
    expect(familiesToRepoint("a", ["a"])).toEqual([]);
    expect(familiesToRepoint("a", ["a", "a"])).toEqual([]);
  });

  it("returns empty for an empty set", () => {
    expect(familiesToRepoint("a", [])).toEqual([]);
  });

  it("keeps a single other family", () => {
    expect(familiesToRepoint("father", ["father", "son"])).toEqual(["son"]);
  });
});
