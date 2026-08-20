# ClientProgram — working notes

Next.js 15 App Router, TypeScript, Tailwind 4, `googleapis`. One Google Sheet is the whole
backend. Two clients read their program at `/program/<slug>` and leave a note per day;
`/coach/<COACH_SLUG>` has three tabs: Calendar (two weeks side by side), Write a day
(shorthand box), Copy a day. See `README.md` for the user-facing side.

GitHub: `vladimirbrusov83-hub/exel_backend` (public). Deploy = commit + push; Vercel picks
it up in ~30s. Never run `vercel --prod`.

## Scope — read this before adding anything

Vladimir does not want automation here. A load-bumping feature (+2.5 / +5 / −10% deload
when building next week) was built and then removed at his request, and wiring in
`~/Documents/CoachBrain/` was explicitly declined. He writes programs by hand, copies a
day, and edits the numbers himself.

So: no progression logic, no suggested loads, no analytics, no auth system, no database.
If a change seems to need any of those, ask first.

## The Sheet contract

Four tabs, exact names: `Client1_Program`, `Client1_Notes`, `Client2_Program`,
`Client2_Notes`. Program is 7 columns (Week, Day, Exercise, Sets, Reps, Load, RPE Target);
Notes is 4 (Timestamp, Week, Day, Note). Row 1 is headers and is dropped on read.

Reads use unbounded ranges (`A:G`, `A:D`) — the program has no fixed length.

## Traps that have already bitten

- **`GOOGLE_PRIVATE_KEY` arrives with literal `\n`.** `lib/sheets.ts` does
  `.replace(/\\n/g, "\n")`. Without it, auth dies with a cryptic
  `error:1E08010C:DECODER routines::unsupported`.
- **Scope must be `.../auth/spreadsheets`**, not `spreadsheets.readonly` — the app writes.
- **`values.get` omits trailing empty cells.** A row with a blank RPE comes back with 6
  entries, not 7. `shapeProgram` pads to `PROGRAM_COLS` before any index access. Don't
  remove that.
- **Every write uses `valueInputOption: "RAW"`.** With `USER_ENTERED`, a note or load
  starting with `=` or `+` becomes a live formula in the Sheet.
- **Weeks sort numerically**, on the first number in the label — `"Week 10"` sorts before
  `"Week 2"` as a string. Days and exercises keep Sheet order.
- **Tailwind's `group-open:` variant generates no rule for `[open]` on `<details>`.** The
  week disclosure arrow rotates via plain CSS in `globals.css` (`.chev`). Don't "simplify"
  it back to a Tailwind variant.
- **Next redacts server error messages in production.** That's why the Sheets failure is
  caught inside `app/program/[slug]/page.tsx` and rendered by `LoadFailed` with the real
  message, instead of being left to `error.tsx`. Keep it that way — the real message is
  how a setup problem gets diagnosed.

## The shorthand parser

`lib/parse.ts` turns the way Vladimir actually writes a day —

```
Day 2
A) Squat
95*10
115*6
```

— into rows. It is pure and has no imports, so test it directly with
`node --experimental-strip-types`. Two rules are load-bearing:

- **The reps side of a set line must start with a digit.** Without that, "Leg extensions"
  parses as load "Leg e" x reps "tensions".
- **An `x` jammed against a letter is not a separator.** That's what keeps "Box squat" and
  "Box 10" from being read as sets, while "135x10" and "102.5kg x 5" both are. The gap
  between the load and the separator is captured for exactly this check.

If you touch the regex, run the existing cases: `Box squat`, `Leg extensions`,
`Cross body extension`, `b*10`, `100 kg * 5`, `BW*45s`, `25*12-15`, `80kg×8 rpe 7.5`.

The browser and the server both parse — the preview is client-side, and the route re-parses
the raw text rather than trusting rows from the browser.

## The calendar

`Calendar.tsx` shows `SPAN = 2` weeks as columns, paging in steps of `SPAN` from the end of
the list. There are **no dates in the Sheet** — days are named `Day 1`, `Day 2` — so a
weekday grid is not possible and was not what was asked for. Columns are a fixed 17rem and
scroll horizontally inside their own container on a phone; they share the width from `sm` up.
The page body itself must never scroll horizontally.

## Caching

`getProgram(prefix)` in `lib/sheets.ts` wraps the read in `unstable_cache` — 5 minute
revalidate, keyed per prefix, tagged `program:<prefix>`. Both the program page and
`/api/program/[slug]` call it, so they share one entry per client.

`/program/[slug]` and `/coach/[slug]` are `force-dynamic` **on purpose**. Without it the
rendered page also lands in the full route cache, which stacks on top of the data cache and
may never expire. That data cache is meant to be the only cache layer.

The coach write calls `revalidateTag(programTag(client))` so the client sees a copied day
immediately.

## Security model

The slug *is* the credential — there is no login. Therefore:

- Unknown slug → `notFound()` / 404. Never a message that confirms the slug space exists.
- `robots: { index: false, follow: false }` is set once in `app/layout.tsx`, covering
  everything.
- `/api/notes` caps the note at 500 chars and validates that the posted week/day actually
  exists in that client's program, rather than trusting the body.
- `/api/coach` accepts **only** `COACH_SLUG`; a client slug gets a 404 there.
- Row caps (`MAX_ROWS`) on writes so a malformed Sheet can't append thousands of rows.

Keep these when touching the routes. Anyone holding a slug can POST.

## Testing without credentials

There is no test runner. Two techniques used so far, both worth repeating:

**Pure logic** — `lib/program.ts` and `lib/weeks.ts` have no imports, so Node runs them
directly:

```bash
node --experimental-strip-types /tmp/test.mts   # importing lib/program.ts by absolute path
```

**End-to-end without a Sheet** — temporarily patch `lib/sheets.ts` to return fixture rows
when `MOCK_SHEET === "1"`, and to `console.log("WOULD_WRITE", rows)` instead of appending.
Then `npm run build && PORT=3011 MOCK_SHEET=1 npm start`, exercise it with `curl`, and read
the logged rows to confirm the exact payload. **Revert the patch before committing** —
`grep -c MOCK lib/sheets.ts` should print `0`.

Screenshots at 375px use the cached Playwright browser:

```bash
"$HOME/Library/Caches/ms-playwright/chromium-1228/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
```

driven by `playwright-core` from a scratch dir. Check
`document.documentElement.scrollWidth - clientWidth === 0` and that tap targets are ≥44px.

## Conventions

- `.env.local` holds the real values and is gitignored; `.env.example` lists the names only.
  Never write a key or slug into a committed file.
- Adding a client: a tab pair in the Sheet, a `CLIENT_N_SLUG` env var, one line in
  `lib/clients.ts` (`PREFIXES` and the `CLIENTS` map).
- Keep dependencies to Next, React, Tailwind and `googleapis`.
- Mobile first — clients read this in the gym on a phone. Check 375px before calling any UI
  change done.
