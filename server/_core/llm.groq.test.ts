import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeLLM, toGroqPayload } from "./llm";
import { ENV } from "./env";

const okBody = { choices: [{ message: { role: "assistant", content: "HOOK: hi VALUE_GAP: x OFFER: y" } }] };

afterEach(() => {
  delete process.env.GROQ_API_KEY;
  vi.restoreAllMocks();
});

describe("Groq fallback", () => {
  it("uses Groq when the primary key is not configured", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const original = ENV.forgeApiKey;
    (ENV as { forgeApiKey: string }).forgeApiKey = "";
    const calls: Array<{ url: string; body: any; auth: string }> = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), auth: (init.headers as any).authorization });
      return new Response(JSON.stringify(okBody), { status: 200 });
    }) as unknown as typeof fetch;
    try {
      const r = await invokeLLM({ messages: [{ role: "user", content: "hello" }] }, { fetchFn });
      expect(r.choices[0].message.content).toContain("HOOK");
      expect(calls[0].url).toBe("https://api.groq.com/openai/v1/chat/completions");
      expect(calls[0].auth).toBe("Bearer test-key");
      expect(calls[0].body.model).toBe("llama-3.3-70b-versatile");
    } finally {
      (ENV as { forgeApiKey: string }).forgeApiKey = original;
    }
  });

  it("throws when neither provider is configured", async () => {
    const original = ENV.forgeApiKey;
    (ENV as { forgeApiKey: string }).forgeApiKey = "";
    try {
      await expect(invokeLLM({ messages: [{ role: "user", content: "x" }] })).rejects.toThrow(/not configured/);
    } finally {
      (ENV as { forgeApiKey: string }).forgeApiKey = original;
    }
  });

  it("converts json_schema to JSON mode with the schema in a system message", () => {
    const out = toGroqPayload({
      model: "gpt-x",
      thinking: { budget: 1 },
      messages: [{ role: "user", content: "x" }],
      response_format: { type: "json_schema", json_schema: { name: "s", schema: { type: "object" } } },
    });
    expect(out.model).toBe("llama-3.3-70b-versatile");
    expect(out.thinking).toBeUndefined();
    expect(out.response_format).toEqual({ type: "json_object" });
    expect((out.messages as Array<{ content: string }>)[0].content).toContain('{"type":"object"}');
  });
});
