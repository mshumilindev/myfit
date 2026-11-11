import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerMonitor,
  session,
  shell,
  systemPreferences,
  Tray,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
import { createAlarmScheduler, parseAlarms } from './alarms';
import { closeBehavior, hideToTray } from './hideWindow';
import { DEFAULT_PREFS, parsePrefs, patchPrefs, type ShellPrefs } from './prefs';
import { CHANNEL, DEFAULT_APP_URL } from './shared';
import { parseTrayState, trayItems, type TrayState } from './trayMenu';

/**
 * Thin shell around the hosted Spotter web app. All product code lives in `client/`; this process only opens the
 * deployed URL, so every Firebase Hosting deploy reaches the desktop app without a new shell release.
 * Override the URL for local testing: SPOTTER_URL=http://localhost:5173 npm run start -w desktop
 */
const APP_URL = process.env.SPOTTER_URL ?? DEFAULT_APP_URL;
const APP_ORIGIN = new URL(APP_URL).origin;

/** Permissions the hosted app may use (camera/geolocation per Permissions-Policy in firebase.json; web notifications). */
const ALLOWED_PERMISSIONS = new Set(['notifications', 'media', 'geolocation']);

/** macOS only: the system prompt (NSMicrophone/NSCameraUsageDescription) must be answered before getUserMedia works. */
async function askMediaAccess(types: string[]): Promise<boolean> {
  if (process.platform !== 'darwin') return true;
  const kinds = (['audio', 'video'] as const).filter((t) => types.includes(t));
  for (const kind of kinds) {
    const name = kind === 'audio' ? 'microphone' : 'camera';
    if (systemPreferences.getMediaAccessStatus(name) === 'granted') continue;
    if (!(await systemPreferences.askForMediaAccess(name))) return false;
  }
  return true;
}

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let prefs: ShellPrefs = DEFAULT_PREFS;
let trayState: TrayState = { next: null };
/** Started by the system at login (or with --hidden): stay in the tray / menu bar, no window. */
const startHidden = process.argv.includes('--hidden');

const prefsFile = (): string => path.join(app.getPath('userData'), 'shell-prefs.json');
function loadPrefs(): ShellPrefs {
  try {
    return parsePrefs(JSON.parse(fs.readFileSync(prefsFile(), 'utf8')));
  } catch {
    return DEFAULT_PREFS;
  }
}
function savePrefs(): void {
  try {
    fs.writeFileSync(prefsFile(), JSON.stringify(prefs));
  } catch (err) {
    console.warn('[prefs]', err instanceof Error ? err.message : err);
  }
}
function applyLoginItem(): void {
  // Unsupported on Linux; on a packaged build only (a dev run must not register the electron binary).
  if (!app.isPackaged || process.platform === 'linux') return;
  app.setLoginItemSettings({
    openAtLogin: prefs.openAtLogin,
    openAsHidden: true,
    args: ['--hidden'],
  });
}

// Planner reminders (SPO-552 I8): the main process keeps the timers, the page owns the text.
const alarms = createAlarmScheduler(
  {
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as NodeJS.Timeout),
  },
  (alarm) => {
    // The page may be hidden but is alive; if it is gone, the window is recreated hidden so the ring can show.
    if (!win) createWindow(true);
    win?.webContents.send(CHANNEL.alarmDue, alarm);
  },
);

const assetPath = (name: string): string => path.resolve(__dirname, '../assets', name);

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function isAppUrl(url: string): boolean {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

const OFFLINE_PAGE =
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(
    `<!doctype html><meta charset="utf-8"><title>Spotter</title>
<body style="font:16px -apple-system,system-ui;background:#111;color:#eee;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center"><h2>Spotter</h2><p>Немає звʼязку з сервером.</p>
<button onclick="location.href='${APP_URL}'" style="font:inherit;padding:8px 16px">Спробувати ще</button></div>`,
  );

function createWindow(hidden = false): void {
  win = new BrowserWindow({
    show: !hidden,
    width: 1100,
    height: 800,
    minWidth: 480,
    minHeight: 600,
    title: 'Spotter',
    icon: nativeImage.createFromPath(assetPath('app-icon.png')),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Only the app's own origin may load in this window; everything else opens in the system browser.
  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('data:')) return;
    if (!isAppUrl(url)) {
      event.preventDefault();
      if (isHttps(url)) void shell.openExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttps(url) && !isAppUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    // -3 = aborted (normal during redirects). Show a retry page when the app itself cannot load.
    if (isMainFrame && code !== -3 && isAppUrl(url)) void win?.loadURL(OFFLINE_PAGE);
  });

  win.on('close', (event) => {
    // While the tray / menu bar icon shows, closing the window hides it and the app keeps running there; with no icon it quits (closeBehavior).
    // Real quit: tray menu / app menu (sets `quitting`).
    if (quitting) return;
    if (closeBehavior(process.platform, tray !== null) === 'quit') {
      // No icon to bring the app back: the close button really quits (no hidden window, no black screen). Let the close go through.
      quitting = true;
      app.quit();
      return;
    }
    event.preventDefault();
    if (win) hideToTray(win);
  });
  win.on('closed', () => {
    win = null;
  });

  void win.loadURL(APP_URL);
}

function showWindow(): void {
  if (!win) createWindow();
  win?.show();
  win?.focus();
}

let updateReady = false;

function refreshTrayMenu(): void {
  tray?.setContextMenu(
    Menu.buildFromTemplate(
      trayItems(trayState, updateReady).map((i): Electron.MenuItemConstructorOptions => {
        if (i.kind === 'separator') return { type: 'separator' };
        if (i.kind === 'text') return { label: i.label, enabled: false };
        if (i.id === 'open') return { label: i.label, click: showWindow };
        if (i.id === 'update') {
          return {
            label: i.label,
            click: () => {
              quitting = true;
              autoUpdater.quitAndInstall();
            },
          };
        }
        return {
          label: i.label,
          click: () => {
            quitting = true;
            app.quit();
          },
        };
      }),
    ),
  );
}

// Shell auto-update (Windows direct distribution, GitHub Releases via electron-updater). The web app updates itself
// from hosting; this only replaces the shell. macOS shell updates need a signed build (SPO-162), so not enabled there.
function setupAutoUpdate(): void {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', () => {
    updateReady = true;
    refreshTrayMenu();
    if (Notification.isSupported()) {
      new Notification({
        title: 'Spotter',
        body: 'Оновлення готове — встановиться при виході (або через меню в треї).',
      }).show();
    }
  });
  autoUpdater.on('error', (err) => console.warn('[updater]', err?.message ?? err));
  const check = (): void => void autoUpdater.checkForUpdates().catch(() => undefined);
  check();
  setInterval(check, 6 * 60 * 60 * 1000);
}

function createTray(): void {
  if (tray) return;
  const icon = nativeImage.createFromPath(
    assetPath(
      process.platform === 'darwin'
        ? 'trayTemplate.png'
        : process.platform === 'win32'
          ? 'tray.ico'
          : 'tray.png',
    ),
  );
  if (process.platform === 'darwin') icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Spotter');
  refreshTrayMenu();
  tray.on('click', showWindow);
}

/** "Show the icon" off: the icon goes, and a hidden window comes back so the app is never left running with no way to reach it. */
function syncTray(): void {
  if (prefs.trayIcon) createTray();
  else if (tray) {
    tray.destroy();
    tray = null;
    if (win && !win.isVisible()) showWindow();
  }
}

function buildMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(process.platform === 'darwin'
        ? [{ role: 'appMenu' as const }]
        : [{ role: 'fileMenu' as const }]),
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]),
  );
}

function registerIpc(): void {
  ipcMain.handle(CHANNEL.version, () => app.getVersion());
  ipcMain.handle(CHANNEL.notify, (_e, p: { title?: unknown; body?: unknown }) => {
    if (typeof p?.title !== 'string' || !Notification.isSupported()) return;
    const n = new Notification({
      title: p.title.slice(0, 120),
      body: typeof p.body === 'string' ? p.body.slice(0, 500) : undefined,
    });
    n.on('click', showWindow);
    n.show();
  });
  ipcMain.handle(CHANNEL.badge, (_e, count: unknown) => {
    if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
      app.setBadgeCount(Math.floor(count));
    }
  });
  ipcMain.handle(CHANNEL.scheduleAlarms, (_e, list: unknown) => alarms.schedule(parseAlarms(list)));
  ipcMain.handle(CHANNEL.cancelAlarms, (_e, ids: unknown) => {
    if (Array.isArray(ids)) alarms.cancel(ids.filter((i): i is string => typeof i === 'string'));
  });
  ipcMain.handle(
    CHANNEL.showAlarm,
    (_e, p: { id?: unknown; title?: unknown; body?: unknown; mode?: unknown }) => {
      if (typeof p?.title !== 'string' || !Notification.isSupported()) return;
      const ring = p.mode === 'ring';
      const n = new Notification({
        title: p.title.slice(0, 120),
        body: typeof p.body === 'string' ? p.body.slice(0, 500) : undefined,
        // Windows / Linux: a ring stays until it is dealt with; macOS ignores these (and unsigned builds show nothing, SPO-162).
        urgency: ring ? 'critical' : 'normal',
        timeoutType: ring ? 'never' : 'default',
      });
      n.on('click', showWindow);
      n.show();
    },
  );
  ipcMain.handle(CHANNEL.setTray, (_e, state: unknown) => {
    trayState = parseTrayState(state);
    refreshTrayMenu();
  });
  ipcMain.handle(CHANNEL.getPrefs, () => prefs);
  ipcMain.handle(CHANNEL.setPrefs, (_e, patch: unknown) => {
    prefs = patchPrefs(prefs, patch);
    savePrefs();
    applyLoginItem();
    syncTray();
    return prefs;
  });
  ipcMain.handle(CHANNEL.openExternal, (_e, url: unknown) => {
    if (typeof url === 'string' && isHttps(url)) void shell.openExternal(url);
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('activate', showWindow);
  // No quit on window-all-closed: the app lives in the tray until "Quit".
  app.on('window-all-closed', () => {});

  // Windows: AppUserModelID is required for toast notifications and taskbar grouping (must match build appId).
  if (process.platform === 'win32') app.setAppUserModelId('com.spotter.desktop');

  void app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
      // Both the page and the requesting frame must be the app's own origin (an embedded frame must not inherit it).
      const requesting = (details as { requestingUrl?: string }).requestingUrl ?? '';
      if (!ALLOWED_PERMISSIONS.has(permission) || !isAppUrl(wc.getURL()) || !isAppUrl(requesting)) {
        return callback(false);
      }
      if (permission !== 'media') return callback(true);
      // Calls (SPO-442): on macOS ask the OS for microphone/camera access before the page's getUserMedia proceeds.
      const types = (details as { mediaTypes?: string[] }).mediaTypes ?? [];
      askMediaAccess(types)
        .then(callback)
        .catch((err: unknown) => {
          console.warn('[media]', err instanceof Error ? err.message : err);
          callback(false);
        });
    });
    prefs = loadPrefs();
    buildMenu();
    registerIpc();
    syncTray();
    applyLoginItem();
    // Hidden start only makes sense with an icon to bring the window back.
    createWindow(startHidden && tray !== null);
    powerMonitor.on('resume', () => alarms.recheck());
    setupAutoUpdate();
  });
}
