import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COACH_COOKIE, isCoachToken } from "./auth";
import { clientCookie, isClientToken } from "./client-auth";
import { getPasscodeHash } from "./db";

/**
 * Is this browser allowed to see /c/<clientId>?
 *
 * Three ways through, in order: the client has no passcode (the app's original
 * tap-through, and still what everyone starts as); the coach cookie, because he
 * opens the client view on his own phone to write notes and must not be locked
 * out by someone else's passcode; or the client's own cookie.
 */
export async function clientAllowed(clientId: string): Promise<boolean> {
  const stored = await getPasscodeHash(clientId);
  if (!stored) return true;

  const jar = await cookies();
  if (await isCoachToken(jar.get(COACH_COOKIE)?.value)) return true;
  return isClientToken(jar.get(clientCookie(clientId))?.value, stored);
}

/**
 * First line of every /c/ page, and of every write action a client page can
 * fire. The pages redirect and the actions throw, but both go through the same
 * check — a redirect in a page is UI, exactly like the coach middleware, and
 * the actions are the actual gate. Same rule as requireCoach(); do not drop it
 * from an action because "the page already redirects".
 */
export async function requireClientView(clientId: string): Promise<void> {
  if (!(await clientAllowed(clientId))) redirect(`/c/${clientId}/enter`);
}

export async function requireClientAction(clientId: string): Promise<void> {
  if (!(await clientAllowed(clientId))) throw new Error("Not authorised.");
}
