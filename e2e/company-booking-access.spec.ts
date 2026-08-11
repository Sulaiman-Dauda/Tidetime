import { expect, test } from "@playwright/test";

test("owner can manage a booking assigned to another provider", async ({ page }) => {
  await page.goto("/book/demo-company/intro");

  const providerSelect = page.getByRole("combobox").last();
  await providerSelect.click();
  await page.getByRole("option", { name: "Demo Provider" }).click();
  // Choosing a time moves straight to the details step. There is no separate
  // confirm button: the extra click bought nothing and cost a step.
  await page.getByTestId("slot").nth(3).click();

  const attendeeName = `Company Scope ${Date.now()}`;
  await page.locator("#name").fill(attendeeName);
  await page.locator("#email").fill(`${Date.now()}@company-scope.example`);
  // Required phone field: the country picker supplies the +44.
  await page.locator("#phone").fill("07700 900123");
  await page.waitForTimeout(2_100);
  await page.getByTestId("confirm-booking").click();
  await expect(page).toHaveURL(/\/booking\//);

  await page.goto("/login");
  await page.locator("#email").fill("owner@example.com");
  await page.locator("#password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/bookings");
  // Each row is a container with a stretched "Open booking: <title>" link;
  // the attendee name is sibling text, so filter the row, then click its link.
  const bookingRow = page.locator("main .group").filter({ hasText: attendeeName });
  await expect(bookingRow).toBeVisible();
  await bookingRow.getByRole("link", { name: /Open booking/ }).click();
  await expect(page.locator("main").getByText(attendeeName).first()).toBeVisible();
  await expect(
    page.locator("main").getByRole("button", { name: /cancel/i }).first(),
  ).toBeVisible();
});
