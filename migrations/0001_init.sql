CREATE TABLE meals (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  type       TEXT NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX idx_meals_date ON meals (date);
