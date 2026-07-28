# 知育 SaaS 架构收敛契约

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
   # 可选：--frontend-only / --backend-only / --skip-checks / --skip-merge
   ```

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
3. 提交前检查：后端 `go vet ./...` `go test ./...`，前端 `pnpm exec tsc --noEmit` `pnpm lint`，migration 需配对 `.down.sql`
4. 修改 `AGENTS.md` 或 `docs/` 下的文件必须独立 commit
5. 单次 commit 只含当次变更

## 三、开发原则

- 简单优先，不过度防御；小概率异常宁可容忍
- 核心业务加锁防重复，普通业务允许报错或重复插入
- 核心接口保证流畅，非核心允许等待

## 四、运维速查

| 操作 | 命令 |
|------|------|
| 服务状态 | `pm2 status` |
| 后端日志 | `pm2 logs zhiyu-backend --lines 100` |
| 健康检查 | `curl -sf http://127.0.0.1:8080/health` |
| 连接数据库 | `psql "$DATABASE_URL"` |
| 回滚部署 | `git checkout <上一个tag>` 后 `./deploy.sh`，禁止手动登服务器改代码 |

环境变量（`DATABASE_URL`、`JWT_SECRET`、`PORT`）在 `.env` 配置，禁止提交仓库。

> 演示环境：服务器地址与登录凭证请咨询运维或查看安全凭证存储，项目位于 `/root/projects/zhiyu-saas`。

## 五、前端公共组件

> 新增页面时先查阅组件速查表：[`docs/components.md`](docs/components.md)

### 页面级壳（`apps/edu/components/shared/`）

- `ContentListPage<T>` — 内容资源管理列表页（含 Tab 筛选、批量操作、导入导出），4 个业务模块共用
- `BatchGroupPage` — 批次分组管理，4 个模块共用
- `WorkflowConfigPage` — 审批流配置，4 个模块共用
- `ApprovalListPage<T>` — 审批中心（待审批/已审批），4 个模块共用
- `ArchiveListPage<T>` — 归档管理（左侧筛选+表格+恢复/删除），3 个模块共用
- `PortalCrudPage<T>` — Portal 系统管理 CRUD 表格
- `PortalSidebarCrudPage<T>` — Portal 组织树筛选 CRUD 表格
- `EditorShell` — 内容编辑器框架（步骤导航、保存/提交），7 个页面共用
- `PlatformLayout` — 认证守卫版 PlatformShell（未登录跳转、无权限拒绝）
- `LogTableShell<T>` — 日志表格壳
- `EvaluationListTable` — 评测列表渲染器

### 基础交互（`packages/ui/src/components/shared/`，`@zhiyu/ui` 导入）

1. **不要定义本地 `STATUS_CONFIG`**。已有全局 `getStatusConfig()`（`packages/shared-types/src/status.ts`），配合 `<StatusBadge>` 使用
2. **删除确认** 使用 `<ConfirmDialog>`，禁止 `window.confirm()`
3. **表格行操作** 使用 `<TableRowActions>` / `<HoverActionBar>`，不要手写 `group-hover`
4. **导入流程** 使用 `useImportFlow` hook
5. **就近放置**：仅被一处使用的子组件放在消费者 `_components/` 下，不要放入 `shared/`

### 选择器

- `MajorSelect` — 专业下拉，自动加载
- `BatchSelector` — 批次选择+创建
- `UserSelector` — 用户选择（多选/单选/排除）
- `OrgNodePicker` — 组织节点 Popover

### 其他交互组件

- `ResourcePreviewModal` — 文件预览弹窗
- `ImportConfirmDialog` — 导入重复确认
- `ResetPasswordDialog` — 重置密码
- `CoverImageUpload` — 封面上传
- `GranularLessonSelectDialog` — 课时多选
- `KnowledgePointFormDialog` — 知识点CRUD
- `PageHeaderCard` / `LandingFilterRow` / `LandingPagination` — Landing 页组件

### Hooks

- `useImportFlow` / `useApprovals` / `useSubmitterNames` / `useOrgTree` / `usePortalUsers` / `useSubscriptionModules` — `@/hooks/`
- `useToast` / `useIsMobile` / `usePlatformLinks` / `useAppModules` — `@zhiyu/ui`
- `DataProvider`（`createDataContext` + `createUseData` 工厂） — 评测数据上下文，`@zhiyu/ui` 导出

## 六、AI 协作者约定

1. 只改当次任务相关文件，不碰无关文件
2. 忽略工作区中他人的未提交修改，不得还原或覆盖
3. 未经确认不得执行 `./deploy.sh`
4. 修改后先本地验证（编译、类型检查、lint），再提请确认部署
5. 禁止无头浏览器自动视觉验证，样式问题由用户人工确认
