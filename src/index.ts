import { Hono } from "hono";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

const stub = (name: string) => (c: any) =>
  c.text(`501 not implemented: ${name}`, 501);

app.get("/", stub("GET /"));
app.post("/events", stub("POST /events"));
app.get("/event/:id", stub("GET /event/:id"));
app.post("/event/:id/identify", stub("POST /event/:id/identify"));
app.get("/event/:id/results", stub("GET /event/:id/results"));
app.delete("/event/:id/participant/:pid", stub("DELETE participant"));
app.get("/api/event/:id", stub("GET /api/event/:id"));
app.put("/api/event/:id/cells", stub("PUT /api/event/:id/cells"));
app.get("/event/:id/og.png", stub("GET /event/:id/og.png"));

app.onError((err, c) => {
  console.error(err);
  return c.text("internal error", 500);
});

app.notFound((c) => c.text("not found", 404));

export default app;
