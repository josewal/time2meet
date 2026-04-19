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

  return `<main class="event-page">
<header class="event-header">
<div class="event-header__title">
<h1>${escape(ev.title)}</h1>
</div>
<button type="button" class="share-link copy-btn" data-copy="${escape(shareUrl)}" title="Click to copy">${escape(shareUrl)}</button>
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
