"use client";

import { useRef, useState } from "react";
import { saveCoachNote, saveNote } from "../../actions";

/**
 * Saves on blur, not on every keystroke. `saved` clears itself so the label
 * doesn't sit there claiming success five minutes later.
 *
 * `tone` picks both the colour and the server action. Blue is the client
 * writing about their own session; amber is the coach writing on the client
 * page from his phone — the same two colours the coach calendar already uses
 * for 👤 and 📝. The author is decided inside the action, not sent from here.
 */
export default function NoteBox({
  workoutId, exerciseId, initial, label, placeholder, tone = "client", rows = 1,
}: {
  workoutId: string;
  exerciseId: string | null;
  initial: string;
  label: string;
  placeholder?: string;
  tone?: "client" | "coach";
  /** 1 for the per-exercise boxes, so a superset pair fits one phone screen. */
  rows?: number;
}) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSaved = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const coach = tone === "coach";

  async function flush() {
    if (value === lastSaved.current) return;
    setState("saving");
    try {
      if (coach) await saveCoachNote(workoutId, exerciseId, value);
      else await saveNote(workoutId, exerciseId, value);
      lastSaved.current = value;
      setState("saved");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-2">
      <div className="mb-0.5 flex items-baseline justify-between">
        <label className={`text-xs font-medium uppercase tracking-wide ${
          coach ? "text-amber-700" : "text-neutral-500"
        }`}>
          {label}
        </label>
        <span className="text-xs" aria-live="polite">
          {state === "saving" && <span className="text-neutral-500">Saving…</span>}
          {state === "saved" && <span className="text-green-700">Saved</span>}
          {state === "error" && <span className="text-red-700">Not saved — try again</span>}
        </span>
      </div>
      <textarea
        className={`field p-2 text-base ${rows > 1 ? "min-h-16" : "min-h-10"} ${
          coach ? "field-coach" : ""
        }`}
        rows={rows}
        maxLength={2000}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={flush}
      />
    </div>
  );
}
