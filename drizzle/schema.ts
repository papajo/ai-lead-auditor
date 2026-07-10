import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Leads table: stores business information for outreach
 */
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  businessName: varchar("businessName", { length: 255 }).notNull(),
  industry: varchar("industry", { length: 128 }).notNull(),
  websiteUrl: varchar("websiteUrl", { length: 512 }).notNull(),
  googleRating: decimal("googleRating", { precision: 3, scale: 2 }),
  googleReviews: int("googleReviews"),
  status: mysqlEnum("status", ["New", "Contacted", "Responded", "Converted"]).default("New").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

/**
 * Audits table: stores website health evaluation results
 */
export const audits = mysqlTable("audits", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  mobileResponsive: text("mobileResponsive"), // "pass", "fail", or description
  ctaClarity: text("ctaClarity"),
  testimonials: text("testimonials"),
  brokenAssets: text("brokenAssets"),
  overallScore: int("overallScore"), // 0-100
  findings: json("findings"), // JSON array of findings with severity
  suggestions: json("suggestions"), // JSON array of actionable suggestions
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Audit = typeof audits.$inferSelect;
export type InsertAudit = typeof audits.$inferInsert;

/**
 * Outreach messages table: stores generated messages for leads
 */
export const outreachMessages = mysqlTable("outreachMessages", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  channel: mysqlEnum("channel", ["WhatsApp", "Instagram", "Email"]).notNull(),
  hook: text("hook").notNull(),
  valueGap: text("valueGap").notNull(),
  offer: text("offer").notNull(),
  fullMessage: text("fullMessage").notNull(),
  wordCount: int("wordCount").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OutreachMessage = typeof outreachMessages.$inferSelect;
export type InsertOutreachMessage = typeof outreachMessages.$inferInsert;

/**
 * Status history table: tracks status changes with timestamps
 */
export const statusHistory = mysqlTable("statusHistory", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  previousStatus: mysqlEnum("previousStatus", ["New", "Contacted", "Responded", "Converted"]),
  newStatus: mysqlEnum("newStatus", ["New", "Contacted", "Responded", "Converted"]).notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
});

export type StatusHistory = typeof statusHistory.$inferSelect;
export type InsertStatusHistory = typeof statusHistory.$inferInsert;