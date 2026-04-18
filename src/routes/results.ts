import { Hono } from "hono";
import type { Env } from "../env";
import { createDB } from "../db/client";
import { getEvent, listParticipants } from "../db/queries";
import { results } from "../views/results";

export const resultsRoute = new Hono<{ Bindings: Env }>();

resultsRoute.get("/event/:id/results", async (c) => {
  const id = c.req.param("id");
  const db = createDB(c.env);
  const ev = await getEvent(db, id);
  if (!ev) {
    return c.html('<div class="error">Event not found.</div>', 404);
  }
  const parts = await listParticipants(db, id);
  return c.html(results(ev, parts));
});
