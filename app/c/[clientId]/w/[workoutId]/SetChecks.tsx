"use client";

import { useOptimistic, useTransition } from "react";
import { setLines } from "@/lib/types";
import { toggleSet } from "../../actions";

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
 */
export default function SetChecks({
  clientId, workoutId, exerciseId, exerciseName, freeText, doneSets,
}: {
  clientId: string;
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  freeText: string;
  doneSets: number[];
}) {
  const [, start] = useTransition();
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
    <ul className="mt-1">
      {setLines(freeText).map((line) => {
        if (line.text.trim() === "") return <li key={line.index} aria-hidden className="h-2" />;
        setNo += 1;
        const n = setNo;
        const isDone = ticked.has(line.index);
        return (
          <li key={line.index}>
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
              className="flex min-h-11 w-full items-center gap-3 rounded-lg text-left transition-colors active:bg-white/10"
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
          </li>
        );
      })}
    </ul>
  );
}
