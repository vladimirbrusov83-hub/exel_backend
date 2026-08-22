"use client";

import { useRef, useState } from "react";
import { saveNote } from "../../actions";

/**
 * Saves on blur, not on every keystroke. `saved` clears itself so the label
 * doesn't sit there claiming success five minutes later.
 */
export default function NoteBox({
  workoutId, exerciseId, initial, label, placeholder,
}: {
  workoutId: string;
  exerciseId: string | null;
  initial: string;
  label: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSaved = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function flush() {
    if (value === lastSaved.current) return;
    setState("saving");
    try {
      await saveNote(workoutId, exerciseId, value);
      lastSaved.current = value;
      setState("saved");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-3">
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {label}
        </label>
        <span className="text-xs" aria-live="polite">
          {state === "saving" && <span className="text-neutral-500">Saving…</span>}
          {state === "saved" && <span className="text-green-700">Saved</span>}
          {state === "error" && <span className="text-red-700">Not saved — try again</span>}
        </span>
      </div>
      <textarea
        className="field min-h-16 p-2 text-base"
        rows={2}
        maxLength={2000}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={flush}
      />
    </div>
  );
}
