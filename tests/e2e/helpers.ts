import type { APIRequestContext } from "@playwright/test";

export function uniqueTitle(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function futureDates(count: number, startDaysAhead = 7): string[] {
  const out: string[] = [];
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + startDaysAhead);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

type CreateOpts = {
  title?: string;
  dates?: string[];
  startTime?: string;
  endTime?: string;
  slotMinutes?: 15 | 30 | 60;
};

export async function createEventViaApi(
  request: APIRequestContext,
  opts: CreateOpts = {},
): Promise<{ id: string; title: string }> {
  const title = opts.title ?? uniqueTitle();
  const dates = (opts.dates ?? futureDates(2)).join(",");
  const res = await request.post("/events", {
    form: {
      title,
      dates,
      startTime: opts.startTime ?? "09:00",
      endTime: opts.endTime ?? "11:00",
      slotMinutes: String(opts.slotMinutes ?? 30),
    },
  });
  if (res.status() !== 200) {
    throw new Error(`create event failed: ${res.status()} ${await res.text()}`);
  }
  const redirect = res.headers()["hx-redirect"];
  if (!redirect) throw new Error("no HX-Redirect header on /events response");
  const id = redirect.replace(/^\/event\//, "");
  return { id, title };
}
