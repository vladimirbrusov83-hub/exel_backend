"use client";

import Link from "next/link";
import { useActionState } from "react";
import { removePasscodeAction, setPasscodeAction } from "../actions";

const FIELD = "field min-h-13 rounded-xl px-4 text-lg tracking-widest";
const LABEL = "text-sm text-white/55";

/**
 * Set, change or remove one client's passcode. Two forms, not one with a mode
 * switch: they have different fields and their own error lines, and the remove
 * form is only here at all once there is something to remove.
 */
export default function PasscodeForm({
  clientId, name, hasPasscode,
}: { clientId: string; name: string; hasPasscode: boolean }) {
  const [setError, setAction, setting] = useActionState(
    setPasscodeAction.bind(null, clientId), null,
  );
  const [removeError, removeAction, removing] = useActionState(
    removePasscodeAction.bind(null, clientId), null,
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col gap-8 p-6">
      <header>
        <Link
          href={`/c/${clientId}`}
          className="inline-flex min-h-11 items-center gap-1 rounded-full pr-2 text-sm text-white/50"
        >
          <span aria-hidden className="text-lg leading-none">‹</span> {name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {hasPasscode ? "Change your passcode" : "Set a passcode"}
        </h1>
        <p className="mt-1 text-sm text-white/55">
          {hasPasscode
            ? "You will need it again on any phone you have not used before."
            : "Without one, anyone who taps your name goes straight in. With one, this phone stays signed in and any other asks."}
        </p>
      </header>

      <form action={setAction} className="flex flex-col gap-3">
        {hasPasscode && (
          <>
            <label htmlFor="current" className={LABEL}>Current passcode</label>
            <input id="current" name="current" type="password"
              autoComplete="current-password" className={FIELD} />
          </>
        )}

        <label htmlFor="passcode" className={LABEL}>
          {hasPasscode ? "New passcode" : "Passcode"}
        </label>
        <input id="passcode" name="passcode" type="password"
          autoComplete="new-password" className={FIELD} />

        <label htmlFor="confirm" className={LABEL}>Type it again</label>
        <input id="confirm" name="confirm" type="password"
          autoComplete="new-password" className={FIELD} />

        {setError && <p className="text-sm text-red-300">{setError}</p>}
        <button type="submit" disabled={setting}
          className="min-h-12 rounded-xl bg-white font-semibold text-neutral-900 disabled:opacity-60">
          {setting ? "Saving…" : "Save"}
        </button>
      </form>

      {hasPasscode && (
        <form action={removeAction} className="flex flex-col gap-3 border-t border-white/12 pt-6">
          <label htmlFor="remove-current" className={LABEL}>
            Remove it — type your current passcode
          </label>
          <input id="remove-current" name="current" type="password"
            autoComplete="current-password" className={FIELD} />
          {removeError && <p className="text-sm text-red-300">{removeError}</p>}
          <button type="submit" disabled={removing}
            className="min-h-12 rounded-xl border border-white/20 text-white/70 disabled:opacity-60">
            {removing ? "Removing…" : "Remove passcode"}
          </button>
        </form>
      )}
    </main>
  );
}
