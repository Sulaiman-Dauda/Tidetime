import { test, expect } from "@playwright/test";

const COMPANY = process.env.E2E_COMPANY ?? "demo-company";
const SERVICE = process.env.E2E_SERVICE ?? "intro";

test.describe("company booking flow", () => {
  test("lists the company service", async ({ page }) => {
    await page.goto(`/book/${COMPANY}`);
    await expect(page.getByRole("heading", { name: "Intro Call" })).toBeVisible();
  });

  test("books with an available provider", async ({ page }) => {
    await page.goto(`/book/${COMPANY}/${SERVICE}`);
    await page.getByTestId("slot").first().click();
    await page.locator("#name").fill("E2E Tester");
    await page.locator("#email").fill(`e2e-${Date.now()}@example.com`);
    // The public form deliberately rejects submissions within two seconds of
    // the signed server challenge being issued.
    await page.waitForTimeout(2_100);
    await page.getByTestId("confirm-booking").click();
    await expect(page).toHaveURL(/\/booking\//);
    await expect(page.getByText("Intro Call")).toBeVisible();
  });
});
