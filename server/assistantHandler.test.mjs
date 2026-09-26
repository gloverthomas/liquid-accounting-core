// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const checkBotId = vi.fn();
vi.mock("botid/server", () => ({ checkBotId: (...args) => checkBotId(...args) }));

const { default: handler } = await import("../api/v1/assistant/chat.js");
const { resetGuard } = await import("./assistantGuard.mjs");

function call(headers, body = { message: "What's my gross profit margin?" }) {
  const out = { status: 0, json: null };
  const res = { setHeader() {}, status(s) { out.status = s; return this; }, json(j) { out.json = j; return this; } };
  return handler({ method: "POST", headers, body }, res).then(() => out);
}
const browser = { "sec-fetch-site": "same-origin", "x-real-ip": "7.7.7.7" };

beforeEach(() => {
  resetGuard();
  checkBotId.mockReset();
});

describe("hosted assistant handler with BotID", () => {
  it("answers verified browsers", async () => {
    checkBotId.mockResolvedValue({ isBot: false, isHuman: true });
    const out = await call(browser);
    expect(out.status).toBe(200);
    expect(out.json.provider).toBe("fixture");
    expect(checkBotId).toHaveBeenCalledWith({ advancedOptions: { headers: browser } });
  });

  it("refuses bots even when they forge browser headers", async () => {
    checkBotId.mockResolvedValue({ isBot: true, isHuman: false });
    expect((await call(browser)).status).toBe(403);
  });

  it("refuses non-browser requests before calling BotID", async () => {
    expect((await call({ "x-real-ip": "8.8.8.8" })).status).toBe(403);
    expect(checkBotId).not.toHaveBeenCalled();
  });

  it("still answers (from fixtures) if BotID errors", async () => {
    checkBotId.mockRejectedValue(new Error("botid_down"));
    const out = await call(browser);
    expect(out.status).toBe(200);
    expect(out.json.provider).toBe("fixture");
  });
});
