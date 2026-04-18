export type SlotSpec = {
  dates: string[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
};

export type SlotInfo = {
  date: string;
  time: string;
  dayIndex: number;
  minuteOfDay: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const ALLOWED_GRAN = new Set([5, 10, 15, 20, 30, 60]);

function parseHHMM(s: string): number {
  if (!TIME_RE.test(s)) throw new Error(`Malformed time: "${s}" (expected HH:MM)`);
  const hh = Number(s.slice(0, 2));
  const mm = Number(s.slice(3, 5));
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) throw new Error(`Time out of range: "${s}"`);
  return hh * 60 + mm;
}

function formatHHMM(minutes: number): string {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function validateSpec(spec: SlotSpec): void {
  if (!Array.isArray(spec.dates) || spec.dates.length === 0) {
    throw new Error("SlotSpec.dates must be a non-empty array");
  }
  for (const d of spec.dates) {
    if (!DATE_RE.test(d)) throw new Error(`Malformed date: "${d}" (expected YYYY-MM-DD)`);
  }
  parseHHMM(spec.startTime);
  parseHHMM(spec.endTime);
  if (!ALLOWED_GRAN.has(spec.slotMinutes)) {
    throw new Error(`slotMinutes must be one of 5,10,15,20,30,60 (got ${spec.slotMinutes})`);
  }
}

export function slotsPerDay(spec: SlotSpec): number {
  const start = parseHHMM(spec.startTime);
  const end = parseHHMM(spec.endTime);
  if (spec.slotMinutes <= 0) throw new Error("slotMinutes must be > 0");
  if (end <= start) throw new Error("endTime must be > startTime");
  const span = end - start;
  if (span % spec.slotMinutes !== 0) {
    throw new Error(`Window (${span} min) not divisible by slotMinutes (${spec.slotMinutes})`);
  }
  return span / spec.slotMinutes;
}

export function materializeSlots(spec: SlotSpec): string[] {
  validateSpec(spec);
  const perDay = slotsPerDay(spec);
  const start = parseHHMM(spec.startTime);
  const out: string[] = [];
  for (const date of spec.dates) {
    for (let i = 0; i < perDay; i++) {
      out.push(`${date} ${formatHHMM(start + i * spec.slotMinutes)}`);
    }
  }
  return out;
}

export function parseSlot(slot: string): SlotInfo {
  if (typeof slot !== "string" || slot.length !== 16 || slot[10] !== " ") {
    throw new Error(`Malformed slot: "${slot}"`);
  }
  const date = slot.slice(0, 10);
  const time = slot.slice(11);
  if (!DATE_RE.test(date)) throw new Error(`Malformed slot date: "${slot}"`);
  const minuteOfDay = parseHHMM(time);
  return { date, time, dayIndex: -1, minuteOfDay };
}
