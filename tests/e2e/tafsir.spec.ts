import { test, expect } from "./fixtures";

// These cases are the ones that are cheap to get wrong and expensive to notice:
// coverage labels for passages that skip verses, cross-reference stubs that
// would otherwise render as commentary, and the two-axis language routing.

test.describe("Tafsir Ibn Kathir", () => {
  test("/tafsir redirects to the single work and lists both languages", async ({
    page,
  }) => {
    await page.goto("/en/tafsir");
    await expect(page).toHaveURL(/\/en\/tafsir\/ibn-kathir$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /Tafsir Ibn Kathir/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Arabic/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Bahasa Indonesia/ })).toBeVisible();
  });

  test("a passage page renders the commentary, its verses and JSON-LD", async ({
    page,
  }) => {
    const res = await page.goto("/en/tafsir/ibn-kathir/ar/4/155-159");
    expect(res!.status()).toBeLessThan(400);

    await expect(
      page.getByRole("heading", { level: 1, name: /An-Nisa 155–159/ }),
    ).toBeVisible();

    // Arabic commentary renders RTL, and Quran quotations are marked up so they
    // can be styled apart from the surrounding prose.
    const prose = page.locator(".tafsir-prose");
    await expect(prose).toHaveAttribute("dir", "rtl");
    expect(await page.locator(".tafsir-quran").count()).toBeGreaterThan(0);

    // Self-referencing canonical on the canonical slug.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/en\/tafsir\/ibn-kathir\/ar\/4\/155-159$/,
    );

    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    const article = jsonLd.map((t) => JSON.parse(t)).find((d) => d["@type"] === "Article");
    expect(article, "Article JSON-LD is emitted").toBeTruthy();
    // The content language, not the UI locale — the body IS the Arabic tafsir.
    expect(article.inLanguage).toBe("ar");
    // A 66 KB passage must not be restated in the graph.
    expect(article.articleBody).toBeUndefined();
    expect(String(article.abstract).length).toBeGreaterThan(0);
  });

  test("a verse inside a passage redirects to the canonical slug, keeping the locale", async ({
    page,
  }) => {
    await page.goto("/en/tafsir/ibn-kathir/ar/4/158");
    await expect(page).toHaveURL(/\/en\/tafsir\/ibn-kathir\/ar\/4\/155-159$/);
  });

  test("a passage covering non-adjacent verses says so instead of claiming a range", async ({
    page,
  }) => {
    // Indonesian 002-052 covers 2:52, 2:53, 2:82 and 2:162. Rendering that as
    // "2:52–162" would claim 110 verses it does not comment on.
    await page.goto("/en/tafsir/ibn-kathir/id/2/52-162");
    await expect(
      page.getByRole("heading", { level: 1, name: /52–53, 82, 162/ }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Al-Baqarah 52–162");
  });

  test("a cross-reference stub forwards to the real commentary", async ({ page }) => {
    // Indonesian 002-021 is a stub whose whole text is "Lihat tafsir ayat
    // selanjutnya"; shipping that as commentary would be a lie.
    await page.goto("/id/tafsir/ibn-kathir/id/2/21");
    await expect(page.locator(".tafsir-prose")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "Lihat tafsir ayat selanjutnya",
    );
  });

  test("unknown languages, surahs and malformed ranges 404", async ({ page }) => {
    for (const path of [
      "/en/tafsir/ibn-kathir/en/1/1", // English tafsir is not published
      "/en/tafsir/ibn-kathir/ar/115/1",
      "/en/tafsir/ibn-kathir/ar/1/abc",
    ]) {
      const res = await page.goto(path);
      expect(res!.status(), path).toBe(404);
    }
  });

  test("the reader offers tafsir per ayah and links into the section", async ({
    page,
  }) => {
    await page.goto("/en/quran/1");

    // One desktop trigger per ayah. The mobile duplicates live inside a Radix
    // popover that mounts on open, so they are not in the initial DOM.
    const triggers = page.locator('[id^="tafsir-trigger-desktop-"]');
    await expect(triggers).toHaveCount(7);

    const first = triggers.first();
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");

    // Panel is fetched on demand, then focused.
    const panel = page.locator("#tafsir-panel-1-1");
    await expect(panel).toBeVisible();
    await expect(panel.locator(".tafsir-prose")).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Tafsir Ibn Kathir for this surah/i }),
    ).toBeVisible();
  });

  test("tafsir can be turned off entirely", async ({ page }) => {
    await page.goto("/en/quran/1?tafsir=off");
    await expect(page.locator('[id^="tafsir-trigger-desktop-"]')).toHaveCount(0);
  });
});
