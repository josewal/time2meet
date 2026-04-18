import { Hono } from "hono";
import type { Env } from "./env";
import { pagesLandingRoute } from "./routes/pages-landing";
import { eventsRoute } from "./routes/events";
import { resultsRoute } from "./routes/results";
import { adminRoute } from "./routes/admin";
import { pagesEventRoute } from "./routes/pages-event";
import { identifyRoute } from "./routes/identify";
import { cellsRoute } from "./routes/cells";
import { ogRoute } from "./routes/og";

const app = new Hono<{ Bindings: Env }>();

const stub = (name: string) => (c: any) =>
  c.text(`501 not implemented: ${name}`, 501);

app.route("/", pagesLandingRoute);
app.route("/", eventsRoute);
app.route("/", resultsRoute);
app.route("/", adminRoute);
app.route("/", pagesEventRoute);
app.route("/", identifyRoute);
app.route("/", cellsRoute);
app.route("/", ogRoute);

app.onError((err, c) => {
  console.error(err);
  return c.text("internal error", 500);
});

app.notFound((c) => c.text("not found", 404));

export default app;
