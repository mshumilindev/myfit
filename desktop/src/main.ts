import { app, BrowserWindow, Menu, Tray, nativeImage, shell, screen } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 4477);
const APP_URL = `http://localhost:${PORT}`;
const SERVER_ENTRY = path.resolve(__dirname, '../../server/dist/index.js');

let tray: Tray | null = null;
let win: BrowserWindow | null = null;
let mainWin: BrowserWindow | null = null;
let serverProc: ChildProcess | null = null;
let serverUp = false;
let quitting = false;

// --- Embedded Node server --------------------------------------------------

function startServer(): void {
  if (serverProc) return;
  // ВАЖЛИВО: better-sqlite3 — нативний модуль, зібраний під ABI системного
  // Node (npm install запускався звичайним node). Electron має ІНШИЙ ABI,
  // тому під ELECTRON_RUN_AS_NODE він падає з NODE_MODULE_VERSION mismatch.
  // Тож сервер запускаємо справжнім Node: npm_node_execpath — це node,
  // яким запустили `npm run tray` (успадковується дочірнім процесом).
  // Electron-as-Node лишаємо тільки як аварійний фолбек (для нього
  // довелось би робити electron-rebuild).
  const nodeBin = process.env.npm_node_execpath ?? 'node';
  const useElectronAsNode = !nodeBin;
  console.log(
    `[desktop] starting server with: ${useElectronAsNode ? 'electron-as-node' : nodeBin}`,
  );
  serverProc = spawn(useElectronAsNode ? process.execPath : nodeBin, [SERVER_ENTRY], {
    env: {
      ...process.env,
      ...(useElectronAsNode ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
      PORT: String(PORT),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProc.stdout?.on('data', (d) => process.stdout.write(`[server] ${d}`));
  serverProc.stderr?.on('data', (d) => process.stderr.write(`[server] ${d}`));
  serverProc.on('exit', (code) => {
    serverProc = null;
    serverUp = false;
    updateMenu();
    if (!quitting) {
      console.log(`[desktop] server exited (${code}), restarting in 2s…`);
      setTimeout(startServer, 2000);
    }
  });
}

function pollHealth(): void {
  const req = http.get(`${APP_URL}/api/health`, (res) => {
    const wasUp = serverUp;
    serverUp = res.statusCode === 200;
    if (serverUp !== wasUp) updateMenu();
    res.resume();
  });
  req.on('error', () => {
    if (serverUp) {
      serverUp = false;
      updateMenu();
    }
  });
  req.setTimeout(2000, () => req.destroy());
}

const APP_ICON = path.resolve(__dirname, '../assets/app-icon.png');
const TRAY_ICON = path.resolve(__dirname, '../assets/tray.png');

function appIcon() {
  return nativeImage.createFromPath(APP_ICON);
}

// --- Popup window under the tray icon --------------------------------------

function createWindow(): void {
  win = new BrowserWindow({
    width: 430,
    height: 700,
    show: false,
    frame: false,
    resizable: true,
    fullscreenable: false,
    skipTaskbar: true,
    icon: appIcon(),
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(APP_URL);
  win.on('blur', () => {
    if (win && !win.webContents.isDevToolsOpened()) win.hide();
  });
  win.on('closed', () => {
    win = null;
  });
}

function toggleWindow(): void {
  if (!win) createWindow();
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
    return;
  }
  positionWindow();
  win.show();
  win.focus();
}

function positionWindow(): void {
  if (!win || !tray) return;
  const trayBounds = tray.getBounds();
  const winBounds = win.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 6);
  x = Math.max(
    display.workArea.x + 8,
    Math.min(x, display.workArea.x + display.workArea.width - winBounds.width - 8),
  );
  win.setPosition(x, y, false);
}

/** Повноцінне десктопне вікно (звичайне, з рамкою, ресайзиться). */
function openMainWindow(): void {
  if (mainWin) {
    mainWin.show();
    mainWin.focus();
    return;
  }
  if (process.platform === 'darwin') app.dock?.show();
  mainWin = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 480,
    minHeight: 600,
    title: 'Spotter',
    icon: appIcon(),
    webPreferences: { contextIsolation: true },
  });
  mainWin.loadURL(APP_URL);
  mainWin.on('closed', () => {
    mainWin = null;
    if (process.platform === 'darwin' && !BrowserWindow.getAllWindows().length) {
      app.dock?.hide(); // назад у режим "тільки трей"
    }
  });
}

// --- Tray ------------------------------------------------------------------

function trayIcon() {
  // Gold brand glyph (not a macOS template — color is intentional).
  return nativeImage.createFromPath(TRAY_ICON);
}

function updateMenu(): void {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: serverUp ? '🟢 Сервер працює' : '🔴 Сервер не відповідає',
      enabled: false,
    },
    { type: 'separator' },
    { label: 'Швидке вікно (біля трею)', click: toggleWindow },
    { label: 'Відкрити десктопний додаток', click: openMainWindow },
    {
      label: 'Відкрити в браузері',
      click: () => void shell.openExternal(APP_URL),
    },
    { type: 'separator' },
    {
      label: 'Вийти',
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.dock?.hide(); // menu-bar app only
    app.dock?.setIcon(appIcon());
  }

  startServer();
  setInterval(pollHealth, 3000);
  pollHealth();

  tray = new Tray(trayIcon());
  tray.setToolTip('Spotter');
  updateMenu();
  tray.on('click', toggleWindow);
});

app.on('window-all-closed', () => {
  // Keep running in the tray even with no windows.
});

app.on('before-quit', () => {
  quitting = true;
  serverProc?.kill();
});
