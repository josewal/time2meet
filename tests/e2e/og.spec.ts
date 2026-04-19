import { test, expect } from "@playwright/test";
import { createEventViaApi } from "./helpers";

// Visual regression for the Slack/Twitter unfurl image.
//
// Inputs are pinned (title, dates, slot window, picks) so the rendered PNG is
// byte-deterministic across runs. To refresh the baseline after an intentional
// design change, run: `npm run test:e2e -- --update-snapshots`.
test("og.png renders the expected unfurl preview", async ({
  request,
  playwright,
  baseURL,
}) => {
  const dates = ["2099-01-15", "2099-01-16", "2099-01-17"];
  const { id } = await createEventViaApi(request, {
    title: "OG Snapshot Fixture",
    dates,
    startTime: "09:00",
    endTime: "17:00",
    slotMinutes: 30,
  });

  const slotsPerDay = 16; // (17 - 9) * 60 / 30
  const participants: Array<{ name: string; picks: number[] }> = [
    { name: "Alice", picks: [0, 1, 2, 3, 4, slotsPerDay, slotsPerDay + 1] },
    { name: "Bob", picks: [1, 2, 3, slotsPerDay, slotsPerDay + 1, 2 * slotsPerDay] },
    { name: "Carol", picks: [2, 3, slotsPerDay + 1, 2 * slotsPerDay, 2 * slotsPerDay + 1] },
  ];

  for (const p of participants) {
    const ctx = await playwright.request.newContext({ baseURL });
    try {
      const idRes = await ctx.post(`/event/${id}/identify`, {
        form: { name: p.name },
      });
      expect(idRes.status()).toBe(200);

      const apiRes = await ctx.get(`/api/event/${id}`);
      expect(apiRes.status()).toBe(200);
      const meId = (await apiRes.json())?.me?.id as string | undefined;
      expect(meId).toBeTruthy();

      const save = await ctx.put(`/api/event/${id}/cells`, {
        data: { participantId: meId, slotIndices: p.picks },
      });
      expect(save.status()).toBe(200);
    } finally {
      await ctx.dispose();
    }
  }

  const res = await request.get(`/event/${id}/og.png`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");

  const buf = Buffer.from(await res.body());
  // Reject empty / tiny payloads early — gives a clearer failure than a snapshot diff.
  expect(buf.length).toBeGreaterThan(2000);
  // PNG magic + IHDR width/height (bytes 16..24). Catches dimension regressions
  // even without a baseline snapshot present.
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(buf.readUInt32BE(16)).toBe(1200);
  expect(buf.readUInt32BE(20)).toBe(630);

  // Pixel-compare against the committed baseline. Tight tolerance: workers-og
  // is deterministic in workerd, so the only expected drift is sub-pixel
  // anti-aliasing across satori releases. ~750 px out of 756 000.
  expect(buf).toMatchSnapshot("og-event-fixture.png", {
    maxDiffPixelRatio: 0.001,
  });
});
