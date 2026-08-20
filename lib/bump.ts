// Pure load-bumping used when building next week from a previous one.

export type Bump =
  | { mode: "same" }
  | { mode: "add"; value: number }
  | { mode: "percent"; value: number };

/** Rounds to the nearest `step`, e.g. roundTo(203.5, 2.5) -> 205. */
function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function format(value: number): string {
  if (value <= 0) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

/**
 * Bumps the number at the front of a Load cell and keeps whatever follows it,
 * so "225 lb" -> "230 lb" and "90kg" -> "92.5kg". Cells with no leading number
 * ("bar", "BW", "band", "") are returned untouched.
 */
export function applyBump(load: string, bump: Bump): string {
  if (bump.mode === "same") return load;

  const match = load.trim().match(/^(\d+(?:[.,]\d+)?)(.*)$/);
  if (!match) return load;

  const current = Number(match[1].replace(",", "."));
  const suffix = match[2];
  if (!Number.isFinite(current) || current === 0) return load;

  const next =
    bump.mode === "add"
      ? current + bump.value
      : roundTo(current * (1 + bump.value / 100), 2.5);

  if (next <= 0) return load;
  return `${format(next)}${suffix}`;
}

/**
 * "Week 4" -> "Week 5", "W4" -> "W5", "Block 2 Week 12" -> "Block 2 Week 13".
 * The last number in the label is the one that advances. Returns null when
 * there is no number to advance.
 */
export function nextWeekLabel(label: string): string | null {
  const matches = [...label.matchAll(/\d+/g)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const start = last.index!;
  const bumped = String(Number(last[0]) + 1);
  return label.slice(0, start) + bumped + label.slice(start + last[0].length);
}
