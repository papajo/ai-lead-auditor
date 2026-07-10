import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  createLead,
  getLeadsByUserId,
  getLeadById,
  updateLeadStatus,
  updateLead,
  deleteLead,
  createAudit,
  getAuditByLeadId,
  createOutreachMessage,
  getOutreachMessagesByLeadId,
  getStatusHistoryByLeadId,
} from "./db";
import { evaluateWebsite } from "./services/websiteEvaluator";
import { generateOutreachMessage } from "./services/outreachGenerator";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Lead management procedures
  leads: router({
    create: protectedProcedure
      .input(
        z.object({
          businessName: z.string().min(1),
          industry: z.string().min(1),
          websiteUrl: z.string().url(),
          googleRating: z.string().optional().nullable(),
          googleReviews: z.number().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return await createLead({
          userId: ctx.user.id,
          businessName: input.businessName,
          industry: input.industry,
          websiteUrl: input.websiteUrl,
          googleRating: input.googleRating,
          googleReviews: input.googleReviews,
        });
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      return await getLeadsByUserId(ctx.user.id);
    }),

    getById: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (lead && lead.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }
        return lead;
      }),

    update: protectedProcedure
      .input(
        z.object({
          leadId: z.number(),
          businessName: z.string().optional(),
          industry: z.string().optional(),
          websiteUrl: z.string().url().optional(),
          googleRating: z.string().optional().nullable(),
          googleReviews: z.number().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead || lead.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }
        const { leadId, ...updateData } = input;
        await updateLead(leadId, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead || lead.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }
        await deleteLead(input.leadId);
        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          leadId: z.number(),
          status: z.enum(["New", "Contacted", "Responded", "Converted"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead || lead.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }
        await updateLeadStatus(input.leadId, input.status);
        return { success: true };
      }),
  }),

  // Audit procedures
  audits: router({
    create: protectedProcedure
      .input(
        z.object({
          leadId: z.number(),
          mobileResponsive: z.string().optional().nullable(),
          ctaClarity: z.string().optional().nullable(),
          testimonials: z.string().optional().nullable(),
          brokenAssets: z.string().optional().nullable(),
          overallScore: z.number().optional().nullable(),
          findings: z.any().optional(),
          suggestions: z.any().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead || lead.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }
        return await createAudit(input);
      }),

    getByLeadId: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead || lead.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }
        return await getAuditByLeadId(input.leadId);
      }),
  }),

  // Outreach message procedures
  outreachMessages: router({
    create: protectedProcedure
      .input(
        z.object({
          leadId: z.number(),
          channel: z.enum(["WhatsApp", "Instagram", "Email"]),
          hook: z.string(),
          valueGap: z.string(),
          offer: z.string(),
          fullMessage: z.string(),
          wordCount: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead || lead.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }
        return await createOutreachMessage(input);
      }),

    getByLeadId: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead || lead.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }
        return await getOutreachMessagesByLeadId(input.leadId);
      }),
  }),

  // Status history procedures
  statusHistory: router({
    getByLeadId: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .query(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead || lead.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }
        return await getStatusHistoryByLeadId(input.leadId);
      }),
  }),

  // Website evaluation and outreach generation
  evaluation: router({
    auditWebsite: protectedProcedure
      .input(z.object({ leadId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead || lead.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        // Evaluate the website
        const auditResult = await evaluateWebsite(lead.websiteUrl);

        // Save audit to database
        await createAudit({
          leadId: input.leadId,
          mobileResponsive: auditResult.mobileResponsive.status,
          ctaClarity: auditResult.ctaClarity.status,
          testimonials: auditResult.testimonials.status,
          brokenAssets: auditResult.brokenAssets.status,
          overallScore: auditResult.overallScore,
          findings: auditResult.findings,
          suggestions: auditResult.suggestions,
        });

        return auditResult;
      }),

    generateOutreach: protectedProcedure
      .input(
        z.object({
          leadId: z.number(),
          channel: z.enum(["WhatsApp", "Instagram", "Email"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const lead = await getLeadById(input.leadId);
        if (!lead || lead.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        // Get the audit for this lead
        const audit = await getAuditByLeadId(input.leadId);
        if (!audit) {
          throw new Error("No audit found for this lead. Please run the audit first.");
        }

        // Convert audit data back to WebsiteAuditResult format
        const auditResult = {
          mobileResponsive: {
            status: (audit.mobileResponsive as "pass" | "fail" | "unknown") || "unknown",
            description: "",
          },
          ctaClarity: {
            status: (audit.ctaClarity as "pass" | "fail" | "unknown") || "unknown",
            description: "",
          },
          testimonials: {
            status: (audit.testimonials as "pass" | "fail" | "unknown") || "unknown",
            description: "",
          },
          brokenAssets: {
            status: (audit.brokenAssets as "pass" | "fail" | "unknown") || "unknown",
            description: "",
          },
          overallScore: audit.overallScore || 0,
          findings: (audit.findings as any) || [],
          suggestions: (audit.suggestions as any) || [],
        };

        // Generate outreach message
        const message = await generateOutreachMessage(
          lead.businessName,
          lead.industry,
          lead.googleRating?.toString(),
          auditResult,
          input.channel
        );

        // Save message to database
        await createOutreachMessage({
          leadId: input.leadId,
          channel: input.channel,
          hook: message.hook,
          valueGap: message.valueGap,
          offer: message.offer,
          fullMessage: message.fullMessage,
          wordCount: message.wordCount,
        });

        return message;
      }),
  }),
});

export type AppRouter = typeof appRouter;
