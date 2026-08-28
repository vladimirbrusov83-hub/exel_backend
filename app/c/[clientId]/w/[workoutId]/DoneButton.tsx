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
      className={`min-h-12 w-full rounded-xl border px-4 font-medium transition-colors disabled:opacity-60 ${
        done
          ? "border-green-400/40 bg-green-400/15 text-green-300"
          : "border-white bg-white text-neutral-900"
      }`}
    >
      {done ? "✓ Done — tap to undo" : "Mark as done"}
    </button>
  );
}
