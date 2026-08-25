import { neon } from "@neondatabase/serverless";
import { setLines } from "./types";
import type { Client, Exercise, NoteAuthor, Workout } from "./types";

type Neon = ReturnType<typeof neon>;
let client: Neon | undefined;

/**
 * Built on first query, not at import time. `next build` loads every route
 * module even though they are all force-dynamic, so connecting at import would
 * make the build fail on a machine that has no DATABASE_URL.
 */
function connect(): Neon {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set — see .env.example");
    client = neon(url);
  }
  return client;
}

export const sql = new Proxy((() => {}) as unknown as Neon, {
  apply: (_t, _this, args) => Reflect.apply(connect() as never, undefined, args),
  get: (_t, prop) => Reflect.get(connect() as never, prop),
});

/* ---------------------------------------------------------------- clients */

export async function getClients(): Promise<Client[]> {
  const rows = await sql`
    SELECT id, name, position FROM clients ORDER BY position, name`;
  return rows as Client[];
}

export async function getClient(id: string): Promise<Client | null> {
  const rows = (await sql`
    SELECT id, name, position FROM clients WHERE id = ${id}`) as Client[];
  return rows[0] ?? null;
}

export async function renameClient(id: string, name: string): Promise<void> {
  await sql`UPDATE clients SET name = ${name} WHERE id = ${id}`;
}

/* --------------------------------------------------------------- workouts */

type WorkoutRow = {
  id: string; client_id: string; date: string; title: string;
  coach_note: string; done: boolean;
};

/**
 * Loads whole workouts — exercises, sets and client notes included — in four
 * queries regardless of how many workouts match. `date` is cast to text in SQL
 * so the driver hands back "2026-08-21" rather than a timezone-shifted Date.
 */
async function hydrate(workoutRows: WorkoutRow[]): Promise<Workout[]> {
  if (workoutRows.length === 0) return [];
  const ids = workoutRows.map((w) => w.id);

  const exRows = (await sql`
    SELECT id, workout_id, position, name, free_text, link_prev, done_sets
      FROM exercises WHERE workout_id = ANY(${ids}::uuid[])
     ORDER BY workout_id, position`) as {
    id: string; workout_id: string; position: number; name: string;
    free_text: string; link_prev: boolean; done_sets: number[] | null;
  }[];

  const noteRows = (await sql`
    SELECT workout_id, exercise_id, author, body
      FROM client_notes WHERE workout_id = ANY(${ids}::uuid[])`) as {
    workout_id: string; exercise_id: string | null;
    author: NoteAuthor; body: string;
  }[];

  const exByWorkout = new Map<string, Exercise[]>();
  for (const e of exRows) {
    const list = exByWorkout.get(e.workout_id) ?? [];
    list.push({
      id: e.id, position: e.position, name: e.name,
      freeText: e.free_text, linkPrev: e.link_prev,
      doneSets: e.done_sets ?? [],
    });
    exByWorkout.set(e.workout_id, list);
  }

  // Split by author on the way in. Collapsing both into one key would mean the
  // coach's note and the client's note on the same exercise overwrite each
  // other on screen even though the database keeps both rows.
  type Notes = {
    ex: Record<string, string>; overall: string;
    coachEx: Record<string, string>; coachOverall: string;
  };
  const blankNotes = (): Notes => ({ ex: {}, overall: "", coachEx: {}, coachOverall: "" });

  const notesByWorkout = new Map<string, Notes>();
  for (const n of noteRows) {
    const entry = notesByWorkout.get(n.workout_id) ?? blankNotes();
    if (n.author === "coach") {
      if (n.exercise_id) entry.coachEx[n.exercise_id] = n.body;
      else entry.coachOverall = n.body;
    } else if (n.exercise_id) {
      entry.ex[n.exercise_id] = n.body;
    } else {
      entry.overall = n.body;
    }
    notesByWorkout.set(n.workout_id, entry);
  }

  return workoutRows.map((w) => {
    const notes = notesByWorkout.get(w.id) ?? blankNotes();
    return {
      id: w.id, clientId: w.client_id, date: w.date, title: w.title,
      coachNote: w.coach_note, done: w.done,
      exercises: exByWorkout.get(w.id) ?? [],
      notes: notes.ex, overallNote: notes.overall,
      coachNotes: notes.coachEx, overallCoachNote: notes.coachOverall,
    };
  });
}

export async function getWorkoutsBetween(
  clientId: string, from: string, to: string,
): Promise<Workout[]> {
  const rows = (await sql`
    SELECT id, client_id, date::text AS date, title, coach_note, done
      FROM workouts
     WHERE client_id = ${clientId} AND date >= ${from} AND date <= ${to}
     ORDER BY date, created_at`) as WorkoutRow[];
  return hydrate(rows);
}

export async function getAllWorkouts(clientId: string): Promise<Workout[]> {
  const rows = (await sql`
    SELECT id, client_id, date::text AS date, title, coach_note, done
      FROM workouts WHERE client_id = ${clientId}
     ORDER BY date, created_at`) as WorkoutRow[];
  return hydrate(rows);
}

export async function getWorkout(id: string): Promise<Workout | null> {
  const rows = (await sql`
    SELECT id, client_id, date::text AS date, title, coach_note, done
      FROM workouts WHERE id = ${id}`) as WorkoutRow[];
  return (await hydrate(rows))[0] ?? null;
}

/* ----------------------------------------------------------------- writes */

/**
 * Saves a whole workout. Parsing happens in the server action that calls this
 * (never in the browser); this function only talks to the database.
 *
 * An exercise that already exists keeps its id, so the client's note stays
 * attached to it. Existing exercises are matched **by name**, case-insensitively
 * — position would be wrong the moment you insert an exercise above another,
 * and matching leftovers by position would silently move someone's note onto a
 * different lift. The honest trade: rename an exercise and its note goes with
 * the old name.
 *
 * Ids are generated with crypto.randomUUID() rather than by the database so the
 * whole save fits in one sql.transaction([...]) with no round-trips in between.
 */
export type WorkoutInput = {
  id: string | null;
  clientId: string;
  date: string;
  title: string;
  coachNote: string;
  exercises: { name: string; freeText: string; linkPrev: boolean }[];
};

export async function saveWorkout(draft: WorkoutInput): Promise<string> {
  const parsed = draft.exercises.filter((e) => e.name.trim() !== "");
  if (parsed.length === 0) throw new Error("A workout needs at least one exercise.");

  const workoutId = draft.id ?? crypto.randomUUID();
  const existing = draft.id ? ((await getWorkout(workoutId))?.exercises ?? []) : [];
  const byName = new Map(existing.map((e) => [e.name.trim().toLowerCase(), e]));

  const statements = [];
  if (draft.id) {
    statements.push(sql`
      UPDATE workouts SET date = ${draft.date}, title = ${draft.title},
             coach_note = ${draft.coachNote}
       WHERE id = ${workoutId}`);
  } else {
    statements.push(sql`
      INSERT INTO workouts (id, client_id, date, title, coach_note)
      VALUES (${workoutId}, ${draft.clientId}, ${draft.date}, ${draft.title}, ${draft.coachNote})`);
  }

  const keptIds: string[] = [];
  parsed.forEach((ex, i) => {
    const match = byName.get(ex.name.trim().toLowerCase());
    if (match) byName.delete(ex.name.trim().toLowerCase());
    const exId = match?.id ?? crypto.randomUUID();
    keptIds.push(exId);
    if (match) {
      // Ticked-off sets are keyed by line number, so they only survive an edit
      // that leaves the number of lines alone: fixing "95*10" to "100*10" keeps
      // them, adding or deleting a set line clears them. Without that, a set
      // inserted at the top slides every tick below it onto the wrong line.
      // Comparing counts through setLines() and not in SQL keeps one definition
      // of what a line is. (A *renamed* exercise takes the INSERT path below
      // with a fresh id, so its ticks go with its notes — same trade as always.)
      const keepTicks = setLines(match.freeText).length === setLines(ex.freeText).length;
      // Two whole statements rather than one with a conditional fragment: the
      // neon driver has no fragment type, so an interpolated sql`` would be
      // sent as a *value*, not as SQL.
      statements.push(keepTicks
        ? sql`
        UPDATE exercises
           SET position = ${i}, name = ${ex.name}, free_text = ${ex.freeText},
               link_prev = ${i > 0 && ex.linkPrev}
         WHERE id = ${exId} AND workout_id = ${workoutId}`
        : sql`
        UPDATE exercises
           SET position = ${i}, name = ${ex.name}, free_text = ${ex.freeText},
               link_prev = ${i > 0 && ex.linkPrev}, done_sets = '{}'::int[]
         WHERE id = ${exId} AND workout_id = ${workoutId}`);
    } else {
      statements.push(sql`
        INSERT INTO exercises (id, workout_id, position, name, free_text, link_prev)
        VALUES (${exId}, ${workoutId}, ${i}, ${ex.name}, ${ex.freeText},
                ${i > 0 && ex.linkPrev})`);
    }
  });

  // Exercises the day no longer contains. Their client notes go with them,
  // which is what deleting an exercise should mean.
  statements.push(sql`
    DELETE FROM exercises
     WHERE workout_id = ${workoutId} AND NOT (id = ANY(${keptIds}::uuid[]))`);

  await sql.transaction(statements);
  return workoutId;
}

export async function moveWorkout(id: string, date: string, clientId: string): Promise<void> {
  await sql`UPDATE workouts SET date = ${date}, client_id = ${clientId} WHERE id = ${id}`;
}

/**
 * Copies a workout onto another date, and optionally another client. The copy
 * starts clean: not done, and without the notes the other person wrote.
 */
export async function copyWorkout(
  id: string, date: string, clientId: string,
): Promise<string | null> {
  const src = await getWorkout(id);
  if (!src) return null;
  return saveWorkout({
    id: null, clientId, date, title: src.title, coachNote: src.coachNote,
    // No doneSets: the rows are inserted fresh, so the copy starts unticked
    // the same way it starts not-done and without the other person's notes.
    exercises: src.exercises.map((e) => ({
      name: e.name, freeText: e.freeText, linkPrev: e.linkPrev,
    })),
  });
}

export async function deleteWorkout(id: string): Promise<void> {
  await sql`DELETE FROM workouts WHERE id = ${id}`;
}

export async function setDone(id: string, done: boolean): Promise<void> {
  await sql`UPDATE workouts SET done = ${done} WHERE id = ${id}`;
}

/**
 * Ticks one set line off, or back on. `line` is a 0-based index into
 * `setLines(free_text)` — the same function every screen renders through.
 *
 * It is read back and range-checked here rather than trusted, because the
 * action that calls this is public like `saveNote`: nothing stops a browser
 * posting line 9999, and an out-of-range tick would sit in the array forever,
 * invisible, until an edit grew the exercise enough to reveal it.
 *
 * Both writes are a single statement, so two taps landing at once cannot read
 * the same array and write back over each other.
 */
export async function setSetDone(
  workoutId: string, exerciseId: string, line: number, done: boolean,
): Promise<void> {
  if (!Number.isInteger(line) || line < 0) return;

  const rows = (await sql`
    SELECT free_text FROM exercises
     WHERE id = ${exerciseId} AND workout_id = ${workoutId}`) as { free_text: string }[];
  if (rows.length === 0 || line >= setLines(rows[0].free_text).length) return;

  if (done) {
    // Sorted and de-duplicated, so the array cannot grow on a double tap.
    await sql`
      UPDATE exercises
         SET done_sets = (SELECT coalesce(array_agg(DISTINCT n ORDER BY n), '{}')
                            FROM unnest(done_sets || ${line}::int) AS n)
       WHERE id = ${exerciseId} AND workout_id = ${workoutId}`;
  } else {
    await sql`
      UPDATE exercises SET done_sets = array_remove(done_sets, ${line}::int)
       WHERE id = ${exerciseId} AND workout_id = ${workoutId}`;
  }
}

/**
 * Upsert one note. `exerciseId` null means the overall session note.
 *
 * Delete-then-insert in one transaction rather than ON CONFLICT: inferring a
 * *partial* unique index from an ON CONFLICT target is easy to get subtly
 * wrong, and every note written in this app goes through this one function.
 * `IS NOT DISTINCT FROM` is what makes the NULL (overall-note) case match.
 *
 * The DELETE is scoped to the author, and must stay that way: without it the
 * client blurring their note wipes the coach's note on the same exercise.
 * `author` comes from the calling action, never from the browser.
 */
export async function saveNote(
  workoutId: string, exerciseId: string | null, author: NoteAuthor, body: string,
): Promise<void> {
  await sql.transaction([
    sql`DELETE FROM client_notes
         WHERE workout_id = ${workoutId}
           AND exercise_id IS NOT DISTINCT FROM ${exerciseId}::uuid
           AND author = ${author}`,
    sql`INSERT INTO client_notes (workout_id, exercise_id, author, body)
        VALUES (${workoutId}, ${exerciseId}::uuid, ${author}, ${body})`,
  ]);
}
