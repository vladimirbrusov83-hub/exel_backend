"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseDay, toShorthand } from "@/lib/parse";
import type { Day } from "@/lib/sheets";

type Status = { kind: "idle" | "saving" | "error"; message?: string };

export default function DayEditor({
  slug,
  prefix,
  week,
  day,
  onClose,
}: {
  slug: string;
  prefix: string;
  week: string;
  day: Day;
  onClose: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState(() => toShorthand(day.movements));
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const parsed = parseDay(text);
  const setCount = parsed.exercises.reduce((n, e) => n + e.sets.length, 0);

  async function save() {
    setStatus({ kind: "saving" });
    try {
      const res = await fetch(`/api/coach/edit/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: prefix, week, day: day.day, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setStatus({ kind: "error", message: data.error ?? "Couldn't save." });
        return;
      }
      // Pull the rewritten day back from the Sheet rather than guessing.
      router.refresh();
      onClose();
    } catch {
      setStatus({ kind: "error", message: "No connection. Try again." });
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (status.kind === "error") setStatus({ kind: "idle" });
        }}
        rows={Math.min(24, text.split("\n").length + 2)}
        spellCheck={false}
        autoFocus
        className="field p-2 font-mono text-xs leading-relaxed"
      />

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {parsed.exercises.length} exercises, {setCount} {setCount === 1 ? "set" : "sets"}
        {" — replaces this day in the Sheet."}
      </p>

      {parsed.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {parsed.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={status.kind === "saving" || setCount === 0}
          className="min-h-11 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {status.kind === "saving" ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={status.kind === "saving"}
          className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm font-semibold dark:border-neutral-600"
        >
          Cancel
        </button>
        {status.kind === "error" && (
          <span className="text-xs font-medium text-red-700 dark:text-red-400">
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}
