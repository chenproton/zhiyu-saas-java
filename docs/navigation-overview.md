# 知育 SaaS — 完整导航总览

> 本文档基于当前已部署代码整理，覆盖五个身份、五个子平台、三套布局系统下的所有导航入口。

---

## 1. 导航体系总览

本项目存在三套并行的导航/布局系统：

| 布局系统 | 使用位置 | 特点 |
|---|---|---|
| `MarketplaceLayout` | `/` 商城首页 | 顶部公共导航栏，无左侧菜单 |
| `DashboardLayout` | `/admin/*`、`/dashboard`、`/orders`、`/my-resources` 等 | 左侧分组导航，按身份切换 |
| `PlatformShell` | `/job/*`、`/scene/*`、`/lesson/*`、`/evaluation/*`、`/portal/apps/*` | 顶部子平台导航 + 左侧二级菜单 |

---

## 2. 登录后默认入口

| 账号 | 身份码 | 登录后跳转 | 对应后台 |
|---|---|---|---|
| `operator` | `platform_admin` | `/admin` | 平台运营后台 |
| `school` | `school_admin` | `/dashboard` | 学校机构后台 |
| `teacher` | `teacher` | `/portal/workspace` | 教师服务台 |
| `student` | `student` | `/portal/workspace` | 学生服务台 |
| `enterprise` | `enterprise_hr` | `/dashboard` | 企业机构后台 |

---

## 3. 全局公共页面（任何身份均可访问）

| 路径 | 说明 | 是否需要登录 |
|---|---|---|
| `/` | 教学资源商城首页 | 否 |
| `/login` | 登录页 | 否 |
| `/resources/[id]` | 资源详情 | 否 |
| `/resources/[id]/checkout` | 资源购买结算 | 是 |
| `/portal` | 统一门户首页 | 否 |
| `/portal/apps` | 应用中心 | 否 |
| `/evaluation/landing/*` | 测评公开落地页 | 否 |

---

## 4. 按身份的后台导航（`DashboardLayout`）

### 4.1 运营方 `platform_admin`（operator）

**可进入**：`/admin/*`、`/portal/apps/system/tenant`

| 左侧分组 | 菜单 | 路径 |
|---|---|---|
| 平台概览 | 运营仪表盘 | `/admin` |
| 租户管理 | 机构入驻审核 | `/admin/institutions` |
| 租户管理 | 租户配置 | `/portal/apps/system/tenant` |
| 内容管理 | 资源审核 | `/admin/resources` |
| 交易管理 | 全平台订单 | `/admin/orders` |
| 交易管理 | 提现审核 | `/admin/withdrawals` |
| 交易管理 | 结算中心 | `/admin/settlement` |
| 系统配置 | 轮播图配置 | `/admin/banners` |
| 系统配置 | 标签字典 | `/admin/dictionary` |

**路由守卫**：`app/admin/layout.tsx` 限制仅 `platform_admin` 可访问 `/admin/*`。

---

### 4.2 学校管理员 `school_admin`（school）

**可进入**：`/dashboard`、`/orders`、`/wallet`、`/purchased`、`/institution`、`/portal/apps/system/*`

| 左侧分组 | 菜单 | 路径 |
|---|---|---|
| 机构概览 | 学校仪表盘 | `/dashboard` |
| 资源采购 | 资源商城 | `/` |
| 资源采购 | 已购资源 | `/purchased` |
| 交易管理 | 本校订单 | `/orders` |
| 财务管理 | 本校钱包 | `/wallet` |
| 机构信息 | 学校信息 | `/institution` |
| 系统管理 | 组织架构 | `/portal/apps/system/org-user/org-structure` |
| 系统管理 | 用户管理 | `/portal/apps/system/org-user/accounts` |
| 系统管理 | 教师管理 | `/portal/apps/system/org-user/teachers` |
| 系统管理 | 学生管理 | `/portal/apps/system/org-user/students` |
| 系统管理 | 毕业生管理 | `/portal/apps/system/org-user/graduates` |
| 系统管理 | 角色权限 | `/portal/apps/system/org-user/roles` |
| 系统管理 | 审批流程 | `/portal/apps/system/approval` |
| 系统管理 | 登录日志 | `/portal/apps/system/logs/login` |
| 系统管理 | 操作日志 | `/portal/apps/system/logs/operation` |

**路由守卫**：`app/dashboard/layout.tsx` 限制 `school_admin` 可进入 `/dashboard`。

---

### 4.3 教师 `teacher`

**可进入**：`/portal/workspace`、`/job/*`、`/scene/*`、`/lesson/*`、`/evaluation/*`、`/orders`、`/`

| 左侧分组 | 菜单 | 路径 |
|---|---|---|
| 教学应用 | 岗位管理 | `/job/positions` |
| 教学应用 | 场景管理 | `/scene/` |
| 教学应用 | 课程管理 | `/lesson/admin/system` |
| 教学应用 | 测评管理 | `/evaluation/question-banks` |
| 教学应用 | 资源商城 | `/` |
| 教务空间 | 开课计划 | `/lesson/teacher/claim` |
| 教务空间 | 学习跟踪 | `/lesson/teacher/behavior-collection` |
| 教务空间 | 测评跟踪 | `/lesson/teacher/progress-tracking` |
| 教务空间 | 期末总评 | `/lesson/teacher/final-assessment` |
| 教务空间 | 成绩提交 | `/lesson/teacher/grade-submit` |
| 教务空间 | 学生画像 | `/lesson/teacher/learning-portrait` |
| 个人中心 | 我的订单 | `/orders` |

**服务台 Tab**：工作台首页、我的场景/课程、我的学生、个人中心。

---

### 4.4 学生 `student`

**可进入**：`/portal/workspace`、`/scene/*`、`/evaluation/landing/*`、`/orders`、`/`

| 左侧分组 | 菜单 | 路径 |
|---|---|---|
| 学习应用 | 我的场景 | `/scene/` |
| 学习应用 | 考试中心 | `/evaluation/landing/exams` |
| 学习应用 | 毕业查询 | `/evaluation/landing/graduation` |
| 学习应用 | 我的画像 | `/evaluation/landing/portrait` |
| 学习应用 | 资源商城 | `/` |
| 个人中心 | 我的订单 | `/orders` |

**服务台 Tab**：工作台首页、我的学习、我的收藏、测评认证、学生画像、学习社区、个人中心。

---

### 4.5 企业 `enterprise_hr`

**可进入**：`/dashboard`、`/my-resources/*`、`/orders`、`/wallet`、`/institution`、`/`

| 左侧分组 | 菜单 | 路径 |
|---|---|---|
| 资源工坊 | 仪表盘 | `/dashboard` |
| 资源工坊 | 新建资源 | `/my-resources/new` |
| 资源工坊 | 我的资源库 | `/my-resources` |
| 交易管理 | 销售订单 | `/orders` |
| 财务管理 | 钱包/提现 | `/wallet` |
| 机构中心 | 企业信息 | `/institution` |

**路由守卫**：`app/dashboard/layout.tsx` 限制 `enterprise_hr` / `enterprise_mentor` 可进入 `/dashboard`。

---

## 5. 子平台内部导航（`PlatformShell`）

进入以下子平台后，顶部会出现固定导航栏，左侧出现二级菜单。

### 5.1 岗位平台 `/job/*`

**顶部导航**：岗位管理、批次管理、工作流、审批管理、岗位推荐、学习路径

**左侧菜单**：

| 分组 | 子菜单 | 路径 |
|---|---|---|
| 岗位中心 | 岗位管理 | `/job/positions` |
| 岗位中心 | AI 辅助建岗 | `/job/ai/positions` |
| 批次与推荐 | 批次管理 | `/job/batches` |
| 批次与推荐 | 岗位推荐 | `/job/recommend` |
| 批次与推荐 | 学习路径 | `/job/learn-roads` |
| 流程与审批 | 工作流 | `/job/workflows` |
| 流程与审批 | 审批管理 | `/job/approvals` |

---

### 5.2 场景平台 `/scene/*`

**顶部导航**：场景管理、批次管理、工作流、审批管理、归档库

**左侧菜单**：

| 分组 | 子菜单 | 路径 |
|---|---|---|
| 场景中心 | 场景管理 | `/scene/` |
| 场景中心 | 场景归档 | `/scene/archive` |
| 批次与流程 | 批次管理 | `/scene/batches` |
| 批次与流程 | 工作流 | `/scene/workflows` |
| 批次与流程 | 审批管理 | `/scene/approvals` |

---

### 5.3 课程平台 `/lesson/*`

**顶部导航**：岗位管理、批次管理、工作流、审批管理、归档库（注：课程平台复用了类似顶部结构）

**左侧菜单**：

| 分组 | 子菜单 | 路径 |
|---|---|---|
| 在线课资源库 | 体系课管理 | `/lesson/admin/system` |
| 在线课资源库 | 颗粒课管理 | `/lesson/admin/granular` |
| 混合课资源库 | 混合课模板管理 | `/lesson/admin/hybrid` |
| 混合课资源库 | 混合课历史档案库 | `/lesson/admin/archive` |
| 教学空间 | 开课计划管理 | `/lesson/teacher/claim` |
| 教学空间 | 课程学习跟踪 | `/lesson/teacher/behavior-collection` |
| 教学空间 | 课程测评跟踪 | `/lesson/teacher/progress-tracking` |
| 教学空间 | 课程期末总评 | `/lesson/teacher/final-assessment` |
| 教学空间 | 成绩确认与提交 | `/lesson/teacher/grade-submit` |
| 教学空间 | 我的学生画像 | `/lesson/teacher/learning-portrait` |
| 资源审批与质量 | 审批管理 | `/lesson/admin/approvals` |
| 资源审批与质量 | 批次分组管理 | `/lesson/admin/batches` |
| 资源审批与质量 | 审批流程管理 | `/lesson/admin/workflows` |

---

### 5.4 测评平台 `/evaluation/*`

**顶部导航**：题库、试卷、考试、测评方式、场景结果、岗位能力、微证书、毕业设计、学生画像

**左侧菜单**：

| 分组 | 子菜单 | 路径 |
|---|---|---|
| 测评资源 | 题库管理 | `/evaluation/question-banks` |
| 测评资源 | 试卷管理 | `/evaluation/exams` |
| 测评资源 | 考试管理 | `/evaluation/exam-usage` |
| 测评资源 | 测评方式 | `/evaluation/methods` |
| 结果与认证 | 场景结果 | `/evaluation/scene-results` |
| 结果与认证 | 岗位能力 | `/evaluation/job-ability` |
| 结果与认证 | 微证书 | `/evaluation/certificates/templates` |
| 毕业与画像 | 毕业设计 | `/evaluation/graduation/topics` |
| 毕业与画像 | 学生画像 | `/evaluation/portraits` |

---

### 5.5 门户与应用中心 `/portal/*`

**顶部导航**（在 `/portal/apps/*` 下）：门户首页、我的服务台、应用服务中心

**应用中心 `/portal/apps`**：展示所有子平台入口卡片。

**系统管理 `/portal/apps/system/*`** 内部左侧菜单：

| 分组 | 子菜单 | 路径 |
|---|---|---|
| 租户信息管理 | 租户信息 | `/portal/apps/system/tenant` |
| 系统资源管理 | 套餐情况查看 | `/portal/apps/system/resource/package` |
| 系统资源管理 | 资源编码管理 | `/portal/apps/system/resource/codes` |
| 系统资源管理 | 行业管理 | `/portal/apps/system/resource/industries` |
| 系统资源管理 | 专业管理 | `/portal/apps/system/resource/majors` |
| 日志管理 | 登录日志查看 | `/portal/apps/system/logs/login` |
| 日志管理 | 操作日志查看 | `/portal/apps/system/logs/operation` |
| 组织用户管理 | 组织类型管理 | `/portal/apps/system/org-user/org-types` |
| 组织用户管理 | 组织架构管理 | `/portal/apps/system/org-user/org-structure` |
| 组织用户管理 | 学生管理 | `/portal/apps/system/org-user/students` |
| 组织用户管理 | 教职工管理 | `/portal/apps/system/org-user/teachers` |
| 组织用户管理 | 账户列表 | `/portal/apps/system/org-user/accounts` |
| 组织用户管理 | 身份类型管理 | `/portal/apps/system/org-user/identity-types` |
| 组织用户管理 | 用户字段扩展 | `/portal/apps/system/org-user/fields` |
| 组织用户管理 | 关系类型管理 | `/portal/apps/system/org-user/relations` |
| 组织用户管理 | 毕业学生管理 | `/portal/apps/system/org-user/graduates` |
| 组织用户管理 | 角色权限管理 | `/portal/apps/system/org-user/roles` |
| 组织用户管理 | 职位管理 | `/portal/apps/system/org-user/positions` |
| 审批流程管理 | 审批流程 | `/portal/apps/system/approval` |

---

## 6. 路由守卫汇总

| 路径前缀 | 允许身份 | 重定向规则 |
|---|---|---|
| `/admin/*` | `platform_admin` | 其他身份 → `/dashboard` |
| `/dashboard` | `school_admin`、`enterprise_hr`、`enterprise_mentor` | `platform_admin` → `/admin`；教师/学生 → `/portal/workspace` |
| `/portal/workspace` | 任意登录用户 | 未登录 → `/login` |
| `/job/*` | `platform_admin`、`school_admin`、`teacher` | 由 `app/job/layout.tsx` 控制 |
| `/scene/*` | `platform_admin`、`school_admin`、`teacher`、`student` | 由 `app/scene/layout.tsx` 控制 |
| `/lesson/*` | `platform_admin`、`school_admin`、`teacher` | 由子 layout 控制 |
| `/evaluation/*`（除 landing） | `platform_admin`、`school_admin`、`teacher`、`student` | 由 `app/evaluation/layout.tsx` 控制 |

---

## 7. 路径速查表（按业务域）

### 7.1 运营后台

| 路径 | 功能 |
|---|---|
| `/admin` | 运营仪表盘 |
| `/admin/institutions` | 机构入驻审核 |
| `/admin/resources` | 资源审核与强制下架 |
| `/admin/orders` | 全平台订单 |
| `/admin/withdrawals` | 提现审核 |
| `/admin/settlement` | 结算中心 |
| `/admin/banners` | 轮播图配置 |
| `/admin/dictionary` | 标签字典 |

### 7.2 机构后台（学校/企业共用 `/dashboard`）

| 路径 | 学校视角 | 企业视角 |
|---|---|---|
| `/dashboard` | 学校仪表盘 | 企业仪表盘 |
| `/orders` | 本校采购订单 | 本企业销售订单 |
| `/wallet` | 本校账户 | 本企业钱包/提现 |
| `/institution` | 学校信息 | 企业信息 |
| `/purchased` | 已购资源 | — |
| `/my-resources` | — | 我的资源库 |
| `/my-resources/new` | — | 新建资源 |

### 7.3 子平台入口

| 路径 | 子平台 |
|---|---|
| `/job/positions` | 岗位平台 |
| `/scene/` | 场景平台 |
| `/lesson/admin/system` | 课程平台 |
| `/evaluation/question-banks` | 测评平台 |
| `/portal` | 统一门户 |
| `/portal/workspace` | 我的服务台 |
| `/portal/apps` | 应用中心 |

---

## 8. 当前已知的导航边界

1. **运营方只能看到平台运营菜单**，不再看到「组织架构」「用户管理」等学校自治菜单。
2. **学校管理员不再进入 `/admin`**，而是使用独立的 `/dashboard` + 系统管理菜单。
3. **企业后台移除了「资源商城」分组**，商城入口保留在教师/学生导航中。
4. **教师教务空间路径已修正**为实际存在的页面（`behavior-collection`、`progress-tracking`、`final-assessment`、`learning-portrait`）。
5. **系统管理页面 `/portal/apps/system/*`** 对学校管理员全部可见；对运营方仅「租户配置」可见。
