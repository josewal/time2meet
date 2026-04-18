import { Hono } from "hono";
import { ImageResponse } from "workers-og";
import type { Env } from "../env";
import { createDB } from "../db/client";
import { getEvent, listParticipants } from "../db/queries";
import { computeHeatmap } from "../lib/heatmap";
import { interRegular } from "../fonts/inter-regular";

export const ogRoute = new Hono<{ Bindings: Env }>();

ogRoute.get("/event/:id/og.png", async (c) => {
  const id = c.req.param("id");
  const db = createDB(c.env);
  const ev = await getEvent(db, id);
  if (!ev) return c.text("not found", 404);

  const parts = await listParticipants(db, id);
  const counts = computeHeatmap(
    ev.slots.length,
    parts.map((p) => ({ id: p.id, name: p.name, slotIndices: p.cells })),
  );

  // Cache key pinned to event.updated_at so each vote invalidates.
  const cacheKey = new Request(
    new URL(c.req.url).origin + `/__og/${id}?v=${ev.updated_at}`,
    { method: "GET" },
  );
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // Unique days in input order.
  const days: string[] = [];
  const firstDays = new Set<string>();
  for (const s of ev.slots) {
    const d = s.slice(0, 10); // YYYY-MM-DD
    if (!firstDays.has(d)) {
      firstDays.add(d);
      days.push(d);
    }
  }
  const slotsPerDay = days.length === 0 ? 0 : Math.round(ev.slots.length / days.length);
  const maxCount = counts.reduce((m, x) => (x > m ? x : m), 0) || 1;

  // Build the heatmap column HTML.
  // Each column is a flex column of rectangles (one per slot-of-day). Rect height is even.
  const COL_MAX_WIDTH = 56;
  const IMG_W = 1200;
  const IMG_H = 630;
  const HEATMAP_H = 380;
  const rectH = slotsPerDay === 0 ? 0 : Math.max(2, Math.floor(HEATMAP_H / slotsPerDay));
  const availableWidth = IMG_W - 120;
  const colW =
    days.length === 0 ? 0 : Math.min(COL_MAX_WIDTH, Math.floor(availableWidth / days.length));

  const columnsHtml = days
    .map((_, dayIdx) => {
      const rects: string[] = [];
      for (let r = 0; r < slotsPerDay; r++) {
        const slotIndex = dayIdx * slotsPerDay + r;
        const c0 = counts[slotIndex] || 0;
        const intensity = c0 / maxCount; // 0..1
        const bg =
          c0 === 0 ? "#ececec" : `rgba(16, 185, 129, ${0.15 + intensity * 0.85})`;
        rects.push(
          `<div style="width:${colW}px; height:${rectH}px; background:${bg}; margin-bottom:2px; display:flex;"></div>`,
        );
      }
      return `<div style="display:flex; flex-direction:column; margin-right:4px; align-items:stretch;">${rects.join("")}</div>`;
    })
    .join("");

  const titleEscaped = escapeHtml(ev.title).slice(0, 60);
  const dateRange =
    days.length === 0
      ? ""
      : days.length === 1
        ? formatDay(days[0])
        : `${formatDay(days[0])} – ${formatDay(days[days.length - 1])}`;
  const subtitleEscaped = `${escapeHtml(dateRange)}  ·  ${parts.length} ${
    parts.length === 1 ? "response" : "responses"
  }`;

  const html = `
    <div style="width:${IMG_W}px; height:${IMG_H}px; display:flex; flex-direction:column; padding:60px; background:#fafafa; font-family:Inter;">
      <div style="display:flex; font-size:56px; color:#1a1a1a; font-weight:400;">${titleEscaped}</div>
      <div style="display:flex; font-size:28px; color:#666; margin-top:12px;">${subtitleEscaped}</div>
      <div style="display:flex; flex-direction:row; margin-top:48px; align-items:flex-start;">${columnsHtml}</div>
      <div style="display:flex; margin-top:auto; font-size:22px; color:#999;">when2meet-better</div>
    </div>
  `;

  const res = new ImageResponse(html, {
    width: IMG_W,
    height: IMG_H,
    fonts: [{ name: "Inter", data: interRegular, weight: 400, style: "normal" }],
  });
  res.headers.set("cache-control", "public, max-age=31536000, immutable");
  c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

function formatDay(ymd: string): string {
  // "2026-04-20" -> "Apr 20"
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const m = parseInt(ymd.slice(5, 7), 10);
  const d = parseInt(ymd.slice(8, 10), 10);
  if (isNaN(m) || isNaN(d)) return ymd;
  return `${months[m - 1]} ${d}`;
}
