# ClientProgram

A Next.js app that shows each coaching client their training program and lets them
leave a short note per training day. **One Google Sheet is the entire backend** — no
database, no login. Each client gets a private, unguessable URL.

```
/program/<client-slug>     the client's program, grouped Week -> Day, with a note box per day
/coach/<coach-slug>        your page: copy a week into the next one with the loads bumped
/api/program/<slug>  GET   the same program data as JSON (handy for debugging)
/api/notes/<slug>    POST  { week, day, note } -> appends a row to that client's Notes tab
/api/coach/<slug>    POST  { client, sourceWeek, bump } -> appends next week's rows
```

Access control is the slug and nothing else. Send the link privately; treat it like a
password. The pages are `noindex` so search engines won't find them.

---

## The Google Sheet

One Sheet, four tabs, named **exactly** like this (capital C, underscore, capital P/N):

| Tab | Row 1 headers |
|---|---|
| `Client1_Program` | Week, Day, Exercise, Sets, Reps, Load, RPE Target |
| `Client1_Notes` | Timestamp, Week, Day, Note |
| `Client2_Program` | Week, Day, Exercise, Sets, Reps, Load, RPE Target |
| `Client2_Notes` | Timestamp, Week, Day, Note |

Fill the Program tabs one exercise per row, repeating the Week and Day in every row:

```
Week 1 | Day 1 — Lower | Back squat        | 4 | 5 | 225 lb | 7
Week 1 | Day 1 — Lower | Romanian deadlift | 3 | 8 | 185 lb | 8
Week 1 | Day 2 — Upper | Bench press       | 5 | 5 | 155 lb | 7
```

### Writing every set out

Repeat the exercise name on consecutive rows and use the **Sets** column as the set
number. The app merges them into one block:

```
Week 1 | Day 1 — Upper | Bench press  | 1 |  6 | 50 kg  | 6
Week 1 | Day 1 — Upper | Bench press  | 2 |  5 | 60 kg  | 7
Week 1 | Day 1 — Upper | Bench press  | 3 | 10 | 90 kg  | 8
Week 1 | Day 1 — Upper | Bench press  | 4 |  6 | 100 kg | 9
Week 1 | Day 1 — Upper | Lat pulldown | 3 | 12 | 60 kg  | 8
```

reads on the phone as:

```
Bench press
  1   50 kg × 6    RPE 6
  2   60 kg × 5    RPE 7
  3   90 kg × 10   RPE 8
  4  100 kg × 6    RPE 9

Lat pulldown
  3 × 12   Load: 60 kg   RPE 8
```

Both styles can sit in the same program — write main lifts set by set and accessories
on one line. Only *consecutive* rows group, so the same lift programmed again later in
the session stays its own block.

Weeks are ordered by the number in them, so `Week 10` correctly follows `Week 9`. Days
appear in the order they appear in the Sheet. Blank cells are fine. Blank rows are skipped.
You never touch the Notes tabs — the app appends to them.

## Google Cloud setup (do this once)

1. <https://console.cloud.google.com> → create a project, call it `ClientProgram`.
2. **APIs & Services → Library** → search *Google Sheets API* → **Enable**.
3. **APIs & Services → Credentials → Create Credentials → Service account.**
   Name it `sheets-writer`. Skip the optional role and access steps → **Done**.
4. Click the new service account → **Keys → Add Key → Create new key → JSON**.
   A `.json` file downloads. That's the only copy — keep it somewhere safe, out of this repo.
5. Open that JSON and copy the `client_email` value. It looks like
   `sheets-writer@clientprogram-xxxxx.iam.gserviceaccount.com`.
6. Open the Google Sheet → **Share** → paste that email → set it to **Editor** → Send.
   *Step 2 does not do this for you. Both steps are required, and this is the one people forget.*
7. The Sheet ID is the long string in the Sheet's URL between `/d/` and `/edit`.

## Environment variables

Local: fill in `.env.local` (already created, with slugs pre-generated).
Production: add the same five in **Vercel → Project → Settings → Environment Variables**.

| Variable | Where it comes from |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON key |
| `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON key — paste it as-is, keep the `\n` sequences, wrap in double quotes |
| `SHEET_ID` | the id from the Sheet URL |
| `CLIENT_1_SLUG` | random string, e.g. `openssl rand -hex 12` → client 1's URL |
| `CLIENT_2_SLUG` | same, for client 2 |
| `COACH_SLUG` | same again — this one is *your* page at `/coach/<slug>`, keep it to yourself |

The private key really does contain literal `\n` characters when stored in an env var;
the app converts them back to real newlines. Don't "fix" them by hand.

## Run it

```bash
npm run dev            # http://localhost:3000/program/<CLIENT_1_SLUG>
npm run build && npm start
```

An unknown slug returns a plain 404 — it never hints that other slugs exist.

## Building next week

Open `/coach/<COACH_SLUG>` — your page, not a client's. Pick a client, pick the week to
copy from, pick a load change, and it shows you every row before and after. Hit **Write**
and the whole week lands in the Program tab; you then fine-tune numbers in the Sheet
instead of retyping the structure.

- **Same / +2.5 / +5** add to the number in the Load cell and keep the units, so `100 kg`
  becomes `105 kg`. **Deload −10%** multiplies and rounds to the nearest 2.5.
- Cells with no number (`BW`, `bar`, `blue band`, empty) are copied unchanged.
- Sets, reps and RPE are copied as-is, including set-by-set blocks.
- The new week's name is the old one with its number advanced: `Week 4` becomes `Week 5`.
  If that week already exists it refuses rather than writing duplicates — delete or rename
  the existing one first.
- The client sees the new week immediately; their 5-minute cache is cleared on write.

## How caching works

`getProgram()` in `lib/sheets.ts` is wrapped in a 5-minute cache, and the page is
`force-dynamic` so that cache is the only one. Edit the Sheet and the change shows up
within 5 minutes. Notes are written straight through — never cached.

## Adding a third client

Add a `Client3_Program` / `Client3_Notes` pair of tabs, a `CLIENT_3_SLUG` env var, and one
line in `lib/clients.ts`. Nothing else changes.

## Files

```
app/program/[slug]/page.tsx      the program page (Server Component)
app/program/[slug]/NoteForm.tsx  the note textarea + Save button
app/program/[slug]/error.tsx     last-resort error screen
app/api/program/[slug]/route.ts  GET program as JSON
app/api/notes/[slug]/route.ts    POST a note (validates length + that the week/day exists)
lib/sheets.ts                    all Google Sheets access, plus the 5-minute cache
lib/program.ts                   pure row -> Week/Day/Exercise shaping
lib/clients.ts                   slug -> tab prefix map
```
