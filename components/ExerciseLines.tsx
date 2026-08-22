/**
 * The set lines, exactly as the coach typed them. Monospace so numbers line up
 * down the column; `whitespace-pre-line` so one line per set survives.
 */
export default function ExerciseLines({ freeText }: { freeText: string }) {
  if (!freeText.trim()) return null;
  return (
    <p className="mt-0.5 whitespace-pre-line font-mono text-sm text-neutral-500">
      {freeText}
    </p>
  );
}
