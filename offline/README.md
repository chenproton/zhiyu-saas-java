# 离线部署资源目录

把需要联网下载的资源提前放在这里，`deploy.sh` 会优先使用本地文件，缺失时才尝试联网下载。

## 目录结构

```
offline/
├── get-docker.sh                # Docker 官方安装脚本（可选，debs 优先）
├── node-v22.12.0-linux-x64.tar.xz  # Node.js 二进制包（可选）
│                                    # 下载: https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz
├── pnpm-9.15.9.tgz             # pnpm npm 包（必须与 PNPM_VERSION/pnpm-lock.yaml 一致）
│                                 # 下载: npm pack pnpm@9.15.9
└── docker-images/               # Docker 镜像离线包（可选，缺省时才 docker pull）
    ├── postgres-15-alpine.tar   # docker pull postgres:15-alpine && docker save -o postgres-15-alpine.tar postgres:15-alpine
    ├── redis-7-alpine.tar       # docker pull redis:7-alpine && docker save -o redis-7-alpine.tar redis:7-alpine
    ├── nginx-1.27-alpine.tar    # 网关 zhiyu-nginx 基础镜像
    ├── ubuntu-24.04.tar         # Java 后端容器基础镜像（deploy/docker/java-backend.Dockerfile）
    └── kkfileview-4.4.0.tar     # docker pull fangzhengjin/kkfileview:4.4.0 && docker save -o kkfileview-4.4.0.tar fangzhengjin/kkfileview:4.4.0
└── debs/                       # 系统依赖离线包（Ubuntu 24.04 amd64，完整依赖闭包）
    ├── docker-ce / containerd.io / docker-ce-cli / docker-buildx-plugin / docker-compose-plugin
    ├── nginx / nginx-common
    ├── postgresql-client-16 / postgresql-client / libpq5
    └── iptables / nftables / gettext-base 等依赖（可全离线安装）
├── node_modules.tar.gz          # 前端 npm 依赖离线包（可选，完全离线安装 npm 依赖用）
│                                 # 生成（联网开发机，装好全部依赖后，覆盖 portal-vue + plus-ui 两个 workspace）:
│                                 #   tar --hard-dereference -czf offline/node_modules.tar.gz \
│                                 #     frontend/portal-vue/node_modules plus-ui/node_modules
│                                 # deploy.sh 检测到本包时按仓库相对路径解压、跳过 pnpm install（无需 npm registry / pnpm store）
```

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
交付包内**不含源代码**：包含预构建的 zhiyu-java-backend 镜像、第三方镜像、
`debs/` 全部离线依赖、数据库迁移 SQL 与前端 dist（web/portal、web/plus-ui）。
客户服务器（全新 Ubuntu 24.04 x86_64）复制目录后执行 `./install.sh` 即可全离线启动；
升级执行 `./install.sh --update`。详见 `deploy/release/README.md`。

## 注意事项

- `debs/` 已包含 docker/nginx/postgresql-client 及其依赖的完整闭包（Ubuntu 24.04 amd64），
  全新空机可完全离线安装；curl/git/python3 等基础命令缺失时只影响个别辅助功能，不影响核心服务。
  补充/更新 deb 包可在联网机器执行：`apt-get download <包名>`（依赖闭包需逐层解析）。
- 后端为 Java 21（Maven 构建在开发机完成，镜像内含 JDK；客户机无需 JDK）。
- Node.js 当前使用 `v22.12.0`；如需其他版本，请同步修改 `deploy.sh` 中的 `NODE_VERSION` 与离线包文件名。
- Docker 镜像 tar 包加载时会按文件名匹配镜像名，文件不存在时自动 `docker pull`。
- 无源码离线交付包由 `scripts/package-release.sh` 生成，见其脚本头注释与 `deploy/release/README.md`。
