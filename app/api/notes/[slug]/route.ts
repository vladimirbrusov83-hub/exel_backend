import { NextResponse } from "next/server";
import { prefixForSlug } from "@/lib/clients";
import { appendNote, getProgram } from "@/lib/sheets";

const MAX_NOTE = 500;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const prefix = prefixForSlug(slug);
  if (!prefix) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const { week, day, note } = (body ?? {}) as Record<string, unknown>;
  if (typeof week !== "string" || typeof day !== "string" || typeof note !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const text = note.trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "Note is empty" }, { status: 400 });
  }
  if (text.length > MAX_NOTE) {
    return NextResponse.json(
      { ok: false, error: `Note is too long (max ${MAX_NOTE} characters)` },
      { status: 400 }
    );
  }

  try {
    // There is no login, so anyone holding the slug can post. Only accept a
    // week/day that actually exists in this client's program.
    const { weeks } = await getProgram(prefix);
    const known = weeks.some((w) => w.week === week && w.days.some((d) => d.day === day));
    if (!known) {
      return NextResponse.json({ ok: false, error: "Unknown week or day" }, { status: 400 });
    }

    await appendNote(prefix, week, day, text);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("appendNote failed", err);
    return NextResponse.json({ ok: false, error: "Could not save note" }, { status: 502 });
  }
}
