import { Hono, type Context } from "hono";
import type { Env } from "../env";
import { createDB } from "../db/client";
import {
  createParticipant,
  getEvent,
  getParticipantByName,
  setParticipantPassword,
  type ParticipantRow,
} from "../db/queries";
import { hashPassword, verifyPassword } from "../lib/password";
import { buildSetCookie, signCookie } from "../lib/cookies";
import {
  deriveDaysAndPerDay,
  gridReady,
  identifyErrorFragment,
  type EventClientData,
} from "../views/fragments";

export const identifyRoute = new Hono<{ Bindings: Env }>();

function sendIdentifyError(c: Context<{ Bindings: Env }>, msg: string) {
  c.header("HX-Reswap", "innerHTML");
  c.header("HX-Retarget", "#identify-error");
  return c.html(identifyErrorFragment(msg), 200);
}

identifyRoute.post("/event/:id/identify", async (c) => {
  const eventId = c.req.param("id");
  const form = await c.req.parseBody();

  const name = typeof form.name === "string" ? form.name.trim() : "";
  if (name.length < 1 || name.length > 60) {
    return sendIdentifyError(c, "Name must be 1..60 characters.");
  }
  const password =
    typeof form.password === "string" && form.password.length > 0
      ? form.password
      : null;
  if (password && password.length > 200) {
    return sendIdentifyError(c, "Password too long.");
  }

  const db = createDB(c.env);
  const ev = await getEvent(db, eventId);
  if (!ev) return c.text("not found", 404);

  const existing = await getParticipantByName(db, eventId, name);

  let me: ParticipantRow;
  if (!existing) {
    let pwHash: string | null = null;
    let pwSalt: string | null = null;
    if (password) {
      const { salt, hash } = await hashPassword(password);
      pwSalt = salt;
      pwHash = hash;
    }
    me = await createParticipant(db, { eventId, name, pwHash, pwSalt });
  } else if (!existing.pw_hash || !existing.pw_salt) {
    if (password) {
      const { salt, hash } = await hashPassword(password);
      await setParticipantPassword(db, existing.id, hash, salt);
      me = { ...existing, pw_hash: hash, pw_salt: salt };
    } else {
      me = existing;
    }
  } else {
    if (!password) {
      return sendIdentifyError(
        c,
        "This name has a password set. Enter the correct one, or choose a different name.",
      );
    }
    const ok = await verifyPassword(password, existing.pw_salt, existing.pw_hash);
    if (!ok) {
      return sendIdentifyError(
        c,
        "This name has a password set. Enter the correct one, or choose a different name.",
      );
    }
    me = existing;
  }

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
  return c.body(gridReady(clientData, me.cells));
});
