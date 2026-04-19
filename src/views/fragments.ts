import { escape } from "./layout";
import { parseSlot } from "../lib/slots";

export type EventClientData = {
  id: string;
  slots: string[];
  slotsPerDay: number;
  days: string[];
  me: { id: string; name: string } | null;
};

export type HeatmapCell = {
  count: number;
  names: string[];
};

export function identifyErrorFragment(msg: string): string {
  return `<div class="error">${escape(msg)}</div>`;
}

export function deriveDaysAndPerDay(slots: string[]): {
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

function formatDayHeader(dateIso: string): { dow: string; date: string } {
  try {
    const [y, m, d] = dateIso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getUTCDay()];
    if (y === 1970) return { dow, date: "" };
    return { dow, date: `${m}/${d}` };
  } catch {
    return { dow: dateIso, date: "" };
  }
}

function gridHeaderRow(days: string[]): string {
  const parts: string[] = ['<div class="grid-corner"></div>'];
  for (const day of days) {
    const { dow, date } = formatDayHeader(day);
    const dateLine = date
      ? `<span class="grid-day-date">${escape(date)}</span>`
      : "";
    parts.push(
      `<div class="grid-day-header"><span class="grid-day-dow">${escape(dow)}</span>${dateLine}</div>`,
    );
  }
  return parts.join("");
}

function timeLabelFor(slots: string[], rowIndex: number): string {
  const s = slots[rowIndex];
  if (!s) return "";
  try {
    return parseSlot(s).time;
  } catch {
    return "";
  }
}

export function gridMarkup(data: EventClientData): string {
  const rows = data.slotsPerDay;
  const cols = data.days.length;
  const parts: string[] = [];
  parts.push(
    `<div id="grid" class="grid" data-cols="${cols}" data-rows="${rows}" style="--cols:${cols};">`,
  );
  parts.push(gridHeaderRow(data.days));
  for (let r = 0; r < rows; r++) {
    parts.push(
      `<div class="grid-time-label">${escape(timeLabelFor(data.slots, r))}</div>`,
    );
    for (let c = 0; c < cols; c++) {
      const slotIndex = c * rows + r;
      parts.push(`<div class="cell" data-slot="${slotIndex}"></div>`);
    }
  }
  parts.push("</div>");
  return parts.join("");
}

export function heatmapMarkup(
  data: EventClientData,
  cells: HeatmapCell[],
  maxCount: number,
  total: number,
): string {
  const rows = data.slotsPerDay;
  const cols = data.days.length;
  const parts: string[] = [];
  parts.push(
    `<div class="grid heatmap" data-cols="${cols}" data-rows="${rows}" style="--cols:${cols};">`,
  );
  parts.push(gridHeaderRow(data.days));
  const denom = maxCount > 0 ? maxCount : 1;
  for (let r = 0; r < rows; r++) {
    parts.push(
      `<div class="grid-time-label">${escape(timeLabelFor(data.slots, r))}</div>`,
    );
    for (let c = 0; c < cols; c++) {
      const slotIndex = c * rows + r;
      const cell = cells[slotIndex] ?? { count: 0, names: [] };
      const intensity = cell.count / denom;
      const title = cell.count > 0
        ? `${cell.count}/${total}: ${cell.names.join(", ")}`
        : `0/${total}`;
      parts.push(
        `<div class="cell heat" data-slot="${slotIndex}" data-count="${cell.count}" style="--intensity:${intensity};" title="${escape(title)}"></div>`,
      );
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

export function identifyFormBody(eventId: string): string {
  return `<h2 class="panel-title">Your name</h2>
<form class="identify" hx-post="/event/${escape(eventId)}/identify" hx-swap="innerHTML" hx-target="#left-panel">
<input type="text" name="name" required maxlength="60" placeholder="Your name" autocomplete="name">
<button type="submit">Enter</button>
</form>
<div id="grid-area" class="muted hint">Type your name to mark your availability. Use the same name later to pick up where you left off — one name per person.</div>
<div id="identify-error"></div>`;
}

export function editingAsBody(
  eventData: EventClientData,
  meName: string,
  initialCells: number[],
): string {
  return `<h2 class="panel-title">Your availability</h2>
<p class="me">editing as <strong>${escape(meName)}</strong> · <button type="button" class="linkish" hx-post="/event/${escape(eventData.id)}/logout">switch name</button></p>
${gridReady(eventData, initialCells)}
<div id="identify-error"></div>`;
}
