import { describe, expect, it } from "vitest";
import { analyzeHtml, evaluateWebsite } from "./websiteEvaluator";

const GOOD = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/style.css">
<style>@media (max-width: 600px) { body { font-size: 14px } }</style>
</head><body>
<a class="btn" href="/book">Book an appointment</a>
<a href="tel:+15551234567">Call us</a>
<section><h2>What our clients say</h2><p>Great service!</p></section>
<img src="/logo.png">
<script src="https://cdn.example.com/app.js"></script>
</body></html>`;

const BAD = `<html><head><title>Joe's Plumbing</title></head><body>
<p>Welcome to our website.</p>
<img src="/missing.jpg"><img src="/also-missing.jpg">
</body></html>`;

function mockFetch(pages: Record<string, { status: number; body?: string }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const page = pages[url] ?? { status: 404 };
    const res = new Response(page.body ?? "", { status: page.status });
    Object.defineProperty(res, "url", { value: url });
    return res;
  }) as typeof fetch;
}

describe("analyzeHtml", () => {
  it("detects viewport, CTAs, social proof and assets", () => {
    const a = analyzeHtml(GOOD, "https://shop.example.com/");
    expect(a.hasViewport).toBe(true);
    expect(a.hasMediaQueries).toBe(true);
    expect(a.ctaCount).toBeGreaterThan(0);
    expect(a.hasTelOrMailto).toBe(true);
    expect(a.socialProofSignals.length).toBeGreaterThan(0);
    expect(a.assetUrls).toEqual(
      expect.arrayContaining([
        "https://shop.example.com/style.css",
        "https://shop.example.com/logo.png",
        "https://cdn.example.com/app.js",
      ]),
    );
  });

  it("reports missing basics on a bare page", () => {
    const a = analyzeHtml(BAD, "https://joe.example.com/");
    expect(a.hasViewport).toBe(false);
    expect(a.ctaCount).toBe(0);
    expect(a.socialProofSignals).toHaveLength(0);
  });

  it("matches CTA words on word boundaries and decodes entities", () => {
    const html = `<a href="/startups">Startups</a><a href="/ebooks">eBooks</a><a href="/p?a=1&amp;b=2">x</a><img src="/i.png?s=64&amp;v=4">`;
    const a = analyzeHtml(html, "https://x.example.com/");
    expect(a.ctaCount).toBe(0);
    expect(a.assetUrls).toEqual(["https://x.example.com/i.png?s=64&v=4"]);
  });

  it("detects schema.org review markup", () => {
    const html = `<script type="application/ld+json">{"@type":"AggregateRating","ratingValue":"4.8"}</script>`;
    expect(analyzeHtml(html, "https://x.example.com/").socialProofSignals.length).toBeGreaterThan(0);
  });
});

describe("evaluateWebsite", () => {
  it("passes a healthy site", async () => {
    const fetchFn = mockFetch({
      "https://shop.example.com/": { status: 200, body: GOOD },
      "https://shop.example.com/style.css": { status: 200 },
      "https://shop.example.com/logo.png": { status: 200 },
      "https://cdn.example.com/app.js": { status: 200 },
    });
    const r = await evaluateWebsite("https://shop.example.com/", { fetchFn, allowPrivateHosts: true });
    expect(r.mobileResponsive.status).toBe("pass");
    expect(r.ctaClarity.status).toBe("pass");
    expect(r.testimonials.status).toBe("pass");
    expect(r.brokenAssets.status).toBe("pass");
    expect(r.overallScore).toBe(100);
    expect(r.findings).toHaveLength(0);
  });

  it("is deterministic and flags each real problem", async () => {
    const fetchFn = mockFetch({ "https://joe.example.com/": { status: 200, body: BAD } });
    const opts = { fetchFn, allowPrivateHosts: true };
    const r1 = await evaluateWebsite("joe.example.com", opts);
    const r2 = await evaluateWebsite("joe.example.com", opts);
    expect(r1).toEqual(r2);
    expect(r1.mobileResponsive.status).toBe("fail");
    expect(r1.ctaClarity.status).toBe("fail");
    expect(r1.testimonials.status).toBe("fail");
    expect(r1.brokenAssets.status).toBe("fail");
    expect(r1.findings.map(f => f.issue)).toEqual(
      expect.arrayContaining(["Mobile Responsiveness", "Weak Call-to-Action", "Missing Social Proof", "Broken Assets Detected"]),
    );
    expect(r1.overallScore).toBe(100 - 25 - 20 - 15 - 10);
  });

  it("returns unknown for an unreachable page", async () => {
    const fetchFn = mockFetch({});
    const r = await evaluateWebsite("https://gone.example.com/", { fetchFn, allowPrivateHosts: true });
    expect(r.mobileResponsive.status).toBe("unknown");
    expect(r.overallScore).toBe(0);
  });

  it("refuses private network targets", async () => {
    const r = await evaluateWebsite("http://127.0.0.1:8080/");
    expect(r.overallScore).toBe(0);
    expect(r.findings[0].description).toMatch(/private network/);
  });

  it("rejects non-http URLs", async () => {
    const r = await evaluateWebsite("ftp://example.com");
    expect(r.findings[0].description).toMatch(/invalid URL/);
  });
});
