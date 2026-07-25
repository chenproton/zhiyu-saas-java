# 审计记录

> 本文件记录 `docs/audits/*.md` 中各模块的审查结果与状态变更。
> 按时间倒序排列，最新记录在最上方。

## 记录格式

```markdown
## YYYY-MM-DD 模块名审查

- 审计文档：`docs/audits/<path>.md`
- 审查人：Agent / 协作者名
- 结论：收敛 / 待审查 / 部分收敛
- PASS 检查点数量：N / 总检查点数量：M
- 备注：
  - 发现的问题与新增检查点
  - 需要后续跟进的事项
```

## 记录

### 2026-07-25 学生端测评入口与评价结果页审计更新

- 审计文档：
  - 更新：`docs/audits/evaluation-method-field-alignment.md`
  - 更新：`docs/audits/frontend/edu-app.md`
  - 索引：`docs/audits/AUDIT_RECORDS.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - 删除已废弃的 `/scene/landing/[id]/evaluate` 中转页引用，学生端 7 种测评方式统一在 `/scene/landing/[id]/learn` 完成。
  - 考试类（题库/试卷/随堂测）直接跳转 `/evaluation/landing/exams/{id}`。
  - 非考试类（现场问答/现场评审/成果评价/作业）通过学习页内弹窗展示说明并提交材料。
  - 补充 `/evaluation/scene-results` 列表页与详情页审查覆盖，包括默认场景选中、横向标签、学生卡片分组、一键满分、底部操作栏置底等优化。
  - 本地验证通过：`pnpm typecheck`、`pnpm lint`。
  - 部署验证通过：`./deploy.sh --branch master` 成功完成前后端构建、数据库迁移、PM2 启动与健康检查。

### 2026-07-25 审查文档覆盖补全与索引修正

- 审计文档：
  - 新增：`docs/audits/frontend/marketplace-app.md`
  - 新增：`docs/audits/backend/resource-sharing-platform.md`
  - 更新：`docs/audits/backend/job-platform.md`
  - 更新：`docs/audits/backend/scene-platform.md`
  - 更新：`docs/audits/backend/tenant-org.md`
  - 索引：`docs/audits/AUDIT_RECORDS.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - 补充商城与运营前台（`apps/marketplace`）审计文档。
  - 补充资源共享平台审计文档，覆盖 `ResourceHandler`、`ResourceLibraryHandler`、`OnSiteQuestionLibraryHandler`。
  - 补充岗位/场景的 Excel 导入/导出、模板下载、克隆能力审计。
  - 补充场景任务评价量规模板（`rubric_templates`）审计。
  - 补充超管控制台 `/api/v1/admin/tenants` 审计，标注未鉴权风险。
  - 修正 2026-07-16 记录中不存在的 `backend/user-org.md`、`frontend/admin.md` 引用，统一指向 `backend/tenant-org.md`。
  - 补录此前缺失的各平台审计文档索引记录。

### 2026-07-24 测评方式字段前后台对齐

- 审计文档：`docs/audits/evaluation-method-field-alignment.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - 学生端 `apps/edu/app/scene/landing/[id]/learn` / `evaluate` 与后台任务评价规则字段对齐。
  - 修复 `reviewSteps` 在通用转换函数中丢失、`requiresMaterial` 学生端未生效、现场评审字段缺失等问题。
  - 本地验证通过：`pnpm typecheck`、`pnpm lint`、`go vet ./... && go test ./...`。

### 2026-07-19 内容对象状态机统一

- 审计文档：`docs/audits/backend/content-status.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：6 / 总检查点数量：6
- 备注：
  - 统一岗位、场景、课程、题库、试卷五个内容对象的状态集合与流转矩阵。
  - 后端新增通用 `save-draft` 端点，统一处理 `approved`/`published` → `draft` 回退。
  - 前端所有内容编辑页保存草稿时，若原状态为 `approved`/`published`，先保存业务数据再调用 `save-draft` 并本地同步为 `draft`。
  - 可编辑状态放开为 `draft`/`rejected`/`approved`/`published`，可删除状态为 `draft`/`rejected`/`archived`。
  - 本地验证通过：`go vet ./...`、`go test ./...`、`go build ./cmd/server/main.go`、`pnpm -r typecheck`、`pnpm -r lint`（0 errors）、`pnpm build:edu`、`pnpm build:marketplace`。

### 2026-07-16 组织用户体系打通

- 审计文档：`docs/audits/backend/tenant-org.md`、`docs/audits/frontend/edu-app.md`
- 审查人：Agent
- 结论：待审查
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - 数据库迁移已补齐 `batches.tenant_id`、`major_id`、外键与触发器；`users.org_node_id` 统一指向组织架构叶子节点（教师→院系/部门，学生→班级）。
  - 后端 batch handler 增加 `orgNodeId`/`majorId` 校验与租户隔离。
  - 共享类型 `JobBatch`/`SceneBatch`/`LessonBatch`/`EvaluationBatch` 增加 `tenantId`/`orgNodeId`/`majorId`。
  - 新增 `useOrgTree`、`OrgNodeSelect`、`MajorSelect`。
  - 前端教师/学生/账户页改用 `/portal/apps/system/org-user/org-structure` 真实组织架构树。
  - `/job/batches`、`/scene/batches`、`/lesson/admin/batches` 新建/编辑批次改为选择真实二级学院与专业。
  - 共建人弹窗按 `user.orgNodeId` 对应的真实组织节点分组。
  - 本地验证通过：`go vet ./...`、`go test ./...`、`go build ./cmd/server/main.go`、`pnpm exec tsc --noEmit`、`pnpm lint`（0 errors）、`pnpm test`。
  - 部署验证通过：`./deploy.sh` 成功完成前后端构建、数据库迁移、PM2 启动与健康检查。
  - 已变更模块需回归审查，确认数据一致性与权限隔离。

### 2026-07-15 前端基础设施审查

- 审计文档：`docs/audits/frontend/infra.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：7 / 总检查点数量：7
- 备注：
  - 已将单 Next.js 应用拆分为 `apps/marketplace` 与 `apps/edu`，并建立 `@zhiyu/ui`、`@zhiyu/api-client`、`@zhiyu/shared-types` 共享包。
  - 两个应用均通过 `tsc --noEmit` 与 `next build`。
  - `./deploy.sh` 成功部署两个前端并通过健康检查。
  - 通过 `NEXT_PUBLIC_DEFAULT_PLATFORM` 确保教育管理应用的所有路由使用 portal token，商城应用使用 saas token；edu 应用未登录时统一跳转 `/portal/login`，不会跳转到商城。

### 2026-07-15 部署与运维审查

- 审计文档：`docs/audits/backend/deploy.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：7 / 总检查点数量：7
- 备注：
  - `ecosystem.config.js` 已更新为管理 `zhiyu-backend`、`zhiyu-marketplace`、`zhiyu-edu` 三个进程。
  - `deploy.sh` 已支持构建并部署两个前端，回滚逻辑已恢复两个 standalone 产物与后端二进制。

### 2026-07-15 各平台后端审计基线

- 审计文档：
  - `docs/audits/backend/auth-security.md`
  - `docs/audits/backend/data-infra.md`
  - `docs/audits/backend/evaluation-platform.md`
  - `docs/audits/backend/job-platform.md`
  - `docs/audits/backend/lesson-platform.md`
  - `docs/audits/backend/operations-platform.md`
  - `docs/audits/backend/portal-workspace.md`
  - `docs/audits/backend/scene-platform.md`
  - `docs/audits/backend/workflow-approval.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - 完成认证授权、数据基础设施、评价/考核、岗位/职业、课程/教学、运营与商城、Portal 工作台、场景/实践、审批流引擎九大后端平台模块的审查基线。
  - 各文档均列出核心决策、可验证检查点及已知风险与约束。

### 2026-07-15 共享包与 API 客户端审计基线

- 审计文档：
  - `docs/audits/frontend/api-client.md`
  - `docs/audits/frontend/edu-app.md`
  - `docs/audits/frontend/shared-packages.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - 完成 API 客户端层、教育管理应用、共享包的审查基线。
  - 确认双 token 管理、工厂模式、状态机共享类型、PlatformShell、菜单权限、AI 组件等已覆盖。
