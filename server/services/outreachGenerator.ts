/**
 * Outreach Message Generator Service
 * Uses LLM to generate personalized outreach messages following Hook + Value Gap + Offer structure
 */

import { invokeLLM } from "../_core/llm";
import type { WebsiteAuditResult } from "./websiteEvaluator";

export interface GeneratedOutreach {
  hook: string;
  valueGap: string;
  offer: string;
  fullMessage: string;
  wordCount: number;
  channel: "WhatsApp" | "Instagram" | "Email";
}

/**
 * Generates personalized outreach message based on audit findings
 * Structure: Hook (acknowledgment) + Value Gap (specific issue) + Offer (solution)
 * Constraint: Must stay under 150 words
 */
export async function generateOutreachMessage(
  businessName: string,
  industry: string,
  googleRating: string | null | undefined,
  auditFindings: WebsiteAuditResult,
  channel: "WhatsApp" | "Instagram" | "Email"
): Promise<GeneratedOutreach> {
  // Prepare audit summary for LLM
  const auditSummary = auditFindings.findings
    .map(f => `${f.issue} (${f.severity}): ${f.description}`)
    .join("\n");

  const topSuggestion = auditFindings.suggestions[0];

  // Create channel-specific instructions
  const channelInstructions = {
    WhatsApp: "Keep it conversational and friendly. Use line breaks for readability.",
    Instagram: "Keep it engaging and concise. Use relevant emojis sparingly.",
    Email: "Keep it professional and formal.",
  };

  const systemPrompt = `You are an expert digital business consultant and copywriter. Your task is to generate a personalized, non-intrusive outreach message for a business.

The message MUST follow this exact structure:
1. HOOK (1-2 sentences): Acknowledge their positive reputation or business
2. VALUE GAP (1-2 sentences): Point out a specific, fixable issue from the website audit
3. OFFER (1-2 sentences): Offer a free, no-obligation solution

CRITICAL CONSTRAINTS:
- Total message must be UNDER 150 words
- Do NOT use generic buzzwords
- Focus on tangible ROI for the business owner
- ${channelInstructions[channel]}
- Be helpful, not salesy
- Do NOT include any salutation or signature

Output format:
HOOK: [hook text]
VALUE_GAP: [value gap text]
OFFER: [offer text]`;

  const userPrompt = `Generate an outreach message for:
Business: ${businessName}
Industry: ${industry}
Google Rating: ${googleRating || "Not provided"}
Channel: ${channel}

Website Audit Findings:
${auditSummary}

Top Suggestion: ${topSuggestion?.suggestion || "Improve website"}

Generate a personalized, professional outreach message following the Hook + Value Gap + Offer structure.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const contentArray = response.choices[0]?.message.content;
    const content = typeof contentArray === "string" ? contentArray : "";

    // Parse the response
    const hookMatch = content.match(/HOOK:\s*([\s\S]*?)(?=VALUE_GAP:|$)/);
    const valueGapMatch = content.match(/VALUE_GAP:\s*([\s\S]*?)(?=OFFER:|$)/);
    const offerMatch = content.match(/OFFER:\s*([\s\S]*?)$/);

    const hook = hookMatch?.[1]?.trim() ?? "";
    const valueGap = valueGapMatch?.[1]?.trim() ?? "";
    const offer = offerMatch?.[1]?.trim() ?? "";

    const fullMessage = `${hook} ${valueGap} ${offer}`.trim();
    const wordCount = fullMessage.split(/\s+/).length;

    // Ensure word count is under 150
    if (wordCount > 150) {
      // Truncate if necessary
      const words = fullMessage.split(/\s+/);
      const truncated = words.slice(0, 150).join(" ");
      return {
        hook,
        valueGap,
        offer,
        fullMessage: truncated,
        wordCount: 150,
        channel,
      };
    }

    return {
      hook,
      valueGap,
      offer,
      fullMessage,
      wordCount,
      channel,
    };
  } catch (error) {
    console.error("Error generating outreach message:", error);
    throw new Error("Failed to generate outreach message");
  }
}

/**
 * Generates outreach messages for multiple channels
 */
export async function generateMultiChannelOutreach(
  businessName: string,
  industry: string,
  googleRating: string | null | undefined,
  auditFindings: WebsiteAuditResult
): Promise<GeneratedOutreach[]> {
  const channels: Array<"WhatsApp" | "Instagram" | "Email"> = ["WhatsApp", "Instagram", "Email"];

  const messages = await Promise.all(
    channels.map(channel =>
      generateOutreachMessage(businessName, industry, googleRating, auditFindings, channel)
    )
  );

  return messages;
}
