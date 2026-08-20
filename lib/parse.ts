// Parses a training day written the compact way a coach actually writes one:
//
//   Day 2
//   A) Squat
//   95*10
//   115*6
//   135*10
//   B) Military press
//   b*10
//   55*10 @8
//
// Set lines are load*reps, with an optional RPE after @ or "rpe". The load side
// is copied verbatim, so "b", "bw" and "20kg" all survive. Pure — no I/O.

export type ParsedSet = { load: string; reps: string; rpe: string };
export type ParsedExercise = { name: string; sets: ParsedSet[] };
export type ParsedDay = {
  day: string | null;
  exercises: ParsedExercise[];
  warnings: string[];
};

/** "Day 2", "Day 2 — Lower", "day 3". */
const DAY_LINE = /^day\b.*/i;
/** "A) Squat", "b. Military press", "C - Leg curls". */
const LETTERED = /^([A-Za-z])\s*[).\]:-]\s*(.+)$/;
/**
 * "95*10", "135 x 10", "b*10", "20kg×12", "100 kg * 5", "55*10 @8",
 * "80kg×8 rpe 7.5". The reps side must start with a digit, which is what keeps
 * "Box squat" and "Leg extensions" from looking like sets.
 */
const SET_LINE =
  /^(.{1,15}?)(\s*)([*×]|x)\s*(\d[\w-]{0,9})(?:\s*(?:@|rpe)\s*([\d.]{1,4}))?$/i;

function matchSet(line: string): ParsedSet | null {
  const m = line.match(SET_LINE);
  if (!m) return null;
  const [, rawLoad, gap, separator, reps, rpe] = m;
  const load = rawLoad.trim();
  if (!load) return null;
  // An "x" jammed against a letter is part of a word, not a separator — that is
  // what keeps "Box 10" an exercise name while "135x10" and "102.5kg x 5" are
  // both sets.
  if (separator.toLowerCase() === "x" && gap === "" && /[a-z]$/i.test(load)) {
    return null;
  }
  return { load, reps, rpe: rpe ?? "" };
}

export function parseDay(text: string): ParsedDay {
  const exercises: ParsedExercise[] = [];
  const warnings: string[] = [];
  let day: string | null = null;
  let current: ParsedExercise | null = null;

  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const set = matchSet(line);
    if (set) {
      if (!current) {
        warnings.push(`"${line}" comes before any exercise name — skipped.`);
        continue;
      }
      current.sets.push(set);
      continue;
    }

    // A day header, but only before the first exercise — after that, a line
    // starting with "Day" is far more likely to be an exercise name.
    if (!current && day === null && DAY_LINE.test(line)) {
      day = line;
      continue;
    }

    const lettered = line.match(LETTERED);
    const name = lettered ? lettered[2].trim() : line;
    if (!name) continue;
    current = { name, sets: [] };
    exercises.push(current);
  }

  for (const exercise of exercises) {
    if (exercise.sets.length === 0) {
      warnings.push(`"${exercise.name}" has no sets under it.`);
    }
  }

  return { day, exercises, warnings };
}

/**
 * Flattens a parsed day into Program rows: Week | Day | Exercise | Sets | Reps |
 * Load | RPE Target, with the Sets column holding the set number.
 */
export function toProgramRows(
  parsed: ParsedDay,
  week: string,
  day: string
): string[][] {
  const rows: string[][] = [];
  for (const exercise of parsed.exercises) {
    exercise.sets.forEach((set, i) => {
      rows.push([week, day, exercise.name, String(i + 1), set.reps, set.load, set.rpe]);
    });
  }
  return rows;
}
