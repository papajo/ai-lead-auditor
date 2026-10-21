/**
 * Lead discovery from OpenStreetMap — free, no API key.
 *
 * 1. Geocode the area with Nominatim (bounding box).
 * 2. Query Overpass for businesses of the chosen category inside that box
 *    that list a website.
 *
 * Usage policies: Nominatim allows max 1 request/second and requires an
 * identifying User-Agent; Overpass is a shared public service — keep queries
 * small. OSM data is © OpenStreetMap contributors (ODbL): attribute it.
 *
 * Env (optional): NOMINATIM_URL, OVERPASS_URL (comma-separated, tried in order), OSM_CONTACT (email for the UA).
 */

export const CATEGORIES: Record<string, { label: string; tags: Array<[string, string]> }> = {
  accountant: { label: "Accountants", tags: [["office", "accountant"], ["office", "tax_advisor"]] },
  lawyer: { label: "Law firms", tags: [["office", "lawyer"]] },
  dentist: { label: "Dentists", tags: [["amenity", "dentist"], ["healthcare", "dentist"]] },
  clinic: { label: "Clinics & doctors", tags: [["amenity", "clinic"], ["amenity", "doctors"], ["healthcare", "clinic"]] },
  physiotherapist: { label: "Physiotherapists", tags: [["healthcare", "physiotherapist"]] },
  veterinary: { label: "Veterinarians", tags: [["amenity", "veterinary"]] },
  real_estate: { label: "Real estate agents", tags: [["office", "estate_agent"]] },
  insurance: { label: "Insurance agents", tags: [["office", "insurance"]] },
  financial: { label: "Financial advisors", tags: [["office", "financial"], ["office", "financial_advisor"]] },
  consulting: { label: "Consultancies", tags: [["office", "consulting"]] },
  plumber: { label: "Plumbers", tags: [["craft", "plumber"]] },
  electrician: { label: "Electricians", tags: [["craft", "electrician"]] },
  hvac: { label: "HVAC", tags: [["craft", "hvac"]] },
  roofer: { label: "Roofers", tags: [["craft", "roofer"]] },
  car_repair: { label: "Auto repair", tags: [["shop", "car_repair"]] },
  salon: { label: "Hair & beauty salons", tags: [["shop", "hairdresser"], ["shop", "beauty"]] },
  gym: { label: "Gyms & studios", tags: [["leisure", "fitness_centre"]] },
  restaurant: { label: "Restaurants", tags: [["amenity", "restaurant"]] },
  cafe: { label: "Cafés", tags: [["amenity", "cafe"]] },
  hotel: { label: "Hotels", tags: [["tourism", "hotel"], ["tourism", "guest_house"]] },
};

export interface DiscoveredLead {
  businessName: string;
  industry: string;
  websiteUrl: string;
  phone: string | null;
  address: string | null;
  osmId: string;
}

export interface DiscoverOptions {
  area: string;
  category: keyof typeof CATEGORIES | string;
  limit?: number;
}

export interface DiscoveryDeps {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const userAgent = () =>
  `AILeadAuditor/1.0 (+https://github.com/papajo/ai-lead-auditor${process.env.OSM_CONTACT ? `; ${process.env.OSM_CONTACT}` : ""})`;

async function getJson(fetchFn: typeof fetch, url: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "user-agent": userAgent(), accept: "application/json", ...(init.headers || {}) },
    });
    if (!res.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export function normalizeWebsite(raw: string | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(/[;\s]+/)[0].trim();
  if (!first) return null;
  try {
    if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(first) && !/^https?:\/\//i.test(first)) return null;
    const u = new URL(/^https?:\/\//i.test(first) ? first : `https://${first}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

export function buildOverpassQuery(bbox: [number, number, number, number], tags: Array<[string, string]>, limit: number): string {
  const [s, w, n, e] = bbox;
  const box = `${s},${w},${n},${e}`;
  const parts = tags.flatMap(([k, v]) => [
    `nwr["${k}"="${v}"]["website"](${box});`,
    `nwr["${k}"="${v}"]["contact:website"](${box});`,
  ]);
  return `[out:json][timeout:25];(${parts.join("")});out tags center ${Math.max(limit * 3, 30)};`;
}

export function parseOverpass(json: any, industry: string, limit: number): DiscoveredLead[] {
  const seen = new Set<string>();
  const out: DiscoveredLead[] = [];
  for (const el of json?.elements ?? []) {
    const t = el.tags ?? {};
    const name: string | undefined = t.name || t.brand;
    const websiteUrl = normalizeWebsite(t.website || t["contact:website"]);
    if (!name || !websiteUrl) continue;
    const key = new URL(websiteUrl).hostname.replace(/^www\./, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    const address = [street, t["addr:city"], t["addr:postcode"]].filter(Boolean).join(", ") || null;
    out.push({
      businessName: name,
      industry,
      websiteUrl,
      phone: t.phone || t["contact:phone"] || null,
      address,
      osmId: `${el.type}/${el.id}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function discoverLeads(opts: DiscoverOptions, deps: DiscoveryDeps = {}): Promise<DiscoveredLead[]> {
  const fetchFn = deps.fetchFn ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 30000;
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const cat = CATEGORIES[opts.category];
  if (!cat) throw new Error(`Unknown category "${opts.category}"`);
  if (!opts.area.trim()) throw new Error("Area is required");

  const nominatim = process.env.NOMINATIM_URL || "https://nominatim.openstreetmap.org";
  const geo = await getJson(
    fetchFn,
    `${nominatim}/search?${new URLSearchParams({ q: opts.area, format: "jsonv2", limit: "1" })}`,
    {},
    timeoutMs,
  );
  const hit = Array.isArray(geo) ? geo[0] : undefined;
  if (!hit?.boundingbox) throw new Error(`Could not find area "${opts.area}"`);
  // Nominatim bbox order: [south, north, west, east]
  const [s, n, w, e] = hit.boundingbox.map(Number);
  // Cap very large areas (e.g. a whole state) to keep Overpass queries polite.
  const maxSpan = 0.6;
  const lat = (s + n) / 2;
  const lon = (w + e) / 2;
  const bbox: [number, number, number, number] = [
    Math.max(s, lat - maxSpan / 2),
    Math.max(w, lon - maxSpan / 2),
    Math.min(n, lat + maxSpan / 2),
    Math.min(e, lon + maxSpan / 2),
  ];

  // Public Overpass servers are often busy (429/504); try each until one answers.
  const endpoints = (process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter")
    .split(",")
    .map(u => u.trim())
    .filter(Boolean);
  const body = new URLSearchParams({ data: buildOverpassQuery(bbox, cat.tags, limit) }).toString();
  const errors: string[] = [];
  let json: any;
  for (const endpoint of endpoints) {
    try {
      json = await getJson(
        fetchFn,
        endpoint,
        { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body },
        timeoutMs,
      );
      break;
    } catch (e) {
      errors.push(`${new URL(endpoint).hostname}: ${(e as Error).message}`);
    }
  }
  if (json === undefined) throw new Error(`OpenStreetMap search unavailable (${errors.join("; ")})`);
  return parseOverpass(json, cat.label, limit);
}
