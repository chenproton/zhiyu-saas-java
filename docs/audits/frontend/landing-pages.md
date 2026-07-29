# 学生端落地页审计

## 核心决策

- **落地页定位**：`/scene/landing`、`/job/student`、`/evaluation/landing`、`/lesson/landing`、`/library/landing` 五个子路径构成学生端对外展示的静态门户。页面名"landing"指向它们为学生浏览场景/岗位/测评/课程/资源库的公开入口页，但实际实现并非真正公开。
- **认证要求**：所有落地页调用标准认证 API（`scenarioApi`、`courseApi`、`questionBankApi`、`positionApi`、`resourceLibraryApi` 等），均经过 `requestWithPlatform` → Bearer token 附加 → 401 跳转登录。学生访问这些页面时若未登录会跳转 `/portal/login`，因此落地页实际上不是无认证公开页。
- **后端公开路由**：仅 `/evaluation/landing/exams` 和 `/evaluation/landing/certifications/{id}/grades` 两条后端路由无需 auth 中间件（`router.go` 中直接挂载在 `/api/v1` 下，不经过 `auth` 中间件组）。`/job/public/positions` 需 `jobViewer` 角色（teacher/student/school_admin/enterprise_mentor/platform_admin），不公开给匿名用户。
- **前端路由结构**：
  - `apps/edu/app/scene/landing/page.tsx`：复用 `JobHome` 组件，以 `mode="scene"` 区分岗位/场景视图。
  - `apps/edu/app/scene/landing/[id]/page.tsx`：场景详情页，展示任务概览/资源中心/能力模型/评价标准/知识图谱 5 个 tab，调用 `scenarioApi.get`、`taskApi.list`、`knowledgeApi.list`、`abilityApi.list`。
  - `apps/edu/app/scene/landing/[id]/learn/page.tsx`：学习页，包含场景任务列表侧栏、评价方法面板、资源预览、材料上传。引入 `useAuth()` 获取当前用户 ID 用于查询评价结果。
  - `apps/edu/app/job/student/page.tsx`：复用 `JobHome` 组件，岗位列表视图。
  - `apps/edu/app/job/student/[id]/page.tsx`：岗位详情页，展示 7 个 tab（概况/职责/证书/能力模型/胜任标准/知识图谱/实践场景），调用 `positionApi.get`、`scenarioApi.list`、`taskApi.list` 等。
  - `apps/edu/app/evaluation/landing/page.tsx`：测评资源平台，展示题库列表和试卷列表，使用 `LandingFilterRow`、`LandingPagination` 共享组件。
  - `apps/edu/app/evaluation/landing/exams/page.tsx`：公开考试列表页，展示所有已发布考试场次。
  - `apps/edu/app/evaluation/landing/exams/[id]/page.tsx`：考试答题页，承载题库/试卷/随堂测的答题与提交。
  - `apps/edu/app/evaluation/landing/banks/[id]/page.tsx`：题库详情公开展示页。
  - `apps/edu/app/lesson/landing/page.tsx`：课程教学平台，展示体系课和颗粒课列表，使用 `LandingFilterRow`、`LandingPagination` 共享组件。
  - `apps/edu/app/lesson/landing/[id]/page.tsx`：课程详情展示页。
  - `apps/edu/app/library/landing/page.tsx`：教学资产共享中心，展示教学资源库，含类型/时间/组织/专业多维度筛选。
- **共享组件复用**：`LandingFilterRow`（筛选条件行）、`LandingPagination`（分页控制）、`PlatformFooter`（统一页脚）、`JobHome`（岗位/场景列表共用）、`PositionHeader`/`StatsBox`/`OverviewTab` 等岗位详情子组件。

## 检查点

| 检查点 | 结论 | 说明 |
|---|---|---|
| 公开访问性 | FAIL | 所有落地页调用认证 API，未登录用户被 401 拦截跳转登录。仅 `/evaluation/landing` 有对应的后端公开路由但前端未使用 `landingApi`。 |
| API 端点选择 | PARTIAL | 测评落地页调用 `questionBankApi.list`/`examApi.list` 而非 `landingApi.listExams`。`landingApi` 对应 `GET /evaluation/landing/exams` 无需认证，但前端未使用。 |
| 数据隔离 | PASS | 所有认证 API 通过 tenant_id 隔离，学生只能看到本租户已发布内容。 |
| 数据泄漏 | PASS | 未暴露审批记录、草稿、用户数据等管理侧信息；仅查询 `status: "published"` 过滤。 |
| 错误状态处理 | PARTIAL | `scene/landing/[id]`、`job/student/[id]` 有 `.catch(() => setXxx(null))` 静默处理，无用户可感知的错误提示。`evaluation/landing`、`lesson/landing`、`library/landing` 通过 `.catch(() => setXxx([]))` 空列表兜底。 |
| 加载状态处理 | PARTIAL | `scene/landing/[id]` 和 `job/student/[id]` 有 `loading` state + `<Skeleton>` 骨架屏。`evaluation/landing`、`lesson/landing`、`library/landing` 有 `loading` 但无限骨架 UI，仅通过状态变量控制但未渲染可见的加载指示器。 |
| 空状态处理 | PASS | 空列表自然展示为无卡片/无数据状态，不报错。 |
| 共享组件使用 | PASS | `LandingFilterRow`、`LandingPagination`、`PlatformFooter`、`JobHome` 在各页面间正确复用。 |
| 就近放置 | PASS | `job/student/` 子组件（`position-header`、`overview-tab`、`duty-table` 等）放置在 `components/job/student/` 下，遵循就近放置原则。 |

## 风险与约束

- **落地页需登录使用**：当前所有落地页依赖认证 token，匿名用户直接访问会被重定向到登录页。若业务需要真正公开的预览页（如分享链接给外部访客），需改造前端使用 `landingApi` 或新增公开后端路由，并移除 `useAuth` 依赖。—— **业务约束，非安全风险。**
- **`evaluation/landing` 未对接公开 API**：后端已提供 `GET /evaluation/landing/exams`（无认证），但前端 `evaluation/landing/page.tsx` 仍使用 `questionBankApi.list`/`examApi.list`（需认证），未使用 `landingApi.listExams`。两端不一致导致公开 API 实际未被前端使用。—— **低危，业务暂未要求匿名访问，但造成了无用代码。**
- **页面级 loading 无 UI 反馈**：`evaluation/landing`、`lesson/landing`、`library/landing` 设置了 `loading` state 但未渲染对应的骨架屏或加载动画，用户在数据加载期间看到空白页。—— **低危，影响首次访问体验。**
