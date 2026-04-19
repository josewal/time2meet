import { escape } from "./layout";
import {
  deriveDaysAndPerDay,
  editingAsBody,
  identifyFormBody,
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

  const leftInner = me
    ? editingAsBody(clientData, me.name, me.cells)
    : identifyFormBody(ev.id);

  const n = participants.length;
  const captionHtml = n === 0
    ? `<p class="muted">No responses yet — share the link below to invite.</p>`
    : "";

  return `<main class="event-page">
<header class="event-header">
<h1>${escape(ev.title)}</h1>
${captionHtml}
<div class="share-row">
<input class="share-url" type="text" readonly value="${escape(shareUrl)}" onclick="this.select()">
<button type="button" class="copy-btn" data-copy="${escape(shareUrl)}">Copy</button>
</div>
</header>

<script>window.__EVENT__ = ${eventJson};</script>

<section class="panel left" id="left-panel">
${leftInner}
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
