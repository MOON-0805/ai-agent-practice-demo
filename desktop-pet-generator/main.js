const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// ===== 安全的日志函数（避免 EPIPE 管道断裂崩溃） =====
// 问题：当终端/输出流关闭后，console.log 写入会抛出 EPIPE 异常导致崩溃
// 方案：自定义安全日志函数，捕获所有日志写入异常
const log = (...args) => {
    try {
        console.log(...args);
    } catch (e) {
        // 忽略 EPIPE 等输出流错误，不崩溃
        try { process.stderr.write('[log-ignored]'); } catch (_) {}
    }
};

// ===== 隐藏 Electron 启动画面和 Dock 图标 =====
// 避免用户看到 Electron 框架本身的窗口/图标
// 注意：通过 spawn 直接启动时 app.dock 可能为 undefined，需加保护
try {
    if (app.dock) app.dock.hide();  // 隐藏 Dock 图标
} catch (_) {}
try {
    app.setName('桌面宠物生成器');  // 设置应用名称
} catch (_) {}

// 全局错误处理：捕获所有未处理的异常，避免崩溃
process.on('uncaughtException', (err) => {
    try {
        console.error('未捕获异常:', err);
    } catch (_) {}
});

process.on('unhandledRejection', (reason) => {
    try {
        console.error('未处理的Promise拒绝:', reason);
    } catch (_) {}
});

// 重定向 stdout/stderr 到文件，避免管道断开崩溃
const logFile = path.join(app.getPath('userData'), 'desktop-pet.log');
try {
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    process.stdout.write = (chunk) => { try { logStream.write(chunk); } catch (_) {} };
    process.stderr.write = (chunk) => { try { logStream.write(chunk); } catch (_) {} };
} catch (_) {}
// 多宠物支持：最多 5 个宠物
const MAX_PETS = 5;
let petWindows = [];      // 宠物窗口数组
let configWindow = null;  // 标准配置面板窗口
let fullConfigWindow = null;  // 全屏配置面板窗口
let tray = null;
let isPetVisible = true;
// 创建默认托盘图标
function createTrayIcon() {
    const size = 32;
    const buf = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            let r = 0, g = 0, b = 0, a = 0;
            const dx1 = x - 16, dy1 = y - 18;
            if (dx1 * dx1 + dy1 * dy1 <= 36) { r = 102; g = 126; b = 234; a = 255; }
            const pads = [[8,8], [24,8], [12,6], [20,6]];
            for (const [cx, cy] of pads) {
                const dx = x - cx, dy = y - cy;
                if (dx * dx + dy * dy <= 9) { r = 102; g = 126; b = 234; a = 255; }
            }
            buf[idx] = r; buf[idx+1] = g; buf[idx+2] = b; buf[idx+3] = a;
        }
    }
    return nativeImage.createFromBuffer(buf, { width: size, height: size });
}
// 创建单个宠物窗口
function createPetWindow(index) {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    
    const win = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        transparent: true,
        frame: false,
        resizable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        hasShadow: false,
        focusable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    
    win.loadFile(path.join(__dirname, 'src', 'pet-window.html'));
    
    win.webContents.on('did-finish-load', () => {
        log(`✅ 宠物窗口 ${index + 1} 加载完成`);
        win.setIgnoreMouseEvents(true, { forward: true });
        win.setAlwaysOnTop(true, 'screen-saver');
    });
    
    win.on('closed', () => {
        petWindows[index] = null;
    });
    
    return win;
}
// 创建配置面板窗口
function createConfigWindow() {
    configWindow = new BrowserWindow({
        width: 480,
        height: 750,
        resizable: true,
        frame: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    
    configWindow.loadFile(path.join(__dirname, 'src', 'config.html'));
    
    configWindow.on('closed', () => {
        configWindow = null;
    });
}
// 创建全屏配置面板窗口
function createFullConfigWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    
    fullConfigWindow = new BrowserWindow({
        width: width,
        height: height,
        resizable: true,
        frame: true,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });
    
    fullConfigWindow.loadFile(path.join(__dirname, 'src', 'config-full.html'));
    
    fullConfigWindow.on('closed', () => {
        fullConfigWindow = null;
    });
}
// 创建系统托盘
function createTray() {
    tray = new Tray(createTrayIcon());
    
    const contextMenu = Menu.buildFromTemplate([
        { label: '🐾 打开标准面板', click: () => {
            if (!configWindow) createConfigWindow();
            else configWindow.focus();
        }},
        { label: '🖥️ 打开全屏面板', click: () => {
            if (!fullConfigWindow) createFullConfigWindow();
            else fullConfigWindow.focus();
        }},
        { label: '🔄 重启所有宠物', click: () => {
            petWindows.forEach((win, i) => {
                if (win) win.webContents.send('restart-pet');
            });
        }},
        { type: 'separator' },
        { label: '🚪 退出', click: () => {
            app.isQuitting = true;
            app.quit();
        }},
    ]);
    
    tray.setToolTip('🐾 桌面宠物');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
        if (!configWindow) createConfigWindow();
        else configWindow.focus();
    });
}
// IPC 通信处理
// 设置宠物图片（指定宠物索引）
ipcMain.on('set-pet-image', (event, data) => {
    const petIndex = data.petIndex || 0;
    const dataUrl = data.dataUrl;
    if (petWindows[petIndex]) {
        petWindows[petIndex].webContents.send('update-pet-image', dataUrl);
    }
});
// 设置宠物配置（指定宠物索引）
ipcMain.on('set-pet-config', (event, data) => {
    const petIndex = data.petIndex || 0;
    const config = data.config;
    if (petWindows[petIndex]) {
        petWindows[petIndex].webContents.send('update-pet-config', config);
    }
});
// 启动宠物
ipcMain.on('pet-start', (event, petIndex) => {
    if (petIndex !== undefined && petWindows[petIndex]) {
        petWindows[petIndex].webContents.send('pet-start');
    } else {
        petWindows.forEach(win => {
            if (win) win.webContents.send('pet-start');
        });
    }
});
// 停止宠物
ipcMain.on('pet-stop', (event, petIndex) => {
    if (petIndex !== undefined && petWindows[petIndex]) {
        petWindows[petIndex].webContents.send('pet-stop');
    } else {
        petWindows.forEach(win => {
            if (win) win.webContents.send('pet-stop');
        });
    }
});
// 重置宠物位置
ipcMain.on('pet-reset', (event, petIndex) => {
    if (petIndex !== undefined && petWindows[petIndex]) {
        petWindows[petIndex].webContents.send('pet-reset');
    } else {
        petWindows.forEach(win => {
            if (win) win.webContents.send('pet-reset');
        });
    }
});
// 鼠标穿透控制
ipcMain.on('set-ignore-mouse', (event, ignore) => {
    const petIndex = event.sender.id;
    petWindows.forEach(win => {
        if (win && win.webContents.id === petIndex) {
            win.setIgnoreMouseEvents(ignore, { forward: true });
        }
    });
});
// 切换宠物可见性
ipcMain.on('toggle-pet-visibility', () => {
    isPetVisible = !isPetVisible;
    petWindows.forEach(win => {
        if (win) {
            if (isPetVisible) win.show();
            else win.hide();
        }
    });
    if (configWindow) {
        configWindow.webContents.send('pet-visibility-changed', isPetVisible);
    }
});
// 获取宠物可见性
ipcMain.on('get-pet-visibility', (event) => {
    event.sender.send('pet-visibility-changed', isPetVisible);
});
// 添加宠物窗口
ipcMain.on('add-pet-window', (event, petIndex) => {
    if (petIndex < MAX_PETS && !petWindows[petIndex]) {
        petWindows[petIndex] = createPetWindow(petIndex);
        log(`✅ 已添加宠物窗口 ${petIndex + 1}`);
    }
});

// 移除宠物窗口
ipcMain.on('remove-pet-window', (event, petIndex) => {
    if (petWindows[petIndex]) {
        petWindows[petIndex].close();
        petWindows[petIndex] = null;
        log(`✅ 已移除宠物窗口 ${petIndex + 1}`);
        
        // 将后面的宠物窗口索引前移（重新编号）
        for (let i = petIndex + 1; i < petWindows.length; i++) {
            if (petWindows[i]) {
                petWindows[i - 1] = petWindows[i];
                petWindows[i] = null;
            }
        }
        // 更新宠物窗口的索引（通过重新加载配置）
        petWindows.forEach((win, idx) => {
            if (win) {
                win.webContents.send('update-pet-index', idx);
            }
        });
    }
});

// 导出配置
ipcMain.on('export-config', (event, config) => {
    const { dialog } = require('electron');
    const fs = require('fs');
    
    dialog.showSaveDialog(configWindow, {
        title: '导出宠物配置',
        defaultPath: `${config.name || '宠物'}-配置.json`,
        filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    }).then(result => {
        if (!result.canceled && result.filePath) {
            fs.writeFileSync(result.filePath, JSON.stringify(config, null, 2), 'utf-8');
            event.sender.send('export-config-result', { success: true, path: result.filePath });
        }
    }).catch(err => {
        event.sender.send('export-config-result', { success: false, error: err.message });
    });
});
app.whenReady().then(() => {
    // 隐藏 Dock 图标（避免 Electron 框架弹出）
    try { if (app.dock) app.dock.hide(); } catch (_) {}
    
    // 创建 1 个宠物窗口（默认）
    petWindows.push(createPetWindow(0));
    createConfigWindow();
    createFullConfigWindow();
    createTray();
    
    // 确保应用保持运行（即使所有窗口关闭）
    app.on('window-all-closed', (e) => {
        // 阻止默认退出行为
        if (e) e.preventDefault();
    });
});
app.on('window-all-closed', (e) => {
    // 保留应用运行（避免宠物窗口关闭导致应用退出）
    // 在 macOS 上始终不退出，保持后台运行
    e.preventDefault();
});
app.on('activate', () => {
    if (!configWindow) createConfigWindow();
    if (petWindows.length === 0) {
        petWindows.push(createPetWindow(0));
    }
});
app.on('before-quit', () => {
    app.isQuitting = true;
});