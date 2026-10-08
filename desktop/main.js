'use strict';
/* Lucha Café para Windows (Electron).
   - Ventana redimensionable (mínimo 640x400) que recuerda tamaño, posición y si estaba en pantalla completa.
   - Pantalla completa sin bordes con F11 o Alt+Enter (también desde Ajustes del juego, o la tecla F).
   - El juego se adapta solo a cualquier proporción: 16:9, 16:10, 3:2, 21:9, 32:9 (ver fit() en game.js).
   - Tasa de refresco: sigue al monitor (60 / 144 / 240 Hz). Para quitar el límite y el V-Sync (pruebas): ejecutar con LUCHA_SIN_LIMITE=1.
   - Seguridad: sin Node en la página, aislamiento de contexto, sandbox, sin navegación ni ventanas nuevas. */
const { app, BrowserWindow, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

if (process.env.LUCHA_SIN_LIMITE === '1') {
  app.commandLine.appendSwitch('disable-frame-rate-limit');
  app.commandLine.appendSwitch('disable-gpu-vsync');
}
app.commandLine.appendSwitch('force_high_performance_gpu');        // en laptops con dos tarjetas gráficas, usa la potente

if (!app.requestSingleInstanceLock()) { app.quit(); }

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (e) { return {}; }
}
function saveState(win) {
  try {
    if (win.isDestroyed()) return;
    const b = win.isFullScreen() || win.isMaximized() ? (loadState().bounds || win.getNormalBounds()) : win.getBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ bounds: b, max: win.isMaximized(), full: win.isFullScreen() }));
  } catch (e) { /* no es grave */ }
}
function onScreen(b) {
  return screen.getAllDisplays().some(d => b.x < d.bounds.x + d.bounds.width - 40 && b.x + b.width > d.bounds.x + 40 && b.y < d.bounds.y + d.bounds.height - 40 && b.y + b.height > d.bounds.y);
}

let win = null;
function createWindow() {
  const st = loadState();
  const wa = screen.getPrimaryDisplay().workAreaSize;
  const w = Math.min(1280, wa.width), h = Math.min(800, wa.height);
  const opts = { width: w, height: h, minWidth: 640, minHeight: 400, show: false, backgroundColor: '#0d0720', title: 'Lucha Café', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, backgroundThrottling: true } };
  if (st.bounds && onScreen(st.bounds)) Object.assign(opts, st.bounds);
  win = new BrowserWindow(opts);
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'www', 'index.html'));
  win.once('ready-to-show', () => { if (st.max) win.maximize(); win.show(); if (st.full) win.setFullScreen(true); });
  win.on('close', () => saveState(win));
  win.on('resized', () => saveState(win));
  win.on('moved', () => saveState(win));
  win.on('closed', () => { win = null; });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) { e.preventDefault(); toggleFullscreen(); }
  });
}
function toggleFullscreen() { if (win) { win.setFullScreen(!win.isFullScreen()); setTimeout(() => saveState(win), 300); } }
ipcMain.on('lucha:toggle-fullscreen', toggleFullscreen);

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
