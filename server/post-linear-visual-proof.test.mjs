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

  it("ignores the PR template sample id inside an HTML comment", () => {
    const template = `## Summary
<!-- What changed and why (link Linear hero e.g. LIQ-16). -->

## Screenshots
<!-- ![](../docs/pr-proof/before.png) -->
`;
    expect(
      issueIdForProof({
        title: "Post proof images only for the ticket on the PR",
        headRefName: "cursor/proof-matches-ticket-fdce",
        body: template,
      }),
    ).toBeNull();
    expect(
      issueIdForProof({
        title: "accordion expands",
        headRefName: "cursor/accordion",
        body: `${template}\nFixes LIQ-40.`,
      }),
    ).toBe("LIQ-40");
  });

  it("does not let an example id outside comments win over a real body id", () => {
    expect(
      issueIdForProof({
        title: "accordion expands",
        headRefName: "cursor/accordion",
        body: "See e.g. LIQ-16. This PR fixes LIQ-40.",
      }),
    ).toBe("LIQ-40");
    expect(
      issueIdForProof({
        title: "accordion expands",
        headRefName: "cursor/accordion",
        body: "link Linear hero e.g. LIQ-16",
      }),
    ).toBeNull();
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