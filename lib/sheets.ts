import { google } from "googleapis";
import { unstable_cache } from "next/cache";
import { shapeProgram, spliceDayRows, type Program } from "./program";

export type { Program, Week, Day, Movement, SetRow } from "./program";

function sheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY. Check .env.local (or the Vercel env vars)."
    );
  }
  const auth = new google.auth.JWT({
    email,
    // Env vars store the key with literal \n sequences; the signer needs real newlines.
    key: key.replace(/\\n/g, "\n"),
    // Full spreadsheets scope, not readonly: appending notes is a write.
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function sheetId() {
  const id = process.env.SHEET_ID;
  if (!id) throw new Error("Missing SHEET_ID. Check .env.local (or the Vercel env vars).");
  return id;
}

export const programTag = (prefix: string) => `program:${prefix}`;

/**
 * Program for one client, cached for 5 minutes. Both the page and
 * /api/program/[slug] call this, so they share one cache entry and the Sheets
 * API is hit at most once per client per 5 minutes. Built per prefix so each
 * client gets its own cache entry and its own invalidation tag.
 */
export function getProgram(prefix: string): Promise<Program> {
  return unstable_cache(
    async (): Promise<Program> => {
      const sheets = sheetsClient();
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId(),
        // Unbounded A:G — the program has 7 columns and no fixed length.
        range: `${prefix}_Program!A:G`,
      });
      const rows = res.data.values ?? [];
      return shapeProgram(rows.slice(1)); // drop the header row
    },
    ["program", prefix],
    { revalidate: 300, tags: [programTag(prefix)] }
  )();
}

/**
 * Replaces every row belonging to one week+day with `rows`, keeping the day in
 * the position it already occupied. Used by the day editor.
 *
 * Order matters: the overwrite happens first and the leftover tail is cleared
 * afterwards, so a failure between the two calls leaves stale extra rows rather
 * than an empty tab. Never clear first.
 */
export async function replaceDayRows(
  prefix: string,
  week: string,
  day: string,
  rows: string[][]
): Promise<{ replaced: number }> {
  const sheets = sheetsClient();
  const id = sheetId();
  const range = `${prefix}_Program!A:G`;

  const existing = await sheets.spreadsheets.values.get({ spreadsheetId: id, range });
  const body = (existing.data.values ?? []).slice(1); // row 1 is the header, never touched

  const spliced = spliceDayRows(body, week, day, rows);
  if (!spliced) throw new Error(`No rows found for ${week} / ${day}`);
  const { next, replaced } = spliced;

  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: `${prefix}_Program!A2:G${1 + next.length}`,
    valueInputOption: "RAW",
    requestBody: { values: next },
  });

  // Only now drop whatever the shorter list left behind.
  if (body.length > next.length) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: id,
      range: `${prefix}_Program!A${2 + next.length}:G${1 + body.length}`,
    });
  }

  return { replaced };
}

/** Appends rows to a client's Program tab. Rows are Week..RPE Target, 7 cells each. */
export async function appendProgramRows(
  prefix: string,
  rows: string[][]
): Promise<void> {
  const sheets = sheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: `${prefix}_Program!A:G`,
    // RAW so a load like "+5" or a note starting with "=" stays text.
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

/** Appends one note row (Timestamp | Week | Day | Note) to the client's Notes tab. */
export async function appendNote(
  prefix: string,
  week: string,
  day: string,
  note: string
): Promise<void> {
  const sheets = sheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId(),
    range: `${prefix}_Notes!A:D`,
    // RAW, not USER_ENTERED: a note starting with "=" or "+" must stay text,
    // not become a live formula in the Sheet.
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[new Date().toISOString(), week, day, note]] },
  });
}
