// Member type for the OHS connect-mode "asks → expertise" connector.
//
// A claimed member self-selects how they relate to OHS. This drives who SEEKS
// help vs. who HELPS: anyone can post an ask, but only NON-STUDENT profiles are
// surfaced as candidate helpers by the matcher (src/lib/ask-matching.ts). The
// value lives on the `users` row (users.memberType, default "community").
//
// Pure + dependency-free so it can be imported by both server (route handlers)
// and client (the account selector) without pulling in the DB.

export const MEMBER_TYPES = ["student", "parent", "alumni", "community"] as const;

export type MemberType = (typeof MEMBER_TYPES)[number];

// Human labels for the account selector.
export const MEMBER_TYPE_LABELS: Record<MemberType, string> = {
  student: "Student",
  parent: "Parent",
  alumni: "Alumni",
  community: "Community member",
};

// Default applied to legacy rows and fresh claims. A "community" member is
// treated as a helper until they pick something else.
export const DEFAULT_MEMBER_TYPE: MemberType = "community";

export function isMemberType(v: unknown): v is MemberType {
  return typeof v === "string" && (MEMBER_TYPES as readonly string[]).includes(v);
}

// Normalize an arbitrary input to a MemberType, falling back to the default.
export function normalizeMemberType(v: unknown): MemberType {
  return isMemberType(v) ? v : DEFAULT_MEMBER_TYPE;
}

// Students SEEK help; everyone else can also HELP. A student may still post an
// ask — this only gates whether the profile is offered as a candidate helper.
export function isHelperType(v: unknown): boolean {
  return normalizeMemberType(v) !== "student";
}
