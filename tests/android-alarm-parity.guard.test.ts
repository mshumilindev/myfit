/**
 * SPO-568: the Android shell's native alarm code cannot be built in CI (no Android SDK there), so this guard keeps the parts that must
 * agree with the web side and the desktop shell from drifting: limits, the bridge version, the message names, the manifest entries
 * and the shared shim being packaged.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GRACE_MS, MAX_ALARMS } from '../desktop/src/alarms';
import { BRIDGE_VERSION } from '../desktop/src/shared';

const root = join(__dirname, '../mobile');
const app = join(root, 'android/app');
const read = (p: string) => readFileSync(p, 'utf8');
const java = (f: string) => read(join(app, 'src/main/java/com/spotter/app', f));

describe('Android alarm shell stays in step with the desktop shell and the shim', () => {
  it('has the same limits as desktop/src/alarms.ts', () => {
    const a = java('Alarm.java');
    expect(a).toContain(`MAX_ALARMS = ${MAX_ALARMS};`);
    expect(a).toContain('MAX_ID_LENGTH = 200;');
    expect(a).toContain(`GRACE_MS = ${GRACE_MS / 60_000} * 60_000L;`);
  });
  it('speaks the same bridge version', () => {
    expect(java('MainActivity.java')).toContain(`BRIDGE_VERSION = ${BRIDGE_VERSION};`);
  });
  it('answers exactly the messages the shim sends', () => {
    const shim = read(join(root, 'shell/alarm-shim.js'));
    const port = java('AlarmPort.java');
    for (const t of ['schedule', 'cancel', 'show', 'due']) {
      expect(shim).toContain(`'${t}'`);
      expect(port).toContain(`"${t}"`);
    }
  });
  it('only lets the app origin reach the port, and packages the shared shim', () => {
    expect(java('AlarmPort.java')).toContain('Collections.singleton(origin)');
    expect(read(join(app, 'build.gradle'))).toContain("assets.srcDir '../../shell'");
    expect(java('MainActivity.java')).toContain('getAssets().open("alarm-shim.js")');
  });
  it('registers both receivers and asks only for the permissions the alarms need', () => {
    const m = read(join(app, 'src/main/AndroidManifest.xml'));
    for (const x of ['.AlarmReceiver', '.BootReceiver', 'BOOT_COMPLETED', 'MY_PACKAGE_REPLACED'])
      expect(m).toContain(x);
    for (const p of [
      'POST_NOTIFICATIONS',
      'USE_FULL_SCREEN_INTENT',
      'VIBRATE',
      'RECEIVE_BOOT_COMPLETED',
    ])
      expect(m).toContain(`android.permission.${p}`);
    expect(m).not.toContain('SCHEDULE_EXACT_ALARM');
    expect(m).not.toContain('USE_EXACT_ALARM');
  });
  it('has the notification strings in every language of the app', () => {
    for (const d of ['values', 'values-uk', 'values-pl', 'values-lt', 'values-et']) {
      const s = read(join(app, `src/main/res/${d}/strings.xml`));
      for (const k of [
        'planner_due_title',
        'planner_due_body',
        'planner_channel_ring',
        'planner_channel_quiet',
      ])
        expect(s).toContain(`name="${k}"`);
    }
  });
  it('never puts a plan text into what it stores or schedules', () => {
    for (const f of ['AlarmStore.java', 'AlarmScheduler.java'])
      expect(java(f)).not.toMatch(/title|body|note/i);
  });
});
