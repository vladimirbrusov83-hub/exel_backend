# ClientProgram — working notes

Next.js 15 App Router, TypeScript, Tailwind 4, Neon Postgres. **No login anywhere.**
Two people pick their own name at `/` and read the week; the coach writes programs at
`/coach`, behind one shared passcode.

GitHub: `vladimirbrusov83-hub/exel_backend` (public). Deploy = commit + push; Vercel picks
it up in ~30s. Never run `vercel --prod`.

Rebuilt in August 2026 off a Google Sheet backend. `git log` before that commit has the
Sheets version.

## Scope — read this before adding anything

Vladimir does not want automation here. A load-bumping feature (+2.5 / +5 / −10% deload)
was built and then removed at his request, and wiring in `~/Documents/CoachBrain/` was
explicitly declined. He writes programs by hand, copies a day, and edits the numbers
himself.

So: no progression logic, no suggested loads, no analytics, no accounts. A real database
is exactly where that temptation comes back. It stays out.

## Setup

```
DATABASE_URL=      # Neon pooled connection string
COACH_PASSCODE=    # typed once at /coach/login
```

`npm run db:push` applies `db/schema.sql`. It is idempotent — safe to re-run — and seeds
two clients on an empty database. Rename them by double-clicking a name pill on `/coach`.

## The schema, and why it looks like that

Four tables: `clients` → `workouts` → `exercises`, plus `client_notes`.

- **An exercise is a name plus one block of free text**, one line per set, stored exactly
  as typed. There is no `sets` table and nothing is ever parsed into numbers, because real
  programs contain `b*10`, `BW*45s`, `100 kg * 5` and `25*12-15`. A previous version of
  this rebuild had load/reps/rpe columns; Vladimir asked for the free-text box instead.
- **Order is explicit** — `position` on `exercises`, `date` on `workouts`. In the old
  Sheet it was emergent from row order, which does not survive a move to SQL.
- **Exercise names are free text.** No catalog, no FK, no normalisation. "Bench press" and
  "bench press" being different rows is fine.
- **The same lift twice in one session is two rows**, distinguished by `position`. Never
  `GROUP BY name`.
- **A note has an `author`** — `'client'` or `'coach'`. The coach can open the client
  page on his phone and write on the same exercise the client wrote on, so there is one
  row per (workout, exercise, author). The author is decided server-side: the public
  `saveNote` hardcodes `'client'`, and `saveCoachNote` starts with `requireCoach()`. It is
  never a parameter a browser can set. The unique indexes include `author`, and
  `db/schema.sql` **drops the two pre-author indexes by name first** — `CREATE UNIQUE INDEX
  IF NOT EXISTS` matches on the index name, so without the drops an existing database keeps
  the old two-column index and the coach's first note on an exercise the client had already
  written on fails with a unique violation.
- **`client_notes.exercise_id` is the key, not a position index.** CoachSpace keys its
  notes `"0_0"` by position, so reordering an exercise silently moves someone's note onto
  the wrong lift. Do not reintroduce that.
- **Two unique indexes on `client_notes`, not one.** `NULL <> NULL` in Postgres, so a plain
  `UNIQUE (workout_id, exercise_id)` does not stop the overall note (`exercise_id IS NULL`)
  being inserted twice. The partial index `client_notes_overall_author_uniq` is what
  actually prevents duplicate overall notes.

## Supersets and labels

`exercises.link_prev` means "supersetted with the exercise above me". A run of linked
exercises is one group. **The link is stored, not a group id** — with group ids, reordering
or deleting leaves dangling groups; with links it cannot.

`exerciseLabels()` in `lib/types.ts` turns that into what is displayed: a lone exercise is
`A)`, a group of two is `A1)` `A2)`, and group members render blue. Labels are derived at
render time and never stored, so they renumber themselves.

Two invariants: the first exercise can never have `link_prev` (enforced in both the editor
and `saveWorkout`), and deleting an exercise clears `linkPrev` on the one after it, so a
removal can't silently join two lifts that were never supersetted.

Note the shorthand parser is gone. It existed for about an hour between the load/reps/rpe
editor and this one; `git log` has it if a paste-a-whole-day box is ever wanted.

## Saving a workout is a diff, not a rewrite

`saveWorkout` in `lib/db.ts` is the one function that can destroy data.

Exercises that already exist are **UPDATEd in place and keep their id**; new ones are
inserted; ids no longer present are deleted. Client notes hang off `exercise_id`, so a
delete-and-reinsert of the exercise list would cascade away every note the client wrote.

Existing exercises are matched **by name**, case-insensitively — position would be wrong
the moment an exercise is inserted above another, and matching leftovers by position would
silently move someone's note onto a different lift. The honest trade-off: rename an
exercise and its note goes with the old name.

Ids are generated with `crypto.randomUUID()` in JS rather than by the database, so the
whole save fits in one `sql.transaction([...])` with no round-trips in between.

## Two colours, everywhere

Blue is the client, amber is the coach. It is already the calendar cell's 👤 / 📝 pair, and
it now runs through the client workout page, the client history page and the editor. The
coach's boxes on the client page use `.field-coach` rather than Tailwind's
`border-amber-400 bg-amber-50`: `.field` is plain CSS declared after the Tailwind import, so
at equal specificity it wins and the utilities would do nothing.

`saveNote` in `lib/db.ts` is the second function here that can destroy data, after
`saveWorkout`. Its DELETE is scoped by `author` — without that, the client blurring their
note wipes the coach's note on the same exercise.

## Previous sessions in the editor

The editor takes a `history` prop: this person's last six days before the one being edited,
newest first, sliced out of the workouts `CoachBoard` already has. No extra query.

On a laptop it is a panel beside the popover; below `xl` that panel is hidden and on the
phone sheet it folds into a closed `<details>` instead — 21rem of editor plus 16rem of
history does not fit next to a narrow calendar column. `align` still decides which edge the
pair hangs off, and the row reverses with it so the editor stays against that edge and the
history always grows towards the middle of the screen.

`xl` and not `lg`, from a measurement: at 1024 the Thursday column pushed the panel 17px
past the calendar scroller. **Measure that overflow on the scroller, not on
`documentElement`** — the scroller is `overflow-y-auto`, which makes the x axis `auto` too,
so it absorbs the overflow and the document reports a clean 0 either way. Checked in all
seven columns at 1024 and 1280.

**It is display-only, and stays that way.** Past days as written, notes as written. No
"last time vs this time", no deltas, no suggested loads — a history panel sitting next to
the load fields is exactly where the automation Vladimir removed would creep back in.

## The coach gate

`COACH_PASSCODE` → `lib/auth.ts` HMACs a fixed string with it; that HMAC is the cookie.
The cookie never contains the passcode, and changing the passcode logs everyone out.

`middleware.ts` guards navigation to `/coach/*`. **That is not the security boundary** —
the client pages are deliberately public, so a hidden UI protects nothing. Every coach
server action calls `requireCoach()` (`lib/coach-guard.ts`) as its first line. Keep it
there even though the middleware "already does that".

Web Crypto only in `lib/auth.ts`, no `node:crypto` — middleware runs on the edge.

## Dates

`lib/dates.ts` works in `"YYYY-MM-DD"` local strings and never in `Date` objects across a
boundary. The trap: `new Date("2026-08-21")` parses as **UTC** midnight, so west of
Greenwich it renders as the 20th. Every conversion goes through local Y/M/D parts;
`toISOString()` appears nowhere. `today()` is a function, not a module constant, so it
cannot go stale across midnight in a long-lived tab.

SQL reads cast `date::text` for the same reason — otherwise the driver hands back a Date
and the day shifts.

## Deliberate UI choices

- **Escape saves and exits the editor; it does not cancel.** Same reflex as CoachSpace.
  It means there is no discard path — a mistyped load is committed by the reflex key.
  Changing this is a product decision, not a bug fix.
- **The editor is a popover anchored in its own day cell**, orange-bordered, like
  CoachSpace — and fullscreen on a phone. Two things keep it usable that CoachSpace gets
  wrong: `align` flips it to the right edge in the Fri/Sat/Sun columns (CoachSpace styles
  for this flip but never sets the attribute that triggers it, so its editor runs
  off-screen three days a week), and it scrolls itself into view when the day sits near
  the bottom of the calendar.
- **Only one calendar is mounted at a time** — `isDesktop` from `matchMedia`, not a CSS
  `hidden md:block` pair. Two mounted trees would mean two editors both listening for
  Escape, and one keypress would save the workout twice.
- **A day click is ignored while an editor is open.** Otherwise clicking another day swaps
  the editor out and silently throws away whatever was typed.
- **One box per exercise, and the sets are free text.** A name field, then a textarea where
  the sets are typed however he likes — `95*10`, `b*10`, `BW*45s`. There are deliberately
  no load / reps / RPE fields; he asked for them to go.
- **A ⚡ Superset divider sits between every pair of exercises**, blue when on. This is
  CoachSpace's model and he asked for it by screenshot.
- **The calendar cell shows the whole session**, exercise names and set lines, not a
  summary. That is the point of the calendar for him — on the *desktop* calendar.
- **The phone week list is a preview, not the session.** One row per session: title, the
  note markers, and the exercise names on a line or two (`line-clamp-2`), no set lines.
  Tap it to read and edit the whole thing. The layout around it is squeezed for the same
  reason — the day label is a gutter beside the row rather than a heading above it, and
  `+` only takes a row of its own on an empty day. All of that together is what puts seven
  days on a 375×780 screen at once; measured at exactly 651px of list in 651px of space.
  Undo any one of them and the week no longer fits.
- **You can create a workout from a phone.** CoachSpace hides its calendar on mobile and so
  can only *edit* existing workouts there. The mobile coach view here is a week column with
  a `+ Add` on every day. Don't regress this.
- **Copy/move works across clients.** In copy mode the name pills stay live: pick the other
  person, then tap a day. A copy lands with `done = false` and none of the other person's
  notes.
- **Delete is a plain confirm**, not CoachSpace's 5-second undo — that timer loses the
  first delete if you delete twice inside 5s, and skips the delete entirely if you close
  the tab.

## Styling

Tailwind 4, CSS-first: no `tailwind.config.*`, the theme lives in `@theme inline` in
`app/globals.css`.

**The app is white, always.** There is no dark mode and no `dark:` utility anywhere — a
device set to dark mode still gets the white theme. `color-scheme: light` in `:root` is
what stops the browser painting form controls, scrollbars and the caret dark underneath.
Don't reintroduce `@media (prefers-color-scheme: dark)`.

- **`.field`** is used by every input, textarea and select. It is plain CSS against the
  theme tokens rather than `dark:` utility pairs, specifically so text can never end up the
  same colour as the box it sits in.
- **`.chev`** rotates the `<details>` disclosure arrow in plain CSS. Tailwind's
  `group-open:` variant generates no rule for `[open]` on `<details>`. Don't "simplify" it.
- `body` uses `var(--font-sans)`. It said `Arial` for a long time, which meant Geist was
  downloaded on every page load and never displayed.

## Mobile first

Clients read this in the gym on a phone, and the coach programs on one too. Check 375px
before calling any UI change done: tap targets ≥44px (`min-h-11` / `size-11`), and
`document.documentElement.scrollWidth - clientWidth === 0`.

Screenshots use the cached Playwright browser:

```
"$HOME/Library/Caches/ms-playwright/chromium-1228/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
```

driven by `playwright-core` from a scratch dir.

## Conventions

- `.env.local` holds the real values and is gitignored; `.env.example` lists names only.
  Never write a connection string or passcode into a committed file.
- Adding a third person: one row in `clients`. Nothing in the code names a client.
- Keep dependencies to Next, React, Tailwind and `@neondatabase/serverless`. No ORM — the
  schema is five tables and raw SQL is less machinery than the app.
