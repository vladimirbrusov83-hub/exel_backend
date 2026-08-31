"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COACH_COOKIE, checkPasscode, coachToken } from "@/lib/auth";
import { requireCoach } from "@/lib/coach-guard";
import {
  addClient, copyWorkout, deleteWorkout, moveWorkout, renameClient, saveWorkout,
} from "@/lib/db";
import type { WorkoutDraft } from "@/lib/types";

const YEAR = 60 * 60 * 24 * 365;

export async function login(_prev: string | null, form: FormData): Promise<string | null> {
  const entered = String(form.get("passcode") ?? "");
  if (!(await checkPasscode(entered))) return "Wrong passcode.";

  (await cookies()).set(COACH_COOKIE, await coachToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: YEAR,
  });
  redirect("/coach");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(COACH_COOKIE);
  redirect("/coach/login");
}

/* Every action below starts with requireCoach(). The middleware only guards
   navigation; these are the actual gate on writing. */

export async function saveWorkoutAction(draft: WorkoutDraft): Promise<string> {
  await requireCoach();
  const id = await saveWorkout(draft);
  revalidatePath("/coach");
  revalidatePath(`/c/${draft.clientId}`);
  return id;
}

export async function deleteWorkoutAction(id: string): Promise<void> {
  await requireCoach();
  await deleteWorkout(id);
  revalidatePath("/coach");
}

export async function moveWorkoutAction(
  id: string, date: string, clientId: string,
): Promise<void> {
  await requireCoach();
  await moveWorkout(id, date, clientId);
  revalidatePath("/coach");
}

export async function copyWorkoutAction(
  id: string, date: string, clientId: string,
): Promise<void> {
  await requireCoach();
  await copyWorkout(id, date, clientId);
  revalidatePath("/coach");
}

export async function addClientAction(name: string): Promise<string | null> {
  await requireCoach();
  const clean = name.trim().slice(0, 60);
  if (!clean) return null;
  const id = await addClient(clean);
  revalidatePath("/coach");
  revalidatePath("/");
  return id;
}

export async function renameClientAction(id: string, name: string): Promise<void> {
  await requireCoach();
  const clean = name.trim().slice(0, 60);
  if (clean) await renameClient(id, clean);
  revalidatePath("/coach");
  revalidatePath("/");
}
