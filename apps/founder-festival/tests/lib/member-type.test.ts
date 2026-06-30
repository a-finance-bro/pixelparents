import { describe, it, expect } from "vitest";
import {
  isMemberType,
  normalizeMemberType,
  isHelperType,
  DEFAULT_MEMBER_TYPE,
  MEMBER_TYPES,
} from "@/lib/member-type";

describe("isMemberType", () => {
  it("accepts the four known types", () => {
    for (const t of MEMBER_TYPES) expect(isMemberType(t)).toBe(true);
  });
  it("rejects unknown / non-strings", () => {
    expect(isMemberType("teacher")).toBe(false);
    expect(isMemberType(null)).toBe(false);
    expect(isMemberType(3)).toBe(false);
  });
});

describe("normalizeMemberType", () => {
  it("passes through valid values", () => {
    expect(normalizeMemberType("student")).toBe("student");
    expect(normalizeMemberType("alumni")).toBe("alumni");
  });
  it("falls back to the default for invalid input", () => {
    expect(normalizeMemberType(null)).toBe(DEFAULT_MEMBER_TYPE);
    expect(normalizeMemberType("nope")).toBe(DEFAULT_MEMBER_TYPE);
  });
});

describe("isHelperType", () => {
  it("students are not helpers", () => {
    expect(isHelperType("student")).toBe(false);
  });
  it("parents, alumni, community, and unknowns are helpers", () => {
    expect(isHelperType("parent")).toBe(true);
    expect(isHelperType("alumni")).toBe(true);
    expect(isHelperType("community")).toBe(true);
    expect(isHelperType(null)).toBe(true); // defaults to community
  });
});
