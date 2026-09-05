"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setLines } from "@/lib/types";
import { saveSetRating, toggleSet } from "../../actions";
import RatingDialog from "./RatingDialog";

/**
 * The set lines with a box in front of each one, tapped to mark that set done.
 * Both of them use this: the client in the gym, and the coach from the same page
 * on his phone. A set is done or it is not, so there is one shared tick and not
 * one per author the way notes are.
 *
 * A tick is keyed on the line number from `setLines` — the only handle a set
 * has, since nothing here is ever parsed. Blank lines keep their number and
 * render as a gap, or every line below one would shift.
 *
 * Optimistic, because this is tapped between sets on gym wifi and a box that
 * waits for a round-trip feels broken. `useOptimistic` layers over the server
 * value, so the tick shows instantly and then lands on what the revalidated page
 * says — see the note on `toggleSet` about why that revalidate has to be there.
 *
 * Second button on each row: RIR/RPE. It opens `RatingDialog` on the set it
 * belongs to, and once rated it shows the value in its place. Rating is keyed on
 * the same line number as the tick and is just as much a thing the two of them
 * look at — nothing reads it, the same way nothing reads a tick.
 */
export default function SetChecks({
  clientId, workoutId, exerciseId, exerciseName, freeText, doneSets, ratings,
}: {
  clientId: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  freeText: string;
  doneSets: number[];
  /** Keyed by line number as a string, as it comes out of the jsonb column. */
  ratings: Record<string, string>;
}) {
  const [, start] = useTransition();
  /** Which line's rating dialog is open, or null. One at a time. */
  const [rating, setRating] = useState<number | null>(null);
  const [done, addOptimistic] = useOptimistic(
    doneSets,
    (state: number[], change: { line: number; done: boolean }) =>
      change.done ? [...state, change.line] : state.filter((n) => n !== change.line),
  );

  if (!freeText.trim()) return null;
  const ticked = new Set(done);

  // Set numbers count only real lines, so a blank spacer line does not make
  // the next set "set 4" on screen while the tick stays keyed on line.index.
  let setNo = 0;

  return (
    // The dialog is a sibling of the <ul>, not a child of it: only <li> is
    // valid inside a list, and it is fixed-position anyway.
    <>
      <ul className="mt-1">
        {setLines(freeText).map((line) => {
          if (line.text.trim() === "") return <li key={line.index} aria-hidden className="h-2" />;
          setNo += 1;
          const n = setNo;
          const isDone = ticked.has(line.index);
          const rated = ratings[String(line.index)] ?? "";
          return (
            // The row is a flex pair, not one full-width button: a button cannot
            // be nested inside another button, and the tick used to be the whole
            // row. The tick takes the space that is left, the RIR button is a
            // fixed-width sibling.
            <li key={line.index} className="flex items-center gap-1">
              <button
                type="button"
                aria-pressed={isDone}
                // The set number is in here because a day routinely has the same
                // line three times over — "45*10, 45*10, 45*10" — and a screen
                // reader would otherwise read three identical buttons.
                aria-label={`${exerciseName}, set ${n}: ${line.text}`}
                onClick={() =>
                  start(async () => {
                    addOptimistic({ line: line.index, done: !isDone });
                    await toggleSet(clientId, workoutId, exerciseId, line.index, !isDone);
                  })
                }
                className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition-colors active:bg-white/10"
              >
                <span
                  aria-hidden
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-sm leading-none transition-colors ${
                    isDone
                      ? "tick-on border-green-400 bg-green-400 text-neutral-900"
                      : "border-white/35 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span
                  aria-hidden
                  className={`w-4 shrink-0 text-right font-mono text-[0.7rem] ${
                    isDone ? "text-white/25" : "text-white/40"
                  }`}
                >
                  {n}
                </span>
                <span
                  className={`font-mono text-base tracking-tight ${
                    isDone ? "text-white/35 line-through" : "text-white/90"
                  }`}
                >
                  {line.text}
                </span>
              </button>

              {/* Rated or not, the button is the same 44px tall and sits in the
                  same column, so the rows never jump about as sets are rated.
                  Once there is a value it *is* the label — that is how the client
                  reads their own rating back without opening anything. */}
              <button
                type="button"
                aria-label={
                  rated
                    ? `${exerciseName}, set ${n}: rated ${rated}. Change`
                    : `${exerciseName}, set ${n}: rate RIR or RPE`
                }
                onClick={() => setRating(line.index)}
                className={`flex min-h-11 shrink-0 items-center justify-center rounded-lg px-2 transition-colors active:bg-white/10 ${
                  rated ? "min-w-11" : "w-11"
                }`}
              >
                <span
                  aria-hidden
                  className={`rounded-md px-1.5 py-0.5 font-mono leading-none ${
                    rated
                      ? "bg-blue-400/20 text-sm font-semibold text-blue-200"
                      : "bg-white/8 text-[0.6rem] font-semibold tracking-tight text-white/35"
                  }`}
                >
                  {rated || "RIR"}
                </span>
              </button>
            </li>
          );
        })}

      </ul>

      {/* One dialog for the whole exercise, mounted on the line being rated.
          `key` on the line so re-opening a different set gets a fresh box
          rather than the previous set's text still sitting in state. */}
      {rating !== null && (
        <RatingDialog
          key={rating}
          title={exerciseName}
          subtitle={setLines(freeText)[rating]?.text ?? ""}
          initial={ratings[String(rating)] ?? ""}
          onSave={(value) => saveSetRating(clientId, workoutId, exerciseId, rating, value)}
          onClose={() => setRating(null)}
        />
      )}
    </>
  );
}
