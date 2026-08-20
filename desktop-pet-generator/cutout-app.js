// ===== Toast =====
class ToastManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
    }
    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        this.container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    success(msg) { this.show(msg, 'success'); }
    error(msg) { this.show(msg, 'error'); }
}
// ===== 背景去除算法（Canny边缘检测 + 泛洪填充） =====
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
                    
                    // 1. 计算梯度图（Sobel）
                    const gradient = new Float32Array(w * h);
                    const gradX = new Float32Array(w * h);
                    const gradY = new Float32Array(w * h);
                    for (let y = 1; y < h - 1; y++) {
                        for (let x = 1; x < w - 1; x++) {
                            let maxG = 0, maxGx = 0, maxGy = 0;
                            for (let c = 0; c < 3; c++) {
                                const gx = 
                                    -data[(y-1)*w*4+(x-1)*4+c] + data[(y-1)*w*4+(x+1)*4+c]
                                    -2*data[y*w*4+(x-1)*4+c] + 2*data[y*w*4+(x+1)*4+c]
                                    -data[(y+1)*w*4+(x-1)*4+c] + data[(y+1)*w*4+(x+1)*4+c];
                                const gy = 
                                    -data[(y-1)*w*4+(x-1)*4+c] -2*data[(y-1)*w*4+x*4+c] - data[(y-1)*w*4+(x+1)*4+c]
                                    +data[(y+1)*w*4+(x-1)*4+c] +2*data[(y+1)*w*4+x*4+c] + data[(y+1)*w*4+(x+1)*4+c];
                                const g = Math.sqrt(gx*gx + gy*gy);
                                if (g > maxG) { maxG = g; maxGx = gx; maxGy = gy; }
                            }
                            gradient[y*w+x] = maxG;
                            gradX[y*w+x] = maxGx;
                            gradY[y*w+x] = maxGy;
                        }
                    }
                    
                    // 2. Canny 非极大值抑制
                    const lowThreshold = 8, highThreshold = 30;
                    const suppressed = new Float32Array(w * h);
                    for (let y = 1; y < h - 1; y++) {
                        for (let x = 1; x < w - 1; x++) {
                            const idx = y*w+x;
                            const g = gradient[idx];
                            if (g < lowThreshold) continue;
                            const angle = Math.atan2(gradY[idx], gradX[idx]) * 180 / Math.PI;
                            let q1, q2;
                            if ((angle >= -22.5 && angle < 22.5) || (angle >= 157.5 || angle < -157.5)) {
                                q1 = gradient[idx-1]; q2 = gradient[idx+1];
                            } else if ((angle >= 22.5 && angle < 67.5) || (angle >= -157.5 && angle < -112.5)) {
                                q1 = gradient[idx-w-1]; q2 = gradient[idx+w+1];
                            } else if ((angle >= 67.5 && angle < 112.5) || (angle >= -112.5 && angle < -67.5)) {
                                q1 = gradient[idx-w]; q2 = gradient[idx+w];
                            } else {
                                q1 = gradient[idx-w+1]; q2 = gradient[idx+w-1];
                            }
                            if (g >= q1 && g >= q2) suppressed[idx] = g;
                        }
                    }
                    
                    // 双阈值滞后连接
                    const isEdge = new Uint8Array(w * h);
                    for (let i = 0; i < w*h; i++) if (suppressed[i] >= highThreshold) isEdge[i] = 1;
                    const dirs8 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
                    let changed = true, iterations = 0;
                    while (changed && iterations < 10) {
                        changed = false; iterations++;
                        for (let y = 1; y < h-1; y++) {
                            for (let x = 1; x < w-1; x++) {
                                const idx = y*w+x;
                                if (isEdge[idx]) continue;
                                if (suppressed[idx] >= lowThreshold) {
                                    for (const [dx,dy] of dirs8) {
                                        if (isEdge[(y+dy)*w+(x+dx)]) { isEdge[idx]=1; changed=true; break; }
                                    }
                                }
                            }
                        }
                    }
                    
                    // 3. 形态学膨胀
                    const dilated = new Uint8Array(w*h);
                    for (let pass = 0; pass < 2; pass++) {
                        for (let y = 1; y < h-1; y++) {
                            for (let x = 1; x < w-1; x++) {
                                if (isEdge[y*w+x]) {
                                    for (const [dx,dy] of dirs8) dilated[(y+dy)*w+(x+dx)] = 1;
                                }
                            }
                        }
                        for (let i = 0; i < w*h; i++) if (dilated[i]) isEdge[i] = 1;
                        if (pass < 1) dilated.fill(0);
                    }
                    
                    // 4. 采样背景颜色
                    const bgColors = [];
                    const step = 3;
                    for (let x = 0; x < w; x += step) {
                        if (!isEdge[x]) { const pi=x*4; bgColors.push({r:data[pi],g:data[pi+1],b:data[pi+2]}); }
                        const bi=(h-1)*w+x;
                        if (!isEdge[bi]) { const pi=bi*4; bgColors.push({r:data[pi],g:data[pi+1],b:data[pi+2]}); }
                    }
                    for (let y = 0; y < h; y += step) {
                        const li=y*w;
                        if (!isEdge[li]) { const pi=li*4; bgColors.push({r:data[pi],g:data[pi+1],b:data[pi+2]}); }
                        const ri=y*w+w-1;
                        if (!isEdge[ri]) { const pi=ri*4; bgColors.push({r:data[pi],g:data[pi+1],b:data[pi+2]}); }
                    }
                    if (bgColors.length === 0) bgColors.push({r:255,g:255,b:255});
                    
                    // K-means
                    const bgClusters = kMeansCluster(bgColors, 3);
                    
                    // 5. 颜色距离
                    const distToBg = new Float32Array(w*h);
                    for (let i = 0; i < w*h; i++) {
                        const px = i*4;
                        let minDist = Infinity;
                        for (const bg of bgClusters) {
                            const d = Math.sqrt((data[px]-bg.r)**2 + (data[px+1]-bg.g)**2 + (data[px+2]-bg.b)**2);
                            if (d < minDist) minDist = d;
                        }
                        distToBg[i] = minDist;
                    }
                    
                    // 6. 颜色突变保护
                    const colorEdge = new Uint8Array(w*h);
                    for (let y = 1; y < h-1; y++) {
                        for (let x = 1; x < w-1; x++) {
                            const idx = y*w+x;
                            let maxDiff = 0;
                            for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                                const diff = Math.abs(distToBg[idx] - distToBg[(y+dy)*w+(x+dx)]);
                                if (diff > maxDiff) maxDiff = diff;
                            }
                            if (maxDiff > 30) colorEdge[idx] = 1;
                        }
                    }
                    
                    // 7. 合并边缘墙
                    const finalWall = new Uint8Array(w*h);
                    for (let i = 0; i < w*h; i++) if (isEdge[i] || colorEdge[i]) finalWall[i] = 1;
                    
                    // 8. 泛洪填充
                    const isBackground = new Uint8Array(w*h);
                    const queue = [];
                    const colorTolerance = 50;
                    for (let x = 0; x < w; x++) {
                        if (!finalWall[x] && distToBg[x] < colorTolerance) { isBackground[x]=1; queue.push(x); }
                        const bi=(h-1)*w+x;
                        if (!finalWall[bi] && distToBg[bi] < colorTolerance) { isBackground[bi]=1; queue.push(bi); }
                    }
                    for (let y = 0; y < h; y++) {
                        const li=y*w;
                        if (!finalWall[li] && distToBg[li] < colorTolerance) { isBackground[li]=1; queue.push(li); }
                        const ri=y*w+w-1;
                        if (!finalWall[ri] && distToBg[ri] < colorTolerance) { isBackground[ri]=1; queue.push(ri); }
                    }
                    const dirs4 = [[-1,0],[1,0],[0,-1],[0,1]];
                    while (queue.length > 0) {
                        const idx = queue.pop();
                        const x = idx % w, y = Math.floor(idx / w);
                        for (const [dx,dy] of dirs4) {
                            const nx=x+dx, ny=y+dy;
                            if (nx<0||nx>=w||ny<0||ny>=h) continue;
                            const nIdx=ny*w+nx;
                            if (finalWall[nIdx]) continue;
                            if (distToBg[nIdx] >= colorTolerance*1.2) continue;
                            if (!isBackground[nIdx]) { isBackground[nIdx]=1; queue.push(nIdx); }
                        }
                    }
                    
                    // 9. 应用透明度
                    for (let i = 0; i < w*h; i++) {
                        if (isBackground[i]) {
                            const px = i*4;
                            const dist = distToBg[i];
                            if (dist < colorTolerance) data[px+3] = 0;
                            else if (dist < colorTolerance*2) data[px+3] = Math.min(255, Math.floor(255*((dist-colorTolerance)/colorTolerance)));
                        }
                    }
                    
                    // 10. 降噪
                    const copy = new Uint8Array(data);
                    for (let y = 1; y < h-1; y++) {
                        for (let x = 1; x < w-1; x++) {
                            const idx = (y*w+x)*4;
                            if (copy[idx+3] === 0) {
                                let transparentCount = 0;
                                for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
                                    if (copy[((y+dy)*w+(x+dx))*4+3] === 0) transparentCount++;
                                }
                                if (transparentCount <= 2) data[idx+3] = 255;
                            }
                        }
                    }
                    
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
}
// K-means 聚类
function kMeansCluster(colors, k) {
    if (colors.length === 0) return [{r:255,g:255,b:255}];
    const centroids = [];
    const step = Math.max(1, Math.floor(colors.length / k));
    for (let i = 0; i < k; i++) {
        const idx = Math.min(i*step, colors.length-1);
        centroids.push({...colors[idx]});
    }
    while (centroids.length < k) centroids.push({...colors[0]});
    for (let iter = 0; iter < 15; iter++) {
        const clusters = Array.from({length:k}, () => []);
        for (const c of colors) {
            let minDist = Infinity, minIdx = 0;
            for (let i = 0; i < k; i++) {
                const d = Math.sqrt((c.r-centroids[i].r)**2 + (c.g-centroids[i].g)**2 + (c.b-centroids[i].b)**2);
                if (d < minDist) { minDist = d; minIdx = i; }
            }
            clusters[minIdx].push(c);
        }
        for (let i = 0; i < k; i++) {
            if (clusters[i].length > 0) {
                let sr=0,sg=0,sb=0;
                for (const c of clusters[i]) { sr+=c.r; sg+=c.g; sb+=c.b; }
                const n = clusters[i].length;
                centroids[i] = {r:Math.round(sr/n), g:Math.round(sg/n), b:Math.round(sb/n)};
            }
        }
    }
    return centroids;
}
// ===== 主应用 =====
class CutoutApp {
    constructor() {
        this.toast = new ToastManager();
        this.remover = new BackgroundRemover();
        this.originalUrl = null;
        this.cutoutUrl = null;
        this.init();
    }
    init() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        uploadArea.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.processImage(e.target.files[0]);
        });
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) this.processImage(e.dataTransfer.files[0]);
        });
        document.getElementById('downloadBtn').addEventListener('click', () => this.download());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
    }
    async processImage(file) {
        const uploadArea = document.getElementById('uploadArea');
        const processingStatus = document.getElementById('processingStatus');
        uploadArea.style.display = 'none';
        processingStatus.style.display = 'flex';
        try {
            this.originalUrl = URL.createObjectURL(file);
            this.cutoutUrl = await this.remover.removeBackground(file);
            document.getElementById('originalImage').src = this.originalUrl;
            document.getElementById('cutoutImage').src = this.cutoutUrl;
            document.getElementById('resultSection').style.display = 'block';
            processingStatus.style.display = 'none';
            this.toast.success('✨ 抠图完成！');
        } catch (e) {
            processingStatus.style.display = 'none';
            uploadArea.style.display = 'block';
            this.toast.error('抠图失败：' + e.message);
        }
    }
    download() {
        if (!this.cutoutUrl) return;
        const a = document.createElement('a');
        a.href = this.cutoutUrl;
        a.download = '抠图结果.png';
        a.click();
        this.toast.success('✅ 已下载透明PNG');
    }
    reset() {
        document.getElementById('resultSection').style.display = 'none';
        document.getElementById('uploadArea').style.display = 'block';
        document.getElementById('fileInput').value = '';
        this.originalUrl = null;
        this.cutoutUrl = null;
    }
}
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CutoutApp();
});