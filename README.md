# AI Lead Auditor

**Track local-business leads, audit their websites, and draft outreach grounded in what the audit found.**

Freelancers and small agencies find clients by hand. They list businesses, click through websites one by one, and rewrite the same first message dozens of times. AI Lead Auditor puts that pipeline in one app: a lead list with status tracking, a website health check per lead, and an AI-drafted message built from that lead's specific findings.

### What it does
- **Lead discovery (free):** search a city/area by category (accountants, law firms, dentists, clinics, trades, salons and more) using OpenStreetMap, which needs no API key. Businesses that list a website appear with phone and address, and you pick which ones to import
- **Lead management:** add leads by hand or import them (business name, industry, URL, Google rating) and track them through *New → Contacted → Responded → Converted*, with a timestamped status history
- **Website health audit** of the live page, four checks: mobile responsiveness, CTA clarity, testimonials/social proof, and broken assets. Each lead gets a 0–100 score, findings by severity, and suggested fixes
- **Outreach drafts** for WhatsApp, Instagram or email, written by an LLM in a *Hook → Value Gap → Offer* structure, kept under 150 words, and grounded in that lead's audit findings
- **Dashboard:** total leads, audits completed, messages generated, conversion rate; bulk export of selected leads

> **How the audit works:** `server/services/websiteEvaluator.ts` fetches the live page and checks for a responsive viewport tag, action-worded buttons/links and contact paths (tel/mailto/forms), testimonial/review/rating signals (including schema.org `Review`/`AggregateRating`), and broken images/scripts/stylesheets (up to 25, checked with HEAD then GET). Results are deterministic. 401/403/429 responses count as inconclusive, not broken. Private/internal addresses are refused.

> **How discovery works:** `server/services/leadDiscovery.ts` geocodes the area with Nominatim, then asks Overpass for businesses of that category that have a `website` tag. Results are deduplicated by domain and flagged if already imported. Coverage depends on OpenStreetMap, so it's good in most cities but not complete. Respect the public servers' usage policies (Nominatim: max 1 request/s). Data © OpenStreetMap contributors, ODbL.

> **LLM fallback:** outreach drafts use the configured OpenAI-compatible endpoint. If it's missing or fails, the same request goes to **Groq** (`GROQ_API_KEY`, default `openai/gpt-oss-120b`).

### Tech stack
TypeScript · React 19 · Vite · tRPC · Express · Drizzle ORM (MySQL) · Tailwind CSS / Radix UI · Vitest

### Run it locally
```bash
pnpm install
# env: DATABASE_URL (MySQL), plus the OAuth and LLM endpoint variables read in server/_core/env.ts
# optional: GROQ_API_KEY (LLM fallback), OSM_CONTACT (email for the OpenStreetMap User-Agent), OVERPASS_URL (comma-separated servers, tried in order)
pnpm db:push
pnpm dev
pnpm test
```
Scaffolded from a Manus full-stack template. Auth and LLM calls go through that platform's OAuth and an OpenAI-compatible endpoint (`server/_core/llm.ts`), so running it outside Manus means pointing those variables at your own services.

### Responsible use
The tool drafts messages for a human to review. It is not a bulk sender. Only audit and contact businesses in line with each site's terms and anti-spam law (e.g. CAN-SPAM, and platform rules for WhatsApp/Instagram).
