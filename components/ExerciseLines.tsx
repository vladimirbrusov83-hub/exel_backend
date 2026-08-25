import { setLines } from "@/lib/types";

/**
 * The set lines, exactly as the coach typed them, read-only. Monospace so
 * numbers line up down the column.
 *
 * `doneSets` is optional: pass it and the ticked lines get a ✓ and grey out,
 * leave it off and this renders exactly what it always did. The history page
 * shows the ticks this way; only `SetChecks` on the workout page can change one.
 *
 * The line numbering comes from `setLines` and nowhere else — the tick on line 3
 * has to mean the same line here as it does there.
 */
export default function ExerciseLines({
  freeText, doneSets = [],
}: { freeText: string; doneSets?: number[] }) {
  if (!freeText.trim()) return null;
  const done = new Set(doneSets);

  return (
    <ul className="mt-0.5 font-mono text-sm text-neutral-500">
      {setLines(freeText).map((line) =>
        line.text.trim() === "" ? (
          <li key={line.index} aria-hidden className="h-2" />
        ) : (
          <li key={line.index} className="flex items-baseline gap-1.5">
            <span aria-hidden className={done.has(line.index) ? "text-green-600" : "text-transparent"}>
              ✓
            </span>
            <span className={done.has(line.index) ? "text-neutral-400 line-through" : ""}>
              {line.text}
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
