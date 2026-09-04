import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { COACH_COOKIE, isCoachToken } from "@/lib/auth";
import { requireClientView } from "@/lib/client-guard";
import { getClient, getWorkout } from "@/lib/db";
import { formatLong, today } from "@/lib/dates";
import { exerciseGroups, exerciseLabels, setLines } from "@/lib/types";
import DoneButton from "./DoneButton";
import SetChecks from "./SetChecks";
import NoteBox from "./NoteBox";

export const dynamic = "force-dynamic";

export default async function WorkoutDetail({
  params,
}: { params: Promise<{ clientId: string; workoutId: string }> }) {
  const { clientId, workoutId } = await params;
  await requireClientView(clientId);
  const [client, workout] = await Promise.all([getClient(clientId), getWorkout(workoutId)]);
  if (!client || !workout || workout.clientId !== clientId) notFound();

  // requireClientView above decides who may read this page at all. This cookie
  // check now decides one thing only: which way out the back link points. The
  // page itself is the same read-and-tick view for both of them — the coach
  // writes on /coach.
  const isCoach = await isCoachToken((await cookies()).get(COACH_COOKIE)?.value);

  const labels = exerciseLabels(workout.exercises);
  // A superset pair is one block, not two bordered cards — same grouping the
  // A1)/A2) labels come from, so the two can never disagree.
  const groups = exerciseGroups(workout.exercises);

  // Sets ticked over sets written, for the header line. Display only — it is
  // the same checkbox state the boxes below show, counted.
  let totalSets = 0;
  let doneSets = 0;
  for (const ex of workout.exercises) {
    const lines = setLines(ex.freeText).filter((l) => l.text.trim() !== "");
    totalSets += lines.length;
    const valid = new Set(lines.map((l) => l.index));
    doneSets += ex.doneSets.filter((n) => valid.has(n)).length;
  }
  const isToday = workout.date === today();
  const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;

  return (
    <main className="mx-auto max-w-md px-4 pt-2 pb-10">
      <div className="flex items-center justify-between gap-2">
        {/* The coach reached this page from /coach, the client from their own
            week, so the way out is not the same door for the two of them. */}
        {isCoach ? (
          <Link
            href={`/coach?c=${clientId}`}
            className="inline-flex min-h-11 items-center gap-1 rounded-full pr-2 text-sm text-white/50"
          >
            <span aria-hidden className="text-lg leading-none">‹</span> Calendar
          </Link>
        ) : (
          <Link
            href={`/c/${clientId}`}
            className="inline-flex min-h-11 items-center gap-1 rounded-full pr-2 text-sm text-white/50"
          >
            <span aria-hidden className="text-lg leading-none">‹</span> Week
          </Link>
        )}
      </div>

      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/45">
          {isToday ? "Today · " : ""}{formatLong(workout.date)}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{workout.title || "Session"}</h1>
        {totalSets > 0 && (
          <div className="mt-3 flex items-baseline justify-between text-xs text-white/50">
            <span>
              {workout.done
                ? "Session done"
                : doneSets === 0
                  ? `${workout.exercises.length} exercises · ${totalSets} sets`
                  : `${doneSets} of ${totalSets} sets`}
            </span>
            {!workout.done && doneSets > 0 && <span className="font-mono">{pct}%</span>}
          </div>
        )}
      </header>

      {/* The bar is a sibling of <header>, not a child of it: a sticky element
          is clipped by its own parent's box, so left inside the header it would
          scroll away with the date and the title. Out here it pins and they
          don't, which is the point. `.sticky-bar` carries the notch offset and
          the solid page background — see globals.css. */}
      {totalSets > 0 && (
        <div className="sticky-bar pb-3" aria-hidden>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                workout.done ? "bg-green-400" : "bg-white/70"
              }`}
              style={{ width: `${workout.done ? 100 : pct}%` }}
            />
          </div>
        </div>
      )}

      {workout.coachNote && (
        <section className="mt-1 rounded-xl border-l-2 border-amber-300 bg-amber-400/8 py-2.5 pl-3 pr-3">
          <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-amber-300">
            From your coach
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{workout.coachNote}</p>
        </section>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {groups.map((group) => (
          <li
            key={workout.exercises[group[0]].id}
            className="rounded-2xl bg-surface px-3 py-2.5"
          >
            {group.map((i, k) => {
              const ex = workout.exercises[i];
              return (
                <div key={ex.id} className={k > 0 ? "mt-3 border-t border-white/10 pt-3" : ""}>
                  <h3 className="flex items-center gap-2.5 font-semibold">
                    <span
                      aria-hidden
                      className={`flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 font-mono text-xs font-bold ${
                        labels[i].superset
                          ? "bg-blue-400/20 text-blue-200"
                          : "bg-white/12 text-white/80"
                      }`}
                    >
                      {labels[i].label}
                    </span>
                    <span className="sr-only">{labels[i].label}) </span>
                    <span className="min-w-0 flex-1 leading-snug">{ex.name}</span>
                  </h3>
                  <SetChecks
                    clientId={clientId}
                    workoutId={workout.id}
                    exerciseId={ex.id}
                    exerciseName={ex.name}
                    freeText={ex.freeText}
                    doneSets={ex.doneSets}
                  />
                  {/* Anything the coach already wrote on this lift, read-only —
                      he writes it on /coach now, not here. It stays above the
                      one box on the card, so it is read before it is answered. */}
                  {workout.coachNotes[ex.id] && (
                    <p className="mt-2 whitespace-pre-line rounded-lg border-l-2 border-amber-300 bg-amber-400/10 py-1.5 pl-2.5 pr-2 text-sm text-amber-100">
                      <span className="font-medium text-amber-300">Coach · </span>
                      {workout.coachNotes[ex.id]}
                    </p>
                  )}
                  <NoteBox
                    workoutId={workout.id}
                    exerciseId={ex.id}
                    initial={workout.notes[ex.id] ?? ""}
                    label="Your notes"
                    placeholder="How did it feel?"
                    compact
                  />
                </div>
              );
            })}
          </li>
        ))}
      </ul>

      <section className="mt-3 rounded-2xl border border-white/12 p-3">
        <NoteBox
          workoutId={workout.id}
          exerciseId={null}
          initial={workout.overallNote}
          label="Notes on the whole session"
          placeholder="Energy, sleep, anything your coach should know"
          rows={2}
        />
      </section>

      <div className="mt-5">
        <DoneButton clientId={clientId} workoutId={workout.id} done={workout.done} />
      </div>
    </main>
  );
}
