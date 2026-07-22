# 知育 SaaS 真实可用化改造进度

## 状态
改造代码已全部完成，本地验证通过，等待部署验证确认。

## 已完成的代码修改

### 1. 后端权限基础
- [x] `backend/internal/middleware/auth.go`
  - Claims 新增 `IdentityTypeCode` 和 `Permissions` 字段
  - `GenerateToken` 签名改为接收 `middleware.TokenInput` 结构体
- [x] `backend/internal/middleware/rbac.go`（新增）
  - `RequireIdentityType` 中间件
  - `RequirePermission` 中间件
  - `IsPlatformAdmin`、`IsSchoolAdmin` 辅助函数
- [x] `backend/internal/handler/auth_handler.go`
  - 登录成功后查询 identity_type.code 和合并后的 roles.permissions
  - 调用新的 `GenerateToken` 接口
  - 新增 `fetchIdentityTypeCode` 和 `fetchMergedPermissions` 方法
- [x] `backend/internal/router/router.go`
  - 按身份类型拆分为：公共认证、platformAdmin、portalWorkspace、businessUser、schoolAdmin 五个路由分组
- [x] `backend/internal/handler/testhelper/setup.go` / `backend/internal/middleware/auth_test.go`
  - 更新 `GenerateToken` 调用以匹配新签名

### 2. Handler 鉴权改造与租户隔离
- [x] `backend/internal/handler/common.go`
  - 新增 `platformAdminOnly`、`schoolAdminOnly`、`canModifyContent`、`tenantFilter`、`institutionFilter` 等辅助函数
- [x] 20+ 个 handler 写权限判断从 `claims.Role == domain.UserRoleOperator` 改为基于 `IdentityTypeCode`
- [x] 45+ 个 list handler 增加 `tenant_id`/`institution_id` 过滤
- [x] 更新相关测试文件使用对应身份的 token

### 3. Mock 清理与 API 对接
- [x] **Portal 工作台**
  - `backend/internal/domain/portal.go`：扩展 `WorkspaceDashboard`，新增学生/教师工作区字段
  - `backend/internal/handler/portal_handler.go`：优先使用 `IdentityTypeCode` 判定身份，所有查询带 `tenant_id` 过滤
  - `lib/types/portal.ts`：补齐类型
  - `app/portal/workspace/_components/learning-tab.tsx`、`assessment-tab.tsx`、`teacher-courses-tab.tsx`、`teacher-dashboard-tab.tsx`、`hybrid-grading-dialog.tsx`：移除 mock 引用，改为 dashboard API
  - `app/portal/workspace/_data/mock-student-data.ts`、`mock-teacher-data.ts`：删除被引用的 mock 数据导出
- [x] **Lesson 学习画像**
  - `app/lesson/teacher/learning-portrait/page.tsx`：改为调用 `portraitApi.list()`
  - 删除 `components/providers/lesson-data-provider.tsx`
- [x] **Evaluation data-provider**
  - `components/providers/data-provider.tsx`：`sceneTasks`、`jobAbilityResults`、`archiveVersions` 改为真实 API
  - 移除无后端支撑的 `sceneGradingStudents/Scenarios/Submissions`、`onlineClassrooms`、`smartCourses` 状态
- [x] **死代码删除**
  - 删除 `lib/scene-archive-mock.ts`
  - 删除 `lib/hybrid-archive-mock.ts`
  - 保留 `lib/types/scene-mock.ts`（仅类型定义）

### 4. 前端权限对齐
- [x] `components/auth-provider.tsx`：新增 `identityTypeCode` 导出，`hasPermission` 与后端行为一致
- [x] `contexts/portal-auth-context.tsx`：同步更新
- [x] Layout 路由守卫统一：
  - `app/admin/layout.tsx`：仅 `platform_admin`
  - `app/portal/layout.tsx`：`teacher`/`student`/`school_admin`
  - `app/job/layout.tsx`、`app/scene/layout.tsx`、`app/evaluation/layout.tsx`：业务用户
  - `app/lesson/layout.tsx`、`app/lesson/admin/layout.tsx`：教师/学校管理员
- [x] 代表性页面敏感按钮增加 `hasPermission` 条件渲染

## 本地验证结果

```bash
# 后端
cd /root/projects/zhiyu-saas/backend
go vet ./...        # passed
go test ./...       # passed
go build ./cmd/server/main.go  # passed

# 前端
cd /root/projects/zhiyu-saas
pnpm exec tsc --noEmit  # passed
pnpm test               # 60 tests passed
```

## 提交与部署记录

已完成以下 5 个独立提交并推送至 master：

1. `feat(auth): 后端权限基础改造`
2. `feat(rbac): handler 鉴权改造与租户隔离`
3. `feat(portal): 工作台真实数据化`
4. `feat(data): Lesson 画像与 Evaluation 数据真实化`
5. `feat(frontend): 前端权限与后端模型对齐`

部署结果：
- `./deploy.sh` 执行成功
- 数据库备份：`backups/zhiyu-saas-backup-20260715-211734.dump`
- 回滚快照：`.rollback/20260715-211540`
- PM2 进程 `zhiyu-backend` 和 `saas` 已启动
- 后端健康检查：`http://127.0.0.1:8080/health` ✅
- 前端健康检查：`http://127.0.0.1:3010/login` ✅

## 状态
**改造完成，代码已提交并部署。**

## 2026-07-15 后续拆分：资源共享商城 vs 教育管理后台

- 已将前端拆分为两个独立应用：
  - `apps/marketplace`：商城首页、资源、订单、钱包、运营后台 `/admin/*`，端口 `3010`。
  - `apps/edu`：Portal、Job、Scene、Lesson、Evaluation，端口 `3020`。
- 建立共享 packages：`@zhiyu/ui`、`@zhiyu/api-client`、`@zhiyu/shared-types`。
- 后端保持单服务 `8080`，通过 JWT `platform` 区分 `saas`/`portal`。
- `ecosystem.config.js` 与 `deploy.sh` 已更新为启动并部署三个进程。
- 部署验证：商城 `/login`、教育管理 `/portal/login`、后端 `/health` 均通过。

## 注意事项
- 所有修改已通过 `deploy.sh` 完成部署验证
- 修改 `AGENTS.md` 或 `docs/audits/*.md` 必须独立 commit
- `.rollback/`、`backend/main`、`logs/`、`tsconfig.tsbuildinfo` 等属于构建/运行产物，不应提交
