import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, leads, audits, outreachMessages, statusHistory } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Leads queries
export async function createLead(data: {
  userId: number;
  businessName: string;
  industry: string;
  websiteUrl: string;
  googleRating?: string | null;
  googleReviews?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(leads).values([data]).execute();
  return result;
}

export async function getLeadsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(leads).where(eq(leads.userId, userId)).execute();
  return result;
}

export async function getLeadById(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1).execute();
  return result[0] || null;
}

export async function updateLeadStatus(leadId: number, newStatus: "New" | "Contacted" | "Responded" | "Converted") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get current status
  const lead = await getLeadById(leadId);
  if (!lead) throw new Error("Lead not found");
  
  // Update lead status
  await db.update(leads).set({ status: newStatus }).where(eq(leads.id, leadId)).execute();
  
  // Record status history
  await db.insert(statusHistory).values({
    leadId,
    previousStatus: lead.status as any,
    newStatus,
  }).execute();
}

export async function createAudit(data: {
  leadId: number;
  mobileResponsive?: string | null;
  ctaClarity?: string | null;
  testimonials?: string | null;
  brokenAssets?: string | null;
  overallScore?: number | null;
  findings?: any;
  suggestions?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(audits).values(data).execute();
  return result;
}

export async function getAuditByLeadId(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(audits).where(eq(audits.leadId, leadId)).limit(1).execute();
  return result[0] || null;
}

export async function createOutreachMessage(data: {
  leadId: number;
  channel: "WhatsApp" | "Instagram" | "Email";
  hook: string;
  valueGap: string;
  offer: string;
  fullMessage: string;
  wordCount: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(outreachMessages).values(data).execute();
  return result;
}

export async function getOutreachMessagesByLeadId(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(outreachMessages).where(eq(outreachMessages.leadId, leadId)).execute();
  return result;
}

export async function getStatusHistoryByLeadId(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(statusHistory).where(eq(statusHistory.leadId, leadId)).execute();
  return result;
}

export async function updateLead(
  leadId: number,
  data: Partial<{
    businessName: string;
    industry: string;
    websiteUrl: string;
    googleRating: string | null;
    googleReviews: number | null;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.update(leads).set(data).where(eq(leads.id, leadId)).execute();
  return result;
}

export async function deleteLead(leadId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete related records first
  await db.delete(statusHistory).where(eq(statusHistory.leadId, leadId)).execute();
  await db.delete(outreachMessages).where(eq(outreachMessages.leadId, leadId)).execute();
  await db.delete(audits).where(eq(audits.leadId, leadId)).execute();

  // Delete the lead
  const result = await db.delete(leads).where(eq(leads.id, leadId)).execute();
  return result;
}
