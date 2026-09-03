import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClientView } from "@/lib/client-guard";
import { getClient, getWorkoutsBetween } from "@/lib/db";
import {
  addDays, dayOfMonth, formatWeekRange, mondayOf, today, weekDates, weekdayName,
} from "@/lib/dates";
import { setLines } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Non-blank set lines across the session, and how many are ticked. */
function setProgress(exercises: { freeText: string; doneSets: number[] }[]) {
  let total = 0;
  let done = 0;
  for (const ex of exercises) {
    const lines = setLines(ex.freeText).filter((l) => l.text.trim() !== "");
    total += lines.length;
    const valid = new Set(lines.map((l) => l.index));
    done += ex.doneSets.filter((n) => valid.has(n)).length;
  }
  return { total, done };
}

export default async function WeekView({
  params, searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ w?: string }>;
}) {
  const { clientId } = await params;
  const { w } = await searchParams;
  await requireClientView(clientId);
  const client = await getClient(clientId);
  if (!client) notFound();

  const offset = Number.isFinite(Number(w)) ? Number(w) : 0;
  const now = today();
  const monday = addDays(mondayOf(now), offset * 7);
  const workouts = await getWorkoutsBetween(clientId, monday, addDays(monday, 6));
  const days = weekDates(monday);
  const byDate = new Map(workouts.map((wk) => [wk.date, wk]));

  const weekLabel = offset === 0 ? "This week" : offset === 1 ? "Next week" : offset === -1 ? "Last week" : null;

  return (
    <main className="mx-auto max-w-md px-4 pt-3 pb-12">
      <header>
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-1 rounded-full pr-2 text-sm text-white/50"
            aria-label="Switch person"
          >
            <span aria-hidden className="text-lg leading-none">‹</span>
            <span>Switch</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href={`/c/${clientId}/history`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/5"
            >
              <span aria-hidden>🗓</span> History
            </Link>
            <Link
              href={`/c/${clientId}/passcode`}
              title={client.hasPasscode ? "Change your passcode" : "Set a passcode"}
              aria-label={client.hasPasscode ? "Change your passcode" : "Set a passcode"}
              className="inline-flex size-11 items-center justify-center rounded-full text-base transition-colors hover:bg-white/5"
            >
              {client.hasPasscode ? "🔒" : "🔓"}
            </Link>
          </div>
        </div>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Hi, {client.name}
        </h1>

        {/* Week switcher: arrows either side, the range in the middle. */}
        <nav className="mt-4 flex items-center justify-between gap-2">
          <Link
            href={`/c/${clientId}?w=${offset - 1}`}
            aria-label="Previous week"
            className="card flex size-11 items-center justify-center rounded-full bg-white/8 text-xl"
          >‹</Link>
          <div className="text-center">
            <div className="font-semibold">{weekLabel ?? formatWeekRange(monday)}</div>
            {weekLabel ? (
              <div className="text-xs text-white/45">{formatWeekRange(monday)}</div>
            ) : (
              <Link href={`/c/${clientId}`} className="text-xs text-white/50 underline underline-offset-4">
                back to this week
              </Link>
            )}
          </div>
          <Link
            href={`/c/${clientId}?w=${offset + 1}`}
            aria-label="Next week"
            className="card flex size-11 items-center justify-center rounded-full bg-white/8 text-xl"
          >›</Link>
        </nav>

        {/* Seven-day strip. A dot marks a programmed day, green when done,
            and today is ringed so the week reads at a glance. */}
        <ol className="mt-4 grid grid-cols-7 gap-1" aria-label="Days this week">
          {days.map((d) => {
            const wk = byDate.get(d);
            const isToday = d === now;
            return (
              <li key={d} className="flex flex-col items-center gap-1">
                <span className="text-[0.65rem] font-medium uppercase tracking-wide text-white/40">
                  {weekdayName(d, true).slice(0, 2)}
                </span>
                {wk ? (
                  <a
                    href={`/c/${clientId}/w/${wk.id}`}
                    aria-label={`${weekdayName(d)} ${dayOfMonth(d)}, ${wk.title || "Session"}`}
                    className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold ${
                      wk.done
                        ? "bg-green-400/20 text-green-300"
                        : "bg-white text-neutral-900"
                    } ${isToday ? "ring-2 ring-white/60 ring-offset-2 ring-offset-[var(--background)]" : ""}`}
                  >
                    {dayOfMonth(d)}
                  </a>
                ) : (
                  <span
                    className={`flex size-9 items-center justify-center rounded-full text-sm text-white/45 ${
                      isToday ? "ring-2 ring-white/40 ring-offset-2 ring-offset-[var(--background)]" : ""
                    }`}
                  >
                    {dayOfMonth(d)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </header>

      {workouts.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <div aria-hidden className="text-3xl">🛌</div>
          <p className="mt-2 font-medium">Nothing programmed</p>
          <p className="mt-1 text-sm text-white/45">
            {offset > 0 ? "Your coach hasn't written this week yet." : "Rest, recover, and check back later."}
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {workouts.map((wk) => {
            const { total, done } = setProgress(wk.exercises);
            const started = !wk.done && done > 0;
            const isToday = wk.date === now;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <li key={wk.id}>
                <Link
                  href={`/c/${clientId}/w/${wk.id}`}
                  className={`card flex items-center gap-4 rounded-2xl p-4 ${
                    wk.done
                      ? "border border-green-400/30 bg-green-400/10"
                      : isToday
                        ? "bg-surface ring-1 ring-white/25"
                        : "bg-surface"
                  }`}
                >
                  {/* Day badge */}
                  <div
                    aria-hidden
                    className={`flex w-12 shrink-0 flex-col items-center justify-center rounded-xl py-1.5 ${
                      wk.done ? "bg-green-400/15 text-green-200" : "bg-white/10"
                    }`}
                  >
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wide opacity-70">
                      {weekdayName(wk.date, true)}
                    </span>
                    <span className="text-xl font-bold leading-tight">{dayOfMonth(wk.date)}</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{wk.title || "Session"}</span>
                      {isToday && !wk.done && (
                        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-neutral-900">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-sm text-white/55">
                      {wk.exercises.length} {wk.exercises.length === 1 ? "exercise" : "exercises"}
                      {wk.done
                        ? " · done"
                        : started
                          ? ` · ${done} of ${total} sets`
                          : total > 0 ? ` · ${total} sets` : ""}
                    </div>
                    {started && (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
                        <div className="h-full rounded-full bg-white/70" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>

                  <span
                    aria-hidden
                    className={`shrink-0 ${wk.done ? "flex size-7 items-center justify-center rounded-full bg-green-400 text-sm font-bold text-neutral-900" : "text-2xl leading-none text-white/40"}`}
                  >
                    {wk.done ? "✓" : "›"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
