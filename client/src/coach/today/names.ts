/** "Oleh Bondar" -> "Oleh". Names are user data; no copy lives here. */
export const firstName = (full: string): string => full.trim().split(/\s+/)[0] ?? full;
