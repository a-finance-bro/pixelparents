// Neo (neo.com) investor enricher — KEYLESS (Bubble.io public Data API). Matches
// by the subject's LinkedIn URL handle; only emits facts when the matched person
// is flagged as a VC. Investor-focus signal.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson } from "../http";

const API_BASE = "https://neo.com/api/1.1/obj";

type Person = {
  _id?: string;
  Name?: string;
  Title?: string;
  Firm?: string;
  User?: string;
  "Social LinkedIn"?: string;
  slug?: string;
};
type User = { isVC?: boolean; Stages?: string[]; Industries?: string[] };
type ListResp<T> = { response?: { results?: T[] } };

function linkedinHandle(url: string | null | undefined): string | null {
  const m = (url ?? "").match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? m[1].toLowerCase() : null;
}

async function findPerson(handle: string): Promise<Person | null> {
  // Equals-match the LinkedIn URL across a few common variants.
  const variants = [
    `https://www.linkedin.com/in/${handle}`,
    `https://www.linkedin.com/in/${handle}/`,
    `https://linkedin.com/in/${handle}`,
    `http://www.linkedin.com/in/${handle}`,
  ];
  for (const v of variants) {
    const constraints = JSON.stringify([{ key: "Social LinkedIn", constraint_type: "equals", value: v }]);
    const resp = await fetchJson<ListResp<Person>>(
      `${API_BASE}/person?constraints=${encodeURIComponent(constraints)}&limit=1`,
      {},
      3000,
    );
    const p = resp?.response?.results?.[0];
    if (p) return p;
  }
  return null;
}

export async function enrichWithNeo(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    const handle = linkedinHandle(ctx.subject.linkedinUrl);
    if (!handle) return noData("neo", "No LinkedIn handle to match against Neo");

    const person = await findPerson(handle);
    if (!person?._id) return noData("neo", "Not listed on Neo");

    let user: User | null = null;
    if (person.User) {
      const constraints = JSON.stringify([{ key: "_id", constraint_type: "equals", value: person.User }]);
      const resp = await fetchJson<ListResp<User>>(
        `${API_BASE}/user?constraints=${encodeURIComponent(constraints)}&limit=1`,
        {},
        3000,
      );
      user = resp?.response?.results?.[0] ?? null;
    }
    if (!user?.isVC) return noData("neo", "Neo profile is not flagged as an investor");

    const facts = [
      `Listed on Neo as ${person.Name ?? "(investor)"}${person.Title || person.Firm ? ` (${[person.Title, person.Firm].filter(Boolean).join(" at ")})` : ""}.`,
    ];
    if (user.Stages?.length) facts.push(`Invests at stages: ${user.Stages.join(", ")}.`);
    if (user.Industries?.length) facts.push(`Industry focus: ${user.Industries.join(", ")}.`);

    const citation = person.slug ? `https://neo.com/investor/${person.slug}` : "https://neo.com/investors";
    return ok("neo", facts, [citation], { name: person.Name, firm: person.Firm });
  } catch (e) {
    return errored("neo", `Neo lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
