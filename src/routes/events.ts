import { Hono } from "hono";
import type { Env } from "../env";
import { createDB } from "../db/client";
import { createEvent } from "../db/queries";
import { materializeSlots, validateSpec, type SlotSpec } from "../lib/slots";
import { buildSetCookie, signCookie } from "../lib/cookies";
import { escape } from "../views/layout";

export const eventsRoute = new Hono<{ Bindings: Env }>();

function errorResponse(c: any, msg: string) {
  c.header("HX-Reswap", "innerHTML");
  c.header("HX-Retarget", "#create-error");
  return c.html(`<div class="error">${escape(msg)}</div>`, 400);
}

eventsRoute.post("/events", async (c) => {
  const form = await c.req.parseBody();

  const rawTitle = typeof form.title === "string" ? form.title.trim() : "";
  if (rawTitle.length < 1 || rawTitle.length > 200) {
    return errorResponse(c, "Title must be 1..200 characters.");
  }

  const rawDates = typeof form.dates === "string" ? form.dates : "";
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const part of rawDates.split(",")) {
    const d = part.trim();
    if (!d) continue;
    if (seen.has(d)) continue;
    seen.add(d);
    dates.push(d);
  }
  if (dates.length === 0) {
    return errorResponse(c, "At least one date is required.");
  }

  const startTime = typeof form.startTime === "string" ? form.startTime : "";
  const endTime = typeof form.endTime === "string" ? form.endTime : "";

  const slotMinutes = Number.parseInt(
    typeof form.slotMinutes === "string" ? form.slotMinutes : "",
    10,
  );
  if (![15, 30, 60].includes(slotMinutes)) {
    return errorResponse(c, "Slot size must be 15, 30, or 60 minutes.");
  }

  const spec: SlotSpec = { dates, startTime, endTime, slotMinutes };

  try {
    validateSpec(spec);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid event spec.";
    return errorResponse(c, msg);
  }

  let slots: string[];
  try {
    slots = materializeSlots(spec);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid event spec.";
    return errorResponse(c, msg);
  }

  const db = createDB(c.env);
  const event = await createEvent(db, { title: rawTitle, slots });

  const signed = await signCookie(event.admin_token, c.env.COOKIE_SECRET);
  const setCookie = buildSetCookie(`admin_${event.id}`, signed, {
    path: `/event/${event.id}`,
    secure: true,
  });
  c.header("Set-Cookie", setCookie);
  c.header("HX-Redirect", `/event/${event.id}`);
  return c.body(null, 200);
});
