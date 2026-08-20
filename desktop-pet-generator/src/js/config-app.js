// ===== 粒子背景 =====
class ParticleBackground {
    constructor() {
        this.container = document.getElementById('particles-canvas');
        this.init();
    }
    init() {
        const count = 40;
        const colors = ['#ffffff', '#ffecd2', '#fcb69f', '#a8e6cf', '#dcedc1'];
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = 2 + Math.random() * 5;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const duration = 15 + Math.random() * 25;
            const delay = Math.random() * 20;
            const startX = Math.random() * window.innerWidth;
            p.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                left: ${startX}px;
                border-radius: 50%;
                pointer-events: none;
                animation: float-particle ${duration}s linear ${delay}s infinite;
                box-shadow: 0 0 ${size * 2}px ${color};
            `;
            this.container.appendChild(p);
        }
    }
}
const style = document.createElement('style');
style.textContent = `
    @keyframes float-particle {
        0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(-10vh) rotate(720deg); opacity: 0; }
    }
`;
document.head.appendChild(style);
// ===== Toast =====
class ToastManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
    }
    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = {
            success: '<i class="fas fa-check-circle" style="color: #4ecdc4;"></i>',
            error: '<i class="fas fa-exclamation-circle" style="color: #fc5c65;"></i>',
            info: '<i class="fas fa-info-circle" style="color: #f093fb;"></i>',
        };
        toast.innerHTML = `${icons[type] || icons.info} ${message}`;
        this.container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    success(msg) { this.show(msg, 'success'); }
    error(msg) { this.show(msg, 'error'); }
    info(msg) { this.show(msg, 'info'); }
    warning(msg) { this.show(msg, 'info'); }
}
// ===== 背景去除 =====
class BackgroundRemover {
    async removeBackground(imageFile) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(imageFile);
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    const w = canvas.width;
                    const h = canvas.height;
                    
                    // Canny 边缘检测 + 泛洪填充算法
                    // 1. 计算梯度图
                    const gradient = new Float32Array(w * h);
                    const gradX = new Float32Array(w * h);
                    const gradY = new Float32Array(w * h);
                    for (let y = 1; y < h - 1; y++) {
                        for (let x = 1; x < w - 1; x++) {
                            let maxG = 0, maxGx = 0, maxGy = 0;
                            for (let c = 0; c < 3; c++) {
                                const gx = 
                                    -data[(y-1)*w*4 + (x-1)*4 + c] + data[(y-1)*w*4 + (x+1)*4 + c]
                                    -2*data[y*w*4 + (x-1)*4 + c] + 2*data[y*w*4 + (x+1)*4 + c]
                                    -data[(y+1)*w*4 + (x-1)*4 + c] + data[(y+1)*w*4 + (x+1)*4 + c];
                                const gy = 
                                    -data[(y-1)*w*4 + (x-1)*4 + c] -2*data[(y-1)*w*4 + x*4 + c] - data[(y-1)*w*4 + (x+1)*4 + c]
                                    +data[(y+1)*w*4 + (x-1)*4 + c] +2*data[(y+1)*w*4 + x*4 + c] + data[(y+1)*w*4 + (x+1)*4 + c];
                                const g = Math.sqrt(gx * gx + gy * gy);
                                if (g > maxG) { maxG = g; maxGx = gx; maxGy = gy; }
                            }
                            gradient[y * w + x] = maxG;
                            gradX[y * w + x] = maxGx;
                            gradY[y * w + x] = maxGy;
                        }
                    }
                    
                    // 2. Canny 非极大值抑制
                    const lowThreshold = 8, highThreshold = 30;
                    const suppressed = new Float32Array(w * h);
                    for (let y = 1; y < h - 1; y++) {
                        for (let x = 1; x < w - 1; x++) {
                            const idx = y * w + x;
                            const g = gradient[idx];
                            if (g < lowThreshold) continue;
                            const angle = Math.atan2(gradY[idx], gradX[idx]) * 180 / Math.PI;
                            let q1, q2;
                            if ((angle >= -22.5 && angle < 22.5) || (angle >= 157.5 || angle < -157.5)) {
                                q1 = gradient[idx - 1]; q2 = gradient[idx + 1];
                            } else if ((angle >= 22.5 && angle < 67.5) || (angle >= -157.5 && angle < -112.5)) {
                                q1 = gradient[idx - w - 1]; q2 = gradient[idx + w + 1];
                            } else if ((angle >= 67.5 && angle < 112.5) || (angle >= -112.5 && angle < -67.5)) {
                                q1 = gradient[idx - w]; q2 = gradient[idx + w];
                            } else {
                                q1 = gradient[idx - w + 1]; q2 = gradient[idx + w - 1];
                            }
                            if (g >= q1 && g >= q2) suppressed[idx] = g;
                        }
                    }
                    
                    // 双阈值滞后连接
                    const isEdge = new Uint8Array(w * h);
                    for (let i = 0; i < w * h; i++) {
                        if (suppressed[i] >= highThreshold) isEdge[i] = 1;
                    }
                    const dirs8 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
                    let changed = true;
                    let iterations = 0;
                    while (changed && iterations < 10) {
                        changed = false; iterations++;
                        for (let y = 1; y < h - 1; y++) {
                            for (let x = 1; x < w - 1; x++) {
                                const idx = y * w + x;
                                if (isEdge[idx]) continue;
                                if (suppressed[idx] >= lowThreshold) {
                                    for (const [dx, dy] of dirs8) {
                                        const nIdx = (y + dy) * w + (x + dx);
                                        if (isEdge[nIdx]) { isEdge[idx] = 1; changed = true; break; }
                                    }
                                }
                            }
                        }
                    }
                    
                    // 3. 形态学膨胀
                    const dilated = new Uint8Array(w * h);
                    for (let pass = 0; pass < 2; pass++) {
                        for (let y = 1; y < h - 1; y++) {
                            for (let x = 1; x < w - 1; x++) {
                                const idx = y * w + x;
                                if (isEdge[idx]) {
                                    for (const [dx, dy] of dirs8) {
                                        dilated[(y + dy) * w + (x + dx)] = 1;
                                    }
                                }
                            }
                        }
                        for (let i = 0; i < w * h; i++) {
                            if (dilated[i]) isEdge[i] = 1;
                        }
                        if (pass < 1) dilated.fill(0);
                    }
                    
                    // 4. 采样背景颜色
                    const bgColors = [];
                    const step = 3;
                    for (let x = 0; x < w; x += step) {
                        if (!isEdge[x]) {
                            const pi = x * 4;
                            bgColors.push({ r: data[pi], g: data[pi+1], b: data[pi+2] });
                        }
                        const bottomIdx = (h - 1) * w + x;
                        if (!isEdge[bottomIdx]) {
                            const pi = bottomIdx * 4;
                            bgColors.push({ r: data[pi], g: data[pi+1], b: data[pi+2] });
                        }
                    }
                    for (let y = 0; y < h; y += step) {
                        const leftIdx = y * w;
                        if (!isEdge[leftIdx]) {
                            const pi = leftIdx * 4;
                            bgColors.push({ r: data[pi], g: data[pi+1], b: data[pi+2] });
                        }
                        const rightIdx = y * w + w - 1;
                        if (!isEdge[rightIdx]) {
                            const pi = rightIdx * 4;
                            bgColors.push({ r: data[pi], g: data[pi+1], b: data[pi+2] });
                        }
                    }
                    const cornerSize = Math.min(15, Math.floor(w * 0.08));
                    for (let y = 0; y < cornerSize; y += step) {
                        for (let x = 0; x < cornerSize; x += step) {
                            const positions = [[x,y],[w-1-x,y],[x,h-1-y],[w-1-x,h-1-y]];
                            for (const [px, py] of positions) {
                                const idx = py * w + px;
                                if (!isEdge[idx]) {
                                    const pi = idx * 4;
                                    bgColors.push({ r: data[pi], g: data[pi+1], b: data[pi+2] });
                                }
                            }
                        }
                    }
                    if (bgColors.length === 0) bgColors.push({ r: 255, g: 255, b: 255 });
                    
                    const bgClusters = this.kMeansCluster(bgColors, 3);
                    
                    // 5. 计算颜色距离
                    const distToBg = new Float32Array(w * h);
                    for (let i = 0; i < w * h; i++) {
                        const px = i * 4;
                        const r = data[px], g = data[px+1], b = data[px+2];
                        let minDist = Infinity;
                        for (const bg of bgClusters) {
                            const dist = Math.sqrt((r - bg.r) ** 2 + (g - bg.g) ** 2 + (b - bg.b) ** 2);
                            if (dist < minDist) minDist = dist;
                        }
                        distToBg[i] = minDist;
                    }
                    
                    // 6. 颜色突变保护
                    const colorEdge = new Uint8Array(w * h);
                    for (let y = 1; y < h - 1; y++) {
                        for (let x = 1; x < w - 1; x++) {
                            const idx = y * w + x;
                            const cur = distToBg[idx];
                            let maxDiff = 0;
                            for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                                const nIdx = (y + dy) * w + (x + dx);
                                const diff = Math.abs(cur - distToBg[nIdx]);
                                if (diff > maxDiff) maxDiff = diff;
                            }
                            if (maxDiff > 30) colorEdge[idx] = 1;
                        }
                    }
                    
                    // 7. 合并边缘墙
                    const finalWall = new Uint8Array(w * h);
                    for (let i = 0; i < w * h; i++) {
                        if (isEdge[i] || colorEdge[i]) finalWall[i] = 1;
                    }
                    
                    // 8. 泛洪填充
                    const isBackground = new Uint8Array(w * h);
                    const queue = [];
                    const colorTolerance = 50;
                    
                    for (let x = 0; x < w; x++) {
                        if (!finalWall[x] && distToBg[x] < colorTolerance) {
                            isBackground[x] = 1; queue.push(x);
                        }
                        const bottomIdx = (h - 1) * w + x;
                        if (!finalWall[bottomIdx] && distToBg[bottomIdx] < colorTolerance) {
                            isBackground[bottomIdx] = 1; queue.push(bottomIdx);
                        }
                    }
                    for (let y = 0; y < h; y++) {
                        const leftIdx = y * w;
                        if (!finalWall[leftIdx] && distToBg[leftIdx] < colorTolerance) {
                            isBackground[leftIdx] = 1; queue.push(leftIdx);
                        }
                        const rightIdx = y * w + w - 1;
                        if (!finalWall[rightIdx] && distToBg[rightIdx] < colorTolerance) {
                            isBackground[rightIdx] = 1; queue.push(rightIdx);
                        }
                    }
                    
                    const dirs4 = [[-1,0],[1,0],[0,-1],[0,1]];
                    while (queue.length > 0) {
                        const idx = queue.pop();
                        const x = idx % w;
                        const y = Math.floor(idx / w);
                        for (const [dx, dy] of dirs4) {
                            const nx = x + dx, ny = y + dy;
                            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                            const nIdx = ny * w + nx;
                            if (finalWall[nIdx]) continue;
                            if (distToBg[nIdx] >= colorTolerance * 1.2) continue;
                            if (!isBackground[nIdx]) {
                                isBackground[nIdx] = 1; queue.push(nIdx);
                            }
                        }
                    }
                    
                    // 9. 应用透明度
                    for (let i = 0; i < w * h; i++) {
                        if (isBackground[i]) {
                            const px = i * 4;
                            const dist = distToBg[i];
                            if (dist < colorTolerance) {
                                data[px + 3] = 0;
                            } else if (dist < colorTolerance * 2) {
                                data[px + 3] = Math.min(255, Math.floor(255 * ((dist - colorTolerance) / colorTolerance)));
                            }
                        }
                    }
                    
                    // 10. 降噪
                    this.denoise(data, w, h);
                    
                    ctx.putImageData(imageData, 0, 0);
                    const resultUrl = canvas.toDataURL('image/png');
                    URL.revokeObjectURL(url);
                    resolve(resultUrl);
                    
                } catch (error) {
                    URL.revokeObjectURL(url);
                    reject(error);
                }
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')); };
            img.src = url;
        });
    }
    
    kMeansCluster(colors, k) {
        if (colors.length === 0) return [{ r: 255, g: 255, b: 255 }];
        const centroids = [];
        const step = Math.max(1, Math.floor(colors.length / k));
        for (let i = 0; i < k; i++) {
            const idx = Math.min(i * step, colors.length - 1);
            centroids.push({ ...colors[idx] });
        }
        while (centroids.length < k) centroids.push({ ...colors[0] });
        for (let iter = 0; iter < 15; iter++) {
            const clusters = Array.from({ length: k }, () => []);
            for (const c of colors) {
                let minDist = Infinity, minIdx = 0;
                for (let i = 0; i < k; i++) {
                    const dist = Math.sqrt((c.r - centroids[i].r) ** 2 + (c.g - centroids[i].g) ** 2 + (c.b - centroids[i].b) ** 2);
                    if (dist < minDist) { minDist = dist; minIdx = i; }
                }
                clusters[minIdx].push(c);
            }
            for (let i = 0; i < k; i++) {
                if (clusters[i].length > 0) {
                    let sr = 0, sg = 0, sb = 0;
                    for (const c of clusters[i]) { sr += c.r; sg += c.g; sb += c.b; }
                    const n = clusters[i].length;
                    centroids[i] = { r: Math.round(sr/n), g: Math.round(sg/n), b: Math.round(sb/n) };
                }
            }
        }
        return centroids;
    }
    
    denoise(data, w, h) {
        const copy = new Uint8Array(data);
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = (y * w + x) * 4;
                if (copy[idx + 3] === 0) {
                    let transparentCount = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nIdx = ((y + dy) * w + (x + dx)) * 4;
                            if (copy[nIdx + 3] === 0) transparentCount++;
                        }
                    }
                    if (transparentCount <= 2) data[idx + 3] = 255;
                }
            }
        }
    }
}
// ===== 主应用 =====
class DesktopPetConfigApp {
    constructor() {
        this.toast = new ToastManager();
        this.remover = new BackgroundRemover();
        this.currentPetIndex = 0;
        this.pets = [];
        this.isPetVisible = true;
        this.isDarkTheme = false;  // 主题状态
        
        // 初始化 1 个宠物
        this.pets.push({
            imageUrl: null,
            isGif: false,
            originalGifUrl: null,
            name: '宠物 1',
            size: 80,
            speed: 'medium',
            personality: 'lively',
        });
        
        this.init();
    }
    
    init() {
        new ParticleBackground();
        this.bindPetTabs();
        this.bindUploadEvents();
        this.bindSettingsEvents();
        this.bindControlEvents();
        this.bindVisibilityEvents();
        this.bindThemeEvents();
        if (window.electronAPI) {
            window.electronAPI.getPetVisibility();
        }
        this.updatePetCount();
        this.updatePetSelector();
    }
    
    // 绑定宠物管理事件
    bindPetTabs() {
        const addBtn = document.getElementById('addPetBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.addPet();
            });
        }
        
        const removeBtn = document.getElementById('removePetBtn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                this.removePet();
            });
        }
        
        // 更换按钮：触发文件上传
        const changeBtn = document.getElementById('changePetBtn');
        const fileInput = document.getElementById('fileInput');
        if (changeBtn && fileInput) {
            changeBtn.addEventListener('click', () => {
                fileInput.click();
            });
        }
        
        const selector = document.getElementById('petSelector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                const index = parseInt(e.target.value);
                this.selectPet(index);
            });
        }
    }
    
    // 更新宠物选择器
    updatePetSelector() {
        const selector = document.getElementById('petSelector');
        if (!selector) return;
        
        // 清空现有选项
        selector.innerHTML = '';
        
        // 添加所有宠物选项
        this.pets.forEach((pet, index) => {
            const option = document.createElement('option');
            option.value = index;
            const defaultName = `宠物 ${index + 1}`;
            const displayName = pet.name && pet.name !== defaultName ? `${defaultName} - ${pet.name}` : defaultName;
            option.textContent = displayName;
            if (index === this.currentPetIndex) {
                option.selected = true;
            }
            selector.appendChild(option);
        });
        
        // 更新移除按钮状态
        const removeBtn = document.getElementById('removePetBtn');
        if (removeBtn) {
            removeBtn.disabled = this.pets.length <= 1;
        }
    }
    
    // 选择宠物
    selectPet(index) {
        if (index >= this.pets.length || index < 0) return;
        this.currentPetIndex = index;
        
        // 加载当前宠物的配置
        const pet = this.pets[index];
        document.getElementById('petName').value = pet.name || `宠物 ${index + 1}`;
        document.getElementById('petSize').value = pet.size || 80;
        document.getElementById('sizeValue').textContent = (pet.size || 80) + 'px';
        
        // 速度（只操作 speed 组的按钮）
        document.querySelectorAll('input[name="speed"]').forEach(radio => {
            radio.checked = radio.value === (pet.speed || 'medium');
        });
        document.querySelectorAll('.option-btn[data-value]').forEach(btn => {
            // 只处理速度组（包含 speed radio 的按钮）
            if (btn.querySelector('input[name="speed"]')) {
                btn.classList.toggle('active', btn.dataset.value === (pet.speed || 'medium'));
            }
        });
        
        // 性格（只操作 personality 组的按钮）
        document.querySelectorAll('input[name="personality"]').forEach(radio => {
            radio.checked = radio.value === (pet.personality || 'lively');
        });
        document.querySelectorAll('.option-btn[data-value]').forEach(btn => {
            // 只处理性格组（包含 personality radio 的按钮）
            if (btn.querySelector('input[name="personality"]')) {
                btn.classList.toggle('active', btn.dataset.value === (pet.personality || 'lively'));
            }
        });
        
        // 图片预览
        const previewArea = document.getElementById('previewArea');
        const uploadArea = document.getElementById('uploadArea');
        const previewImage = document.getElementById('previewImage');
        if (pet.imageUrl) {
            previewImage.src = pet.imageUrl;
            previewArea.style.display = 'block';
            uploadArea.style.display = 'none';
        } else {
            previewArea.style.display = 'none';
            uploadArea.style.display = 'block';
        }
        
        // 同步当前宠物配置到桌面窗口
        if (window.electronAPI) {
            window.electronAPI.setPetConfig({
                name: pet.name,
                size: pet.size,
                speed: pet.speed,
                personality: pet.personality,
                isGif: pet.isGif,
                gifUrl: pet.originalGifUrl,
            }, this.currentPetIndex);
            
            if (pet.imageUrl) {
                window.electronAPI.setPetImage(pet.imageUrl, this.currentPetIndex);
            }
        }
        
        this.updatePetCount();
        this.updatePetSelector();
    }
    
    // 添加宠物
    addPet() {
        if (this.pets.length >= 5) {
            this.toast.warning('最多只能添加 5 个宠物！');
            return;
        }
        const newIndex = this.pets.length;
        this.pets.push({
            imageUrl: null,
            isGif: false,
            originalGifUrl: null,
            name: `宠物 ${newIndex + 1}`,
            size: 80,
            speed: 'medium',
            personality: 'lively',
        });
        
        // 在 main.js 中创建新宠物窗口
        if (window.electronAPI) {
            window.electronAPI.addPetWindow(newIndex);
        }
        
        this.selectPet(newIndex);
        this.toast.success(`已添加宠物 ${newIndex + 1}！`);
        this.updatePetCount();
        this.updatePetSelector();
    }
    
    // 移除宠物
    removePet() {
        if (this.pets.length <= 1) {
            this.toast.warning('至少保留 1 个宠物！');
            return;
        }
        
        const index = this.currentPetIndex;
        const petName = this.pets[index].name || `宠物 ${index + 1}`;
        
        // 通知主进程关闭对应的宠物窗口
        if (window.electronAPI && window.electronAPI.removePetWindow) {
            window.electronAPI.removePetWindow(index);
        }
        
        // 移除宠物数据
        this.pets.splice(index, 1);
        
        // 重新编号剩余宠物：把后面的宠物索引前移
        this.renumberPets();
        
        // 切换到下一个宠物
        const newIndex = Math.min(index, this.pets.length - 1);
        this.selectPet(newIndex);
        
        this.toast.success(`已移除宠物「${petName}」，编号已重新排列`);
        this.updatePetCount();
        this.updatePetSelector();
    }
    
    // 重新编号宠物（删除后索引前移）
    renumberPets() {
        // 更新剩余宠物的默认名称（编号前移）
        this.pets.forEach((pet, newIndex) => {
            const defaultName = `宠物 ${newIndex + 1}`;
            // 如果宠物名是之前的默认名（如"宠物 2"），则更新为新的编号
            // 如果是自定义名称，则保留
            const oldDefaultName = `宠物 ${newIndex + 2}`;
            if (pet.name === oldDefaultName) {
                pet.name = defaultName;
            }
        });
        
        if (!window.electronAPI) return;
        
        // 重新同步所有宠物的配置和图片到新的索引位置
        this.pets.forEach((pet, newIndex) => {
            window.electronAPI.setPetConfig({
                name: pet.name,
                size: pet.size,
                speed: pet.speed,
                personality: pet.personality,
                isGif: pet.isGif,
                gifUrl: pet.originalGifUrl,
            }, newIndex);
            
            if (pet.imageUrl) {
                window.electronAPI.setPetImage(pet.imageUrl, newIndex);
            }
        });
    }
    
    // 更新宠物数量显示
    updatePetCount() {
        const countDisplay = document.getElementById('activePetCount');
        if (countDisplay) {
            countDisplay.textContent = `当前 ${this.pets.length}/5 个宠物`;
        }
        // 更新添加按钮状态
        const addBtn = document.getElementById('addPetBtn');
        if (addBtn) {
            addBtn.disabled = this.pets.length >= 5;
        }
        // 更新移除按钮状态
        const removeBtn = document.getElementById('removePetBtn');
        if (removeBtn) {
            removeBtn.disabled = this.pets.length <= 1;
        }
    }
    
    // 绑定主题切换事件
    bindThemeEvents() {
        const themeBtn = document.getElementById('themeToggleBtn');
        if (!themeBtn) return;
        
        themeBtn.addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // 恢复上次的主题设置
        const savedTheme = localStorage.getItem('petTheme');
        if (savedTheme === 'dark') {
            this.applyTheme(true);
        }
    }
    
    // 切换主题
    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        this.applyTheme(this.isDarkTheme);
        // 保存主题设置
        try {
            localStorage.setItem('petTheme', this.isDarkTheme ? 'dark' : 'light');
        } catch (_) {}
    }
    
    // 应用主题
    applyTheme(isDark) {
        this.isDarkTheme = isDark;
        const body = document.body;
        const themeBtn = document.getElementById('themeToggleBtn');
        
        if (isDark) {
            body.classList.add('dark-theme');
            if (themeBtn) {
                themeBtn.innerHTML = '<i class="fas fa-sun"></i> 浅色模式';
            }
        } else {
            body.classList.remove('dark-theme');
            if (themeBtn) {
                themeBtn.innerHTML = '<i class="fas fa-moon"></i> 深色模式';
            }
        }
    }
    
    bindVisibilityEvents() {
        if (!window.electronAPI) return;
        window.electronAPI.onPetVisibilityChanged((visible) => {
            this.isPetVisible = visible;
            this.updateVisibilityUI();
        });
    }
    
    updateVisibilityUI() {
        const toggleBtn = document.getElementById('toggleVisibilityBtn');
        const visibilityDisplay = document.getElementById('visibilityDisplay');
        if (this.isPetVisible) {
            toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> 隐藏宠物';
            toggleBtn.className = 'btn btn-info';
            visibilityDisplay.textContent = '👀 可见';
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i> 显示宠物';
            toggleBtn.className = 'btn btn-info active-hidden';
            visibilityDisplay.textContent = '🙈 已隐藏';
        }
    }
    
    bindUploadEvents() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const previewArea = document.getElementById('previewArea');
        const previewImage = document.getElementById('previewImage');
        const processingStatus = document.getElementById('processingStatus');
        
        uploadArea.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.processImage(e.target.files[0]);
            }
        });
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                const type = file.type;
                if (type === 'image/png' || type === 'image/jpeg' || type === 'image/gif') {
                    this.processImage(file);
                } else {
                    this.toast.error('请上传 PNG、JPG 或 GIF 格式的图片');
                }
            }
        });
        

    }
    
    async processImage(file) {
        const uploadArea = document.getElementById('uploadArea');
        const previewArea = document.getElementById('previewArea');
        const previewImage = document.getElementById('previewImage');
        const processingStatus = document.getElementById('processingStatus');
        const pet = this.pets[this.currentPetIndex];
        
        uploadArea.style.display = 'none';
        previewArea.style.display = 'none';
        processingStatus.style.display = 'flex';
        
        try {
            const isGif = file.type === 'image/gif';
            
            if (isGif) {
                this.toast.info('🎬 检测到 GIF 动图，正在处理...');
                const resultUrl = await this.remover.removeBackground(file);
                pet.imageUrl = resultUrl;
                pet.isGif = true;
                pet.originalGifUrl = URL.createObjectURL(file);
                
                previewImage.src = resultUrl;
                previewArea.style.display = 'block';
                processingStatus.style.display = 'none';
                
                if (window.electronAPI) {
                    window.electronAPI.setPetImage(resultUrl, this.currentPetIndex);
                    window.electronAPI.setPetConfig({
                        isGif: true,
                        gifUrl: pet.originalGifUrl,
                    }, this.currentPetIndex);
                }
                this.toast.success('🎬 GIF 动图处理完成！');
            } else {
                const resultUrl = await this.remover.removeBackground(file);
                pet.imageUrl = resultUrl;
                pet.isGif = false;
                pet.originalGifUrl = null;
                
                previewImage.src = resultUrl;
                previewArea.style.display = 'block';
                processingStatus.style.display = 'none';
                
                if (window.electronAPI) {
                    window.electronAPI.setPetImage(resultUrl, this.currentPetIndex);
                    window.electronAPI.setPetConfig({ isGif: false }, this.currentPetIndex);
                }
                this.toast.success('✨ 背景去除成功！');
            }
        } catch (error) {
            console.error('处理失败:', error);
            const url = URL.createObjectURL(file);
            previewImage.src = url;
            previewArea.style.display = 'block';
            processingStatus.style.display = 'none';
            pet.imageUrl = url;
            pet.isGif = file.type === 'image/gif';
            pet.originalGifUrl = pet.isGif ? url : null;
            
            if (window.electronAPI) {
                window.electronAPI.setPetImage(url, this.currentPetIndex);
            }
            this.toast.info('已使用原图作为宠物形象');
        }
    }
    
    bindSettingsEvents() {
        const nameInput = document.getElementById('petName');
        nameInput.addEventListener('input', () => this.sendConfig());
        
        const sizeSlider = document.getElementById('petSize');
        const sizeValue = document.getElementById('sizeValue');
        sizeSlider.addEventListener('input', () => {
            sizeValue.textContent = sizeSlider.value + 'px';
            this.sendConfig();
        });
        
        // 速度点击（只操作速度组的按钮）
        document.querySelectorAll('input[name="speed"]').forEach(radio => {
            radio.addEventListener('change', () => {
                // 只移除速度组的 active
                document.querySelectorAll('.option-btn[data-value]').forEach(b => {
                    if (b.querySelector('input[name="speed"]')) {
                        b.classList.remove('active');
                    }
                });
                radio.closest('.option-btn').classList.add('active');
                this.sendConfig();
            });
        });
        
        // 性格点击（只操作性格组的按钮）
        document.querySelectorAll('input[name="personality"]').forEach(radio => {
            radio.addEventListener('change', () => {
                // 只移除性格组的 active
                document.querySelectorAll('.option-btn[data-value]').forEach(b => {
                    if (b.querySelector('input[name="personality"]')) {
                        b.classList.remove('active');
                    }
                });
                radio.closest('.option-btn').classList.add('active');
                const names = { lively: '🎉 活泼', gentle: '😊 温和', lazy: '😴 慵懒' };
                this.toast.info(`宠物性格已切换为：${names[radio.value]}`);
                this.sendConfig();
            });
        });
    }
    
    sendConfig() {
        if (!window.electronAPI) return;
        const pet = this.pets[this.currentPetIndex];
        pet.name = document.getElementById('petName').value || `宠物 ${this.currentPetIndex + 1}`;
        pet.size = parseInt(document.getElementById('petSize').value);
        pet.speed = document.querySelector('input[name="speed"]:checked')?.value || 'medium';
        pet.personality = document.querySelector('input[name="personality"]:checked')?.value || 'lively';
        
        const config = {
            name: pet.name,
            size: pet.size,
            speed: pet.speed,
            personality: pet.personality,
            isGif: pet.isGif,
            gifUrl: pet.originalGifUrl,
        };
        window.electronAPI.setPetConfig(config, this.currentPetIndex);
        
        // 更新选择器中的名称
        this.updatePetSelector();
    }
    
    bindControlEvents() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const resetBtn = document.getElementById('resetBtn');
        const toggleVisibilityBtn = document.getElementById('toggleVisibilityBtn');
        const exportBtn = document.getElementById('exportBtn');
        const statusDisplay = document.getElementById('petStatusDisplay');
        
        startBtn.addEventListener('click', () => {
            const hasImage = this.pets.some(p => p.imageUrl);
            if (!hasImage) {
                this.toast.warning('请先上传宠物图片');
                return;
            }
            if (window.electronAPI) {
                window.electronAPI.sendPetStart();
            }
            statusDisplay.textContent = '🐾 活跃中';
            this.toast.success('所有宠物已开始在桌面活动！');
        });
        
        stopBtn.addEventListener('click', () => {
            if (window.electronAPI) {
                window.electronAPI.sendPetStop();
            }
            statusDisplay.textContent = '😴 已暂停';
            this.toast.info('所有宠物已暂停活动');
        });
        
        resetBtn.addEventListener('click', () => {
            if (window.electronAPI) {
                window.electronAPI.sendPetReset();
            }
            this.toast.info('📍 所有宠物已回到屏幕中央');
        });
        
        toggleVisibilityBtn.addEventListener('click', () => {
            if (window.electronAPI) {
                window.electronAPI.togglePetVisibility();
            }
        });
        
        exportBtn.addEventListener('click', () => {
            const config = {
                version: '2.0',
                pets: this.pets.map(p => ({
                    name: p.name,
                    size: p.size,
                    speed: p.speed,
                    personality: p.personality,
                    imageData: p.imageUrl,
                    isGif: p.isGif,
                    gifUrl: p.originalGifUrl,
                })),
                exportTime: new Date().toISOString(),
            };
            
            if (window.electronAPI) {
                window.electronAPI.exportConfig(config);
                window.electronAPI.onExportResult((data) => {
                    if (data.success) {
                        this.toast.success(`✅ 配置已导出到 ${data.path}`);
                    } else {
                        this.toast.error('导出失败：' + data.error);
                    }
                });
            } else {
                const jsonStr = JSON.stringify(config, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `宠物配置.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.toast.success('✅ 配置已导出');
            }
        });
    }
}
// ===== 启动 =====
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DesktopPetConfigApp();
});