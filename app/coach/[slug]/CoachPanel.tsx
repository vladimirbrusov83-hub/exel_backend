"use client";

import { useMemo, useState } from "react";
import { applyBump, nextWeekLabel, type Bump } from "@/lib/bump";
import type { ClientProgram } from "./page";

const BUMPS: { label: string; bump: Bump }[] = [
  { label: "Same", bump: { mode: "same" } },
  { label: "+2.5", bump: { mode: "add", value: 2.5 } },
  { label: "+5", bump: { mode: "add", value: 5 } },
  { label: "Deload −10%", bump: { mode: "percent", value: -10 } },
];

type Status = { kind: "idle" | "working" | "done" | "error"; message?: string };

export default function CoachPanel({
  slug,
  clients,
}: {
  slug: string;
  clients: ClientProgram[];
}) {
  const [prefix, setPrefix] = useState(clients[0]?.prefix ?? "");
  const [bumpIndex, setBumpIndex] = useState(2); // +5 is the common case
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const active = clients.find((c) => c.prefix === prefix);
  const weeks = active?.program?.weeks ?? [];
  // Weeks arrive sorted, so the last one is the newest.
  const [sourceWeek, setSourceWeek] = useState<string | null>(null);
  const source = weeks.find((w) => w.week === sourceWeek) ?? weeks[weeks.length - 1];
  const bump = BUMPS[bumpIndex].bump;
  const target = source ? nextWeekLabel(source.week) : null;

  const rowCount = useMemo(
    () =>
      source
        ? source.days.reduce(
            (n, d) => n + d.movements.reduce((m, mv) => m + mv.sets.length, 0),
            0
          )
        : 0,
    [source]
  );

  async function build() {
    if (!source) return;
    setStatus({ kind: "working" });
    try {
      const res = await fetch(`/api/coach/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: prefix, sourceWeek: source.week, bump }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setStatus({ kind: "error", message: data.error ?? "Couldn't write to the Sheet." });
        return;
      }
      setStatus({
        kind: "done",
        message: `Wrote ${data.rows} rows as ${data.week}. Reload to see it.`,
      });
    } catch {
      setStatus({ kind: "error", message: "No connection. Try again." });
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap gap-2">
        {clients.map((c) => (
          <button
            key={c.prefix}
            type="button"
            onClick={() => {
              setPrefix(c.prefix);
              setSourceWeek(null);
              setStatus({ kind: "idle" });
            }}
            className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${
              c.prefix === prefix
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                : "border-neutral-300 dark:border-neutral-600"
            }`}
          >
            {c.prefix}
          </button>
        ))}
      </div>

      {active?.error && (
        <pre className="overflow-x-auto rounded-lg bg-neutral-100 p-3 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          {active.error}
        </pre>
      )}

      {!active?.error && weeks.length === 0 && (
        <p className="text-neutral-600 dark:text-neutral-400">
          {prefix}_Program has no weeks in it yet.
        </p>
      )}

      {source && (
        <>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Copy from
            </span>
            <select
              value={source.week}
              onChange={(e) => {
                setSourceWeek(e.target.value);
                setStatus({ kind: "idle" });
              }}
              className="mt-2 block min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-base dark:border-neutral-600 dark:bg-neutral-900"
            >
              {weeks.map((w) => (
                <option key={w.week} value={w.week}>
                  {w.week}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Load change
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {BUMPS.map((b, i) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => {
                    setBumpIndex(i);
                    setStatus({ kind: "idle" });
                  }}
                  className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${
                    i === bumpIndex
                      ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                      : "border-neutral-300 dark:border-neutral-600"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              Applies to the number in the Load cell and keeps the units. Cells like
              &ldquo;bar&rdquo; or &ldquo;BW&rdquo; are left alone. Deload rounds to the nearest 2.5.
            </p>
          </div>

          <section className="rounded-xl border border-neutral-200 dark:border-neutral-700">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
              <h2 className="font-semibold">
                {source.week} → {target ?? "?"}
              </h2>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {rowCount} rows
              </span>
            </header>

            <div className="space-y-4 p-4">
              {source.days.map((day) => (
                <div key={day.day}>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    {day.day}
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {day.movements.map((m, i) => (
                      <li key={`${m.exercise}-${i}`} className="text-sm">
                        <span className="font-medium">{m.exercise}</span>
                        <ul className="mt-0.5 space-y-0.5">
                          {m.sets.map((set, j) => {
                            const next = applyBump(set.load, bump);
                            return (
                              <li
                                key={j}
                                className="flex flex-wrap items-baseline gap-x-2 pl-3 text-neutral-600 dark:text-neutral-400"
                              >
                                <span className="font-mono text-xs">
                                  {[set.set, set.reps].filter(Boolean).join(" × ") || "—"}
                                </span>
                                {/* Only show the before/after when it actually
                                    changes — "BW → BW" is just noise. */}
                                {set.load && next === set.load && <span>{set.load}</span>}
                                {set.load && next !== set.load && (
                                  <>
                                    <span className="line-through decoration-neutral-300">
                                      {set.load}
                                    </span>
                                    <span aria-hidden>→</span>
                                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                      {next}
                                    </span>
                                  </>
                                )}
                                {set.rpe && <span className="text-xs">RPE {set.rpe}</span>}
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={build}
              disabled={status.kind === "working" || !target}
              className="min-h-12 rounded-lg bg-neutral-900 px-6 text-sm font-semibold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {status.kind === "working" ? "Writing…" : `Write ${target ?? "next week"} to Sheet`}
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
        </>
      )}
    </div>
  );
}
