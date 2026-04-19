import { test, expect } from "@playwright/test";
import { createEventViaApi } from "./helpers";

test("identify panel: submitting the form swaps in the editing-as UI without a reload", async ({ page, request }) => {
  const { id } = await createEventViaApi(request);

  await page.goto(`/event/${id}`);

  // Before submitting, we see the form and the hint copy.
  await expect(page.locator("form.identify")).toBeVisible();
  await expect(page.locator(".panel.left .panel-title")).toHaveText("Your name");

  await page.fill('input[name="name"]', "Josef");
  await page.click('form.identify button[type="submit"]');

  // Grid should appear…
  await expect(page.locator("#grid")).toBeVisible();

  // …and the form + old heading + hint should be gone.
  await expect(page.locator("form.identify")).toHaveCount(0);
  await expect(page.locator(".panel.left .hint")).toHaveCount(0);

  // The "editing as <name> · switch name" block should now be visible.
  const me = page.locator(".panel.left .me");
  await expect(me).toBeVisible();
  await expect(me).toContainText("editing as");
  await expect(me.locator("strong")).toHaveText("Josef");
  await expect(me.locator("button.linkish")).toHaveText("switch name");

  // Panel title should flip from "Your name" to "Your availability".
  await expect(page.locator(".panel.left .panel-title")).toHaveText("Your availability");
});

test("identify panel: input and Enter button are visually balanced", async ({ page, request }) => {
  const { id } = await createEventViaApi(request);
  await page.goto(`/event/${id}`);

  const input = page.locator('form.identify input[name="name"]');
  const button = page.locator('form.identify button[type="submit"]');

  await expect(input).toBeVisible();
  await expect(button).toBeVisible();

  const inputBox = await input.boundingBox();
  const buttonBox = await button.boundingBox();
  if (!inputBox || !buttonBox) throw new Error("missing bounding box");

  // Input should clearly dominate horizontally — at least 2x the button width.
  expect(inputBox.width).toBeGreaterThan(buttonBox.width * 2);

  // Heights should line up (within 2px of each other).
  expect(Math.abs(inputBox.height - buttonBox.height)).toBeLessThanOrEqual(2);

  // Tops should line up (no vertical drift from mismatched box model).
  expect(Math.abs(inputBox.y - buttonBox.y)).toBeLessThanOrEqual(1);
});
