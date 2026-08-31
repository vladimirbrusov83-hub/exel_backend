/**
 * The client gate — one optional passcode per person, chosen by them on their
 * own page. Separate from lib/auth.ts on purpose: that file is imported by
 * middleware.ts and has to stay edge-thin, and the two gates answer different
 * questions ("is this the coach?" vs "is this Ann?").
 *
 * A stored passcode is PBKDF2-SHA-256 over a random salt, written as one
 * string: `pbkdf2$<iterations>$<salt hex>$<hash hex>`. The plain passcode is
 * never stored and never leaves the server.
 *
 * Web Crypto only, same as lib/auth.ts.
 */

const ITERATIONS = 100_000;
const STAMP = "client-v1";

export const MIN_PASSCODE = 4;
export const MAX_PASSCODE = 32;

/** The cookie that remembers one client on one phone. */
export function clientCookie(clientId: string): string {
  return `cp_c_${clientId.replace(/-/g, "")}`;
}

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time compare, so a hash can't be guessed a byte at a time. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function derive(passcode: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passcode), "PBKDF2", false, ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    key, 256,
  );
}

/** What goes in `clients.passcode_hash`. */
export async function hashPasscode(passcode: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(passcode, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${hex(salt.buffer as ArrayBuffer)}$${hex(bits)}`;
}

export async function verifyPasscode(passcode: string, stored: string): Promise<boolean> {
  const [scheme, iters, saltHex, hashHex] = stored.split("$");
  if (scheme !== "pbkdf2" || !iters || !saltHex || !hashHex) return false;
  const salt = new Uint8Array(
    (saltHex.match(/../g) ?? []).map((h) => parseInt(h, 16)),
  );
  const bits = await derive(passcode, salt, Number(iters));
  return same(hex(bits), hashHex);
}

/**
 * The cookie value for a client who has typed their passcode. Derived from the
 * stored hash — which contains a random salt — so it cannot be guessed without
 * the database, and changing the passcode invalidates every cookie that was
 * out there. The passcode itself is not in it.
 */
export async function clientToken(storedHash: string): Promise<string> {
  const bits = await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(`${STAMP}:${storedHash}`),
  );
  return hex(bits);
}

export async function isClientToken(
  value: string | undefined, storedHash: string,
): Promise<boolean> {
  if (!value) return false;
  return same(value, await clientToken(storedHash));
}
