import Link from "next/link";
import { notFound } from "next/navigation";
import ExerciseLines from "@/components/ExerciseLines";
import { requireClientView } from "@/lib/client-guard";
import { getAllWorkouts, getClient } from "@/lib/db";
import { dayOfMonth, monthKey, monthLabel, today, weekdayName } from "@/lib/dates";
import { exerciseLabels } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function History({
  params,
}: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireClientView(clientId);
  const client = await getClient(clientId);
  if (!client) notFound();

  // Everything up to and including today, newest first.
  const past = (await getAllWorkouts(clientId))
    .filter((w) => w.date <= today())
    .reverse();

  const months: { key: string; label: string; workouts: typeof past }[] = [];
  for (const w of past) {
    const key = monthKey(w.date);
    const last = months[months.length - 1];
    if (last?.key === key) last.workouts.push(w);
    else months.push({ key, label: monthLabel(w.date), workouts: [w] });
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-3 pb-12">
      <Link
        href={`/c/${clientId}`}
        className="inline-flex min-h-11 items-center gap-1 rounded-full pr-2 text-sm text-white/50"
      >
        <span aria-hidden className="text-lg leading-none">‹</span> Week
      </Link>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">History</h1>
      {past.length > 0 && (
        <p className="mt-1 text-sm text-white/45">
          {past.length} {past.length === 1 ? "session" : "sessions"} · tap one to read it
        </p>
      )}

      {past.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <p className="font-medium">Nothing here yet</p>
          <p className="mt-1 text-sm text-white/45">Past sessions show up here as you do them.</p>
        </div>
      )}

      {months.map((m) => (
        <section key={m.key} className="mt-6">
          <h2 className="sticky top-0 z-10 bg-[var(--background)] py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white/45">
            {m.label}
          </h2>
          <ul className="flex flex-col gap-2">
            {m.workouts.map((w) => (
              <li key={w.id}>
                <details className="group rounded-2xl bg-surface">
                  <summary className="card flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-2xl p-3">
                    <span
                      aria-hidden
                      className={`flex w-12 shrink-0 flex-col items-center justify-center rounded-xl py-1 ${
                        w.done ? "bg-green-400/15 text-green-200" : "bg-white/10"
                      }`}
                    >
                      <span className="text-[0.65rem] font-semibold uppercase tracking-wide opacity-70">
                        {weekdayName(w.date, true)}
                      </span>
                      <span className="text-lg font-bold leading-tight">{dayOfMonth(w.date)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{w.title || "Session"}</span>
                      <span className="block text-sm text-white/55">
                        {w.exercises.length} {w.exercises.length === 1 ? "exercise" : "exercises"}
                        {w.done ? " · done" : ""}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={`chev shrink-0 ${w.done ? "text-green-400" : "text-white/40"}`}
                    >
                      ›
                    </span>
                  </summary>

                  <div className="border-t border-white/10 p-3">
                    {w.coachNote && (
                      <p className="mb-3 whitespace-pre-line rounded-lg border-l-2 border-amber-300 bg-amber-400/8 py-1.5 pl-2.5 pr-2 text-sm">
                        {w.coachNote}
                      </p>
                    )}
                    <ul className="flex flex-col gap-3">
                      {w.exercises.map((ex, i) => {
                        const lbl = exerciseLabels(w.exercises)[i];
                        return (
                          <li key={ex.id}>
                            <h3 className="flex items-center gap-2 text-sm font-semibold">
                              <span
                                aria-hidden
                                className={`flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[0.65rem] font-bold ${
                                  lbl.superset ? "bg-blue-400/20 text-blue-200" : "bg-white/12 text-white/80"
                                }`}
                              >
                                {lbl.label}
                              </span>
                              <span className="sr-only">{lbl.label}) </span>
                              {ex.name}
                            </h3>
                            <ExerciseLines freeText={ex.freeText} doneSets={ex.doneSets} ratings={ex.ratings} />
                            {w.notes[ex.id] && (
                              <p className="mt-1 whitespace-pre-line text-sm text-blue-200">
                                <span className="font-medium text-blue-300">You · </span>
                                {w.notes[ex.id]}
                              </p>
                            )}
                            {w.coachNotes[ex.id] && (
                              <p className="mt-1 whitespace-pre-line text-sm text-amber-200">
                                <span className="font-medium text-amber-300">Coach · </span>
                                {w.coachNotes[ex.id]}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {w.overallNote && (
                      <p className="mt-3 whitespace-pre-line rounded-lg bg-blue-400/10 p-2 text-sm text-blue-100">
                        <span className="font-medium text-blue-300">You · </span>
                        {w.overallNote}
                      </p>
                    )}
                    {w.overallCoachNote && (
                      <p className="mt-2 whitespace-pre-line rounded-lg bg-amber-400/10 p-2 text-sm text-amber-100">
                        <span className="font-medium text-amber-300">Coach · </span>
                        {w.overallCoachNote}
                      </p>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
