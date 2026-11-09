-- The catalog is seeded once per user (SPEC-0002, TICKET-0014/0017).
-- Without this flag, deleting every catalog activity would re-seed the defaults on next read.
ALTER TABLE users ADD COLUMN activities_seeded INTEGER NOT NULL DEFAULT 0;
