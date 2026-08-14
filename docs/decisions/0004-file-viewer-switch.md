# 0004: 文件预览从 kkfileview 切换为 flyfish-dev/file-viewer（kkfileview 保留作回退）

- 状态：已接受
- 日期：2026-08-14

## 背景

文档/附件预览原集成 kkfileview（`fangzhengjin/kkfileview`），走「服务端转换 + iframe 代理」：前端把文件 URL base64 后请求 `/kkfileview/onlinePreview?url=...`，由 kkfileview 服务端抓取并转换，再用 iframe 展示。该方案需额外启动一个进程较重的预览服务容器（端口 8012，含 LibreOffice/ffmpeg），且转换质量、跨域、认证（需签名 URL 放行）均有额外成本。

用户要求先把预览渲染器切换到 [flyfish-dev/file-viewer](https://github.com/flyfish-dev/file-viewer)（浏览器原生、无服务端转换），但**保留 kkfileview**，看效果后再决定是否删除；不合适则回退。

## 决策

我把 office/pdf/文本类附件的前端预览改为 `@file-viewer/react` + `@file-viewer/preset-office`（浏览器内 fetch 文件并原生渲染），kkfileview 的容器、nginx 反代、profile、sign-url 接口**全部保留不动**，作为随时可回退的兜底。zip 继续走自研 `ZipPreview`，图片/音视频继续走 iframe 原生预览（不受影响）。

## 备选方案

1. **继续只用 kkfileview**：成熟稳定，但服务端转换开销大、依赖重容器，且是本次任务的「现状」而非目标。
2. **一次性删除 kkfileview 全链**：最干净，但违反「先看效果、不合适回退」的要求，删了就不易低成本回退。
3. **后端再加一套 file-viewer 服务容器**：file-viewer 本身是浏览器原生库，无官方「服务端预览」形态；自建容器反而违背它「无服务端转换」的定位，故否决。

## 后果

### 正面

- 去掉服务端转换，pdf/office 由浏览器原生渲染，部署更轻、无额外转换进程。
- 组件懒加载 `@file-viewer/preset-office`，只在真正预览时拉取，不影响其它页面首屏。

### 负面 / 代价

- file-viewer 需浏览器直接 fetch `/uploads/`；当前 `/uploads` 走 `OptionalJWT`（auth cookie + 签名 URL 双通道），同源请求带 cookie 大概率直接可用，但这条链路与 kkfileview「服务端抓取 + 签名 URL」机制不同，需人工实测确认跨租户/外链场景。
- office 渲染质量（复杂排版/公式/老格式 .doc/.ppt）可能不如 kkfileview 的服务端转换，需按效果决定去留。
- 若验证不合适需回退：恢复 `resource-preview-modal.tsx` 的 iframe 渲染分支即可，kkfileview 链路未删，回退成本低。
