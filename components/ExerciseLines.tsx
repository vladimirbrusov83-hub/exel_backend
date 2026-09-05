import { setLines } from "@/lib/types";

/**
 * The set lines, exactly as the coach typed them, read-only. Monospace so
 * numbers line up down the column.
 *
 * `doneSets` and `ratings` are both optional: pass them and the ticked lines get
 * a ✓ and grey out and the rated ones carry their RIR/RPE chip, leave them off
 * and this renders exactly what it always did. The history page shows both this
 * way; only `SetChecks` on the workout page can change either.
 *
 * The line numbering comes from `setLines` and nowhere else — the tick and the
 * rating on line 3 have to mean the same line here as they do there.
 */
export default function ExerciseLines({
  freeText, doneSets = [], ratings = {},
}: { freeText: string; doneSets?: number[]; ratings?: Record<string, string> }) {
  if (!freeText.trim()) return null;
  const done = new Set(doneSets);

  return (
    <ul className="mt-1 font-mono text-sm text-white/65">
      {setLines(freeText).map((line) =>
        line.text.trim() === "" ? (
          <li key={line.index} aria-hidden className="h-2" />
        ) : (
          <li key={line.index} className="flex items-baseline gap-1.5">
            <span
              aria-hidden
              className={`flex size-3.5 shrink-0 items-center justify-center self-center rounded-full text-[0.55rem] font-bold ${
                done.has(line.index) ? "bg-green-400 text-neutral-900" : "border border-white/25"
              }`}
            >
              {done.has(line.index) ? "✓" : ""}
            </span>
            <span className={done.has(line.index) ? "text-white/40 line-through" : ""}>
              {line.text}
            </span>
            {/* Never struck through with the line: the rating is what the
                client said about the set, not part of the set as written. */}
            {ratings[String(line.index)] && (
              <span className="rounded px-1 py-0.5 text-[0.7rem] font-semibold leading-none text-blue-200">
                {ratings[String(line.index)]}
              </span>
            )}
          </li>
        ),
      )}
    </ul>
  );
}
