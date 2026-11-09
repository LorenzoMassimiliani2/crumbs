-- The profile no longer owns the weight (TICKET-0022): the current weight is a
-- cache written by the weight measurements, and a profile can exist without one.
-- SQLite cannot drop NOT NULL in place, so rebuild the table keeping every row.
CREATE TABLE profiles_new (
  user_id           TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  weight_kg         REAL,
  height_cm         REAL NOT NULL,
  sex               TEXT NOT NULL CHECK (sex IN ('m', 'f')),
  birth_date        TEXT NOT NULL,
  weight_updated_at TEXT,
  target_kcal       INTEGER NOT NULL,
  updated_at        TEXT NOT NULL
);

INSERT INTO profiles_new
  (user_id, weight_kg, height_cm, sex, birth_date, weight_updated_at, target_kcal, updated_at)
SELECT user_id, weight_kg, height_cm, sex, birth_date, weight_updated_at, target_kcal, updated_at
FROM profiles;

DROP TABLE profiles;
ALTER TABLE profiles_new RENAME TO profiles;
