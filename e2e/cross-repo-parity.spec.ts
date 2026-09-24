import { expect, test } from "@playwright/test";

const reportingUrl = process.env.REPORTING_APP_URL ?? "http://localhost:3001";

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

  test("Core deep-links to legacy #sales-summary; Reporting flags the miss (LIQ-9)", async ({ page }) => {
    await page.goto(`${reportingUrl}/#sales-summary`);
    await expect(page.getByRole("alert")).toContainText(/Report link out of date|sales-summary|Revenue summary/i);
  });

  test("Core Reports / Create Invoice deep-link to #revenue-summary (LIQ-15)", async ({ page }) => {
    await page.goto("/");
    const reports = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: /Reports/i });
    await expect(reports).toHaveAttribute("href", /#revenue-summary$/);

    await page.goto(`${reportingUrl}/#revenue-summary`);
    await expect(page.getByRole("heading", { name: "Revenue summary" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
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
