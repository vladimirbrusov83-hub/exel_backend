// Pure shaping of the Program tab's rows. No I/O, so it can be exercised directly.

/** One row of the Program tab, below an exercise heading. */
export type SetRow = { set: string; reps: string; load: string; rpe: string };
/**
 * One exercise. Consecutive rows in the same day naming the same exercise are
 * grouped here, so a coach can write either one row per exercise ("4 x 5 @ 225")
 * or one row per set, and both read well on a phone.
 */
export type Movement = { exercise: string; sets: SetRow[] };
export type Day = { day: string; movements: Movement[] };
export type Week = { week: string; days: Day[] };
export type Program = { weeks: Week[] };

export const PROGRAM_COLS = 7; // Week | Day | Exercise | Sets | Reps | Load | RPE Target

/** Numeric-aware sort key so "Week 2" comes before "Week 10". */
function weekOrder(label: string): number {
  const n = label.match(/\d+/);
  return n ? Number(n[0]) : Number.MAX_SAFE_INTEGER;
}

/** Rows are the Program tab minus its header row. */
export function shapeProgram(rows: unknown[][]): Program {
  const weeks: Week[] = [];
  const weekIndex = new Map<string, Week>();

  for (const raw of rows) {
    // values.get omits trailing empty cells, so a row with a blank Load or RPE
    // comes back short. Pad before touching it by index.
    const row = [...raw];
    while (row.length < PROGRAM_COLS) row.push("");
    const cells = row.map((c) => (c ?? "").toString().trim());
    const [weekLabel, dayLabel, exercise, sets, reps, load, rpe] = cells;

    // Skip blank spacer rows.
    if (!weekLabel && !dayLabel && !exercise) continue;

    let week = weekIndex.get(weekLabel);
    if (!week) {
      week = { week: weekLabel, days: [] };
      weekIndex.set(weekLabel, week);
      weeks.push(week);
    }

    let day = week.days.find((d) => d.day === dayLabel);
    if (!day) {
      day = { day: dayLabel, movements: [] };
      week.days.push(day);
    }

    // Only *consecutive* rows group together: the same lift done again later in
    // the session stays its own block, which is usually what the coach meant.
    const last = day.movements[day.movements.length - 1];
    const movement =
      last && last.exercise === exercise ? last : { exercise, sets: [] };
    if (movement !== last) day.movements.push(movement);

    movement.sets.push({ set: sets, reps, load, rpe });
  }

  // Weeks numerically; days and exercises keep the order they appear in the Sheet.
  weeks.sort((a, b) => weekOrder(a.week) - weekOrder(b.week));
  return { weeks };
}

/** Pads a Sheet row to the 7 Program columns. */
export function padRow(row: unknown[]): string[] {
  const out = row.map((c) => (c ?? "").toString());
  while (out.length < PROGRAM_COLS) out.push("");
  return out.slice(0, PROGRAM_COLS);
}

/**
 * Rebuilds a Program tab's body with one week+day's rows replaced by `rows`,
 * keeping that day where it already sat and leaving every other row in place.
 * Returns null when the day isn't there, so the caller can refuse rather than
 * write. Pure, because getting this wrong overwrites a real program.
 */
export function spliceDayRows(
  body: unknown[][],
  week: string,
  day: string,
  rows: string[][]
): { next: string[][]; replaced: number } | null {
  const belongs = (row: unknown[]) => {
    const r = padRow(row);
    return r[0].trim() === week && r[1].trim() === day;
  };

  const next: string[][] = [];
  let replaced = 0;
  let inserted = false;
  for (const row of body) {
    if (belongs(row)) {
      replaced += 1;
      if (!inserted) {
        next.push(...rows.map(padRow));
        inserted = true;
      }
      continue;
    }
    next.push(padRow(row));
  }
  return inserted ? { next, replaced } : null;
}
