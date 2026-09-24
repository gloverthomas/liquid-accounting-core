import { expect, test } from "@playwright/test";

test("Core shell loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByAltText("Liquid").first()).toBeVisible();
});
