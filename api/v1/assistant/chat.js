/**
 * Vercel serverless — POST /api/v1/assistant/chat
 * Uses XAI_API_KEY when set; otherwise demo fixtures.
 */
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
        "Income is up versus last quarter, and net profit improved as coffee wholesale held steady. Figures below use Liquid Coffee Co. demo books (AUD).",
      table: {
        headers: ["Metric", "Last Quarter (Apr–Jun 2026)", "Current Quarter (Jul–Sep 2026)"],
        rows: [
          ["Income", "$48,210", "$56,180"],
          ["Net Profit", "$18,640", "$24,202"],
        ],
      },
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
    };
  }
  if (lower.includes("margin") || lower.includes("gross")) {
    return {
      reply: "Gross profit margin is about 58% this quarter on demo data — strong for wholesale coffee.",
      table: null,
      cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
      provider: "fixture",
    };
  }
  if (lower.includes("income") || lower.includes("source")) {
    return {
      reply: "Biggest income sources this quarter: wholesale beans, subscription boxes, and cafe kits.",
      table: {
        headers: ["Source", "Amount"],
        rows: [
          ["Wholesale beans", "$31,400"],
          ["Subscription boxes", "$14,920"],
          ["Cafe kits", "$9,860"],
        ],
      },
      cta: null,
      provider: "fixture",
    };
  }
  return {
    reply:
      "I can compare quarters, margin, or income sources using Liquid Coffee Co. demo books. Ask a finance question to continue.",
    table: null,
    cta: null,
    provider: "fixture",
  };
}

async function callGrok({ message, context, history }) {
  const safeContext = sanitizeContext(context);
  const system = `You are Liquid's in-product AI Assistant for Liquid Coffee Co. (synthetic AU accounting demo).
Be concise. Prefer AUD. Context page: ${safeContext || "Dashboard"}.
If comparing periods, mention last vs current quarter briefly.
Never invent real customer PII. Do not claim live bank access.`;

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${xaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: xaiModel,
      messages: [
        { role: "system", content: system },
        ...sanitizeHistory(history),
        { role: "user", content: String(message ?? "").slice(0, 2000) },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`xai_${res.status}`);
  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("xai_empty_reply");
  return {
    reply,
    table: null,
    cta: { label: "Open Profit and loss Report", href: "/#profit-loss" },
    provider: `grok:${xaiModel}`,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body ?? {};
    const message = String(body.message ?? "").trim();
    if (!message) {
      res.status(400).json({ error: "message_required" });
      return;
    }

    let payload;
    if (xaiApiKey) {
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
