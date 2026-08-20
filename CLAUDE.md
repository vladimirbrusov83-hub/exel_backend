# ClientProgram — working notes

Next.js 15 App Router, TypeScript, Tailwind 4, `googleapis`. One Google Sheet is the whole
backend. Two clients read their program at `/program/<slug>` and leave a note per day;
Vladimir copies days at `/coach/<COACH_SLUG>`. See `README.md` for the user-facing side.

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
