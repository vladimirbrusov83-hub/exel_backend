import { notFound } from "next/navigation";
import { prefixForSlug } from "@/lib/clients";
import { getProgram, type Week } from "@/lib/sheets";
import NoteForm from "./NoteForm";

// Render every request; getProgram's 5-minute cache is the only cache layer,
// so a full-route cache entry here would stack on top of it (or never expire).
export const dynamic = "force-dynamic";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const prefix = prefixForSlug(slug);
  if (!prefix) notFound();

  // Handled here rather than left to error.tsx: Next redacts server error
  // messages in production, and the real Sheets error (misnamed tab, Sheet not
  // shared yet) is the thing worth showing.
  let weeks: Week[];
  try {
    ({ weeks } = await getProgram(prefix));
  } catch (err) {
    return <LoadFailed detail={err instanceof Error ? err.message : String(err)} />;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Your training program</h1>

      {weeks.length === 0 && (
        <p className="mt-6 text-neutral-600 dark:text-neutral-400">
          No program yet — check back once your coach has added it.
        </p>
      )}

      {weeks.map((week, i) => (
        <details
          key={week.week}
          open={i === 0}
          className="group mt-6 rounded-xl border border-neutral-200 dark:border-neutral-700"
        >
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-neutral-400 transition-transform group-open:rotate-90">
              &#9656;
            </span>
            {week.week || "Week"}
          </summary>

          <div className="space-y-4 px-4 pb-4">
            {week.days.map((day) => (
              <section
                key={day.day}
                className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-900"
              >
                <h3 className="text-sm font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  {day.day || "Day"}
                </h3>

                <ul className="mt-3 divide-y divide-neutral-200 dark:divide-neutral-700">
                  {day.exercises.map((ex, j) => (
                    <li key={`${ex.exercise}-${j}`} className="py-3">
                      <p className="font-semibold">{ex.exercise}</p>
                      <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                        {ex.sets && ex.reps && (
                          <span>
                            <span className="font-medium text-neutral-900 dark:text-neutral-100">
                              {ex.sets} × {ex.reps}
                            </span>
                          </span>
                        )}
                        {ex.sets && !ex.reps && <span>{ex.sets} sets</span>}
                        {!ex.sets && ex.reps && <span>{ex.reps} reps</span>}
                        {ex.load && <span>Load: {ex.load}</span>}
                        {ex.rpe && <span>RPE {ex.rpe}</span>}
                      </dl>
                    </li>
                  ))}
                </ul>

                <NoteForm slug={slug} week={week.week} day={day.day} />
              </section>
            ))}
          </div>
        </details>
      ))}
    </main>
  );
}

function LoadFailed({ detail }: { detail: string }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-xl font-bold">Couldn&apos;t load your program</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Try again in a minute. If it keeps happening, let your coach know.
      </p>
      <pre className="mt-8 overflow-x-auto rounded-lg bg-neutral-100 p-3 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
        {detail}
      </pre>
    </main>
  );
}
