/**
 * The coach gate. One shared passcode, no accounts.
 *
 * The cookie does not contain the passcode — it contains an HMAC of a fixed
 * string keyed by it. So the cookie is useless anywhere else, and changing
 * COACH_PASSCODE invalidates every session that was open.
 *
 * Web Crypto only (no node:crypto), because middleware runs on the edge.
 */

export const COACH_COOKIE = "cp_coach";
const STAMP = "coach-v1";

function passcode(): string {
  const p = process.env.COACH_PASSCODE;
  if (!p) throw new Error("COACH_PASSCODE is not set — see .env.example");
  return p;
}

async function tokenFor(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(STAMP));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The cookie value to set after a correct passcode. */
export function coachToken(): Promise<string> {
  return tokenFor(passcode());
}

/** Constant-time compare, so the token can't be guessed a byte at a time. */
function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isCoachToken(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  return sameToken(value, await coachToken());
}

export async function checkPasscode(entered: string): Promise<boolean> {
  const expected = passcode();
  return sameToken(await tokenFor(entered), await tokenFor(expected));
}
