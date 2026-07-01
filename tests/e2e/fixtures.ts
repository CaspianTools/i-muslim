import { test as base, expect } from "@playwright/test";

/**
 * Shared e2e `test` with the first-run onboarding modal pre-dismissed.
 *
 * On first visit the app shows a modal Radix Dialog ("Welcome to i-muslim")
 * until localStorage `i-muslim-onboarded` is "true" (see
 * components/onboarding/OnboardingModal.tsx). While open, the dialog makes the
 * rest of the page inert / aria-hidden, so no background content is reachable
 * by role or clickable. Seeding the flag before any page script runs mirrors a
 * returning visitor and keeps each test focused on the page under test.
 *
 * `addInitScript` runs before the app's own scripts on every navigation, so the
 * flag is already set by the time React hydrates and reads it — the modal never
 * opens (no flash, no inert background).
 */
export const test = base.extend({
  // The fixture callback is named `run` (not the conventional `use`) so the
  // react-hooks/rules-of-hooks lint rule doesn't mistake it for React's `use`.
  page: async ({ page }, run) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem("i-muslim-onboarded", "true");
      } catch {
        // storage unavailable — ignore
      }
    });
    await run(page);
  },
});

export { expect };
