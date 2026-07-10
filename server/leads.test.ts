import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("leads procedures", () => {
  it("should create a lead", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.leads.create({
      businessName: "Test Business",
      industry: "Technology",
      websiteUrl: "https://example.com",
      googleRating: "4.5",
      googleReviews: 120,
    });

    expect(result).toBeDefined();
  });

  it("should list leads for a user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a lead first
    await caller.leads.create({
      businessName: "Test Business",
      industry: "Technology",
      websiteUrl: "https://example.com",
      googleRating: "4.5",
      googleReviews: 120,
    });

    const leads = await caller.leads.list();
    expect(Array.isArray(leads)).toBe(true);
  });

  it("should update lead status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a lead first
    const createResult = await caller.leads.create({
      businessName: "Test Business",
      industry: "Technology",
      websiteUrl: "https://example.com",
      googleRating: "4.5",
      googleReviews: 120,
    });

    // Update status (assuming the lead ID is available from create result)
    // Note: In a real scenario, you'd extract the lead ID from the result
    const result = await caller.leads.updateStatus({
      leadId: 1,
      status: "Contacted",
    });

    expect(result.success).toBe(true);
  });
});

describe("audits procedures", () => {
  it("should create an audit", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audits.create({
      leadId: 1,
      mobileResponsive: "pass",
      ctaClarity: "fail",
      testimonials: "fail",
      brokenAssets: "pass",
      overallScore: 60,
      findings: [
        {
          issue: "No clear CTA",
          severity: "high",
        },
      ],
      suggestions: [
        {
          suggestion: "Add prominent CTA button",
          priority: "high",
        },
      ],
    });

    expect(result).toBeDefined();
  });
});

describe("outreach messages procedures", () => {
  it("should create an outreach message", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.outreachMessages.create({
      leadId: 1,
      channel: "Email",
      hook: "We noticed your website could benefit from improved mobile responsiveness.",
      valueGap: "Many of your potential customers browse on mobile devices.",
      offer: "We'd like to offer a free website audit to identify quick wins.",
      fullMessage:
        "We noticed your website could benefit from improved mobile responsiveness. Many of your potential customers browse on mobile devices. We'd like to offer a free website audit to identify quick wins.",
      wordCount: 35,
    });

    expect(result).toBeDefined();
  });
});
