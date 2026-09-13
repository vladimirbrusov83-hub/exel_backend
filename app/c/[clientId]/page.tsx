import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClientView } from "@/lib/client-guard";
import { getClient, getWorkoutsBetween } from "@/lib/db";
import {
  addDays, dayOfMonth, formatWeekRange, mondayOf, today, weekDates, weekdayName,
} from "@/lib/dates";
import { setProgress } from "@/lib/types";
import ClientMenu from "./ClientMenu";

export const dynamic = "force-dynamic";

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
          <ClientMenu clientId={clientId} hasPasscode={client.hasPasscode} />
        </div>

        {/* The week switcher, pinned to the top of the screen. It is how you
            move between weeks, so it stays reachable once the sessions scroll
            under it. `.sticky-bar` carries the notch offset and full-bleeds
            itself past <main>'s px-4. */}
        <nav className="sticky-bar mt-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
          <Link
            href={`/c/${clientId}?w=${offset - 1}`}
            aria-label="Previous week"
            className="card flex size-11 items-center justify-center rounded-full bg-white/8 text-xl"
          >‹</Link>
          <div className="text-center">
            <div className="font-semibold">{formatWeekRange(monday)}</div>
            {weekLabel ? (
              <div className="text-xs text-white/45">{weekLabel}</div>
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

        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Hi, {client.name}
        </h1>

        {/* Seven-day strip. A square card per day, a dot under a programmed
            one — green once the session is done — and a ring on today, so the
            week reads at a glance. Tapping a card opens that session; there is
            no client-side day selection, the page stays server-rendered. */}
        <ol className="mt-4 grid grid-cols-7 gap-1" aria-label="Days this week">
          {days.map((d) => {
            const wk = byDate.get(d);
            const isToday = d === now;
            const label = (
              <span className="text-[0.6rem] font-medium uppercase tracking-wide text-white/45">
                {weekdayName(d, true)}
              </span>
            );
            return (
              <li key={d}>
                {wk ? (
                  <a
                    href={`/c/${clientId}/w/${wk.id}`}
                    aria-label={`${weekdayName(d)} ${dayOfMonth(d)}, ${wk.title || "Session"}`}
                    className={`card flex aspect-[5/6] flex-col items-center justify-center gap-0.5 rounded-xl border bg-surface text-sm font-semibold ${
                      isToday ? "border-white/60 ring-1 ring-white/60" : "border-white/12"
                    }`}
                  >
                    {label}
                    <span>{dayOfMonth(d)}</span>
                    <span
                      aria-hidden
                      className={`size-1.5 rounded-full ${wk.done ? "bg-green-400" : "bg-white/55"}`}
                    />
                  </a>
                ) : (
                  <div
                    className={`flex aspect-[5/6] flex-col items-center justify-center gap-0.5 rounded-xl border text-sm ${
                      isToday ? "border-white/40" : "border-dashed border-white/12"
                    }`}
                  >
                    {label}
                    <span className="text-white/45">{dayOfMonth(d)}</span>
                    <span aria-hidden className="size-1.5" />
                  </div>
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
                        <span className="shrink-0 ink-fill rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide">
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
                    {wk.exercises.length > 0 && (
                      <div className="mt-1 line-clamp-2 text-sm text-white/45">
                        {wk.exercises.map((e) => e.name.trim()).filter(Boolean).join(" · ")}
                      </div>
                    )}
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
