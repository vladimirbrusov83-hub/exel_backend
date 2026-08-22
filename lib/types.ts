/**
 * An exercise is a name plus one block of free text — one line per set,
 * exactly as typed. Nothing is parsed into numbers, so "BW", "b*10",
 * "100 kg * 5" and "25*12-15" all survive untouched.
 */
export type Exercise = {
  id: string;
  position: number;
  name: string;
  freeText: string;
  /** Supersetted with the exercise above it. */
  linkPrev: boolean;
};

export type Workout = {
  id: string;
  clientId: string;
  /** YYYY-MM-DD, local. Never a Date — timezones have no business here. */
  date: string;
  title: string;
  /** The session note, shown at the top of the client's workout. */
  coachNote: string;
  done: boolean;
  exercises: Exercise[];
  /** Client's note per exercise, keyed by exercise id — never by position. */
  notes: Record<string, string>;
  /** Client's note on the whole session. */
  overallNote: string;
};

export type Client = { id: string; name: string; position: number };

/** What the editor posts back. */
export type WorkoutDraft = {
  id: string | null;
  clientId: string;
  date: string;
  title: string;
  coachNote: string;
  exercises: { name: string; freeText: string; linkPrev: boolean }[];
};

/** A) B) C) … derived from position at render time, never stored. */
export function exerciseLabel(position: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return position < letters.length ? letters[position] : String(position + 1);
}

/**
 * Group labels. Consecutive exercises linked by `linkPrev` are one superset, so
 * A) B) becomes A1) A2) when the two are joined.
 */
export function exerciseLabels(
  exercises: { linkPrev: boolean }[],
): { label: string; superset: boolean }[] {
  const groups: number[][] = [];
  exercises.forEach((e, i) => {
    if (i === 0 || !e.linkPrev) groups.push([i]);
    else groups[groups.length - 1].push(i);
  });

  const out: { label: string; superset: boolean }[] = [];
  groups.forEach((group, gi) => {
    const letter = exerciseLabel(gi);
    group.forEach((idx, k) => {
      out[idx] = {
        label: group.length > 1 ? `${letter}${k + 1}` : letter,
        superset: group.length > 1,
      };
    });
  });
  return out;
}
