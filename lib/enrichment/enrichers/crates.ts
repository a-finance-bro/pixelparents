// crates.io enricher — KEYLESS. Identity is the subject's GitHub login (crates.io
// accounts are OAuth-linked to GitHub), so we accept a crates.io account only if
// its linked github URL matches the known login — identity-safe. Reports published
// Rust crates + total downloads.

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchJson, fmtCount } from "../http";
import { handleFromUrls } from "../identity";

const API = "https://crates.io/api/v1";

type CratesUser = { user?: { id?: number; login?: string; name?: string; url?: string } };
type CratesList = { crates?: Array<{ name?: string; downloads?: number }> };

export async function enrichWithCrates(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    const login =
      ctx.githubUsername?.trim() ||
      handleFromUrls(ctx.knownUrls.github, /github\.com\/([A-Za-z0-9-]+)/i);
    if (!login) return noData("crates", "No GitHub login to resolve a crates.io account");

    const acct = await fetchJson<CratesUser>(`${API}/users/${encodeURIComponent(login)}`);
    const user = acct?.user;
    // Identity-safe: confirm the account's linked github URL matches the login.
    if (!user?.id || !user.url?.toLowerCase().includes(`github.com/${login.toLowerCase()}`)) {
      return noData("crates", "No identity-confirmed crates.io account");
    }

    const list = await fetchJson<CratesList>(`${API}/crates?user_id=${user.id}&per_page=50`);
    const crates = list?.crates ?? [];
    if (crates.length === 0) return noData("crates", "crates.io account publishes no crates");

    const totalDl = crates.reduce((s, c) => s + (c.downloads ?? 0), 0);
    const top = [...crates].sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0))[0];

    const facts = [
      `crates.io: @${login}${user.name ? ` (${user.name})` : ""} — maintains ${crates.length} published Rust crate(s).`,
    ];
    if (totalDl > 0) facts.push(`${fmtCount(totalDl)} total crate downloads.`);
    if (top?.name) facts.push(`Top crate: ${top.name} (${fmtCount(top.downloads ?? 0)} downloads).`);

    const citations = [`https://crates.io/users/${login}`];
    if (top?.name) citations.push(`https://crates.io/crates/${top.name}`);
    return ok("crates", facts, citations, { login, crate_count: crates.length, total_downloads: totalDl });
  } catch (e) {
    return errored("crates", `crates.io lookup failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
