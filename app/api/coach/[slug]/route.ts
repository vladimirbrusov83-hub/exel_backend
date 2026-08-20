import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isCoachSlug, isPrefix } from "@/lib/clients";
import { appendProgramRows, getProgram, programTag } from "@/lib/sheets";
import { applyBump, nextWeekLabel, type Bump } from "@/lib/bump";

// A whole training week is well under this; the cap just stops a malformed
// Sheet from turning into thousands of appended rows.
const MAX_ROWS = 400;

function parseBump(raw: unknown): Bump | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { mode, value } = raw as Record<string, unknown>;
  if (mode === "same") return { mode: "same" };
  if ((mode === "add" || mode === "percent") && typeof value === "number") {
    if (!Number.isFinite(value) || Math.abs(value) > 500) return null;
    return { mode, value };
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isCoachSlug(slug)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const { client, sourceWeek, bump: rawBump } = (body ?? {}) as Record<string, unknown>;
  const bump = parseBump(rawBump);
  if (!isPrefix(client) || typeof sourceWeek !== "string" || !bump) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  try {
    // Read the Sheet rather than trusting whatever the browser posted, so the
    // new week is built from what is actually in the program right now.
    const { weeks } = await getProgram(client);
    const source = weeks.find((w) => w.week === sourceWeek);
    if (!source) {
      return NextResponse.json(
        { ok: false, error: `No week called "${sourceWeek}"` },
        { status: 400 }
      );
    }

    const target = nextWeekLabel(sourceWeek);
    if (!target) {
      return NextResponse.json(
        { ok: false, error: `Can't work out what comes after "${sourceWeek}" — the week needs a number in it` },
        { status: 400 }
      );
    }
    if (weeks.some((w) => w.week === target)) {
      return NextResponse.json(
        { ok: false, error: `${target} already exists. Delete or rename it first.` },
        { status: 409 }
      );
    }

    const rows: string[][] = [];
    for (const day of source.days) {
      for (const movement of day.movements) {
        for (const set of movement.sets) {
          rows.push([
            target,
            day.day,
            movement.exercise,
            set.set,
            set.reps,
            applyBump(set.load, bump),
            set.rpe,
          ]);
        }
      }
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: `${sourceWeek} has no exercises to copy` },
        { status: 400 }
      );
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { ok: false, error: `That week has ${rows.length} rows, more than the ${MAX_ROWS} limit` },
        { status: 400 }
      );
    }

    await appendProgramRows(client, rows);
    revalidateTag(programTag(client)); // so the client sees the new week immediately
    return NextResponse.json({ ok: true, week: target, rows: rows.length });
  } catch (err) {
    console.error("build week failed", err);
    return NextResponse.json({ ok: false, error: "Could not write to the Sheet" }, { status: 502 });
  }
}
