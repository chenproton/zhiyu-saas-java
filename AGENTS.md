# 知育 SaaS 架构收敛契约

> **首要约束：禁止还原/覆盖他人代码。** 无论如何不得对工作区中非当次任务的文件执行 `git checkout`、`git restore`、`git reset` 等还原操作。部署时若遇到与本次任务无关的编译/类型错误，直接报错停止，告知用户即可，禁止擅自修复或还原他人未提交的修改。

## 二、分支隔离工作流（多 Agent 协作）

> **核心原则：每个 Agent 基于 master 创建特性分支，在分支上开发提交，通过 `--branch` 进行隔离部署（仅构建 master + 当前分支变更），验证通过后再合并回 master，确保 master 始终可编译可部署。**

### 工作流程

1. **创建特性分支**（基于最新 master）
   ```bash
   git checkout master && git pull && git checkout -b feat/<agent>-<任务简述>
   ```

2. **开发并提交**
   ```bash
   git add -A && git commit -m "feat: 任务描述"
   git push -u origin feat/<agent>-<任务简述>
   ```

3. **隔离部署验证**（只会编译 master + 当前分支内容，不引入其他 Agent 中间修改）
   ```bash
   ./deploy.sh --branch feat/<agent>-<任务简述>
   # 也可组合其他参数：
   ./deploy.sh --branch feat/<agent>-<任务简述> --frontend-only
   ./deploy.sh --branch feat/<agent>-<任务简述> --backend-only --skip-checks
   ```

4. **验证通过后合并回 master**
   ```bash
   git checkout master && git pull && git merge feat/<agent>-<任务简述> && git push
   ```

### 注意事项

- 分支名建议格式：`feat/<agent>-<简短描述>`，如 `feat/agent-A-student-profile`
- 部署前确保分支已推送至远程仓库
- 若分支与 master 存在冲突，先 `git checkout feat/xxx && git rebase master` 解决后再部署
- 禁止直接在 master 分支上修改代码，master 仅用于拉取最新代码和合并已验证分支
- 多个 Agent 并行开发时，各自在不同分支上互不干扰；部署时 `--branch` 参数保证只编译「master + 当前分支」的代码
- **推荐：使用独立工作树开发**。多个 Agent 在同一台服务器上用同一目录开发，未提交的文件会互相可见。建议每个 Agent 在自己的 git worktree 中开发，做到开发和部署完全隔离：
  ```bash
  # Agent A：在自己的目录中开发
  git worktree add /tmp/agent-a feat/<agent>-<任务简述> && cd /tmp/agent-a
  # ... 修改代码、提交、推送 ...
  ./deploy.sh --branch feat/<agent>-<任务简述>

  # Agent B：同理，完全隔离
  git worktree add /tmp/agent-b feat/<agent>-<任务简述> && cd /tmp/agent-b
  # ... 修改代码、提交、推送 ...
  ./deploy.sh --branch feat/<agent>-<任务简述>

  # 任务完成后清理 worktree：
  git worktree remove /tmp/agent-a
  ```
  工作树创建后可正常使用所有开发工具（go build、pnpm dev 等），不同 Agent 的工作树互不影响。

## 三、交付要求

1. **部署验证**。所有修改后，必须通过 `deploy.sh` 完成部署验证。根据变更范围选参数：`--frontend-only` / `--backend-only` / 默认全部。
2. **提交前检查**：后端 `go vet ./...` `go test ./...`，前端 `pnpm exec tsc --noEmit` `pnpm lint`，migration 需配对 `.down.sql`。
3. **文档变更独立提交**。修改 `AGENTS.md` 或 `docs/audits/*.md` 必须独立 commit。
4. **版本控制**。每次任务完成后 git 提交并推送，单次 commit 只含当次变更。

## 四、开发原则

- 简单优先，不过度防御；小概率异常宁可容忍
- 核心业务加锁防重复，普通业务允许报错或重复插入
- 核心接口保证流畅，非核心允许等待

## 五、部署与运维

| 操作 | 命令 |
|------|------|
| 服务状态 | `pm2 status` |
| 后端日志 | `pm2 logs zhiyu-backend --lines 100` |
| 健康检查 | `curl -sf http://127.0.0.1:8080/health` |
| 连接数据库 | `psql "$DATABASE_URL"` |
| 回滚部署 | `git checkout <上一个tag>` 后 `./deploy.sh`，禁止手动登服务器改代码 |

环境变量（`DATABASE_URL`、`JWT_SECRET`、`PORT`）在 `.env` 或服务器环境变量配置，禁止提交仓库。

## 七、AI 协作者约定

1. 只改当次任务相关文件，不碰无关文件。
2. 忽略工作区中他人的未提交修改，不得还原或覆盖。
3. 未经确认不得执行 `./deploy.sh`。
4. 修改后先本地验证（编译、类型检查、lint），再提请确认部署。
5. 禁止无头浏览器自动视觉验证，样式问题由用户人工确认。
