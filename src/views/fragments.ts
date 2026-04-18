import { escape } from "./layout";
import { parseSlot } from "../lib/slots";

export type EventClientData = {
  id: string;
  slots: string[];
  slotsPerDay: number;
  days: string[];
  me: { id: string; name: string } | null;
};

export function identifyErrorFragment(msg: string): string {
  return `<div class="error">${escape(msg)}</div>`;
}

export function gridMarkup(data: EventClientData): string {
  const rows = data.slotsPerDay;
  const cols = data.days.length;
  const parts: string[] = [];
  parts.push(
    `<div id="grid" class="grid" data-cols="${cols}" data-rows="${rows}" style="grid-template-columns: repeat(${cols}, 1fr);">`,
  );
  parts.push('<div class="grid-corner"></div>');
  for (const day of data.days) {
    parts.push(`<div class="grid-day-header">${escape(day)}</div>`);
  }
  for (let r = 0; r < rows; r++) {
    const firstOfDay = data.slots[r];
    let timeLabel = "";
    if (firstOfDay) {
      try {
        timeLabel = parseSlot(firstOfDay).time;
      } catch {
        timeLabel = "";
      }
    }
    parts.push(`<div class="grid-time-label">${escape(timeLabel)}</div>`);
    for (let c = 0; c < cols; c++) {
      const slotIndex = c * rows + r;
      parts.push(`<div class="cell" data-slot="${slotIndex}"></div>`);
    }
  }
  parts.push("</div>");
  return parts.join("");
}

export function gridReady(
  eventData: EventClientData,
  initialCells: number[],
): string {
  const eventJson = JSON.stringify(eventData);
  const cellsJson = JSON.stringify(initialCells);
  const grid = gridMarkup(eventData);
  return `<div id="grid-area">${grid}<script>window.__EVENT__ = ${eventJson}; window.__INITIAL_CELLS__ = ${cellsJson};</script><script src="/grid.js?v=${Date.now()}"></script></div>`;
}
