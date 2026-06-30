import { describe, it, expect } from "vitest";
import { runRegistry, buildContext, type StatusRow } from "./index";
import { ok, noApiKey, noData, errored, type Enricher } from "./types";

// The registry must KEEP every result (so every status is visible), group facts
// only for ok results, and de-dupe citations across ok results. NO scoring.
describe("runRegistry aggregation (status keeping)", () => {
  const ctx = buildContext({ name: "Test Subject" });

  const enrichers: Enricher[] = [
    { source: "github", run: async () => ok("github", ["fact a", "fact b"], ["https://x", "https://x"]) },
    { source: "exa-domain", run: async () => noApiKey("exa-domain") },
    { source: "npm", run: async () => noData("npm", "nothing found") },
    { source: "neo", run: async () => errored("neo", "boom") },
    // An enricher that throws must still surface as an "error" row (kept, not dropped).
    { source: "wikipedia", run: async () => { throw new Error("kaboom"); } },
  ];

  it("keeps a status row for EVERY enricher, including no_api_key and thrown errors", async () => {
    const run = await runRegistry(enrichers, ctx);
    expect(run.statuses).toHaveLength(enrichers.length);
    const bySource = Object.fromEntries(run.statuses.map((s: StatusRow) => [s.source, s]));
    expect(bySource.github!.status).toBe("ok");
    expect(bySource.github!.factCount).toBe(2);
    expect(bySource["exa-domain"]!.status).toBe("no_api_key");
    expect(bySource["exa-domain"]!.note).toBe("API key not set");
    expect(bySource.npm!.status).toBe("no_data");
    expect(bySource.neo!.status).toBe("error");
    // A thrown enricher is caught and kept as an error row.
    expect(bySource.wikipedia!.status).toBe("error");
  });

  it("groups facts only for ok results and dedupes citations", async () => {
    const run = await runRegistry(enrichers, ctx);
    expect(run.factsBySource).toEqual([{ source: "github", facts: ["fact a", "fact b"] }]);
    // Two identical citations collapse to one.
    expect(run.citations).toEqual(["https://x"]);
  });

  it("never attaches a numeric score to any result (de-scored)", async () => {
    const run = await runRegistry(enrichers, ctx);
    for (const r of run.results) {
      expect(r).not.toHaveProperty("points");
      expect(r).not.toHaveProperty("score");
    }
  });
});
