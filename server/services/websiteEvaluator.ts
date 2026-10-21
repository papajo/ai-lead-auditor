/**
 * Website Health Evaluator Service
 * Fetches a page and runs four checks: mobile responsiveness, CTA clarity,
 * testimonials / social proof, and broken assets.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

type Status = "pass" | "fail" | "unknown";
type Severity = "high" | "medium" | "low";

export interface WebsiteAuditResult {
  mobileResponsive: { status: Status; description: string };
  ctaClarity: { status: Status; description: string };
  testimonials: { status: Status; description: string };
  brokenAssets: { status: Status; description: string };
  overallScore: number; // 0-100
  findings: Array<{ issue: string; severity: Severity; description: string }>;
  suggestions: Array<{ suggestion: string; priority: Severity; impact: string }>;
}

export interface EvaluatorDeps {
  fetchFn?: typeof fetch;
  /** Skip the private-network guard (tests only). */
  allowPrivateHosts?: boolean;
  pageTimeoutMs?: number;
  assetTimeoutMs?: number;
  maxAssets?: number;
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; AILeadAuditor/1.0; +https://github.com/papajo/ai-lead-auditor)";

const CTA_WORDS = [
  "book", "schedule", "call", "contact", "get a quote", "get quote", "free quote",
  "request", "buy", "shop", "order", "sign up", "signup", "subscribe", "get started",
  "start", "reserve", "appointment", "consultation", "enquire", "inquire", "donate",
  "join", "apply", "download", "try", "hire", "estimate",
];

const SOCIAL_PROOF_PATTERNS = [
  /testimonial/i,
  /\breviews?\b/i,
  /what (our|my) (clients|customers|patients) say/i,
  /case stud(y|ies)/i,
  /trusted by/i,
  /\b\d(\.\d)?\s*(\/\s*5|out of 5|stars?)\b/i,
  /★{3,}/,
  /"@type"\s*:\s*"(Review|AggregateRating)"/i,
  /itemprop=["'](review|aggregateRating)["']/i,
  /(google|yelp|trustpilot|facebook)\s+reviews?/i,
];

// ───────────────────────── pure HTML analysis ─────────────────────────

export interface HtmlAnalysis {
  hasViewport: boolean;
  viewportScalable: boolean;
  hasMediaQueries: boolean;
  ctaCount: number;
  ctaExamples: string[];
  hasTelOrMailto: boolean;
  hasForm: boolean;
  socialProofSignals: string[];
  assetUrls: string[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

const all = (re: RegExp, s: string): RegExpExecArray[] => Array.from(s.matchAll(re));

const CTA_RE = new RegExp(`\\b(${CTA_WORDS.map(w => w.replace(/\s+/g, "\\s+")).join("|")})\\b`, "i");

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  const v = m ? (m[2] ?? m[3] ?? m[4]) : undefined;
  return v === undefined ? undefined : decodeEntities(v);
}

export function analyzeHtml(html: string, baseUrl: string): HtmlAnalysis {
  const metaViewport = (html.match(/<meta[^>]+name\s*=\s*["']?viewport["']?[^>]*>/i) || [])[0];
  const viewportContent = metaViewport ? (attr(metaViewport, "content") || "").toLowerCase() : "";
  const hasViewport = viewportContent.includes("width=device-width");
  const viewportScalable = !/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(viewportContent);
  const hasMediaQueries = /@media[^{]*(max|min)-width/i.test(html) || /<link[^>]+media\s*=\s*["'][^"']*width/i.test(html);

  // CTAs: buttons, links styled as buttons, and links with action words
  const ctaExamples: string[] = [];
  const candidates = [
    ...all(/<button\b[^>]*>([\s\S]*?)<\/button>/gi, html),
    ...all(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, html),
    ...all(/<input\b[^>]*type\s*=\s*["']?submit[^>]*>/gi, html),
  ];
  for (const m of candidates) {
    const raw = m[0];
    const text = (m[1] !== undefined ? stripTags(m[1]) : attr(raw, "value") || "").toLowerCase();
    if (!text || text.length > 60) continue;
    if (CTA_RE.test(text)) {
      if (!ctaExamples.includes(text)) ctaExamples.push(text);
    }
  }
  const hasTelOrMailto = /href\s*=\s*["'](tel:|mailto:)/i.test(html);
  const hasForm = /<form\b/i.test(html);

  const visibleText = stripTags(html.replace(/<script\b(?![^>]*ld\+json)[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " "));
  const socialProofSignals = SOCIAL_PROOF_PATTERNS
    .filter(p => p.test(html) || p.test(visibleText))
    .map(p => p.source);

  // Assets: images, scripts, stylesheets (same-origin and third-party)
  const assetUrls = new Set<string>();
  const add = (u?: string) => {
    if (!u || u.startsWith("data:") || u.startsWith("#") || u.startsWith("javascript:")) return;
    try {
      const abs = new URL(u, baseUrl);
      if (abs.protocol === "http:" || abs.protocol === "https:") assetUrls.add(abs.href);
    } catch {
      /* ignore malformed */
    }
  };
  for (const m of all(/<img\b[^>]*>/gi, html)) add(attr(m[0], "src"));
  for (const m of all(/<script\b[^>]*\bsrc\s*=[^>]*>/gi, html)) add(attr(m[0], "src"));
  for (const m of all(/<link\b[^>]*>/gi, html)) {
    if (/rel\s*=\s*["']?stylesheet/i.test(m[0])) add(attr(m[0], "href"));
  }

  return {
    hasViewport,
    viewportScalable,
    hasMediaQueries,
    ctaCount: ctaExamples.length,
    ctaExamples: ctaExamples.slice(0, 5),
    hasTelOrMailto,
    hasForm,
    socialProofSignals,
    assetUrls: Array.from(assetUrls),
  };
}

// ───────────────────────── network helpers ─────────────────────────

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:127.");
}

async function assertPublicHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Refusing to audit a local/internal host");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.some(a => isPrivateAddress(a.address))) {
    throw new Error("Refusing to audit a private network address");
  }
}

async function timedFetch(fetchFn: typeof fetch, url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetchFn(url, { ...init, signal: ctrl.signal, headers: { "user-agent": USER_AGENT, ...(init.headers || {}) } });
  } finally {
    clearTimeout(t);
  }
}

async function checkAsset(fetchFn: typeof fetch, url: string, ms: number): Promise<number | "error"> {
  try {
    let res = await timedFetch(fetchFn, url, { method: "HEAD", redirect: "follow" }, ms);
    if (res.status === 405 || res.status === 403 || res.status === 501) {
      res = await timedFetch(fetchFn, url, { method: "GET", redirect: "follow", headers: { range: "bytes=0-0" } }, ms);
    }
    return res.status;
  } catch {
    return "error";
  }
}

// ───────────────────────── evaluator ─────────────────────────

function unknownResult(reason: string, url: string): WebsiteAuditResult {
  const u = { status: "unknown" as const, description: reason };
  return {
    mobileResponsive: u,
    ctaClarity: u,
    testimonials: u,
    brokenAssets: u,
    overallScore: 0,
    findings: [{ issue: "Site Unreachable", severity: "high", description: `Unable to evaluate ${url}: ${reason}` }],
    suggestions: [{ suggestion: "Verify the website URL is correct and publicly accessible", priority: "high", impact: "Enables proper website analysis" }],
  };
}

export async function evaluateWebsite(url: string, deps: EvaluatorDeps = {}): Promise<WebsiteAuditResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const pageTimeoutMs = deps.pageTimeoutMs ?? 12000;
  const assetTimeoutMs = deps.assetTimeoutMs ?? 6000;
  const maxAssets = deps.maxAssets ?? 25;

  let target: URL;
  try {
    target = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`);
    if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("bad protocol");
  } catch {
    return unknownResult("invalid URL format", url);
  }

  let html: string;
  let finalUrl = target.href;
  try {
    if (!deps.allowPrivateHosts) await assertPublicHost(target);
    const res = await timedFetch(fetchFn, target.href, { redirect: "follow" }, pageTimeoutMs);
    if (!res.ok) return unknownResult(`page returned HTTP ${res.status}`, url);
    finalUrl = res.url || target.href;
    if (!deps.allowPrivateHosts && finalUrl !== target.href) await assertPublicHost(new URL(finalUrl));
    html = (await res.text()).slice(0, 2_000_000);
  } catch (e) {
    return unknownResult(e instanceof Error ? e.message : "fetch failed", url);
  }

  const a = analyzeHtml(html, finalUrl);
  const findings: WebsiteAuditResult["findings"] = [];
  const suggestions: WebsiteAuditResult["suggestions"] = [];
  let score = 100;

  // 1. Mobile responsiveness
  const mobilePass = a.hasViewport;
  if (!mobilePass) {
    findings.push({
      issue: "Mobile Responsiveness",
      severity: "high",
      description: "No `width=device-width` viewport meta tag — the page will render as a zoomed-out desktop layout on phones.",
    });
    suggestions.push({ suggestion: "Add a responsive viewport meta tag and mobile-first CSS", priority: "high", impact: "Most local-business traffic is mobile" });
    score -= 25;
  } else if (!a.viewportScalable) {
    findings.push({ issue: "Zoom Disabled", severity: "low", description: "Viewport disables pinch-zoom, which hurts accessibility." });
    suggestions.push({ suggestion: "Remove user-scalable=no / maximum-scale=1 from the viewport tag", priority: "low", impact: "Accessibility for low-vision visitors" });
    score -= 5;
  }

  // 2. CTA clarity
  const ctaPass = a.ctaCount > 0 || (a.hasForm && a.hasTelOrMailto);
  if (!ctaPass) {
    findings.push({
      issue: "Weak Call-to-Action",
      severity: "high",
      description: `No clear action buttons or links found (e.g. "Book", "Call", "Get a quote")${a.hasTelOrMailto ? "; only a phone/email link" : ""}.`,
    });
    suggestions.push({ suggestion: "Add a prominent, action-worded button above the fold", priority: "high", impact: "Turns visits into enquiries" });
    score -= 20;
  } else if (!a.hasTelOrMailto && !a.hasForm) {
    findings.push({ issue: "No Direct Contact Path", severity: "low", description: "No tap-to-call, email link or contact form on the page." });
    suggestions.push({ suggestion: "Add a tap-to-call link and a short contact form", priority: "medium", impact: "Removes friction for ready-to-buy visitors" });
    score -= 5;
  }

  // 3. Social proof
  const proofPass = a.socialProofSignals.length > 0;
  if (!proofPass) {
    findings.push({ issue: "Missing Social Proof", severity: "medium", description: "No testimonials, reviews, ratings or case studies detected on the page." });
    suggestions.push({ suggestion: "Add customer testimonials or embed review ratings", priority: "medium", impact: "Builds trust with first-time visitors" });
    score -= 15;
  }

  // 4. Broken assets
  const toCheck = a.assetUrls.slice(0, maxAssets);
  const statuses = await Promise.all(toCheck.map(u => checkAsset(fetchFn, u, assetTimeoutMs)));
  // 401/403/429 usually mean bot-blocking or auth, not a broken link — don't count them.
  const isBroken = (s: number | "error") => s === "error" || s === 404 || s === 410 || s >= 500;
  const broken = toCheck.filter((_, i) => isBroken(statuses[i]));
  const assetsPass = broken.length === 0;
  if (!assetsPass) {
    findings.push({
      issue: "Broken Assets Detected",
      severity: broken.length >= 3 ? "high" : "medium",
      description: `${broken.length} of ${toCheck.length} checked images/scripts/stylesheets failed to load: ${broken.slice(0, 3).join(", ")}${broken.length > 3 ? " …" : ""}`,
    });
    suggestions.push({ suggestion: "Fix or remove the broken image, script and stylesheet links", priority: "medium", impact: "Prevents missing images and broken layout" });
    score -= Math.min(20, 5 * broken.length);
  }

  return {
    mobileResponsive: {
      status: mobilePass ? "pass" : "fail",
      description: mobilePass ? "Responsive viewport tag present" + (a.hasMediaQueries ? " with responsive CSS" : "") : "Missing responsive viewport tag",
    },
    ctaClarity: {
      status: ctaPass ? "pass" : "fail",
      description: ctaPass
        ? `Calls-to-action found${a.ctaExamples.length ? `: ${a.ctaExamples.map(t => `"${t}"`).join(", ")}` : ""}`
        : "No clear calls-to-action found",
    },
    testimonials: {
      status: proofPass ? "pass" : "fail",
      description: proofPass ? "Social proof detected (reviews / testimonials / ratings)" : "No testimonials or reviews detected",
    },
    brokenAssets: {
      status: toCheck.length === 0 ? "unknown" : assetsPass ? "pass" : "fail",
      description:
        toCheck.length === 0
          ? "No external assets found to check"
          : assetsPass
            ? `All ${toCheck.length} checked assets load`
            : `${broken.length} of ${toCheck.length} checked assets are broken`,
    },
    overallScore: Math.max(0, score),
    findings,
    suggestions,
  };
}
