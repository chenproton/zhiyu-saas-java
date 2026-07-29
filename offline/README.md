# 离线部署资源目录

把需要联网下载的资源提前放在这里，`deploy.sh` 会优先使用本地文件，缺失时才尝试联网下载。

## 目录结构

```
offline/
├── get-docker.sh                # Docker 官方安装脚本（可选）
│                                 # 下载: https://get.docker.com
├── go1.23.7.linux-amd64.tar.gz  # Go 安装包（可选）
│                                 # 下载: https://mirrors.aliyun.com/golang/go1.23.7.linux-amd64.tar.gz
├── node-v22.12.0-linux-x64.tar.xz  # Node.js 二进制包（可选）
│                                    # 下载: https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz
├── pnpm-11.18.0.tgz             # pnpm npm 包（可选）
│                                 # 下载: npm pack pnpm@11.18.0
└── docker-images/               # Docker 镜像离线包（可选）
    ├── postgres-15-alpine.tar   # docker pull postgres:15-alpine && docker save -o postgres-15-alpine.tar postgres:15-alpine
    ├── redis-7-alpine.tar       # docker pull redis:7-alpine && docker save -o redis-7-alpine.tar redis:7-alpine
    └── kkfileview-4.4.0.tar     # docker pull fangzhengjin/kkfileview:4.4.0 && docker save -o kkfileview-4.4.0.tar fangzhengjin/kkfileview:4.4.0
```

## 使用方式

1. 在能联网的机器上按上方命令导出资源。
2. 把 `offline/` 整个目录连同代码一起拷贝到目标服务器。
3. 在目标服务器执行 `./deploy.sh` 即可；`deploy.sh` 会自动检测并使用本地资源。

## 注意事项

- 系统基础包（curl、git、python3、nginx、postgresql-client 等）仍依赖服务器的 `apt`/`yum` 源。离线环境请提前配置好本地源，或手动安装这些包。
- Go 版本可在 `.env` 中通过 `GO_VERSION` 调整；`offline/` 中文件名需与 `GO_VERSION` 对应。
- Node.js 当前使用 `v22.12.0`；如需其他版本，请同步修改 `deploy.sh` 中的 `NODE_VERSION` 与离线包文件名。
- Docker 镜像 tar 包加载时会按文件名匹配镜像名，文件不存在时自动 `docker pull`。
