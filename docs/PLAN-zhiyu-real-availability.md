# 知育 SaaS 系统真实可用化改造计划

## 目标

消除系统中所有面向用户的 mock/假数据，补齐前后端 API 对接断层，落地基于身份类型 + 租户的角色权限模型，使系统在生产环境中可以真实使用。

## 现状问题

### 1. Mock/假数据残留

| 位置 | 现状 | 影响 |
|---|---|---|
| `app/portal/workspace/_data/mock-teacher-data.ts` | 已清空为空数组，但教师工作台组件仍在引用 | 教师工作台的"授课计划、课堂会话、学生画像"等显示为空 |
| `app/portal/workspace/_data/mock-student-data.ts` | 已清空为空数组，但学生工作台组件仍在引用 | 学生工作台的"我的课程、考试、学习路径"等显示为空 |
| `components/providers/lesson-data-provider.tsx` | 包含 10 条硬编码学生能力画像，无 API 调用 | `app/lesson/teacher/learning-portrait/page.tsx` 展示假数据 |
| `components/providers/data-provider.tsx` | 部分状态为空数组，标注"暂无后端支撑" | 场景任务评价、在线课堂评价、智慧课程评价等功能无数据 |
| `lib/scene-archive-mock.ts`、`lib/hybrid-archive-mock.ts` | 无任何组件引用 | 死代码 |

### 2. 前后端 API 对接不完整

- **Portal 工作台**：仅 `portalApi.workspaceDashboard()` 真实调用后端，课程/场景/考试列表仍依赖空 mock。
- **Lesson 学习画像**：完全使用本地 mock provider，未对接 `portraitApi`。
- **Evaluation 展示型功能**：`data-provider` 中 `sceneTasks`、`onlineClassrooms`、`smartCourses`、`archiveVersions`、`jobAbilityResults` 等状态未调用后端。

### 3. 用户体系与权限模型未落地

- 后端 `users.role` 只有 `school/enterprise/operator` 三档，无法区分 `teacher/student/school_admin`。
- `identity_types.code` 已包含 `platform_admin/school_admin/teacher/student/enterprise_hr/enterprise_mentor`，但后端未用它做鉴权。
- `roles` 表 + `user_roles` 表已存在，后端没有任何 handler 读取 `roles.permissions` 做权限校验。
- 前端 `AuthProvider.hasPermission` 已读取权限，但后端不校验，可被绕过。
- 多数 list 查询未按 `tenant_id` 过滤，存在跨租户数据越权风险。

## 改造范围

### 包含
1. 移除/替换所有面向用户的 mock 数据。
2. 补齐 Portal 工作台、Lesson 学习画像、Evaluation 空状态的后端 API。
3. 后端实现基于 `identity_type` + `roles` 的细粒度权限中间件。
4. 后端 list 查询统一增加 `tenant_id`（及必要时的 `org_node_id`）过滤。
5. 前端路由守卫、按钮权限与后端权限模型对齐。
6. 本地验证（tsc、lint、go test、deploy.sh）。

### 不包含
1. 新增大模块业务功能（如 AI 评分算法、实时课堂等）。
2. 大规模重构 `handler` 到 `service/repository` 分层。
3. 修改原有商城核心交易逻辑。

## 实施步骤

### 阶段一：Mock 数据清理与 API 对接

#### 1.1 Portal 工作台真实数据化

**后端**：
- 扩展 `backend/internal/handler/portal_handler.go`：
  - `WorkspaceDashboard` 的 `role` 优先取 `identity_types.code`（`teacher/student/school_admin`），而非 `users.role`。
  - 新增接口或扩展 dashboard 返回：当前用户的在修课程列表、待考考试列表、实践场景任务列表。
  - 所有查询必须带 `tenant_id` 过滤。

**前端**：
- `app/portal/workspace/_components/learning-tab.tsx`：
  - 移除 `mockCourses`、`mockSceneTasks` 引用。
  - 调用新的 dashboard API 或独立 API 获取学生课程/场景任务。
- `app/portal/workspace/_components/assessment-tab.tsx`：
  - 移除 `mockExams`。
  - 对接考试/测评结果 API。
- `app/portal/workspace/_components/teacher-courses-tab.tsx`、`teacher-dashboard-tab.tsx`、`hybrid-grading-dialog.tsx`：
  - 移除 `mockClassPlans`、`mockClassSessions` 引用。
  - 对接教师授课计划/课堂会话 API（如现有 `courseApi`、`lessonBehaviorApi`）。
- `app/portal/workspace/_data/mock-teacher-data.ts`、`mock-student-data.ts`：
  - 删除或仅保留 TypeScript 类型定义，数据清空后若不再使用则删除文件。

#### 1.2 Lesson 学习画像真实数据化

- 删除 `components/providers/lesson-data-provider.tsx` 中的 `mockStudentAbilityPortraits`。
- 改为通过 `portraitApi.list()` 获取真实数据。
- `app/lesson/teacher/learning-portrait/page.tsx` 移除 `<DataProvider>` 包裹，直接调用 API。
- 删除 `components/providers/lesson-data-provider.tsx`（如无其他用途）。

#### 1.3 Evaluation data-provider 空状态补齐

针对 `components/providers/data-provider.tsx` 中标注"暂无后端支撑"的状态：

| 状态 | 处理方案 |
|---|---|
| `sceneTasks` | 对接 `/scene/tasks` 或 `/evaluation/results` |
| `jobAbilityResults` | 对接 `/evaluation/results?methodKey=...` 或新增 `/evaluation/job-ability/results` |
| `sceneGradingStudents/Scenarios/Submissions` | 对接 `/evaluation/results` 或新增评分工作台专用接口 |
| `onlineClassrooms` | 若业务暂未上线，前端隐藏对应入口，后端不新增接口 |
| `smartCourses` | 若业务暂未上线，前端隐藏对应入口，后端不新增接口 |
| `archiveVersions` | 对接 `/evaluation/portraits/archives` |

原则：能对接现有 API 的优先对接；确实没有业务支撑的，前端移除对应展示入口，不再保留空状态占位。

#### 1.4 删除死代码

- 删除 `lib/scene-archive-mock.ts`。
- 删除 `lib/hybrid-archive-mock.ts`。
- 保留 `lib/types/scene-mock.ts` 中的组件本地类型（仅类型，非数据）。

### 阶段二：后端权限模型落地

#### 2.1 扩展 JWT Claims

- 在 `backend/internal/middleware/auth.go` 的 `Claims` 中新增：
  - `IdentityTypeCode string`
  - `Permissions domain.JSONMap`（合并该用户所有 `roles` 的 `permissions`）
- 在 `backend/internal/handler/auth_handler.go` 的 `GenerateToken` 阶段：
  - 查询 `identity_types.code`。
  - 查询 `user_roles` + `roles.permissions`，合并后写入 Claims。

#### 2.2 新增权限中间件

在 `backend/internal/middleware` 下新增 `rbac.go`：

- `RequireIdentityType(codes ...string)`：要求特定身份类型（如仅 `school_admin` 可访问系统管理）。
- `RequirePermission(module, page, action string)`：基于 `roles.permissions` 校验。
- `RequireTenantAccess()`：确保 list 查询只能访问本租户数据（在 handler 内部调用，不在中间件层）。

#### 2.3 Handler 鉴权改造

按模块逐步替换 `claims.Role == domain.UserRoleOperator` 硬编码：

| 模块 | 鉴权策略 |
|---|---|
| `/admin/*` 对应接口 | 仅 `platform_admin` |
| `/portal/apps/system/*` 对应接口 | 仅 `school_admin` |
| `/portal/workspace/*` 对应接口 | `teacher` / `student` |
| `/job/*` | 学校/企业用户可读写，operator 可读 |
| `/scene/*` | 学校/企业用户可读写，operator 可读 |
| `/lesson/*` | 学校用户可读写，operator 可读 |
| `/evaluation/*` | 学校/企业用户可读写，operator 可读 |
| `/orders`、`/withdrawals` | 保留现有基于 `institution_id` 的鉴权 |

#### 2.4 租户隔离

- 在所有 `List` 类 handler 的 SQL 中强制加入 `tenant_id = $claims.TenantID`。
- 例外：operator 可跨租户读取（但写入仍受权限控制）。
- 对 `org_node_id` 敏感的查询（如教师只能看自己班级的学生）增加 `org_node_id` 过滤。

### 阶段三：前端权限对齐

- `components/auth-provider.tsx`：
  - `hasPermission` 继续基于后端返回的 `permissions` 计算。
  - 新增 `identityTypeCode` 导出。
- `app/admin/layout.tsx`、`app/portal/layout.tsx`、`app/job/layout.tsx`、`app/scene/layout.tsx`、`app/lesson/layout.tsx`、`app/evaluation/layout.tsx`：
  - 统一使用 `identityTypeCode` 或 `hasPermission` 做路由守卫，与后端中间件策略一致。
- 各页面敏感操作按钮（删除、审核、发布等）增加 `hasPermission` 条件渲染。

### 阶段四：验证与部署

1. **前端检查**：
   - `pnpm exec tsc --noEmit`
   - `pnpm lint`
   - `pnpm test`
2. **后端检查**：
   - `go vet ./...`
   - `go test ./...`
   - `go build ./cmd/server/main.go`
3. **数据库检查**：
   - 确认无破坏性变更；若新增 migration，必须配 `.down.sql`。
4. **部署验证**：
   - 按 AGENTS.md 执行 `./deploy.sh`（前后端均变更）。
   - 验证登录、工作台数据、课程/场景/考试列表、权限控制。

## 关键文件清单

### 后端
- `backend/internal/middleware/auth.go`
- `backend/internal/middleware/rbac.go`（新增）
- `backend/internal/handler/auth_handler.go`
- `backend/internal/handler/portal_handler.go`
- `backend/internal/handler/*_handler.go`（多数需要增加租户过滤和鉴权）
- `backend/internal/router/router.go`

### 前端
- `app/portal/workspace/_components/*.tsx`
- `app/portal/workspace/_data/mock-*.ts`
- `app/lesson/teacher/learning-portrait/page.tsx`
- `components/providers/lesson-data-provider.tsx`
- `components/providers/data-provider.tsx`
- `components/auth-provider.tsx`
- `app/admin/layout.tsx`、`app/portal/layout.tsx` 等 layout
- `lib/scene-archive-mock.ts`、`lib/hybrid-archive-mock.ts`

## 验证标准

1. 教师/学生工作台能看到真实的课程、场景任务、考试、待办。
2. `app/lesson/teacher/learning-portrait/page.tsx` 展示数据库中的学生画像。
3. 所有页面无硬编码假数据（类型定义和未使用文件除外）。
4. 后端 list 接口按租户隔离，非 operator 用户无法查看其他租户数据。
5. `school_admin` 可访问 `/portal/apps/system/*`，`teacher/student` 只能访问 `/portal/workspace/*`。
6. `platform_admin` 才能访问 `/admin/*`。
7. `go test ./...`、`pnpm exec tsc --noEmit`、`pnpm lint` 全部通过。
8. `./deploy.sh` 部署成功，健康检查通过。

## 风险与回滚

- **风险 1**：权限改造可能导致原有测试 token 失效，需要同步更新测试辅助函数 `testhelper/setup.go`。
- **风险 2**：租户隔离加得过严可能影响 operator 的跨租户管理视图，需要保留 operator 白名单。
- **风险 3**：Portal 工作台新增接口涉及多表联查，需关注性能。
- **回滚**：按 AGENTS.md，使用 `deploy.sh` 部署前会自动生成 `.rollback/<timestamp>` 快照；生产回滚切换到上一个 commit 后重新部署。

## 提交策略

按 AGENTS.md 要求：

1. **独立文档提交**：先提交一份 `docs/audits/AUDIT_RECORDS.md` 更新（记录本次改造的检查点）。
2. **阶段一提交**：Mock 清理 + API 对接。
3. **阶段二提交**：后端权限模型（含 middleware、auth handler、router 调整）。
4. **阶段三提交**：前端权限对齐 + layout 调整。
5. **阶段四提交**：验证修复 + deploy.sh 成功后的最终提交。

每次提交只包含与该阶段直接相关的变更。
