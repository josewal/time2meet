import { escape } from "./layout";
import {
  deriveDaysAndPerDay,
  gridMarkup,
  type EventClientData,
} from "./fragments";
import type { EventRow, ParticipantRow } from "../db/queries";

export function event(
  ev: EventRow,
  me: ParticipantRow | null,
  participants: ParticipantRow[],
  shareUrl: string,
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

  const leftBlock = me
    ? `<p class="me">editing as <strong>${escape(me.name)}</strong></p>
<div id="grid-area">${gridMarkup(clientData)}<script>window.__INITIAL_CELLS__ = ${JSON.stringify(me.cells)};</script><script src="/grid.js" defer></script></div>`
    : `<form class="identify" hx-post="/event/${escape(ev.id)}/identify" hx-swap="outerHTML" hx-target="#grid-area">
<input name="name" required maxlength="60" placeholder="Your name" autocomplete="name">
<input name="password" type="password" maxlength="200" placeholder="Password (optional)" autocomplete="new-password">
<button type="submit">Enter</button>
</form>
<div id="grid-area" class="muted hint">Enter your name to mark your availability. The grid on the right shows when everyone is free.</div>`;

  const n = participants.length;
  const caption = n === 0
    ? "No responses yet — share the link below to invite."
    : `${n} ${n === 1 ? "response" : "responses"}`;

  return `<main class="event-page">
<header class="event-header">
<h1>${escape(ev.title)}</h1>
<p class="muted">${escape(caption)}</p>
<div class="share-row">
<input class="share-url" type="text" readonly value="${escape(shareUrl)}" onclick="this.select()">
<button type="button" class="copy-btn" data-copy="${escape(shareUrl)}">Copy</button>
</div>
</header>

<script>window.__EVENT__ = ${eventJson};</script>

<section class="panel left">
<h2 class="panel-title">${me ? "Your availability" : "Sign in"}</h2>
${leftBlock}
<div id="identify-error"></div>
</section>

<aside class="panel right">
<h2 class="panel-title">Group availability</h2>
<div id="results" hx-get="/event/${escape(ev.id)}/results" hx-trigger="load, every 5s, refresh" hx-swap="innerHTML">
<p class="muted">Loading…</p>
</div>
</aside>

<script src="/copy.js" defer></script>
</main>`;
}
