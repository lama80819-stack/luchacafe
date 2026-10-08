// Puente mínimo y seguro entre el juego y la ventana nativa (el juego no tiene acceso a Node).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  toggleFullscreen: () => ipcRenderer.send('lucha:toggle-fullscreen'),
  platform: process.platform
});
