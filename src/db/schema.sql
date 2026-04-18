CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  admin_token TEXT NOT NULL,
  title       TEXT NOT NULL,
  slots_json  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  pw_hash     TEXT,
  pw_salt     TEXT,
  cells_json  TEXT NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (event_id, name)
);

CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
