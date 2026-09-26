/**
 * Abuse limits for the *hosted* AI Assistant endpoint (Vercel function). The
 * local BFF has its own bearer token, origin and rate checks.
 *
 * The endpoint has no user auth (the demo app has no sign-in), so it must not
 * become an open proxy for the xAI key:
 * 1. Same-site browser requests only (Sec-Fetch-Site / Origin vs host) → 403.
 * 2. Per-IP rate limit (10/min, 60/hour) → 429.
 * 3. Body cap (16 KB) → 413.
 * 4. A daily Grok budget per instance; past it, answers come from demo fixtures.
 * Headers can be forged by a determined caller, so pair this with a Vercel
 * Firewall rate-limit rule on /api/v1/assistant/chat.
 */
export const LIMITS = { perMinute: 10, perHour: 60, maxBodyBytes: 16 * 1024, grokPerDay: 300 };

const hits = new Map();
let grokDay = "";
let grokCount = 0;

function header(headers, name) {
  const value = typeof headers?.get === "function" ? headers.get(name) : headers?.[name];
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

/** True when the browser says this is a same-site request from our own page. */
export function isSameSite(headers) {
  const site = header(headers, "sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = header(headers, "origin");
  if (!origin) return false;
  const hosts = [header(headers, "x-forwarded-host"), header(headers, "host")].filter(Boolean);
  return hosts.some((host) => origin === `https://${host}` || origin === `http://${host}`);
}

export function clientIp(headers) {
  return (header(headers, "x-real-ip") ?? String(header(headers, "x-forwarded-for") ?? "").split(",")[0]).trim() || "unknown";
}

/** Sliding-window limit per IP. Returns true when the request may proceed. */
export function allowRequest(ip, now = Date.now()) {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  const lastMinute = recent.filter((t) => now - t < 60_000).length;
  if (lastMinute >= LIMITS.perMinute || recent.length >= LIMITS.perHour) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.delete(hits.keys().next().value);
  return true;
}

/** Consumes one unit of today's Grok budget; false once it's spent (use fixtures). */
export function takeGrokBudget(now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  if (day !== grokDay) {
    grokDay = day;
    grokCount = 0;
  }
  if (grokCount >= LIMITS.grokPerDay) return false;
  grokCount += 1;
  return true;
}

/** Returns an error { status, error } to send, or null when the request may proceed. */
export function checkRequest({ headers, bodyBytes, now = Date.now() }) {
  if (!isSameSite(headers)) return { status: 403, error: "forbidden" };
  if (bodyBytes > LIMITS.maxBodyBytes) return { status: 413, error: "request_too_large" };
  if (!allowRequest(clientIp(headers), now)) return { status: 429, error: "rate_limited" };
  return null;
}

/** Tests only. */
export function resetGuard() {
  hits.clear();
  grokDay = "";
  grokCount = 0;
}
