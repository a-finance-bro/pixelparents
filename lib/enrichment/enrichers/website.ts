// Personal / company website scraper — KEYLESS. Fetches the homepage and (best-
// effort) an /about page, byte-capped, and extracts the title, meta description,
// top headings, a text snippet, and any social links. This is net-new in
// pixelparents (the founder-festival app relied on Exa for web content); it gives
// the engine a real keyless source of personal-site signal.
//
// Status contract:
//   no_data  — no website URL supplied, or the page couldn't be fetched.
//   ok       — fetched and extracted at least the title or some text.
//   error    — unexpected throw (defensive; fetch failures degrade to no_data).

import type { EnricherContext, EnrichmentResult } from "../types";
import { ok, noData, errored } from "../types";
import { fetchText } from "../http";

// Normalize a user-supplied site URL: add https:// if scheme-less, drop spaces.
export function normalizeSiteUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// Collapse whitespace and trim.
function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Strip tags, scripts, and styles to get readable text.
function visibleText(html: string): string {
  return collapse(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&quot;/gi, '"'),
  );
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? collapse(m[1]).slice(0, 200) || null : null;
}

function extractMeta(html: string, name: string): string | null {
  // Matches both name="..." and property="..." in either attribute order.
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
    "i",
  );
  const m = html.match(re) ?? html.match(re2);
  return m ? collapse(m[1]).slice(0, 300) || null : null;
}

function extractHeadings(html: string, limit = 5): string[] {
  const out: string[] = [];
  const re = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < limit) {
    const t = collapse(m[1].replace(/<[^>]+>/g, " "));
    if (t && t.length >= 2 && t.length <= 120) out.push(t);
  }
  return [...new Set(out)];
}

// Pull social profile links out of the page HTML.
function extractSocials(html: string): string[] {
  const out = new Set<string>();
  const hrefs = html.match(/href=["']([^"']+)["']/gi) ?? [];
  for (const h of hrefs) {
    const url = h.replace(/^href=["']/i, "").replace(/["']$/, "");
    const lower = url.toLowerCase();
    if (
      /(github\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|huggingface\.co|stackoverflow\.com|news\.ycombinator\.com|scholar\.google\.|orcid\.org|mastodon|bsky\.app)/.test(
        lower,
      ) &&
      /^https?:\/\//i.test(url)
    ) {
      out.add(url.split("?")[0]!);
    }
  }
  return [...out].slice(0, 12);
}

export async function enrichWithWebsite(ctx: EnricherContext): Promise<EnrichmentResult> {
  try {
    const base = normalizeSiteUrl(ctx.subject.websiteUrl);
    if (!base) return noData("website", "No website URL supplied");

    const homepage = await fetchText(base, { headers: { accept: "text/html" } });
    if (!homepage) return noData("website", "Could not fetch homepage");

    // Best-effort /about page (common path); ignored if it 404s.
    let aboutHtml: string | null = null;
    try {
      const aboutUrl = new URL("/about", base).toString();
      aboutHtml = await fetchText(aboutUrl, { headers: { accept: "text/html" } });
    } catch {
      /* about is optional */
    }

    const title = extractTitle(homepage);
    const description =
      extractMeta(homepage, "description") ?? extractMeta(homepage, "og:description");
    const headings = extractHeadings(homepage);
    const socials = extractSocials([homepage, aboutHtml ?? ""].join("\n"));
    const text = visibleText([homepage, aboutHtml ?? ""].join("\n"));
    const snippet = text.slice(0, 500);

    const facts: string[] = [];
    facts.push(`Personal/company website: ${base}`);
    if (title) facts.push(`Page title: "${title}"`);
    if (description) facts.push(`Meta description: "${description}"`);
    if (headings.length > 0) facts.push(`Headings: ${headings.join(" | ")}`);
    if (aboutHtml) facts.push(`Has an /about page.`);
    if (snippet) facts.push(`Text snippet: "${snippet}"`);
    if (socials.length > 0) facts.push(`Linked profiles: ${socials.join(", ")}`);

    // If we extracted nothing meaningful, report no_data.
    if (!title && !description && headings.length === 0 && !snippet) {
      return noData("website", "Fetched page but extracted no readable content");
    }

    return ok("website", facts, [base], {
      url: base,
      title,
      description,
      headings,
      socials,
      snippet,
      hasAbout: Boolean(aboutHtml),
    });
  } catch (e) {
    return errored("website", `website scrape failed: ${(e as Error)?.message ?? "unknown"}`);
  }
}
