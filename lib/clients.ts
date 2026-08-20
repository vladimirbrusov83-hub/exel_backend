// Slug -> Sheet tab prefix. The slug IS the credential: it is the only thing
// standing between a stranger and a client's program, so keep it long and random.
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
