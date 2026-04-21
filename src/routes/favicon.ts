import { Hono } from "hono";
import type { Env } from "../env";
import { createDB } from "../db/client";
import { getEvent, listParticipants } from "../db/queries";
import { computeHeatmap } from "../lib/heatmap";

export const faviconRoute = new Hono<{ Bindings: Env }>();

const GRID = 4;
const SIZE = 32;
const CELL = 7;
const GAP = 1;
const OFFSET = 1;

faviconRoute.get("/event/:id/favicon.svg", async (c) => {
  const id = c.req.param("id");
  const db = createDB(c.env);
  const ev = await getEvent(db, id);
  if (!ev) return c.text("not found", 404);

  const parts = await listParticipants(db, id);
  const counts = computeHeatmap(
    ev.slots.length,
    parts.map((p) => ({ id: p.id, name: p.name, slotIndices: p.cells })),
  );

  const days: string[] = [];
  const seen = new Set<string>();
  for (const s of ev.slots) {
    const d = s.slice(0, 10);
    if (!seen.has(d)) {
      seen.add(d);
      days.push(d);
    }
  }
  const slotsPerDay = days.length === 0 ? 0 : Math.round(ev.slots.length / days.length);

  const cells = downsample(counts, days.length, slotsPerDay);
  const maxCell = cells.reduce((m, x) => (x > m ? x : m), 0);

  const rects: string[] = [];
  for (let r = 0; r < GRID; r++) {
    for (let col = 0; col < GRID; col++) {
      const v = cells[r * GRID + col];
      const intensity = maxCell === 0 ? 0 : v / maxCell;
      const opacity = v === 0 ? 0.12 : 0.25 + intensity * 0.75;
      const x = OFFSET + col * (CELL + GAP);
      const y = OFFSET + r * (CELL + GAP);
      rects.push(
        `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" opacity="${round(opacity)}"/>`,
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}"><g fill="#10b981">${rects.join("")}</g></svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
});

function downsample(counts: number[], days: number, slotsPerDay: number): number[] {
  const out = new Array<number>(GRID * GRID).fill(0);
  if (days === 0 || slotsPerDay === 0) return out;

  const sums = new Array<number>(GRID * GRID).fill(0);
  const weights = new Array<number>(GRID * GRID).fill(0);

  for (let d = 0; d < days; d++) {
    const col = Math.min(GRID - 1, Math.floor((d * GRID) / days));
    for (let s = 0; s < slotsPerDay; s++) {
      const row = Math.min(GRID - 1, Math.floor((s * GRID) / slotsPerDay));
      const idx = row * GRID + col;
      sums[idx] += counts[d * slotsPerDay + s] || 0;
      weights[idx] += 1;
    }
  }

  for (let i = 0; i < out.length; i++) {
    out[i] = weights[i] === 0 ? 0 : sums[i] / weights[i];
  }
  return out;
}

function round(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}
