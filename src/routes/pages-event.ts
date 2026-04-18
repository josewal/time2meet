import { Hono } from "hono";
import type { Env } from "../env";
import { createDB } from "../db/client";
import { getEvent, getParticipantById, listParticipants } from "../db/queries";
import { parseCookies, verifyCookie } from "../lib/cookies";
import { layout } from "../views/layout";
import { event as eventView } from "../views/event";

export const pagesEventRoute = new Hono<{ Bindings: Env }>();

pagesEventRoute.get("/event/:id", async (c) => {
  const id = c.req.param("id");
  const db = createDB(c.env);
  const ev = await getEvent(db, id);
  if (!ev) return c.text("not found", 404);

  const cookies = parseCookies(c.req.header("cookie"));
  const signed = cookies[`p_${id}`];
  let me = null;
  if (signed) {
    const pid = await verifyCookie(signed, c.env.COOKIE_SECRET);
    if (pid) {
      const candidate = await getParticipantById(db, pid);
      if (candidate && candidate.event_id === id) me = candidate;
    }
  }

  const parts = await listParticipants(db, id);

  const host = new URL(c.req.url);
  const ogImageUrl = `${host.origin}/event/${id}/og.png?v=${ev.updated_at}`;
  const ogUrl = `${host.origin}/event/${id}`;

  const html = layout(
    {
      title: `${ev.title} · when2meet-better`,
      description: `${parts.length} responses. Click to add your availability.`,
      ogImageUrl,
      ogUrl,
    },
    eventView(ev, me, parts, ogUrl),
  );
  return c.html(html);
});
