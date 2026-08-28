"use client";

import { useActionState } from "react";
import { login } from "../actions";

export default function CoachLogin() {
  const [error, action, pending] = useActionState(login, null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Coach</h1>
      <form action={action} className="flex flex-col gap-3">
        <label htmlFor="passcode" className="text-sm text-white/55">
          Passcode
        </label>
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
    </main>
  );
}
