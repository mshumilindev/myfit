export function splitPersonName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  const firstName = parts.shift() ?? '';
  return { firstName, lastName: parts.join(' ') };
}

export function fullPersonName(firstName: string, lastName?: string | null): string {
  return [firstName.trim(), (lastName ?? '').trim()].filter(Boolean).join(' ');
}
