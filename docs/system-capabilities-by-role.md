# 教学资源共享商城 — 系统功能与角色权限说明

> 本文档基于当前代码（`app/`、`components/`、`backend/internal/`、`backend/cmd/seed/main.go`）整理，重点说明五个测试身份各自能做什么、能看到哪些菜单、能操作哪些数据。
>
> 文档目标：把「谁能在哪里做什么」讲清楚，并标出代码与导航不一致的地方。

---

## 1. 系统概述

本项目是一个面向职业院校的教学资源共享交易平台，同时集成了五个业务子平台：

| 子平台 | 路径前缀 | 定位 |
|---|---|---|
| 教学资源商城 | `/` `/resources/*` `/orders` `/my-resources` | 资源展示、采购、创作、订单、结算 |
| 产业岗位学习平台 | `/job/*` | 岗位建模、批次、推荐、学习路径 |
| 产业应用场景学习实践平台 | `/scene/*` | 场景任务、AI 评分、归档 |
| 数字课程服务平台 | `/lesson/*` | 体系课、颗粒课、混合课、教学运行 |
| 能力评价与测评资源管理平台 | `/evaluation/*` | 题库、试卷、考试、微证书、毕业设计、学生画像 |
| 统一门户/服务台 | `/portal/*` | 入口导航、系统管理、个人工作台 |

所有页面共用同一套登录态（JWT），后端为单一 `/api/v1` 服务。

---

## 2. 身份与登录

### 2.1 五个测试账号

| 账号 | 密码 | 身份码（identity_type.code） | 旧角色（users.role） | 默认跳转 |
|---|---|---|---|---|
| `operator` | `operator123` | `platform_admin` | `operator` | `/admin` |
| `school` | `school123` | `school_admin` | `school` | `/admin` |
| `teacher` | `teacher123` | `teacher` | `school` | `/portal/workspace` |
| `student` | `student123` | `student` | `school` | `/portal/workspace` |
| `enterprise` | `enterprise123` | `enterprise_hr` | `enterprise` | `/dashboard` |

> 注：代码里还有 `enterprise_mentor`（企业导师），但种子数据只给了 `enterprise_hr`。`school_admin` 与 `platform_admin` 在前端共用同一套 `adminNavigation`。

### 2.2 登录流程

1. 前端：`/login` 调用 `POST /api/v1/auth/login`。
2. 后端：校验 `login_name`/`password`，签发 7 天有效期的 JWT。
3. 前端：把 token 写入 `localStorage['zhiyu-token']`，然后调用 `/api/v1/auth/me` 获取用户、身份、机构、权限。
4. 前端：`/` 根页面根据 `identityType.code` 做默认跳转（`app/page.tsx`）。

---

## 3. 角色功能总览表

| 功能模块 | 运营方 operator | 学校管理员 school | 教师 teacher | 学生 student | 企业 enterprise |
|---|---|---|---|---|---|
| 运营仪表盘 | ✅ `/admin` | ✅ 同左 | ❌ | ❌ | ❌ |
| 机构入驻审核 | ✅ `/admin/institutions` | ❌ | ❌ | ❌ | ❌ |
| 资源审核/强制下架 | ✅ `/admin/resources` | ❌ | ❌ | ❌ | ❌ |
| 全平台订单查看 | ✅ `/admin/orders` | ❌ | ❌ | ❌ | ❌ |
| 提现/结算审核 | ✅ `/admin/withdrawals` `/admin/settlement` | ❌ | ❌ | ❌ | ❌ |
| 轮播图/标签字典 | ✅ `/admin/banners` `/admin/dictionary` | ❌ | ❌ | ❌ | ❌ |
| 租户/组织/用户/日志 | ✅ `/portal/apps/system/*` | ❌ | ❌ | ❌ | ❌ |
| 机构仪表盘 | ❌ | ✅ `/dashboard` | ❌ | ❌ | ✅ `/dashboard` |
| 我的资源库 | ❌ | ✅ | 可读 | 可读 | ✅ `/my-resources` |
| 创建/编辑资源 | ❌ | ❌ | ❌ | ❌ | ✅ `/my-resources/new`, `/my-resources/[id]/edit` |
| 采购资源/下单 | ❌ | ✅ | ✅ | ✅ | 作为卖家 |
| 我的订单 | ❌ | ✅ `/orders` | ✅ | ✅ | ✅ `/orders` |
| 钱包/提现 | ❌ | ✅ `/wallet` | ❌ | ❌ | ✅ `/wallet` |
| 岗位平台 | ❌ | 可读 | ✅ `/job/*` | 可读 | 可读 |
| 场景平台 | ❌ | 可读 | ✅ `/scene/*` | ✅ `/scene/*` | 可读 |
| 课程平台 | ❌ | 可读 | ✅ `/lesson/*` | 可读 | 可读 |
| 测评平台 | ❌ | 可读 | ✅ `/evaluation/*` | ✅ `/evaluation/*`（landing 公开） | 可读 |
| 服务台 | 通用版 | 通用版 | 教师工作台 | 学生工作台 | 通用版 |
| 系统管理菜单 | ✅ | ❌ | ❌ | ❌ | ❌ |

> 说明：
> - 「可读」表示可以访问页面，但能否写数据取决于后端权限；目前后端大多数子平台接口只要有 JWT 就能调用。
> - `/job/*`、 `/scene/*`、 `/lesson/*`、 `/evaluation/*` 的 layout 允许 `platform_admin`/`school_admin`/`teacher` 访问，部分允许 `student`。

---

## 4. 分角色详细说明

### 4.1 运营方（operator / operator123）

**身份码**：`platform_admin`，旧角色 `operator`。

**登录后**：跳转到 `/admin`。

**左侧导航（`components/dashboard-layout.tsx` 的 `adminNavigation`）**：

| 分组 | 菜单 | 路径 | 功能 |
|---|---|---|---|
| 平台管理 | 租户管理 | `/portal/apps/system/tenant` | 配置租户信息 |
| 平台管理 | 组织架构 | `/portal/apps/system/org-user/org-structure` | 查看/维护组织架构树 |
| 平台管理 | 用户管理 | `/portal/apps/system/org-user/accounts` | 管理系统账号 |
| 平台管理 | 运营仪表盘 | `/admin` | GMV、机构数、资源数、订单数、待处理提醒 |
| 交易管理 | 订单管理 | `/admin/orders` | 查看全平台所有订单 |
| 交易管理 | 提现审核 | `/admin/withdrawals` | 审核企业提现申请 |
| 交易管理 | 结算中心 | `/admin/settlement` | 平台结算数据 |
| 系统设置 | 轮播图配置 | `/admin/banners` | 配置首页轮播图 |
| 系统设置 | 标签字典 | `/admin/dictionary` | 维护资源标签/分类字典 |

**不在左侧导航但属于运营方的页面**（从 `/admin` 仪表盘卡片进入）：
- `/admin/institutions` — 机构入驻审核、启用/禁用机构。
- `/admin/resources` — 资源审核、强制下架。

**系统管理深层菜单**（`/portal/apps/system/*`）：
- 租户： `/portal/apps/system/tenant`
- 组织用户：账号、组织架构、教师、学生、毕业生、关系、角色、组织类型、岗位、专业领域、身份类型
- 系统资源：资源包、专业、行业、资源编码
- 审批流程： `/portal/apps/system/approval`
- 日志：登录日志、操作日志

**后端特权**：`operator` 是唯一能执行平台级写操作的角色，包括：
- 机构审核/禁用、资源审核/发布/下架、订单/提现状态变更
- Banner / 平台链接 / 应用模块 / 租户 / 组织 / 角色 / 用户 / 字典的增删改

---

### 4.2 学校管理员（school / school123）

**身份码**：`school_admin`，旧角色 `school`。

**登录后**：跳转到 `/admin`（与运营方共用同一套后台导航）。

**能看到的菜单**：与 `operator` 完全相同（`platform_admin` 和 `school_admin` 都返回 `adminNavigation`）。

**关键区别**：
- 后端接口的写操作大多只认 `operator`（`domain.UserRoleOperator`）。
- 因此 `school` 账号虽然能看到「机构审核」「资源审核」「订单管理」等菜单，但很多写操作在后端会被拒绝。
- 从业务上看，`school` 更像一个「高级只读/本机构操作」账号，但代码目前没有在前端隐藏无权限的菜单项。

> ⚠️ **这是系统逻辑不对劲的地方之一**：`platform_admin` 与 `school_admin` 前端的导航完全一样，但后端权限以 `operator` 为唯一管理员，导致学校管理员能看到大量无法实际操作的菜单。

**机构相关操作**：
- `/dashboard` — 学校采购管理中心视角，显示已购资源、累计消费、账户余额、最近订单。
- `/orders` — 本校订单。
- `/wallet` — 本校钱包与账单。
- `/purchased` — 已购资源。

---

### 4.3 教师（teacher / teacher123）

**身份码**：`teacher`，旧角色 `school`。

**登录后**：跳转到 `/portal/workspace`。

**左侧导航（`teacherNavigation`）**：

| 分组 | 菜单 | 路径 |
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

**服务台**：教师工作台，包含「工作台首页 / 我的场景/课程 / 我的学生 / 个人中心」四个 Tab。

**主要能力**：
- 维护岗位、场景、课程、题库、试卷、考试等教学资源。
- 管理开课计划、跟踪学生学习与测评、提交成绩。
- 采购资源商城中的资源（通过 `/` 进入）。

> 后端目前对 `/job/*`、 `/scene/*`、 `/lesson/*`、 `/evaluation/*` 的接口大多只检查是否登录，因此教师实际上可以操作大部分数据。

---

### 4.4 学生（student / student123）

**身份码**：`student`，旧角色 `school`。

**登录后**：跳转到 `/portal/workspace`。

**左侧导航（`studentNavigation`）**：

| 分组 | 菜单 | 路径 |
|---|---|---|
| 学习应用 | 我的场景 | `/scene/` |
| 学习应用 | 考试中心 | `/evaluation/landing/exams` |
| 学习应用 | 毕业查询 | `/evaluation/landing/graduation` |
| 学习应用 | 我的画像 | `/evaluation/landing/portrait` |
| 学习应用 | 资源商城 | `/` |

**服务台**：学生工作台，包含「工作台首页 / 我的学习 / 我的收藏 / 测评认证 / 学生画像 / 学习社区 / 个人中心」。

**主要能力**：
- 参与场景学习、参加考试、查看学生画像。
- 浏览/购买资源商城中的资源。
- `/evaluation/landing/*` 是公开 landing 页，未登录也能看。

> 实际可写能力有限，目前主要偏学习/查看侧。

---

### 4.5 企业（enterprise / enterprise123）

**身份码**：`enterprise_hr`，旧角色 `enterprise`。

**登录后**：跳转到 `/dashboard`。

**左侧导航（`enterpriseNavigation`）**：

| 分组 | 菜单 | 路径 |
|---|---|---|
| 资源商城 | 商城首页 | `/` |
| 资源工坊 | 仪表盘 | `/dashboard` |
| 资源工坊 | 新建资源 | `/my-resources/new` |
| 资源工坊 | 我的资源库 | `/my-resources` |
| 资源工坊 | 订单管理 | `/orders` |
| 机构中心 | 机构信息 | `/institution` |
| 机构中心 | 账户中心 | `/wallet` |

**仪表盘视角**：
- 企业是资源创作者/卖家，仪表盘显示「我的资源数、待审核资源、累计收益、可提现余额」。
- 学校管理员视角则显示「已购资源、累计消费、账户余额」。

**主要能力**：
- 创建、编辑、提交资源审核（`/my-resources/new`, `/my-resources/[id]/edit`）。
- 查看本机构销售订单（`/orders`）。
- 维护企业机构信息（`/institution`）。
- 查看钱包余额、账单、提交提现（`/wallet`）。

---

## 5. 各子平台主要页面清单

### 5.1 教学资源商城

| 路径 | 说明 |
|---|---|
| `/` | 商城首页，未登录可浏览 |
| `/resources/[id]` | 资源详情 |
| `/resources/[id]/checkout` | 资源购买结算 |
| `/purchased` | 已购资源 |
| `/dashboard` | 机构仪表盘（学校/企业） |
| `/my-resources` | 我的资源库 |
| `/my-resources/new` | 新建资源 |
| `/my-resources/[id]/edit` | 编辑资源 |
| `/orders` | 我的订单 |
| `/institution` | 机构信息 |
| `/institution/apply` | 机构入驻申请 |
| `/wallet` | 钱包与提现 |

### 5.2 运营后台

| 路径 | 说明 |
|---|---|
| `/admin` | 运营仪表盘（含待处理提醒卡片） |
| `/admin/institutions` | 机构审核与管理 |
| `/admin/resources` | 资源审核与强制下架 |
| `/admin/orders` | 全平台订单 |
| `/admin/withdrawals` | 提现审核 |
| `/admin/settlement` | 结算中心 |
| `/admin/banners` | 轮播图配置 |
| `/admin/dictionary` | 标签字典 |

### 5.3 系统管理（`/portal/apps/system/*`）

| 路径 | 说明 |
|---|---|
| `/portal/apps/system/tenant` | 租户信息 |
| `/portal/apps/system/org-user/accounts` | 账号管理 |
| `/portal/apps/system/org-user/org-structure` | 组织架构 |
| `/portal/apps/system/org-user/teachers` | 教师管理 |
| `/portal/apps/system/org-user/students` | 学生管理 |
| `/portal/apps/system/org-user/graduates` | 毕业生管理 |
| `/portal/apps/system/org-user/relations` | 人员关系 |
| `/portal/apps/system/org-user/roles` | 角色管理 |
| `/portal/apps/system/org-user/org-types` | 组织类型 |
| `/portal/apps/system/org-user/positions` | 岗位管理 |
| `/portal/apps/system/org-user/fields` | 专业领域 |
| `/portal/apps/system/org-user/identity-types` | 身份类型 |
| `/portal/apps/system/resource/package` | 资源包 |
| `/portal/apps/system/resource/majors` | 专业字典 |
| `/portal/apps/system/resource/industries` | 行业字典 |
| `/portal/apps/system/resource/codes` | 资源编码 |
| `/portal/apps/system/approval` | 审批流程 |
| `/portal/apps/system/logs/login` | 登录日志 |
| `/portal/apps/system/logs/operation` | 操作日志 |

### 5.4 岗位平台（`/job/*`）

| 路径 | 说明 |
|---|---|
| `/job/positions` | 岗位管理 |
| `/job/positions/[id]/edit` | 编辑岗位 |
| `/job/ai/positions` | AI 辅助建岗 |
| `/job/batches` | 批次管理 |
| `/job/workflows` | 工作流 |
| `/job/approvals` | 审批管理 |
| `/job/recommend` | 岗位推荐 |
| `/job/learn-roads` | 学习路径 |

### 5.5 场景平台（`/scene/*`）

| 路径 | 说明 |
|---|---|
| `/scene/` 或 `/scene/scenarios` | 场景管理 |
| `/scene/scenarios/[id]/edit` | 编辑场景 |
| `/scene/ai/scenarios` | AI 辅助创建场景 |
| `/scene/batches` | 批次管理 |
| `/scene/workflows` | 工作流 |
| `/scene/approvals` | 审批任务 |
| `/scene/archive` | 场景归档 |
| `/scene/ai-first/approvals/grading` | AI 评分审批 |

### 5.6 课程平台（`/lesson/*`）

| 路径 | 说明 |
|---|---|
| `/lesson/admin/system` | 体系课管理 |
| `/lesson/admin/system/add` | 新增体系课 |
| `/lesson/admin/granular` | 颗粒课管理 |
| `/lesson/admin/granular/add` | 新增颗粒课 |
| `/lesson/admin/hybrid` | 混合课模板 |
| `/lesson/admin/hybrid/add` | 新增混合课 |
| `/lesson/admin/archive` | 混合课历史档案 |
| `/lesson/admin/approvals` | 资源审批 |
| `/lesson/admin/batches` | 批次分组 |
| `/lesson/admin/workflows` | 审批流程 |
| `/lesson/teacher/claim` | 开课计划 |
| `/lesson/teacher/behavior-collection` | 学习跟踪 |
| `/lesson/teacher/progress-tracking` | 测评跟踪 |
| `/lesson/teacher/final-assessment` | 期末总评 |
| `/lesson/teacher/grade-submit` | 成绩提交 |
| `/lesson/teacher/learning-portrait` | 学生画像 |

### 5.7 测评平台（`/evaluation/*`）

| 路径 | 说明 |
|---|---|
| `/evaluation/question-banks` | 题库管理 |
| `/evaluation/exams` | 试卷管理 |
| `/evaluation/exam-usage` | 考试管理 |
| `/evaluation/job-ability` | 岗位能力 |
| `/evaluation/landing/*` | 公开 landing 页 |

---

## 6. 权限与数据范围说明

### 6.1 认证方式

- JWT Token，有效期 7 天，存储在 `localStorage`。
- 后端 `Authorization: Bearer <token>`。
- Claims 包含：`UserID`、`TenantID`、`InstitutionID`、`IdentityTypeID`、`OrgNodeID`、`Role`、`Username`。

### 6.2 公开接口（无需登录）

- `POST /auth/login`
- `GET /banners`
- `GET /resources`、`GET /resources/{id}`、`POST /resources/{id}/view`
- `GET /platform-links`
- `GET /app-modules`

### 6.3 权限模型现状

**两层身份**：
1. `identity_types.code`：驱动前端路由和 UX（`platform_admin` / `school_admin` / `teacher` / `student` / `enterprise_hr` / `enterprise_mentor`）。
2. `users.role`：驱动后端粗粒度授权（`operator` / `school` / `enterprise`）。

**实际执行规则**：
- 大多数 `/api/v1/*` 接口只要有 JWT 即可调用。
- 平台级写操作（机构审核、资源审核、banner 管理、用户/角色/租户管理等）只允许 `operator`。
- 机构级数据隔离通过 `institution_id` 实现：资源创建、订单查询、钱包提现等默认只操作本机构数据。
- `roles.permissions` JSONB 字段和 `user_roles` 表已存在，但目前没有在后端中间件或 handler 中实际使用。

### 6.4 当前权限的明显缺口

- `school_admin` 与 `platform_admin` 前端导航完全相同，但后端只把 `operator` 当管理员，导致学校管理员能看到大量不可写的菜单。
- `/admin/resources`、`/admin/institutions` 页面真实存在，但没有在左侧导航中直接列出，只能从 `/admin` 仪表盘的提醒卡片进入。
- 教师、学生、企业人员的前端路由限制主要依赖 layout 中的白名单，后端接口的权限校验较松。

---

## 7. 已知不一致 / 待澄清点

1. **学校管理员权限模糊**  
   前端把 `school_admin` 与 `platform_admin` 当成同一类后台用户；后端大量管理接口只认 `operator`。学校管理员到底应该是一个只读/本机构视角，还是一个小号运营方？需要明确。

2. **运营后台缺少「资源审核」「机构审核」的导航入口**  
   `/admin/resources` 和 `/admin/institutions` 页面已开发，但 `components/dashboard-layout.tsx` 的 `adminNavigation` 里没有对应菜单，只能从 `/admin` 仪表盘的待处理提醒卡片点进去。

3. **新权限表未启用**  
   `roles` 表的 `permissions` JSONB 和 `user_roles` 表已经通过 `002_unified_schema.up.sql` 创建，但后端 handler 中仍用 `users.role == "operator"` 做判断。

4. **enterprise_mentor 没有测试账号**  
   种子数据只给了 `enterprise_hr`，`enterprise_mentor` 的功能边界未在测试数据中体现。

5. **部分页面为静态/mock 数据**  
   `/portal/workspace` 的教师/学生工作台有大量硬编码数据（欢迎文案、待办、公告、日历），与真实业务数据未完全打通。

6. **`teacherNavigation` 中的路径与 `unifiedNavigationConfig` 有重叠但不完全一致**  
   例如 `DashboardLayout` 给教师的是 `/lesson/teacher/behavior-collection`，而 `lib/navigation-config.ts` 的 `unifiedNavigationConfig` 里对应的是 `/lesson/teacher/behavior-collection`（一致），但教师点击「学习跟踪」后，左侧高亮逻辑依赖 `matchers`，需要确认是否都能正确匹配。

---

## 8. 结论

- **operator**：唯一真正的平台管理员，能看到/操作运营后台、系统管理、全平台交易与审核。
- **school**：代码层面被当作后台用户，但后端写权限不足，实际更像「学校采购管理员 + 只读后台」。
- **teacher**：教学资源创作者与教学运行管理者，能使用岗位/场景/课程/测评四大平台。
- **student**：学习参与者，主要使用场景、考试、画像、资源商城。
- **enterprise**：资源创作者与卖家，核心路径是 `/dashboard` → `/my-resources` → `/orders` → `/wallet`。

如果要修复「逻辑不太对」的感觉，最优先应解决：**明确 `school_admin` 的权限边界**，并相应调整前端导航与后端权限校验；其次补充 `/admin/resources` 和 `/admin/institutions` 的左侧导航入口。
