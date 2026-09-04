"use client";

import { useRef, useState } from "react";
import { saveNote } from "../../actions";

/**
 * Saves on blur, not on every keystroke. `saved` clears itself so the label
 * doesn't sit there claiming success five minutes later.
 *
 * The client writing about their own session — the only author this box has.
 * The coach used to get an amber twin of it on the same page; that is gone, and
 * he writes on /coach. The author is decided inside the action, not sent from
 * here.
 */
export default function NoteBox({
  workoutId, exerciseId, initial, label, placeholder, rows = 1,
  compact = false,
}: {
  workoutId: string;
  exerciseId: string | null;
  initial: string;
  label: string;
  placeholder?: string;
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

  const field = (
    // The compact box is now the only thing anyone types on an exercise card,
    // so it is twice the height it was — min-h-20 against the old min-h-10.
    <textarea
      className={`field p-2 text-base ${
        rows > 1 ? "min-h-16" : compact ? "min-h-20" : "min-h-10"
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
        <label className="text-xs font-medium uppercase tracking-wide text-white/45">
          {label}
        </label>
        {status}
      </div>
      {field}
    </div>
  );
}
