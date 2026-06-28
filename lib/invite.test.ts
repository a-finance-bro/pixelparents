import { describe, it, expect } from "vitest";
import { parseInviteEmails, MAX_INVITES } from "@/lib/invite";

describe("parseInviteEmails", () => {
  it("splits on commas and whitespace", () => {
    expect(parseInviteEmails("a@x.com, b@y.com c@z.com")).toEqual([
      "a@x.com",
      "b@y.com",
      "c@z.com",
    ]);
  });

  it("lowercases and trims", () => {
    expect(parseInviteEmails("  A@X.COM ")).toEqual(["a@x.com"]);
  });

  it("dedupes case-insensitively", () => {
    expect(parseInviteEmails("a@x.com, A@X.com, a@x.com")).toEqual(["a@x.com"]);
  });

  it("drops invalid entries", () => {
    expect(parseInviteEmails("good@x.com, nope, also bad@, @bad.com")).toEqual([
      "good@x.com",
    ]);
  });

  it("returns an empty array for empty / whitespace input", () => {
    expect(parseInviteEmails("")).toEqual([]);
    expect(parseInviteEmails("   ,  , ")).toEqual([]);
  });

  it("caps the result at MAX_INVITES", () => {
    const many = Array.from({ length: MAX_INVITES + 5 }, (_, i) => `u${i}@x.com`).join(", ");
    const out = parseInviteEmails(many);
    expect(out).toHaveLength(MAX_INVITES);
    expect(out[0]).toBe("u0@x.com");
  });
});
