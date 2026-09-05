"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The little window that opens when a set's RIR/RPE button is tapped. One box,
 * free text, because a rating here follows the same rule the loads do: "2",
 * "RIR 2", "@8", "8-9" and "3 left" all have to survive being typed. Nothing
 * parses it and nothing reads it back except the two of them.
 *
 * Save-and-close rather than save-on-blur like `NoteBox`: this is a deliberate
 * one-at-a-time act with a Save button in front of the client, and an
 * optimistic value here would need the transition machinery `SetChecks` has for
 * a tick that is genuinely tapped between sets.
 *
 * Escape and a tap on the backdrop close it without saving. That is the
 * opposite of the coach editor's Escape — which saves — and deliberately so:
 * there, Escape is the reflex that gets out of a day being written; here it is
 * the reflex that dismisses a dialog opened by accident mid-session.
 */
export default function RatingDialog({
  title, subtitle, initial, onSave, onClose,
}: {
  /** The lift, so it is obvious which set is being rated. */
  title: string;
  /** The set line itself, as written. */
  subtitle: string;
  initial: string;
  onSave: (value: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function commit(next: string) {
    setState("saving");
    try {
      await onSave(next);
      onClose();
    } catch {
      setState("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`How did ${title} feel?`}
    >
      {/* A sibling backdrop rather than a click handler on the wrapper: with the
          card inside a clickable parent, every tap on the input bubbles up and
          closes the dialog being typed into. */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xs rounded-2xl bg-surface p-4 shadow-xl">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-white/45">
          How did it feel?
        </p>
        <h2 className="mt-0.5 text-base font-semibold leading-snug">{title}</h2>
        <p className="font-mono text-sm text-white/50">{subtitle}</p>

        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void commit(value);
          }}
        >
          <input
            ref={input}
            className="field w-full p-2 text-center font-mono text-lg"
            maxLength={24}
            aria-label="RIR or RPE"
            placeholder="RIR 2 · @8"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-white/40">
            Reps in reserve, RPE, anything — written down exactly as you type it.
          </p>
          {state === "error" && (
            <p className="mt-1.5 text-xs text-red-300">Not saved — try again.</p>
          )}

          <div className="mt-3 flex items-center gap-2">
            {/* Clear only shows once there is something to clear, so the row is
                two buttons on a first rating and three on a change. */}
            {initial !== "" && (
              <button
                type="button"
                disabled={state === "saving"}
                onClick={() => void commit("")}
                className="min-h-11 rounded-full px-3 text-sm text-white/50"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              disabled={state === "saving"}
              onClick={onClose}
              className="ml-auto min-h-11 rounded-full px-3 text-sm text-white/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={state === "saving"}
              className="min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-neutral-900 disabled:opacity-60"
            >
              {state === "saving" ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
