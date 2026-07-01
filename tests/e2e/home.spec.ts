import { test, expect } from "./fixtures";

test.describe("home page", () => {
  test("redirects to a locale and renders the hero", async ({ page }) => {
    const response = await page.goto("/");
    expect(response, "navigation should return a response").not.toBeNull();
    expect(response!.status()).toBeLessThan(400);

    // localePrefix is "always" → `/` lands on `/en` (locale pinned in config).
    await expect(page).toHaveURL(/\/en\/?$/);

    // The hero <h1> is the site headline (home.headline).
    await expect(
      page.getByRole("heading", { level: 1, name: /Read the Quran and Sunnah/i }),
    ).toBeVisible();

    // Primary CTA into the reader.
    await expect(
      page.getByRole("link", { name: /Read the Quran/i }).first(),
    ).toBeVisible();

    await expect(page).toHaveTitle(/.+/);
  });

  test("has no fatal page error and a non-empty document", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/en");
    await expect(page.locator("body")).toBeVisible();
    expect(pageErrors, `uncaught page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});
