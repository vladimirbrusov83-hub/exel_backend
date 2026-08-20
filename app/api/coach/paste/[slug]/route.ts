import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isCoachSlug, isPrefix } from "@/lib/clients";
import { appendProgramRows, getProgram, programTag } from "@/lib/sheets";
import { parseDay, toProgramRows } from "@/lib/parse";

const MAX_ROWS = 200;
const MAX_TEXT = 8000;
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
  const { client, week, day, text } = (body ?? {}) as Record<string, unknown>;
  if (
    !isPrefix(client) ||
    typeof week !== "string" ||
    typeof day !== "string" ||
    typeof text !== "string"
  ) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const weekLabel = week.trim();
  const dayLabel = day.trim();
  if (!weekLabel || !dayLabel) {
    return NextResponse.json(
      { ok: false, error: "Give the week and day a name" },
      { status: 400 }
    );
  }
  if (weekLabel.length > MAX_LABEL || dayLabel.length > MAX_LABEL) {
    return NextResponse.json({ ok: false, error: "That name is too long" }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ ok: false, error: "That's too much text" }, { status: 400 });
  }

  // Parsed again here rather than trusting rows from the browser.
  const parsed = parseDay(text);
  const rows = toProgramRows(parsed, weekLabel, dayLabel);
  if (rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nothing to add — no sets found in that text" },
      { status: 400 }
    );
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { ok: false, error: `That's ${rows.length} sets, more than the ${MAX_ROWS} limit` },
      { status: 400 }
    );
  }

  try {
    const { weeks } = await getProgram(client);
    const clash = weeks.find((w) => w.week === weekLabel)?.days.some((d) => d.day === dayLabel);
    if (clash) {
      return NextResponse.json(
        { ok: false, error: `${weekLabel} already has a ${dayLabel}. Pick a different name.` },
        { status: 409 }
      );
    }

    await appendProgramRows(client, rows);
    revalidateTag(programTag(client)); // so the client sees it immediately
    return NextResponse.json({
      ok: true,
      week: weekLabel,
      day: dayLabel,
      rows: rows.length,
      exercises: parsed.exercises.length,
      warnings: parsed.warnings,
    });
  } catch (err) {
    console.error("paste day failed", err);
    return NextResponse.json({ ok: false, error: "Could not write to the Sheet" }, { status: 502 });
  }
}
