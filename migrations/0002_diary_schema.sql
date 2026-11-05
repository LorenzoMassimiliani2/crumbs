-- The old single-table diary was empty; replace it with the multi-user schema from SPEC-0001.
DROP TABLE IF EXISTS meals;

CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  name       TEXT,
  picture    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE profiles (
  user_id          TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  weight_kg        REAL NOT NULL,
  height_cm        REAL NOT NULL,
  sex              TEXT NOT NULL CHECK (sex IN ('m', 'f')),
  birth_date       TEXT NOT NULL,
  weight_updated_at TEXT,
  target_kcal      INTEGER NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE foods (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  brand          TEXT,
  barcode        TEXT,
  source         TEXT NOT NULL,
  source_id      TEXT,
  kcal_100g      REAL NOT NULL DEFAULT 0,
  protein_100g   REAL NOT NULL DEFAULT 0,
  carbs_100g     REAL NOT NULL DEFAULT 0,
  fat_100g       REAL NOT NULL DEFAULT 0,
  fiber_100g     REAL NOT NULL DEFAULT 0,
  sugar_100g     REAL NOT NULL DEFAULT 0,
  salt_100g      REAL NOT NULL DEFAULT 0,
  serving_g      REAL,
  serving_label  TEXT,
  last_used_at   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE meals (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  occurred_at TEXT NOT NULL,
  local_date  TEXT NOT NULL,
  meal_type   TEXT NOT NULL,
  note        TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE TABLE meal_items (
  id            TEXT PRIMARY KEY,
  meal_id       TEXT NOT NULL REFERENCES meals (id) ON DELETE CASCADE,
  food_id       TEXT REFERENCES foods (id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  kcal_100g     REAL NOT NULL,
  protein_100g  REAL NOT NULL,
  carbs_100g    REAL NOT NULL,
  fat_100g      REAL NOT NULL,
  fiber_100g    REAL NOT NULL,
  sugar_100g    REAL NOT NULL,
  salt_100g     REAL NOT NULL,
  grams         REAL NOT NULL,
  position      INTEGER NOT NULL
);

CREATE TABLE api_cache (
  key        TEXT PRIMARY KEY,
  source     TEXT NOT NULL,
  payload    TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_foods_user_source ON foods (user_id, source, source_id)
  WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX idx_foods_user_name ON foods (user_id, lower(trim(name)))
  WHERE source_id IS NULL;

CREATE INDEX idx_meals_user_date ON meals (user_id, local_date);
CREATE INDEX idx_foods_user_last_used ON foods (user_id, last_used_at DESC);
CREATE INDEX idx_meal_items_meal ON meal_items (meal_id, position);
CREATE INDEX idx_api_cache_source_fetched ON api_cache (source, fetched_at);
