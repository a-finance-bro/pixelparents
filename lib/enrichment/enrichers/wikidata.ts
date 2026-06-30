// Wikidata enricher — KEYLESS. Searches Wikidata by name; accepts the first
// entity whose label matches the subject AND that is a human (P31=Q5), then
// resolves occupation / employer / education / award claims to readable labels.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson } from "../http";
import { handleFromUrls, nameOverlaps } from "../identity";

const API = "https://www.wikidata.org/w/api.php";

type SearchResp = { search?: Array<{ id: string; label?: string; description?: string }> };
type Claim = { mainsnak?: { datavalue?: { value?: { id?: string } } } };
type Entity = {
  labels?: { en?: { value?: string } };
  descriptions?: { en?: { value?: string } };
  claims?: Record<string, Claim[]>;
};
type EntitiesResp = { entities?: Record<string, Entity> };

const PROPS = {
  instanceOf: "P31",
  occupation: "P106",
  employer: "P108",
  education: "P69",
  award: "P166",
} as const;
const HUMAN = "Q5";

function claimIds(entity: Entity, prop: string, limit = 5): string[] {
  return (entity.claims?.[prop] ?? [])
    .map((c) => c.mainsnak?.datavalue?.value?.id)
    .filter((x): x is string => Boolean(x))
    .slice(0, limit);
}

async function resolveLabels(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const resp = await fetchJson<EntitiesResp>(
    `${API}?action=wbgetentities&ids=${ids.join("|")}&props=labels&languages=en&format=json&origin=*`,
  );
  const out: Record<string, string> = {};
  for (const [id, e] of Object.entries(resp?.entities ?? {})) {
    const label = e.labels?.en?.value;
    if (label) out[id] = label;
  }
  return out;
}

export async function enrichWithWikidata(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    let qid: string | null = handleFromUrls(ctx.knownUrls.wikidata, /wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i);
    let trusted = Boolean(qid);

    if (!qid && ctx.fullName) {
      const search = await fetchJson<SearchResp>(
        `${API}?action=wbsearchentities&search=${encodeURIComponent(ctx.fullName)}&language=en&type=item&format=json&origin=*`,
      );
      const hit = (search?.search ?? []).find((s) => nameOverlaps(ctx.fullName, s.label));
      if (hit) qid = hit.id;
    }
    if (!qid) return noData("wikidata", "No matching Wikidata entity");

    const entityResp = await fetchJson<EntitiesResp>(
      `${API}?action=wbgetentities&ids=${qid}&format=json&props=claims|labels|descriptions&languages=en&origin=*`,
    );
    const entity = entityResp?.entities?.[qid];
    if (!entity) return noData("wikidata", "Wikidata entity not found");

    // For name-search hits (not a trusted URL), require the entity to be a human.
    if (!trusted) {
      const isHuman = claimIds(entity, PROPS.instanceOf, 5).includes(HUMAN);
      if (!isHuman) return noData("wikidata", "Matched entity is not a person");
      trusted = true;
    }

    const occ = claimIds(entity, PROPS.occupation);
    const emp = claimIds(entity, PROPS.employer);
    const edu = claimIds(entity, PROPS.education);
    const awd = claimIds(entity, PROPS.award);
    const labels = await resolveLabels([...new Set([...occ, ...emp, ...edu, ...awd])]);
    const names = (ids: string[]) => ids.map((id) => labels[id]).filter(Boolean);

    const desc = entity.descriptions?.en?.value;
    const facts = [`Has a Wikidata entity (${qid})${desc ? ` — described as: ${desc}` : ""}.`];
    const occN = names(occ);
    const empN = names(emp);
    const eduN = names(edu);
    const awdN = names(awd);
    if (occN.length) facts.push(`Occupations: ${occN.join(", ")}.`);
    if (empN.length) facts.push(`Employer: ${empN.join(", ")}.`);
    if (eduN.length) facts.push(`Education: ${eduN.join(", ")}.`);
    if (awdN.length) facts.push(`Awards: ${awdN.join(", ")}.`);

    return ok("wikidata", facts, [`https://www.wikidata.org/wiki/${qid}`], {
      qid,
      description: desc,
      occupations: occN,
    });
  } catch (e) {
    return errored("wikidata", `Wikidata lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
