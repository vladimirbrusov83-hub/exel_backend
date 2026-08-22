-- ClientProgram schema. Applied by `npm run db:push` (scripts/db-push.mjs).
-- Safe to re-run: everything is IF NOT EXISTS and the seed is idempotent.
--
-- Rule that outranks every other consideration here: loads, reps and RPE are
-- TEXT. Real programs contain "BW", "bar", "100 kg", "45s", "12-15". Typing any
-- of these numerically breaks live programs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS clients (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name      text NOT NULL,
  position  int  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workouts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date        date NOT NULL,
  title       text NOT NULL DEFAULT '',
  coach_note  text NOT NULL DEFAULT '',
  done        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workouts_client_date_idx ON workouts (client_id, date);

-- An exercise is a name plus one block of free text, one line per set, stored
-- exactly as typed: "95*10", "b*10", "BW*45s", "100 kg * 5". Nothing in here is
-- ever parsed into numbers, and there is no sets table on purpose.
CREATE TABLE IF NOT EXISTS exercises (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  position    int  NOT NULL,
  name        text NOT NULL,
  free_text   text NOT NULL DEFAULT '',
  -- "supersetted with the exercise above me". A run of linked exercises is one
  -- group, which is what turns A) B) into A1) A2). Storing the link rather than
  -- a group id means reordering can never leave a dangling group.
  link_prev   boolean NOT NULL DEFAULT false
);
-- Deliberately NOT unique. Reordering writes the new positions one row at a
-- time, so two rows briefly share a position mid-transaction. A unique index
-- here would break every reorder.
CREATE INDEX IF NOT EXISTS exercises_workout_idx ON exercises (workout_id, position);

-- exercise_id NULL means "the workout's overall note".
CREATE TABLE IF NOT EXISTS client_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id   uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id  uuid REFERENCES exercises(id) ON DELETE CASCADE,
  body         text NOT NULL DEFAULT '',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Two indexes, not one. In Postgres NULL <> NULL, so a plain
-- UNIQUE (workout_id, exercise_id) does NOT stop the overall note being
-- inserted twice — blur the box twice and you would get duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS client_notes_ex_uniq
  ON client_notes (workout_id, exercise_id) WHERE exercise_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS client_notes_overall_uniq
  ON client_notes (workout_id) WHERE exercise_id IS NULL;

-- Migrations for databases created before the free-text editor. Both are
-- no-ops on a fresh database.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS free_text text NOT NULL DEFAULT '';
ALTER TABLE exercises DROP COLUMN IF EXISTS coach_note;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS link_prev boolean NOT NULL DEFAULT false;
DROP TABLE IF EXISTS sets;

-- Seed: two people. Rename them inline on the coach page.
INSERT INTO clients (name, position)
SELECT 'Client 1', 0 WHERE NOT EXISTS (SELECT 1 FROM clients);
INSERT INTO clients (name, position)
SELECT 'Client 2', 1 WHERE (SELECT count(*) FROM clients) = 1;
