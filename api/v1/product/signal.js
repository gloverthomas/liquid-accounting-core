/**
 * POST /api/v1/product/signal — browser-safe triage (same-site only).
 * Proxies to workflow /signal or creates Linear Todo when workflow is unavailable.
 */
import { checkRequest } from "../../../server/assistantGuard.mjs";
import { handleProductSignal } from "../../../server/productSignal.mjs";

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

  let payload = req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      res.status(400).json({ error: "invalid_json" });
      return;
    }
  }

  try {
    const result = await handleProductSignal(payload ?? {});
    res.status(result.ok ? 202 : 503).json(result);
  } catch (err) {
    res.status(500).json({
      error: "signal_failed",
      message: err instanceof Error ? err.message : "unknown",
    });
  }
}
