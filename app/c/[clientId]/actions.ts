"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "@/lib/coach-guard";
import { saveNote as saveNoteRow, setDone, setSetDone } from "@/lib/db";

/**
 * Client-side writes. Deliberately unauthenticated — there is no login in this
 * app — but narrow: a note is capped, and the only other thing a client can
 * change is the done flag on their own workout.
 */
const MAX_NOTE = 2000;

export async function saveNote(
  workoutId: string, exerciseId: string | null, body: string,
): Promise<void> {
  // Hardcoded 'client'. The author is never a parameter — a browser that could
  // pass "coach" here could write in the coach's colour.
  await saveNoteRow(workoutId, exerciseId, "client", body.slice(0, MAX_NOTE));
}

/**
 * The coach writing on the client page from his phone. Same box, different
 * author, and requireCoach() is the gate — /c/* is not in the middleware
 * matcher, so the cookie check that renders the amber box is UI only.
 */
export async function saveCoachNote(
  workoutId: string, exerciseId: string | null, body: string,
): Promise<void> {
  await requireCoach();
  await saveNoteRow(workoutId, exerciseId, "coach", body.slice(0, MAX_NOTE));
  // So the note is already there when he opens that day in the laptop editor.
  revalidatePath("/coach");
}

/**
 * Ticking one set line off, from the client page. Public like `saveNote`, and
 * narrow in the same way: it can only flip a boolean on a line that exists —
 * `setSetDone` range-checks the line against the exercise's own text.
 *
 * There is no coach version of this. Notes are split by author because the two
 * of them say different things about the same lift; a set is simply done or it
 * is not, so both of them tap the same box.
 *
 * The revalidate is not optional. The button is optimistic, and React drops an
 * optimistic value once the transition settles — without fresh server data to
 * land on, every tick would visibly flip back.
 */
export async function toggleSet(
  clientId: string, workoutId: string, exerciseId: string, line: number, done: boolean,
): Promise<void> {
  await setSetDone(workoutId, exerciseId, line, done);
  revalidatePath(`/c/${clientId}/w/${workoutId}`);
}

export async function markDone(
  clientId: string, workoutId: string, done: boolean,
): Promise<void> {
  await setDone(workoutId, done);
  revalidatePath(`/c/${clientId}`);
  revalidatePath(`/c/${clientId}/w/${workoutId}`);
}
