import { Hono, type Context } from "hono";
import type { Env } from "../env";
import { createDB } from "../db/client";
import {
  createParticipant,
  getEvent,
  getParticipantByName,
} from "../db/queries";
import { buildSetCookie, signCookie } from "../lib/cookies";
import {
  deriveDaysAndPerDay,
  editingAsBody,
  identifyErrorFragment,
  type EventClientData,
} from "../views/fragments";

export const identifyRoute = new Hono<{ Bindings: Env }>();

function sendIdentifyError(c: Context<{ Bindings: Env }>, msg: string) {
  c.header("HX-Reswap", "innerHTML");
  c.header("HX-Retarget", "#identify-error");
  return c.html(identifyErrorFragment(msg), 200);
}

identifyRoute.post("/event/:id/logout", async (c) => {
  const eventId = c.req.param("id");
  const cleared = buildSetCookie(`p_${eventId}`, "", {
    path: "/",
    maxAge: 0,
    secure: true,
  });
  c.header("Set-Cookie", cleared);
  c.header("HX-Redirect", `/event/${eventId}`);
  return c.body(null, 204);
});

identifyRoute.post("/event/:id/identify", async (c) => {
  const eventId = c.req.param("id");
  const form = await c.req.parseBody();

  const name = typeof form.name === "string" ? form.name.trim() : "";
  if (name.length < 1 || name.length > 60) {
    return sendIdentifyError(c, "Name must be 1..60 characters.");
  }

  const db = createDB(c.env);
  const ev = await getEvent(db, eventId);
  if (!ev) return c.text("not found", 404);

  const existing = await getParticipantByName(db, eventId, name);
  const me = existing ?? (await createParticipant(db, { eventId, name }));

  const signed = await signCookie(me.id, c.env.COOKIE_SECRET);
  const setCookie = buildSetCookie(`p_${eventId}`, signed, {
    path: "/",
    maxAge: 2_592_000,
    secure: true,
  });
  c.header("Set-Cookie", setCookie);

  const { days, slotsPerDay } = deriveDaysAndPerDay(ev.slots);
  const clientData: EventClientData = {
    id: ev.id,
    slots: ev.slots,
    slotsPerDay,
    days,
    me: { id: me.id, name: me.name },
  };
  c.header("Content-Type", "text/html; charset=utf-8");
  return c.body(editingAsBody(clientData, me.name, me.cells));
});
