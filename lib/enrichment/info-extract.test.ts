import { describe, it, expect } from "vitest";
import { extractInfoProfile, emptyInfoProfile, InfoProfileSchema } from "./info-extract";
import type { EnrichmentRun } from "./index";

const subject = { name: "Linus Torvalds" };

function runWith(facts: Array<{ source: "github"; facts: string[] }>): EnrichmentRun {
  return {
    factsBySource: facts,
    statuses: [],
    citations: [],
    results: [],
  } as unknown as EnrichmentRun;
}

describe("extractInfoProfile (mocked model)", () => {
  const run = runWith([{ source: "github", facts: ["GitHub user @torvalds.", "Created Linux and Git."] }]);

  it("maps a well-formed model JSON response into a validated InfoProfile", async () => {
    const model = async () =>
      JSON.stringify({
        identity: {
          name: "Linus Torvalds",
          headline: "Creator of Linux and Git",
          currentRole: "Fellow",
          currentCompany: "Linux Foundation",
          location: "Portland, OR",
          education: ["University of Helsinki"],
        },
        bio: "Software engineer who created the Linux kernel and Git.",
        expertiseTags: ["operating systems", "version control", "C"],
        canHelpWith: ["Kernel development", "Open-source maintenance"],
      });
    const profile = await extractInfoProfile(subject, run, model);
    expect(profile).not.toBeNull();
    expect(profile!.identity.name).toBe("Linus Torvalds");
    expect(profile!.expertiseTags).toContain("C");
    expect(profile!.canHelpWith).toHaveLength(2);
    // De-scored: the schema has no score/points field.
    expect(profile).not.toHaveProperty("score");
  });

  it("tolerates prose/markdown around the JSON object", async () => {
    const model = async () =>
      'Here you go:\n```json\n{"identity":{"name":"X","headline":null,"currentRole":null,"currentCompany":null,"location":null,"education":[]},"bio":"b","expertiseTags":[],"canHelpWith":[]}\n```';
    const profile = await extractInfoProfile(subject, run, model);
    expect(profile).not.toBeNull();
    expect(profile!.identity.name).toBe("X");
  });

  it("returns null when the model emits invalid JSON", async () => {
    const model = async () => "not json at all";
    expect(await extractInfoProfile(subject, run, model)).toBeNull();
  });

  it("returns null when the model output fails schema validation", async () => {
    const model = async () => JSON.stringify({ identity: "wrong-shape" });
    expect(await extractInfoProfile(subject, run, model)).toBeNull();
  });

  it("returns null without calling the model when there are no facts", async () => {
    let called = false;
    const model = async () => {
      called = true;
      return "{}";
    };
    const empty = runWith([]);
    expect(await extractInfoProfile(subject, empty, model)).toBeNull();
    expect(called).toBe(false);
  });

  it("emptyInfoProfile carries the subject name and no scores", () => {
    const p = emptyInfoProfile(subject);
    expect(InfoProfileSchema.safeParse(p).success).toBe(true);
    expect(p.identity.name).toBe("Linus Torvalds");
    expect(p.bio).toBe("");
  });
});
