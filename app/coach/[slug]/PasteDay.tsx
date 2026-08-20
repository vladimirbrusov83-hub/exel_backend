"use client";

import { useMemo, useState } from "react";
import { parseDay } from "@/lib/parse";
import { nextWeekLabel } from "@/lib/weeks";

type Status = { kind: "idle" | "working" | "done" | "error"; message?: string };

const PLACEHOLDER = `Day 2
A) Squat
95*10
115*6
135*10
135*10
B) Military press
b*10
55*10
55*10`;

export default function PasteDay({
  slug,
  prefix,
  weeks,
}: {
  slug: string;
  prefix: string;
  weeks: string[];
}) {
  const [text, setText] = useState("");
  // Default to the week after the newest one in the program.
  const suggested = weeks.length ? nextWeekLabel(weeks[weeks.length - 1]) ?? "" : "Week 1";
  const [week, setWeek] = useState(suggested);
  const [day, setDay] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const parsed = useMemo(() => parseDay(text), [text]);
  const setCount = parsed.exercises.reduce((n, e) => n + e.sets.length, 0);
  // The day name from the pasted text is used unless you type your own.
  const dayLabel = day.trim() || parsed.day?.trim() || "";

  function touched() {
    if (status.kind !== "idle") setStatus({ kind: "idle" });
  }

  async function add() {
    setStatus({ kind: "working" });
    try {
      const res = await fetch(`/api/coach/paste/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: prefix, week, day: dayLabel, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setStatus({ kind: "error", message: data.error ?? "Couldn't write to the Sheet." });
        return;
      }
      setText("");
      setDay("");
      setStatus({
        kind: "done",
        message: `Added ${data.exercises} exercises, ${data.rows} sets to ${data.week} - ${data.day}.`,
      });
    } catch {
      setStatus({ kind: "error", message: "No connection. Try again." });
    }
  }

  const fieldClass =
    "field mt-2 min-h-11 px-3 text-base";
  const labelClass =
    "text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400";

  return (
    <div className="space-y-6">
      <label className="block">
        <span className={labelClass}>Type or paste the day</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            touched();
          }}
          rows={14}
          spellCheck={false}
          placeholder={PLACEHOLDER}
          className="field mt-2 p-3 font-mono text-sm leading-relaxed"
        />
        <span className="mt-2 block text-xs text-neutral-500 dark:text-neutral-400">
          One exercise per line, its sets underneath as <code>weight*reps</code>. Letters like{" "}
          <code>A)</code> are optional and stripped. <code>x</code> works as well as{" "}
          <code>*</code>, and <code>@8</code> on the end sets the RPE.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Week</span>
          <input
            value={week}
            onChange={(e) => {
              setWeek(e.target.value);
              touched();
            }}
            list="existing-weeks"
            placeholder="Week 1"
            className={fieldClass}
          />
          <datalist id="existing-weeks">
            {weeks.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
        </label>

        <label className="block">
          <span className={labelClass}>Day</span>
          <input
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              touched();
            }}
            placeholder={parsed.day ?? "Day 1"}
            className={fieldClass}
          />
          {!day.trim() && parsed.day && (
            <span className="mt-1 block text-xs text-neutral-500 dark:text-neutral-400">
              Using &ldquo;{parsed.day}&rdquo; from the text above.
            </span>
          )}
        </label>
      </div>

      {parsed.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {parsed.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      {parsed.exercises.length > 0 && (
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-700">
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
            <h2 className="font-semibold">
              {week.trim() || "..."} / {dayLabel || "..."}
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {parsed.exercises.length} exercises, {setCount}{" "}
              {setCount === 1 ? "set" : "sets"}
            </span>
          </header>
          <ul className="space-y-2 p-4">
            {parsed.exercises.map((e, i) => (
              <li key={`${e.name}-${i}`} className="text-sm">
                <span className="font-medium">{e.name}</span>
                <ul className="mt-0.5 space-y-0.5">
                  {e.sets.map((s, j) => (
                    <li
                      key={j}
                      className="flex flex-wrap items-baseline gap-x-3 pl-3 text-neutral-600 dark:text-neutral-400"
                    >
                      <span className="w-4 shrink-0 text-right font-mono text-xs text-neutral-400">
                        {j + 1}
                      </span>
                      <span>
                        {s.load} x {s.reps}
                      </span>
                      {s.rpe && <span className="text-xs">RPE {s.rpe}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={add}
          disabled={
            status.kind === "working" ||
            setCount === 0 ||
            !week.trim() ||
            !dayLabel
          }
          className="min-h-12 rounded-lg bg-neutral-900 px-6 text-sm font-semibold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {status.kind === "working" ? "Adding..." : "Add to Sheet"}
        </button>
        {status.kind === "done" && (
          <span className="text-sm font-medium text-green-700 dark:text-green-400">
            {status.message}
          </span>
        )}
        {status.kind === "error" && (
          <span className="text-sm font-medium text-red-700 dark:text-red-400">
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}
