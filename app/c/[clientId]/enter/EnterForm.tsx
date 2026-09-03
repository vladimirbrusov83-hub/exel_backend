"use client";

import Link from "next/link";
import { useActionState } from "react";
import { enterPasscodeAction } from "../actions";

export default function EnterForm({
  clientId, name,
}: { clientId: string; name: string }) {
  const [error, action, pending] = useActionState(
    enterPasscodeAction.bind(null, clientId), null,
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Welcome back</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{name}</h1>
        <p className="mt-1 text-sm text-white/55">Enter your passcode to open this week.</p>
      </div>
      <form action={action} className="flex flex-col gap-3">
        <label htmlFor="passcode" className="text-sm text-white/55">Passcode</label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="field min-h-13 rounded-xl px-4 text-lg tracking-widest"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-xl bg-white font-semibold text-neutral-900 disabled:opacity-60"
        >
          {pending ? "Checking…" : "Enter"}
        </button>
      </form>
      <p className="text-sm text-white/40">
        Forgotten it? Ask your coach to clear it.
      </p>
      <Link href="/" className="inline-flex min-h-11 items-center gap-1 self-start rounded-full pr-2 text-sm text-white/50">
        <span aria-hidden className="text-lg leading-none">‹</span> Back
      </Link>
    </main>
  );
}
