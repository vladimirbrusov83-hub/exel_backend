import { cookies } from "next/headers";
import { COACH_COOKIE, isCoachToken } from "./auth";

/**
 * First line of every coach server action.
 *
 * `middleware.ts` already redirects unauthenticated browsers away from /coach,
 * but middleware only guards navigation. The client pages are deliberately
 * public, so hiding the coach UI is not a gate — this is. Do not remove it on
 * the grounds that the middleware "already does that".
 */
export async function requireCoach(): Promise<void> {
  const jar = await cookies();
  if (!(await isCoachToken(jar.get(COACH_COOKIE)?.value))) {
    throw new Error("Not authorised.");
  }
}
