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
  compact = false,
}: {
  workoutId: string;
  exerciseId: string | null;
  initial: string;
  label: string;
  placeholder?: string;
  tone?: "client" | "coach";
  /** 1 for the per-exercise boxes, so a superset pair fits one phone screen. */
  rows?: number;
  /**
   * Drops the visible label row — 16px per box, four to eight of them down a
   * session. The label moves to `aria-label` and the placeholder carries it
   * on screen, so nothing is lost to a screen reader. The two session-level
   * boxes keep their labels: there is nothing above them saying what they are.
   */
  compact?: boolean;
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

  const field = (
    <textarea
      className={`field p-2 text-base ${rows > 1 ? "min-h-16" : "min-h-10"} ${
        coach ? "field-coach" : ""
      }`}
      rows={rows}
      maxLength={2000}
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={flush}
    />
  );

  const status = (
    <span className="text-xs" aria-live="polite">
      {state === "saving" && <span className="text-white/45">Saving…</span>}
      {state === "saved" && <span className="text-green-400">Saved</span>}
      {state === "error" && <span className="text-red-300">Not saved — try again</span>}
    </span>
  );

  if (compact) {
    // The status sits over the top-right of the field rather than on a row of
    // its own. It only renders while it is saying something — a couple of
    // seconds after blur — so it cannot cover text anyone is reading.
    return (
      <div className="relative mt-2">
        {field}
        <span className="pointer-events-none absolute right-2 top-1.5">{status}</span>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="mb-0.5 flex items-baseline justify-between">
        <label className={`text-xs font-medium uppercase tracking-wide ${
          coach ? "text-amber-300" : "text-white/45"
        }`}>
          {label}
        </label>
        {status}
      </div>
      {field}
    </div>
  );
}
