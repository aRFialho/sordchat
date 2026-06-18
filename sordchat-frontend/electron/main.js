const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const isDev = process.env.ELECTRON_START_URL;
const appIcon = path.join(__dirname, 'assets', 'icon.ico');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.sordchat.app');
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#f6f7f9',
    title: 'SorDChat',
    icon: appIcon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
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
