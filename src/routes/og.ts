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

  // First and last slot times, for left-axis labels.
  const firstSlotTime = ev.slots.length > 0 ? ev.slots[0].slice(11) : "";
  const lastSlotTime =
    ev.slots.length > 0 ? ev.slots[slotsPerDay - 1].slice(11) : "";
  // Optional mid-point time, derived from slotsPerDay and the first two slots.
  let midSlotTime = "";
  if (slotsPerDay >= 3 && ev.slots.length >= 2) {
    const startMin = hhmmToMin(ev.slots[0].slice(11));
    const step = hhmmToMin(ev.slots[1].slice(11)) - startMin;
    const midIdx = Math.floor(slotsPerDay / 2);
    midSlotTime = minToHHMM(startMin + midIdx * step);
  }

  // ----- Layout constants -----
  // Sizing is tight: 630px image - 24 outer margin x2 - 48 card padding x2 ≈ 438px
  // of vertical room for title + pill + heatmap + footer. Every number below is
  // picked so the full stack fits without overflow at 3+ days / 16 slots-per-day.
  const IMG_W = 1200;
  const IMG_H = 630;
  const OUTER_MARGIN = 24;
  const CARD_PAD = 48;
  const CARD_W = IMG_W - OUTER_MARGIN * 2; // 1152
  const CARD_H = IMG_H - OUTER_MARGIN * 2; // 582
  const CONTENT_W = CARD_W - CARD_PAD * 2; // 1056

  // Heatmap geometry — used for the 1+ response states.
  // COL_MAX_WIDTH is generous so 2-3 day heatmaps don't look stranded in the
  // card; the `Math.min` against available-width-per-day clamps us back down
  // for dense 7-day ranges (7 * 48 + gaps fits in the ~990px column gutter).
  const COL_MAX_WIDTH = 200;
  const SINGLE_DAY_COL_WIDTH = 280;
  const DOW_LABEL_H = 24; // row of M T W ... above columns
  const TIME_AXIS_W = 64; // left column with 09:00 / 17:00 labels
  const RECT_GAP = 2;
  // Height reserved for the column rects themselves.
  const HEATMAP_H = parts.length === 1 ? 240 : 300;
  const rectH =
    slotsPerDay === 0
      ? 0
      : Math.max(1, Math.floor(HEATMAP_H / slotsPerDay) - RECT_GAP);
  // Width available for the columns themselves (card content minus the time axis gutter).
  const heatmapInnerW = CONTENT_W - TIME_AXIS_W;
  const colW =
    days.length === 0
      ? 0
      : days.length === 1
        ? SINGLE_DAY_COL_WIDTH
        : Math.min(COL_MAX_WIDTH, Math.floor((heatmapInnerW - 4 * (days.length - 1)) / days.length));

  // ----- Columns (rect grid) HTML -----
  const columnsHtml = days
    .map((d, dayIdx) => {
      const rects: string[] = [];
      for (let r = 0; r < slotsPerDay; r++) {
        const slotIndex = dayIdx * slotsPerDay + r;
        const c0 = counts[slotIndex] || 0;
        const intensity = c0 / maxCount; // 0..1
        const bg =
          c0 === 0 ? "#ececec" : `rgba(16, 185, 129, ${0.15 + intensity * 0.85})`;
        rects.push(
          `<div style="width:${colW}px; height:${rectH}px; background:${bg}; margin-bottom:${RECT_GAP}px; display:flex; flex-shrink:0;"></div>`,
        );
      }
      // Day-of-week letter above each column.
      const letter = dayOfWeekLetter(d);
      const col = `<div style="display:flex; flex-direction:column; align-items:center; margin-right:${dayIdx === days.length - 1 ? 0 : 4}px; flex-shrink:0;">
        <div style="display:flex; height:${DOW_LABEL_H}px; width:${colW}px; align-items:center; justify-content:center; font-size:20px; color:#888; letter-spacing:2px; flex-shrink:0;">${letter}</div>
        <div style="display:flex; flex-direction:column; align-items:stretch; flex-shrink:0;">${rects.join("")}</div>
      </div>`;
      return col;
    })
    .join("");

  // ----- Left time-axis HTML -----
  // Top label sits aligned with the first rect; bottom aligned with the last rect.
  // We use a fixed-height container matching DOW_LABEL_H + HEATMAP_H so absolute
  // alignment by flex space-between works. Satori supports flex ok; use justify-content.
  const timeAxisH = DOW_LABEL_H + HEATMAP_H;
  const timeAxisHtml = `
    <div style="display:flex; flex-direction:column; width:${TIME_AXIS_W}px; height:${timeAxisH}px; padding-top:${DOW_LABEL_H}px; padding-right:12px; justify-content:space-between; align-items:flex-end; flex-shrink:0; font-size:20px; color:#888;">
      <div style="display:flex;">${escapeHtml(firstSlotTime)}</div>
      ${midSlotTime ? `<div style="display:flex;">${escapeHtml(midSlotTime)}</div>` : ""}
      <div style="display:flex;">${escapeHtml(lastSlotTime)}</div>
    </div>
  `;

  const heatmapBlock = `
    <div style="display:flex; flex-direction:row; align-items:flex-start; justify-content:center; flex-shrink:0; width:100%;">
      ${timeAxisHtml}
      <div style="display:flex; flex-direction:row; align-items:flex-start; flex-shrink:0;">${columnsHtml}</div>
    </div>
  `;

  // ----- Text pieces -----
  const titleEscaped = clipTitle(escapeHtml(ev.title), 50);
  // Day-of-week / recurring mode stores slots against sentinel dates in the
  // 1970-01-04..1970-01-10 week. Concrete calendar dates would be meaningless
  // there, so suppress the date pill — the column letters already label the days.
  const isRecurring = days.length > 0 && days[0].startsWith("1970-01-");
  const dateRangeText =
    days.length === 0 || isRecurring
      ? ""
      : days.length === 1
        ? formatDay(days[0])
        : `${formatDay(days[0])} – ${formatDay(days[days.length - 1])}`;
  const datePill = dateRangeText
    ? `<div style="display:flex; padding:8px 16px; background:#eef2ff; color:#4338ca; font-size:22px; border-radius:999px; flex-shrink:0;">${escapeHtml(dateRangeText)}</div>`
    : "";

  // Metadata caption rendered next to the date pill — keeps the header unified
  // instead of orphaning the response count at the bottom of the card.
  let metaCaption = "";
  if (parts.length === 1) {
    const firstName = escapeHtml(parts[0].name || "Someone");
    metaCaption = `${firstName} · 1 response`;
  } else if (parts.length >= 2) {
    metaCaption = `${parts.length} responses`;
  }
  const metaRow =
    datePill || metaCaption
      ? `<div style="display:flex; flex-direction:row; align-items:center; margin-top:16px; flex-shrink:0;">
          ${datePill}
          ${
            metaCaption
              ? `<div style="display:flex; margin-left:14px; font-size:22px; color:#64748b;">${escapeHtml(metaCaption)}</div>`
              : ""
          }
        </div>`
      : "";

  // ----- State-specific middle block -----
  let middleBlock = "";
  if (parts.length === 0) {
    // Empty state: big invitation as the hero.
    middleBlock = `
      <div style="display:flex; flex-direction:column; flex-grow:1; align-items:flex-start; justify-content:center;">
        <div style="display:flex; font-size:48px; line-height:1.15; color:#0f172a; letter-spacing:-0.5px;">Be the first to pick times</div>
        <div style="display:flex; margin-top:14px; font-size:24px; color:#64748b;">Open to add your availability.</div>
      </div>
    `;
  } else {
    // 1+ response: heatmap fills the middle; metadata already lives in the header row.
    middleBlock = `
      <div style="display:flex; flex-direction:column; flex-grow:1; justify-content:center;">
        ${heatmapBlock}
      </div>
    `;
  }

  // ----- Outer shell + card -----
  const html = `
    <div style="width:${IMG_W}px; height:${IMG_H}px; display:flex; padding:${OUTER_MARGIN}px; background:linear-gradient(135deg, #fafbff 0%, #f1f5f9 100%); font-family:Inter;">
      <div style="width:${CARD_W}px; height:${CARD_H}px; display:flex; flex-direction:column; padding:${CARD_PAD}px; background:#ffffff; border-radius:24px; box-shadow:0 8px 32px rgba(15, 23, 42, 0.08);">
        <div style="display:flex; flex-direction:column; flex-shrink:0;">
          <div style="display:flex; font-size:60px; line-height:1.1; color:#0f172a; letter-spacing:-1px; flex-shrink:0;">${titleEscaped}</div>
          ${metaRow}
        </div>
        ${middleBlock}
      </div>
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

function clipTitle(s: string, max: number): string {
  // Assumes `s` is already HTML-escaped; we only count/slice code units, which
  // is fine since we don't cut inside an entity (the entity shapes are short
  // and the 50-char cap is plenty past any realistic entity boundary for the
  // titles we see).
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
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

function dayOfWeekLetter(ymd: string): string {
  // 0=Sun..6=Sat. Sun=S is ambiguous with Sat=S, accepted per design spec —
  // column position plus the date-range pill disambiguates.
  const letters = ["S", "M", "T", "W", "T", "F", "S"];
  const dow = new Date(ymd + "T00:00:00Z").getUTCDay();
  if (isNaN(dow)) return "";
  return letters[dow] ?? "";
}

function hhmmToMin(s: string): number {
  const hh = parseInt(s.slice(0, 2), 10);
  const mm = parseInt(s.slice(3, 5), 10);
  if (isNaN(hh) || isNaN(mm)) return 0;
  return hh * 60 + mm;
}

function minToHHMM(m: number): string {
  const clamped = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = Math.floor(clamped / 60);
  const mm = clamped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
