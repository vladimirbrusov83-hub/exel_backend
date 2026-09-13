import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClientView } from "@/lib/client-guard";
import { getAllWorkouts, getClient } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { setProgress } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Rolling windows off today, not calendar weeks and months. "Last week" already
 * means the previous Mon–Sun everywhere else in this app — the week switcher
 * renders that exact string — and a calendar window also makes every number
 * lurch every Monday.
 */
const WINDOWS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 365, label: "Last 365 days" },
];

export default async function Stats({
  params,
}: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireClientView(clientId);
  const client = await getClient(clientId);
  if (!client) notFound();

  const now = today();
  // Up to and including today: a session programmed for next week is not a
  // session done, and must not be counted as one.
  const past = (await getAllWorkouts(clientId)).filter((w) => w.date <= now);

  /**
   * Two different signals, on purpose. A session counts as done only when the
   * Done button was pressed; sets count from the ticks. Ticking three sets does
   * not finish a session, and finishing one does not tick its sets.
   */
  const rows = WINDOWS.map(({ days, label }) => {
    const from = addDays(now, -(days - 1));
    const inWindow = past.filter((w) => w.date >= from);
    let sets = 0;
    for (const w of inWindow) sets += setProgress(w.exercises).done;
    return {
      label,
      sessions: inWindow.filter((w) => w.done).length,
      sets,
    };
  });

  const anything = rows.some((r) => r.sessions > 0 || r.sets > 0);

  return (
    <main className="mx-auto max-w-md px-4 pt-3 pb-12">
      <Link
        href={`/c/${clientId}`}
        className="inline-flex min-h-11 items-center gap-1 rounded-full pr-2 text-sm text-white/50"
      >
        <span aria-hidden className="text-lg leading-none">‹</span> Week
      </Link>
      <h1 className="mt-1 text-3xl font-bold tracking-tight">Statistics</h1>
      <p className="mt-1 text-sm text-white/45">
        Sessions you marked done, and sets you ticked off.
      </p>

      {!anything ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center">
          <p className="font-medium">Nothing counted yet</p>
          <p className="mt-1 text-sm text-white/45">
            Tick sets off as you train and finish a session with Done — the numbers
            show up here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.label} className="rounded-2xl bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-white/45">
                {r.label}
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-3xl font-bold leading-none">{r.sessions}</div>
                  <div className="mt-1 text-sm text-white/55">
                    {r.sessions === 1 ? "session" : "sessions"}
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold leading-none">{r.sets}</div>
                  <div className="mt-1 text-sm text-white/55">
                    {r.sets === 1 ? "set" : "sets"}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-white/35">
        Counted from what you ticked. Nothing here changes your program — your coach
        writes that by hand.
      </p>
    </main>
  );
}
