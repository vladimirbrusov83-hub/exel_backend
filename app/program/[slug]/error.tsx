"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-xl font-bold">Couldn&apos;t load your program</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Try again in a minute. If it keeps happening, let your coach know.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 min-h-11 rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        Try again
      </button>
      {/* Production redacts error.message, so surface the digest instead — it
          matches the entry in `vercel logs`. */}
      {error.digest && (
        <p className="mt-8 font-mono text-xs text-neutral-400">ref {error.digest}</p>
      )}
    </main>
  );
}
