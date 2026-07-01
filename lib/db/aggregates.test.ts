import { describe, it, expect } from "vitest";
import {
  getStats,
  getBreakdowns,
  getTrends,
  hasFilters,
  K_ANON,
  COMPLETED,
  completedFamily,
} from "@/lib/db/aggregates";

// No DATABASE_URL in the test env, so every aggregate takes the graceful
// "pending" path — verifying it never throws and degrades to safe defaults.

describe("aggregates (no DB → pending)", () => {
  it("K_ANON is 5", () => {
    expect(K_ANON).toBe(5);
  });

  it("COMPLETED predicate matches only welcome-fired (notified) signups", () => {
    // The map / breakdowns must share the SAME completed-only predicate getStats
    // uses, so their numbers never disagree with the Families/Parents chips.
    expect(COMPLETED).toBe("(extra->>'notified') = 'true'");
  });

  it("completedFamily scopes a child table to completed families via the shared predicate", () => {
    const frag = completedFamily("ch");
    // Correlates the child table's family_id to a completed signup, and reuses
    // the COMPLETED predicate (single source of truth) — no divergent copy.
    expect(frag).toContain("ch.family_id");
    expect(frag).toContain("FROM signups s");
    expect(frag).toContain(`s.${COMPLETED}`);
    expect(frag.startsWith("EXISTS (SELECT 1")).toBe(true);
  });

  it("hasFilters detects an active filter", () => {
    expect(hasFilters({})).toBe(false);
    expect(hasFilters({ state: "California" })).toBe(true);
    expect(hasFilters({ state: "" })).toBe(false);
  });

  it("getStats degrades to pending", async () => {
    const s = await getStats();
    expect(s.database).toBe("pending");
    expect(s.total_signups).toBe(0);
    expect(s.total_children).toBe(0);
  });

  it("getStats echoes filters when filtered", async () => {
    const s = await getStats({ state: "California" });
    expect(s.filters?.state).toBe("California");
    expect(s.suppressed).toBe(false);
  });

  it("getBreakdowns degrades to pending", async () => {
    const b = await getBreakdowns();
    expect(b.database).toBe("pending");
    expect(b.top_interests).toEqual([]);
    expect(b.skillsets_by_tech_depth).toEqual({});
  });

  it("getTrends degrades to pending and keeps the interval", async () => {
    const t = await getTrends("month");
    expect(t.database).toBe("pending");
    expect(t.interval).toBe("month");
    expect(t.points).toEqual([]);
  });
});
