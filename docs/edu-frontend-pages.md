# apps/edu 前端页面清单

> 本清单梳理 `apps/edu` 目录下全部 Next.js App Router 页面（`page.tsx` 源文件），按业务模块分组。不含 `apps/marketplace`、不含 `app/api/*` 接口路由、不含 `.next/` 构建产物。
> 统计时间：2026-07-26

## 目录

- [总览](#总览)
- [Dashboard](#dashboard)
- [测评中心 Evaluation](#测评中心-evaluation)
- [就业/岗位 Job](#就业岗位-job)
- [课程 Lesson](#课程-lesson)
- [资源库 Library](#资源库-library)
- [统一门户 Portal](#统一门户-portal)
- [场景化教学 Scene](#场景化教学-scene)
- [超级管理员 Superadmin](#超级管理员-superadmin)

---

## 总览

| 模块 | 页面数 | 入口/根路由 |
|------|--------|-------------|
| Dashboard | 1 | `/dashboard/marketplace` |
| Evaluation | 23 | `/evaluation/*` |
| Job | 13 | `/job/*` |
| Lesson | 11 | `/lesson/*` |
| Library | 6 | `/library/*` |
| Portal | 23 | `/portal/*` |
| Scene | 11 | `/scene/*` |
| Superadmin | 1 | `/superadmin` |
| **合计** | **89** | — |

---

## Dashboard

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/dashboard/marketplace` | `app/dashboard/marketplace/page.tsx` | `DashboardMarketplacePage` | 仪表盘中的应用市场入口 |

---

## 测评中心 Evaluation

### 后台管理

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/evaluation/approvals` | `app/evaluation/approvals/page.tsx` | `EvaluationApprovalsPage` | 测评审批管理 |
| `/evaluation/batches` | `app/evaluation/batches/page.tsx` | `BatchesPage` | 测评批次管理 |
| `/evaluation/exams` | `app/evaluation/exams/page.tsx` | `ExamsPage` | 考试/试卷列表 |
| `/evaluation/exams/[id]` | `app/evaluation/exams/[id]/page.tsx` | `ExamComposerPage` | 考试编辑/组卷 |
| `/evaluation/exam-usage` | `app/evaluation/exam-usage/page.tsx` | `ExamUsagePage` | 考试使用情况 |
| `/evaluation/exam-usage/results` | `app/evaluation/exam-usage/results/page.tsx` | `ExamResultsPage` | 考试结果明细 |
| `/evaluation/question-banks` | `app/evaluation/question-banks/page.tsx` | `QuestionBanksPage` | 题库列表 |
| `/evaluation/question-banks/[id]` | `app/evaluation/question-banks/[id]/page.tsx` | `QuestionBankDetailPage` | 题库详情 |
| `/evaluation/scene-results` | `app/evaluation/scene-results/page.tsx` | `GradingPage` | 场景成绩/评卷 |
| `/evaluation/scene-results/[id]` | `app/evaluation/scene-results/[id]/page.tsx` | `GradingDetailPage` | 评卷详情 |
| `/evaluation/workflows` | `app/evaluation/workflows/page.tsx` | `WorkflowsPage` | 测评工作流 |

### Landing / 门户端

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/evaluation/landing` | `app/evaluation/landing/page.tsx` | `LandingHomePage` | 测评门户首页 |
| `/evaluation/landing/certifications` | `app/evaluation/landing/certifications/page.tsx` | `CertificationsPage` | 证书列表 |
| `/evaluation/landing/certifications/[id]` | `app/evaluation/landing/certifications/[id]/page.tsx` | `CertificationDetailPage` | 证书详情 |
| `/evaluation/landing/evaluation-methods` | `app/evaluation/landing/evaluation-methods/page.tsx` | `EvaluationMethodsListPage` | 测评方式列表 |
| `/evaluation/landing/exams` | `app/evaluation/landing/exams/page.tsx` | `ExamListPage` | 门户考试列表 |
| `/evaluation/landing/exams/[id]` | `app/evaluation/landing/exams/[id]/page.tsx` | `ExamDetailPage` | 门户考试详情 |
| `/evaluation/landing/graduation` | `app/evaluation/landing/graduation/page.tsx` | `GraduationPage` | 毕业话题/认证 |
| `/evaluation/landing/graduation/[id]` | `app/evaluation/landing/graduation/[id]/page.tsx` | `GraduationTopicDetailPage` | 毕业话题详情 |
| `/evaluation/landing/portrait/major/[majorName]` | `app/evaluation/landing/portrait/major/[majorName]/page.tsx` | `MajorPortraitPage` | 专业画像 |
| `/evaluation/landing/resources` | `app/evaluation/landing/resources/page.tsx` | `ResourcesPage` | 资源中心 |
| `/evaluation/landing/resources/banks/[id]` | `app/evaluation/landing/resources/banks/[id]/page.tsx` | `QuestionBankDetailPage` | 资源-题库详情 |
| `/evaluation/landing/resources/exams/[id]` | `app/evaluation/landing/resources/exams/[id]/page.tsx` | `PaperDetailPage` | 资源-试卷详情 |

---

## 就业/岗位 Job

### 后台管理

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/job/approvals` | `app/job/approvals/page.tsx` | `JobApprovalsPage` | 岗位/就业审批 |
| `/job/archive` | `app/job/archive/page.tsx` | `PositionArchivePage` | 岗位归档 |
| `/job/banners` | `app/job/banners/page.tsx` | `BannerManagementPage` | Banner 管理 |
| `/job/batches` | `app/job/batches/page.tsx` | `BatchesPage` | 就业批次 |
| `/job/positions` | `app/job/positions/page.tsx` | `PositionsPage` | 岗位列表 |
| `/job/positions/[id]/edit` | `app/job/positions/[id]/edit/page.tsx` | `PositionEditPage` | 岗位编辑 |
| `/job/recommend` | `app/job/recommend/page.tsx` | `PostRecommendPage` | 岗位推荐 |
| `/job/workflows` | `app/job/workflows/page.tsx` | `WorkflowsPage` | 就业工作流 |

### 学生端 / Landing

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/job/landing` | `app/job/landing/page.tsx` | `JobLandingPage` | 就业门户首页 |
| `/job/learn-roads` | `app/job/learn-roads/page.tsx` | `LearnRoadsPage` | 学习路径 |
| `/job/student` | `app/job/student/page.tsx` | `JobStudentPage` | 学生就业首页 |
| `/job/student/[id]` | `app/job/student/[id]/page.tsx` | `JobStudentDetailPage` | 学生就业详情 |
| `/job/student/[id]/learn` | `app/job/student/[id]/learn/page.tsx` | `JobStudentLearnPage` | 学生学习页 |

---

## 课程 Lesson

### Admin 后台

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/lesson/admin/approvals` | `app/lesson/admin/approvals/page.tsx` | `CourseApprovalsPage` | 课程审批 |
| `/lesson/admin/archive` | `app/lesson/admin/archive/page.tsx` | `LessonArchivePage` | 课程归档 |
| `/lesson/admin/batches` | `app/lesson/admin/batches/page.tsx` | `BatchesPage` | 课程批次 |
| `/lesson/admin/granular` | `app/lesson/admin/granular/page.tsx` | `GranularCoursePage` | 颗粒化课程 |
| `/lesson/admin/granular/add` | `app/lesson/admin/granular/add/page.tsx` | `AddGranularPage` | 新增颗粒化课程 |
| `/lesson/admin/hybrid` | `app/lesson/admin/hybrid/page.tsx` | `HybridCoursePage` | 混合式课程 |
| `/lesson/admin/hybrid/add` | `app/lesson/admin/hybrid/add/page.tsx` | `HybridCourseAddPage` | 新增混合式课程 |
| `/lesson/admin/system` | `app/lesson/admin/system/page.tsx` | `SystemCoursePage` | 体系课程 |
| `/lesson/admin/system/add` | `app/lesson/admin/system/add/page.tsx` | `AddSystemPage` | 新增体系课程 |
| `/lesson/admin/workflows` | `app/lesson/admin/workflows/page.tsx` | `WorkflowsPage` | 课程工作流 |

### Landing / 门户端

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/lesson/landing` | `app/lesson/landing/page.tsx` | `LessonLandingPage` | 课程门户首页 |

---

## 资源库 Library

### 后台管理

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/library/ability` | `app/library/ability/page.tsx` | `AbilityPointsPage` | 能力点管理 |
| `/library/certificates` | `app/library/certificates/page.tsx` | `CertificatesPage` | 证书管理 |
| `/library/knowledge` | `app/library/knowledge/page.tsx` | `KnowledgePointsPage` | 知识点管理 |
| `/library/questions` | `app/library/questions/page.tsx` | `OnSiteQuestionsPage` | 现场题/题库管理 |
| `/library/resources` | `app/library/resources/page.tsx` | `ResourcesPage` | 资源管理 |

### Landing / 门户端

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/library/landing` | `app/library/landing/page.tsx` | `LibraryLandingPage` | 资源库门户首页 |

---

## 统一门户 Portal

### 门户公共

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/portal` | `app/portal/page.tsx` | `PortalHomePage` | 门户首页 |
| `/portal/login` | `app/portal/login/page.tsx` | `PortalLoginPage` | 门户登录 |
| `/portal/workspace` | `app/portal/workspace/page.tsx` | `WorkspacePage` | 个人工作台 |
| `/portal/apps` | `app/portal/apps/page.tsx` | `AppsPage` | 应用中心 |

### 系统管理

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/portal/apps/system` | `app/portal/apps/system/page.tsx` | `SystemPage` | 系统管理首页 |
| `/portal/apps/system/tenant` | `app/portal/apps/system/tenant/page.tsx` | `TenantPage` | 租户管理 |

#### 组织与用户

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/portal/apps/system/org-user/accounts` | `app/portal/apps/system/org-user/accounts/page.tsx` | `AccountsPage` | 账号管理 |
| `/portal/apps/system/org-user/fields` | `app/portal/apps/system/org-user/fields/page.tsx` | `UserFieldsPage` | 用户字段 |
| `/portal/apps/system/org-user/graduates` | `app/portal/apps/system/org-user/graduates/page.tsx` | `GraduatesPage` | 毕业生管理 |
| `/portal/apps/system/org-user/org-structure` | `app/portal/apps/system/org-user/org-structure/page.tsx` | `OrgStructurePage` | 组织架构 |
| `/portal/apps/system/org-user/org-types` | `app/portal/apps/system/org-user/org-types/page.tsx` | `OrgTypesPage` | 组织类型 |
| `/portal/apps/system/org-user/positions` | `app/portal/apps/system/org-user/positions/page.tsx` | `PositionsPage` | 岗位管理 |
| `/portal/apps/system/org-user/relations` | `app/portal/apps/system/org-user/relations/page.tsx` | `RelationsPage` | 关系管理 |
| `/portal/apps/system/org-user/roles` | `app/portal/apps/system/org-user/roles/page.tsx` | `RolesPage` | 角色管理 |
| `/portal/apps/system/org-user/students` | `app/portal/apps/system/org-user/students/page.tsx` | `StudentsPage` | 学生管理 |
| `/portal/apps/system/org-user/teachers` | `app/portal/apps/system/org-user/teachers/page.tsx` | `TeachersPage` | 教师管理 |

#### 基础资源

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/portal/apps/system/resource/codes` | `app/portal/apps/system/resource/codes/page.tsx` | `ResourceCodesPage` | 资源编码 |
| `/portal/apps/system/resource/industries` | `app/portal/apps/system/resource/industries/page.tsx` | `IndustriesPage` | 行业管理 |
| `/portal/apps/system/resource/majors` | `app/portal/apps/system/resource/majors/page.tsx` | `MajorsPage` | 专业管理 |
| `/portal/apps/system/resource/package` | `app/portal/apps/system/resource/package/page.tsx` | `PackagePage` | 资源包管理 |

#### 日志

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/portal/apps/system/logs/login` | `app/portal/apps/system/logs/login/page.tsx` | `LoginLogsPage` | 登录日志 |
| `/portal/apps/system/logs/operation` | `app/portal/apps/system/logs/operation/page.tsx` | `OperationLogsPage` | 操作日志 |

### 配置

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/portal/config/links` | `app/portal/config/links/page.tsx` | `PlatformConfigPage` | 平台链接/配置 |

---

## 场景化教学 Scene

### 后台管理

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/scene` | `app/scene/page.tsx` | `SceneHallPage` | 场景大厅首页 |
| `/scene/approvals` | `app/scene/approvals/page.tsx` | `SceneApprovalsPage` | 场景审批 |
| `/scene/archive` | `app/scene/archive/page.tsx` | `SceneArchivePage` | 场景归档 |
| `/scene/batches` | `app/scene/batches/page.tsx` | `BatchesPage` | 场景批次 |
| `/scene/scenarios/[id]/edit` | `app/scene/scenarios/[id]/edit/page.tsx` | `ScenarioEditPage` | 场景编辑 |
| `/scene/scenarios/[id]/edit/tasks` | `app/scene/scenarios/[id]/edit/tasks/page.tsx` | `TasksEditPage` | 场景任务编辑 |
| `/scene/scenarios/new/edit` | `app/scene/scenarios/new/edit/page.tsx` | `NewScenarioEditPage` | 新建场景编辑 |
| `/scene/workflows` | `app/scene/workflows/page.tsx` | `WorkflowsPage` | 场景工作流 |

### Landing / 学生端

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/scene/landing` | `app/scene/landing/page.tsx` | `SceneLandingPage` | 场景门户首页 |
| `/scene/landing/[id]` | `app/scene/landing/[id]/page.tsx` | `SceneDetailPage` | 场景详情 |
| `/scene/landing/[id]/learn` | `app/scene/landing/[id]/learn/page.tsx` | `SceneLearnPage` | 场景学习页 |

---

## 超级管理员 Superadmin

| 路由 | 文件 | 默认导出组件 | 说明 |
|------|------|--------------|------|
| `/superadmin` | `app/superadmin/page.tsx` | `SuperAdminPage` | 超级管理员首页 |

---

## 附注

- 路由中的 `[id]`、`[majorName]` 等为 Next.js 动态路由参数。
- 部分组件名（如 `BatchesPage`、`WorkflowsPage`、`PositionsPage`、`ResourcesPage`）在不同模块中重复出现，实际为不同文件中的独立页面组件。
- `.next/` 构建产物中存在若干源码已移除的页面（如 `evaluation/job-ability/*`、`lesson/teacher/*`），本清单以当前源码 `page.tsx` 为准。
