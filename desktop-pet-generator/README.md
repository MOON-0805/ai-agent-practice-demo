# 🐾 桌面宠物生成器

> 上传图片自动去除背景，生成专属桌面宠物！支持 GIF 动图、多宠物同屏、鼠标拖拽互动、深色模式。

![版本](https://img.shields.io/badge/version-3.0.0-blue) ![平台](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

## ✨ 功能特点

- 🖼️ **智能抠图**：上传图片自动去除背景，采用 Canny 边缘检测 + 泛洪填充算法
- 🎬 **GIF 动图**：上传 GIF，宠物在桌面上动起来
- 🐾 **多宠物**：最多 5 个宠物同时在桌面上活动
- 🖱️ **鼠标拖拽**：按住宠物拖到任意位置
- 🎨 **个性化设置**：宠物名称、大小、速度、性格（活泼/温和/慵懒）
- 🌙 **深色模式**：浅色/深色主题随意切换
- 🎭 **动作系统**：行走、奔跑、跳跃、转圈、挥手、歪头思考
- 💫 **交互反馈**：悬停看向鼠标、点击开心跳跃

## 🚀 快速开始

### 环境要求
- Node.js 16+
- npm

### 安装运行
```bash
# 1. 安装依赖
npm install

# 2. 启动应用
npm start
```

### 打包
```bash
# macOS 安装包
npm run dist:mac

# Windows 安装包
npm run dist:win

# Linux 安装包
npm run dist:linux
```

## 📖 使用指南

### 第一步：启动应用
双击应用图标，打开配置面板。

### 第二步：上传宠物图片
点击上传区域，选择宠物图片（支持 PNG / JPG / GIF），应用自动去除背景。

### 第三步：个性化设置
- **宠物名称**：输入宠物名字
- **宠物大小**：40px - 200px 自由调整
- **移动速度**：慢速 / 中速 / 快速
- **宠物性格**：活泼 ⚡ / 温和 🌿 / 慵懒 😴

### 第四步：启动宠物
点击「启动宠物」，宠物开始在桌面上活动！

## 🎮 鼠标交互

| 操作 | 效果 |
|------|------|
| 点击宠物 | 宠物开心跳跃 + 爱心特效 |
| 拖拽宠物 | 按住宠物拖到任意位置 |
| 悬停宠物 | 宠物看向鼠标方向 |

## 🛠️ 技术栈

- **Electron** - 跨平台桌面应用框架
- **HTML5 Canvas** - 宠物渲染和动画
- **Canny 边缘检测** - 智能背景去除
- **泛洪填充** - 背景区域识别
- **requestAnimationFrame** - 流畅动画循环

## 📁 项目结构

```
desktop-pet-generator/
├── main.js              # Electron 主进程
├── preload.js           # 安全桥接
├── package.json         # 项目配置
├── src/                 # 前端源码
│   ├── pet-window.html  # 宠物悬浮窗口
│   ├── config.html      # 标准配置面板
│   ├── config-full.html # 全屏配置面板
│   ├── css/             # 样式
│   └── js/              # 逻辑
│       ├── pet-engine.js    # 宠物引擎
│       └── config-app.js    # 配置逻辑
└── assets/              # 资源
```

## 📄 许可证

MIT License © 2026 AiPy
