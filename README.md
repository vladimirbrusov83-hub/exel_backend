# ClientProgram

You write the training. Two people open a link, tap their name, and see this week.
No accounts, no passwords, no app to install.

- **`/`** — two big name buttons. Send this link to both of them; it's the only one they need.
- **`/c/<their id>`** — this week's sessions. `‹ ›` moves a week, **History** goes back
  through everything you've written for them.
- **`/c/<their id>/w/<workout>`** — the session itself: your notes at the top, then each
  exercise with its sets. They can leave a note under any exercise and one for the whole
  session, and tap **Mark as done**. Notes save when they tap out of the box.
- **`/coach`** — your calendar. Behind one passcode you type once.

## Setting it up

1. Make a Postgres database at [neon.tech](https://console.neon.tech) (the free plan is
   plenty) and copy the **pooled** connection string.
2. Create `.env.local` in this folder:

   ```
   DATABASE_URL=postgresql://…            # from Neon
   COACH_PASSCODE=whatever-you-like       # what you type at /coach/login
   ```

3. `npm install`
4. `npm run db:push` — creates the tables and adds two people called "Client 1" and
   "Client 2". Double-click a name on the coach page to rename them.
5. `npm run dev`, open http://localhost:3000.

For the live site, put the same two values into the Vercel project's Environment Variables
**before** pushing, or the deploy will build and then error.

## Using the coach page

**On a computer** you get a month-at-a-time calendar. Click any day to write a session;
click an existing one to edit it. `‹ ›` jump a month, **Today** brings you back.

**On a phone** you get one week at a time with an **+ Add** button on every day — you can
write a whole session from the gym floor.

### Writing a session

Give it a name (or leave it — it'll be called "Tuesday Session"), add a note if you want
one, then add exercises. Each exercise is a name box with a free text area under it where
you type the sets however you write them:

```
95*10
115*6
135*10
```

**Nothing is treated as a number.** `b*10`, `BW*45s`, `100 kg * 5`, `25*12-15` all come
back exactly as you typed them.

### Supersets

Between every two exercises there's a **⚡ Superset** button. Tap it and the two are
joined: they turn blue and are relabelled `A1)` and `A2)`. Tap a third one below to make it
`A3)`. Tap again to unlink.

The letters look after themselves — you never type them.

**Escape and ⌘/Ctrl+Enter both save and close.** There is no cancel — if you open a session
and change something, it's saved. Emptying the editor won't delete a session; use Delete.

### Copying a session

Tap **📋** on any session, then tap the day you want it on. **↕️** moves it instead of
copying.

You can copy to the *other person*: tap 📋, then tap their name at the top, then tap a day.
The copy arrives clean — not marked done, and without the first person's notes.

### Seeing what they wrote

Their notes show up right on the calendar block with a 👤, and in full when you open the
session. You don't have to go looking.

## Deploying

`git add . && git commit && git push`. Vercel picks it up in about 30 seconds.
