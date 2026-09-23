import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const allowedOrigin = process.env.LIQUID_CORE_APP_ORIGIN ?? "http://localhost:3000";
const expectedToken = process.env.LIQUID_BFF_DEMO_TOKEN;
const requestsByIp = new Map();
const rateLimitWindowMs = 60_000;
const rateLimitMaxRequests = 120;

if (!["development", "test"].includes(process.env.NODE_ENV)) {
  throw new Error("This synthetic BFF may only run with NODE_ENV set to development or test.");
}

if (!expectedToken || expectedToken.length < 16) {
  throw new Error("LIQUID_BFF_DEMO_TOKEN must be set to a value of at least 16 characters.");
}

const organisation = {
  id: "org_liquid_coffee",
  name: "Liquid Coffee Co.",
  role: "Owner",
};

const routes = {
  "/health": { status: "ok", service: "liquid-accounting-core-bff" },
  "/api/v1/organisation": organisation,
  "/api/v1/dashboard": {
    organisationId: organisation.id,
    period: "2026-04-01/2026-09-30",
    netProfit: 42842.73,
    cashAtBank: 51392,
  },
  "/api/v1/invoices": {
    organisationId: organisation.id,
    invoices: [
      { id: "inv_1048", customer: "Hamilton Studio", amount: 3240, status: "awaiting_payment" },
      { id: "inv_1047", customer: "Aster Coffee Roasters", amount: 1875, status: "sent" },
    ],
  },
};

function sendJson(response, statusCode, requestId, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Request-Id": requestId,
  });
  response.end(JSON.stringify({ requestId, ...payload }));
}

function tokenMatches(authorization) {
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(expectedToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function withinRateLimit(ip) {
  const now = Date.now();
  const recentRequests = (requestsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < rateLimitWindowMs);
  if (recentRequests.length >= rateLimitMaxRequests) return false;
  recentRequests.push(now);
  requestsByIp.set(ip, recentRequests);
  if (requestsByIp.size > 1_000) {
    requestsByIp.delete(requestsByIp.keys().next().value);
  }
  return true;
}

const server = createServer((request, response) => {
  const requestId = randomUUID();
  const origin = request.headers.origin;
  const ip = request.socket.remoteAddress ?? "unknown";
  const path = new URL(request.url, `http://${host}`).pathname;

  if (origin && origin !== allowedOrigin) {
    sendJson(response, 403, requestId, { error: "origin_not_allowed" });
    return;
  }

  if (origin) response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (!withinRateLimit(ip)) {
    sendJson(response, 429, requestId, { error: "rate_limit_exceeded" });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, requestId, { error: "method_not_allowed" });
    return;
  }

  if (!tokenMatches(request.headers.authorization)) {
    console.info(JSON.stringify({ event: "authentication_failure", requestId, route: path }));
    sendJson(response, 401, requestId, { error: "unauthorized" });
    return;
  }

  const payload = routes[path];
  if (!payload) {
    sendJson(response, 404, requestId, { error: "not_found" });
    return;
  }

  console.info(JSON.stringify({ event: "request_success", requestId, route: path }));
  sendJson(response, 200, requestId, payload);
});

server.listen(port, host, () => {
  console.info(JSON.stringify({ event: "server_started", service: "liquid-accounting-core-bff", host, port }));
});
