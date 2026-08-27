import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { COACH_COOKIE, isCoachToken } from "@/lib/auth";
import { getClient, getWorkout } from "@/lib/db";
import { formatLong } from "@/lib/dates";
import { exerciseLabels } from "@/lib/types";
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

  return (
    <main className="mx-auto max-w-md p-4 pb-16">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/c/${clientId}`}
          className="inline-flex min-h-11 items-center text-sm text-neutral-500 underline underline-offset-4"
        >
          ‹ Back to the week
        </Link>
        {/* The way back to the editor. On the phone the coach reaches this page
            by tapping a session on /coach, so this is how he fixes a load from
            the gym floor. `?edit=` opens the editor on this day. */}
        {isCoach && (
          <Link
            href={`/coach?c=${clientId}&edit=${workout.id}`}
            className="inline-flex min-h-11 shrink-0 items-center text-sm text-amber-700 underline underline-offset-4"
          >
            ✏️ Edit
          </Link>
        )}
      </div>

      <header className="mt-2">
        <h1 className="text-xl font-semibold">{workout.title || "Session"}</h1>
        <p className="text-sm text-neutral-600">{formatLong(workout.date)}</p>
      </header>

      {workout.coachNote && (
        <section className="mt-4 rounded-xl bg-neutral-100 p-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            From your coach
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm">{workout.coachNote}</p>
        </section>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {workout.exercises.map((ex, i) => (
          <li
            key={ex.id}
            className={`rounded-xl border p-3 ${
              labels[i].superset ? "border-blue-300" : "border-neutral-300"
            }`}
          >
            <h3 className="font-medium">
              <span className={labels[i].superset ? "text-blue-600" : "text-neutral-400"}>
                {labels[i].label}){" "}
              </span>
              {ex.name}
              {labels[i].superset && (
                <span className="ml-2 text-xs font-normal text-blue-600">⚡ superset</span>
              )}
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
            />
            {isCoach ? (
              <NoteBox
                workoutId={workout.id}
                exerciseId={ex.id}
                initial={workout.coachNotes[ex.id] ?? ""}
                label="Coach note"
                placeholder="Note for this lift"
                tone="coach"
              />
            ) : (
              workout.coachNotes[ex.id] && (
                <p className="mt-2 whitespace-pre-line rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                  <span className="font-medium">Coach: </span>
                  {workout.coachNotes[ex.id]}
                </p>
              )
            )}
          </li>
        ))}
      </ul>

      <section className="mt-4 rounded-xl border border-neutral-300 p-4">
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
            <p className="mt-3 whitespace-pre-line rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
              <span className="font-medium">Coach: </span>
              {workout.overallCoachNote}
            </p>
          )
        )}
      </section>

      <div className="mt-6">
        <DoneButton clientId={clientId} workoutId={workout.id} done={workout.done} />
      </div>
    </main>
  );
}
