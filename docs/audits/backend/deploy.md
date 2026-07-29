# 部署与运维审计

## 核心决策

- 后端保持单一 Go 服务，监听 `8080`，为前端提供统一 `/api/v1` API。
- 使用 Docker Compose 管理四个容器：
  - `zhiyu-backend`：Go 服务，端口 `8080`。健康检查 `GET /health`。
  - `zhiyu-edu`：教育管理前端 standalone，端口 `3020`。健康检查 `GET /portal/login`。
  - `zhiyu-postgres`：PostgreSQL 15 数据库，端口 `5433`（映射自容器内 `5432`）。
  - `zhiyu-redis`：Redis 7 缓存，内部端口 `6379`。
- `deploy.sh` 部署流程：
  1. 记录当前镜像 tag（`docker inspect` 获取 backend/frontend 镜像名），用于失败时回滚。
  2. 源码 hash 比对（md5）：前后端各自独立判断变更，无变更则跳过构建。
  3. 构建后端 Docker 镜像（`IMAGE_TAG` = `git rev-parse --short HEAD`）、前端 Docker 镜像（同 tag）。
  4. `docker compose up -d --remove-orphans` 启动/更新所有容器。
  5. 等待 PostgreSQL 就绪（`pg_isready`）。
  6. 首次部署：应用 baseline schema（`001_baseline.up.sql`）+ 执行种子数据；后续部署：增量执行 migration。
  7. 健康检查：轮询 `backend` 和 `frontend` 两个容器的 Docker Compose `healthy` 状态（每容器最多等待 90 秒）。
  8. 失败回滚：`docker tag` 旧镜像为 `:rollback`，`IMAGE_TAG=rollback compose up -d --no-deps` 恢复。
  9. 成功后若指定 `--branch`，自动合并回 master。
  10. 自动重载 Nginx/OpenResty 配置（拷贝 `deploy/nginx/conf.d/zhiyu-saas.conf` 并 `nginx -s reload`）。
- **分支隔离部署**：`./deploy.sh --branch <分支名>` 在独立 worktree 中拉取分支并部署，验证通过后合并回 master。支持 `--clean`（强制全量重建）和 `--skip-merge`（不自动合并）。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| Go 编译 | PASS | `go build -o bin/server ./cmd/server/main.go` 通过 |
| Go 测试 | PASS | `go test ./...` 通过 |
| 后端 Docker 镜像构建 | PASS | `docker build -t zhiyu-backend:<tag> -f Dockerfile` 成功 |
| 前端 Docker 镜像构建 | PASS | `docker build -t zhiyu-edu:<tag>` 成功（standalone 模式） |
| Docker Compose 启动 | PASS | `docker compose up -d` 成功启动四容器（backend/postgres/redis/frontend） |
| 后端健康检查 | PASS | `http://127.0.0.1:8080/health` 返回 `{"status":"ok"}` |
| 前端健康检查 | PASS | `http://127.0.0.1:3020/portal/login` 返回 200 |
| 回滚逻辑 | PASS | 通过 `docker tag` 保存旧镜像，失败时 `IMAGE_TAG=rollback compose up -d --no-deps` 恢复 |
| 数据库迁移增量执行 | PASS | 首次 baseline + seed，后续 `go run ./cmd/migrate/main.go up` 增量 |
| 分支隔离部署 | PASS | `--branch` 支持 worktree 隔离部署，`--clean` 全量重建 |

## 环境变量

- `DATABASE_URL`：PostgreSQL 连接串（格式 `postgresql://`，deploy.sh 内部解析出 `DB_USER`/`DB_PASSWORD`/`DB_NAME`）。
- `JWT_SECRET`：JWT 签名密钥。
- `BACKEND_PORT`：后端宿主机端口映射（默认 8080）。容器内部固定监听 8080。
- `EDU_PORT`：前端宿主机端口映射（默认 3020）。容器内部固定监听 3020。
- `DB_USER`/`DB_PASSWORD`/`DB_NAME`：PostgreSQL 连接凭据，由 deploy.sh 从 `DATABASE_URL` 解析后导出给 Docker Compose。

## 风险与约束

- 前端与后端在 Docker Compose 内通过容器名互联（`postgres`、`redis`），若需宿主机直连数据库，使用 `127.0.0.1:5433`。
- 回滚仅恢复 Docker 镜像版本（基于 `git rev-parse --short HEAD` 生成的 `IMAGE_TAG`），若本次部署已应用新的数据库 migration，schema 可能需要手动 down migration。
- 相同 Git commit 的代码复用已有镜像跳过构建（通过 md5 源码 hash 判断），`--clean` 可强制全量重建。
