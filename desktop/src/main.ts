import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  session,
  shell,
  Tray,
} from 'electron';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';
import { hideToTray } from './hideWindow';
import { CHANNEL, DEFAULT_APP_URL } from './shared';

/**
 * Thin shell around the hosted Spotter web app. All product code lives in `client/`; this process only opens the
 * deployed URL, so every Firebase Hosting deploy reaches the desktop app without a new shell release.
 * Override the URL for local testing: SPOTTER_URL=http://localhost:5173 npm run start -w desktop
 */
const APP_URL = process.env.SPOTTER_URL ?? DEFAULT_APP_URL;
const APP_ORIGIN = new URL(APP_URL).origin;

/** Permissions the hosted app may use (camera/geolocation per Permissions-Policy in firebase.json; web notifications). */
const ALLOWED_PERMISSIONS = new Set(['notifications', 'media', 'geolocation']);

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

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

function createWindow(): void {
  win = new BrowserWindow({
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
    // Closing the window hides it; the app keeps running in the tray (macOS menu bar / Windows tray).
    // Real quit: tray menu / app menu (sets `quitting`).
    if (!quitting) {
      event.preventDefault();
      if (win) hideToTray(win);
    }
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
    Menu.buildFromTemplate([
      { label: 'Відкрити Spotter', click: showWindow },
      ...(updateReady
        ? [
            {
              label: 'Перезапустити й оновити',
              click: () => {
                quitting = true;
                autoUpdater.quitAndInstall();
              },
            },
          ]
        : []),
      { type: 'separator' as const },
      {
        label: 'Вийти',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
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
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
      callback(ALLOWED_PERMISSIONS.has(permission) && isAppUrl(wc.getURL()));
    });
    buildMenu();
    registerIpc();
    createTray();
    createWindow();
    setupAutoUpdate();
  });
}
