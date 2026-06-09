import { test, expect } from "@playwright/test";

/**
 * Core booking-flow E2E: a public visitor reaches a host's service page, picks
 * an available day + time, enters their details, and confirms — landing on the
 * booking management page. This is the money path the unit suite can't cover
 * end-to-end (real routing, server action, persistence, redirect).
 *
 * Requires a seeded instance (see playwright.config.ts). Defaults target the
 * `demo` user's `intro` service from `npm run db:seed`.
 */

const USER = process.env.E2E_USER ?? "demo";
const SLUG = process.env.E2E_SLUG ?? "intro";

test.describe("public booking flow", () => {
  test("the service page renders with available times", async ({ page }) => {
    await page.goto(`/${USER}/${SLUG}`);
    // The page mounted and offers at least one bookable day.
    await expect(page.getByTestId("day-available").first()).toBeVisible();
  });

  test("a visitor can book an available slot", async ({ page }) => {
    await page.goto(`/${USER}/${SLUG}`);

    // Choose the first available day, then the first open time.
    await page.getByTestId("day-available").first().click();
    await page.getByTestId("slot").first().click();

    // Fill the booker details and confirm.
    await page.locator("#name").fill("E2E Tester");
    await page.locator("#email").fill("e2e@example.com");
    await page.getByTestId("confirm-booking").click();

    // Lands on the booking management page for the new booking.
    await expect(page).toHaveURL(/\/booking\//);
  });
});
