import { expect, test } from "@playwright/test";

test("Core AI Assistant opens and answers a suggestion", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /AI Assistant/i }).click();
  await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();
  await page.getByRole("button", { name: "How does this quarter compare to last?" }).click();
  await expect(page.getByText(/Income is up versus last quarter/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: /How this was calculated/i }).click();
  await expect(page.getByText(/via /i)).toBeVisible();
});
