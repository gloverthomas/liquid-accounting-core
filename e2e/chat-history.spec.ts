import { expect, test } from "@playwright/test";

const fixtureReply = {
  reply: "Income is up versus last quarter.",
  provider: "fixture",
  rationale: "Compared June income to the prior quarter in demo books.",
  relatedQuestions: ["What drove the increase?", "Show expense trend"],
};

test("Core AI Assistant lists a saved chat and restores the reply", async ({ page }) => {
  await page.route(/\/api\/v1\/assistant\/chat$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fixtureReply),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /AI Assistant/i }).click();
  await expect(page.getByRole("heading", { name: "AI Assistant" })).toBeVisible();
  await page.getByRole("button", { name: "How does this quarter compare to last?" }).click();
  await expect(page.getByText(/Income is up versus last quarter/i)).toBeVisible();

  await page.getByRole("button", { name: "History" }).click();
  const history = page.getByRole("list", { name: "Chat history" });
  await expect(
    history.getByRole("button", { name: "How does this quarter compare to last?" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "New chat" }).click();
  await expect(page.getByRole("heading", { name: /Hello/i })).toBeVisible();
  await expect(page.getByText(/Income is up versus last quarter/i)).toHaveCount(0);

  await page.getByRole("button", { name: "History" }).click();
  await history.getByRole("button", { name: "How does this quarter compare to last?" }).click();
  await expect(page.getByText(/Income is up versus last quarter/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "What drove the increase?" })).toBeVisible();
});
