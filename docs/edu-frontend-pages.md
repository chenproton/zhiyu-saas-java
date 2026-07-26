# apps/edu 前端页面菜单结构清单

> 本清单基于 `apps/edu/lib/navigation-config.ts` 与 `apps/edu/lib/menu-permissions.ts` 整理，按「模块 → 一级菜单 → 二级菜单/页面」结构组织。不含 `apps/marketplace`、不含 `app/api/*` 接口路由、不含 `.next/` 构建产物。
> 已删除/合并页面：`/dashboard/marketplace`、`/job/banners`、`/job/landing`（合并至 `/job/student`）。
> 统计时间：2026-07-26

## 数字课程服务平台

| 一级菜单 | 二级菜单/页面 | 路由 | 说明 |
|----------|---------------|------|------|
| 在线课资源库 | 体系课管理 | `/lesson/admin/system` | 菜单页 |
| | ↳ 新增体系课 | `/lesson/admin/system/add` | 子页面 |
| | 颗粒课管理 | `/lesson/admin/granular` | 菜单页 |
| | ↳ 新增颗粒课 | `/lesson/admin/granular/add` | 子页面 |
| 混合课资源库 | 混合课模板管理 | `/lesson/admin/hybrid` | 菜单页 |
| | ↳ 新增混合课 | `/lesson/admin/hybrid/add` | 子页面 |
| | 混合课历史档案库 | `/lesson/admin/archive` | 菜单页 |
| 批次与审批管理 | 批次分组管理 | `/lesson/admin/batches` | 菜单页 |
| | 审批流程配置 | `/lesson/admin/workflows` | 菜单页 |
| | 审批中心 | `/lesson/admin/approvals` | 菜单页 |
| （前台/其他） | 前台落地页 | `/lesson/landing` | 非左侧菜单 |

## 产业岗位学习平台

| 一级菜单 | 二级菜单/页面 | 路由 | 说明 |
|----------|---------------|------|------|
| 岗位中心 | 岗位管理 | `/job/positions` | 菜单页 |
| | ↳ 岗位编辑 | `/job/positions/[id]/edit` | 子页面 |
| | 岗位归档 | `/job/archive` | 菜单页 |
| 批次与审批管理 | 批次分组管理 | `/job/batches` | 菜单页 |
| | 审批流程配置 | `/job/workflows` | 菜单页 |
| | 审批中心 | `/job/approvals` | 菜单页 |
| 岗位展示配置 | 岗位推荐 | `/job/recommend` | 菜单页 |
| | 学习路径 | `/job/learn-roads` | 菜单页 |
| （前台/其他） | 前台落地页/学生就业首页 | `/job/student` | 非左侧菜单 |
| | ↳ 学生就业详情 | `/job/student/[id]` | 子页面 |
| | ↳ 学生学习页 | `/job/student/[id]/learn` | 子页面 |

## 实践场景学习平台

| 一级菜单 | 二级菜单/页面 | 路由 | 说明 |
|----------|---------------|------|------|
| 场景中心 | 场景管理 | `/scene` | 菜单页 |
| | ↳ 场景编辑 | `/scene/scenarios/[id]/edit` | 子页面 |
| | ↳ 场景任务编辑 | `/scene/scenarios/[id]/edit/tasks` | 子页面 |
| | ↳ 新建场景编辑 | `/scene/scenarios/new/edit` | 子页面 |
| | 场景归档 | `/scene/archive` | 菜单页 |
| 批次与审批管理 | 批次分组管理 | `/scene/batches` | 菜单页 |
| | 审批流程配置 | `/scene/workflows` | 菜单页 |
| | 审批中心 | `/scene/approvals` | 菜单页 |
| （前台/其他） | 前台落地页 | `/scene/landing` | 非左侧菜单 |
| | ↳ 场景详情 | `/scene/landing/[id]` | 子页面 |
| | ↳ 场景学习 | `/scene/landing/[id]/learn` | 子页面 |

## 能力评价与测评资源管理平台

| 一级菜单 | 二级菜单/页面 | 路由 | 说明 |
|----------|---------------|------|------|
| 测评资源 | 题库管理 | `/evaluation/question-banks` | 菜单页 |
| | ↳ 题库详情 | `/evaluation/question-banks/[id]` | 子页面 |
| | 试卷管理 | `/evaluation/exams` | 菜单页 |
| | ↳ 考试编辑 | `/evaluation/exams/[id]` | 子页面 |
| | 考试管理 | `/evaluation/exam-usage` | 菜单页 |
| | ↳ 考试结果 | `/evaluation/exam-usage/results` | 子页面 |
| 批次与审批管理 | 批次分组管理 | `/evaluation/batches` | 菜单页 |
| | 审批流程配置 | `/evaluation/workflows` | 菜单页 |
| | 审批中心 | `/evaluation/approvals` | 菜单页 |
| 结果与认证 | 场景任务评价 | `/evaluation/scene-results` | 菜单页 |
| | ↳ 成绩详情 | `/evaluation/scene-results/[id]` | 子页面 |
| （前台/其他） | 前台落地页 | `/evaluation/landing` | 非左侧菜单 |
| | ↳ 证书列表 | `/evaluation/landing/certifications` | 子页面 |
| | ↳ 证书详情 | `/evaluation/landing/certifications/[id]` | 子页面 |
| | ↳ 测评方式 | `/evaluation/landing/evaluation-methods` | 子页面 |
| | ↳ 门户考试列表 | `/evaluation/landing/exams` | 子页面 |
| | ↳ 门户考试详情 | `/evaluation/landing/exams/[id]` | 子页面 |
| | ↳ 毕业认证 | `/evaluation/landing/graduation` | 子页面 |
| | ↳ 毕业认证详情 | `/evaluation/landing/graduation/[id]` | 子页面 |
| | ↳ 专业画像 | `/evaluation/landing/portrait/major/[majorName]` | 子页面 |
| | ↳ 资源中心 | `/evaluation/landing/resources` | 子页面 |
| | ↳ 资源题库详情 | `/evaluation/landing/resources/banks/[id]` | 子页面 |
| | ↳ 资源试卷详情 | `/evaluation/landing/resources/exams/[id]` | 子页面 |

## 资源共享平台

| 一级菜单 | 二级菜单/页面 | 路由 | 说明 |
|----------|---------------|------|------|
| 公共资源库 | 知识点库 | `/library/knowledge` | 菜单页 |
| | 能力点库 | `/library/ability` | 菜单页 |
| | 证书库 | `/library/certificates` | 菜单页 |
| | 教学资源库 | `/library/resources` | 菜单页 |
| | 现场问答题库 | `/library/questions` | 菜单页 |
| （前台/其他） | 前台落地页 | `/library/landing` | 非左侧菜单 |

## 统一门户

| 一级菜单 | 二级菜单/页面 | 路由 | 说明 |
|----------|---------------|------|------|
| 系统设置 | 系统管理入口 | `/portal/apps/system` | 菜单页 |
| | 租户信息管理 | `/portal/apps/system/tenant` | 菜单页 |
| | 套餐情况查看 | `/portal/apps/system/resource/package` | 菜单页 |
| | 资源编码管理 | `/portal/apps/system/resource/codes` | 菜单页 |
| | 行业管理 | `/portal/apps/system/resource/industries` | 菜单页 |
| | 专业管理 | `/portal/apps/system/resource/majors` | 菜单页 |
| | 教职工管理 | `/portal/apps/system/org-user/teachers` | 菜单页 |
| | 学生管理 | `/portal/apps/system/org-user/students` | 菜单页 |
| | 毕业学生管理 | `/portal/apps/system/org-user/graduates` | 菜单页 |
| | 账户列表 | `/portal/apps/system/org-user/accounts` | 菜单页 |
| | 角色权限管理 | `/portal/apps/system/org-user/roles` | 菜单页 |
| | 职位管理 | `/portal/apps/system/org-user/positions` | 菜单页 |
| | 组织类型管理 | `/portal/apps/system/org-user/org-types` | 菜单页 |
| | 组织架构管理 | `/portal/apps/system/org-user/org-structure` | 菜单页 |
| | 用户字段扩展 | `/portal/apps/system/org-user/fields` | 菜单页 |
| | 关系类型管理 | `/portal/apps/system/org-user/relations` | 菜单页 |
| | 登录日志查看 | `/portal/apps/system/logs/login` | 菜单页 |
| | 操作日志查看 | `/portal/apps/system/logs/operation` | 菜单页 |
| 门户公共 | 门户首页 | `/portal` | 菜单页 |
| | 应用中心 | `/portal/apps` | 菜单页 |
| | 个人工作台 | `/portal/workspace` | 菜单页 |
| | 平台链接配置 | `/portal/config/links` | 菜单页 |
| | 门户登录 | `/portal/login` | 菜单页 |

## 超级管理员

| 一级菜单 | 二级菜单/页面 | 路由 | 说明 |
|----------|---------------|------|------|
| - | 超级管理员首页 | `/superadmin` | 未在导航/菜单中 |

---

## 附注

- 路由中的 `[id]`、`[majorName]` 等为 Next.js 动态路由参数。
- 「非左侧菜单」指该页面未出现在对应模块的左侧导航中，但通过门户首页、权限菜单或其他页面跳转可访问。
- 子页面通常由其父级列表页通过 `Link` 或 `router.push` 跳转进入。
