import { describe, expect, it } from "vitest";
import {
  TOUR_STEPS,
  clampStep,
  isFirstStep,
  isLastStep,
  primaryLabel,
} from "@/components/walkthrough-steps";

// Pure coverage for the walkthrough step model — the sequence + the Next/Back
// navigation math the overlay component relies on.

describe("TOUR_STEPS", () => {
  it("opens with an intro and closes with an outro (both untargeted)", () => {
    expect(TOUR_STEPS[0]!.target).toBeNull();
    expect(TOUR_STEPS[TOUR_STEPS.length - 1]!.target).toBeNull();
  });

  it("spotlights all six Explore cards in order, then the three shell controls", () => {
    const targets = TOUR_STEPS.map((s) => s.target).filter((t): t is string => t !== null);
    expect(targets).toEqual([
      "explore-community",
      "explore-directory",
      "explore-events",
      "explore-resources",
      "explore-family",
      "explore-developers",
      "notifications",
      "feedback",
      "account",
    ]);
  });

  it("gives every step a non-empty title and body", () => {
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
    }
  });
});

describe("clampStep", () => {
  it("keeps in-range indices unchanged", () => {
    expect(clampStep(0)).toBe(0);
    expect(clampStep(3)).toBe(3);
    expect(clampStep(TOUR_STEPS.length - 1)).toBe(TOUR_STEPS.length - 1);
  });

  it("clamps below 0 and above the last index", () => {
    expect(clampStep(-5)).toBe(0);
    expect(clampStep(999)).toBe(TOUR_STEPS.length - 1);
  });

  it("coerces NaN / non-finite values to 0 (the safe start)", () => {
    expect(clampStep(NaN)).toBe(0);
    expect(clampStep(Infinity)).toBe(0);
    expect(clampStep(-Infinity)).toBe(0);
  });

  it("floors fractional indices", () => {
    expect(clampStep(2.9)).toBe(2);
  });
});

describe("isFirstStep / isLastStep / primaryLabel", () => {
  it("identifies the first and last steps", () => {
    expect(isFirstStep(0)).toBe(true);
    expect(isFirstStep(1)).toBe(false);
    expect(isLastStep(TOUR_STEPS.length - 1)).toBe(true);
    expect(isLastStep(0)).toBe(false);
  });

  it("labels the primary button Finish only on the last step", () => {
    expect(primaryLabel(0)).toBe("Next");
    expect(primaryLabel(TOUR_STEPS.length - 2)).toBe("Next");
    expect(primaryLabel(TOUR_STEPS.length - 1)).toBe("Finish");
  });
});
