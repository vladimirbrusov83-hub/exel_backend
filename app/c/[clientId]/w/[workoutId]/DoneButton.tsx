"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { markDone } from "../../actions";

export default function DoneButton({
  clientId, workoutId, done, backHref,
}: { clientId: string; workoutId: string; done: boolean; backHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // Marking done ends the session, so it goes back to the calendar it was
  // opened from — the client's week, or /coach when he tapped through from
  // there. Undoing does not: the point of undoing is to carry on ticking on
  // this page. The await matters — fire-and-forget would let the transition
  // settle and the push happen before the row was written, and the calendar
  // would then render the old state.
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markDone(clientId, workoutId, !done);
          if (!done) router.push(backHref);
        })
      }
      className={`card flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-semibold transition-colors disabled:opacity-60 ${
        done
          ? "border border-green-400/40 bg-green-400/15 text-green-300"
          : "ink-fill shadow-[0_8px_30px_var(--ink-glow)]"
      }`}
    >
      {done ? (
        <>
          <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-green-400 text-sm font-bold text-neutral-900">✓</span>
          Done · tap to undo
        </>
      ) : pending ? "Saving…" : "Mark session done"}
    </button>
  );
}
