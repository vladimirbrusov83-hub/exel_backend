# ClientProgram

Shows each coaching client their training program on their phone and lets them leave a
short note after each session. **One Google Sheet is the entire backend** — no database,
no login, no accounts. Each client gets a private, unguessable URL.

| Page | Who opens it |
|---|---|
| `/program/<client-slug>` | your client — their program, week by week, with a note box under each day |
| `/coach/<coach-slug>` | you — copy any training day into a new week or day |

Access control is the slug and nothing else. Send each link privately and treat it like a
password. The pages are `noindex`, so search engines won't find them. An unknown slug
returns a plain 404 that gives nothing away.

---

## Setting it up

Three parts, once. Roughly 15 minutes.

### 1. The Google Sheet

Create one Sheet with four tabs, named **exactly** like this — capital C, underscore,
capital P and N:

| Tab | Row 1 headers |
|---|---|
| `Client1_Program` | Week, Day, Exercise, Sets, Reps, Load, RPE Target |
| `Client1_Notes` | Timestamp, Week, Day, Note |
| `Client2_Program` | Week, Day, Exercise, Sets, Reps, Load, RPE Target |
| `Client2_Notes` | Timestamp, Week, Day, Note |

Write one day into `Client1_Program` to start with. You never type in the Notes tabs —
the app appends to those.

The Sheet ID is the long string in the Sheet's URL between `/d/` and `/edit`. You'll need
it in part 3.

### 2. Google Cloud

This creates a robot account that reads and writes your Sheet on the app's behalf.

1. <https://console.cloud.google.com> → create a project, call it `ClientProgram`.
2. **APIs & Services → Library** → search *Google Sheets API* → **Enable**.
3. **APIs & Services → Credentials → Create Credentials → Service account.**
   Name it `sheets-writer`. Skip the optional role and access steps → **Done**.
4. Click the new service account → **Keys → Add Key → Create new key → JSON**.
   A `.json` file downloads. That is the only copy — keep it somewhere safe, and never
   inside this repo.
5. Open that JSON and copy the `client_email` value. It looks like
   `sheets-writer@clientprogram-xxxxx.iam.gserviceaccount.com`.
6. Open your Google Sheet → **Share** → paste that email → set it to **Editor** → Send.

Step 6 is the one people forget. Enabling the API in step 2 does not give the robot
account access to your Sheet; sharing the Sheet with it does. Both steps are required.

### 3. Environment variables

Fill in `.env.local` for local use, and add the same six in
**Vercel → Project → Settings → Environment Variables** for the live site.

| Variable | Where it comes from |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON key |
| `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON key — paste it exactly as it appears, keep the `\n` sequences, wrap the whole thing in double quotes |
| `SHEET_ID` | the id from the Sheet's URL |
| `CLIENT_1_SLUG` | a long random string — becomes client 1's link |
| `CLIENT_2_SLUG` | the same, for client 2 |
| `COACH_SLUG` | the same again — this one is *your* page, keep it to yourself |

Generate a slug with `openssl rand -hex 12`.

The private key genuinely contains literal `\n` characters when it lives in an env var,
and the app turns them back into real newlines. Don't "fix" them by hand.

### Run it

```bash
npm run dev                       # then open /program/<CLIENT_1_SLUG>
npm run build && npm start        # production build
```

If the page says *"Couldn't load your program"*, the message underneath tells you which
of the three parts above isn't finished yet.

---

## Writing a program

One exercise per row. Repeat the week and day on every row:

```
Week 1 | Day 1 — Lower | Back squat        | 4 | 5    | 100 kg | 7
Week 1 | Day 1 — Lower | Romanian deadlift | 3 | 8    | 80 kg  | 8
Week 1 | Day 1 — Lower | Plank             | 3 | 45 s | BW     |
Week 1 | Day 2 — Upper | Bench press       | 5 | 5    | 70 kg  | 7
```

Blank cells are fine. Blank rows are skipped. Weeks are ordered by the number in them, so
`Week 10` correctly follows `Week 9`, and days appear in whatever order you put them in.

### Writing every set out

Repeat the exercise name on consecutive rows and use the **Sets** column as the set
number. Those rows merge into one block:

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

Both styles can sit in the same program — main lifts set by set, accessories on one line.
Only *consecutive* rows group, so the same lift programmed again later in the session stays
its own block. Leave the Sets column blank and the sets are just numbered 1, 2, 3.

### Copying a day

Open `/coach/<COACH_SLUG>`. Pick a client, pick a day to copy, say which week it goes into
and what to call it, and hit **Copy day**. The whole day lands in the Program tab exactly
as written; you then change the numbers in the Sheet.

- **Into week** lists your existing weeks plus *New week…*, prefilled with the next number
  up. **Called** is prefilled with the name of the day you copied. So "same day, next week"
  is two taps.
- Nothing is recalculated. Loads, sets, reps and RPE copy across untouched, including
  set-by-set blocks and cells like `BW` or `bar`.
- If that week already has a day with that name it refuses rather than writing duplicates.
  Pick a different name.
- Your client sees it straight away.

### Notes from clients

Each day on the client's page has a note box — how the session felt, actual RPE, whatever
they want to tell you, up to 500 characters. Saving appends a row to their `_Notes` tab
with a timestamp. Notes are not shown back to the client, and never appear in the app;
read them in the Sheet.

---

## Good to know

**Changes take up to 5 minutes.** Program data is cached for 5 minutes so the app isn't
hammering the Google API. Edit the Sheet and give it a moment. A day copied from the coach
page appears immediately.

**Adding a third client.** Add a `Client3_Program` / `Client3_Notes` pair of tabs, a
`CLIENT_3_SLUG` env var, and one line in `lib/clients.ts`. Nothing else changes.

**Deploying.** `git push` — Vercel picks it up in about 30 seconds. Environment variables
have to be set in the Vercel dashboard separately from `.env.local`.

**If a client's link stops working.** Check that `.env.local` (or Vercel) still has their
slug, and that the Sheet is still shared with the service-account email.

---

## For developers

```
app/program/[slug]/page.tsx      the client's program page (Server Component)
app/program/[slug]/NoteForm.tsx  the note textarea and Save button
app/program/[slug]/error.tsx     last-resort error screen
app/coach/[slug]/page.tsx        the coach page shell
app/coach/[slug]/CoachPanel.tsx  client / source day / destination pickers and preview
app/api/program/[slug]/route.ts  GET  program as JSON
app/api/notes/[slug]/route.ts    POST a note
app/api/coach/[slug]/route.ts    POST a day copy
lib/sheets.ts                    every Google Sheets call, plus the 5-minute cache
lib/program.ts                   pure Sheet rows -> Week / Day / Movement shaping
lib/clients.ts                   slug -> tab prefix, and the coach slug check
lib/weeks.ts                     "Week 4" -> "Week 5"
```

Next.js 15 (App Router), TypeScript, Tailwind 4, `googleapis`. No database client, no
state library, no test runner. `CLAUDE.md` has the working notes and the traps.
