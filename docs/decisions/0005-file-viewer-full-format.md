# 0005: 文件预览按「file-viewer 支持格式全覆盖」扩大切换范围（取代 0004）

- 状态：已接受
- 日期：2026-08-14
- 取代：0004

## 背景

ADR-0004 只把 office/pdf/文本切到 flyfish-dev/file-viewer，zip 仍走自研 `ZipPreview`，图片/音视频走 iframe 原生预览。用户进一步明确：**file-viewer 支持的 208 个扩展名（25 条预览链路）全部优先用 file-viewer，而不是 kkfileview**，仅 file-viewer 不支持的格式才回退 kkfileview。

## 决策

我把渲染器依赖从 `@file-viewer/preset-office` 换成 `@file-viewer/preset-all`（覆盖全部 20 个 renderer 包），前端分流改为「file-viewer 支持的扩展名一律走 `FileViewerPreview`，其余回退 kkfileview iframe」：

1. 用 `@file-viewer/core` 的 `DEFAULT_SUPPORTED_EXTENSIONS`（`registry/formats.ts` 的唯一事实源，208 个扩展名）判定是否走 file-viewer，不手写扩展名清单。
2. 删除自研 `ZipPreview` 组件及其测试——zip 现归 file-viewer 的 archive renderer 处理（连同 7z/rar/tar/gz 等）。
3. kkfileview 链路（容器/nginx/profile/sign-url）仍全部保留，作为 file-viewer 不支持格式的兜底。

## 备选方案

1. **保留自研 ZipPreview 处理 .zip**：交互更贴合业务（列表列举 + 单项下载 + GBK 修复 + zip 炸弹防护），但与「file-viewer 支持格式全部优先 file-viewer」的诉求相悖；最终按用户明确要求删除。
2. **逐类 renderer 包按需引入**（只引 office/archive 等）：减小 bundle，但格式矩阵后续扩展需手动维护，违背「唯一事实源 + 全覆盖」原则。

## 后果

### 正面

- 一套 `preset-all` 覆盖 file-viewer 全部格式，分流逻辑退化为「在/不在 `DEFAULT_SUPPORTED_EXTENSIONS`」，简单且与上游格式矩阵自动同步。
- 删除自研 ZipPreview，减少自维护代码（GBK 修复、zip 炸弹防护等由 file-viewer archive 承担）。

### 负面 / 代价

- `preset-all` 引入全部 20 个 renderer（含 WASM：CAD/3D/typst/archive/libarchive 等），懒加载时单包体积较大；但仅预览时按需 `import()`，不影响其它页面首屏。
- 复杂 office/老格式渲染质量、大体积压缩包预览上限等，仍依赖人工实测确认效果；不合适按 0004 思路回退（恢复 iframe 分支即可）。
