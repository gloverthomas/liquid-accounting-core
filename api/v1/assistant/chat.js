/**
 * Vercel serverless — POST /api/v1/assistant/chat
 * Uses XAI_API_KEY when set; otherwise demo fixtures.
 * Public endpoint (the demo app has no sign-in), so server/assistantGuard.mjs
 * limits it to same-site browser requests, rate-limits per IP and caps Grok spend,
 * and Vercel BotID must verify a real browser (bots get 403).
 */
import { checkBotId } from "botid/server";
import { checkRequest, takeGrokBudget } from "../../../server/assistantGuard.mjs";

/** "human" | "bot" | "unknown" (BotID unavailable). Headers can be forged, BotID can't. */
async function botVerdict(headers) {
  try {
    const result = await checkBotId({ advancedOptions: { headers } });
    return result.isBot ? "bot" : "human";
  } catch {
    return "unknown";
  }
}

const xaiApiKey = (process.env.XAI_API_KEY ?? "").trim();
const xaiModel = (process.env.XAI_MODEL ?? "").trim() || "grok-4-fast-non-reasoning";

function sanitizeContext(value) {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 100);
}

function sanitizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter((entry) => entry && ["user", "assistant"].includes(entry.role))
    .map((entry) => ({
      role: entry.role,
      content: String(entry.content ?? "").slice(0, 1000),
    }))
    .slice(-6);
}

function fixtureAssistantReply(message) {
  const lower = String(message ?? "").toLowerCase();
  if (lower.includes("quarter") || lower.includes("compare")) {
    return {
      reply:
        "Income is up versus last quarter, and net profit improved as coffee wholesale held steady.\n\n1. **Income** – $56,180 this quarter vs $48,210 last quarter\n2. **Net profit** – $24,202 vs $18,640\n\nFigures use Liquid Coffee Co. demo books (AUD).",
      table: {
        headers: ["Metric", "Last Quarter (Apr–Jun 2026)", "Current Quarter (Jul–Sep 2026)"],
        rows: [
          ["Income", "$48,210", "$56,180"],
          ["Net Profit", "$18,640", "$24,202"],
        ],
      },
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
      rationale:
        "Compared current quarter (Jul–Sep 2026) income and net profit against last quarter (Apr–Jun 2026) from Liquid Coffee Co. demo books.",
      relatedQuestions: [
        "What's driving the income increase?",
        "What's my gross profit margin?",
        "What are my biggest income sources?",
      ],
    };
  }
  if (lower.includes("margin") || lower.includes("gross")) {
    return {
      reply:
        "Gross profit margin is about **58%** this quarter on demo data — strong for wholesale coffee.",
      table: null,
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
      rationale: "Divided gross profit by income for the current quarter on Liquid Coffee Co. demo books.",
      relatedQuestions: [
        "How does this quarter compare to last?",
        "What are my biggest expenses?",
        "What are my biggest income sources?",
      ],
    };
  }
  if (lower.includes("income") || lower.includes("source")) {
    return {
      reply:
        "Your top income sources this quarter are:\n\n1. **Coffee Sales** – $142,800 (retail & wholesale combined)\n2. **Merchandise** – $18,450\n3. **Catering Events** – $12,300\n\nLast quarter: Coffee Sales were $138,200, Merchandise $15,900, Catering $9,800.",
      table: {
        headers: ["Source", "Amount"],
        rows: [
          ["Coffee Sales", "$142,800"],
          ["Merchandise", "$18,450"],
          ["Catering Events", "$12,300"],
        ],
      },
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
      rationale:
        "Ranked income accounts for the current quarter from Liquid Coffee Co. demo books, then compared the same categories to last quarter.",
      relatedQuestions: [
        "How does this quarter compare to last?",
        "What's my gross profit margin?",
        "Which income source grew the most?",
      ],
    };
  }
  return {
    reply:
      "I can compare quarters, margin, or income sources using Liquid Coffee Co. demo books. Ask a finance question to continue.",
    table: null,
    cta: null,
    provider: "fixture",
    rationale: "No specific metric requested — offered the default demo finance prompts.",
    relatedQuestions: [
      "How does this quarter compare to last?",
      "What's my gross profit margin?",
      "What are my biggest income sources?",
    ],
  };
}

function parseGrokPayload(raw, fallbackMessage) {
  try {
    const cleaned = String(raw ?? "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned);
    const reply = String(parsed.reply ?? "").trim();
    if (!reply) throw new Error("missing_reply");
    return {
      reply,
      table: null,
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      rationale:
        String(parsed.rationale ?? "").trim() ||
        "Answered from Liquid Coffee Co. demo books for this page context.",
      relatedQuestions: (Array.isArray(parsed.relatedQuestions) ? parsed.relatedQuestions : [])
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 3),
    };
  } catch {
    const fixture = fixtureAssistantReply(fallbackMessage);
    return {
      reply: String(raw ?? "").trim() || fixture.reply,
      table: null,
      cta: fixture.cta,
      rationale: fixture.rationale,
      relatedQuestions: fixture.relatedQuestions,
    };
  }
}

async function callGrok({ message, context, history }) {
  const safeContext = sanitizeContext(context);
  const system = `You are Liquid's in-product AI Assistant for Liquid Coffee Co. (synthetic AU accounting demo).
Prefer AUD. Context page: ${safeContext || "Dashboard"}.
Never invent real customer PII. Do not claim live bank access.

Respond with ONLY valid JSON (no markdown fences) using this shape:
{"reply":"user-facing answer using markdown: paragraphs and numbered lists with **bold** labels; put each list item on its own line","rationale":"1-2 sentences explaining which demo-book figures or steps you used","relatedQuestions":["follow-up 1","follow-up 2","follow-up 3"]}`;

  const messages = [
    { role: "system", content: system },
    ...sanitizeHistory(history),
    { role: "user", content: String(message ?? "").slice(0, 2000) },
  ];

  async function complete(withJsonFormat) {
    const body = {
      model: xaiModel,
      messages,
      temperature: 0.3,
      max_tokens: 700,
    };
    if (withJsonFormat) body.response_format = { type: "json_object" };
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${xaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`xai_${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("xai_empty_reply");
    return content;
  }

  let content;
  try {
    content = await complete(true);
  } catch (error) {
    // Retry without JSON mode only when the model rejects it; timeouts/5xx don't double the spend.
    if (!(error instanceof Error && /^xai_(400|422)$/.test(error.message))) throw error;
    content = await complete(false);
  }
  const parsed = parseGrokPayload(content, message);
  if (!parsed.relatedQuestions.length) {
    parsed.relatedQuestions = fixtureAssistantReply(message).relatedQuestions;
  }
  return {
    ...parsed,
    provider: `grok:${xaiModel}`,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  const refused = checkRequest({ headers: req.headers, bodyBytes: Buffer.byteLength(raw) });
  if (refused) {
    res.status(refused.status).json({ error: refused.error });
    return;
  }
  const verdict = await botVerdict(req.headers);
  if (verdict === "bot") {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
    const message = String(body.message ?? "").trim();
    if (!message) {
      res.status(400).json({ error: "message_required" });
      return;
    }

    if (message.length > 2000) {
      res.status(400).json({ error: "message_too_long" });
      return;
    }

    let payload;
    // If BotID was unavailable, answer from fixtures: never spend the key unverified.
    if (xaiApiKey && verdict === "human" && takeGrokBudget()) {
      try {
        payload = await callGrok({
          message,
          context: body.context,
          history: body.history,
        });
      } catch {
        payload = fixtureAssistantReply(message);
      }
    } else {
      payload = fixtureAssistantReply(message);
    }

    res.status(200).json(payload);
  } catch {
    res.status(500).json({ error: "assistant_failed" });
  }
}
