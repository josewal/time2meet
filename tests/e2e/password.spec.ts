import { test, expect } from "@playwright/test";
import { createEventViaApi } from "./helpers";

test("name claimed with a password rejects the wrong password and accepts the right one", async ({ browser, request }) => {
  const { id } = await createEventViaApi(request);

  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await p1.goto(`/event/${id}`);
  await p1.fill('input[name="name"]', "Carol");
  await p1.fill('input[name="password"]', "hunter2");
  await p1.click('form.identify button[type="submit"]');
  await expect(p1.locator("#grid")).toBeVisible();
  await ctx1.close();

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(`/event/${id}`);
  await p2.fill('input[name="name"]', "Carol");
  await p2.fill('input[name="password"]', "wrong");
  await p2.click('form.identify button[type="submit"]');
  await expect(p2.locator("#identify-error .error")).toContainText(/password/i);
  await expect(p2.locator("#grid")).toHaveCount(0);
  await ctx2.close();

  const ctx3 = await browser.newContext();
  const p3 = await ctx3.newPage();
  await p3.goto(`/event/${id}`);
  await p3.fill('input[name="name"]', "Carol");
  await p3.fill('input[name="password"]', "hunter2");
  await p3.click('form.identify button[type="submit"]');
  await expect(p3.locator("#grid")).toBeVisible();
  await ctx3.close();
});

test("open name with no password is editable by anyone", async ({ browser, request }) => {
  const { id } = await createEventViaApi(request);

  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await p1.goto(`/event/${id}`);
  await p1.fill('input[name="name"]', "Dave");
  await p1.click('form.identify button[type="submit"]');
  await expect(p1.locator("#grid")).toBeVisible();
  await ctx1.close();

  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(`/event/${id}`);
  await p2.fill('input[name="name"]', "Dave");
  await p2.click('form.identify button[type="submit"]');
  await expect(p2.locator("#grid")).toBeVisible();
  await ctx2.close();
});

test("identify without a name shows an inline error", async ({ page, request }) => {
  const { id } = await createEventViaApi(request);
  await page.goto(`/event/${id}`);
  // Bypass HTML5 required by posting directly the way HTMX would.
  const status = await page.evaluate(async (eid) => {
    const fd = new FormData();
    fd.set("name", "");
    const r = await fetch(`/event/${eid}/identify`, { method: "POST", body: fd });
    return { status: r.status, body: await r.text() };
  }, id);
  expect(status.status).toBe(200);
  expect(status.body).toMatch(/Name must be/);
});
