-- Activity catalog and diary entries (SPEC-0002, TICKET-0014). Additive only.
CREATE TABLE activities (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  last_used_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE activity_entries (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  activity_id   TEXT REFERENCES activities (id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  local_date    TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  ended_at      TEXT NOT NULL,
  note          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);

CREATE INDEX idx_activities_user_last_used ON activities (user_id, last_used_at DESC);
CREATE INDEX idx_activity_entries_user_date ON activity_entries (user_id, local_date);
