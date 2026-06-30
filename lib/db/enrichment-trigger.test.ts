import { describe, it, expect } from "vitest";
import {
  shouldTrigger,
  subjectFromSignup,
  subjectHasInputs,
  MIN_REFRESH_MS,
} from "./enrichment-trigger";

describe("shouldTrigger — opt-in gating (no opt-in => no enrichment)", () => {
  it("never runs when not opted in, even with inputs", () => {
    expect(shouldTrigger({ optedIn: false, hasInputs: true })).toEqual({
      run: false,
      reason: "not-opted-in",
    });
  });

  it("does not run when opted in but there is nothing to enrich", () => {
    expect(shouldTrigger({ optedIn: true, hasInputs: false })).toEqual({
      run: false,
      reason: "no-inputs",
    });
  });

  it("runs when opted in with inputs and no prior run", () => {
    expect(shouldTrigger({ optedIn: true, hasInputs: true })).toEqual({
      run: true,
      reason: "ok",
    });
  });
});

describe("shouldTrigger — idempotency + rate limit", () => {
  const now = Date.parse("2026-06-30T12:00:00.000Z");

  it("short-circuits a non-forced trigger while a recent run is in flight", () => {
    const lastStartedAt = new Date(now - 5_000).toISOString();
    expect(shouldTrigger({ optedIn: true, hasInputs: true, lastStartedAt, now })).toEqual({
      run: false,
      reason: "in-flight",
    });
  });

  it("rate-limits a forced manual refresh within the window", () => {
    const lastStartedAt = new Date(now - 5_000).toISOString();
    expect(
      shouldTrigger({ optedIn: true, hasInputs: true, lastStartedAt, now, force: true }),
    ).toEqual({ run: false, reason: "rate-limited" });
  });

  it("allows a run once the window has elapsed", () => {
    const lastStartedAt = new Date(now - MIN_REFRESH_MS - 1).toISOString();
    expect(shouldTrigger({ optedIn: true, hasInputs: true, lastStartedAt, now })).toEqual({
      run: true,
      reason: "ok",
    });
  });
});

describe("subjectFromSignup / subjectHasInputs", () => {
  it("builds a subject from public, user-provided identifiers only", () => {
    const s = subjectFromSignup({
      firstName: "Ada",
      lastName: "Lovelace",
      linkedinUrl: "https://linkedin.com/in/ada",
      githubUsername: "ada",
      extra: { websiteUrl: "https://ada.dev" },
    });
    expect(s).toEqual({
      name: "Ada Lovelace",
      linkedinUrl: "https://linkedin.com/in/ada",
      websiteUrl: "https://ada.dev",
      githubUsername: "ada",
    });
  });

  it("reports no inputs when everything is blank", () => {
    const s = subjectFromSignup({
      firstName: "",
      lastName: "",
      linkedinUrl: null,
      githubUsername: "",
      extra: {},
    });
    expect(subjectHasInputs(s)).toBe(false);
  });

  it("reports inputs when any identifier is present", () => {
    expect(
      subjectHasInputs(
        subjectFromSignup({
          firstName: "A",
          lastName: "",
          linkedinUrl: null,
          githubUsername: "",
          extra: {},
        }),
      ),
    ).toBe(true);
  });
});
