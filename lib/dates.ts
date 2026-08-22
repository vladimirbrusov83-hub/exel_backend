/**
 * All dates are "YYYY-MM-DD" strings in *local* time.
 *
 * The trap this file exists to avoid: `new Date("2026-08-21")` parses as UTC
 * midnight, so west of Greenwich it renders as the 20th. Every conversion here
 * goes through local Y/M/D parts, never through toISOString().
 */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "2026-08-21" -> a local Date at midnight. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Today, recomputed on every call — never cached at module load. */
export function today(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** The Monday on or before `iso`. Weeks start on Monday. */
export function mondayOf(iso: string): string {
  const d = fromISODate(iso);
  const shift = (d.getDay() + 6) % 7; // Sun=0 -> 6, Mon=1 -> 0
  d.setDate(d.getDate() - shift);
  return toISODate(d);
}

export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export function weekdayName(iso: string, short = false): string {
  const n = WEEKDAYS[fromISODate(iso).getDay()];
  return short ? n.slice(0, 3) : n;
}

export function monthName(iso: string, short = false): string {
  const n = MONTHS[fromISODate(iso).getMonth()];
  return short ? n.slice(0, 3) : n;
}

export function dayOfMonth(iso: string): number {
  return fromISODate(iso).getDate();
}

/** "Monday, 21 Aug" */
export function formatLong(iso: string): string {
  return `${weekdayName(iso)}, ${dayOfMonth(iso)} ${monthName(iso, true)}`;
}

/** "21 Aug – 27 Aug" for a week starting at `monday`. */
export function formatWeekRange(monday: string): string {
  const end = addDays(monday, 6);
  return `${dayOfMonth(monday)} ${monthName(monday, true)} – ${dayOfMonth(end)} ${monthName(end, true)}`;
}

/** "August 2026" — the key the calendar groups and labels months by. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthLabel(iso: string): string {
  return `${monthName(iso)} ${fromISODate(iso).getFullYear()}`;
}
