import { test, expect } from "@playwright/test";
import { createEventViaApi } from "./helpers";

test("admin can delete a participant; results reflect the removal", async ({ browser, request }) => {
  // The admin cookie is set on the `request` context that creates the event.
  const { id } = await createEventViaApi(request);

  const partCtx = await browser.newContext();
  const partPage = await partCtx.newPage();
  await partPage.goto(`/event/${id}`);
  await partPage.fill('input[name="name"]', "Eve");
  await partPage.click('form.identify button[type="submit"]');
  await expect(partPage.locator("#grid")).toBeVisible();

  // Derive the participant id from the server so we don't race HTMX script execution.
  const apiBody = await (await partPage.request.get(`/api/event/${id}`)).json();
  const participantId = apiBody?.me?.id;
  expect(participantId).toBeTruthy();
  await partCtx.close();

  const del = await request.delete(`/event/${id}/participant/${participantId}`);
  expect(del.status()).toBe(200);

  const res = await request.get(`/event/${id}/results`);
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).not.toContain("Eve");
  expect(html).toMatch(/(0\s+responses?|no\s+responses)/i);
});

test("non-admin cannot delete a participant", async ({ browser, request }) => {
  const { id } = await createEventViaApi(request);

  const partCtx = await browser.newContext();
  const partPage = await partCtx.newPage();
  await partPage.goto(`/event/${id}`);
  await partPage.fill('input[name="name"]', "Frank");
  await partPage.click('form.identify button[type="submit"]');
  await expect(partPage.locator("#grid")).toBeVisible();
  const apiBody = await (await partPage.request.get(`/api/event/${id}`)).json();
  const participantId = apiBody?.me?.id;
  expect(participantId).toBeTruthy();

  const del = await partPage.request.delete(`/event/${id}/participant/${participantId}`);
  expect(del.status()).toBe(403);
  await partCtx.close();
});
