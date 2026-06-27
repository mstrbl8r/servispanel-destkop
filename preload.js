const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
  retryConnection: () => ipcRenderer.send('retry-connection'),
});
