"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDays, dayOfMonth, formatWeekRange, mondayOf, monthKey, monthLabel,
  today, toISODate, weekdayName,
} from "@/lib/dates";
import { exerciseLabels, type Client, type Workout, type WorkoutDraft } from "@/lib/types";
import {
  copyWorkoutAction, deleteWorkoutAction, moveWorkoutAction,
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

type CopyState = { workoutId: string; mode: "copy" | "move" } | null;

export default function CoachBoard({
  clients, clientId, workouts,
}: { clients: Client[]; clientId: string; workouts: Workout[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [copy, setCopy] = useState<CopyState>(null);
  const [editor, setEditor] = useState<{ date: string; workout: Workout | null } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [visibleMonth, setVisibleMonth] = useState(() => monthKey(today()));
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
  const byDate = useMemo(() => {
    const m = new Map<string, Workout[]>();
    for (const w of workouts) m.set(w.date, [...(m.get(w.date) ?? []), w]);
    return m;
  }, [workouts]);

  const refresh = () => startTransition(() => router.refresh());

  /**
   * What the editor shows in its "Previous sessions" panel: this person's last
   * few days before the one being edited, newest first. `workouts` is already
   * this client only and sorted by date, so this is a slice, not a fetch.
   */
  const HISTORY_DAYS = 6;
  const historyFor = (date: string) =>
    workouts.filter((w) => w.date < date).slice(-HISTORY_DAYS).reverse();

  /* Desktop calendar opens on today. */
  useEffect(() => {
    const el = scroller.current?.querySelector(`[data-date="${today()}"]`);
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
    await deleteWorkoutAction(id);
    refresh();
  }

  /* ---------------------------------------------------------------- view */

  const weekMonday = addDays(mondayOf(today()), weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i));

  const block = (w: Workout) => {
    const labels = exerciseLabels(w.exercises);
    return (
    <div
      key={w.id}
      className={`overflow-hidden rounded-lg border text-left ${
        w.done
          ? "border-green-600/40 bg-green-50"
          : "border-neutral-300 bg-neutral-50"
      } ${copy?.workoutId === w.id ? "ring-2 ring-blue-500" : ""}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (copy) void pasteOnto(w.date);
          else setEditor({ date: w.date, workout: w });
        }}
        className="block w-full min-h-11 px-2 py-1 text-left md:min-h-0"
      >
        <span className="flex items-baseline gap-2 border-b border-neutral-200 pb-1">
          <span className="text-sm" aria-hidden>{w.done ? "✓" : "○"}</span>
          <span className="text-sm font-semibold">{w.title || "Session"}</span>
          <span className="ml-auto text-xs text-neutral-400">{w.exercises.length}ex</span>
        </span>

        {w.exercises.map((ex, i) => (
          <span key={ex.id} className="mt-1 block">
            <span className={`block text-xs font-semibold ${
              labels[i].superset ? "text-blue-600" : ""
            }`}>
              {labels[i].label}) {ex.name}
            </span>
            {ex.freeText.trim() && (
              <span className="block whitespace-pre-line pl-2 font-mono text-[11px] leading-tight text-neutral-400">
                {ex.freeText}
              </span>
            )}
          </span>
        ))}

        {(w.coachNote || w.overallCoachNote || Object.keys(w.coachNotes).length > 0) && (
          <span className="mt-1 block text-xs text-amber-700">
            📝 {w.coachNote || w.overallCoachNote || "your notes"}
          </span>
        )}
        {(w.overallNote || Object.keys(w.notes).length > 0) && (
          <span className="mt-1 block text-xs text-blue-700">
            👤 {w.overallNote || "left notes"}
          </span>
        )}
      </button>

      <div className="flex gap-1 px-1 pb-1">
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
      </div>
    </div>
    );
  };

  return (
    <div className="flex h-dvh flex-col">
      {/* ----------------------------------------------------- client pills */}
      <header className="flex flex-wrap items-center gap-2 border-b border-neutral-200 p-3">
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
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300"
            }`}
          >{c.name}</button>
        ))}
        <Link href="/" className="ml-auto inline-flex min-h-11 items-center text-sm text-neutral-500 underline underline-offset-4">
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
            className="size-11 rounded-lg border border-neutral-300">‹</button>
          <button type="button" onClick={() => scrollToMonth(1)} aria-label="Next month"
            className="size-11 rounded-lg border border-neutral-300">›</button>
          <span className="font-medium">{monthLabel(`${visibleMonth}-01`)}</span>
          <button type="button" onClick={scrollToToday}
            className="ml-auto min-h-11 rounded-lg border border-neutral-300 px-3 text-sm">
            Today
          </button>
        </nav>

        <div className="grid grid-cols-7 border-b border-neutral-200 px-3 text-xs text-neutral-500">
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
                  className={`relative min-h-28 border-b border-r border-neutral-200 p-1 ${
                    copy ? "cursor-copy hover:bg-blue-50" : "cursor-pointer"
                  } ${editor?.date === d ? "z-40" : ""}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`text-xs ${
                      isToday
                        ? "rounded-full bg-neutral-900 px-1.5 py-0.5 text-white"
                        : "text-neutral-500"
                    }`}>
                      {first ? `${dayOfMonth(d)} ${monthLabel(d).split(" ")[0].slice(0, 3)}` : dayOfMonth(d)}
                    </span>
                    {!copy && <span className="text-neutral-300">+</span>}
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
                      onClose={() => setEditor(null)}
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
            className="size-11 rounded-lg border border-neutral-300">‹</button>
          <span className="flex-1 text-center text-sm font-medium">{formatWeekRange(weekMonday)}</span>
          <button type="button" onClick={() => setWeekOffset((n) => n + 1)} aria-label="Next week"
            className="size-11 rounded-lg border border-neutral-300">›</button>
          <button type="button" onClick={() => setWeekOffset(0)}
            className="min-h-11 rounded-lg border border-neutral-300 px-3 text-sm">
            Today
          </button>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8">
          {weekDays.map((d) => (
            <section key={d} className="border-t border-neutral-200 py-2">
              <div className="flex items-center justify-between">
                <span className={`text-sm ${d === today() ? "font-semibold" : "text-neutral-500"}`}>
                  {weekdayName(d, true)} {dayOfMonth(d)}
                </span>
                <button
                  type="button"
                  onClick={() => onDayClick(d)}
                  className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm"
                >{copy ? "Drop here" : "+ Add"}</button>
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {(byDate.get(d) ?? []).map((w) => block(w))}
              </div>
            </section>
          ))}
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
          onClose={() => setEditor(null)}
          onSave={save}
          onDelete={remove}
        />
      )}
    </div>
  );
}
