import { describe, it, expect, vi, afterEach } from "vitest";
import { enrichWithWebsite, normalizeSiteUrl } from "./enrichers/website";
import { buildContext } from "./index";

function ctxFor(websiteUrl: string | null) {
  return buildContext({ name: "Jane Doe", websiteUrl });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeSiteUrl", () => {
  it("adds https:// to a bare domain and rejects junk", () => {
    expect(normalizeSiteUrl("example.com")).toBe("https://example.com/");
    expect(normalizeSiteUrl("  https://x.org/about ")).toBe("https://x.org/about");
    expect(normalizeSiteUrl("notadomain")).toBeNull();
    expect(normalizeSiteUrl("")).toBeNull();
    expect(normalizeSiteUrl(null)).toBeNull();
  });
});

describe("enrichWithWebsite", () => {
  it("returns no_data when no URL is supplied", async () => {
    const r = await enrichWithWebsite(ctxFor(null));
    expect(r.status).toBe("no_data");
    expect(r.facts).toHaveLength(0);
  });

  it("returns ok and extracts title/meta/headings/socials on a real-ish page", async () => {
    const html = `<!doctype html><html><head>
      <title>Jane Doe — Engineer</title>
      <meta name="description" content="Personal site of Jane Doe.">
      </head><body>
      <h1>Hi, I'm Jane</h1><h2>Projects</h2>
      <p>I build open-source tools and write about systems.</p>
      <a href="https://github.com/janedoe">gh</a>
      <a href="https://x.com/janedoe">x</a>
      </body></html>`;
    // First call = homepage (ok), second = /about (404 -> null).
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(html, { status: 200 }))
        .mockResolvedValueOnce(new Response("nope", { status: 404 })),
    );
    const r = await enrichWithWebsite(ctxFor("janedoe.dev"));
    expect(r.status).toBe("ok");
    const joined = r.facts.join("\n");
    expect(joined).toContain("Jane Doe — Engineer");
    expect(joined).toContain("Personal site of Jane Doe.");
    expect(joined).toContain("Hi, I'm Jane");
    expect(joined).toContain("github.com/janedoe");
    expect(joined).toContain("x.com/janedoe");
    expect(r.citations).toContain("https://janedoe.dev/");
  });

  it("returns no_data when the homepage cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    const r = await enrichWithWebsite(ctxFor("example.com"));
    expect(r.status).toBe("no_data");
  });

  it("returns no_data (not a crash) when fetch rejects", async () => {
    // fetchText swallows network errors -> null -> "Could not fetch homepage".
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const r = await enrichWithWebsite(ctxFor("example.com"));
    expect(r.status).toBe("no_data");
    expect(r.facts).toHaveLength(0);
  });
});
