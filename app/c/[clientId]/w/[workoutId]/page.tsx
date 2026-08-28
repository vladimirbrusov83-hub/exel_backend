import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { COACH_COOKIE, isCoachToken } from "@/lib/auth";
import { getClient, getWorkout } from "@/lib/db";
import { formatLong } from "@/lib/dates";
import { exerciseGroups, exerciseLabels } from "@/lib/types";
import DoneButton from "./DoneButton";
import SetChecks from "./SetChecks";
import NoteBox from "./NoteBox";

export const dynamic = "force-dynamic";

export default async function WorkoutDetail({
  params,
}: { params: Promise<{ clientId: string; workoutId: string }> }) {
  const { clientId, workoutId } = await params;
  const [client, workout] = await Promise.all([getClient(clientId), getWorkout(workoutId)]);
  if (!client || !workout || workout.clientId !== clientId) notFound();

  // This page is public. The cookie only decides whether the coach gets his own
  // amber boxes to type in — the gate on writing one is requireCoach() inside
  // saveCoachNote, not this.
  const isCoach = await isCoachToken((await cookies()).get(COACH_COOKIE)?.value);

  const labels = exerciseLabels(workout.exercises);
  // A superset pair is one block, not two bordered cards — same grouping the
  // A1)/A2) labels come from, so the two can never disagree.
  const groups = exerciseGroups(workout.exercises);

  return (
    <main className="mx-auto max-w-md px-4 pt-2 pb-8">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/c/${clientId}`}
          className="inline-flex min-h-11 items-center text-sm text-white/50 underline underline-offset-4"
        >
          ‹ Back to the week
        </Link>
        {/* The way back to the editor. On the phone the coach reaches this page
            by tapping a session on /coach, so this is how he fixes a load from
            the gym floor. `?edit=` opens the editor on this day. */}
        {isCoach && (
          <Link
            href={`/coach?c=${clientId}&edit=${workout.id}`}
            className="inline-flex min-h-11 shrink-0 items-center text-sm text-amber-300 underline underline-offset-4"
          >
            ✏️ Edit
          </Link>
        )}
      </div>

      <header className="border-b border-white/10 pb-2">
        <h1 className="text-xl font-bold tracking-tight">{workout.title || "Session"}</h1>
        <p className="mt-0.5 text-sm text-white/45">{formatLong(workout.date)}</p>
      </header>

      {workout.coachNote && (
        <section className="mt-2 rounded-xl bg-white/8 p-2.5">
          <h2 className="text-xs font-medium uppercase tracking-wide text-white/45">
            From your coach
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm">{workout.coachNote}</p>
        </section>
      )}

      <ul className="mt-2 flex flex-col gap-1.5">
        {groups.map((group) => (
          <li
            key={workout.exercises[group[0]].id}
            className="rounded-xl bg-[#4e4f60] px-3 py-2"
          >
            {group.map((i, k) => {
              const ex = workout.exercises[i];
              return (
                <div key={ex.id} className={k > 0 ? "mt-3" : ""}>
                  <h3 className="flex items-baseline gap-2 font-semibold">
                    <span aria-hidden className="size-2 shrink-0 rounded-full bg-white/45" />
                    <span>
                      {labels[i].label}) {ex.name}
                    </span>
                  </h3>
                  <SetChecks
                    clientId={clientId}
                    workoutId={workout.id}
                    exerciseId={ex.id}
                    exerciseName={ex.name}
                    freeText={ex.freeText}
                    doneSets={ex.doneSets}
                  />
                  <NoteBox
                    workoutId={workout.id}
                    exerciseId={ex.id}
                    initial={workout.notes[ex.id] ?? ""}
                    label="Your notes"
                    placeholder="How did it feel?"
                    compact
                  />
                  {isCoach ? (
                    <NoteBox
                      workoutId={workout.id}
                      exerciseId={ex.id}
                      initial={workout.coachNotes[ex.id] ?? ""}
                      label="Coach note"
                      placeholder="Note for this lift"
                      tone="coach"
                      compact
                    />
                  ) : (
                    workout.coachNotes[ex.id] && (
                      <p className="mt-2 whitespace-pre-line rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-sm text-amber-100">
                        <span className="font-medium">Coach: </span>
                        {workout.coachNotes[ex.id]}
                      </p>
                    )
                  )}
                </div>
              );
            })}
          </li>
        ))}
      </ul>

      <section className="mt-2 rounded-xl border border-white/12 p-3">
        <NoteBox
          workoutId={workout.id}
          exerciseId={null}
          initial={workout.overallNote}
          label="Notes on the whole session"
          rows={2}
        />
        {isCoach ? (
          <NoteBox
            workoutId={workout.id}
            exerciseId={null}
            initial={workout.overallCoachNote}
            label="Coach note on the session"
            rows={2}
            tone="coach"
          />
        ) : (
          workout.overallCoachNote && (
            <p className="mt-3 whitespace-pre-line rounded-lg border border-amber-400/30 bg-amber-400/10 p-2 text-sm text-amber-100">
              <span className="font-medium">Coach: </span>
              {workout.overallCoachNote}
            </p>
          )
        )}
      </section>

      <div className="mt-4">
        <DoneButton clientId={clientId} workoutId={workout.id} done={workout.done} />
      </div>
    </main>
  );
}
