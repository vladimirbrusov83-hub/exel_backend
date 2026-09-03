"use client";

import { useTransition } from "react";
import { markDone } from "../../actions";

export default function DoneButton({
  clientId, workoutId, done,
}: { clientId: string; workoutId: string; done: boolean }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => { void markDone(clientId, workoutId, !done); })}
      className={`card flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-semibold transition-colors disabled:opacity-60 ${
        done
          ? "border border-green-400/40 bg-green-400/15 text-green-300"
          : "bg-white text-neutral-900 shadow-[0_8px_30px_rgba(255,255,255,0.08)]"
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
