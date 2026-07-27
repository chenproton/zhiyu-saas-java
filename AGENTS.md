# 知育 SaaS 架构收敛契约

> **首要约束：禁止还原/覆盖他人代码。** 无论如何不得对工作区中非当次任务的文件执行 `git checkout`、`git restore`、`git reset` 等还原操作。部署时若遇到与本次任务无关的编译/类型错误，直接报错停止，告知用户即可，禁止擅自修复或还原他人未提交的修改。

## 二、分支隔离工作流（多 Agent 协作）

> **核心原则：每个 Agent 基于 master 创建特性分支，在分支上开发提交。通过 `deploy.sh --branch` 进行隔离构建并部署，健康检查通过后自动将分支合并回 origin/master。分支只在开发期间存在，部署即合并，确保 master 始终是最新稳定版。**

### 工作流程

1. **创建独立工作树**（基于 master，零接触共享目录）
   ```bash
   # 一条命令完成：创建工作树 + 基于 master 创建新分支
   git worktree add -b feat/<agent>-<任务简述> /tmp/<agent> master && cd /tmp/<agent>
   ```

2. **开发并提交**
   ```bash
   git add -A && git commit -m "feat: 任务描述"
   git push -u origin feat/<agent>-<任务简述>
   ```

3. **隔离部署验证**（编译 master + 当前分支内容，健康检查通过后 **自动合并到 origin/master**）
   ```bash
   ./deploy.sh --branch feat/<agent>-<任务简述>
   # 也可组合其他参数：
   ./deploy.sh --branch feat/<agent>-<任务简述> --frontend-only
   ./deploy.sh --branch feat/<agent>-<任务简述> --backend-only --skip-checks
   # 仅验证不合并（特殊用途）：
   ./deploy.sh --branch feat/<agent>-<任务简述> --skip-merge
   ```

4. **清理工作树**
   ```bash
   # 先切到其他目录再删除
   cd / && git worktree remove /tmp/<agent>
   ```

### 注意事项

- 分支名建议格式：`feat/<agent>-<简短描述>`，如 `feat/agent-A-student-profile`
- 部署前确保分支已推送至远程仓库
- 健康检查通过后自动合并分支到 origin/master，使用 `--skip-merge` 可跳过自动合并
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

1. **部署验证**。所有修改后，必须通过 `deploy.sh --branch <分支名>` 完成部署验证（`--branch` 为必填参数，不支持无分支部署）。可选参数：`--frontend-only` / `--backend-only` / `--skip-checks`。
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

### 演示环境

| 项目 | 值 |
|------|-----|
| SSH | `ssh root@171.80.10.237`（密码 `lEL9cHcBQMjCEqp6`） |
| 项目目录 | `/root/projects/zhiyu-saas` |
| 部署脚本 | `./deploy.sh --demo`（也可用 `./deploydemo.sh` 兼容旧脚本） |

> 该环境为演示/测试用途。

## 六、本地调试工具

### 模拟登录 Token 接口

开发阶段如需快速以指定用户身份调用业务接口，可开启模拟登录 Token 接口：

1. 在 `.env` 中开启开关：
   ```bash
   ENABLE_DEBUG_AUTH=true
   ```

2. 调用接口生成 JWT：
   ```bash
   # 通过用户 ID 生成
   curl -X POST http://127.0.0.1:8080/api/v1/auth/debug/token \
     -H "Content-Type: application/json" \
     -d '{"user_id": "替换成用户UUID"}'

   # 或通过用户名生成（默认 saas 平台）
   curl -X POST http://127.0.0.1:8080/api/v1/auth/debug/token \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "platform": "saas"}'
   ```

3. 返回示例：
   ```json
   {
     "token": "eyJ...",
     "user": { ... }
   }
   ```

4. 后续请求携带该 token：
   ```bash
   curl http://127.0.0.1:8080/api/v1/auth/me \
     -H "Authorization: Bearer eyJ..."
   ```

> ⚠️ 该接口默认关闭，仅在 `ENABLE_DEBUG_AUTH=true` 时可用，**生产环境务必保持关闭**。

## 七、前端公共组件目录

> **核心原则：新增页面时，优先查找以下公共组件复用，避免重复造轮子。** 所有组件位于 `apps/edu/components/shared/`。

### 页面级组件（整页壳子，注入 API 即可）

| 组件 | 文件 | 适用场景 | 使用方式 |
|------|------|---------|---------|
| `ContentListPage<T>` | `content-list-page.tsx` | **内容资源管理列表页**（岗位/场景/课程/题库/试卷等，含 Tab 筛选、批量操作、导入导出） | 注入 `itemApi`/`batchApi`/`approvalApi` + `renderList` 渲染函子 |
| `EvaluationListTable` | `evaluation/evaluation-list-table.tsx` | **评测列表渲染器**（题库/试卷的 renderList，含草稿池/权限/审批按钮等评测特有逻辑） | `renderList` 中传入 `<EvaluationListTable ... type="bank"|"exam" />` |
| `BatchGroupPage` | `batch-group-page.tsx` | **批次分组管理页**（新建/编辑/删除批次，关联审批流程） | 注入 `api: BatchGroupApi` + `subtitle`/`namePlaceholder`/`workflowHint` 文案 |
| `WorkflowConfigPage` | `workflow-config-page.tsx` | **审批流配置页**（创建/编辑/删除审批流模板） | 仅需 `subtitle` 文案 |
| `ApprovalListPage<T>` | `approval-list-page.tsx` | **审批中心列表页**（待审批/已审批 Tab、单选/批量通过驳回） | 注入审批数据 + `columns` 列定义 + `detailHref` 链接 |
| `EditorShell` | `editor-shell.tsx` | **内容编辑器框架**（全屏/内嵌、步骤导航、保存/提交按钮） | 设置 `mode`/`step`/`onSaveDraft`/`onSubmit` 等回调 |
| `PortalCrudPage<T>` | `portal-crud-page.tsx` | **Portal 系统管理 CRUD 表格页**（行业/专业等，含搜索/新增/编辑/删除/启停） | 注入 `fetchItems`/`columns`/`renderForm`/`onSave`/`onDelete` + `importFlow` |
| `PortalSidebarCrudPage<T>` | `portal-sidebar-crud-page.tsx` | **Portal 组织树筛选 CRUD 表格页**（教师/学生等，含左侧组织树+表格+批量操作+导入导出） | 注入 `fetchItems`/`columns`/`renderForm`/`onSave`/`onDelete` + `importFlow` + `orgFilterTree` |
| `ArchiveListPage<T>` | `archive-list-page.tsx` | **归档管理页**（左侧分类筛选+表格+恢复/删除） | 注入 `columns`/`detailHref`/`onRestore`/`onDelete` + 数据 + 侧边栏项目 |

### 表单/交互组件

| 组件 | 文件 | 适用场景 | 使用方式 |
|------|------|---------|---------|
| `UserSelector` | `user-selector.tsx`（400行） | **选择用户**（支持多选/单选、组织树筛选、排除学生） | `value`+`onChange`+`multiple`+`excludeStudent`+`tenantId` |
| `OrgNodePicker` | `org-node-picker.tsx` | **组织节点选择器**（Popover 形式） | `value`+`onChange` |
| `StatusBadge` | `status-badge.tsx` | **状态标签**（统一颜色体系，覆盖 draft/pending/approved/rejected/published/archived 等） | `<StatusBadge status={item.status} />` |
| `TableRowActions` | `table-row-actions.tsx` | **表格行悬浮操作按钮**（替代手写 `group-hover:opacity-100` 模式，需配合 `<Table>` 使用） | `<TableRowActions><Button>编辑</Button><Button>删除</Button></TableRowActions>` |
| `HoverActionBar` | `hover-action-bar.tsx` | **悬浮操作按钮栏**（用于 Grid 布局或非 Table 场景的 hover 操作） | `<div className="relative"><HoverActionBar>...</HoverActionBar></div>` |
| `ConfirmDialog` | `confirm-dialog.tsx` | **确认对话框**（危险操作二次确认） | `open`+`onOpenChange`+`title`+`description`+`variant`+`onConfirm` |
| `ImportConfirmDialog` | `import-confirm-dialog.tsx` | **导入重复确认对话框**（覆盖/跳过选择） | `open`+`entityLabel`+`created/duplicates/failed`+`onConfirmOverwrite`+`onConfirmSkip` |
| `ResourcePreviewModal` | `resource-preview-modal.tsx` | **文件预览弹窗**（kkFileView iframe，可拖拽/缩放/堆叠） | `<ResourcePreviewModal resource={...} open={...} onOpenChange={...} />` |

### Hooks

| Hook | 文件 | 适用场景 |
|------|------|---------|
| `useApprovalDialogs` | `_components/approval-dialogs.tsx` | **审批通过/驳回对话框**（返回 dialogs + approveAction + batchActionButtons，已内聚到 ApprovalListPage） |
| `useApprovals` | `@/hooks/use-approvals` | **审批记录数据**（records、approve、reject、batchApprove、batchReject、getStepInfo） |
| `useSubmitterNames` | `@/hooks/use-submitter-names` | **提交人姓名缓存**（getName(userId) 批量解析用户名） |
| `useImportFlow` | `@/hooks/use-import-flow` | **导入流程逻辑**（下载模板、预览、执行导入、重复处理） |

### 评测专用组件

| 组件 | 文件 | 适用场景 |
|------|------|---------|
| `EvaluationListTable` | `evaluation/evaluation-list-table.tsx` | **评测列表渲染器**（题库/试卷的 renderList，含草稿池/权限/审批按钮） |
| `EvaluationStatusActions` | `evaluation/evaluation-status-actions.tsx` | **评测资源状态操作按钮行**（编辑/提交/撤回/通过/驳回/发布等，题库/试卷统一） |

### 布局/展示组件

| 组件 | 文件 | 适用场景 |
|------|------|---------|
| `PageHeaderCard` | `page-header-card.tsx` | **页头统计卡片**（标题 + 统计数字 + 操作按钮） |
| `PlatformShell` | `platform-shell/` | **平台整体布局壳子**（侧边栏 + 顶栏 + 内容区） |
| `LogTableShell<T>` | `log-table-shell.tsx` | **日志表格壳子**（表格 + 加载/空态 + 分页，注入 `columns` 列定义） |
| `BatchSelector` | `batch-selector.tsx` | **批次选择器**（下拉选择 + 创建新批次） |
| `ResetPasswordDialog` | `reset-password-dialog.tsx` | **重置密码对话框** |

### 内部组件约定（`_components/`）

> 以下组件已从公共 API 中移除，仅作为特定页面壳子的内部子组件存在。新增页面时不要直接引用这些组件。

| 组件 | 位置 | 所属页面壳子 |
|------|------|-------------|
| `WorkflowEditor` | `shared/_components/` | `WorkflowConfigPage` |
| `ApprovalDialogs` | `shared/_components/` | `ApprovalListPage` |
| `OrgFilterTree` | `shared/_components/` | `PortalSidebarCrudPage` |
| `SchoolAdminManager` | `portal/.../tenant/_components/` | 租户信息管理页 |

### 通用页面模式速查

| 页面类型 | 复用方案 | 示例 |
|---------|---------|------|
| 带审批的内容资源管理（岗位/场景/课程/题库/试卷） | `ContentListPage` + 模块专用 `renderList` | `app/job/positions/page.tsx`、`app/scene/page.tsx`、`app/evaluation/question-banks/page.tsx` |
| 批次分组管理 | `BatchGroupPage` | `app/*/batches/page.tsx`（4 个模块全是 15 行薄壳） |
| 审批流配置 | `WorkflowConfigPage` | `app/*/workflows/page.tsx`（4 个模块全是 7 行薄壳） |
| 审批中心 | `ApprovalListPage` | `app/*/approvals/page.tsx`（4 个模块复用） |
| 内容编辑器 | `EditorShell` | `app/*/[id]/edit/page.tsx`（7 个编辑器页面复用） |
| Portal 系统管理 CRUD 表格 | `PortalCrudPage` / `PortalSidebarCrudPage` | `app/portal/apps/system/resource/industries/page.tsx`、`teachers/page.tsx` |
| 归档管理 | `ArchiveListPage` | `app/*/archive/page.tsx`（3 个模块复用） |
| 日志查看（表格+分页） | `LogTableShell<T>` | `app/portal/apps/system/logs/login/page.tsx`、`operation/page.tsx` |

### 注意事项

1. **不要定义本地 `STATUS_CONFIG`**。已有的全局 `getStatusConfig()`（在 `packages/shared-types/src/status.ts`）覆盖了 draft/pending/approved/rejected/published/archived/reviewing/in_progress/finished 等全部状态，配合 `<StatusBadge>` 使用即可。
2. **表格行操作按钮**应使用 `<TableRowActions>` 组件，不要手写 `group-hover:opacity-100` 的 div。
3. **共建人选择**优先使用已有的 `CoBuilderDialog`，避免在页面中内联实现两栏穿梭选人。
4. **导入流程**新页面应使用 `useImportFlow` hook，统一下载模板、预览、去重确认、执行导入的流程。
5. **删除确认**统一使用 `<ConfirmDialog>`，禁止使用浏览器原生 `window.confirm()`。
6. **就近放置**：仅被一个页面/组件使用的子组件，放在该消费者的 `_components/` 子目录下，不要放入 `shared/`。

## 八、AI 协作者约定

1. 只改当次任务相关文件，不碰无关文件。
2. 忽略工作区中他人的未提交修改，不得还原或覆盖。
3. 未经确认不得执行 `./deploy.sh`。
4. 修改后先本地验证（编译、类型检查、lint），再提请确认部署。
5. 禁止无头浏览器自动视觉验证，样式问题由用户人工确认。
