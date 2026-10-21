# CLAUDE.md — ai-lead-auditor

## Stack
- TypeScript, React 19 + Vite (`client/`), Express + tRPC (`server/`), shared types (`shared/`)
- Drizzle ORM on MySQL (`drizzle/`), Vitest, pnpm
- Scaffolded from a Manus template: OAuth + LLM go through `server/_core/` (env in `server/_core/env.ts`)

## Commands
```
pnpm install
pnpm dev          # tsx watch server/_core/index.ts
pnpm test         # vitest run (leads.test.ts needs DATABASE_URL)
pnpm check        # tsc --noEmit
pnpm db:push      # drizzle-kit generate + migrate
```

## Conventions
- Website audit: `server/services/websiteEvaluator.ts`. `analyzeHtml` is pure, and `evaluateWebsite` takes injectable `fetchFn` for tests. Keep it deterministic; never fake results.
- SSRF guard: never fetch private/internal hosts (`allowPrivateHosts` is tests only).
- Outreach: Hook → Value Gap → Offer, < 150 words, grounded in audit findings; human reviews before sending.
- Lead status labels: New, Contacted, Responded, Converted (timestamped history).
