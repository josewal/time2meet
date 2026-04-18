import { escape } from "./layout";
import { parseSlot } from "../lib/slots";
import { gridMarkup, type EventClientData } from "./fragments";
import type { EventRow, ParticipantRow } from "../db/queries";

function deriveDaysAndPerDay(slots: string[]): {
  days: string[];
  slotsPerDay: number;
} {
  if (slots.length === 0) return { days: [], slotsPerDay: 0 };
  const days: string[] = [];
  const seen = new Set<string>();
  for (const s of slots) {
    let date: string;
    try {
      date = parseSlot(s).date;
    } catch {
      continue;
    }
    if (!seen.has(date)) {
      seen.add(date);
      days.push(date);
    }
  }
  const firstDate = days[0];
  let slotsPerDay = 0;
  for (const s of slots) {
    try {
      if (parseSlot(s).date === firstDate) slotsPerDay++;
      else break;
    } catch {
      break;
    }
  }
  return { days, slotsPerDay };
}

export function event(
  ev: EventRow,
  me: ParticipantRow | null,
  participants: ParticipantRow[],
): string {
  const { days, slotsPerDay } = deriveDaysAndPerDay(ev.slots);
  const meClient = me ? { id: me.id, name: me.name } : null;
  const clientData: EventClientData = {
    id: ev.id,
    slots: ev.slots,
    slotsPerDay,
    days,
    me: meClient,
  };
  const eventJson = JSON.stringify(clientData);

  const identifyBlock = me
    ? `<p class="muted">editing as <strong>${escape(me.name)}</strong></p>
<div id="grid-area">${gridMarkup(clientData)}<script>window.__INITIAL_CELLS__ = ${JSON.stringify(me.cells)};</script><script src="/grid.js" defer></script></div>`
    : `<form class="identify" hx-post="/event/${escape(ev.id)}/identify" hx-swap="outerHTML" hx-target="#grid-area">
<input name="name" required maxlength="60" placeholder="Your name">
<input name="password" type="password" maxlength="200" placeholder="Password (optional)">
<button type="submit">Enter</button>
</form>
<div id="grid-area" class="muted">Enter your name to add availability.</div>`;

  return `<main class="event-page">
<header>
<h1>${escape(ev.title)}</h1>
<p class="muted">${participants.length} responses &mdash; share this URL to invite</p>
</header>

<script>window.__EVENT__ = ${eventJson};</script>

<section class="left">
${identifyBlock}
<div id="identify-error"></div>
</section>

<aside class="right">
<h2>Results</h2>
<div id="results" hx-get="/event/${escape(ev.id)}/results" hx-trigger="load, every 5s, refresh" hx-swap="innerHTML"></div>
</aside>
</main>`;
}
