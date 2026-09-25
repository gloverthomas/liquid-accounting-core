import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";
import { prepareEvent } from "./analytics";

const event = (name: string, properties: Record<string, unknown>) => ({ event: name, properties }) as unknown as CaptureResult;

describe("prepareEvent (PostHog before_send)", () => {
  it("keeps PostHog's required ingestion fields so events aren't dropped", () => {
    const out = prepareEvent(event("$pageview", { token: "phc_project", distinct_id: "anon-123", $current_url: "https://x/secret" }), "core");
    expect(out?.properties).toEqual({ token: "phc_project", distinct_id: "anon-123", app: "core" });
  });

  it("still strips everything else outside the allowlist", () => {
    const out = prepareEvent(
      event("assistant_message_sent", {
        token: "phc_project",
        distinct_id: "anon-123",
        source: "core",
        outcome: "answered",
        message: "What's my net profit?",
        amount: 42_842,
        $ip: "1.2.3.4",
        $email: "a@b.c",
      }),
      "core",
    );
    expect(out?.properties).toEqual({ token: "phc_project", distinct_id: "anon-123", source: "core", outcome: "answered", app: "core" });
  });

  it("rejects bad outcomes and unknown events", () => {
    expect(prepareEvent(event("assistant_message_sent", { token: "t", outcome: "maybe" }), "core")?.properties).toEqual({ token: "t", app: "core" });
    expect(prepareEvent(event("$autocapture", { token: "t" }), "core")).toBeNull();
    expect(prepareEvent(null, "core")).toBeNull();
  });
});
