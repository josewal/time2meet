import { escape } from "./layout";
import type { EventRow, ParticipantRow } from "../db/queries";
import {
  computeHeatmap,
  bestSlots,
  participantsAvailableAt,
  type ParticipantCells,
} from "../lib/heatmap";
import {
  deriveDaysAndPerDay,
  heatmapMarkup,
  type EventClientData,
  type HeatmapCell,
} from "./fragments";

export function results(event: EventRow, participants: ParticipantRow[]): string {
  const slots = event.slots;
  const n = participants.length;

  const pcells: ParticipantCells[] = participants.map((p) => ({
    id: p.id,
    name: p.name,
    slotIndices: p.cells,
  }));

  const counts = computeHeatmap(slots.length, pcells);
  const maxCount = counts.reduce((a, b) => (b > a ? b : a), 0);

  const heatCells: HeatmapCell[] = counts.map((count, i) => ({
    count,
    names: participantsAvailableAt(i, pcells).map((p) => p.name),
  }));

  const { days, slotsPerDay } = deriveDaysAndPerDay(slots);
  const clientData: EventClientData = {
    id: event.id,
    slots,
    slotsPerDay,
    days,
    me: null,
  };

  const heatmapHtml = heatmapMarkup(clientData, heatCells, maxCount, n);

  const participantListHtml =
    n === 0
      ? `<p class="muted">No responses yet.</p>`
      : `<div class="participant-list"><strong>${n} ${n === 1 ? "response" : "responses"}:</strong> ${participants
          .map((p) => `<span class="pill">${escape(p.name)}</span>`)
          .join(" ")}</div>`;

  const top = bestSlots(counts, 5);
  let bestHtml: string;
  if (top.length === 0) {
    bestHtml = `<div class="best-slots"><h3>Best times</h3><p class="muted">No responses yet.</p></div>`;
  } else {
    const items = top
      .map((t) => {
        const slotStr = slots[t.slotIndex];
        const names = participantsAvailableAt(t.slotIndex, pcells)
          .map((a) => escape(a.name))
          .join(", ");
        return `<li><span class="best-slot-time">${escape(slotStr)}</span> &mdash; <strong>${t.count}/${n}</strong> <span class="muted">(${names})</span></li>`;
      })
      .join("");
    bestHtml = `<div class="best-slots"><h3>Best times</h3><ol>${items}</ol></div>`;
  }

  const legendHtml =
    maxCount > 0
      ? `<div class="results-legend">
<span>0</span>
<span class="legend-swatch" style="--intensity:0.25"></span>
<span class="legend-swatch" style="--intensity:0.5"></span>
<span class="legend-swatch" style="--intensity:0.75"></span>
<span class="legend-swatch" style="--intensity:1"></span>
<span>${maxCount}</span>
</div>`
      : "";

  return `${participantListHtml}
${heatmapHtml}
${legendHtml}
${bestHtml}`;
}
