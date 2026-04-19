import { Hono } from "hono";
import type { Env } from "../env";
import { layout } from "../views/layout";
import { landing } from "../views/landing";

export const pagesLandingRoute = new Hono<{ Bindings: Env }>();

pagesLandingRoute.get("/", (c) => {
  const html = layout(
    {
      title: "time2meet",
      description: "Minimal shared availability, no login required.",
    },
    landing(),
  );
  return c.html(html);
});
