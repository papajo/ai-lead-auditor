import { describe, expect, it } from "vitest";
import { buildOverpassQuery, discoverLeads, normalizeWebsite, parseOverpass } from "./leadDiscovery";

const OVERPASS = {
  elements: [
    { type: "node", id: 1, tags: { name: "Smith CPA", office: "accountant", website: "smithcpa.example.com", phone: "+1 813 555 0100", "addr:housenumber": "12", "addr:street": "Main St", "addr:city": "Tampa" } },
    { type: "way", id: 2, tags: { name: "Smith CPA (annex)", office: "accountant", website: "https://www.smithcpa.example.com/" } },
    { type: "node", id: 3, tags: { office: "accountant", website: "https://noname.example.com" } },
    { type: "node", id: 4, tags: { name: "Bay Tax", office: "tax_advisor", "contact:website": "http://baytax.example.com" } },
    { type: "node", id: 5, tags: { name: "Bad URL Co", office: "accountant", website: "mailto:x@y.z" } },
  ],
};

describe("normalizeWebsite", () => {
  it("adds https and takes the first of several URLs", () => {
    expect(normalizeWebsite("example.com")).toBe("https://example.com/");
    expect(normalizeWebsite("https://a.example.com;https://b.example.com")).toBe("https://a.example.com/");
    expect(normalizeWebsite("mailto:x@y.z")).toBeNull();
    expect(normalizeWebsite(undefined)).toBeNull();
    expect(normalizeWebsite("shop.example.com:8080/x")).toBe("https://shop.example.com:8080/x");
  });
});

describe("parseOverpass", () => {
  it("keeps named businesses with valid websites, deduped by domain", () => {
    const leads = parseOverpass(OVERPASS, "Accountants", 10);
    expect(leads.map(l => l.businessName)).toEqual(["Smith CPA", "Bay Tax"]);
    expect(leads[0]).toMatchObject({
      websiteUrl: "https://smithcpa.example.com/",
      phone: "+1 813 555 0100",
      address: "12 Main St, Tampa",
      osmId: "node/1",
      industry: "Accountants",
    });
  });

  it("respects the limit", () => {
    expect(parseOverpass(OVERPASS, "Accountants", 1)).toHaveLength(1);
  });
});

describe("buildOverpassQuery", () => {
  it("queries each tag for website and contact:website within the bbox", () => {
    const q = buildOverpassQuery([27.9, -82.6, 28.1, -82.4], [["office", "accountant"]], 10);
    expect(q).toContain('nwr["office"="accountant"]["website"](27.9,-82.6,28.1,-82.4);');
    expect(q).toContain('["contact:website"]');
    expect(q).toMatch(/^\[out:json\]/);
  });
});

describe("discoverLeads", () => {
  it("geocodes, queries Overpass and returns leads", async () => {
    const urls: string[] = [];
    const fetchFn = (async (url: string) => {
      urls.push(url);
      if (url.includes("nominatim")) {
        return new Response(JSON.stringify([{ boundingbox: ["27.8", "28.2", "-82.7", "-82.3"] }]), { status: 200 });
      }
      return new Response(JSON.stringify(OVERPASS), { status: 200 });
    }) as unknown as typeof fetch;
    const leads = await discoverLeads({ area: "Tampa, FL", category: "accountant", limit: 5 }, { fetchFn });
    expect(leads).toHaveLength(2);
    expect(urls[0]).toContain("nominatim.openstreetmap.org/search?q=Tampa%2C+FL");
    expect(urls[1]).toContain("overpass-api.de");
  });

  it("falls back to the next Overpass server when the first is busy", async () => {
    const hits: string[] = [];
    const fetchFn = (async (url: string) => {
      hits.push(new URL(url).hostname);
      if (url.includes("nominatim")) return new Response(JSON.stringify([{ boundingbox: ["27.8", "28.2", "-82.7", "-82.3"] }]), { status: 200 });
      if (url.includes("overpass-api.de")) return new Response("busy", { status: 429 });
      return new Response(JSON.stringify(OVERPASS), { status: 200 });
    }) as unknown as typeof fetch;
    const leads = await discoverLeads({ area: "Tampa, FL", category: "accountant" }, { fetchFn });
    expect(leads).toHaveLength(2);
    expect(hits).toEqual(["nominatim.openstreetmap.org", "overpass-api.de", "overpass.kumi.systems"]);
  });

  it("rejects unknown categories and unknown areas", async () => {
    await expect(discoverLeads({ area: "x", category: "nope" })).rejects.toThrow(/Unknown category/);
    const fetchFn = (async () => new Response("[]", { status: 200 })) as unknown as typeof fetch;
    await expect(discoverLeads({ area: "Atlantis", category: "lawyer" }, { fetchFn })).rejects.toThrow(/Could not find area/);
  });
});
