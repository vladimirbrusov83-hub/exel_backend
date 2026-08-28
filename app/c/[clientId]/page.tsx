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
    // Dark, like the session page this leads into — see the note in globals.css.
    <div className="dark-page min-h-dvh">
      <main className="mx-auto max-w-md p-4 pb-16">
        <header className="mb-4">
          <div className="flex items-baseline justify-between">
            <Link href="/" className="inline-flex min-h-11 items-center text-sm text-white/50 underline underline-offset-4">
              {client.name}
            </Link>
            <Link
              href={`/c/${clientId}/history`}
              className="inline-flex min-h-11 items-center text-sm text-white/50 underline underline-offset-4"
            >
              History
            </Link>
          </div>

          <nav className="mt-3 flex items-center justify-between gap-2">
            <Link
              href={`/c/${clientId}?w=${offset - 1}`}
              aria-label="Previous week"
              className="flex size-11 items-center justify-center rounded-lg border border-white/20"
            >‹</Link>
            <div className="text-center">
              <div className="font-medium">{formatWeekRange(monday)}</div>
              {offset !== 0 && (
                <Link href={`/c/${clientId}`} className="text-xs text-white/50 underline underline-offset-4">
                  back to this week
                </Link>
              )}
            </div>
            <Link
              href={`/c/${clientId}?w=${offset + 1}`}
              aria-label="Next week"
              className="flex size-11 items-center justify-center rounded-lg border border-white/20"
            >›</Link>
          </nav>
        </header>

        {workouts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/20 p-8 text-center text-white/45">
            Rest week — nothing programmed.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {workouts.map((wk) => (
              <li key={wk.id}>
                <Link
                  href={`/c/${clientId}/w/${wk.id}`}
                  // Same surface the exercise blocks use on the session page, so
                  // a row reads as the card it opens into. A done session is
                  // tinted rather than filled, or the week goes green all over.
                  className={`flex min-h-16 items-center justify-between gap-3 rounded-xl p-4 ${
                    wk.done
                      ? "border border-green-400/30 bg-green-400/10"
                      : "bg-[#4e4f60]"
                  }`}
                >
                  <div>
                    <div className="font-medium">{wk.title || "Session"}</div>
                    <div className="text-sm text-white/50">
                      {weekdayName(wk.date)} {dayOfMonth(wk.date)} · {wk.exercises.length} exercises
                    </div>
                  </div>
                  <span aria-hidden className={wk.done ? "text-green-400" : "text-white/40"}>
                    {wk.done ? "✓" : "›"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
