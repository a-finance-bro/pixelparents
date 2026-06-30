// Runnable proof script for the enrichment engine. READ-ONLY: it runs the full
// enrichment for one subject and PRINTS the de-scored info profile, the facts
// grouped by source, and the FULL status roster (which sources ran vs. returned
// "API Key Not Set"). It NEVER writes to the database.
//
// Usage (loads .env.local automatically):
//   npx tsx scripts/enrich-one.ts --github torvalds --name "Linus Torvalds"
//   npx tsx scripts/enrich-one.ts --website https://example.com --name "Jane Doe"
//   npx tsx scripts/enrich-one.ts --linkedin https://www.linkedin.com/in/foo --name "Foo Bar"
//
// IMPORTANT: print ONLY public data about a public figure — never real OHS family PII.

import { config } from "dotenv";
import { resolve } from "node:path";
import { runFullEnrichment } from "../lib/enrichment/subject";
import type { EnrichmentSubject } from "../lib/enrichment/types";

// Load .env.local then .env (does not override already-set vars).
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const subject: EnrichmentSubject = {
  name: arg("--name") ?? null,
  githubUsername: arg("--github") ?? null,
  websiteUrl: arg("--website") ?? null,
  linkedinUrl: arg("--linkedin") ?? null,
};

if (!subject.name && !subject.githubUsername && !subject.websiteUrl && !subject.linkedinUrl) {
  console.error(
    "Provide at least one of --name, --github, --website, --linkedin.\n" +
      'e.g. npx tsx scripts/enrich-one.ts --github torvalds --name "Linus Torvalds"',
  );
  process.exit(1);
}

const STATUS_LABEL: Record<string, string> = {
  ok: "OK",
  no_api_key: "API Key Not Set",
  no_data: "No Data",
  error: "Error",
};

function hr(title: string): void {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

async function main(): Promise<void> {
  hr("ENRICHING SUBJECT");
  console.log(JSON.stringify(subject, null, 2));

  const result = await runFullEnrichment(subject);

  hr("INFO PROFILE (de-scored)");
  console.log(`AI info-extraction ran: ${result.infoExtracted ? "yes" : "no (no facts or no model key)"}`);
  console.log(JSON.stringify(result.info, null, 2));

  hr("FACTS BY SOURCE");
  if (result.factsBySource.length === 0) {
    console.log("(no sources produced facts)");
  }
  for (const group of result.factsBySource) {
    console.log(`\n[${group.source}]`);
    for (const f of group.facts) console.log(`  ${f}`);
  }

  hr("STATUS ROSTER (every enricher — visible)");
  const counts: Record<string, number> = {};
  for (const s of result.statuses) {
    counts[s.status] = (counts[s.status] ?? 0) + 1;
    const label = (STATUS_LABEL[s.status] ?? s.status).padEnd(16);
    const facts = s.factCount > 0 ? ` (${s.factCount} facts)` : "";
    const note = s.note ? ` — ${s.note}` : "";
    console.log(`  ${s.source.padEnd(18)} ${label}${facts}${note}`);
  }

  hr("SUMMARY");
  console.log(
    `Total enrichers: ${result.statuses.length} | ` +
      Object.entries(counts)
        .map(([k, v]) => `${STATUS_LABEL[k] ?? k}: ${v}`)
        .join(" | "),
  );
  console.log(`Citations gathered: ${result.citations.length}`);
  if (result.citations.length) {
    for (const c of result.citations.slice(0, 20)) console.log(`  ${c}`);
  }
  console.log("\n(READ-ONLY: nothing was written to the database.)");
}

main().catch((e) => {
  console.error("enrich-one failed:", e);
  process.exit(1);
});
