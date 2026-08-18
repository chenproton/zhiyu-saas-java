# 离线部署资源目录

把需要联网下载的资源提前放在这里，`deploy.sh` 会优先使用本地文件，缺失时才尝试联网下载。

## 目录结构

```
offline/
├── get-docker.sh                # Docker 官方安装脚本（可选，debs 优先）
├── go1.25.0.linux-amd64.tar.gz  # Go 安装包（必须与 go.mod 的 go 版本一致）
│                                 # 下载: https://mirrors.aliyun.com/golang/go1.25.0.linux-amd64.tar.gz
├── node-v22.12.0-linux-x64.tar.xz  # Node.js 二进制包（可选）
│                                    # 下载: https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz
├── pnpm-9.15.9.tgz             # pnpm npm 包（必须与 PNPM_VERSION/pnpm-lock.yaml 一致）
│                                 # 下载: npm pack pnpm@9.15.9
└── docker-images/               # Docker 镜像离线包（可选，缺省时才 docker pull）
    ├── postgres-15-alpine.tar   # docker pull postgres:15-alpine && docker save -o postgres-15-alpine.tar postgres:15-alpine
    ├── redis-7-alpine.tar       # docker pull redis:7-alpine && docker save -o redis-7-alpine.tar redis:7-alpine
    ├── nginx-1.27-alpine.tar    # 网关 zhiyu-nginx + 前端容器 zhiyu-edu 基础镜像
    ├── alpine-3.21.tar          # Go 后端容器基础镜像（backend/go/Dockerfile）
    ├── ubuntu-24.04.tar         # Java 后端容器基础镜像（deploy/docker/java-backend.Dockerfile）
    └── kkfileview-4.4.0.tar     # docker pull fangzhengjin/kkfileview:4.4.0 && docker save -o kkfileview-4.4.0.tar fangzhengjin/kkfileview:4.4.0
└── image-editor/               # 图片编辑器（unlayer）完整离线资产（必需）
    ├── embed.js                # 加载器（base 已改写为同源 /image-editor）
    └── 2.2.0/
        ├── editor.js           # 编辑器核心（~1MB）
        └── assets/             # 字体(21) + 贴纸/相框图片(664)，共 ~17MB
                                # 更新: 从 https://cdn.unlayer.com/image-editor/{VERSION}/assets/ 镜像
└── debs/                       # 系统依赖离线包（Ubuntu 24.04 amd64，完整依赖闭包）
    ├── docker-ce / containerd.io / docker-ce-cli / docker-buildx-plugin / docker-compose-plugin
    ├── nginx / nginx-common
    ├── postgresql-client-16 / postgresql-client / libpq5
    └── iptables / nftables / gettext-base 等依赖（可全离线安装）
└── ip2region_v4.xdb            # ip2region v2.2 IPv4 数据文件（必需，~11MB，登录日志 IP 归属地）
                                # 下载: https://github.com/lionsoul2014/ip2region/raw/master/data/ip2region_v4.xdb
                                # deploy.sh 构建后端镜像时自动打包进容器 /app/data/
├── node_modules.tar.gz          # 前端 npm 依赖离线包（可选，完全离线安装 npm 依赖用）
│                                 # 生成（联网开发机，装好全部依赖后，覆盖 React(edu) + Vue(portal-vue) 两个 workspace）:
│                                 #   tar --hard-dereference -czf offline/node_modules.tar.gz \
│                                 #     node_modules frontend/edu/node_modules \
│                                 #     frontend/packages/{ui,api-client,shared-types}/node_modules \
│                                 #     frontend/portal-vue/node_modules
│                                 # deploy.sh/deploy-java.sh 检测到本包时解压到构建树、跳过 pnpm install（无需 npm registry / pnpm store）
└── file-viewer/                # file-viewer 预览服务的运行时离线资产（typst 默认字体）
    └── typst-fonts/            # 17 个开源字体（DejaVuSansMono / LibertinusSerif / NewCM / NewCMMath，~8.4MB）
                                # 下载: https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts/
                                # prebuild 脚本复制到 frontend/edu/public/wasm/typst/fonts/（typst 预览，无 CDN 依赖）
```

> file-viewer 其余运行时资产（CAD/archive/ppt/model/typst 的 worker/wasm、pdf 的 cmaps/标准字体/CJK 字体兜底）
> 均来自 npm 依赖包（`@flyfish-dev/cad-viewer`、`libarchive.js`、`@file-viewer/ppt`、`occt-import-js`、
> `@myriaddreamin/typst-ts-*`、`pdfjs-dist`、`@fontsource-variable/noto-sans-sc`），由
> `frontend/edu/scripts/copy-file-viewer-assets.mjs` 在 `vite build` 前自动复制到 `frontend/edu/public/`，
> 无需额外离线下载。唯一需要从 CDN 预置的是 `file-viewer/typst-fonts/`（上方）。

## 使用方式

1. 在能联网的机器上按上方命令导出资源。
2. 把 `offline/` 整个目录连同代码一起拷贝到目标服务器。
3. 在目标服务器执行 `./deploy.sh` 即可；`deploy.sh` 会自动检测并使用本地资源。

> **关于 npm 依赖离线**：`node_modules.tar.gz`（~370MB）用于「完全无外网、源码部署」场景，
> 命中后 `deploy.sh` 直接解压依赖、跳过 `pnpm install`。若目标服务器可访问 npm registry，
> 无需生成此包（`pnpm install` 会自动联网）。注意该包是平台相关的（linux x64），且
> 依赖版本变化后需在联网机重新生成。

## 生成无源码交付包（实施部署）

```bash
./scripts/package-release.sh v1.0.0
```

产物位于 `release/zhiyu-saas-v1.0.0/`（及同名 tar.gz，约 1.1GB，可复制到 U 盘）。
交付包内**不含源代码**：包含预构建的 zhiyu-backend/zhiyu-edu 镜像、第三方镜像、
`debs/` 全部离线依赖、数据库迁移 SQL 与静态迁移/种子工具。客户服务器（全新
Ubuntu 24.04 x86_64）复制目录后执行 `./install.sh` 即可全离线启动；
升级执行 `./install.sh --update`。详见 `deploy/release/README.md`。

## 图片编辑器（unlayer）离线说明

- 资产位于 `offline/image-editor/`，随代码提交；`deploy.sh` 构建前端时自动同步到
  `frontend/edu/public/image-editor/`（`frontend/edu/public/image-editor` 是指向仓库
  `offline/image-editor` 的符号链接，供本地 `vite dev/build` 直接使用）。
- 前端通过 `scriptUrl="/image-editor/embed.js"` + `env.IMAGE_EDITOR_BASE_URL` +
  `offline: true` 使用本地资产，全程无外部请求（Google Fonts 的 UI 字体请求会失败，
  自动回退系统字体，仅外观微差）。

## 注意事项

- `debs/` 已包含 docker/nginx/postgresql-client 及其依赖的完整闭包（Ubuntu 24.04 amd64），
  全新空机可完全离线安装；curl/git/python3 等基础命令缺失时只影响个别辅助功能，不影响核心服务。
  补充/更新 deb 包可在联网机器执行：`apt-get download <包名>`（依赖闭包需逐层解析）。
- Go 版本可在 `.env` 中通过 `GO_VERSION` 调整；`offline/` 中文件名需与 `GO_VERSION` 对应。
- Node.js 当前使用 `v22.12.0`；如需其他版本，请同步修改 `deploy.sh` 中的 `NODE_VERSION` 与离线包文件名。
- Docker 镜像 tar 包加载时会按文件名匹配镜像名，文件不存在时自动 `docker pull`。
- 无源码离线交付包由 `scripts/package-release.sh` 生成，见其脚本头注释与 `deploy/release/README.md`。
