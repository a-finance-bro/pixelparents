// DB-free constants/types shared across the asks connector. Kept separate from
// asks.ts (which imports the DB) so pure modules — the validators and the
// matcher — and unit tests can use them without pulling in a DB connection.

export type AskStatus = "open" | "matched" | "closed";
export type ResponseProposal = "async_advice" | "zoom" | "dinner" | "other";
export type ResponseStatus = "offered" | "accepted" | "declined";

export const ASK_PROPOSALS: ResponseProposal[] = [
  "async_advice",
  "zoom",
  "dinner",
  "other",
];

export const ASK_PROPOSAL_LABELS: Record<ResponseProposal, string> = {
  async_advice: "Async advice",
  zoom: "A short Zoom call",
  dinner: "Meet over dinner",
  other: "Something else",
};
