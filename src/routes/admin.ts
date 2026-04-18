import { Hono } from "hono";
import type { Env } from "../env";
import { createDB } from "../db/client";
import {
  getEvent,
  getParticipantById,
  deleteParticipant,
} from "../db/queries";
import { parseCookies, verifyCookie } from "../lib/cookies";

export const adminRoute = new Hono<{ Bindings: Env }>();

adminRoute.delete("/event/:id/participant/:pid", async (c) => {
  const eventId = c.req.param("id");
  const pid = c.req.param("pid");
  const db = createDB(c.env);

  const cookies = parseCookies(c.req.header("cookie"));
  const signed = cookies[`admin_${eventId}`];
  if (!signed) return c.text("forbidden", 403);

  const token = await verifyCookie(signed, c.env.COOKIE_SECRET);
  if (!token) return c.text("forbidden", 403);

  const ev = await getEvent(db, eventId);
  if (!ev) return c.text("forbidden", 403);
  if (token !== ev.admin_token) return c.text("forbidden", 403);

  const participant = await getParticipantById(db, pid);
  if (!participant || participant.event_id !== eventId) {
    return c.text("not found", 404);
  }

  await deleteParticipant(db, pid);
  return c.html("");
});
