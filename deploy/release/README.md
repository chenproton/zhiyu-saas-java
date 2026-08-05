# 知与 SaaS 离线部署包

本目录为**无源码离线交付包**：将整个目录复制到客户服务器的 U 盘/移动硬盘，
在服务器上执行一条命令即可完成全部服务的安装与启动。
全程**无需联网、无需源代码、无需 Go/Node 工具链**。

## 环境要求

- Ubuntu 24.04 x86_64 操作系统（全新空机即可，本包自带 Docker/Nginx 等依赖）
- root 权限
- 至少 8GB 内存、30GB 磁盘空间

## 快速开始（首次安装）

```bash
sudo ./install.sh
```

脚本自动完成：
1. 离线安装 Docker、Nginx、PostgreSQL 客户端
2. 导入全部服务镜像
3. 生成随机数据库密码与密钥（配置保存在 `/opt/zhiyu-saas/.env`）
4. 启动数据库并执行迁移、初始化种子数据
5. 配置 Nginx 网关并做健康检查

部署完成后访问：

```
http://<服务器IP>/portal/login
管理员账号: admin / admin123   （租户: platform）
```

> 部署后请务必修改管理员密码，并可在 `/opt/zhiyu-saas/.env` 中
> 修改端口（如 80 被占用会自动回退）、种子密码（SEED_ADMIN_PASSWORD）等。

## 日常运维

| 操作 | 命令 |
|------|------|
| 启动全部服务 | `sudo ./start.sh` |
| 停止全部服务（数据保留） | `sudo ./stop.sh` |
| 查看服务状态 | `docker compose -f /opt/zhiyu-saas/docker-compose.yml ps` |
| 查看后端日志 | `docker compose -f /opt/zhiyu-saas/docker-compose.yml logs -f backend` |
| 健康检查 | `curl -sf http://127.0.0.1:8080/health` |

## 升级

将新版本包目录复制到服务器后执行：

```bash
sudo ./install.sh --update
```

升级**保留全部数据**（数据库、上传文件），仅应用增量数据库迁移；
升级前自动备份数据库到 `/opt/zhiyu-saas/backups/`。

## 目录说明

```
├── images/        # 全部服务镜像（后端/前端/PostgreSQL/Redis/kkFileView）
├── debs/          # 系统依赖离线包（Docker/Nginx/PostgreSQL 客户端）
├── bin/           # 数据库迁移与种子初始化工具（静态二进制）
├── migrations/    # 数据库迁移 SQL
├── deploy/        # Docker Compose 与 Nginx 配置
├── install.sh     # 一键安装/升级
├── start.sh       # 启动服务
├── stop.sh        # 停止服务
└── VERSION        # 版本号
```

## 常见问题

- **80 端口被占用**：安装脚本会自动回退到 2026 端口，最终入口地址以安装日志为准。
- **忘记管理员密码**：修改 `/opt/zhiyu-saas/.env` 中的 `SEED_ADMIN_PASSWORD`，
  然后执行 `sudo ./install.sh --update`（会重置 admin 密码）。
- **需要 HTTPS 域名**：修改 `/opt/zhiyu-saas/.env` 中的
  `NGINX_SSL_DOMAIN / NGINX_SSL_CERT / NGINX_SSL_CERT_KEY` 后重新执行 `./install.sh --update`。
- **部署失败**：执行 `docker compose -f /opt/zhiyu-saas/docker-compose.yml logs --tail 50` 查看日志，
  数据库备份在 `/opt/zhiyu-saas/backups/`。
