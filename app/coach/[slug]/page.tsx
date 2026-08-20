import { notFound } from "next/navigation";
import { isCoachSlug, PREFIXES } from "@/lib/clients";
import { getProgram } from "@/lib/sheets";
import type { Program } from "@/lib/sheets";
import CoachPanel from "./CoachPanel";

// Always fresh: the coach is looking at this right after editing the Sheet.
export const dynamic = "force-dynamic";

export type ClientProgram = { prefix: string; program: Program | null; error?: string };

export default async function CoachPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isCoachSlug(slug)) notFound();

  // One failing client shouldn't hide the other.
  const clients: ClientProgram[] = await Promise.all(
    PREFIXES.map(async (prefix) => {
      try {
        return { prefix, program: await getProgram(prefix) };
      } catch (err) {
        return {
          prefix,
          program: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Copy a day</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Duplicates a training day exactly as written. Change the numbers in the Sheet after.
      </p>
      <CoachPanel slug={slug} clients={clients} />
    </main>
  );
}
