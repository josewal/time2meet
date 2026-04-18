import { test, expect } from "@playwright/test";
import { createEventViaApi, futureDates, uniqueTitle } from "./helpers";

test("landing page renders the create-event form", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("when2meet-better");
  await expect(page.locator("form.create-event")).toBeVisible();
  await expect(page.locator('input[name="title"]')).toBeVisible();
  await expect(page.locator("#dates-input")).toHaveAttribute("type", "hidden");
});

test("submitting the create form redirects to the new event page", async ({ page }) => {
  const title = uniqueTitle("create");
  const dates = futureDates(2);

  await page.goto("/");
  await page.fill('input[name="title"]', title);
  await page.evaluate((v) => {
    const el = document.getElementById("dates-input") as HTMLInputElement;
    el.value = v;
  }, dates.join(","));
  await page.fill('input[name="startTime"]', "09:00");
  await page.fill('input[name="endTime"]', "11:00");
  await page.selectOption('select[name="slotMinutes"]', "30");

  await Promise.all([
    page.waitForURL(/\/event\/[A-Za-z0-9_-]+$/),
    page.click('button[type="submit"]'),
  ]);

  await expect(page.locator("h1")).toHaveText(title);
  await expect(page.locator("form.identify")).toBeVisible();
});

test("create form rejects an empty title inline", async ({ page }) => {
  // Bypass HTML5 validation by submitting via fetch the way HTMX would.
  await page.goto("/");
  const status = await page.evaluate(async () => {
    const fd = new FormData();
    fd.set("title", "");
    fd.set("dates", "2099-01-01");
    fd.set("startTime", "09:00");
    fd.set("endTime", "10:00");
    fd.set("slotMinutes", "30");
    const r = await fetch("/events", { method: "POST", body: fd });
    return r.status;
  });
  expect(status).toBe(400);
});

test("identify then save cells round-trips and persists across reloads", async ({ page, request }) => {
  const { id } = await createEventViaApi(request);

  await page.goto(`/event/${id}`);
  await page.fill('input[name="name"]', "Alice");
  await page.click('form.identify button[type="submit"]');

  await expect(page.locator("#grid")).toBeVisible();

  // Read the server-derived participant id so we don't race HTMX script evaluation.
  const apiRes = await page.request.get(`/api/event/${id}`);
  expect(apiRes.status()).toBe(200);
  const apiBody = await apiRes.json();
  const meId = apiBody?.me?.id;
  expect(meId).toBeTruthy();
  expect(Array.isArray(apiBody.slots) && apiBody.slots.length).toBeGreaterThan(0);

  // page.request shares the browser cookie jar, so the p_<id> cookie is sent.
  const picks = [0, 1, 2];
  const save = await page.request.put(`/api/event/${id}/cells`, {
    data: { participantId: meId, slotIndices: picks },
  });
  expect(save.status()).toBe(200);
  const body = await save.json();
  expect(body.ok).toBe(true);

  await page.reload();
  await expect(page.locator(".left")).toContainText("editing as");
  for (const s of picks) {
    await expect(page.locator(`#grid .cell[data-slot="${s}"]`)).toHaveClass(/selected/);
  }
});

test("results endpoint reflects saved availability", async ({ page, request }) => {
  const { id } = await createEventViaApi(request);
  await page.goto(`/event/${id}`);
  await page.fill('input[name="name"]', "Bob");
  await page.click('form.identify button[type="submit"]');
  await expect(page.locator("#grid")).toBeVisible();

  const apiBody = await (await page.request.get(`/api/event/${id}`)).json();
  const meId = apiBody?.me?.id;
  expect(meId).toBeTruthy();

  const save = await page.request.put(`/api/event/${id}/cells`, {
    data: { participantId: meId, slotIndices: [0, 1] },
  });
  expect(save.status()).toBe(200);

  const res = await request.get(`/event/${id}/results`);
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toMatch(/1\s+responses?/);
  expect(html).toContain("Bob");
  expect(html).toMatch(/Best times/i);
});

test("cells API rejects writes without the right participant cookie", async ({ request }) => {
  const { id } = await createEventViaApi(request);
  const res = await request.put(`/api/event/${id}/cells`, {
    data: { participantId: "nope", slotIndices: [0] },
  });
  expect(res.status()).toBe(403);
});

test("unknown event returns 404", async ({ page }) => {
  const res = await page.goto("/event/does-not-exist");
  expect(res?.status()).toBe(404);
});
