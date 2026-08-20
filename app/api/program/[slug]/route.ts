import { NextResponse } from "next/server";
import { prefixForSlug } from "@/lib/clients";
import { getProgram } from "@/lib/sheets";

// Shares getProgram's 5-minute cache with the page, so this doesn't add
// Sheets API traffic. Mostly here for debugging.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const prefix = prefixForSlug(slug);
  if (!prefix) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    return NextResponse.json(await getProgram(prefix));
  } catch (err) {
    console.error("getProgram failed", err);
    return NextResponse.json({ error: "Could not read program" }, { status: 502 });
  }
}
