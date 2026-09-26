// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { checkRequest, isSameSite, LIMITS, resetGuard, takeGrokBudget } from "./assistantGuard.mjs";

beforeEach(() => resetGuard());
const browser = { "sec-fetch-site": "same-origin", "x-real-ip": "1.1.1.1" };

describe("hosted assistant guard", () => {
  it("allows same-site browser requests and refuses scripts and other sites", () => {
    expect(checkRequest({ headers: browser, bodyBytes: 100 })).toBeNull();
    expect(checkRequest({ headers: { "x-real-ip": "2.2.2.2" }, bodyBytes: 100 })).toEqual({ status: 403, error: "forbidden" });
    expect(checkRequest({ headers: { "sec-fetch-site": "cross-site" }, bodyBytes: 100 })?.status).toBe(403);
    expect(isSameSite({ origin: "https://www.liquid-accounting.world", host: "www.liquid-accounting.world" })).toBe(true);
    expect(isSameSite({ origin: "https://evil.example", host: "www.liquid-accounting.world" })).toBe(false);
  });

  it("caps body size and rate-limits per IP", () => {
    expect(checkRequest({ headers: browser, bodyBytes: LIMITS.maxBodyBytes + 1 })?.status).toBe(413);
    const now = Date.parse("2026-09-26T00:00:00Z");
    for (let i = 0; i < LIMITS.perMinute; i += 1) expect(checkRequest({ headers: browser, bodyBytes: 10, now })).toBeNull();
    expect(checkRequest({ headers: browser, bodyBytes: 10, now })).toEqual({ status: 429, error: "rate_limited" });
    expect(checkRequest({ headers: { ...browser, "x-real-ip": "3.3.3.3" }, bodyBytes: 10, now })).toBeNull();
    expect(checkRequest({ headers: browser, bodyBytes: 10, now: now + 61_000 })).toBeNull();
  });

  it("stops Grok after the daily budget, then resets the next day", () => {
    const day = Date.parse("2026-09-26T05:00:00Z");
    for (let i = 0; i < LIMITS.grokPerDay; i += 1) expect(takeGrokBudget(day)).toBe(true);
    expect(takeGrokBudget(day)).toBe(false);
    expect(takeGrokBudget(day + 86_400_000)).toBe(true);
  });
});
