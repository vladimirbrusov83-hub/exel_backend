"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  MAX_PASSCODE, MIN_PASSCODE, clientCookie, clientToken, hashPasscode, verifyPasscode,
} from "@/lib/client-auth";
import { requireClientAction } from "@/lib/client-guard";
import { requireCoach } from "@/lib/coach-guard";
import {
  getPasscodeHash, getWorkoutClientId, saveNote as saveNoteRow, setDone,
  setPasscodeHash, setSetDone,
} from "@/lib/db";

/**
 * Client-side writes. These used to be deliberately unauthenticated, because
 * the app had no login at all. It still has none by default — a client with no
 * passcode taps straight through as before — but once one is set these are the
 * gate, not the redirect in the page. Same rule as requireCoach().
 *
 * Every one of them works out whose workout it is from the workout itself
 * rather than trusting the clientId the browser sent, so the guard cannot be
 * stepped around by passing someone else's id.
 */
const MAX_NOTE = 2000;
const YEAR = 60 * 60 * 24 * 365;

/** Guard a write by the workout it targets. Returns the real owner. */
async function guardWorkout(workoutId: string): Promise<string> {
  const owner = await getWorkoutClientId(workoutId);
  if (!owner) throw new Error("No such workout.");
  await requireClientAction(owner);
  return owner;
}

export async function saveNote(
  workoutId: string, exerciseId: string | null, body: string,
): Promise<void> {
  await guardWorkout(workoutId);
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
  await guardWorkout(workoutId);
  await setSetDone(workoutId, exerciseId, line, done);
  revalidatePath(`/c/${clientId}/w/${workoutId}`);
}

export async function markDone(
  clientId: string, workoutId: string, done: boolean,
): Promise<void> {
  await guardWorkout(workoutId);
  await setDone(workoutId, done);
  revalidatePath(`/c/${clientId}`);
  revalidatePath(`/c/${clientId}/w/${workoutId}`);
}

/* ------------------------------------------------------------- passcodes */

/**
 * Typing the passcode on /c/<id>/enter. The cookie is derived from the stored
 * hash, never from the passcode, so it is worthless anywhere else and dies the
 * moment the passcode is changed.
 */
export async function enterPasscodeAction(
  clientId: string, _prev: string | null, form: FormData,
): Promise<string | null> {
  const stored = await getPasscodeHash(clientId);
  if (!stored) redirect(`/c/${clientId}`); // removed while they were typing

  const entered = String(form.get("passcode") ?? "");
  if (!(await verifyPasscode(entered, stored))) return "Wrong passcode.";

  await setCookie(clientId, stored);
  redirect(`/c/${clientId}`);
}

async function setCookie(clientId: string, storedHash: string): Promise<void> {
  (await cookies()).set(clientCookie(clientId), await clientToken(storedHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: YEAR,
  });
}

/**
 * Setting a passcode for the first time, or changing one.
 *
 * Changing needs the current passcode; setting the first one needs nothing,
 * because anyone standing at that page already tapped straight through — that
 * is what having no passcode means. If it goes wrong the coach's 🔒 clears it.
 *
 * The cookie is rewritten at the end. It is derived from the stored hash, so
 * without this the client would be signed out of their own phone by the act of
 * changing their own passcode.
 */
export async function setPasscodeAction(
  clientId: string, _prev: string | null, form: FormData,
): Promise<string | null> {
  await requireClientAction(clientId);

  const stored = await getPasscodeHash(clientId);
  if (stored) {
    const current = String(form.get("current") ?? "");
    if (!(await verifyPasscode(current, stored))) return "That is not the current passcode.";
  }

  const next = String(form.get("passcode") ?? "").trim();
  if (next.length < MIN_PASSCODE) return `At least ${MIN_PASSCODE} characters.`;
  if (next.length > MAX_PASSCODE) return `At most ${MAX_PASSCODE} characters.`;
  if (next !== String(form.get("confirm") ?? "").trim()) return "The two do not match.";

  const hash = await hashPasscode(next);
  await setPasscodeHash(clientId, hash);
  await setCookie(clientId, hash);
  revalidatePath("/");
  revalidatePath("/coach");
  redirect(`/c/${clientId}`);
}

/** Removing it, back to tapping through. Needs the current passcode. */
export async function removePasscodeAction(
  clientId: string, _prev: string | null, form: FormData,
): Promise<string | null> {
  await requireClientAction(clientId);

  const stored = await getPasscodeHash(clientId);
  if (stored) {
    const current = String(form.get("current") ?? "");
    if (!(await verifyPasscode(current, stored))) return "That is not the current passcode.";
    await setPasscodeHash(clientId, null);
    (await cookies()).delete(clientCookie(clientId));
  }
  revalidatePath("/");
  revalidatePath("/coach");
  redirect(`/c/${clientId}`);
}
