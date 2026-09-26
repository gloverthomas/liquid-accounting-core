import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const reportingUrl = process.env.REPORTING_APP_URL ?? "http://localhost:3001";
const proofDir = join(process.cwd(), "e2e/proof");

async function captureProof(page: import("@playwright/test").Page, name: string) {
  mkdirSync(proofDir, { recursive: true });
  await page.screenshot({ path: join(proofDir, name), fullPage: false });
}

test.describe("LIQ cross-repo parity seams", () => {
  test("Core shell uses Create; Reporting still shows New (LIQ-8)", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Primary navigation" }).getByRole("button", { name: "Create" }),
    ).toBeVisible();

    await page.goto(reportingUrl);
    await expect(
      page.getByRole("navigation", { name: "Primary navigation" }).locator('a[title="New"]'),
    ).toBeVisible();
  });

  for (const legacy of ["sales-summary", "invoice-performance"]) {
    test(`Old #${legacy} links open Revenue summary in Reporting (LIQ-9 / LIQ-15)`, async ({ page }) => {
      await page.goto(`${reportingUrl}/#${legacy}`);
      await expect(page.getByRole("heading", { name: "Revenue summary" })).toBeVisible();
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(page).toHaveURL(/#revenue-summary$/);
    });
  }

  test("Status pills look the same in both apps (LIQ-7)", async ({ page }) => {
    const pillStyle = (locator: import("@playwright/test").Locator) =>
      locator.evaluate((el) => {
        const s = getComputedStyle(el);
        return { radius: s.borderTopLeftRadius, size: s.fontSize, weight: s.fontWeight, transform: s.textTransform, color: s.color, background: s.backgroundColor };
      });
    await page.goto("/");
    const core = await pillStyle(page.locator("span.status.status-overdue").first());
    await page.goto(`${reportingUrl}/#revenue-summary`);
    const reporting = await pillStyle(page.locator("span.status.status-overdue").first());
    expect(reporting).toEqual(core);
    await captureProof(page, "liq-7-reporting-status-pills.png");
  });

  test("AI Assistant opens under the top nav in both apps (LIQ-24)", async ({ page }) => {
    await page.goto("/");
    const coreTopbar = page.locator("header.topbar");
    await coreTopbar.getByRole("button", { name: /AI Assistant/i }).click();
    await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();
    await expect(coreTopbar.getByRole("button", { name: /AI Assistant/i })).toBeVisible();
    await expect(coreTopbar.getByRole("button", { name: "Help", exact: true })).toHaveCount(0);
    await expect(coreTopbar.getByRole("button", { name: "Notifications" })).toHaveCount(0);
    await captureProof(page, "liq-24-core-assistant-under-nav.png");

    await page.goto(reportingUrl);
    const reportingTopbar = page.locator("header.reporting-header");
    await reportingTopbar.getByRole("button", { name: /AI Assistant/i }).click();
    await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();
    await expect(reportingTopbar.getByRole("button", { name: /AI Assistant/i })).toBeVisible();
    await captureProof(page, "liq-24-reporting-assistant-under-nav.png");
  });

  test("Core Reports deep-link to #revenue-summary", async ({ page }) => {
    await page.goto("/");
    const reports = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: /Reports/i });
    await expect(reports).toHaveAttribute("href", /#revenue-summary$/);
  });

  test("Canonical Revenue summary hash opens the renamed report (LIQ-9)", async ({ page }) => {
    await page.goto(`${reportingUrl}/#revenue-summary`);
    await expect(page.getByRole("heading", { name: "Revenue summary" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("Collapse control accessible names differ across apps (LIQ-5)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Collapse navigation|Expand navigation/ })).toBeVisible();

    await page.goto(reportingUrl);
    await expect(page.getByRole("button", { name: "Toggle menu" })).toBeVisible();
  });
});
