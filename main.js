const { app, BrowserWindow, Menu, shell, dialog, Tray, Notification, nativeImage, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// ─── AYARLAR ──────────────────────────────────────────────────────────────
const APP_URL = 'https://teknikcepte.com';
const APP_NAME = 'ServisPanel';
const NOTIFY_CHECK_INTERVAL = 60000; // 60 sn - yeni servis kontrolü

// Windows bildirimlerinde "electron.app.ServisPanel" yerine düzgün isim göstersin
if (process.platform === 'win32') {
  app.setAppUserModelId('com.teknikcepte.servispanel');
}

let mainWindow;
let splashWindow;
let tray;
let isQuitting = false;
let lastServiceCount = null;

// ── SPLASH SCREEN ───────────────────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 320,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: { contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.center();
}

// ── ANA PENCERE ──────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    title: APP_NAME,
    backgroundColor: '#1e1b4b',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Splash'tan ana pencereye yumuşak geçiş
  mainWindow.once('ready-to-show', () => {
    if (splashWindow) { splashWindow.close(); splashWindow = null; }
    mainWindow.show();
    startServiceWatcher();
  });

  buildMenu();
  loadApp();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL) && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode) => {
    if (errorCode !== -3) showOfflinePage();
  });

  // Pencere kapatma → tray'e küçült (tamamen kapatma)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (tray && tray.displayBalloon) {
        tray.displayBalloon({
          title: APP_NAME,
          content: 'Uygulama arka planda çalışmaya devam ediyor.',
        });
      }
    }
  });
}

function buildMenu() {
  const menuTemplate = [
    {
      label: 'ServisPanel',
      submenu: [
        { label: '🔄 Yenile', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
        { label: '🏠 Ana Sayfa', click: () => loadApp() },
        { type: 'separator' },
        { label: '🔍 Yakınlaştır', accelerator: 'CmdOrCtrl+Plus', click: () => zoom(0.5) },
        { label: '🔎 Uzaklaştır', accelerator: 'CmdOrCtrl+-', click: () => zoom(-0.5) },
        { label: '↺ Sıfırla', accelerator: 'CmdOrCtrl+0', click: () => mainWindow.webContents.setZoomLevel(0) },
        { type: 'separator' },
        { label: '⬇️ Güncellemeleri Kontrol Et', click: () => checkForUpdates(true) },
        { type: 'separator' },
        { label: '🗕 Sistem Tepsisine Küçült', click: () => mainWindow.hide() },
        { label: 'Çıkış', accelerator: 'CmdOrCtrl+Q', click: () => quitApp() },
      ],
    },
    {
      label: 'Yardım',
      submenu: [
        {
          label: 'Hakkında',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'ServisPanel Hakkında',
              message: 'ServisPanel Masaüstü Uygulaması',
              detail: `Sürüm: ${app.getVersion()}\nteknikcepte.com'a bağlı çalışır.`,
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
}

function zoom(delta) {
  const z = mainWindow.webContents.getZoomLevel();
  mainWindow.webContents.setZoomLevel(z + delta);
}

function loadApp() {
  mainWindow.loadURL(APP_URL).catch(() => showOfflinePage());
}

function showOfflinePage() {
  mainWindow.loadFile(path.join(__dirname, 'offline.html'));
}

function quitApp() {
  isQuitting = true;
  app.quit();
}

// ── SİSTEM TEPSİSİ (TRAY) ───────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'tray-icon.png'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip(APP_NAME);

  const trayMenu = Menu.buildFromTemplate([
    { label: '📂 Paneli Aç', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: '🔄 Yenile', click: () => { mainWindow.show(); mainWindow.reload(); } },
    { type: 'separator' },
    { label: '⬇️ Güncellemeleri Kontrol Et', click: () => checkForUpdates(true) },
    { type: 'separator' },
    { label: 'Çıkış', click: () => quitApp() },
  ]);
  tray.setContextMenu(trayMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) mainWindow.hide();
    else { mainWindow.show(); mainWindow.focus(); }
  });
}

// ── MASAÜSTÜ BİLDİRİMLERİ ───────────────────────────────────────────────
function notify(title, body, onClick) {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title,
    body,
    icon: path.join(__dirname, 'build', 'icon.ico'),
  });
  if (onClick) n.on('click', onClick);
  n.show();
}

// Yeni servis kontrolü — panelin API'sinden okunur (varsa)
// Not: Bu fonksiyon teknikcepte.com/api/notify_check.php gibi bir endpoint bekler.
// Böyle bir endpoint yoksa sessizce hata yutar, uygulamayı bozmaz.
function startServiceWatcher() {
  checkNewServices(); // ilk kontrol
  setInterval(checkNewServices, NOTIFY_CHECK_INTERVAL);
}

async function checkNewServices() {
  try {
    const result = await mainWindow.webContents.executeJavaScript(`
      fetch('/api/notify_check.php', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    `);
    if (result && typeof result.count === 'number') {
      if (lastServiceCount !== null && result.count > lastServiceCount) {
        const diff = result.count - lastServiceCount;
        notify(
          'ServisPanel',
          diff === 1 ? 'Yeni bir servis kaydı geldi.' : `${diff} yeni servis kaydı geldi.`,
          () => { mainWindow.show(); mainWindow.focus(); }
        );
      }
      lastServiceCount = result.count;
    }
  } catch (e) {
    // Sessiz geç - endpoint yoksa veya offline ise
  }
}

// ── OTOMATİK GÜNCELLEME ─────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Güncelleme Mevcut',
      message: `Yeni sürüm bulundu: v${info.version}`,
      detail: 'İndirilsin mi?',
      buttons: ['İndir', 'Daha Sonra'],
      defaultId: 0,
    }).then((result) => {
      if (result.response === 0) autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on('update-not-available', () => {
    if (global.__manualCheck) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Güncelleme Yok',
        message: 'En güncel sürümü kullanıyorsunuz.',
      });
      global.__manualCheck = false;
    }
  });

  autoUpdater.on('download-progress', (p) => {
    if (mainWindow) mainWindow.setProgressBar(p.percent / 100);
  });

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) mainWindow.setProgressBar(-1);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Güncelleme Hazır',
      message: 'Güncelleme indirildi. Şimdi yeniden başlatılsın mı?',
      buttons: ['Yeniden Başlat', 'Daha Sonra'],
      defaultId: 0,
    }).then((result) => {
      if (result.response === 0) {
        isQuitting = true;
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    if (global.__manualCheck) {
      const isNotFound = String(err).includes('404');
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Güncelleme Hatası',
        message: isNotFound
          ? 'Güncelleme sunucusuna henüz hiç sürüm yayınlanmamış.'
          : 'Güncelleme kontrol edilemedi. İnternet bağlantınızı kontrol edin.',
        detail: isNotFound
          ? 'Bu normaldir — GitHub deposuna ilk sürüm yayınlandığında düzelecektir.'
          : String(err),
      });
      global.__manualCheck = false;
    }
  });

  // Açılışta otomatik kontrol (sessiz)
  checkForUpdates(false);
  // Her 4 saatte bir tekrar kontrol
  setInterval(() => checkForUpdates(false), 4 * 60 * 60 * 1000);
}

function checkForUpdates(manual) {
  global.__manualCheck = manual;
  autoUpdater.checkForUpdates().catch(() => {
    if (manual) global.__manualCheck = false;
  });
}

// ── UYGULAMA YAŞAM DÖNGÜSÜ ─────────────────────────────────────────────
app.whenReady().then(() => {
  createSplash();
  // Splash'ı en az 1.2 sn göster (çok hızlı açılıp kapanmasın)
  setTimeout(() => {
    createWindow();
    createTray();
    setupAutoUpdater();
  }, 1200);
});

app.on('window-all-closed', () => {
  // Tray varken pencereler kapansa da uygulama açık kalır
  if (process.platform === 'darwin') return;
});

app.on('before-quit', () => { isQuitting = true; });

app.on('activate', () => {
  if (mainWindow) mainWindow.show();
  else if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on('retry-connection', () => loadApp());
