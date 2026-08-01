# 知与 SaaS 开发契约

> **首要约束：禁止还原/覆盖他人代码。** 无论如何不得对工作区中非当次任务的文件执行 `git checkout`、`git restore`、`git reset` 等还原操作。部署时若遇到与本次任务无关的编译/类型错误，直接报错停止，告知用户即可，禁止擅自修复或还原他人未提交的修改。

## 一、分支隔离工作流

> 每个 Agent 基于 master 创建特性分支，开发提交后通过 `deploy.sh --branch` 部署验证，健康检查通过后自动合并回 master。

### 工作流程

1. **创建独立工作树**
   ```bash
   git worktree add -b feat/<agent>-<任务简述> /tmp/<agent> master && cd /tmp/<agent>
   ```

2. **开发并提交**
   ```bash
   git add -A && git commit -m "feat: 任务描述"
   git push -u origin feat/<agent>-<任务简述>
   ```

3. **隔离部署验证**
   ```bash
   ./deploy.sh --branch feat/<agent>-<任务简述>
   # 可选：--clean（强制全量重建）、--skip-merge（不自动合并）
   ```
   deploy.sh 自动判断：
   - 首次运行 → 安装系统依赖、生成 .env、初始化数据库+种子数据
   - 后续运行 → 源码 hash 比对，仅构建变更部分（后端/前端独立判断）
   - 数据库 → 首次应用 baseline schema，后续只执行增量 migration，不触碰已有数据

4. **清理工作树**
   ```bash
   cd / && git worktree remove /tmp/<agent>
   ```

### 关键约束

- 禁止直接在 master 上修改代码
- 部署前确保分支已推送
- 若与 master 冲突，先 `git rebase master` 解决
- 多个 Agent 并行开发时，各自在不同 worktree 中互不干扰

## 二、交付要求

1. 所有**代码修改**后必须通过 `./deploy.sh --branch <分支名>` 部署验证
2. **纯文档修改**（`AGENTS.md`、`docs/` 下的文件）无需走 `deploy.sh`，直接 commit 合并即可
3. 提交前检查：后端 `go vet ./...` `go test ./...`，前端 `pnpm typecheck` `pnpm lint`，migration 需配对 `.down.sql`
4. 单次 commit 只含当次变更

## 三、开发原则

- 简单优先，不过度防御；小概率异常宁可容忍
- 核心业务加锁防重复，普通业务允许报错或重复插入
- 核心接口保证流畅，非核心允许等待
- **组件复用优先**：接到需求时，先判断能否复用现有组件/函数/模式。若能复用则直接使用。若不能复用但判断该模式可能在系统中反复出现，应评估是否需要抽象为公共组件，向用户提出方案并经确认后再实施，同时将系统中类似场景一并改造，最大化复用价值

## 四、运维速查

| 操作 | 命令 |
|------|------|
| 服务状态 | `docker compose ps` |
| 后端日志 | `docker compose logs zhiyu-backend --tail 100` |
| 健康检查 | `curl -sf http://127.0.0.1:8080/health` |
| 连接数据库 | `psql "$DATABASE_URL"` |
| 回滚部署 | `git checkout <上一个tag>` 后 `./deploy.sh`，禁止手动登服务器改代码 |

环境变量（`DATABASE_URL`、`JWT_SECRET`、`PORT`）在 `.env` 配置，禁止提交仓库。

## 五、前端公共组件

> 新增页面时先查阅组件速查表：[`docs/components.md`](docs/components.md)

## 六、AI 协作者约定

1. 只改当次任务相关文件，不碰无关文件
2. 忽略工作区中他人的未提交修改，不得还原或覆盖
3. 未经确认不得执行 `./deploy.sh`
4. 修改后先本地验证（编译、类型检查、lint），再提请确认部署
5. 禁止无头浏览器自动视觉验证，样式问题由用户人工确认
