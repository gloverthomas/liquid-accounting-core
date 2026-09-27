import { describe, expect, it } from "vitest";
import { issueIdForProof, pngsForIssue } from "../scripts/post-linear-visual-proof.mjs";

describe("visual proof targets", () => {
  it("uses the PR title before an older ticket cited in the body", () => {
    expect(
      issueIdForProof({
        title: "fix(LIQ-40): accordion expands",
        headRefName: "cursor/liq-40-accordion",
        body: "Chat already works after LIQ-24.",
      }),
    ).toBe("LIQ-40");
  });

  it("falls back to the body when the title and branch have no ticket", () => {
    expect(
      issueIdForProof({
        title: "accordion expands",
        headRefName: "cursor/accordion",
        body: "Fixes the disclosure.\n\nLIQ-40",
      }),
    ).toBe("LIQ-40");
  });

  it("does not attach screenshots named for a different ticket", () => {
    const pngs = [
      { name: "liq-24-reporting-assistant-open.png" },
      { name: "liq-7-reporting-status-pills.png" },
      { name: "liq-17-shell.png" },
      { name: "liq-40-accordion-open.png" },
    ];
    expect(pngsForIssue(pngs, "LIQ-40").map((file) => file.name)).toEqual(["liq-40-accordion-open.png"]);
    expect(pngsForIssue(pngs, "LIQ-41")).toEqual([]);
  });

  it("matches the ticket id as a whole token", () => {
    const pngs = [
      { name: "liq-1-open.png" },
      { name: "liq-17-status.png" },
      { name: "liq-10-pills.png" },
      { name: "liq-2-nav.png" },
      { name: "liq-24-accordion.png" },
      { name: "liq-241-other.png" },
    ];
    expect(pngsForIssue(pngs, "LIQ-1").map((file) => file.name)).toEqual(["liq-1-open.png"]);
    expect(pngsForIssue(pngs, "LIQ-2").map((file) => file.name)).toEqual(["liq-2-nav.png"]);
    expect(pngsForIssue(pngs, "LIQ-24").map((file) => file.name)).toEqual(["liq-24-accordion.png"]);
    expect(pngsForIssue(pngs, "LIQ-241").map((file) => file.name)).toEqual(["liq-241-other.png"]);
  });
});