import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isCoachSlug, isPrefix } from "@/lib/clients";
import { appendProgramRows, getProgram, programTag } from "@/lib/sheets";

// A single training day is well under this; the cap just stops a malformed
// Sheet from turning into thousands of appended rows.
const MAX_ROWS = 200;
const MAX_LABEL = 100;

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
  const { client, sourceWeek, sourceDay, targetWeek, targetDay } = (body ??
    {}) as Record<string, unknown>;

  const labels = [sourceWeek, sourceDay, targetWeek, targetDay];
  if (!isPrefix(client) || labels.some((l) => typeof l !== "string")) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const [srcWeek, srcDay, dstWeek, dstDay] = (labels as string[]).map((l) => l.trim());
  if (!dstWeek || !dstDay) {
    return NextResponse.json(
      { ok: false, error: "Give the new week and day a name" },
      { status: 400 }
    );
  }
  if (dstWeek.length > MAX_LABEL || dstDay.length > MAX_LABEL) {
    return NextResponse.json({ ok: false, error: "That name is too long" }, { status: 400 });
  }

  try {
    // Read the Sheet rather than trusting what the browser posted, so the copy
    // is made from what is actually in the program right now.
    const { weeks } = await getProgram(client);
    const source = weeks.find((w) => w.week === srcWeek)?.days.find((d) => d.day === srcDay);
    if (!source) {
      return NextResponse.json(
        { ok: false, error: `Can't find ${srcDay} in ${srcWeek}` },
        { status: 400 }
      );
    }

    const clash = weeks.find((w) => w.week === dstWeek)?.days.some((d) => d.day === dstDay);
    if (clash) {
      return NextResponse.json(
        { ok: false, error: `${dstWeek} already has a ${dstDay}. Pick a different name.` },
        { status: 409 }
      );
    }

    // Copied exactly as written — you change the numbers in the Sheet after.
    const rows: string[][] = [];
    for (const movement of source.movements) {
      for (const set of movement.sets) {
        rows.push([dstWeek, dstDay, movement.exercise, set.set, set.reps, set.load, set.rpe]);
      }
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: `${srcDay} has no exercises to copy` },
        { status: 400 }
      );
    }
    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { ok: false, error: `That day has ${rows.length} rows, more than the ${MAX_ROWS} limit` },
        { status: 400 }
      );
    }

    await appendProgramRows(client, rows);
    revalidateTag(programTag(client)); // so the client sees it immediately
    return NextResponse.json({ ok: true, week: dstWeek, day: dstDay, rows: rows.length });
  } catch (err) {
    console.error("copy day failed", err);
    return NextResponse.json({ ok: false, error: "Could not write to the Sheet" }, { status: 502 });
  }
}
