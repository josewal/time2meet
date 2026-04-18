import { Hono } from "hono";
import type { Env } from "../env";
import { createDB } from "../db/client";
import {
  getEvent,
  getParticipantById,
  listParticipants,
  saveCells,
} from "../db/queries";
import { parseCookies, verifyCookie } from "../lib/cookies";

export const cellsRoute = new Hono<{ Bindings: Env }>();

cellsRoute.get("/api/event/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDB(c.env);
  const ev = await getEvent(db, id);
  if (!ev) return c.json({ error: "not found" }, 404);

  const participants = await listParticipants(db, id);

  const cookies = parseCookies(c.req.header("cookie"));
  const signed = cookies[`p_${id}`];
  let me: { id: string; name: string } | null = null;
  if (signed) {
    const pid = await verifyCookie(signed, c.env.COOKIE_SECRET);
    if (pid) {
      const candidate = await getParticipantById(db, pid);
      if (candidate && candidate.event_id === id) {
        me = { id: candidate.id, name: candidate.name };
      }
    }
  }

  const cells: Record<string, number[]> = {};
  for (const p of participants) cells[p.id] = p.cells;

  return c.json({
    id: ev.id,
    title: ev.title,
    slots: ev.slots,
    participants: participants.map((p) => ({ id: p.id, name: p.name })),
    cells,
    me,
  });
});

cellsRoute.put("/api/event/:id/cells", async (c) => {
  const eventId = c.req.param("id");
  const db = createDB(c.env);
  const ev = await getEvent(db, eventId);
  if (!ev) return c.json({ error: "not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  if (!body || typeof body !== "object") {
    return c.json({ error: "invalid body" }, 400);
  }
  const b = body as { participantId?: unknown; slotIndices?: unknown };
  const participantId =
    typeof b.participantId === "string" ? b.participantId : null;
  if (!participantId) return c.json({ error: "participantId required" }, 400);
  if (!Array.isArray(b.slotIndices)) {
    return c.json({ error: "slotIndices must be an array" }, 400);
  }

  const cookies = parseCookies(c.req.header("cookie"));
  const signed = cookies[`p_${eventId}`];
  if (!signed) return c.json({ error: "forbidden" }, 403);
  const cookiePid = await verifyCookie(signed, c.env.COOKIE_SECRET);
  if (!cookiePid || cookiePid !== participantId) {
    return c.json({ error: "forbidden" }, 403);
  }

  const participant = await getParticipantById(db, participantId);
  if (!participant || participant.event_id !== eventId) {
    return c.json({ error: "forbidden" }, 403);
  }

  const max = ev.slots.length;
  const set = new Set<number>();
  for (const raw of b.slotIndices) {
    if (typeof raw !== "number" || !Number.isInteger(raw)) {
      return c.json({ error: "invalid slot index" }, 400);
    }
    if (raw < 0 || raw >= max) {
      return c.json({ error: "slot index out of range" }, 400);
    }
    set.add(raw);
  }
  const sorted = [...set].sort((a, b) => a - b);

  const { updatedAt } = await saveCells(db, participantId, sorted);
  return c.json({ ok: true, updatedAt });
});
