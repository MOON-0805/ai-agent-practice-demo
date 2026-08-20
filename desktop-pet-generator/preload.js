const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    // 设置宠物图片（带宠物索引）
    setPetImage: (dataUrl, petIndex = 0) => 
        ipcRenderer.send('set-pet-image', { petIndex, dataUrl }),
    onUpdatePetImage: (callback) => 
        ipcRenderer.on('update-pet-image', (event, data) => callback(data)),
    
    // 设置宠物配置（带宠物索引）
    setPetConfig: (config, petIndex = 0) => 
        ipcRenderer.send('set-pet-config', { petIndex, config }),
    onUpdatePetConfig: (callback) => 
        ipcRenderer.on('update-pet-config', (event, data) => callback(data)),
    
    // 控制命令（带宠物索引）
    onPetStart: (callback) => ipcRenderer.on('pet-start', () => callback()),
    onPetStop: (callback) => ipcRenderer.on('pet-stop', () => callback()),
    onPetReset: (callback) => ipcRenderer.on('pet-reset', () => callback()),
    onRestartPet: (callback) => ipcRenderer.on('restart-pet', () => callback()),
    
    // 发送控制命令（带宠物索引）
    sendPetStart: (petIndex) => ipcRenderer.send('pet-start', petIndex),
    sendPetStop: (petIndex) => ipcRenderer.send('pet-stop', petIndex),
    sendPetReset: (petIndex) => ipcRenderer.send('pet-reset', petIndex),
    
    // 鼠标穿透
    setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
    
    // 可见性控制
    togglePetVisibility: () => ipcRenderer.send('toggle-pet-visibility'),
    onPetVisibilityChanged: (callback) => 
        ipcRenderer.on('pet-visibility-changed', (event, visible) => callback(visible)),
    getPetVisibility: () => ipcRenderer.send('get-pet-visibility'),
    
    addPetWindow: (petIndex) => ipcRenderer.send('add-pet-window', petIndex),
    removePetWindow: (petIndex) => ipcRenderer.send('remove-pet-window', petIndex),
    // 导出
    exportConfig: (config) => ipcRenderer.send('export-config', config),
    onExportResult: (callback) => 
        ipcRenderer.on('export-config-result', (event, data) => callback(data)),
});