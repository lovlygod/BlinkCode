import electron from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { startBlinkCodeServer } from '../server/index.js';

const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = electron;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function isSafeHttpUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return false;

  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function appIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '..', 'build', 'icon.ico');
}

function registerIpc() {
  ipcMain.removeHandler?.('dialog:openFolder');
  ipcMain.removeHandler?.('window:minimize');
  ipcMain.removeHandler?.('window:maximize');
  ipcMain.removeHandler?.('window:close');
  ipcMain.removeHandler?.('window:isMaximized');
  ipcMain.removeHandler?.('shell:openExternal');

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });

    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }
    mainWindow.maximize();
    return true;
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  ipcMain.handle('shell:openExternal', async (_event, url) => {
    if (!isSafeHttpUrl(url)) return false;
    await shell.openExternal(url);
    return true;
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}

    await wait(500);
  }

  throw new Error(`Server did not start: ${url}`);
}

async function createWindow() {
  const port = process.env.PORT || (app.isPackaged ? '3210' : '3001');
  const url = `http://127.0.0.1:${port}`;

  await startBlinkCodeServer(port);
  await waitForServer(url);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0e1017',
    title: '',
    frame: false,
    titleBarStyle: 'hidden',
    icon: appIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;

    if (!isSafeHttpUrl(params.src)) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeHttpUrl(url)) {
      shell.openExternal(url).catch(() => {});
    }

    return { action: 'deny' };
  });

  await mainWindow.loadURL(url);

  mainWindow.webContents.setZoomFactor(1);
  mainWindow.webContents.setVisualZoomLevelLimits(1, 1);
  if (app.isPackaged) {
    mainWindow.maximize();
  } else {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const isF12 = input.key === 'F12';
    const isCtrlShiftI = input.control && input.shift && (input.key === 'I' || input.key === 'i');
    if (isF12 || isCtrlShiftI) {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  registerIpc();
  await createWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch(err => {
      console.error('Failed to create window', err);
      app.quit();
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  mainWindow = null;
});
