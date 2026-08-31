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
      <h1 className="text-xl font-semibold">{name}</h1>
      <form action={action} className="flex flex-col gap-3">
        <label htmlFor="passcode" className="text-sm text-white/55">Passcode</label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="field min-h-12 px-3 text-base"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 rounded-lg bg-white font-medium text-neutral-900 disabled:opacity-60"
        >
          {pending ? "Checking…" : "Enter"}
        </button>
      </form>
      <p className="text-sm text-white/40">
        Forgotten it? Ask your coach to clear it.
      </p>
      <Link href="/" className="text-sm text-white/50 underline underline-offset-4">
        Back
      </Link>
    </main>
  );
}
