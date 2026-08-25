import Link from "next/link";
import { notFound } from "next/navigation";
import ExerciseLines from "@/components/ExerciseLines";
import { getAllWorkouts, getClient } from "@/lib/db";
import { formatLong, monthKey, monthLabel, today } from "@/lib/dates";
import { exerciseLabels } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function History({
  params,
}: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
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
    <main className="mx-auto max-w-md p-4 pb-16">
      <Link
        href={`/c/${clientId}`}
        className="inline-flex min-h-11 items-center text-sm text-neutral-500 underline underline-offset-4"
      >
        ‹ Back to the week
      </Link>
      <h1 className="mt-2 text-xl font-semibold">History</h1>

      {past.length === 0 && (
        <p className="mt-6 text-neutral-600">Nothing here yet.</p>
      )}

      {months.map((m) => (
        <section key={m.key} className="mt-6">
          <h2 className="sticky top-0 bg-[var(--background)] py-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
            {m.label}
          </h2>
          <ul className="flex flex-col gap-2">
            {m.workouts.map((w) => (
              <li key={w.id}>
                <details className="rounded-xl border border-neutral-300">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4">
                    <span>
                      <span className="font-medium">{w.title || "Session"}</span>
                      <span className="block text-sm text-neutral-600">
                        {formatLong(w.date)} · {w.exercises.length} exercises
                      </span>
                    </span>
                    <span aria-hidden className="chev text-neutral-400">
                      {w.done ? "✓" : "›"}
                    </span>
                  </summary>

                  <div className="border-t border-neutral-200 p-4">
                    {w.coachNote && (
                      <p className="mb-3 whitespace-pre-line rounded-lg bg-neutral-100 p-2 text-sm">
                        {w.coachNote}
                      </p>
                    )}
                    <ul className="flex flex-col gap-3">
                      {w.exercises.map((ex, i) => (
                        <li key={ex.id}>
                          <h3 className="text-sm font-medium">
                            <span className={exerciseLabels(w.exercises)[i].superset
                              ? "text-blue-600" : "text-neutral-400"}>
                              {exerciseLabels(w.exercises)[i].label}){" "}
                            </span>
                            {ex.name}
                          </h3>
                          <ExerciseLines freeText={ex.freeText} doneSets={ex.doneSets} />
                          {w.notes[ex.id] && (
                            <p className="mt-1 whitespace-pre-line text-sm text-blue-800">
                              {w.notes[ex.id]}
                            </p>
                          )}
                          {w.coachNotes[ex.id] && (
                            <p className="mt-1 whitespace-pre-line text-sm text-amber-800">
                              {w.coachNotes[ex.id]}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                    {w.overallNote && (
                      <p className="mt-3 whitespace-pre-line rounded-lg bg-blue-50 p-2 text-sm">
                        {w.overallNote}
                      </p>
                    )}
                    {w.overallCoachNote && (
                      <p className="mt-2 whitespace-pre-line rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
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
