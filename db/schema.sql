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
-- ever parsed into numbers, and there is no sets table on purpose. `done_sets`
-- does not change that: it stores which *line numbers* are ticked off and never
-- looks at what is written on them.
CREATE TABLE IF NOT EXISTS exercises (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  position    int  NOT NULL,
  name        text NOT NULL,
  free_text   text NOT NULL DEFAULT '',
  -- "supersetted with the exercise above me". A run of linked exercises is one
  -- group, which is what turns A) B) into A1) A2). Storing the link rather than
  -- a group id means reordering can never leave a dangling group.
  link_prev   boolean NOT NULL DEFAULT false,
  -- Which of those lines have been ticked off, by line number, 0-based.
  -- The line is the only key a set has — there is no id to hang this on — so
  -- `saveWorkout` empties this whenever the number of lines changes. See the
  -- comment there: without that, inserting a set at the top slides every tick
  -- below it onto the wrong line, which is the CoachSpace "0_0" bug in a new
  -- costume. A tick is shared, not per-author: a set is done or it is not.
  done_sets   int[] NOT NULL DEFAULT '{}'
);
-- Deliberately NOT unique. Reordering writes the new positions one row at a
-- time, so two rows briefly share a position mid-transaction. A unique index
-- here would break every reorder.
CREATE INDEX IF NOT EXISTS exercises_workout_idx ON exercises (workout_id, position);

-- exercise_id NULL means "the workout's overall note".
--
-- `author` is why this table is not just "the client's notes" any more: the
-- coach can open the client view on his phone and write on the same exercise.
-- One row per (workout, exercise, author), so the two never overwrite each
-- other. The value is decided server-side — the public action hardcodes
-- 'client', the coach action is behind requireCoach() — never sent by a browser.
CREATE TABLE IF NOT EXISTS client_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id   uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id  uuid REFERENCES exercises(id) ON DELETE CASCADE,
  author       text NOT NULL DEFAULT 'client' CHECK (author IN ('client', 'coach')),
  body         text NOT NULL DEFAULT '',
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE client_notes ADD COLUMN IF NOT EXISTS author text NOT NULL DEFAULT 'client';

-- Two indexes, not one. In Postgres NULL <> NULL, so a plain
-- UNIQUE (workout_id, exercise_id) does NOT stop the overall note being
-- inserted twice — blur the box twice and you would get duplicates.
--
-- Both are dropped by their old names first. IF NOT EXISTS matches on the index
-- NAME, so on a database created before `author` the old two-column index would
-- survive this file untouched, and the coach's first note on an exercise the
-- client had already written on would fail with a unique violation.
DROP INDEX IF EXISTS client_notes_ex_uniq;
DROP INDEX IF EXISTS client_notes_overall_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS client_notes_ex_author_uniq
  ON client_notes (workout_id, exercise_id, author) WHERE exercise_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS client_notes_overall_author_uniq
  ON client_notes (workout_id, author) WHERE exercise_id IS NULL;

-- Migrations for databases created before the free-text editor. Both are
-- no-ops on a fresh database.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS free_text text NOT NULL DEFAULT '';
ALTER TABLE exercises DROP COLUMN IF EXISTS coach_note;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS link_prev boolean NOT NULL DEFAULT false;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS done_sets int[] NOT NULL DEFAULT '{}';
DROP TABLE IF EXISTS sets;

-- Optional per-client passcode. NULL means the name on `/` still taps straight
-- through, which is what everyone starts as. Never the passcode itself: the
-- column holds `pbkdf2$<iterations>$<salt>$<hash>`, written only by
-- lib/client-auth.ts. See lib/db.ts — getClients() deliberately returns a
-- boolean and not this column, because the coach board is a client component
-- and anything on that type is serialised into the browser.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS passcode_hash text;

-- Seed: two people. Rename them inline on the coach page.
INSERT INTO clients (name, position)
SELECT 'Client 1', 0 WHERE NOT EXISTS (SELECT 1 FROM clients);
INSERT INTO clients (name, position)
SELECT 'Client 2', 1 WHERE (SELECT count(*) FROM clients) = 1;
