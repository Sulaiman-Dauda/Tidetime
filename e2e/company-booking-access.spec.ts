import { expect, test } from "@playwright/test";

test("owner can manage a booking assigned to another provider", async ({ page }) => {
  await page.goto("/book/demo-company/intro");

  const providerSelect = page.getByRole("combobox").last();
  await providerSelect.click();
  await page.getByRole("option", { name: "Demo Provider" }).click();
  await page.getByTestId("slot").nth(3).click();

  const attendeeName = `Company Scope ${Date.now()}`;
  await page.locator("#name").fill(attendeeName);
  await page.locator("#email").fill(`${Date.now()}@company-scope.example`);
  await page.waitForTimeout(2_100);
  await page.getByTestId("confirm-booking").click();
  await expect(page).toHaveURL(/\/booking\//);

  await page.goto("/login");
  await page.locator("#email").fill("owner@example.com");
  await page.locator("#password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/bookings");
  const bookingLink = page.locator("main").getByRole("link", {
    name: new RegExp(attendeeName),
  });
  await expect(bookingLink).toBeVisible();
  await bookingLink.click();
  await expect(page.locator("main").getByText(attendeeName).first()).toBeVisible();
  await expect(
    page.locator("main").getByRole("button", { name: /cancel/i }).first(),
  ).toBeVisible();
});
