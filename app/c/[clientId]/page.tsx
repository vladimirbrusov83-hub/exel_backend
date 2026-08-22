import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient, getWorkoutsBetween } from "@/lib/db";
import { addDays, formatWeekRange, mondayOf, today, weekdayName, dayOfMonth } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function WeekView({
  params, searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ w?: string }>;
}) {
  const { clientId } = await params;
  const { w } = await searchParams;
  const client = await getClient(clientId);
  if (!client) notFound();

  const offset = Number.isFinite(Number(w)) ? Number(w) : 0;
  const monday = addDays(mondayOf(today()), offset * 7);
  const workouts = await getWorkoutsBetween(clientId, monday, addDays(monday, 6));

  return (
    <main className="mx-auto max-w-md p-4 pb-16">
      <header className="mb-4">
        <div className="flex items-baseline justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center text-sm text-neutral-500 underline underline-offset-4">
            {client.name}
          </Link>
          <Link
            href={`/c/${clientId}/history`}
            className="inline-flex min-h-11 items-center text-sm text-neutral-500 underline underline-offset-4"
          >
            History
          </Link>
        </div>

        <nav className="mt-3 flex items-center justify-between gap-2">
          <Link
            href={`/c/${clientId}?w=${offset - 1}`}
            aria-label="Previous week"
            className="flex size-11 items-center justify-center rounded-lg border border-neutral-300"
          >‹</Link>
          <div className="text-center">
            <div className="font-medium">{formatWeekRange(monday)}</div>
            {offset !== 0 && (
              <Link href={`/c/${clientId}`} className="text-xs text-neutral-500 underline underline-offset-4">
                back to this week
              </Link>
            )}
          </div>
          <Link
            href={`/c/${clientId}?w=${offset + 1}`}
            aria-label="Next week"
            className="flex size-11 items-center justify-center rounded-lg border border-neutral-300"
          >›</Link>
        </nav>
      </header>

      {workouts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-neutral-500">
          Rest week — nothing programmed.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {workouts.map((wk) => (
            <li key={wk.id}>
              <Link
                href={`/c/${clientId}/w/${wk.id}`}
                className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border p-4 ${
                  wk.done
                    ? "border-green-600/40 bg-green-50"
                    : "border-neutral-300"
                }`}
              >
                <div>
                  <div className="font-medium">{wk.title || "Session"}</div>
                  <div className="text-sm text-neutral-600">
                    {weekdayName(wk.date)} {dayOfMonth(wk.date)} · {wk.exercises.length} exercises
                  </div>
                </div>
                <span aria-hidden className={wk.done ? "text-green-700" : "text-neutral-400"}>
                  {wk.done ? "✓" : "›"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
