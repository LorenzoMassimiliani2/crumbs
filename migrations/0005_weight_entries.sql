-- Weight measurements (SPEC-0003, TICKET-0019). Additive only.
CREATE TABLE weight_entries (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  measured_on TEXT NOT NULL,
  weight_kg   REAL NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_weight_entries_user_date ON weight_entries (user_id, measured_on);

-- The profile weight is seeded into the log once per user; clearing the log
-- afterwards must not bring the seeded measurement back.
ALTER TABLE users ADD COLUMN weights_seeded INTEGER NOT NULL DEFAULT 0;
