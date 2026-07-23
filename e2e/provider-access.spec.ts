import { expect, test } from "@playwright/test";

async function loginAsProvider(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator("#email").fill("provider@example.com");
  await page.locator("#password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("provider access boundaries", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsProvider(page);
  });

  test("shows the focused provider navigation", async ({ page }) => {
    const navigation = page.locator("nav:visible");
    await expect(navigation.getByText("My services", { exact: true })).toBeVisible();
    await expect(navigation.getByText("Availability", { exact: true })).toBeVisible();
    await expect(navigation.getByText("Connections", { exact: true })).toBeVisible();
    await expect(navigation.getByText("Team", { exact: true })).toBeVisible();
    await expect(navigation.getByText("Customers", { exact: true })).toHaveCount(0);
    await expect(navigation.getByText("Manage providers", { exact: true })).toHaveCount(0);
    await expect(navigation.getByText("Settings", { exact: true })).toHaveCount(0);
  });

  test("can view an assigned service but cannot edit it", async ({ page }) => {
    await page.goto("/dashboard/services");
    const content = page.locator("main");
    await expect(content.getByText("Intro Call", { exact: true }).first()).toBeVisible();
    await content.getByText("Intro Call", { exact: true }).first().click();
    await expect(content.getByText(/Read-only service details/).first()).toBeVisible();
    await expect(content.getByRole("button", { name: /save/i })).toHaveCount(0);
  });

  test("can see teammates without provider-management controls", async ({ page }) => {
    await page.goto("/dashboard/team");
    const content = page.locator("main");
    await expect(content.getByText(/Demo Owner/).first()).toBeVisible();
    await expect(content.getByText(/Demo Provider/).first()).toBeVisible();
    await expect(content.getByRole("button", { name: /invite/i })).toHaveCount(0);
  });

  test("cannot open company-wide customer or provider management", async ({ page }) => {
    await page.goto("/dashboard/customers");
    await expect(page).toHaveURL("/dashboard");

    await page.goto("/dashboard/providers");
    await expect(page).toHaveURL("/dashboard");
  });

  test("can use personal calendar APIs but not instance settings", async ({ page }) => {
    const calendars = await page.request.get("/api/google-calendar/calendars");
    expect(calendars.status()).toBe(200);

    const settings = await page.request.get("/api/settings?key=smtp");
    expect(settings.status()).toBe(403);
  });
});
