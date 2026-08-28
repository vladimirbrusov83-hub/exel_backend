import Link from "next/link";
import { getClients } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const clients = await getClients();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Who&apos;s training?</h1>
        <p className="mt-1 text-white/55">
          Tap your name to see this week.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/c/${c.id}`}
            className="flex min-h-16 items-center justify-between rounded-xl border border-white/20 px-5 text-lg font-medium transition-colors hover:bg-white/5"
          >
            {c.name}
            <span aria-hidden className="text-white/40">›</span>
          </Link>
        ))}
        {clients.length === 0 && (
          <p className="text-white/55">
            No one set up yet. Add names on the coach page.
          </p>
        )}
      </div>

      <Link
        href="/coach"
        className="inline-flex min-h-11 items-center self-start text-sm text-white/50 underline underline-offset-4 hover:text-white"
      >
        Coach
      </Link>
    </main>
  );
}
