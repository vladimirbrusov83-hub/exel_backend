"use client";

import { useState } from "react";

type Status = { kind: "idle" | "saving" | "saved" | "error"; message?: string };

const MAX_NOTE = 500;

export default function NoteForm({
  slug,
  week,
  day,
}: {
  slug: string;
  week: string;
  day: string;
}) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function save() {
    const text = note.trim();
    if (!text) return;
    setStatus({ kind: "saving" });
    try {
      const res = await fetch(`/api/notes/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week, day, note: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setStatus({ kind: "error", message: data.error ?? "Couldn't save. Try again." });
        return;
      }
      setNote("");
      setStatus({ kind: "saved" });
    } catch {
      setStatus({ kind: "error", message: "No connection. Try again." });
    }
  }

  return (
    <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
      <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        How did it feel?
      </label>
      <textarea
        value={note}
        maxLength={MAX_NOTE}
        onChange={(e) => {
          setNote(e.target.value);
          if (status.kind !== "idle") setStatus({ kind: "idle" });
        }}
        rows={3}
        placeholder="Actual RPE, how the session went, anything I should know…"
        className="field mt-2 p-3 text-base"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status.kind === "saving" || note.trim().length === 0}
          className="min-h-11 rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {status.kind === "saving" ? "Saving…" : "Save note"}
        </button>
        {status.kind === "saved" && (
          <span className="text-sm font-medium text-green-700 dark:text-green-400">Saved</span>
        )}
        {status.kind === "error" && (
          <span className="text-sm font-medium text-red-700 dark:text-red-400">{status.message}</span>
        )}
        <span className="ml-auto text-xs text-neutral-400">
          {note.length}/{MAX_NOTE}
        </span>
      </div>
    </div>
  );
}
