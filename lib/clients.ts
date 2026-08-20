// Slug -> Sheet tab prefix. The slug IS the credential: it is the only thing
// standing between a stranger and a client's program, so keep it long and random.

/** Tab prefixes in the order they should appear on the coach page. */
export const PREFIXES = ["Client1", "Client2"] as const;
export type Prefix = (typeof PREFIXES)[number];

const CLIENTS: Record<string, string> = Object.fromEntries(
  (
    [
      [process.env.CLIENT_1_SLUG, "Client1"],
      [process.env.CLIENT_2_SLUG, "Client2"],
    ] as const
  ).filter(([slug]) => typeof slug === "string" && slug.length > 0)
) as Record<string, string>;

/** Returns the tab prefix for a slug, or null if the slug is unknown. */
export function prefixForSlug(slug: string): string | null {
  return CLIENTS[slug] ?? null;
}

/** True only for the coach's own slug, which can write to any client's tabs. */
export function isCoachSlug(slug: string): boolean {
  const coach = process.env.COACH_SLUG;
  return typeof coach === "string" && coach.length > 0 && slug === coach;
}

export function isPrefix(value: unknown): value is Prefix {
  return typeof value === "string" && (PREFIXES as readonly string[]).includes(value);
}
