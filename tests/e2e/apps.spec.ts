import { test, expect } from "./fixtures";

const LOCALES = ["en", "ar", "tr", "id"] as const;

test.describe("Quran app page", () => {
  test("renders, links to Play, and loads every screenshot", async ({ page }) => {
    // The screenshots live in public/ and are referenced by string path, so
    // nothing catches a typo or a missing file at build time. This does.
    const broken: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/apps/quran/shots/") && !r.ok()) broken.push(r.url());
    });

    const response = await page.goto("/en/apps/quran");
    expect(response!.status()).toBeLessThan(400);

    await expect(
      page.getByRole("heading", { level: 1, name: /Quran by i-muslim/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Google Play/i }).first(),
    ).toHaveAttribute("href", /play\.google\.com\/.*id=com\.imuslim\.quran/);

    await expect(page.locator("img[src*='/apps/quran/shots/']")).toHaveCount(8);
    expect(broken, `screenshots failed to load: ${broken.join(", ")}`).toEqual([]);

    // Latest 10 releases on the page, full history one link away.
    await expect(page.locator("#whats-new details")).toHaveCount(10);
    await expect(
      page.getByRole("link", { name: /full release history/i }),
    ).toBeVisible();
  });

  test("the changelog page lists every shipped release", async ({ page }) => {
    await page.goto("/en/apps/quran/changelog");
    const rows = page.locator("details");
    // 42 shipped versionCodes in the committed snapshot; the two unshipped ones
    // are excluded on purpose. Not an exact count: with a repo token set, live
    // data legitimately adds releases the snapshot has not caught up with.
    expect(await rows.count()).toBeGreaterThanOrEqual(42);
    await expect(page.getByText("1.0", { exact: true }).last()).toBeVisible();
  });

  // next-intl's t.rich throws at render time — not at build, lint or
  // check:locales — if a locale's message has a malformed tag. A dropped
  // </caspian> in one file would be a 500 nothing else would catch.
  for (const locale of LOCALES) {
    test(`renders in ${locale} without a page error`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      const response = await page.goto(`/${locale}/apps/quran`);
      expect(response!.status()).toBeLessThan(400);
      await expect(page.locator("#features")).toBeVisible();
      expect(errors, `uncaught page errors: ${errors.join(" | ")}`).toEqual([]);
    });
  }
});

test.describe("Prayer app page", () => {
  test("renders, links to Play, and loads every screenshot", async ({ page }) => {
    const broken: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/apps/prayer/shots/") && !r.ok()) broken.push(r.url());
    });

    const response = await page.goto("/en/apps/prayer");
    expect(response!.status()).toBeLessThan(400);

    // Exact string, not a regex: the parens in the store name would otherwise
    // be read as a regex group and quietly change what is being matched.
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Salatuk (Namaz) Prayer Times",
      }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Google Play/i }).first(),
    ).toHaveAttribute("href", /play\.google\.com\/.*id=com\.imuslim\.prayer/);

    await expect(page.locator("img[src*='/apps/prayer/shots/']")).toHaveCount(8);
    expect(broken, `screenshots failed to load: ${broken.join(", ")}`).toEqual([]);

    // The app has no sign-in, so its policy anchor — not the Quran's — is what
    // Play links to, and /delete-account must not be offered alongside it.
    // Scoped to the CTA card: the site footer links to /delete-account on every
    // page, and that is not what this is about.
    const cta = page.locator("#get");
    await expect(
      cta.getByRole("link", { name: /handles your data/i }),
    ).toHaveAttribute("href", "/en/privacy#prayer-app");
    await expect(cta.locator("a[href='/en/delete-account']")).toHaveCount(0);

    // Only two shipped releases so far, so the whole history already fits in
    // the preview and the "full history" link is deliberately hidden.
    expect(
      await page.locator("#whats-new details").count(),
    ).toBeGreaterThanOrEqual(2);
  });

  test("the changelog page lists every shipped release", async ({ page }) => {
    const response = await page.goto("/en/apps/prayer/changelog");
    expect(response!.status()).toBeLessThan(400);
    // Codes 1-13 were built but never uploaded and must stay out.
    expect(await page.locator("details").count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("1.8.0", { exact: true })).toBeVisible();
  });

  for (const locale of LOCALES) {
    test(`renders in ${locale} without a page error`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      const response = await page.goto(`/${locale}/apps/prayer`);
      expect(response!.status()).toBeLessThan(400);
      await expect(page.locator("#features")).toBeVisible();
      expect(errors, `uncaught page errors: ${errors.join(" | ")}`).toEqual([]);
    });
  }
});

test.describe("apps index", () => {
  test("lists both apps", async ({ page }) => {
    const response = await page.goto("/en/apps");
    expect(response!.status()).toBeLessThan(400);
    // It used to redirect to /apps/quran; now it is a real page.
    await expect(page).toHaveURL(/\/en\/apps$/);

    // Scoped to the card grid — the site footer links to both app pages too.
    const cards = page.locator("#apps-list");
    await expect(cards.locator("a[href='/en/apps/quran']")).toHaveCount(1);
    await expect(cards.locator("a[href='/en/apps/prayer']")).toHaveCount(1);
    await expect(
      cards.getByRole("link", { name: /Google Play/i }),
    ).toHaveCount(2);
  });
});

test.describe("privacy policy", () => {
  test("describes the optional account and cloud backup", async ({ page }) => {
    await page.goto("/en/privacy");

    // The Play Data safety form declares Name, Email, User IDs, Photos and app
    // activity. The hosted policy has to account for all of it.
    await expect(page.locator("#app-account")).toBeVisible();
    await expect(page.locator("#app-deletion")).toBeVisible();

    const section = page.locator("#android-app");
    await expect(section).toContainText(/email address/i);
    await expect(section).toContainText(/profile photo/i);
    await expect(section).toContainText(/user ID/i);
    await expect(section).toContainText(/cloud backup/i);
    await expect(section).toContainText(/Google/i);

    // The old copy claimed no internet permission and no accounts at all.
    await expect(section).not.toContainText(/no internet permission/i);
    await expect(section).not.toContainText(/makes no network requests/i);

    await expect(
      section.getByRole("link", { name: /account deletion/i }),
    ).toHaveAttribute("href", "/en/delete-account");
  });
});
