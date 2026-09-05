"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDays, dayOfMonth, formatLong, formatWeekRange, mondayOf, monthKey, monthLabel,
  today, toISODate, weekdayName,
} from "@/lib/dates";
import { exerciseLabels, setLines, type Client, type Workout, type WorkoutDraft } from "@/lib/types";
import {
  addClientAction, clearClientPasscodeAction, copyWorkoutAction,
  deleteClientAction, deleteWorkoutAction, moveWorkoutAction,
  renameClientAction, saveWorkoutAction,
} from "./actions";
import WorkoutEditor from "./WorkoutEditor";

const MONTHS_BEFORE = 3;
const MONTHS_AFTER = 12;

/** One continuous Monday-start run of days, no month gaps. */
function calendarDays(): string[] {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - MONTHS_BEFORE, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + MONTHS_AFTER + 1, 0);
  const days: string[] = [];
  for (let d = mondayOf(toISODate(first)); d <= toISODate(last); d = addDays(d, 1)) {
    days.push(d);
  }
  // Finish the trailing week so the grid never has a ragged last row.
  while (days.length % 7 !== 0) days.push(addDays(days[days.length - 1], 1));
  return days;
}

/**
 * A note in a calendar cell. Blue is the client, amber is the coach — the same
 * pairing the editor's history panel uses, so a colour means one thing app-wide.
 * `span`, not `p`: these sit inside the cell's <button>, which may not contain
 * block elements.
 */
const NOTE_BASE =
  "mt-0.5 ml-2 block whitespace-pre-line rounded border-l-2 px-1.5 py-0.5 text-[11px] leading-snug";
const NOTE_CLIENT = `${NOTE_BASE} border-blue-400/60 bg-blue-400/10 text-blue-200`;
const NOTE_COACH = `${NOTE_BASE} border-amber-400/60 bg-amber-400/10 text-amber-200`;

type CopyState = { workoutId: string; mode: "copy" | "move" } | null;

export default function CoachBoard({
  clients, clientId, workouts, editWorkoutId,
}: {
  clients: Client[]; clientId: string; workouts: Workout[];
  /** ?edit= — a session to open the editor on straight away, from the ✏️ Edit
   *  link on the client workout page. */
  editWorkoutId?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [copy, setCopy] = useState<CopyState>(null);
  const [editor, setEditor] = useState<{ date: string; workout: Workout | null } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [visibleMonth, setVisibleMonth] = useState(() => monthKey(today()));
  /** The session the 🖨 was pressed on. Only ever set for the length of one
   *  print dialog — see the effect below. */
  const [printing, setPrinting] = useState<Workout | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const days = useMemo(calendarDays, []);

  /**
   * Which calendar to render — not a CSS `hidden` pair. Both trees mounted at
   * once would mean two editors listening for Escape, and one keypress would
   * save the workout twice.
   */
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /**
   * Printing one session. The button only sets state: the sheet has to be in
   * the DOM before the dialog opens, so `window.print()` waits a frame for
   * React to paint it. `afterprint` clears it again — the sheet is
   * `display: none` on screen, but left mounted it would also come out of the
   * next ⌘P the coach presses himself.
   */
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    const frame = requestAnimationFrame(() => window.print());
    return () => {
      window.removeEventListener("afterprint", done);
      cancelAnimationFrame(frame);
    };
  }, [printing]);
  const byDate = useMemo(() => {
    const m = new Map<string, Workout[]>();
    for (const w of workouts) m.set(w.date, [...(m.get(w.date) ?? []), w]);
    return m;
  }, [workouts]);

  const refresh = () => startTransition(() => router.refresh());

  /**
   * What the editor's "Previous sessions" panel can choose from: every earlier
   * day of this person's, newest first. `workouts` is already this client only
   * and sorted by date, so this is a slice, not a fetch.
   *
   * Deliberately not the last six — the matching session is routinely older
   * than that. A squat day three weeks back is exactly the one he wants open
   * while writing the next one, and the panel shows one session at a time, so
   * the length of this list costs nothing on screen.
   */
  const historyFor = (date: string) =>
    workouts.filter((w) => w.date < date).reverse();

  /**
   * Opened from ?edit=. Once only: `router.refresh()` after every save re-runs
   * this component with the param still in the URL, and without the ref a save
   * would pop the editor straight back open after it was closed. The id is
   * looked up in `workouts`, which is this client only, so an id belonging to
   * the other person is a no-op rather than an editor on someone else's day.
   */
  const openedDeepLink = useRef(false);
  /**
   * Where closing the editor goes back to — the client workout page he pressed
   * ✏️ Edit on, so save-and-exit lands back where he was rather than on the
   * week list. A ref and not state: `remove()` clears it after an await, and
   * the `onClose` that runs next would otherwise still see the old value.
   */
  const returnTo = useRef<string | null>(null);
  useEffect(() => {
    if (!editWorkoutId || openedDeepLink.current) return;
    openedDeepLink.current = true;
    const w = workouts.find((x) => x.id === editWorkoutId);
    if (!w) return;
    setEditor({ date: w.date, workout: w });
    returnTo.current = `/c/${clientId}/w/${w.id}`;
  }, [editWorkoutId, workouts, clientId]);

  /** Every exit from the editor — Save & close, Escape, ⌘⏎ and delete. */
  function closeEditor() {
    setEditor(null);
    const to = returnTo.current;
    returnTo.current = null;
    if (to) router.push(to);
  }

  /* Desktop calendar opens on today — or on the day being edited, when we
     arrived from ?edit=, so the popover is not mounted off-screen. */
  useEffect(() => {
    const date = workouts.find((x) => x.id === editWorkoutId)?.date ?? today();
    const el = scroller.current?.querySelector(`[data-date="${date}"]`);
    el?.scrollIntoView({ block: "center" });
    onScroll(); // scrollIntoView does not always fire a scroll event
    // Mount only — this positions the calendar once and must not re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * A week row belongs to the month containing its Thursday — the ISO rule.
   *
   * The label and the ‹ › buttons must use the same rule or they fight: label
   * by the row's first day and "next month" appears to do nothing, because
   * September's first row starts on 31 August.
   */
  const rowMonth = (monday: string) => monthKey(addDays(monday, 3));

  /** Every 7th cell, i.e. the Monday that starts each week row. */
  function mondayCells(box: HTMLDivElement): HTMLElement[] {
    return Array.from(box.querySelectorAll<HTMLElement>("[data-date]"))
      .filter((_, i) => i % 7 === 0);
  }

  /** The Monday of the first fully visible week row. */
  function firstVisibleMonday(box: HTMLDivElement): string | null {
    const top = box.getBoundingClientRect().top;
    for (const cell of mondayCells(box)) {
      if (cell.getBoundingClientRect().top >= top - 1) return cell.dataset.date!;
    }
    return null;
  }

  function onScroll() {
    const box = scroller.current;
    if (!box) return;
    const monday = firstVisibleMonday(box);
    if (monday) setVisibleMonth(rowMonth(monday));
  }

  function scrollToMonth(step: number) {
    const box = scroller.current;
    if (!box) return;
    const [y, m] = visibleMonth.split("-").map(Number);
    const want = monthKey(toISODate(new Date(y, m - 1 + step, 1)));

    // Only row starts: any other cell in the row scrolls to the same place but
    // belongs to the row before it, so the label would not move.
    for (const cell of mondayCells(box)) {
      if (rowMonth(cell.dataset.date!) !== want) continue;
      const delta = cell.getBoundingClientRect().top - box.getBoundingClientRect().top;
      box.scrollTo({ top: box.scrollTop + delta - 4, behavior: "smooth" });
      return;
    }
  }

  function scrollToToday() {
    scroller.current
      ?.querySelector(`[data-date="${today()}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  /* --------------------------------------------------------- copy / move */

  async function pasteOnto(date: string) {
    if (!copy) return;
    const { workoutId, mode } = copy;
    setCopy(null);
    if (mode === "copy") await copyWorkoutAction(workoutId, date, clientId);
    else await moveWorkoutAction(workoutId, date, clientId);
    refresh();
  }

  function onDayClick(date: string) {
    if (copy) return void pasteOnto(date);
    // While an editor is open, clicking another day would swap it out and throw
    // away whatever was typed. Close it deliberately instead.
    if (editor) return;
    setEditor({ date, workout: null });
  }

  /* ------------------------------------------------------------- editing */

  async function save(draft: WorkoutDraft) {
    await saveWorkoutAction(draft);
    refresh();
  }

  async function remove(id: string) {
    // The page we would go back to is about to 404. Stay on the calendar.
    if (returnTo.current?.endsWith(`/${id}`)) returnTo.current = null;
    await deleteWorkoutAction(id);
    refresh();
  }

  /* ---------------------------------------------------------------- view */

  const weekMonday = addDays(mondayOf(today()), weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i));

  /** 📋 ↕️ 🗑 — the same three on the phone and on the calendar. */
  const rowButtons = (w: Workout) => (
    <>
      {/* Laptop only, like +, × and 🔒 on the pill row. Two reasons: he prints
          at his desk, and a fourth 44px button in the phone week row is width
          that row measurably does not have. */}
      {isDesktop && (
        <button
          type="button"
          aria-label="Print this workout"
          onClick={(e) => { e.stopPropagation(); setPrinting(w); }}
          className="min-h-11 px-2 md:min-h-8 md:px-1"
        >🖨</button>
      )}
      <button
        type="button"
        aria-label="Copy this workout"
        onClick={(e) => { e.stopPropagation(); setCopy({ workoutId: w.id, mode: "copy" }); }}
        className="min-h-11 px-2 md:min-h-8 md:px-1"
      >📋</button>
      <button
        type="button"
        aria-label="Move this workout"
        onClick={(e) => { e.stopPropagation(); setCopy({ workoutId: w.id, mode: "move" }); }}
        className="min-h-11 px-2 md:min-h-8 md:px-1"
      >↕️</button>
      <button
        type="button"
        aria-label="Delete this workout"
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("Delete this workout?")) void remove(w.id);
        }}
        className="min-h-11 px-2 md:min-h-8 md:px-1"
      >🗑</button>
    </>
  );

  /**
   * The phone week list: one row per session — title, then the exercise names
   * on a line or two — so a whole week is on the screen at once. Tap it to read
   * and edit the session in full. The desktop calendar cell deliberately shows
   * everything instead; that is what the calendar is for.
   */
  const compactBlock = (w: Workout) => (
    <div
      key={w.id}
      className={`flex items-stretch overflow-hidden rounded-lg border ${
        w.done ? "border-green-400/30 bg-green-400/10" : "border-white/20 bg-white/5"
      } ${copy?.workoutId === w.id ? "ring-2 ring-blue-400" : ""}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          // On the phone a session opens as the client sees it — the page with
          // the set boxes and both note columns. Editing it is the ✏️ Edit link
          // in that page's header, which comes back here with ?edit=.
          if (copy) void pasteOnto(w.date);
          else router.push(`/c/${clientId}/w/${w.id}`);
        }}
        className="min-h-11 min-w-0 flex-1 px-2 py-1 text-left"
      >
        <span className="flex items-baseline gap-2">
          <span className="text-sm" aria-hidden>{w.done ? "✓" : "○"}</span>
          <span className="truncate text-sm font-semibold">{w.title || "Session"}</span>
          {/* The count stays, because the names below are clamped to two lines:
              without it a six-exercise day reads as the four that fit. */}
          <span className="ml-auto shrink-0 text-xs text-white/40">
            {w.exercises.length}ex
          </span>
          <span className="shrink-0 text-xs">
            {(w.coachNote || w.overallCoachNote || Object.keys(w.coachNotes).length > 0) && "📝"}
            {(w.overallNote || Object.keys(w.notes).length > 0) && "👤"}
          </span>
        </span>
        {/* Names only, two lines at most — no set lines, no notes. */}
        <span className="line-clamp-2 text-xs leading-snug text-white/50">
          {w.exercises.map((ex) => ex.name).join(" · ")}
        </span>
      </button>
      <span className="flex shrink-0 items-center border-l border-white/12">
        {rowButtons(w)}
      </span>
    </div>
  );

  /**
   * The printed session: one page of black-on-white, the program as written.
   *
   * Deliberately not the calendar cell restyled. Ticked sets stay off every
   * coach surface, and this is a sheet handed to a client — so no `doneSets`,
   * and no per-exercise or client notes either. The session note is the one
   * thing that prints, because it is written to be read on the day.
   *
   * Labels come from `exerciseLabels`, so A1) A2) on paper is the same pair it
   * is on screen. Colours are plain CSS in `globals.css` rather than Tailwind
   * utilities: every one of those is picked for the dark app and would print
   * as pale grey on white, or not at all.
   */
  const printSheet = (w: Workout) => {
    const labels = exerciseLabels(w.exercises);
    const name = clients.find((c) => c.id === w.clientId)?.name ?? "";
    return (
      <div className="print-only print-sheet">
        <header className="print-head">
          <h1>{w.title || "Session"}</h1>
          <p>{name} · {formatLong(w.date)}</p>
        </header>

        {w.coachNote && <p className="print-note">{w.coachNote}</p>}

        {w.exercises.map((ex, i) => (
          <div key={ex.id} className="print-exercise">
            <h2>{labels[i].label}) {ex.name}</h2>
            {ex.freeText.trim() && <pre>{ex.freeText}</pre>}
          </div>
        ))}
      </div>
    );
  };

  const block = (w: Workout) => {
    const labels = exerciseLabels(w.exercises);
    const openDay = () => {
      if (copy) void pasteOnto(w.date);
      else setEditor({ date: w.date, workout: w });
    };
    return (
    <div
      key={w.id}
      className={`overflow-hidden rounded-lg border text-left ${
        w.done
          ? "border-green-400/30 bg-green-400/10"
          : "border-white/20 bg-white/5"
      } ${copy?.workoutId === w.id ? "ring-2 ring-blue-400" : ""}`}
    >
      {/* The title row, and the only thing in the cell that is not the editor:
          copy, move and delete, pinned to its right. They used to sit in a
          strip along the bottom of the cell, which put them under every set
          line and note — on a long day that is off the bottom of the column.
          A separate <button> from the body below because a button may not
          contain buttons; both open the same editor. */}
      <div className="flex items-center gap-1 border-b border-white/12 pl-2 pr-1">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openDay(); }}
          className="flex min-h-11 min-w-0 flex-1 items-baseline gap-2 py-1 text-left md:min-h-0"
        >
          <span className="text-sm" aria-hidden>{w.done ? "✓" : "○"}</span>
          {/* No `Nex` count here, unlike the phone row. The count is there
              because that row clamps the names to two lines; this cell writes
              the whole session out below, so it never told you anything — and
              at a 175px column the four buttons and the count together truncate
              the title to nothing. Measured at 1280: dropping it puts the title
              back to exactly the width it had before 🖨 was added. */}
          <span className="truncate text-sm font-semibold">{w.title || "Session"}</span>
        </button>
        <span className="flex shrink-0 items-center">{rowButtons(w)}</span>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); openDay(); }}
        className="block w-full px-2 py-1 text-left"
      >
        {w.exercises.map((ex, i) => (
          <span key={ex.id} className="mt-1 block">
            <span className={`block text-xs font-semibold ${
              labels[i].superset ? "text-blue-300" : ""
            }`}>
              {labels[i].label}) {ex.name}
            </span>
            {ex.freeText.trim() && (
              // Line by line rather than one whitespace-pre-line block, so a
              // set the client rated can carry its RIR/RPE beside it. This is
              // the surface a week is actually read on, which is why the
              // ratings are here and not only in the editor's history panel.
              // Spans throughout — this whole cell is inside a <button>.
              <span className="block pl-2 font-mono text-[11px] leading-tight text-white/40">
                {setLines(ex.freeText).map((line) =>
                  line.text.trim() === "" ? (
                    <span key={line.index} aria-hidden className="block h-1" />
                  ) : (
                    <span key={line.index} className="block">
                      {line.text}
                      {ex.ratings[String(line.index)] && (
                        <span className="ml-1.5 font-semibold text-blue-300">
                          {ex.ratings[String(line.index)]}
                        </span>
                      )}
                    </span>
                  ),
                )}
              </span>
            )}
            {/* The notes themselves, on the exercise they were written on —
                blue is the client, amber is you. The calendar cell is where a
                week is read, so a summary line ("left notes") was no use: the
                whole point is seeing what was written without opening the day. */}
            {w.notes[ex.id] && (
              <span className={NOTE_CLIENT}>👤 {w.notes[ex.id]}</span>
            )}
            {w.coachNotes[ex.id] && (
              <span className={NOTE_COACH}>📝 {w.coachNotes[ex.id]}</span>
            )}
          </span>
        ))}

        {/* Notes on the day rather than on one exercise, under a rule. */}
        {(w.coachNote || w.overallNote || w.overallCoachNote) && (
          <span className="mt-1.5 block border-t border-white/12 pt-1">
            {w.coachNote && <span className={NOTE_COACH}>📝 {w.coachNote}</span>}
            {w.overallNote && <span className={NOTE_CLIENT}>👤 {w.overallNote}</span>}
            {w.overallCoachNote && (
              <span className={NOTE_COACH}>📝 {w.overallCoachNote}</span>
            )}
          </span>
        )}
      </button>
    </div>
    );
  };

  return (
    <>
    {printing && printSheet(printing)}
    {/* `no-print` and not a print stylesheet over the top of it: the app is
        `h-dvh` around an `overflow-y-auto` scroller, which prints as one
        truncated screen however it is coloured. */}
    <div className="no-print flex h-dvh flex-col">
      {/* ----------------------------------------------------- client pills */}
      <header className="flex flex-wrap items-center gap-2 border-b border-white/12 p-3">
        {clients.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => router.push(`/coach?c=${c.id}`)}
            onDoubleClick={() => {
              const name = prompt("Name", c.name);
              if (name) void renameClientAction(c.id, name).then(refresh);
            }}
            title="Double-click to rename"
            className={`min-h-11 rounded-full border px-4 text-sm ${
              c.id === clientId
                ? "border-white bg-white text-neutral-900"
                : "border-white/20"
            }`}
          >{c.name}</button>
        ))}
        {/* Laptop only — on a phone the pill row is already the full width and
            the coach adds people at his desk, not between sets. */}
        {isDesktop && (
          <button
            type="button"
            onClick={() => {
              const name = prompt("New client's name");
              if (!name) return;
              void addClientAction(name).then((id) => {
                if (id) router.push(`/coach?c=${id}`);
              });
            }}
            title="Add a client"
            aria-label="Add a client"
            className="size-11 rounded-full border border-white/20 text-lg leading-none text-white/70 hover:border-white/50 hover:text-white"
          >+</button>
        )}

        {/* Deletes whoever is selected, and with them every session ever
            written for them. Typing the name is the confirmation — a window
            the coach can dismiss with the spacebar is not enough for a button
            that takes a year of training with it. Hidden when there is only
            one person left, which the server refuses anyway. */}
        {isDesktop && clients.length > 1 && (
          <button
            type="button"
            onClick={() => {
              const name = clients.find((c) => c.id === clientId)?.name ?? "";
              const typed = prompt(
                `Delete ${name} and all ${workouts.length} of their sessions?\n` +
                `This cannot be undone. Type the name to confirm.`,
              );
              if (typed?.trim() !== name) return;
              /* push *and* refresh: when the URL is already a bare /coach —
                 the first client is selected by default, not by ?c= — a push
                 to the same address navigates nowhere and the deleted person
                 would stay on screen. */
              void deleteClientAction(clientId).then(() => {
                router.push("/coach");
                refresh();
              });
            }}
            title={`Delete ${clients.find((c) => c.id === clientId)?.name ?? "client"}`}
            aria-label="Delete the selected client"
            className="size-11 rounded-full border border-white/20 text-lg leading-none text-white/40 hover:border-red-400/60 hover:text-red-300"
          >&times;</button>
        )}

        {/* Only there when the selected client actually has a passcode, because
            clearing one that isn't set does nothing. This is the whole recovery
            route — no email in this app — and it can only clear, never read:
            the stored hash does not turn back into a passcode. */}
        {isDesktop && clients.find((c) => c.id === clientId)?.hasPasscode && (
          <button
            type="button"
            onClick={() => {
              const name = clients.find((c) => c.id === clientId)?.name ?? "";
              if (!confirm(
                `Clear ${name}'s passcode?\n\n` +
                `Their name goes back to tapping straight through, and they can ` +
                `set a new one from their own page.`,
              )) return;
              void clearClientPasscodeAction(clientId).then(refresh);
            }}
            title={`Clear ${clients.find((c) => c.id === clientId)?.name ?? "client"}'s passcode`}
            aria-label="Clear the selected client's passcode"
            className="size-11 rounded-full border border-white/20 text-sm leading-none text-white/40 hover:border-white/50 hover:text-white"
          >🔒</button>
        )}

        <Link href="/" className="ml-auto inline-flex min-h-11 items-center text-sm text-white/50 underline underline-offset-4">
          Client view
        </Link>
      </header>

      {copy && (
        <div className="flex items-center gap-3 bg-blue-600 px-3 py-2 text-sm text-white">
          <span>
            {copy.mode === "copy" ? "Copy" : "Move"} mode — tap any day to drop it.
            You can switch person first.
          </span>
          <button type="button" onClick={() => setCopy(null)} className="ml-auto min-h-9 underline">
            Cancel
          </button>
        </div>
      )}

      {/* ------------------------------------------------- desktop calendar */}
      {isDesktop && (
      <div className="flex min-h-0 flex-1 flex-col">
        <nav className="flex items-center gap-2 px-3 py-2">
          <button type="button" onClick={() => scrollToMonth(-1)} aria-label="Previous month"
            className="size-11 rounded-lg border border-white/20">‹</button>
          <button type="button" onClick={() => scrollToMonth(1)} aria-label="Next month"
            className="size-11 rounded-lg border border-white/20">›</button>
          <span className="font-medium">{monthLabel(`${visibleMonth}-01`)}</span>
          <button type="button" onClick={scrollToToday}
            className="ml-auto min-h-11 rounded-lg border border-white/20 px-3 text-sm">
            Today
          </button>
        </nav>

        <div className="grid grid-cols-7 border-b border-white/12 px-3 text-xs text-white/50">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* `relative` is load-bearing: offsetTop is measured against the nearest
            positioned ancestor, and without it the month label reads page
            offsets and lands a month or two out. */}
        <div
          ref={scroller}
          onScroll={onScroll}
          className="relative min-h-0 flex-1 overflow-y-auto px-3"
        >
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const isToday = d === today();
              const first = dayOfMonth(d) === 1;
              return (
                <div
                  key={d}
                  data-date={d}
                  onClick={() => onDayClick(d)}
                  className={`relative min-h-28 border-b border-r border-white/12 p-1 ${
                    copy ? "cursor-copy hover:bg-blue-400/10" : "cursor-pointer"
                  } ${editor?.date === d ? "z-40" : ""}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`text-xs ${
                      isToday
                        ? "rounded-full bg-white px-1.5 py-0.5 text-neutral-900"
                        : "text-white/50"
                    }`}>
                      {first ? `${dayOfMonth(d)} ${monthLabel(d).split(" ")[0].slice(0, 3)}` : dayOfMonth(d)}
                    </span>
                    {!copy && <span className="text-white/25">+</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    {(byDate.get(d) ?? []).map((w) => block(w))}
                  </div>

                  {editor?.date === d && (
                    <WorkoutEditor
                      key={editor.workout?.id ?? "new"}
                      clientId={clientId}
                      date={editor.date}
                      workout={editor.workout}
                      history={historyFor(editor.date)}
                      variant="popover"
                      // Fri/Sat/Sun hang off the right edge or they run off screen.
                      align={i % 7 >= 4 ? "right" : "left"}
                      onClose={closeEditor}
                      onSave={save}
                      onDelete={remove}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      )}

      {/* ---------------------------------------------------- mobile: week */}
      {!isDesktop && (
      <div className="flex min-h-0 flex-1 flex-col">
        <nav className="flex items-center gap-2 px-3 py-2">
          <button type="button" onClick={() => setWeekOffset((n) => n - 1)} aria-label="Previous week"
            className="size-11 rounded-lg border border-white/20">‹</button>
          <span className="flex-1 text-center text-sm font-medium">{formatWeekRange(weekMonday)}</span>
          <button type="button" onClick={() => setWeekOffset((n) => n + 1)} aria-label="Next week"
            className="size-11 rounded-lg border border-white/20">›</button>
          <button type="button" onClick={() => setWeekOffset(0)}
            className="min-h-11 rounded-lg border border-white/20 px-3 text-sm">
            Today
          </button>
        </nav>

        {/* The day label is a gutter beside the session rather than a heading
            above it, and + Add only takes a row of its own on an empty day.
            Both are for the same reason: seven days have to be on the screen
            at once, which they are not if each day costs a heading, a button
            row and the whole session written out. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
          {weekDays.map((d) => {
            const dayWorkouts = byDate.get(d) ?? [];
            return (
              <section key={d} className="flex items-start gap-2 border-t border-white/12 py-0.5">
                {/* w-14 so "Mon 24" stays on one line — wrapped, it makes the
                    gutter taller than the session beside it. */}
                <div className="w-14 shrink-0 pt-1">
                  <span className={`block whitespace-nowrap text-sm ${
                    d === today() ? "font-semibold" : "text-white/50"
                  }`}>
                    {weekdayName(d, true)} {dayOfMonth(d)}
                  </span>
                  {/* On a day that already has a session the + lives here,
                      beside it, where it costs no height at all. */}
                  {dayWorkouts.length > 0 && !copy && (
                    <button
                      type="button"
                      aria-label={`Add a session on ${d}`}
                      onClick={() => onDayClick(d)}
                      className="mt-1 min-h-11 w-11 rounded-lg border border-dashed border-white/20 text-sm text-white/40"
                    >+</button>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {dayWorkouts.map((w) => compactBlock(w))}
                  {(dayWorkouts.length === 0 || copy) && (
                    <button
                      type="button"
                      onClick={() => onDayClick(d)}
                      className="min-h-11 rounded-lg border border-dashed border-white/20 text-sm text-white/40"
                    >{copy ? "Drop here" : "+ Add"}</button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      )}

      {!isDesktop && editor && (
        <WorkoutEditor
          key={editor.workout?.id ?? "new"}
          clientId={clientId}
          date={editor.date}
          workout={editor.workout}
          history={historyFor(editor.date)}
          variant="sheet"
          onClose={closeEditor}
          onSave={save}
          onDelete={remove}
        />
      )}
    </div>
    </>
  );
}
