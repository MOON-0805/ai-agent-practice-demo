/**
 * 桌面宠物引擎 - DesktopPetEngine
 * 支持 GIF 动图播放
 */
class DesktopPetEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('❌ Canvas 元素不存在:', canvasId);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // 宠物状态
        this.pet = {
            x: this.width / 2,
            y: this.height / 2,
            size: 80,
            targetX: this.width / 2,
            targetY: this.height / 2,
            speed: 2.5,
            personality: 'lively',
            image: null,
            scaleX: 1,
            rotation: 0,
            opacity: 1,
            name: '小可爱',
            // GIF 支持（精灵图集优化）
            isGif: false,
            gifFrames: null,
            gifCurrentFrame: 0,
            gifTimer: 0,
        };
        
        // 动作系统
        this.currentAction = 'idle';
        this.actionTimer = 0;
        this.actionDuration = 2000;
        this.actionFrame = 0;
        this.running = false;
        this.animationId = null;
        this.lastTime = 0;
        
        // 鼠标交互
        this.mouseX = -1000;
        this.mouseY = -1000;
        this.isMouseOver = false;
        this.isMouseOnPet = false;
        this.clicked = false;
        this.clickTimer = 0;
        this.hoverTimer = 0;
        // 拖拽支持
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.wasRunningBeforeDrag = false;
        
        // 动作定义
        this.actions = {
            idle: { duration: 2000, weight: 1 },
            walk: { duration: 3000, weight: 3 },
            run: { duration: 2000, weight: 1 },
            jump: { duration: 1200, weight: 2 },
            happy: { duration: 1500, weight: 1 },
            wave: { duration: 2000, weight: 1 },
            think: { duration: 2500, weight: 1 },
        };
        
        this.personalityActions = {
            lively: ['walk', 'run', 'jump', 'happy', 'wave', 'think'],
            gentle: ['walk', 'wave', 'think', 'jump', 'happy'],
            lazy: ['idle', 'walk', 'think', 'wave', 'idle'],
        };
        
        this.bindEvents();
        this.resizeHandler = () => this.resize();
        window.addEventListener('resize', this.resizeHandler);
        
        this.hintEl = document.getElementById('hint');
        this.hintTimer = 0;
        
        this.lastTime = performance.now();
        this.render(this.lastTime);
        
        console.log('✅ DesktopPetEngine 构造函数完成');
    }
    
    bindEvents() {
        // ===== 鼠标移动 =====
        document.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
            
            // 拖拽中：更新宠物位置
            if (this.isDragging) {
                this.pet.x = e.clientX - this.dragOffsetX;
                this.pet.y = e.clientY - this.dragOffsetY;
                this.clampPosition();
                // 拖拽时也更新目标位置，防止松手后宠物跑回原处
                this.pet.targetX = this.pet.x;
                this.pet.targetY = this.pet.y;
                return;
            }
            
            // 非拖拽：检测鼠标悬停
            if (!this.isMouseOnPet && this.isPointNearPet(e.clientX, e.clientY)) {
                this.isMouseOnPet = true;
                this.hoverTimer = 0;
                if (window.electronAPI) {
                    window.electronAPI.setIgnoreMouse(false);
                }
            } else if (this.isMouseOnPet && !this.isPointNearPet(e.clientX, e.clientY)) {
                this.isMouseOnPet = false;
                if (window.electronAPI) {
                    window.electronAPI.setIgnoreMouse(true);
                }
            }
        });
        
        // ===== 鼠标按下（开始拖拽） =====
        document.addEventListener('mousedown', (e) => {
            if (this.isPointNearPet(e.clientX, e.clientY)) {
                this.isDragging = true;
                this.dragOffsetX = e.clientX - this.pet.x;
                this.dragOffsetY = e.clientY - this.pet.y;
                
                // 记录拖拽前的运行状态
                this.wasRunningBeforeDrag = this.running;
                // 拖拽时暂停自动移动
                this.running = false;
                
                // 确保鼠标穿透关闭，让拖拽能正常进行
                if (window.electronAPI) {
                    window.electronAPI.setIgnoreMouse(false);
                }
                
                this.showHint('✋ 拖拽中...');
                this.setAction('idle');
                console.log('✋ 开始拖拽宠物');
            }
        });
        
        // ===== 鼠标松开（结束拖拽） =====
        document.addEventListener('mouseup', (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                
                // 恢复拖拽前的运行状态
                if (this.wasRunningBeforeDrag) {
                    this.running = true;
                    this.setAction('walk');
                    this.setRandomTarget();
                }
                
                this.showHint('📍 放这里啦！');
                console.log('📍 拖拽结束，宠物已放置到新位置');
                
                // 恢复鼠标穿透（如果鼠标不在宠物上）
                if (window.electronAPI && !this.isPointNearPet(e.clientX, e.clientY)) {
                    window.electronAPI.setIgnoreMouse(true);
                }
            }
        });
        
        // ===== 点击宠物 =====
        document.addEventListener('click', (e) => {
            // 只有宠物在运行时才触发开心效果
            // 暂停状态下点击不触发，避免出现静态的"好喜欢"图像
            if (this.isPointNearPet(e.clientX, e.clientY) && !this.isDragging && this.running) {
                this.clicked = true;
                this.clickTimer = 800;
                this.setAction('happy');
                this.showHint('❤️ 好开心！');
            }
        });
        
        // ===== Electron IPC =====
        if (window.electronAPI) {
            window.electronAPI.onUpdatePetImage((dataUrl) => {
                this.setPetImage(dataUrl);
            });
            
            window.electronAPI.onUpdatePetConfig((config) => {
                this.setPetConfig(config);
            });
            
            window.electronAPI.onPetStart(() => this.start());
            window.electronAPI.onPetStop(() => this.stop());
            window.electronAPI.onPetReset(() => this.resetPosition());
            window.electronAPI.onRestartPet(() => {
                this.stop();
                setTimeout(() => this.start(), 500);
            });
            
            console.log('✅ electronAPI 事件监听已绑定');
        } else {
            console.warn('⚠️ window.electronAPI 不可用');
        }
    }
    
    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.clampPosition();
    }
    
    setPetImage(imageUrl) {
        const img = new Image();
        img.onload = () => {
            this.pet.image = img;
            console.log('✅ 宠物图片已加载');
        };
        img.onerror = (e) => {
            console.error('❌ 宠物图片加载失败:', e);
        };
        img.src = imageUrl;
    }
    
    // 加载 GIF 帧（使用精灵图集 + 离屏 Canvas 优化性能）
    loadGifFrames(gifUrl) {
        fetch(gifUrl)
            .then(response => response.arrayBuffer())
            .then(buffer => {
                const frames = this.parseGif(buffer);
                if (frames && frames.length > 0) {
                    // 创建精灵图集（Spritesheet）：将所有帧合并到一张大图上
                    const frameCount = frames.length;
                    const frameW = frames[0].width;
                    const frameH = frames[0].height;
                    
                    // 计算图集尺寸（横向排列）
                    const atlasWidth = frameW * frameCount;
                    const atlasHeight = frameH;
                    
                    // 创建离屏 Canvas 作为精灵图集
                    const atlasCanvas = document.createElement('canvas');
                    atlasCanvas.width = atlasWidth;
                    atlasCanvas.height = atlasHeight;
                    const atlasCtx = atlasCanvas.getContext('2d');
                    
                    // 将所有帧绘制到图集上
                    for (let i = 0; i < frameCount; i++) {
                        atlasCtx.drawImage(frames[i].canvas, i * frameW, 0, frameW, frameH);
                    }
                    
                    // 存储帧信息
                    this.pet.gifFrames = {
                        atlas: atlasCanvas,          // 精灵图集（一张大图）
                        frameCount: frameCount,       // 总帧数
                        frameWidth: frameW,           // 每帧宽度
                        frameHeight: frameH,          // 每帧高度
                        delays: frames.map(f => f.delay),  // 每帧延迟
                    };
                    this.pet.isGif = true;
                    this.pet.gifCurrentFrame = 0;
                    this.pet.gifTimer = 0;
                    // 设置第一帧为显示图像（使用图集）
                    this.pet.image = atlasCanvas;
                    
                    console.log(`✅ GIF 解析成功，共 ${frameCount} 帧（精灵图集优化）`);
                } else {
                    console.error('❌ GIF 解析失败');
                }
            })
            .catch(err => {
                console.error('❌ GIF 加载失败:', err);
            });
    }
    
    // GIF 帧解析器（解析 GIF87a/GIF89a 格式）
    parseGif(buffer) {
        const frames = [];
        const data = new Uint8Array(buffer);
        const dv = new DataView(buffer);
        
        // 检查 GIF 头
        const header = String.fromCharCode(data[0], data[1], data[2]);
        if (header !== 'GIF') {
            console.error('❌ 不是有效的 GIF 文件');
            return null;
        }
        
        // 宽度和高度
        const width = dv.getUint16(6, true);
        const height = dv.getUint16(8, true);
        
        // 全局颜色表信息
        const packed = data[10];
        const gctFlag = (packed & 0x80) >> 7;
        const gctSize = 2 << (packed & 0x07);
        
        // 背景色索引
        const bgColorIndex = data[11];
        
        // 全局颜色表
        let globalColorTable = null;
        let offset = 13;
        if (gctFlag) {
            globalColorTable = [];
            for (let i = 0; i < gctSize; i++) {
                globalColorTable.push({
                    r: data[offset + i * 3],
                    g: data[offset + i * 3 + 1],
                    b: data[offset + i * 3 + 2]
                });
            }
            offset += gctSize * 3;
        }
        
        // 解析图像数据块
        let canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        let ctx = canvas.getContext('2d');
        // 用透明背景初始化
        ctx.clearRect(0, 0, width, height);
        
        let frameCount = 0;
        let delayMs = 100;
        let disposalMethod = 0;
        let transparentIndex = -1;
        let localColorTable = globalColorTable;
        
        while (offset < data.length) {
            const blockType = data[offset];
            
            if (blockType === 0x21) {
                // 扩展块
                const label = data[offset + 1];
                if (label === 0xF9) {
                    // 图形控制扩展
                    const blockSize = data[offset + 2];
                    const packed2 = data[offset + 3];
                    disposalMethod = (packed2 & 0x1C) >> 2;
                    transparentIndex = (packed2 & 0x01) ? data[offset + 6] : -1;
                    delayMs = dv.getUint16(offset + 4, true) * 10;
                    if (delayMs < 50) delayMs = 100;
                    offset += blockSize + 4;
                } else {
                    // 其他扩展块，跳过
                    offset += 2;
                    while (offset < data.length && data[offset] !== 0x00) {
                        offset += data[offset] + 1;
                    }
                    offset++;
                }
            } else if (blockType === 0x2C) {
                // 图像描述符
                const left = dv.getUint16(offset + 1, true);
                const top = dv.getUint16(offset + 3, true);
                const imgWidth = dv.getUint16(offset + 5, true);
                const imgHeight = dv.getUint16(offset + 7, true);
                const packed3 = data[offset + 9];
                const lctFlag = (packed3 & 0x80) >> 7;
                const interlace = (packed3 & 0x40) >> 6;
                const lctSize = 2 << (packed3 & 0x07);
                
                offset += 10;
                
                // 局部颜色表
                if (lctFlag) {
                    localColorTable = [];
                    for (let i = 0; i < lctSize; i++) {
                        localColorTable.push({
                            r: data[offset + i * 3],
                            g: data[offset + i * 3 + 1],
                            b: data[offset + i * 3 + 2]
                        });
                    }
                    offset += lctSize * 3;
                } else {
                    localColorTable = globalColorTable;
                }
                
                // LZW 最小码长
                const lzwMinCodeSize = data[offset];
                offset++;
                
                // 读取压缩数据
                const compressedData = [];
                while (offset < data.length) {
                    const blockSize = data[offset];
                    if (blockSize === 0) break;
                    for (let i = 0; i < blockSize; i++) {
                        compressedData.push(data[offset + 1 + i]);
                    }
                    offset += blockSize + 1;
                }
                
                // 解码 LZW 压缩数据
                const indices = this.lzwDecode(compressedData, lzwMinCodeSize);
                
                // 根据索引生成像素
                const frameData = ctx.getImageData(0, 0, width, height);
                const px = frameData.data;
                
                // 处理隔行扫描
                const rows = [];
                if (interlace) {
                    // 隔行扫描顺序：0,8,16... / 4,12,20... / 2,6,10... / 1,3,5...
                    const passes = [
                        { start: 0, step: 8 },
                        { start: 4, step: 8 },
                        { start: 2, step: 4 },
                        { start: 1, step: 2 },
                    ];
                    let idx = 0;
                    for (const pass of passes) {
                        for (let y = pass.start; y < imgHeight; y += pass.step) {
                            rows[y] = [];
                            for (let x = 0; x < imgWidth; x++) {
                                rows[y].push(indices[idx++]);
                            }
                        }
                    }
                } else {
                    let idx = 0;
                    for (let y = 0; y < imgHeight; y++) {
                        rows[y] = [];
                        for (let x = 0; x < imgWidth; x++) {
                            rows[y].push(indices[idx++]);
                        }
                    }
                }
                
                // 写入像素数据
                for (let y = 0; y < imgHeight; y++) {
                    for (let x = 0; x < imgWidth; x++) {
                        const colorIndex = rows[y][x];
                        const targetX = left + x;
                        const targetY = top + y;
                        if (targetX >= width || targetY >= height) continue;
                        
                        const targetIdx = (targetY * width + targetX) * 4;
                        
                        if (colorIndex === transparentIndex) {
                            // 透明像素
                            px[targetIdx + 3] = 0;
                        } else if (localColorTable && colorIndex < localColorTable.length) {
                            const color = localColorTable[colorIndex];
                            px[targetIdx] = color.r;
                            px[targetIdx + 1] = color.g;
                            px[targetIdx + 2] = color.b;
                            px[targetIdx + 3] = 255;
                        }
                    }
                }
                
                // 处理 disposal method
                if (disposalMethod === 2) {
                    // 恢复到背景色
                    ctx.putImageData(frameData, 0, 0);
                } else if (disposalMethod === 3) {
                    // 恢复到上一帧
                    ctx.putImageData(frameData, 0, 0);
                } else {
                    // 保留当前帧
                    ctx.putImageData(frameData, 0, 0);
                }
                
                // 保存帧
                const frameCanvas = document.createElement('canvas');
                frameCanvas.width = width;
                frameCanvas.height = height;
                const frameCtx = frameCanvas.getContext('2d');
                frameCtx.drawImage(canvas, 0, 0);
                
                frames.push({
                    canvas: frameCanvas,
                    delay: delayMs,
                    width: imgWidth,
                    height: imgHeight,
                });
                
                frameCount++;
                
            } else if (blockType === 0x3B) {
                // 文件结束
                break;
            } else {
                // 未知块，跳过
                offset++;
            }
        }
        
        return frames;
    }
    
    // LZW 解码
    lzwDecode(compressedData, minCodeSize) {
        const result = [];
        const clearCode = 1 << minCodeSize;
        const endCode = clearCode + 1;
        let codeSize = minCodeSize + 1;
        let dict = [];
        let code = 0;
        let prev = null;
        let bitBuffer = 0;
        let bitCount = 0;
        
        // 初始化字典
        const initDict = () => {
            dict = [];
            for (let i = 0; i < clearCode; i++) {
                dict.push([i]);
            }
            dict.push([]); // clear code
            dict.push([]); // end code
            codeSize = minCodeSize + 1;
        };
        
        initDict();
        
        for (let i = 0; i < compressedData.length; i++) {
            bitBuffer |= compressedData[i] << bitCount;
            bitCount += 8;
            
            while (bitCount >= codeSize) {
                code = bitBuffer & ((1 << codeSize) - 1);
                bitBuffer >>= codeSize;
                bitCount -= codeSize;
                
                if (code === clearCode) {
                    initDict();
                    prev = null;
                    continue;
                }
                if (code === endCode) {
                    return result;
                }
                
                if (prev === null) {
                    if (code < dict.length && dict[code].length > 0) {
                        result.push(dict[code][0]);
                        prev = code;
                    }
                    continue;
                }
                
                if (code < dict.length) {
                    const entry = dict[code];
                    for (const idx of entry) {
                        result.push(idx);
                    }
                    // 添加新条目
                    const prevEntry = dict[prev];
                    const newEntry = [...prevEntry, entry[0]];
                    dict.push(newEntry);
                    prev = code;
                } else {
                    // 特殊情况：code == dict.length
                    const prevEntry = dict[prev];
                    const newEntry = [...prevEntry, prevEntry[0]];
                    for (const idx of newEntry) {
                        result.push(idx);
                    }
                    dict.push(newEntry);
                    prev = code;
                }
                
                // 字典大小达到 2^codeSize 时，增加码长
                if (dict.length >= (1 << codeSize) && codeSize < 12) {
                    codeSize++;
                }
            }
        }
        
        return result;
    }
    
    setPetConfig(config) {
        if (config.name !== undefined) this.pet.name = config.name;
        if (config.size !== undefined) this.pet.size = parseInt(config.size);
        if (config.speed !== undefined) {
            const speedMap = { slow: 1, medium: 2.5, fast: 4.5 };
            this.pet.speed = speedMap[config.speed] || 2.5;
        }
        if (config.personality !== undefined) {
            this.pet.personality = config.personality;
        }
        // GIF 配置
        if (config.isGif && config.gifUrl) {
            this.loadGifFrames(config.gifUrl);
        }
        console.log('✅ 宠物配置已更新:', config);
    }
    
    isPointNearPet(x, y) {
        const dx = x - this.pet.x;
        const dy = y - this.pet.y;
        return Math.sqrt(dx * dx + dy * dy) < this.pet.size * 0.8;
    }
    
    setRandomTarget() {
        const margin = this.pet.size + 20;
        this.pet.targetX = margin + Math.random() * (this.width - margin * 2);
        this.pet.targetY = margin + Math.random() * (this.height - margin * 2);
    }
    
    setAction(actionName) {
        if (this.actions[actionName]) {
            this.currentAction = actionName;
            this.actionDuration = this.actions[actionName].duration;
            this.actionFrame = 0;
            this.actionTimer = 0;
        }
    }
    
    randomAction() {
        const actions = this.personalityActions[this.pet.personality] || this.personalityActions.lively;
        const weights = actions.map(a => this.actions[a] ? this.actions[a].weight : 1);
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let random = Math.random() * totalWeight;
        for (let i = 0; i < actions.length; i++) {
            random -= weights[i];
            if (random <= 0) return actions[i];
        }
        return 'walk';
    }
    
    updateAction(deltaTime) {
        this.actionTimer += deltaTime;
        this.actionFrame += deltaTime * 0.001;
        
        if (this.actionTimer >= this.actionDuration) {
            // 不同性格有不同的动作切换间隔
            // 活泼：切换快（1.5-3秒）
            // 温和：切换适中（3-5秒）
            // 慵懒：切换慢（5-8秒）
            let minDelay, maxDelay;
            switch (this.pet.personality) {
                case 'lively':
                    minDelay = 1500; maxDelay = 3000;
                    break;
                case 'gentle':
                    minDelay = 3000; maxDelay = 5000;
                    break;
                case 'lazy':
                    minDelay = 5000; maxDelay = 8000;
                    break;
                default:
                    minDelay = 3000; maxDelay = 5000;
            }
            const delay = minDelay + Math.random() * (maxDelay - minDelay);
            if (this.actionTimer >= this.actionDuration + delay) {
                const newAction = this.randomAction();
                this.setAction(newAction);
                if (newAction === 'walk' || newAction === 'run') {
                    this.setRandomTarget();
                }
            }
        }
    }
    
    updatePosition(deltaTime) {
        const dx = this.pet.targetX - this.pet.x;
        const dy = this.pet.targetY - this.pet.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 5) {
            // 不同性格有不同的移动速度加成
            // 活泼：速度 x1.3
            // 温和：速度 x1.0
            // 慵懒：速度 x0.6
            let personalitySpeed = 1.0;
            switch (this.pet.personality) {
                case 'lively': personalitySpeed = 1.3; break;
                case 'gentle': personalitySpeed = 1.0; break;
                case 'lazy': personalitySpeed = 0.6; break;
            }
            const speed = this.pet.speed * personalitySpeed * (deltaTime / 16);
            const moveSpeed = Math.min(speed, dist);
            this.pet.x += (dx / dist) * moveSpeed;
            this.pet.y += (dy / dist) * moveSpeed;
            
            if (dx !== 0) {
                this.pet.scaleX = dx > 0 ? 1 : -1;
            }
        } else {
            if (this.currentAction === 'walk' || this.currentAction === 'run') {
                this.setAction('idle');
            }
        }
        
        this.clampPosition();
    }
    
    clampPosition() {
        const margin = this.pet.size / 2;
        this.pet.x = Math.max(margin, Math.min(this.width - margin, this.pet.x));
        this.pet.y = Math.max(margin, Math.min(this.height - margin, this.pet.y));
        
        if (this.pet.x <= margin || this.pet.x >= this.width - margin ||
            this.pet.y <= margin || this.pet.y >= this.height - margin) {
            if (this.currentAction === 'walk' || this.currentAction === 'run') {
                this.setRandomTarget();
            }
        }
    }
    
    updateMouseInteraction() {
        if (this.isMouseOnPet) {
            const dx = this.mouseX - this.pet.x;
            if (Math.abs(dx) > 10) {
                this.pet.scaleX = dx > 0 ? 1 : -1;
            }
        }
    }
    
    showHint(text) {
        if (this.hintEl) {
            this.hintEl.textContent = text;
            this.hintEl.classList.add('show');
            this.hintTimer = 2000;
        }
    }
    
    // ===== 渲染 =====
    renderPet(ctx, x, y, size, scaleX, rotation, opacity, action, frame) {
        ctx.save();
        ctx.globalAlpha = opacity || 1;
        ctx.translate(x, y);
        ctx.scale(scaleX || 1, 1);
        ctx.rotate(rotation || 0);
        
        const halfSize = (size || this.pet.size) / 2;
        
        // 绘制性格标识（宠物头顶）
        if (opacity >= 1) {
            const personalityIcons = {
                lively: '⚡',
                gentle: '🌿',
                lazy: '😴',
            };
            const icon = personalityIcons[this.pet.personality] || '🐾';
            ctx.font = `${Math.max(12, size * 0.15)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(icon, 0, -halfSize - 10);
        }
        
        if (this.pet.image) {
            const imgSize = size || this.pet.size;
            let offsetY = 0;
            let scaleY = 1;
            
            switch (action) {
                case 'jump':
                    const jumpProgress = Math.sin(frame * Math.PI * 2);
                    offsetY = -Math.abs(jumpProgress) * imgSize * 0.4;
                    scaleY = 1 - Math.abs(jumpProgress) * 0.2;
                    break;
                case 'happy':
                    const happyRotate = Math.sin(frame * Math.PI * 4) * 0.3;
                    ctx.rotate(happyRotate);
                    offsetY = -Math.sin(frame * Math.PI * 2) * imgSize * 0.15;
                    break;
                case 'wave':
                    const waveRotate = Math.sin(frame * Math.PI * 3) * 0.2;
                    ctx.rotate(waveRotate);
                    break;
                case 'think':
                    const thinkRotate = Math.sin(frame * 0.5) * 0.1;
                    ctx.rotate(thinkRotate);
                    offsetY = -imgSize * 0.05;
                    break;
                case 'run':
                    offsetY = Math.sin(frame * Math.PI * 6) * imgSize * 0.05;
                    break;
                case 'walk':
                    offsetY = Math.sin(frame * Math.PI * 4) * imgSize * 0.03;
                    break;
            }
            
            // 如果是 GIF 精灵图集，只绘制当前帧区域
            if (this.pet.isGif && this.pet.gifFrames && this.pet.gifFrames.atlas) {
                const gif = this.pet.gifFrames;
                const frameX = this.pet.gifCurrentFrame * gif.frameWidth;
                ctx.drawImage(
                    this.pet.image,
                    frameX, 0, gif.frameWidth, gif.frameHeight,  // 源区域（当前帧）
                    -halfSize, -halfSize + offsetY, imgSize, imgSize * scaleY  // 目标区域
                );
            } else {
                ctx.drawImage(this.pet.image, -halfSize, -halfSize + offsetY, imgSize, imgSize * scaleY);
            }
        } else {
            this.drawDefaultPet(ctx, halfSize, action, frame);
        }
        
        ctx.restore();
    }
    
    drawDefaultPet(ctx, size, action, frame) {
        const s = size;
        const gradient = ctx.createRadialGradient(-s * 0.2, -s * 0.2, 0, 0, 0, s);
        gradient.addColorStop(0, '#ffecd2');
        gradient.addColorStop(1, '#fcb69f');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fcb69f';
        ctx.beginPath();
        ctx.ellipse(-s * 0.5, -s * 0.6, s * 0.25, s * 0.35, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s * 0.5, -s * 0.6, s * 0.25, s * 0.35, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#f8a5a5';
        ctx.beginPath();
        ctx.ellipse(-s * 0.5, -s * 0.55, s * 0.12, s * 0.2, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s * 0.5, -s * 0.55, s * 0.12, s * 0.2, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        const eyeY = -s * 0.1;
        let eyeOffsetY = 0;
        if (action === 'think') eyeOffsetY = -s * 0.05;
        
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.ellipse(-s * 0.25, eyeY + eyeOffsetY, s * 0.1, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s * 0.25, eyeY + eyeOffsetY, s * 0.1, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(-s * 0.22, eyeY - s * 0.04 + eyeOffsetY, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 0.28, eyeY - s * 0.04 + eyeOffsetY, s * 0.04, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#e17055';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (action === 'happy' || action === 'wave') {
            ctx.arc(0, s * 0.1, s * 0.2, 0.1, Math.PI - 0.1);
        } else if (action === 'think') {
            ctx.arc(s * 0.1, s * 0.15, s * 0.08, 0, Math.PI * 2);
        } else {
            ctx.arc(0, s * 0.15, s * 0.15, 0.1, Math.PI - 0.1);
        }
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 150, 150, 0.3)';
        ctx.beginPath();
        ctx.ellipse(-s * 0.4, s * 0.15, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s * 0.4, s * 0.15, s * 0.12, s * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    render(timestamp) {
        const deltaTime = Math.min(timestamp - this.lastTime, 50);
        this.lastTime = timestamp;
        
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        
        if (this.running && !this.isDragging) {
            this.updateAction(deltaTime);
            this.updatePosition(deltaTime);
            this.updateMouseInteraction();
            
            if (this.clicked) {
                this.clickTimer -= deltaTime;
                if (this.clickTimer <= 0) this.clicked = false;
            }
        }
        
        // 更新 GIF 帧动画（使用精灵图集，无需重新赋值 image）
        if (this.pet.isGif && this.pet.gifFrames && this.pet.gifFrames.frameCount > 0) {
            this.pet.gifTimer += deltaTime;
            const delay = this.pet.gifFrames.delays[this.pet.gifCurrentFrame] || 100;
            if (this.pet.gifTimer >= delay) {
                this.pet.gifTimer = 0;
                this.pet.gifCurrentFrame = (this.pet.gifCurrentFrame + 1) % this.pet.gifFrames.frameCount;
                // 不需要重新赋值 this.pet.image，因为精灵图集一直不变
                // 只需要更新 gifCurrentFrame，绘制时从图集中截取对应区域
            }
        }
        
        // 绘制宠物
        this.renderPet(ctx, this.pet.x, this.pet.y, this.pet.size, this.pet.scaleX, this.pet.rotation, 1, this.currentAction, this.actionFrame);
        
        // 拖拽时绘制拖拽指示器
        if (this.isDragging) {
            ctx.save();
            ctx.shadowColor = 'rgba(102, 126, 234, 0.5)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            this.renderPet(ctx, this.pet.x, this.pet.y, this.pet.size, this.pet.scaleX, this.pet.rotation, 1, 'idle', 0);
            ctx.restore();
            
            ctx.save();
            ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(this.pet.x, this.pet.y, this.pet.size * 0.8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        
        // 点击特效
        if (this.clicked) {
            this.drawClickEffect(ctx);
        }
        
        if (this.hintTimer > 0) {
            this.hintTimer -= deltaTime;
            if (this.hintTimer <= 0) {
                if (this.hintEl) this.hintEl.classList.remove('show');
            }
        }
        
        this.animationId = requestAnimationFrame((t) => this.render(t));
    }
    
    drawClickEffect(ctx) {
        const progress = 1 - (this.clickTimer / 800);
        const radius = 20 + progress * 40;
        const alpha = 1 - progress;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.pet.x, this.pet.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        const heartCount = 3;
        for (let i = 0; i < heartCount; i++) {
            const angle = (i / heartCount) * Math.PI * 2 + progress * Math.PI;
            const dist = radius + 10;
            const hx = this.pet.x + Math.cos(angle) * dist;
            const hy = this.pet.y + Math.sin(angle) * dist;
            ctx.font = `${16 + progress * 8}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('❤️', hx, hy);
        }
        ctx.restore();
    }
    
    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        this.setAction('walk');
        this.setRandomTarget();
        this.showHint('🐾 我来啦！');
        console.log('✅ 宠物已启动');
    }
    
    stop() {
        this.running = false;
        this.setAction('idle');
        this.showHint('😴 休息一下~');
        console.log('⏸ 宠物已暂停');
    }
    
    resetPosition() {
        this.pet.x = this.width / 2;
        this.pet.y = this.height / 2;
        this.pet.targetX = this.pet.x;
        this.pet.targetY = this.pet.y;
        this.setAction('idle');
        this.showHint('📍 回到中间啦');
        console.log('📍 宠物已重置位置');
    }
    
    getConfig() {
        const speedMap = { 1: 'slow', 2.5: 'medium', 4.5: 'fast' };
        return {
            name: this.pet.name,
            size: this.pet.size,
            speed: speedMap[this.pet.speed] || 'medium',
            personality: this.pet.personality,
            position: { x: this.pet.x, y: this.pet.y },
        };
    }
}