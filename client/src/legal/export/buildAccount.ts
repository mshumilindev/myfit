/** Export builders: account and consent history, trainer sharing. Pure: they read `ExportSources` only. */
import { isoTime } from './csv';
import type { CategoryResult, ExportSources, Missing } from './exportModel';

export function buildAccount(s: ExportSources, exportedAt: string): CategoryResult {
  const missing: Missing[] = [
    {
      item: 'Profile details held on the server (name, photo, role history, team)',
      reason: 'server-only',
    },
    { item: 'Sign-in attempts, passkeys and device sessions', reason: 'server-only' },
    { item: 'Key access log and service notices', reason: 'server-only' },
  ];
  const files: CategoryResult['files'] = [
    {
      name: 'account.json',
      about: 'The account identifiers this device knows.',
      content: {
        kind: 'json',
        value: {
          exportedAt,
          userId: s.account.uid,
          username: s.account.username,
          role: s.account.role,
        },
      },
    },
  ];
  const keys = Object.keys(s.settings);
  if (keys.length) {
    files.push({
      name: 'settings.json',
      about:
        'Settings and small values kept in your account: units and exercise settings, Today widget values, started challenges, saved lessons, theme and language, push switches.',
      content: { kind: 'json', value: s.settings },
      rows: keys.length,
    });
  }
  if (s.consents === null) {
    missing.push({ item: 'Consent history', reason: 'not-loaded' });
  } else {
    const list = [...s.consents].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    files.push(
      {
        name: 'consents.json',
        about: 'Every consent you gave or withdrew: kind, version of the text, time.',
        content: { kind: 'json', value: list.map((r) => ({ ...r, atIso: isoTime(r.at) })) },
        rows: list.length,
      },
      {
        name: 'consents.csv',
        about: 'The same consent history as a table.',
        content: {
          kind: 'csv',
          header: ['time_utc', 'kind', 'action', 'version', 'categories', 'engines'],
          rows: list.map((r) => [
            isoTime(r.at),
            r.kind,
            r.action,
            r.version,
            (r.categories ?? []).join(' '),
            (r.engines ?? []).join(' '),
          ]),
        },
        rows: list.length,
      },
    );
  }
  return { id: 'account', files, missing };
}

export function buildSharing(s: ExportSources): CategoryResult {
  const missing: Missing[] = [
    { item: 'Messages with your trainer and shared notes', reason: 'not-loaded' },
    { item: 'Plans, schedule and requests shared with your trainer', reason: 'not-loaded' },
    { item: 'Who opened your data (access log)', reason: 'not-loaded' },
    { item: 'Private records your trainer keeps about you', reason: 'held-by-other' },
  ];
  const files: CategoryResult['files'] = [
    {
      name: 'sharing.json',
      about: 'Whether you have a trainer and the general sharing choice for long-term conditions.',
      content: {
        kind: 'json',
        value: {
          hasTrainer: s.hasTrainer,
          conditionsShare: s.store ? s.store.conditionsShare : null,
        },
      },
    },
  ];
  return { id: 'sharing', files, missing };
}
