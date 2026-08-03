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

### 2026-08-03 审计文档同步：对齐代码现状与审查口径校准

- 审计文档：
  - 更新：`docs/audits/backend/handler-infra.md`
  - 更新：`docs/audits/backend/migrations.md`
  - 更新：`docs/audits/backend/deploy.md`
  - 更新：`docs/audits/backend/portal-workspace.md`
  - 更新：`docs/audits/backend/middleware.md`
  - 更新：`docs/audits/backend/performance-maintainability.md`
  - 更新：`docs/audits/frontend/shared-components.md`
  - 更新：`docs/audits/frontend/landing-pages.md`
  - 索引：`docs/audits/AUDIT_RECORDS.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - **修复过时结论**：`handler-infra.md` BatchHandler 写操作租户校验由 🔴 FAIL 改为 ✅ PASS（`checkTenantAccess` 已覆盖 Update/Delete/UpdateStatus）；`portal-workspace.md` 更新工作台缓存（30s + 索引 118）现状；`middleware.md` 更新操作日志异步缓冲现状；`shared-components.md` 更新 ConfirmDialog pending 态已实现。
  - **统计对齐**：`migrations.md` 迁移总数 4 → 118 对（092~118 增量）；`deploy.md` 四容器 → 五容器（+ kkfileview）。
  - **审查口径校准（按项目原则）**：`performance-maintainability.md` 标注商城相关建议（状态机收敛/订单事务）随源码移除归档；统一导入导出建议与 import/export 豁免冻结区冲突，标注"不执行"；岗位 SaveFull 大事务按"简单优先"标注"保持现状"；优先级表补充状态列。
  - **口径优化**：`landing-pages.md` "公开访问性"由 FAIL 改为"业务约束"（匿名公开面改造与"容忍 hacker/简单优先"原则冲突，不作为缺陷追踪）。

### 2026-07-29 全量审计文档同步：对齐最新代码状态

- 审计文档：
  - 重写：`docs/audits/backend/migrations.md`
  - 更新：`docs/audits/backend/deploy.md`
  - 更新：`docs/audits/backend/evaluation-platform.md`
  - 更新：`docs/audits/backend/lesson-platform.md`
  - 更新：`docs/audits/backend/scene-platform.md`
  - 更新：`docs/audits/backend/data-infra.md`
  - 更新：`docs/audits/frontend/marketplace-app.md`
  - 更新：`docs/audits/frontend/platform-shell.md`
  - 更新：`docs/audits/frontend/infra.md`
  - 更新：`docs/audits/frontend/edu-app.md`
  - 更新：`docs/audits/frontend/landing-pages.md`
  - 更新：`docs/audits/frontend/shared-components.md`
  - 索引：`docs/audits/AUDIT_RECORDS.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - **迁移合并基准线**：001-090 已合并为单个 `001_baseline.up.sql`（2184 行，109 张表），仅保留 091 作为增量迁移。重写 `migrations.md` 反映新结构。
  - **部署切换 Docker Compose**：`deploy.md` 全文从 PM2 切换为 Docker Compose 四容器部署（backend/postgres/redis/frontend）；修正 IMAGE_TAG 来源（git commit hash）、健康检查范围（backend+frontend）、环境变量列表（BACKEND_PORT/DB_USER 等）、补充 Nginx 重载逻辑。
  - **商城源码已移除**：`marketplace-app.md` 标记为已废弃；`platform-shell.md` 与 `infra.md` 移除 marketplace 引用，更新为单应用结构。
  - **补充缺失审计覆盖**：`edu-app.md` 新增教学资源库（/library）第 7 子平台、评测组件库（11 个）、知识图谱组件（4 个）；`landing-pages.md` 补充 lesson/landing/[id]、evaluation/landing/exams、evaluation/landing/banks/[id] 三个缺失页面。
  - **补充缺失 handler 覆盖**：`evaluation-platform.md` 补充 `CertificationModelHandler`（证书权重）与 `JobAbilityResultHandler`/`CertGradeHandler` 完善；`lesson-platform.md` 补充 `CourseResourceHandler`；`scene-platform.md` 完善 `ScenarioGradeHandler`；`data-infra.md` 补充 `TemplateHandler` 审计。
  - **handler 覆盖验证**：97 个 handler 文件（不含测试）中 96 个已覆盖，仅导出基础设施文件 `import_common.go` 未独立命名（其类型在 `handler-infra.md` 中审计）。
  - 同步更新 `AGENTS.md`（pm2→docker compose、`pnpm exec tsc --noEmit`→`pnpm typecheck`）、`docs/components.md`（组件路径修正至 `apps/edu/components/shared/`）。

### 2026-07-27 审查文档同步：代码安全修复后的审计状态更新

- 审计文档：
  - 更新：`docs/audits/backend/auth-security.md`
  - 更新：`docs/audits/backend/tenant-org.md`
  - 更新：`docs/audits/backend/evaluation-platform.md`
  - 索引：`docs/audits/AUDIT_RECORDS.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - `auth-security.md`：超管控制台路由现已受 `auth` + `platformAdmin` 保护，更新检查点说明和风险状态为"已修复"。
  - `tenant-org.md`：`users.plain_password` 列已通过 migration 085 删除；`AdminPreviewPassword` 已改为 `AdminResetPassword`，更新核心决策、检查点和风险状态。
  - `evaluation-platform.md`：修正申诉 remark 审计错误——remark 字段被解析但从未写入 SQL UPDATE，并非"已持久化但未返回"。

### 2026-07-26 性能与可维护性最佳实践文档

- 审计文档：
  - 新增：`docs/audits/backend/performance-maintainability.md`
  - 索引：`docs/audits/AUDIT_RECORDS.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - 汇总当前审计中发现的性能与可维护性优化项。
  - 提出 Portal 工作台聚合查询优化、统一导入导出格式、内容状态机收敛、大事务拆分、业务规则配置化、审计日志治理、领域服务层拆分等最佳实践方案。
  - 按 P0-P3 给出优先级建议，范围不涉及安全改造。

### 2026-07-26 审查文档覆盖补全与风险等级校准

- 审计文档：
  - 更新：`docs/audits/backend/evaluation-platform.md`
  - 更新：`docs/audits/backend/lesson-platform.md`
  - 更新：`docs/audits/backend/tenant-org.md`
  - 更新：`docs/audits/backend/auth-security.md`
  - 更新：`docs/audits/backend/data-infra.md`
  - 更新：`docs/audits/backend/operations-platform.md`
  - 索引：`docs/audits/AUDIT_RECORDS.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - 补充 `RandomDrawQuestionHandler` 现场问答题池覆盖。
  - 补充题库/试卷/题目/课程/颗粒课/基础数据的 Excel 导入、导出与模板下载覆盖。
  - 补充超管控制台租户订阅管理子路由覆盖。
  - 补充 `auth/debug/token` 开发调试接口说明。
  - 调整 `data-infra.md` 文件上传无内容校验风险等级为低危，避免与“简单优先”目标冲突。
  - 调整 `auth-security.md`、`tenant-org.md`、`operations-platform.md` 中路由权限分层、超管控制台、机构创建等检查点说明，与已列风险保持一致。

### 2026-07-26 文件上传扩展名限制移除

- 审计文档：
  - 更新：`docs/audits/backend/data-infra.md`
  - 索引：`docs/audits/AUDIT_RECORDS.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - 业务要求任务资源/资源库等模块的“其他资源”支持任意格式上传，已移除 `backend/internal/handler/file_handler.go` 中的扩展名白名单。
  - 保留 100MB 大小限制、UUID 文件名、路径穿越防护。
  - 更新审计文档，明确文件上传不再限制扩展名，未来不得擅自恢复白名单。
  - 本地验证通过：`go vet ./...`、`go test ./...`。
  - 部署验证通过：`./deploy.sh --branch feat/agent-remove-upload-ext-whitelist` 成功完成后端构建、健康检查与 master 合并。

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

### 2026-07-28 中间件层、学生端落地页、数据库迁移审计基线

- 审计文档：
  - 新增：`docs/audits/backend/middleware.md`
  - 新增：`docs/audits/frontend/landing-pages.md`
  - 新增：`docs/audits/backend/migrations.md`
  - 更新：`docs/audits/backend/portal-workspace.md`
  - 索引：`docs/audits/AUDIT_RECORDS.md`
- 审查人：Agent
- 结论：收敛
- PASS 检查点数量：— / 总检查点数量：—
- 备注：
  - `middleware.md`：审查操作日志中间件（路径排除、数据捕获、敏感信息泄漏风险）、RBAC 中间件（RequireRole/RequirePermission/SystemPermission 逻辑正确性）、平台隔离中间件（RequirePlatform 强制校验）。发现操作日志 `detail` 字段含完整 query string 可能泄漏敏感参数、管理员权限 `admin: true` 绕过所有细粒度检查等风险项。
  - `landing-pages.md`：审查 `/scene/landing`、`/job/student`、`/evaluation/landing`、`/lesson/landing`、`/library/landing` 8 个学生端落地页。发现所有落地页实际调用认证 API 而非真正的公开端点，`evaluation/landing` 未使用后端提供的 `landingApi` 公开接口，部分页面缺少 loading UI 反馈。
  - `migrations.md`：审查 001-088 共 90 个迁移文件的配对完整性、命名规范、CASCADE 覆盖率、破坏性操作和回滚安全。确认 100% `.up.sql`/`.down.sql` 配对，发现 8 处 DROP COLUMN 和 4 处 DROP TABLE 为不可逆数据删除，迁移 038 大范围 `ALTER TABLE` 无锁超时保护。
  - `portal-workspace.md`：新增"性能约束"节，交叉引用 `performance-maintainability.md#一` 关于 10+ 次 DB 查询的优化建议。

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
