"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatLong, weekdayName } from "@/lib/dates";
import { exerciseLabels, type Workout, type WorkoutDraft } from "@/lib/types";

type Row = { name: string; freeText: string; linkPrev: boolean };

/** Anything written on the day, by either of them. */
function hasNotes(w: Workout): boolean {
  return Boolean(
    w.overallNote || w.overallCoachNote ||
    Object.keys(w.notes).length > 0 || Object.keys(w.coachNotes).length > 0,
  );
}

/** The notes on one day: the client's in blue, the coach's in amber. */
function NoteLines({ workout }: { workout: Workout }) {
  return (
    <>
      {workout.exercises.map((e) => (
        <div key={e.id}>
          {workout.notes[e.id] && (
            <p className="mt-1 whitespace-pre-line text-blue-200">
              <span className="text-white/50">{e.name}: </span>
              {workout.notes[e.id]}
            </p>
          )}
          {workout.coachNotes[e.id] && (
            <p className="mt-1 whitespace-pre-line text-amber-200">
              <span className="text-white/50">{e.name}: </span>
              {workout.coachNotes[e.id]}
            </p>
          )}
        </div>
      ))}
      {workout.overallNote && (
        <p className="mt-2 whitespace-pre-line text-blue-200">{workout.overallNote}</p>
      )}
      {workout.overallCoachNote && (
        <p className="mt-2 whitespace-pre-line text-amber-200">{workout.overallCoachNote}</p>
      )}
    </>
  );
}

/** Whose note this is. Blue is the client, amber is the coach — but not at
 *  this size in this column, so it says so as well. */
function NoteLine({ author, body }: { author: "client" | "coach"; body: string }) {
  return (
    <p
      className={`mt-0.5 whitespace-pre-line pl-2 text-xs ${
        author === "coach" ? "text-amber-200" : "text-blue-200"
      }`}
    >
      <span className="font-medium">{author === "coach" ? "You:" : "Client:"} </span>
      {body}
    </p>
  );
}

/**
 * One past session, exactly as it was written, with everything either of them
 * wrote on it. Read-only on purpose — this panel exists to be looked at while
 * programming, not to be edited or compared.
 */
function PastDay({ workout }: { workout: Workout }) {
  const labels = exerciseLabels(workout.exercises);
  return (
    <article className="rounded-lg border border-white/12 p-2">
      {workout.coachNote && (
        <p className="whitespace-pre-line text-xs text-amber-300">{workout.coachNote}</p>
      )}
      {workout.exercises.map((ex, i) => (
        <div key={ex.id} className="mt-1.5">
          <p className={`text-xs font-semibold ${labels[i].superset ? "text-blue-300" : ""}`}>
            {labels[i].label}) {ex.name}
          </p>
          {ex.freeText.trim() && (
            <p className="whitespace-pre-line pl-2 font-mono text-xs leading-tight text-white/50">
              {ex.freeText}
            </p>
          )}
          {workout.notes[ex.id] && (
            <NoteLine author="client" body={workout.notes[ex.id]} />
          )}
          {workout.coachNotes[ex.id] && (
            <NoteLine author="coach" body={workout.coachNotes[ex.id]} />
          )}
        </div>
      ))}
      {(workout.overallNote || workout.overallCoachNote) && (
        <div className="mt-2 border-t border-white/12 pt-1">
          {workout.overallNote && <NoteLine author="client" body={workout.overallNote} />}
          {workout.overallCoachNote && (
            <NoteLine author="coach" body={workout.overallCoachNote} />
          )}
        </div>
      )}
    </article>
  );
}

/** The same normalisation `saveWorkout` matches exercise names with. */
const norm = (name: string) => name.trim().toLowerCase();

/** How many distinct exercises this past session shares with what is on screen. */
function overlap(past: Workout, names: Set<string>): number {
  const shared = new Set<string>();
  for (const e of past.exercises) {
    const k = norm(e.name);
    if (names.has(k)) shared.add(k);
  }
  return shared.size;
}

/**
 * Which past session the panel opens on: the most recent earlier one that
 * shares the most exercises with the day being written. This picks *which*
 * session is shown and nothing else — it never compares the two, and the
 * picker overrides it.
 */
function bestMatch(history: Workout[], names: Set<string>, date: string): Workout | null {
  if (history.length === 0) return null;

  // `history` is newest first, so a strict > keeps the most recent of a tie.
  let best: Workout | null = null;
  let bestScore = 0;
  for (const h of history) {
    const score = overlap(h, names);
    if (score > bestScore) { best = h; bestScore = score; }
  }
  if (best) return best;

  // Nothing typed yet, or nothing he has ever done before. Fall back to the
  // same weekday — "last Monday" is the next most likely thing to want open.
  const weekday = weekdayName(date);
  return history.find((h) => weekdayName(h.date) === weekday) ?? history[0];
}

/**
 * "Monday, 17 Aug — Squat", with the year only when it is not the year of the
 * day being written. The list is every earlier session, so it eventually spans
 * years and a bare "17 Aug" stops being unique.
 */
function label(past: Workout, date: string): string {
  const year = past.date.slice(0, 4);
  const stamp = year === date.slice(0, 4) ? formatLong(past.date) : `${formatLong(past.date)} ${year}`;
  return `${stamp} — ${past.title || "Session"}`;
}

/**
 * One past session at a time, chosen by the picker. It starts on the session
 * that shares the most exercises with what is being written, and follows what
 * is typed until a session is picked by hand, after which it stays put.
 */
function History({
  history, names, date,
}: { history: Workout[]; names: string[]; date: string }) {
  const [pickedId, setPickedId] = useState<string | null>(null);

  // Keyed on the set of names rather than on every keystroke, so the panel
  // moves when an exercise is named and not while it is being spelled.
  const key = names.join("|");
  const auto = useMemo(
    () => bestMatch(history, new Set(key ? key.split("|") : []), date),
    [history, key, date],
  );

  const shown = (pickedId && history.find((h) => h.id === pickedId)) || auto;
  if (!shown) return <p className="p-2 text-xs text-white/40">Nothing before this day.</p>;

  return (
    <>
      <select
        className="field min-h-11 w-full px-2 text-sm md:min-h-9"
        value={shown.id}
        onChange={(e) => setPickedId(e.target.value)}
        // Escape is the reflex that dismisses a dropdown, and the editor's
        // window handler reads Escape as save-and-exit — there is no discard
        // path, so that keypress would commit the day. Stop it here.
        onKeyDown={(e) => { if (e.key === "Escape") e.stopPropagation(); }}
      >
        {history.map((h) => (
          <option key={h.id} value={h.id}>
            {label(h, date)}
          </option>
        ))}
      </select>
      <div className="mt-2">
        <PastDay workout={shown} />
      </div>
    </>
  );
}

const blankRow = (): Row => ({ name: "", freeText: "", linkPrev: false });

const WEEKDAY_TITLE = (date: string) => `${formatLong(date).split(",")[0]} Session`;

export default function WorkoutEditor({
  clientId, date, workout, history, variant, align = "left", onClose, onSave, onDelete,
}: {
  clientId: string;
  date: string;
  workout: Workout | null;
  /**
   * Every earlier session of this person's, newest first — display only. One of
   * them is shown at a time, picked by the panel's own dropdown, so that a day
   * and everything written on it is readable while programming without closing
   * the editor. Which session is shown is the only thing derived from what is
   * being typed: no deltas, no "last time", no suggested loads.
   */
  history: Workout[];
  /**
   * "popover" sits inside its own day cell on the calendar, the way CoachSpace
   * does it. "sheet" is the fullscreen version used on a phone.
   */
  variant: "popover" | "sheet";
  /** Which edge of the day cell to hang off. See `align` in CoachBoard. */
  align?: "left" | "right";
  onClose: () => void;
  onSave: (draft: WorkoutDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(workout?.title ?? "");
  const [coachNote, setCoachNote] = useState(workout?.coachNote ?? "");
  const [exercises, setExercises] = useState<Row[]>(() =>
    workout && workout.exercises.length > 0
      ? workout.exercises.map((e) => ({
          name: e.name, freeText: e.freeText, linkPrev: e.linkPrev,
        }))
      : [blankRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touched = useRef(false);

  const isNew = !workout;
  const touch = () => { touched.current = true; };

  async function saveAndExit() {
    // An untouched new workout closes silently rather than saving an empty one.
    if (isNew && !touched.current) return onClose();
    const named = exercises.filter((e) => e.name.trim() !== "");
    if (named.length === 0) {
      // Emptying the editor is treated as a mistake, not as "delete this".
      if (isNew) return onClose();
      setError("Empty. Use Delete if you meant to remove it.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: workout?.id ?? null,
        clientId,
        date,
        title: title.trim() || WEEKDAY_TITLE(date),
        coachNote,
        // The first exercise can never be linked to the one above it.
        exercises: named.map((e, i) => ({ ...e, name: e.name.trim(), linkPrev: i > 0 && e.linkPrev })),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setSaving(false);
    }
  }

  // Cmd/Ctrl+Enter and Escape both save and exit — the same reflexes as
  // CoachSpace. Escape does NOT discard; there is no cancel path on purpose.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key === "Enter")) {
        e.preventDefault();
        void saveAndExit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const labels = exerciseLabels(exercises);

  /** What is named on this day right now — what the history panel matches on. */
  const currentNames = exercises
    .map((e) => norm(e.name))
    .filter((n) => n !== "");

  function patch(i: number, changes: Partial<Row>) {
    touch();
    setExercises((list) => list.map((e, k) => (k === i ? { ...e, ...changes } : e)));
  }

  function removeRow(i: number) {
    touch();
    setExercises((list) => {
      const next = list.filter((_, k) => k !== i);
      // A removed exercise must not leave the one after it linked to a
      // different lift than the coach joined it to.
      if (next[i]) next[i] = { ...next[i], linkPrev: false };
      return next.length > 0 ? next : [blankRow()];
    });
  }

  const header = (
    <header className="flex items-center gap-2 border-b border-white/12 p-3">
      <button
        type="button"
        onClick={() => void saveAndExit()}
        className="min-h-11 shrink-0 px-2 text-sm text-white/50 underline underline-offset-4"
      >
        ‹ Save &amp; close
      </button>
      <span className="ml-auto text-sm text-white/50">{formatLong(date)}</span>
    </header>
  );

  const body = (
    <div className="flex-1 overflow-y-auto p-3">
      <input
        className="field min-h-12 px-3 text-base font-semibold"
        placeholder={WEEKDAY_TITLE(date)}
        value={title}
        onChange={(e) => { touch(); setTitle(e.target.value); }}
      />

      <textarea
        className="field mt-2 min-h-16 p-2 text-base"
        rows={2}
        placeholder="Note for the session — the client sees this at the top."
        value={coachNote}
        onChange={(e) => { touch(); setCoachNote(e.target.value); }}
      />

      <ul className="mt-3">
        {exercises.map((ex, i) => (
          <li key={i}>
            {i > 0 && (
              // The divider between two exercises. Tapping it supersets them,
              // which is what turns A) B) into A1) A2).
              <div className="flex items-center gap-2 py-1">
                <span className="h-px flex-1 bg-white/12" />
                <button
                  type="button"
                  aria-pressed={ex.linkPrev}
                  onClick={() => patch(i, { linkPrev: !ex.linkPrev })}
                  className={`min-h-11 rounded-full border px-4 text-xs font-medium md:min-h-8 md:px-3 ${
                    ex.linkPrev
                      ? "border-blue-400/60 bg-blue-400/15 text-blue-200"
                      : "border-white/20 text-white/50"
                  }`}
                >⚡ Superset</button>
                <span className="h-px flex-1 bg-white/12" />
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className={`w-8 shrink-0 text-right text-sm font-semibold ${
                labels[i]?.superset ? "text-blue-300" : "text-white/40"
              }`}>
                {labels[i]?.label})
              </span>
              <input
                className="field min-h-11 flex-1 px-2 text-base"
                placeholder="Exercise"
                value={ex.name}
                onChange={(e) => patch(i, { name: e.target.value })}
              />
              <button
                type="button"
                aria-label={`Remove ${ex.name || "exercise"}`}
                onClick={() => removeRow(i)}
                className="size-11 shrink-0 text-white/40"
              >×</button>
            </div>

            <textarea
              className="field ml-10 mt-1 w-[calc(100%-2.5rem)] p-2 font-mono text-base leading-relaxed"
              rows={Math.min(10, ex.freeText.split("\n").length + 1)}
              placeholder={"95*10\n115*6"}
              value={ex.freeText}
              onChange={(e) => patch(i, { freeText: e.target.value })}
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => { touch(); setExercises((list) => [...list, blankRow()]); }}
        className="mt-3 min-h-12 w-full rounded-xl border border-dashed border-white/30 text-sm"
      >+ exercise</button>

      {workout && hasNotes(workout) && (
        <section className="mt-4 rounded-xl bg-white/5 p-3 text-sm">
          <h3 className="text-xs font-medium uppercase tracking-wide text-white/50">
            Notes on this day
          </h3>
          {/* Blue is theirs, amber is yours — including the ones you wrote from
              the client view on your phone, which would otherwise look lost. */}
          <NoteLines workout={workout} />
        </section>
      )}

      {/* On a phone the panel would not fit beside the editor, so it folds in
          underneath instead. Closed by default — the phone is for writing the
          day, the laptop is where the history is read. */}
      {variant === "sheet" && history.length > 0 && (
        <details className="mt-4 rounded-xl border border-white/12">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 p-3 text-sm text-white/55">
            <span className="chev text-white/40">›</span>
            Previous sessions
          </summary>
          <div className="border-t border-white/12 p-2">
            <History history={history} names={currentNames} date={date} />
          </div>
        </details>
      )}
    </div>
  );

  // The side panel on a laptop: the sessions before this one, most recent
  // first, always open. Hidden below xl, and xl rather than lg for a measured
  // reason: at 1024 the Thursday column pushes the panel 17px past the calendar
  // scroller, which has overflow-y:auto and therefore clips and scrolls in x too
  // — an overflow the document never sees. Measure `scrollWidth - clientWidth`
  // on the scroller, not on documentElement, if this width is ever changed.
  const past = (
    <aside className="hidden w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-white/20 bg-[var(--background)] shadow-xl xl:flex">
      <h3 className="border-b border-white/12 p-3 text-xs font-medium uppercase tracking-wide text-white/50">
        Previous sessions
      </h3>
      <div className="overflow-y-auto p-2">
        <History history={history} names={currentNames} date={date} />
      </div>
    </aside>
  );

  const footer = (
    <footer className="flex items-center gap-2 border-t border-white/12 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {error && <span className="text-sm text-red-300">{error}</span>}
      {workout && (
        <button
          type="button"
          onClick={() => {
            if (confirm("Delete this workout?")) void onDelete(workout.id).then(onClose);
          }}
          className="min-h-12 rounded-lg px-3 text-sm text-red-300"
        >Delete</button>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={() => void saveAndExit()}
        className="ml-auto min-h-12 rounded-lg bg-white px-5 font-medium text-neutral-900 disabled:opacity-60"
      >{saving ? "Saving…" : "Save"}</button>
    </footer>
  );

  // Anchored in the day cell. The orange border is CoachSpace's signal that a
  // cell is being edited, and the `align` flip is what keeps the panel on
  // screen in the Friday, Saturday and Sunday columns — the bug CoachSpace has
  // because it styles for the flip but never sets the attribute that triggers it.
  if (variant === "popover") {
    return (
      <div
        // A cell near the bottom of the calendar would open its panel below the
        // fold; nudge the calendar so the whole panel is reachable.
        ref={(el) => { el?.scrollIntoView({ block: "nearest" }); }}
        onClick={(e) => e.stopPropagation()}
        // The row is editor + history. `align` decides which edge it hangs off,
        // and `flex-row-reverse` keeps the editor itself against that edge, so
        // the history panel always grows towards the middle of the screen
        // rather than off it.
        className={`absolute top-0 z-50 flex max-h-[70vh] items-stretch gap-2 ${
          align === "right" ? "right-0 flex-row" : "left-0 flex-row-reverse"
        }`}
      >
        {past}
        <div className="flex w-[21rem] shrink-0 flex-col overflow-hidden rounded-xl border-2 border-[#ea6c00] bg-[var(--background)] shadow-xl">
          {header}
          {body}
          {footer}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <section className="relative flex h-full w-full flex-col bg-[var(--background)]">
        {header}
        {body}
        {footer}
      </section>
    </div>
  );
}
