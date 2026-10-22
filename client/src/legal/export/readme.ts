/** The plain-text READMEs and the manifest of the export. English: the files are data, the app's words live in i18n. */
import { FORMAT_VERSION, type ExportCategory, type MissingReason } from './exportModel';

export const REASON_TEXT: Record<MissingReason, string> = {
  'server-only': 'Kept on our servers; this device cannot read it.',
  'not-loaded':
    'Not loaded on this device at the moment. Open that part of the app (online) and make a new copy.',
  'feature-off':
    'Stored, but hidden while the feature has no consent. Turn the feature on and make a new copy.',
  'held-by-other':
    "Held under someone else's key (your trainer's private records). Ask the person who keeps them.",
};

export const CATEGORY_TITLE: Record<ExportCategory, string> = {
  account: 'Account, sign-in and consent history',
  training: 'Training',
  body: 'Health, body, sleep and nutrition',
  atlas: 'Atlas chat',
  sharing: 'Trainer sharing and messages',
};

export interface ManifestFile {
  path: string;
  about: string;
  bytes: number;
  rows?: number;
}
export interface ManifestCategory {
  id: ExportCategory;
  title: string;
  files: ManifestFile[];
  notIncluded: { item: string; reason: MissingReason; message: string }[];
}
export interface Manifest {
  format: typeof FORMAT_VERSION;
  generatedAt: string;
  builtOn: 'this device';
  encrypted: false;
  /** Whether the app's data on this device was confirmed in step with the account when the copy was made. */
  deviceCopyOnly: boolean;
  categories: ManifestCategory[];
  /** Categories the person did not ask for. */
  notRequested: ExportCategory[];
}

const WARNING =
  'This file is NOT encrypted and contains health data. Anyone who gets it can read it. Keep it somewhere safe.';

export function categoryReadme(c: ManifestCategory): string {
  const lines = [c.title, '='.repeat(c.title.length), '', WARNING, '', 'Files'];
  for (const f of c.files) lines.push(`- ${f.path.split('/').slice(1).join('/')}: ${f.about}`);
  if (c.notIncluded.length) {
    lines.push('', 'Not included here');
    for (const m of c.notIncluded) lines.push(`- ${m.item}: ${m.message}`);
  }
  return `${lines.join('\n')}\n`;
}

export function rootReadme(m: Manifest): string {
  const lines = [
    'Your copy of your Spotter data',
    '==============================',
    '',
    `Made on this device on ${m.generatedAt} from what the app could read and decrypt here (no new request for your data was made to build it).`,
    '',
    WARNING,
    '',
    'How to read it',
    '- *.json files hold the full records (machine-readable). *.csv files hold the same data as a table that opens in a spreadsheet.',
    '- Times in CSV files are UTC (ISO 8601). Weights are in kg as stored.',
    '- CSV files start with a byte order mark so spreadsheets read them as UTF-8. A cell that would start with = + - or @ (or a tab or line break) has a leading apostrophe so a spreadsheet shows it as text instead of running it; remove the apostrophe if you need the original text.',
    '- Parts marked "stored; hidden in the app because consent is off" are your own stored data from a feature that is switched off. The app hides it, but it is included here because the copy is your data back to you.',
    '- Notes you typed (workouts, Atlas chat and settings, health records) may contain health details you typed.',
    '- manifest.json lists every file and everything that is not included, with the reason.',
    '',
    'Parts of this copy',
  ];
  for (const c of m.categories)
    lines.push(
      `- ${c.title}: ${c.files.length} file(s)${c.notIncluded.length ? `, ${c.notIncluded.length} item(s) not included here` : ''}`,
    );
  if (m.notRequested.length)
    lines.push('', `Not requested: ${m.notRequested.map((i) => CATEGORY_TITLE[i]).join(', ')}.`);
  if (m.deviceCopyOnly)
    lines.push(
      '',
      "The app's data on this device was not yet confirmed in step with your account, so this is this device's copy and may be incomplete.",
    );
  lines.push(
    '',
    'What the policy says about your data (what we process, why, who receives it, how long) is in the Privacy Policy in the app.',
  );
  return `${lines.join('\n')}\n`;
}
