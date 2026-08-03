const NAME_MAX = 64;

interface NamedUser {
  username: string;
  first_name?: string | null;
  last_name?: string | null;
}

export function cleanPersonName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX) : '';
}

export function splitDisplayName(value: string): { firstName: string; lastName: string | null } {
  const parts = cleanPersonName(value).split(' ').filter(Boolean);
  const firstName = parts.shift() ?? '';
  const lastName = parts.length > 0 ? parts.join(' ') : null;
  return { firstName, lastName };
}

export function displayName(user: NamedUser): string {
  const fallback = splitDisplayName(user.username);
  const firstName = cleanPersonName(user.first_name) || fallback.firstName || user.username;
  const lastName = cleanPersonName(user.last_name) || fallback.lastName;
  return [firstName, lastName].filter(Boolean).join(' ');
}

export function nameParts(user: NamedUser): { firstName: string; lastName: string | null } {
  const fallback = splitDisplayName(user.username);
  const firstName = cleanPersonName(user.first_name) || fallback.firstName || user.username;
  const lastName = cleanPersonName(user.last_name) || fallback.lastName;
  return { firstName, lastName };
}

export function parseNameInput(input: {
  firstName?: unknown;
  lastName?: unknown;
  username?: unknown;
  name?: unknown;
}): { firstName: string; lastName: string | null } {
  const firstName = cleanPersonName(input.firstName);
  const lastName = cleanPersonName(input.lastName);
  if (firstName) return { firstName, lastName: lastName || null };

  const legacyName = cleanPersonName(input.name) || cleanPersonName(input.username);
  return splitDisplayName(legacyName);
}
