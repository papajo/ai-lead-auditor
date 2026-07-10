# AI Lead Auditor - Project TODO

## Phase 1: Database & Backend Setup
- [x] Create database schema (leads, audits, outreach_messages, status_history tables)
- [x] Create database helper functions in server/db.ts
- [x] Create tRPC procedures for lead management (create, read, update, delete, list)
- [x] Create tRPC procedures for status tracking (update status with timestamp)
- [x] Write vitest tests for database operations

## Phase 2: Website Health Evaluator & LLM Integration
- [x] Implement website health evaluator (mobile responsiveness, CTA clarity, testimonials, broken assets)
- [x] Create tRPC procedure for website audit
- [x] Implement LLM-powered outreach message generator (Hook + Value Gap + Offer structure)
- [x] Create tRPC procedure for message generation
- [x] Write vitest tests for health evaluator and LLM integration

## Phase 3: Frontend - Lead Management Dashboard
- [x] Create lead input form component (business name, industry, URL, Google rating)
- [x] Create leads table with sorting and filtering
- [x] Implement lead status tracking UI (New, Contacted, Responded, Converted)
- [x] Create lead detail panel
- [x] Wire frontend to backend tRPC procedures

## Phase 4: Frontend - Audit Results Panel
- [x] Create audit results display component with severity indicators
- [x] Display identified website weaknesses
- [x] Show actionable fix suggestions
- [x] Integrate with audit tRPC procedure

## Phase 5: Frontend - Outreach Message Generator
- [x] Create message generation UI with channel selection (WhatsApp, Instagram, Email)
- [x] Display generated messages with Hook + Value Gap + Offer structure
- [x] Implement copy-to-clipboard functionality
- [x] Create bulk export feature for selected leads
- [x] Integrate with message generation tRPC procedure

## Phase 6: Frontend - Analytics Dashboard
- [x] Create summary cards (total leads, audits completed, messages generated, conversion rate)
- [x] Implement dashboard layout with analytics widgets
- [x] Wire analytics data from backend

## Phase 7: Polish & Testing
- [x] Refine UI/UX for elegant, polished appearance
- [x] Test end-to-end workflows
- [x] Verify all constraints (message word count, status labels, audit checks)
- [x] Performance optimization
- [x] Create final checkpoint

## Constraints to Verify
- [x] Outreach message structure: Hook + Value Gap + Offer
- [x] Messages must stay under 150 words
- [x] Lead status labels: New, Contacted, Responded, Converted
- [x] Status entries must include timestamps
- [x] Website analysis checks: mobile responsiveness, CTA clarity, testimonials/social proof, broken assets
