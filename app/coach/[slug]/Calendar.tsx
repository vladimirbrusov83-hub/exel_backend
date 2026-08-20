"use client";

import { useState } from "react";
import type { Week } from "@/lib/sheets";

/** How many weeks sit side by side. */
const SPAN = 2;

export default function Calendar({ weeks }: { weeks: Week[] }) {
  // Start on the last SPAN weeks — the ones being written right now.
  const [start, setStart] = useState(Math.max(0, weeks.length - SPAN));
  const visible = weeks.slice(start, start + SPAN);
  const canBack = start > 0;
  const canForward = start + SPAN < weeks.length;

  if (weeks.length === 0) {
    return (
      <p className="text-neutral-600 dark:text-neutral-400">
        Nothing programmed yet. Write a day and it shows up here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStart((s) => Math.max(0, s - SPAN))}
          disabled={!canBack}
          aria-label="Earlier weeks"
          className="min-h-11 min-w-11 rounded-lg border border-neutral-300 text-sm font-semibold disabled:opacity-30 dark:border-neutral-600"
        >
          &larr;
        </button>
        <button
          type="button"
          onClick={() => setStart((s) => Math.min(weeks.length - 1, s + SPAN))}
          disabled={!canForward}
          aria-label="Later weeks"
          className="min-h-11 min-w-11 rounded-lg border border-neutral-300 text-sm font-semibold disabled:opacity-30 dark:border-neutral-600"
        >
          &rarr;
        </button>
        <span className="ml-auto text-xs text-neutral-500 dark:text-neutral-400">
          {weeks.length} {weeks.length === 1 ? "week" : "weeks"} in the program
        </span>
      </div>

      {/* Columns scroll inside this box rather than the page. */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-3">
          {visible.map((week) => (
            <section
              key={week.week}
              className="w-[17rem] shrink-0 rounded-xl border border-neutral-200 sm:w-auto sm:flex-1 dark:border-neutral-700"
            >
              <header className="flex items-baseline justify-between gap-2 border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
                <h3 className="font-bold">{week.week || "Week"}</h3>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {week.days.length}d
                </span>
              </header>

              <div className="space-y-2 p-2">
                {week.days.map((day) => (
                  <article
                    key={day.day}
                    className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900"
                  >
                    <header className="flex items-baseline justify-between gap-2">
                      <h4 className="text-sm font-bold">{day.day || "Day"}</h4>
                      <span className="text-xs text-neutral-400">
                        {day.movements.length}ex
                      </span>
                    </header>

                    <ul className="mt-2 space-y-1.5">
                      {day.movements.map((m, i) => (
                        <li key={`${m.exercise}-${i}`}>
                          <p className="text-sm font-semibold leading-tight">{m.exercise}</p>
                          <ul className="mt-0.5">
                            {m.sets.map((set, j) => (
                              <li
                                key={j}
                                className="font-mono text-xs leading-snug text-neutral-500 dark:text-neutral-400"
                              >
                                {[set.load, set.reps].filter(Boolean).join("*") || "-"}
                                {set.rpe && ` @${set.rpe}`}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
