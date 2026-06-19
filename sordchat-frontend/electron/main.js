const electron = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

if (!electron.app) {
  const { spawn } = require('child_process');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  spawn(process.execPath, process.argv.slice(1), {
    detached: true,
    env,
    stdio: 'ignore',
    windowsHide: false,
  }).unref();
  process.exit(0);
}

const { app, BrowserWindow, shell } = electron;

const isDev = process.env.ELECTRON_START_URL;
const appIcon = path.join(__dirname, 'assets', 'icon.ico');
let mainWindow = null;

if (process.platform === 'win32') {
  app.setAppUserModelId('com.voltcorp.app');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#f6f7f9',
    title: 'Volt Corp',
    icon: appIcon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Falha ao carregar ${validatedURL}: ${errorCode} ${errorDescription}`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`Processo de renderizacao encerrado: ${details.reason}`);
  });

  if (isDev) {
    const startUrl = new URL(process.env.ELECTRON_START_URL);
    if (!startUrl.hash) {
      startUrl.hash = '/login';
    }
    mainWindow.loadURL(startUrl.toString());
  } else {
    const indexPath = path.join(__dirname, '..', 'build', 'index.html');
    mainWindow.loadURL(`${pathToFileURL(indexPath).toString()}#/login`);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
