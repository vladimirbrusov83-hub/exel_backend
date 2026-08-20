// Pure shaping of the Program tab's rows. No I/O, so it can be exercised directly.

export type Exercise = {
  exercise: string;
  sets: string;
  reps: string;
  load: string;
  rpe: string;
};
export type Day = { day: string; exercises: Exercise[] };
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
      day = { day: dayLabel, exercises: [] };
      week.days.push(day);
    }

    day.exercises.push({ exercise, sets, reps, load, rpe });
  }

  // Weeks numerically; days keep the order they appear in the Sheet.
  weeks.sort((a, b) => weekOrder(a.week) - weekOrder(b.week));
  return { weeks };
}
