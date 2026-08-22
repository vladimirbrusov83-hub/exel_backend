"use server";

import { revalidatePath } from "next/cache";
import { saveClientNote, setDone } from "@/lib/db";

/**
 * Client-side writes. Deliberately unauthenticated — there is no login in this
 * app — but narrow: a note is capped, and the only other thing a client can
 * change is the done flag on their own workout.
 */
const MAX_NOTE = 2000;

export async function saveNote(
  workoutId: string, exerciseId: string | null, body: string,
): Promise<void> {
  await saveClientNote(workoutId, exerciseId, body.slice(0, MAX_NOTE));
}

export async function markDone(
  clientId: string, workoutId: string, done: boolean,
): Promise<void> {
  await setDone(workoutId, done);
  revalidatePath(`/c/${clientId}`);
  revalidatePath(`/c/${clientId}/w/${workoutId}`);
}
