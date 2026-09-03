import Link from "next/link";
import { getClients } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const clients = await getClients();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          Training program
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Who&apos;s training?</h1>
        <p className="mt-2 text-white/55">Tap your name to see this week.</p>
      </div>

      <div className="flex flex-col gap-3">
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/c/${c.id}`}
            className="card flex min-h-[4.5rem] items-center gap-4 rounded-2xl bg-surface px-4 text-lg font-semibold"
          >
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-base font-bold text-white/90"
            >
              {c.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            <span className="flex items-center gap-2 text-white/40">
              {c.hasPasscode && (
                <span className="text-sm" title="Asks for a passcode" aria-label="Asks for a passcode">🔒</span>
              )}
              <span aria-hidden className="text-2xl leading-none">›</span>
            </span>
          </Link>
        ))}
        {clients.length === 0 && (
          <p className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-white/55">
            No one set up yet. Add names on the coach page.
          </p>
        )}
      </div>

      <Link
        href="/coach"
        className="inline-flex min-h-11 items-center self-center rounded-full px-4 text-sm text-white/45 transition-colors hover:text-white"
      >
        Coach sign in
      </Link>
    </main>
  );
}
