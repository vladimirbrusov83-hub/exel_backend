import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isCoachSlug, isPrefix } from "@/lib/clients";
import { getProgram, programTag, replaceDayRows } from "@/lib/sheets";
import { parseDay, toProgramRows } from "@/lib/parse";

const MAX_ROWS = 200;
const MAX_TEXT = 8000;

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
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ ok: false, error: "That's too much text" }, { status: 400 });
  }

  const parsed = parseDay(text);
  const rows = toProgramRows(parsed, week, day);
  if (rows.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "No sets found. To remove the day entirely, delete its rows in the Sheet.",
      },
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
    // Confirm the day exists before rewriting anything.
    const { weeks } = await getProgram(client);
    const exists = weeks.find((w) => w.week === week)?.days.some((d) => d.day === day);
    if (!exists) {
      return NextResponse.json(
        { ok: false, error: `Can't find ${day} in ${week}` },
        { status: 404 }
      );
    }

    const { replaced } = await replaceDayRows(client, week, day, rows);
    revalidateTag(programTag(client));
    return NextResponse.json({
      ok: true,
      week,
      day,
      rows: rows.length,
      replaced,
      warnings: parsed.warnings,
    });
  } catch (err) {
    console.error("edit day failed", err);
    return NextResponse.json({ ok: false, error: "Could not write to the Sheet" }, { status: 502 });
  }
}
