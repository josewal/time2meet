import { escape } from "./layout";
import type { EventRow, ParticipantRow } from "../db/queries";
import {
  computeHeatmap,
  bestSlots,
  participantsAvailableAt,
  type ParticipantCells,
} from "../lib/heatmap";
import { parseSlot } from "../lib/slots";

export function results(event: EventRow, participants: ParticipantRow[]): string {
  const slots = event.slots;
  const n = participants.length;

  const pcells: ParticipantCells[] = participants.map((p) => ({
    id: p.id,
    name: p.name,
    slotIndices: p.cells,
  }));

  const counts = computeHeatmap(slots.length, pcells);
  const rawMax = counts.reduce((a, b) => (b > a ? b : a), 0);
  const maxCount = rawMax === 0 ? 1 : rawMax;

  const dayOrder: string[] = [];
  const dayIndexByDate = new Map<string, number>();
  const minuteOrder: number[] = [];
  const minuteIndexByMinute = new Map<number, number>();
  const parsed = slots.map((s) => parseSlot(s));

  for (const info of parsed) {
    if (!dayIndexByDate.has(info.date)) {
      dayIndexByDate.set(info.date, dayOrder.length);
      dayOrder.push(info.date);
    }
    if (!minuteIndexByMinute.has(info.minuteOfDay)) {
      minuteIndexByMinute.set(info.minuteOfDay, minuteOrder.length);
      minuteOrder.push(info.minuteOfDay);
    }
  }
  minuteOrder.sort((a, b) => a - b);
  minuteOrder.forEach((m, i) => minuteIndexByMinute.set(m, i));

  const participantListHtml = `<div class="participant-list">
<strong>${n} responses:</strong>
${participants.map((p) => `<span class="pill">${escape(p.name)}</span>`).join("\n")}
</div>`;

  const cellsHtml = slots
    .map((slot, i) => {
      const count = counts[i];
      const available = participantsAvailableAt(i, pcells);
      const names = available.map((a) => a.name).join(", ");
      const title = `${count}/${n}: ${names}`;
      const intensity = count / maxCount || 0;
      return `<div class="result-cell" style="--intensity: ${intensity}" title="${escape(title)}">${count > 0 ? String(count) : ""}</div>`;
    })
    .join("\n");

  const gridHtml = `<div class="results-grid" style="--cols:${dayOrder.length}">
${cellsHtml}
</div>`;

  const top = bestSlots(counts, 5);
  let bestHtml: string;
  if (top.length === 0) {
    bestHtml = `<div class="best-slots">
<h3>Best times</h3>
<p class="muted">No responses yet.</p>
</div>`;
  } else {
    const items = top
      .map((t) => {
        const slotStr = slots[t.slotIndex];
        const names = participantsAvailableAt(t.slotIndex, pcells)
          .map((a) => escape(a.name))
          .join(", ");
        return `<li>${escape(slotStr)} &mdash; ${t.count}/${n} (${names})</li>`;
      })
      .join("\n");
    bestHtml = `<div class="best-slots">
<h3>Best times</h3>
<ol>
${items}
</ol>
</div>`;
  }

  return `${participantListHtml}
${gridHtml}
${bestHtml}`;
}
