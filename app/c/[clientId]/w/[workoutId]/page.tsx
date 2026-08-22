import Link from "next/link";
import { notFound } from "next/navigation";
import ExerciseLines from "@/components/ExerciseLines";
import { getClient, getWorkout } from "@/lib/db";
import { formatLong } from "@/lib/dates";
import { exerciseLabels } from "@/lib/types";
import DoneButton from "./DoneButton";
import NoteBox from "./NoteBox";

export const dynamic = "force-dynamic";

export default async function WorkoutDetail({
  params,
}: { params: Promise<{ clientId: string; workoutId: string }> }) {
  const { clientId, workoutId } = await params;
  const [client, workout] = await Promise.all([getClient(clientId), getWorkout(workoutId)]);
  if (!client || !workout || workout.clientId !== clientId) notFound();

  const labels = exerciseLabels(workout.exercises);

  return (
    <main className="mx-auto max-w-md p-4 pb-16">
      <Link
        href={`/c/${clientId}`}
        className="inline-flex min-h-11 items-center text-sm text-neutral-500 underline underline-offset-4"
      >
        ‹ Back to the week
      </Link>

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

      <ul className="mt-4 flex flex-col gap-3">
        {workout.exercises.map((ex, i) => (
          <li
            key={ex.id}
            className={`rounded-xl border p-4 ${
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
            <ExerciseLines freeText={ex.freeText} />
            <NoteBox
              workoutId={workout.id}
              exerciseId={ex.id}
              initial={workout.notes[ex.id] ?? ""}
              label="Your notes"
              placeholder="How did it feel?"
            />
          </li>
        ))}
      </ul>

      <section className="mt-4 rounded-xl border border-neutral-300 p-4">
        <NoteBox
          workoutId={workout.id}
          exerciseId={null}
          initial={workout.overallNote}
          label="Notes on the whole session"
        />
      </section>

      <div className="mt-6">
        <DoneButton clientId={clientId} workoutId={workout.id} done={workout.done} />
      </div>
    </main>
  );
}
