/**
 * "Week 4" -> "Week 5", "W4" -> "W5", "Block 2 Week 12" -> "Block 2 Week 13".
 * The last number in the label is the one that advances. Returns null when
 * there is no number to advance. Used only to suggest a name for a new week.
 */
export function nextWeekLabel(label: string): string | null {
  const matches = [...label.matchAll(/\d+/g)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const start = last.index!;
  const bumped = String(Number(last[0]) + 1);
  return label.slice(0, start) + bumped + label.slice(start + last[0].length);
}
