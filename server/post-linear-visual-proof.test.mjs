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

  it("does not attach screenshots named for a different ticket", () => {
    const pngs = [
      { name: "liq-24-reporting-assistant-open.png" },
      { name: "liq-7-reporting-status-pills.png" },
      { name: "liq-40-accordion-open.png" },
    ];
    expect(pngsForIssue(pngs, "LIQ-40").map((file) => file.name)).toEqual(["liq-40-accordion-open.png"]);
    expect(pngsForIssue(pngs, "LIQ-41")).toEqual([]);
  });
});