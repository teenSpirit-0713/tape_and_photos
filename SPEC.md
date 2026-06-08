# 磁带回忆 (Tape Memories) — 技术规格书

## 1. 项目概述

一个暗色主题的交互式网页应用，以复古磁带播放器为核心视觉元素。用户可以创建自定义配色的磁带，上传音乐和照片，将磁带拖入中央播放器进行播放。播放期间，磁带内的照片以呼吸效果在播放器周围浮现。

**核心体验关键词**：丝滑动画、磁带实体感、拖拽交互、照片呼吸

---

## 2. 技术栈

| 层面 | 选择 | 说明 |
|------|------|------|
| 框架 | 纯 HTML/CSS/JS（Vanilla） | 无框架依赖，对动画有完全控制 |
| 动画引擎 | GSAP 3.x（CDN 引入） | 用于入场动画编排和飞入动画的缓动 |
| 音频播放 | HTML5 `<audio>` 元素 | 基础的播放/暂停/进度追踪 |
| 持久存储 | IndexedDB | 存储磁带元数据、音乐文件 Blob、照片文件 Blob |
| 拖拽 | 原生 Pointer Events + `style.left`/`style.top` | 鼠标和触控统一处理 |
| 布局 | CSS Flexbox + 固定定位 | 三区域布局 |

**CDN 依赖**：
```
https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js
```

---

## 3. 页面布局

```
┌──────────────────────────────────────────────┐
│  TOP BAR (56px, fixed, 毛玻璃背景)             │
│  [📼 磁带回忆]      [+ 添加音乐]   [展开][导出][导入] │
├──────────────────────────────────────────────┤
│                                              │
│              (照片呼吸区域)                     │
│                                              │
│           ┌──────────────────┐               │
│           │   磁带播放器      │  ← 居中，大号   │
│           │   380×280px      │               │
│           │   (桌面端)        │               │
│           └──────────────────┘               │
│                                              │
│              (照片呼吸区域)                     │
│                                              │
├──────────────────────────────────────────────┤
│  BOTTOM GALLERY (180px, fixed)               │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐         [+ 号] │
│  │📼  │ │📼  │ │📼  │ │📼  │  ← 水平滑动     │
│  └────┘ └────┘ └────┘ └────┘   CSS Scroll Snap│
└──────────────────────────────────────────────┘
```

- **背景色**：`#0a0a14`（深黑蓝）
- **三个区域均为固定定位**，中间区域自适应高度

---

## 4. 配色系统

```css
--bg-deep: #0a0a14        /* 最深背景 */
--bg-surface: #12121f     /* 卡片/面板背景 */
--bg-elevated: #1a1a2e    /* 悬浮元素背景 */
--bg-hover: #22223a       /* hover 状态 */
--text-primary: #e8e8f0   /* 主文字 */
--text-secondary: #9999b0 /* 次要文字 */
--text-muted: #666680     /* 弱化文字 */
--accent: #ff6b6b         /* 强调色（可由用户自定义每个磁带的颜色） */
```

---

## 5. 数据模型

### 5.1 Tape（磁带）

```js
{
  id: "tape_<timestamp>_<random6>",  // 唯一标识
  name: "磁带名称",                    // 用户自定义，可修改
  color: "#ff6b6b",                   // 主题色，CSS 自定义属性注入
  musicBlob: <Blob>,                  // 音乐文件的原始 Blob
  musicFileName: "song.mp3",          // 音乐文件名
  musicType: "audio/mpeg",            // MIME 类型
  photoIds: ["photo_xxx", ...],       // 关联的照片 ID 数组
  createdAt: <timestamp>              // 创建时间，用于排序
}
```

### 5.2 Photo（照片）

```js
{
  id: "photo_<timestamp>_<random6>",
  tapeId: "tape_xxx",                 // 所属磁带 ID
  blob: <Blob>,                       // 压缩后的照片 Blob
  fileName: "photo.jpg",              // 原始文件名
  mimeType: "image/jpeg"              // MIME 类型
}
```

### 5.3 IndexedDB 结构

- **数据库名**：`tape-memories`
- **Object Store**：`tapes`（keyPath: `id`，索引: `createdAt`）
- **Object Store**：`photos`（keyPath: `id`，索引: `tapeId`）

---

## 6. 磁带 CSS 组件规格

### 6.1 画廊磁带（小号，160×110px）

纯 CSS 绘制，无图片依赖。

层级结构（从底到顶）：
1. **外壳** — `linear-gradient` 模拟塑料质感，`border-radius: 8px`，`box-shadow` 提供深度
2. **四角螺丝** — 4 个 4×4px 圆形 `div`，`radial-gradient` 模拟金属
3. **上部标签条** — 使用 `--tape-color` 自定义属性，16px 高
4. **下部标签条** — 同上，底部
5. **透明窗口** — 半透明黑色背景，展示内部轮盘
6. **左/右轮盘** — 28×28px 圆形，`conic-gradient` 绘制齿轮纹理（24 段明暗交替）
7. **磁带路径** — 轮盘之间的连接线
8. **名称标签** — 底部文字，单行省略

### 6.2 播放器磁带（大号，380×280px 桌面端）

同上结构，放大版。轮盘 56×56px，播放时添加 `animation: reelSpin 2s linear infinite`。

```css
@keyframes reelSpin { to { transform: rotate(360deg); } }
```

**播放状态**：`.spinning` 类控制 `animation-play-state`（JS 切换）

---

## 7. 核心交互流程

### 7.1 添加磁带

```
点击 [+ 添加音乐] 按钮
  → 弹出模态框，包含：
    - 磁带名称输入框（max 30 字）
    - 颜色选择器（input[type=color]，默认 #ff6b6b）
    - 音乐上传区（accept="audio/*"，必填）
    - 照片上传区（accept="image/*"，multiple，可选）
  → 点击 [确认添加]
    → 照片通过 Canvas 压缩（max 1920px 宽，JPEG quality 0.78）
    → 创建 Tape 对象，写入 IndexedDB
    → 磁带出现在底部画廊（从右滑入）
    → Toast 提示 "磁带「名称」已创建"
```

### 7.2 拖入播放器（核心交互）

```
用户在画廊磁带上按下鼠标/手指（pointerdown）
  → 创建 ghost 元素（position:fixed，位置/尺寸与原磁带一致）
  → 原磁带 opacity:0.3
  → 拖拽中（pointermove）：
    - 每帧更新 ghost 的 style.left 和 style.top
    - 数学计算 ghost 中心是否进入播放器区域
    - 进入时播放器显示高亮边框（.drag-hover）
  → 松手（pointerup）：
    - 如果 ghost 中心在播放器区域内：
      ① slot 预隐藏（opacity:0, scale:0.92）
      ② GSAP 动画：ghost 飞向播放器中心 + 放大到播放器尺寸（0.5s, power3.inOut）
      ③ 动画完成：loadTape() → slot 弹入（CSS transition 0.25s）+ ghost 淡出
      ④ audio.play() → 轮盘旋转 → 照片呼吸启动
    - 如果不在区域内：
      ghost 弹回画廊原位（GSAP back.out 弹性缓动, 0.35s）
```

### 7.3 拖出播放器

```
用户在播放器内的磁带上按下
  → 创建小号 ghost（160×110px）
  → 拖出播放器区域后松手
    → stop() → stopBreathing()
    → ghost 飞回画廊对应磁带位置（GSAP, 0.45s）
    → 播放器变回空状态
```

### 7.4 点击暂停/继续

```
点击播放器中的磁带
  → 如果正在播放：audio.pause()，轮盘停止旋转，照片呼吸冻结
  → 如果已暂停：audio.play()，轮盘恢复旋转，照片呼吸恢复
```

### 7.5 画廊滚动

- CSS `scroll-snap-type: x proximity` 实现吸附效果
- `scroll-behavior: smooth` 平滑滚动
- 左右有渐变遮罩（淡入淡出效果）
- 画廊末尾有 [+] 占位符，点击同添加按钮

### 7.6 全屏磁带库

```
点击 [展开] 按钮
  → 模态框从下往上滑入
  → 顶部搜索栏（实时过滤磁带名称）
  → 网格布局展示所有磁带（CSS Grid, auto-fill, min 170px）
  → 显示磁带数量计数
  → 点击磁带 → 直接载入播放器 + 关闭全屏
```

### 7.7 编辑/删除磁带

```
hover 磁带 → 右上角出现操作按钮（▶ 播放，✎ 编辑）
点击 ✎ → 编辑模态框：
  - 修改名称
  - 修改颜色
  - 追加照片
  - [删除此磁带] 按钮 → 二次确认 → 清除 IndexedDB 数据
```

---

## 8. 照片呼吸效果

- **触发条件**：音乐正在播放，且该磁带包含照片
- **并发数**：最多 3 张照片同时显示
- **调度**：`setInterval` 每 2.2 秒检查，不足 3 张时创建新照片
- **每张照片的生命周期**：
  1. 创建 `<img>` 元素，`position:absolute`
  2. 随机位置（避开播放器中心区域 40px margin）
  3. 随机尺寸（140-300px 宽）
  4. 随机旋转（-9° 到 +9°）
  5. 等待图片加载完成（onload）后启动动画：
     - 淡入：opacity 0→1, scale 0.88→1.02（1.8s, power2.inOut）
     - 保持：opacity 1, scale 1.02→1.04（3.5s）
     - 淡出：opacity 1→0, scale 1.04→1.08（2.2s, delay 0.3s）
  6. 动画完成后移除元素，释放 Blob URL
- **停止/暂停**：清除 interval，杀死所有 GSAP tween，移除元素

---

## 9. 入场动画

页面加载完成后（GSAP 可用），执行 Timeline：

```
1. Loading screen 淡出（0.4s, delay 0.3s）
2. Top bar 下滑入场（0.5s, power2.out）
3. 播放器弹入：scale(0.7)→scale(1), opacity(0→1)（0.7s, back.out(1.4)）
4. 画廊从底部升入：y(60)→y(0), opacity(0→1)（0.6s, power2.out）
5. 已有磁带逐个交错弹出：y(40)→y(0), scale(0.85)→scale(1), stagger 0.08s（back.out(1.3)）
```

---

## 10. 存储架构

### 10.1 照片压缩

上传的照片通过 Canvas 压缩后再存入 IndexedDB：
- 最大宽度 1920px，等比例缩放
- 输出格式 JPEG，quality 0.78
- <500KB 的文件跳过压缩

### 10.2 Blob URL 管理

- 音乐：加载到播放器时通过 `URL.createObjectURL()` 创建临时 URL
- 照片：每张照片每次显示都创建新的 Blob URL
- 动画完成后立即 `URL.revokeObjectURL()` 释放内存
- 切换磁带时清理旧的音乐 Blob URL

### 10.3 存储容量

- 浏览器 IndexedDB 通常可用 2GB+
- 调用 `navigator.storage.persist()` 请求持久化存储
- 每张照片压缩后约 200-400KB
- 估算：1GB 可存约 2500-5000 张照片

---

## 11. 导出/导入

### 导出

1. 从 IndexedDB 读取所有 Tape 和 Photo 数据
2. 将所有 Blob 转换为 Base64 Data URL（`FileReader.readAsDataURL`）
3. 打包为 JSON，包含版本号和时间戳
4. 触发浏览器下载（`.tapebackup` 文件）

### 导入

1. 用户选择 `.tapebackup` 文件
2. 解析 JSON，将 Base64 转回 Blob
3. 清空现有 IndexedDB 数据
4. 逐条写入新数据
5. 刷新 UI

---

## 12. 响应式

| 断点 | 调整 |
|------|------|
| ≤768px | 播放器 280×210px，画廊 160px 高，磁带 130×90px，轮盘 22px |
| ≤480px | 播放器 240×180px，磁带 110×76px，轮盘 18px，隐藏"添加音乐"按钮文字 |

---

## 13. 文件结构

```
tape_and_photos_website/
├── index.html          # 页面结构，所有模态框，GSAP CDN
├── css/
│   └── styles.css      # 全部样式（暗色主题、磁带组件、播放器、画廊、模态框、响应式）
└── js/
    ├── storage.js      # IndexedDB 封装（openDB, CRUD, Base64 转换, 导出导入）
    ├── tape-store.js   # 磁带数据管理（创建/更新/删除磁带，照片压缩）
    ├── player.js       # 音频播放控制（play/pause/stop/progress/轮盘动画同步）
    ├── drag-drop.js    # 拖拽交互（Pointer Events + GSAP 飞入动画 + 点击加载）
    ├── gallery.js      # 底部画廊渲染 + 全屏磁带库
    ├── photos.js       # 照片呼吸效果（随机位置、淡入淡出循环）
    ├── ui.js           # 模态框管理、Toast 通知、表单交互、导出导入 UI
    └── app.js          # 入口（初始化各模块、入场动画、回调绑定）
```

---

## 14. 跨模块 API 约定

所有模块函数挂载在全局作用域（`window`），通过 `<script>` 标签顺序加载确保依赖可用。

### 加载顺序（= 依赖顺序）

```
storage.js → tape-store.js → player.js → drag-drop.js → gallery.js → photos.js → ui.js → app.js
```

### 关键全局函数

| 模块 | 导出函数 |
|------|---------|
| storage.js | `openDB`, `getAllTapes`, `saveTape`, `deleteTape`, `savePhoto`, `getPhotosForTape`, `exportAllData`, `importAllData`, `requestPersistence` |
| tape-store.js | `loadAllTapes`, `createTape`, `updateTape`, `removeTape`, `addPhotosToTape`, `getPhotosForTapeId`, `getTapeById`, `getMusicURL`, `getPhotoBlobURL`, `getActiveTapeId`, `setActiveTape`, `clearActiveTape`, `searchTapes`, `tapesCache` |
| player.js | `initPlayer`, `loadTape`, `play`, `pause`, `stop`, `togglePlayPause`, `getCurrentTapeId`, `isAudioPlaying`, `getPlayerRect` |
| drag-drop.js | `initDragDrop`, `loadTapeToPlayer`, `onTapeLoaded`(callback), `onTapeUnloaded`(callback) |
| gallery.js | `initGallery`, `renderGallery`, `updatePlayingState`, `renderFullGallery`, `closeFullGallery`, `escapeHtml` |
| photos.js | `initPhotos`, `startBreathing`, `stopBreathing`, `pauseBreathing`, `resumeBreathing` |
| ui.js | `openAddTapeModal`, `openEditTapeModal`, `refreshGallery`, `showToast` |

### 回调绑定（app.js 中）

```js
onTapeLoaded = function (tape) {
  updatePlayingState(tape.id);    // 点亮画廊中对应磁带的播放状态
  startBreathing(tape.id);        // 启动照片呼吸
};

onTapeUnloaded = function (tape) {
  if (tape) updatePlayingState(tape.id);
  stopBreathing();
};
```

---

## 15. 关键实现细节

### 15.1 拖拽位移计算

```js
// pointerdown 时记录
offsetX = e.clientX - tapeRect.left;  // 鼠标在元素内的相对位置

// pointermove 时计算元素应该去的屏幕位置
ghost.style.left = (e.clientX - offsetX) + 'px';
ghost.style.top = (e.clientY - offsetY) + 'px';
```

### 15.2 碰撞检测（拖入播放器判断）

使用数学计算，不调用 `getBoundingClientRect()`（避免 forced reflow）：

```js
var cx = ghostLeft + ghostWidth / 2;
var cy = ghostTop + ghostHeight / 2;
var overPlayer = cx > playerLeft && cx < playerRight && cy > playerTop && cy < playerBottom;
```

ghostLeft/top 从 `ghost.style.left`/`ghost.style.top` 直接读取（已知值）。

### 15.3 飞入播放器动画

GSAP 一次性动画（仅在 drop 时触发）：

```js
gsap.to(ghost, {
  left: playerCenterX - ghostWidth / 2,
  top: playerCenterY - ghostHeight / 2,
  scaleX: playerWidth / ghostWidth,    // 放大到播放器尺寸
  scaleY: playerHeight / ghostHeight,
  duration: 0.5,
  ease: 'power3.inOut',
  onComplete: done
});
```

### 15.4 Slot 交叉淡入

飞入动画完成后：
1. `loadTape()` 填充 slot 内容和音频源
2. slot 从 `opacity:0, scale(0.92)` → `opacity:1, scale(1)`（CSS transition 0.25s, back.out 缓动）
3. ghost 同时 `opacity:1 → 0`（CSS transition 0.15s）
4. ghost transitionend 后 remove

### 15.5 播放器空状态

- 无磁带时：显示虚线边框提示 "拖入磁带开始播放"
- 拖拽悬停时：提示边框变为强调色（`.drag-hover`）
- 磁带载入后：`.player-empty-hint` 隐藏（CSS `display:none`），slot 显示

### 15.6 CSS transition 冲突处理

`.tape-item.dragging` 必须设置 `transition: none !important`，防止 `.tape-item` 的 `transition: transform 0.2s` 在拖拽时对抗每帧的 `style.left` 更新，造成拖拽阻力。

---

## 16. 浏览器兼容性

- **目标**：Chrome 90+, Edge 90+, Safari 15+, Firefox 90+
- **依赖特性**：IndexedDB, Pointer Events, CSS Scroll Snap, CSS conic-gradient, HTML5 Audio, Blob, URL.createObjectURL
- **Safari 注意**：从 IndexedDB 取出 Blob 后，创建新 Blob 时必须显式指定 MIME 类型

---

## 17. 待改进项（未实现）

- 音乐进度拖动（seek）
- 音量控制
- 播放列表/队列
- PWA 离线支持（Service Worker）
- 云端同步（接入 Supabase / 对象存储）
- 照片预览/放大查看
- 深色/浅色主题切换
