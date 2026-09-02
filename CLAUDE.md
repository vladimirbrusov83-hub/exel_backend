# ClientProgram — working notes

Next.js 15 App Router, TypeScript, Tailwind 4, Neon Postgres. **No login by default.**
Clients pick their own name at `/` and read the week; the coach writes programs at
`/coach`, behind one shared passcode. A client may set an optional passcode of their own —
see "The client gate" — but nobody has to, and a client without one taps straight through
exactly as the app always worked.

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

Ticking sets off (below) is the one thing the app records about what happened. It is a
checkbox the two of them look at, not an input to anything.

## Setup

```
DATABASE_URL=      # Neon pooled connection string
COACH_PASSCODE=    # typed once at /coach/login
```

`npm run db:push` applies `db/schema.sql`. It is idempotent — safe to re-run — and seeds
two clients on an empty database. The name pills on `/coach` are the whole client
manager: double-click one to rename, `+` to add someone, `×` to delete whoever is
selected along with every session of theirs, and `🔒` clears that client's own passcode
when they forget it. `+`, `×` and `🔒` are laptop-only, and the last
remaining client cannot be deleted — an empty `clients` table leaves no way back into
the app except `npm run db:push`.

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
- **`exercises.done_sets` is the one place a position index survives**, because a set has
  no id to hang anything on. See "Ticking a set off" below for the rule that keeps it
  honest.
- **Two unique indexes on `client_notes`, not one.** `NULL <> NULL` in Postgres, so a plain
  `UNIQUE (workout_id, exercise_id)` does not stop the overall note (`exercise_id IS NULL`)
  being inserted twice. The partial index `client_notes_overall_author_uniq` is what
  actually prevents duplicate overall notes.

## Ticking a set off

Each set line on the client workout page has a box in front of it. Tap it and that set is
done: green tick, struck through, greyed. Both of them tap the same box — `SetChecks` is
on the page the client reads in the gym, which is also the page the coach opens on his
phone to write notes.

**A tick is not split by author** the way a note is. The two of them say different things
about a lift, so a note needs an author; a set is done or it is not.

**A set is identified by its line number**, 0-based, stored in `exercises.done_sets`.
`setLines()` in `lib/types.ts` is the only definition of what a line is — the server
range-checks against it, `SetChecks` renders through it, `ExerciseLines` renders through
it. Two definitions of "line 3" means a tick that lands on a different set on one screen
than on another. **Blank lines keep their number** and render as a gap for the same
reason: skip them and everything below shifts.

That is a position key, which is exactly what `client_notes` refuses to be. What keeps it
from becoming the CoachSpace `"0_0"` bug is the rule in `saveWorkout`: an exercise keeps
its ticks only while the **number of lines** stays the same. Fixing `95*10` to `100*10`
keeps them; adding or deleting a set line empties `done_sets` for that exercise, because
otherwise every tick below the new line slides onto the wrong set. Vladimir chose that
over the stricter "any edit clears" — a typo fix should not wipe a client's session.
Renaming an exercise takes the INSERT path with a fresh id, so its ticks go the same way
its notes do.

Ticks are display only, in both directions. They appear on the client workout page and,
read-only, on the client history page. They are deliberately **not** in the coach editor,
the `PastDay` history panel or the desktop calendar cell: "what got done" sitting next to
the load fields is where progression logic starts arguing for itself, which is the line
this project draws.

The toggle is optimistic — it is tapped between sets on gym wifi and a box that waits for
a round-trip feels broken. `useOptimistic` layers over the server value, so `toggleSet`
**must** keep its `revalidatePath`: React drops the optimistic value once the transition
settles, and with no fresh server data to land on every tick visibly flips back.

`setSetDone` re-reads the exercise and range-checks the line before writing, because the
action is public like `saveNote`. Both of its writes are a single statement, so two taps
landing together cannot read the same array and overwrite each other.

## Supersets and labels

`exercises.link_prev` means "supersetted with the exercise above me". A run of linked
exercises is one group. **The link is stored, not a group id** — with group ids, reordering
or deleting leaves dangling groups; with links it cannot.

`exerciseGroups()` in `lib/types.ts` does the splitting, and `exerciseLabels()` turns it
into what is displayed: a lone exercise is `A)`, a group of two is `A1)` `A2)`. Labels are
derived at render time and never stored, so they renumber themselves.

The client session page draws **one block per group**, so a superset pair sits in a single
card the way TrueCoach shows it — that is what `exerciseGroups()` is exported for. There is
one definition of what a pair is, or the block and the `A1)/A2)` numbering could disagree.
The old blue border and the `⚡ superset` caption are gone with it; the shared block says
it. Measured at 375px on a real session, grouping is slightly *shorter* than the two cards
it replaced (5+6 lines: 788px → 768px; 4+4: 604px → 580px), so the "a pair fits one
screen" constraint from commit 04aca61 still holds. Elsewhere — the editor, the calendar
cell — group members still render blue.

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

The editor takes a `history` prop: **every** earlier day of this person's, newest first,
sliced out of the workouts `CoachBoard` already has. No extra query. It was the last six
for a while, which quietly broke the point of the panel — the session worth reading while
writing a squat day is routinely older than six sessions.

The panel shows **one session at a time**, chosen by a `<select>` listing all of them.
Which one it opens on is `bestMatch()`: the most recent earlier session sharing the most
exercise names with what is currently typed, compared with the same `trim().toLowerCase()`
rule `saveWorkout` matches names with. An empty day has nothing to match on, so it falls
back to the same weekday — "last Monday" — and then to the most recent session.

The default follows what is typed until a session is picked by hand; after that the pick
holds. It is keyed on the joined list of non-empty names, so the panel moves when an
exercise is named, not while it is being spelled.

**Which session is shown is the only thing derived from what is being typed.** Past days
as written, notes as written. No "last time vs this time", no deltas, no suggested loads —
a history panel sitting next to the load fields is exactly where the automation Vladimir
removed would creep back in. Choosing what to look at is navigation; anything that reads
the two sessions against each other is not.

The picker's `<select>` swallows Escape (`stopPropagation` on its keydown). Escape is the
reflex that dismisses a native dropdown, and the editor's window handler reads Escape as
save-and-exit with no discard path — without this, dismissing the dropdown commits the day
and closes the editor. Verified: it does propagate in Chrome otherwise.

Every note on the shown day is rendered — the session note, both authors' per-exercise
notes and both overall notes — and each is prefixed `Client:` or `You:`. Blue and amber
alone are not enough to tell them apart at this size in this column.

On a laptop it is a panel beside the popover; below `xl` that panel is hidden and on the
phone sheet it folds into a closed `<details>` instead. `align` still decides which edge
the pair hangs off, and the row reverses with it so the editor stays against that edge and
the history always grows towards the middle of the screen.

`xl` and not `lg`, from a measurement: at 1024 the Thursday column pushed the panel past
the calendar scroller. **Measure that overflow on the scroller, not on
`documentElement`** — the scroller is `overflow-y-auto`, which makes the x axis `auto` too,
so it absorbs the overflow and the document reports a clean 0 either way. The panel is
`w-72`: one session at a time bought the room, and 21rem of editor plus 18rem of history
was re-measured at 0 overflow in all seven columns at 1280.

## The coach gate

`COACH_PASSCODE` → `lib/auth.ts` HMACs a fixed string with it; that HMAC is the cookie.
The cookie never contains the passcode, and changing the passcode logs everyone out.

`middleware.ts` guards navigation to `/coach/*`. **That is not the security boundary** —
the client pages are deliberately public, so a hidden UI protects nothing. Every coach
server action calls `requireCoach()` (`lib/coach-guard.ts`) as its first line. Keep it
there even though the middleware "already does that".

Web Crypto only in `lib/auth.ts`, no `node:crypto` — middleware runs on the edge.

## The client gate

Optional, one per client, chosen by the client on `/c/<id>/passcode`. `clients.passcode_hash`
NULL means no passcode, which is what everyone starts as and what the whole app assumed
before this existed.

`lib/client-auth.ts`, kept apart from `lib/auth.ts` so `middleware.ts`'s import graph stays
edge-thin. The stored value is `pbkdf2$<iterations>$<salt>$<hash>`; the passcode itself is
never stored and never leaves the server. The cookie is derived from the *stored hash*, not
from the passcode, so it is worthless anywhere else and every device is signed out the
moment the passcode changes — which is why `setPasscodeAction` re-issues the cookie after
saving, or the client would lock themselves out of their own phone by changing it.

Three ways past `clientAllowed()` (`lib/client-guard.ts`): no passcode set; the **coach**
cookie, because he opens the client view on his phone to write amber notes and must not be
locked out by someone else's passcode; or the client's own cookie.

Same rule as the coach gate, and it matters more here because there is no middleware at
all on `/c/*`: the `requireClientView()` redirect at the top of each page is UI, and
`requireClientAction()` inside the server actions is the boundary. Every client write
action resolves the owner from the *workout* (`guardWorkout`) rather than trusting the
`clientId` the browser sent it.

`clients.passcode_hash` is never selected into a `Client` — `getClients()` returns a
`hasPasscode` boolean instead, because `CoachBoard` is a client component and is handed the
whole array, so anything on that type is serialised into the browser. The hash has one
reader, `getPasscodeHash`.

Recovery is the 🔒 on the coach pill row: it clears a passcode, and cannot read one. There
is no email in this app, so that is the only route back for a client who forgets.

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
  summary. That is the point of the calendar for him — on the *desktop* calendar. It has
  no exercise count in its title row; see "Printing a session" for why the phone row
  keeps one and this does not.
- **The phone week list is a preview, not the session.** One row per session: title, the
  note markers, and the exercise names on a line or two (`line-clamp-2`), no set lines.
  Tap it to read and edit the whole thing. The layout around it is squeezed for the same
  reason — the day label is a gutter beside the row rather than a heading above it, and
  `+` only takes a row of its own on an empty day. All of that together is what puts seven
  days on a 375×780 screen at once; measured at exactly 651px of list in 651px of space.
  Undo any one of them and the week no longer fits.
- **On the phone, tapping a session opens the client's view of it**, not the editor —
  `/c/[clientId]/w/[workoutId]`, the page with the set boxes and both note columns. That
  is the page he actually wants in the gym. Editing is the ✏️ Edit link in that page's
  header, which only renders for `isCoach` and comes back as `/coach?c=…&edit=<id>`.
  `editWorkoutId` opens the editor on that day, and **closing it goes back to that page** —
  Save & close, Escape and ⌘⏎ all land back where he pressed Edit, not on the week list.
  Deleting is the exception: `remove()` clears the return path when the id matches, because
  the page it would go back to is about to 404. That return path is a ref and not state —
  `remove()` clears it after an `await`, and the `onClose` that runs next would still read
  a stale value. It fires **once**, behind a ref: `refresh()`
  after every save re-runs `CoachBoard` with `edit=` still in the URL, and without the
  guard closing the editor and saving would pop it straight back open. The desktop
  calendar's mount scroll also honours `edit=`, or the popover mounts off-screen when the
  session is not near today. The desktop cell still opens the editor on click — this is a
  phone change.
- **You can create a workout from a phone.** CoachSpace hides its calendar on mobile and so
  can only *edit* existing workouts there. The mobile coach view here is a week column with
  a `+ Add` on every day. Don't regress this.
- **Copy/move works across clients.** In copy mode the name pills stay live: pick the other
  person, then tap a day. A copy lands with `done = false` and none of the other person's
  notes.
- **Delete is a plain confirm**, not CoachSpace's 5-second undo — that timer loses the
  first delete if you delete twice inside 5s, and skips the delete entirely if you close
  the tab.

## Printing a session

🖨 on a workout row, laptop only, next to 📋 ↕️ 🗑. It prints **that one session**,
black on white — the program as written, to hand to a client.

The sheet is a separate `.print-only` block rendered as a sibling of the app shell, and
the shell itself is `.no-print`. Not a print stylesheet laid over the calendar: the app is
`h-dvh` around an `overflow-y-auto` scroller, which prints as one truncated screen
whatever colour it is painted. Its CSS lives at the bottom of `globals.css` and states
every colour outright — the Tailwind utilities in this app are all picked against
`#1b1c22` and come out pale grey on paper, or white on white. Nothing depends on a
background fill either, because backgrounds are off by default in the browser print
dialog.

The button only sets state; `window.print()` waits a frame for React to paint the sheet,
and `afterprint` unmounts it, or it would also come out of the next ⌘P.

What is on it: title, client name, date, the session note, and the exercises with their
set lines, labelled through `exerciseLabels` so `A1) A2)` on paper is the same pair it is
on screen. What is deliberately not: **ticks** — `done_sets` stays off every coach
surface, and this is a blank program — and the per-exercise and overall notes from either
author. The session note prints because it is written to be read on the day.

`break-inside: avoid` on each exercise, so a name never lands on one page with its sets on
the next. Verified by printing a 14-exercise session to PDF: three pages, no split.

Two things in `@media print` that look removable and are not. `:root { color-scheme:
light }` — the margin box outside `<html>` is canvas, painted by the browser from
`color-scheme`, and `html { background: #fff }` does not reach it. Take the line out and
every page comes back with a black 14mm border; that is a measured result, not a worry.
It does not contradict "the app is dark always", which is about the screen. And the shell
is `display: none` rather than restyled, because `h-dvh` around an `overflow-y-auto`
scroller prints as one truncated screen however it is coloured.

**The desktop calendar cell lost its `Nex` count** to make room for 🖨. The count is still
on the phone week row, where the exercise names are clamped to two lines and it is the
only way to know a six-exercise day is not the four that fit. The desktop cell writes the
whole session out below the title, so it never said anything there. It had to go: measured
at 1280, a 175px column with four buttons *and* the count truncates the title to nothing;
without the count the title is exactly the width it was before 🖨 existed.

## Styling

Tailwind 4, CSS-first: no `tailwind.config.*`, the theme lives in `@theme inline` in
`app/globals.css`.

**The app is dark, always.** Every page — the name picker, the week list, the session, the
history, and everything under `/coach`. There is no light theme, no `dark:` utility and no
`@media (prefers-color-scheme: dark)`: a device set to light still gets this. Don't add a
toggle and don't reintroduce the media query.

`color-scheme: dark` on `:root` is load-bearing. It is what makes the browser paint form
controls, scrollbars, the caret and the native `<select>` in the editor's history picker to
match — that `<select>` is the only native control left and it comes out dark for free.
This was pinned to `light` for a long time, because ee6ded0 had the browser painting
controls dark underneath a white app; with nothing white left, `dark` is the honest value.

**`.field` is still the armour, not `color-scheme`.** It sets `background-color` and
`color` explicitly against the theme tokens rather than relying on `dark:` utility pairs,
so text can never end up the same colour as the box it sits in. That is the actual fix from
ee6ded0 and it stays.

### Three surfaces, and don't invent a fourth

| token | value | what it is |
| --- | --- | --- |
| `--background` | `#1b1c22` | the page, and `body` |
| `--field-bg` | `#2c2e39` | anything typed into |
| `--surface` | `#4e4f60` | a card: the exercise blocks and the week rows |

`--surface` is exposed in `@theme` so a card can say `bg-surface`. The editor popover and
the desktop history panel use `bg-[var(--background)]`, which is why they followed the
theme with no edit.

### The shade mapping

Applied mechanically across every file, so a new colour should follow it rather than be
re-decided:

- `neutral-500/600` → `white/50` and `white/55`; `neutral-400` → `white/40`
- `neutral-200/300/400` borders → `white/12`, `white/20`, `white/30`
- `bg-neutral-50/100/200` → `bg-white/5`, `bg-white/8`, `bg-white/12`
- `blue-600/700/800` → `blue-300` / `blue-200`; `amber-700/800/900` → `amber-300` /
  `amber-200`; `green-600/700/800` → `green-300` / `green-400`; `red-700` → `red-300`
- the `-50` note backgrounds (`bg-blue-50`, `bg-amber-50`, `bg-green-50`) → a `/10` tint

Two things are inversions rather than shade swaps, and a blind swap gets them wrong:

- **A solid dark button becomes a solid white one** — `bg-neutral-900 text-white` →
  `bg-white text-neutral-900`. That is Save, the login button, the selected client pill and
  the today pill. The four `text-neutral-900` uses left in the app are all on one of these.
- **A done session is tinted, not filled** — `border-green-400/30 bg-green-400/10` in the
  calendar cell and the week row. Filling it turns a good week green wall to wall.

Blue-is-the-client / amber-is-the-coach survives unchanged; only the shades moved. The
editor popover's `#ea6c00` border and the copy-mode `bg-blue-600` banner were already
saturated enough to read on dark and are untouched.

### Checking a colour change

Screenshot at **both** 375×812 and 1280×900. `CoachBoard` mounts a different tree per size
from `matchMedia` — not a CSS `hidden md:block` pair — so a phone-only pass never renders
the desktop calendar at all. The states a happy-path pass misses: the editor popover, the
phone editor sheet, copy mode, the history `<select>`, and the two error strings
(`/coach/login` wrong passcode, `NoteBox` save failure) which need forcing to appear.

Known and pre-dating this: in the phone editor sheet the set-lines textarea
(`ml-10 w-[calc(100%-2.5rem)]`) renders a hair past the viewport, though the document
itself reports zero horizontal overflow.

## Vertical space on the session page

Asked for "10% more compact" and measured, not eyeballed: 1773px → 1599px of page at
375×812 on a real 5+6 / 4+4 session. Where it came from, because the obvious lever is the
wrong one:

**The 44px set row is not the slack.** Nineteen set lines at the `min-h-11` tap target are
836px — 47% of the page — and trimming them is what commit 04aca61 already ruled out. The
real slack was the note boxes and the padding around everything.

- **`NoteBox` has a `compact` prop**, on for the per-exercise boxes and off for the two
  session-level ones. It drops the visible label row (16px × four boxes for the client,
  eight for the coach) and moves the label to `aria-label`, with the placeholder carrying
  it on screen. The session-level boxes keep their labels: nothing above them says what
  they are, where a per-exercise box sits directly under the lift it belongs to.
- The save status moves to an absolutely-positioned chip over the field's top-right. It
  renders only while it is saying something — a couple of seconds after blur — so it never
  covers text anyone is reading.
- Padding: `pb-16` → `pb-8`, header `text-2xl` → `text-xl`, group `py-2.5` → `py-2`, group
  gap `2` → `1.5`, in-group gap `mt-4` → `mt-3`, session section `p-4` → `p-3`.

Re-measure before trimming further. The only lever left is the 44px row, which is his rule
to relax, not ours.

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
