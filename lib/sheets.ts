import { google } from "googleapis";
import { unstable_cache } from "next/cache";
import { shapeProgram, type Program } from "./program";

export type { Program, Week, Day, Exercise } from "./program";

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

/**
 * Program for one client, cached for 5 minutes. Both the page and
 * /api/program/[slug] call this, so they share one cache entry and the Sheets
 * API is hit at most once per client per 5 minutes.
 */
export const getProgram = unstable_cache(
  async (prefix: string): Promise<Program> => {
    const sheets = sheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId(),
      // Unbounded A:G — the program has 7 columns and no fixed length.
      range: `${prefix}_Program!A:G`,
    });
    const rows = res.data.values ?? [];
    return shapeProgram(rows.slice(1)); // drop the header row
  },
  ["program"],
  { revalidate: 300 }
);

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
