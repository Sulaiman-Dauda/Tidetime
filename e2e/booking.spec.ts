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
    await expect(
      page.getByRole("heading", { name: "Select a date & time" }),
    ).toBeVisible();
    await expect(page.getByTestId("day-available").first()).toBeVisible();
    // Calendly-style confirm: the first click arms the slot, the split "Next"
    // button commits it.
    await page.getByTestId("slot").first().click();
    await page.getByTestId("slot-confirm").click();
    await expect(page.getByRole("heading", { name: "Enter your details" })).toBeVisible();
    await page.locator("#name").fill("E2E Tester");
    await page.locator("#email").fill(`e2e-${Date.now()}@example.com`);
    // Phone: the country picker defaults to the company setting (GB), so a
    // national number needs no dialling code typed in.
    await expect(page.getByLabel("Country dialling code")).toHaveText("+44");
    await page.locator("#phone").fill("07700 900123");
    // The public form deliberately rejects submissions within two seconds of
    // the signed server challenge being issued.
    await page.waitForTimeout(2_100);
    await page.getByTestId("confirm-booking").click();
    await expect(page).toHaveURL(/\/booking\//);
    await expect(page.getByText("Intro Call")).toBeVisible();
    // Stored in E.164 and shown grouped, from a number typed without +44.
    await expect(page.getByText("+44 7700 900123").first()).toBeVisible();
  });
});
