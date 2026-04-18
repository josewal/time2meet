import type { DB } from "./client";
import { eventId, participantId, adminToken } from "../lib/ids";

export type EventRow = {
  id: string;
  admin_token: string;
  title: string;
  slots: string[];
  created_at: number;
  updated_at: number;
};

export type ParticipantRow = {
  id: string;
  event_id: string;
  name: string;
  pw_hash: string | null;
  pw_salt: string | null;
  cells: number[];
  created_at: number;
  updated_at: number;
};

type Row = Record<string, string | number | null>;

function parseJsonArray<T>(value: unknown): T[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function mapEvent(row: Row): EventRow {
  return {
    id: String(row.id),
    admin_token: String(row.admin_token),
    title: String(row.title),
    slots: parseJsonArray<string>(row.slots_json),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

function mapParticipant(row: Row): ParticipantRow {
  return {
    id: String(row.id),
    event_id: String(row.event_id),
    name: String(row.name),
    pw_hash: row.pw_hash == null ? null : String(row.pw_hash),
    pw_salt: row.pw_salt == null ? null : String(row.pw_salt),
    cells: parseJsonArray<number>(row.cells_json),
    created_at: Number(row.created_at),
    updated_at: Number(row.updated_at),
  };
}

const EVENT_COLS = "id, admin_token, title, slots_json, created_at, updated_at";
const PARTICIPANT_COLS =
  "id, event_id, name, pw_hash, pw_salt, cells_json, created_at, updated_at";

export async function createEvent(
  db: DB,
  input: { title: string; slots: string[] },
): Promise<EventRow> {
  const id = eventId();
  const token = adminToken();
  const now = Date.now();
  const slotsJson = JSON.stringify(input.slots);
  await db.execute({
    sql: `INSERT INTO events (id, admin_token, title, slots_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, token, input.title, slotsJson, now, now],
  });
  return {
    id,
    admin_token: token,
    title: input.title,
    slots: input.slots,
    created_at: now,
    updated_at: now,
  };
}

export async function getEvent(db: DB, id: string): Promise<EventRow | null> {
  const res = await db.execute({
    sql: `SELECT ${EVENT_COLS} FROM events WHERE id = ? LIMIT 1`,
    args: [id],
  });
  const row = res.rows[0] as Row | undefined;
  return row ? mapEvent(row) : null;
}

export async function listParticipants(
  db: DB,
  eventId: string,
): Promise<ParticipantRow[]> {
  const res = await db.execute({
    sql: `SELECT ${PARTICIPANT_COLS} FROM participants WHERE event_id = ? ORDER BY created_at ASC`,
    args: [eventId],
  });
  return (res.rows as Row[]).map(mapParticipant);
}

export async function getParticipantByName(
  db: DB,
  eventId: string,
  name: string,
): Promise<ParticipantRow | null> {
  const res = await db.execute({
    sql: `SELECT ${PARTICIPANT_COLS} FROM participants WHERE event_id = ? AND name = ? LIMIT 1`,
    args: [eventId, name],
  });
  const row = res.rows[0] as Row | undefined;
  return row ? mapParticipant(row) : null;
}

export async function getParticipantById(
  db: DB,
  id: string,
): Promise<ParticipantRow | null> {
  const res = await db.execute({
    sql: `SELECT ${PARTICIPANT_COLS} FROM participants WHERE id = ? LIMIT 1`,
    args: [id],
  });
  const row = res.rows[0] as Row | undefined;
  return row ? mapParticipant(row) : null;
}

export async function createParticipant(
  db: DB,
  input: {
    eventId: string;
    name: string;
    pwHash: string | null;
    pwSalt: string | null;
  },
): Promise<ParticipantRow> {
  const id = participantId();
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO participants (id, event_id, name, pw_hash, pw_salt, cells_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '[]', ?, ?)`,
    args: [id, input.eventId, input.name, input.pwHash, input.pwSalt, now, now],
  });
  return {
    id,
    event_id: input.eventId,
    name: input.name,
    pw_hash: input.pwHash,
    pw_salt: input.pwSalt,
    cells: [],
    created_at: now,
    updated_at: now,
  };
}

export async function setParticipantPassword(
  db: DB,
  id: string,
  pwHash: string,
  pwSalt: string,
): Promise<void> {
  const now = Date.now();
  await db.execute({
    sql: `UPDATE participants SET pw_hash = ?, pw_salt = ?, updated_at = ? WHERE id = ?`,
    args: [pwHash, pwSalt, now, id],
  });
}

export async function saveCells(
  db: DB,
  participantId: string,
  slotIndices: number[],
): Promise<{ updatedAt: number }> {
  const now = Date.now();
  const cellsJson = JSON.stringify(slotIndices);
  await db.batch([
    {
      sql: `UPDATE participants SET cells_json = ?, updated_at = ? WHERE id = ?`,
      args: [cellsJson, now, participantId],
    },
    {
      sql: `UPDATE events SET updated_at = ? WHERE id = (SELECT event_id FROM participants WHERE id = ?)`,
      args: [now, participantId],
    },
  ]);
  return { updatedAt: now };
}

export async function deleteParticipant(
  db: DB,
  participantId: string,
): Promise<void> {
  const now = Date.now();
  await db.batch([
    {
      sql: `UPDATE events SET updated_at = ? WHERE id = (SELECT event_id FROM participants WHERE id = ?)`,
      args: [now, participantId],
    },
    {
      sql: `DELETE FROM participants WHERE id = ?`,
      args: [participantId],
    },
  ]);
}
