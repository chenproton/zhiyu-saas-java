# 企业平台（Partner）规格文档 — 知与 SaaS

> 二期规格：企业服务台 / Partner 平台（与 Portal 学校平台平级）。
> 状态：已实施。含三大校企互动流程（联盟展示/岗位场景共建/测评打分）完整分析。

---

## 1. 背景与目标

### 1.1 为什么要做

当前合作企业、专家资源由学校在 `/portal/apps/alliance` 下手工维护，企业自身无法参与数据维护。随着校企合作深化，需要将企业提升为独立平台：

- 企业自主注册、自主维护主体信息与专家资源，减轻学校维护负担
- 学校侧联盟管理从"创建企业"变为"关联/引入企业"，聚焦合作关系（评级/协议/项目/成果）
- 为未来企业侧更多业务（课程共建、岗位发布、人才需求等）预留平台底座

### 1.2 产品定位

**Partner（企业平台）** 是与 **Portal（学校平台）** 平级的租户级平台，服务企业侧用户（企业管理员/成员）。

- 一期能力：企业注册登录、主体信息维护、专家资源维护、成员账号管理、合作学校查看
- 核心协作机制：企业专家资源通过"学校-企业合作关联（link）"共享给引入该企业的学校，学校端只读

### 1.3 边界与不改动范围

| 项目 | 说明 |
|------|------|
| 学校侧协议/项目/成果 | 继续由学校维护，可关联到已引入企业，数据仍属学校租户 |
| 门户其他模块 | 教务/课程/测评/岗位等不受影响 |
| 运营方 SaaS 平台 | superadmin 控制台不受影响 |

---

## 2. 平台级架构决策

### 2.1 与 Portal 平级要素对照

| 平台要素 | Portal（学校平台）现状 | Partner（企业平台）规划 |
|---------|----------------------|------------------------|
| 租户 | `tenants`（学校租户） | `tenants`（企业租户，`type=enterprise`） |
| 平台标识 | `platform=portal`（JWT + DB） | `platform=partner`（新增；DB 为 varchar 无需 DDL） |
| 前端路由段 | `/portal/*`，`PortalLayout` | `/partner/*`，业务页面挂在 `PortalLayout` children（`/partner/login` 为独立登录页，无独立布局/Guard，见 §F5） |
| Token key | `zhiyu-portal-token` | `zhiyu-partner-token` |
| API 前缀 | `/api/v1` + `RequirePlatform('portal')` | `/api/v1/partner/*` + `RequirePlatform('partner')` |
| 角色/权限 | roles + user_roles + permissions + 菜单权限 | 企业租户内种子角色 `enterprise_admin` / `enterprise_member`，复用同一套机制 |
| 导航菜单 | `frontend/portal-vue/src/layouts/navigation-config.ts` | `partnerNavigationConfig`（未来加功能 = 加菜单 + 加页面） |
| 跨平台合作 | — | 合作关联表（学校租户 × 企业租户） |

### 2.2 核心决策（已确认）

1. **企业 = 全局独立实体**：一个企业可被多个学校"引入"，企业主体全局唯一
2. **自助注册即生效**：注册无需审核，学校侧"引入"即建立合作关系
3. **专家数据存企业侧**：企业服务台维护，学校端只读、按已引入企业自动加载
   > **ADR-0007 决策 2 措辞澄清（本节为准）**：ADR-0007 原文「学校侧按授权（alliance_resource_grants，146）读取」中，`alliance_resource_grants`（迁移 146 `expert_account_grant` 内建表）实际是**资源编辑授权**（`resource_type: position|scene`，授权企业编辑学校自建资源），并非专家档案读取授权；专家档案的学校侧可见性由「已引入企业 links 关联 + 企业 `enable_public` 开关」双控（见 §5.6 权限与越权校验）。
4. **账号体系**：注册时创建企业管理员账号（`enterprise_admin`），管理员可在服务台添加成员账号（`enterprise_member`）
5. **前端形态**：业务门户（Vue，`frontend/portal-vue`）内 `/partner` 路由段，复用现有组件与请求层
6. **存量数据**：不迁移，联盟开发数据整体重置

---

## 3. 学校-企业互动流程

> 三个核心互动场景的完整流程分析：产业联盟展示使用、企业专家参与岗位/场景资源共建、企业专家参与学生测评打分。每个场景给出：现状（既有机制）、目标流程、权限边界、一期范围与未来演进。

### 3.1 专家身份体系（互动前提）

企业侧的"人"与学校侧的"人"是两套实体，互动流程必须先解决身份映射：

| 实体 | 归属 | 说明 |
|------|------|------|
| 专家档案 `alliance_experts` | 企业租户 | 资源/档案（企业服务台维护，学校只读） |
| 企业成员账号 `users`（platform=partner） | 企业租户 | 可登录 partner 平台的人（enterprise_admin / enterprise_member） |

**绑定关系（迁移为正式字段）**：
- `alliance_experts.user_id`（可空，不建 FK）：专家档案 ↔ 企业成员账号。成员登录后可在"我的档案"认领自己的专家档案，认领后由本人维护。

**最终方案（已实施）**：企业专家**直接使用企业侧账号**（`alliance_experts.user_id`）参与岗位/场景共建与学生测评打分，业务表（`career_positions.collaborators` / `scenarios.co_builder_ids` / `task_review_steps.assigned_user_ids` / 评分记录 `evaluator_id`）直接引用企业侧账号 id。

> 历史说明：早期曾设计「影子账号」过渡方案（`alliance_expert_mentor_links` 表 + 学校侧 `em_` 前缀 portal 账号），后经产品决策放弃。`alliance_expert_mentor_links` 表已 DROP（migration 154）、影子账号已清理（migration 155）。本文档各章节均以「企业账号直绑」为准。

### 3.2 互动流程一：产业联盟展示使用

**参与者**：企业（主体信息+专家维护方）、学校（link 管理方）、门户访客（`/portal/alliance/*` 前台展示页）

**现状**：
- `/api/v1/alliance/public/*`（GET，挂在 jobViewer 组，需 portal JWT + 角色，**非匿名**）
- `is_public` 由学校维护；数据访问层查询**完全不按租户过滤**，所有学校的公开数据跨租户汇聚展示
- 前台页面：`views/portal/alliance/landing.vue`（学校信息卡 + 统计卡 + 企业/项目/成果/专家区块 + 品牌 Tab）及各列表页/详情页

**目标流程**：
1. 企业侧：注册（默认开启 `enable_public`）→ 维护主体信息 → 按需关闭 `enable_public`（企业"愿意对外展示"）；专家档案 `is_public`（语义改为企业侧维护，专家"愿意被展示"）
2. 学校侧：引入企业（link）→ `link.is_public`（学校"愿在本校前台出现"）
3. 展示规则（public 接口数据源改造）：
   - 无 `tenantId`（全局联盟展示）：`enable_public=true` 的全局企业去重 + 其公开专家/项目/成果
   - 带 `tenantId`（学校落地页 hero 卡）：该校 `link.is_public=true` 且企业 `enable_public=true` 的数据
4. 学校信息（`/alliance/public/school-info`）与品牌（brands）逻辑保持

**双控原则**：企业控制"愿不愿意"，学校控制"在不在本校出现"，任一关闭即不展示。
**一期范围**：public 接口数据源改为「全局企业主体 + links」；企业侧展示开关落地；专家 `is_public` 移交企业维护。

### 3.3 互动流程二：企业专家参与岗位/场景资源共建

**现状**：
- 岗位共建：`career_positions.collaborators uuid[]`（UserSelector 选 users，仅排除学生，企业导师可被选中）
- 场景共建：`scenarios.co_builder_ids uuid[]`（UserSelector 选 users）
- 排课：`schedule_entries.teacher_id → users(id)`，`teaching_plan_entries.teacher_type` 已支持"企业导师"
- 毕业设计：`graduation_project_topics.enterprise_mentor_id` 遗留列已于 migration 154 清理（全仓库无读写代码），毕业设计课题导师绑定不在当前范围
- `enterprise_mentor` 角色权限过宽：businessUser 组全写权限 + `canManageAlliance`（联盟全量 CRUD）

**目标流程**：
1. 企业维护专家档案，可选绑定企业成员账号（3.1）
2. 学校引入企业 → 专家只读可见（`GET /alliance/experts`）
3. 学校在岗位/场景共建人选择器中选"企业专家"（数据源：已引入企业的专家，须已绑定企业账号）→ 岗位 `collaborators` / 场景 `co_builder_ids` 直接写入企业账号 id（`alliance_experts.user_id`）
4. 企业导师用自己的企业账号参与共建（岗位/场景编辑）、被排课（teacher_type=企业导师）
5. （不在当前范围）毕业设计课题导师绑定：`enterprise_mentor_id` 遗留列已随 migration 154 删除，未规划替代

**权限收窄（重要，2026-08-17 起为配置级，ADR-0008）**：移除 `enterprise_mentor` 的 `canManageAlliance` 全量权限，联盟管理归 `school_admin`/`teacher`；保留共建（job/scene 写）+ 测评打分。菜单驱动 RBAC 后，`enterprise_mentor` 默认种子不勾联盟菜单即无联盟权限（配置可覆盖），代码级收窄取消。联盟写授权面 = `/portal/apps/alliance` 管理菜单：仅勾联盟前台落地页（`/portal/alliance/landing`）的角色是前台只读角色，不获联盟管理 CRUD 权限。
**一期范围**：共建人选择器支持"企业专家"来源（直接绑定企业账号）+ 权限收窄（毕业设计导师绑定不在范围，遗留列已删）。
**演进**：partner 平台待评分入口（跨租户评分）。

### 3.4 互动流程三：企业专家参与学生测评打分

**现状**：
- 测评配置：`task_evaluation_methods.eval_subjects` 支持 `enterprise_mentor` 主体（声明式，含领域/年限/人数/权重参数）；`task_review_steps.subject_type='enterprise_mentor'` 支持复审步骤
- 打分 API 层开放（businessUser 组可 grade/batch-grade，仅同租户校验），**但 enterprise_mentor 种子菜单不含 `/evaluation/*`，前端看不到评分页**
- 学生提交测评可指定 `evaluatorId`（仅同租户校验，无角色校验）
- **缺失**：任务级企业导师分配机制（当前只有配置层面的声明，无实际把人分配到位）

**目标流程**：
1. 教师在场景任务配置评价方法：主体 `enterprise_mentor` + 权重 + 人数（沿用现有 evaluation-rules-editor 配置器）
2. 任务级分配：教师从"已引入企业的专家（已绑定企业账号）"中选择评分人（新分配机制，落地到任务/测评配置）
3. 学生完成任务提交测评（`evaluator_id`=企业账号，`evaluator_type=enterprise_mentor`）
4. 企业导师用企业账号评分 → 打分 → 结果回写（status: pending → evaluated）
5. 教师查看评分汇总/统计（沿用现有场景结果页）
6. （未来）企业成员登录 partner 平台 → "待评分测评"入口 → 跨租户评分回写

**一期范围**：`/evaluation/scene-results` 评分菜单授权给 enterprise_mentor + 任务级分配机制 + 企业账号打分闭环；毕业设计 `enterprise_score` 与导师绑定。
**演进**：partner 平台待评分入口（跨租户评分），是"企业专家通过自己平台深度参与"的标志性能力。

### 3.5 互动衔接点清单（现状 → 目标）

| # | 现状 | 目标 | 章节 |
|---|------|------|------|
| 1 | 专家档案归属学校租户，学校手工创建 | 企业租户维护，学校只读 | §3.1 |
| 2 | 岗位/场景共建人仅能选学校租户 users | 支持从已引入企业专家（绑定企业账号）中选择 | §3.3 |
| 3 | enterprise_mentor 拥有联盟全量 CRUD 与全部业务写权限 | 收窄为共建 + 打分（菜单驱动后为配置级：默认种子不勾联盟菜单） | §3.3 |
| 4 | 测评 enterprise_mentor 主体仅有声明式配置 | 任务级分配 + 评分菜单授权，形成打分闭环 | §3.4 |
| 5 | ~~`graduation_project_topics.enterprise_mentor_id` 悬空~~ | 遗留列已随 migration 154 删除，不在范围 | §3.3 |
| 6 | public 接口跨租户汇聚学校数据 | 全局企业主体 + links 双控过滤 | §3.2 |
| 7 | 学校信息两套并存（school-info / tenants） | 保持现状，文档记录，不做本期改造 | §3.2 |

---

## 4. 数据模型

> migration 编号：实际落地为 `142_partner_enterprise`（实施时原预估 139，落地后回写），必须配对 `.up.sql` / `.down.sql`。

### 4.1 `tenants` 加 `type`

```sql
ALTER TABLE tenants ADD COLUMN type varchar(16) NOT NULL DEFAULT 'school';
-- 企业租户 = 'enterprise'
```

现有逻辑不受影响（默认 school）。

### 4.2 `alliance_enterprises` → 重命名为 `partner_enterprises`（企业主体，全局唯一）

- `tenant_id` 语义改变：从"学校租户"变为"企业自己的租户"（企业注册时创建企业租户）
- **保留主体字段**：`name`、`unified_social_credit_code`、`industry`、`region`、`description`、`logo_url`、`cover_image`、`cooperation_types`、`contact_person`、`contact_phone`、`contact_email`、`address`、`established_year`、`employee_count`、`business_license_photos`、`qualification_photos`、`intellectual_property_photos`、`cover_photos`
- **新增**：`enable_public boolean NOT NULL DEFAULT false`（142 落地；150 将默认值改为 `true`——注册时默认开启。企业侧"愿意对外展示"开关，互动流程一的双控之一，企业服务台维护）
- **移除（移到 link 表）**：`enterprise_type`、`rating`、`status`、`is_public`、`secondary_colleges`、`rating_record`、`created_by`
- `name` 增加全局唯一约束（企业主体唯一）
- 重命名后 `alliance_experts.enterprise_id` 外键自动指向新表名（MySQL RENAME 行为）

### 4.3 新表 `alliance_enterprise_links`（学校-企业合作关联）

```sql
CREATE TABLE alliance_enterprise_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,             -- 学校租户
    enterprise_id UUID NOT NULL REFERENCES partner_enterprises(id) ON DELETE CASCADE,
    relation_type varchar(32) NOT NULL DEFAULT 'alliance',  -- 预留：未来扩展合作类型
    status varchar(32) NOT NULL DEFAULT 'negotiating',      -- negotiating|active|paused|terminated
    rating varchar(32) DEFAULT 'general',                   -- strategic|deep|general
    enterprise_type varchar(32) NOT NULL DEFAULT 'cooperation', -- cooperation|third-party
    is_public boolean NOT NULL DEFAULT false,   -- 学校侧"在本校前台展示"开关
    secondary_colleges jsonb DEFAULT '[]',
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, enterprise_id)
);
CREATE INDEX idx_alliance_enterprise_links_enterprise ON alliance_enterprise_links(enterprise_id);
```

学校侧管理属性（状态/评级/类型/前台展示/二级学院）全部落在 link 记录上。

### 4.4 `alliance_experts` 改造

- `tenant_id` 语义 → 企业租户（专家数据归属企业，由企业服务台维护）
- `enterprise_id` 保留 → 指向 `partner_enterprises.id`（学校端按已引入企业过滤的索引）
- **新增**：`user_id uuid`（可空，绑定企业成员账号，见 §3.1 身份映射；不建 FK，兼容旧数据与解除绑定）
- `is_public` 语义改变：从"学校决定展示"变为"企业决定该专家档案是否允许对外展示"（互动流程一的另一开关，企业服务台维护）
- 其余字段不变（学校端只读展示所需字段齐全）

### 4.5 ~~`alliance_expert_mentor_links`（专家 ↔ 学校影子账号）~~（已废弃）

> 早期设计的影子账号绑定表，已在 migration 154 中 DROP，migration 155 清理了影子账号。当前方案为专家直接绑定企业账号（`alliance_experts.user_id`），无此表。

### 4.6 账号体系（复用现有表，无新表）

| 对象 | 设计 |
|------|------|
| `users` | 企业侧：`platform='partner'`、`role='enterprise'`、`tenant_id=企业租户`；partner 平台内 username 全局唯一（注册接口应用层校验，避免影响 portal 用户） |
| `roles` | 企业租户创建时种子 `enterprise_admin`（全部企业权限）/ `enterprise_member`（只读），租户隔离不冲突 |
| `user_roles` | 复用，绑定企业角色 |

> 企业专家参与共建/打分直接使用企业侧账号（`alliance_experts.user_id` 绑定），不创建学校侧账号。

### 4.7 数据重置

TRUNCATE `partner_enterprises`（原 alliance_enterprises）、`alliance_experts` 及协议/项目/成果表（其 `enterprise_ids` 引用随之失效，开发数据整体重置）。不编写数据迁移。

### 4.8 migration 142 清单

| 文件 | 内容 |
|------|------|
| `142_partner_enterprise.up.sql` | tenants 加 type；重命名 alliance_enterprises → partner_enterprises 并删列、加 name 唯一约束、加 enable_public；建 alliance_enterprise_links；alliance_experts 加 user_id；TRUNCATE 联盟数据 |
| `142_partner_enterprise.down.sql` | 反向：删 link 表；回改名；还原列；删 type 列 |

---

## 5. API 契约

### 5.1 认证（公开路由，登录限流组）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/partner/login` | 复用统一登录流程（`ZhiyuAuthController`/`AuthServiceImpl`，platform=partner） |
| POST | `/auth/partner/register` | 公开注册：事务内创建「企业租户 + partner_enterprises 主体 + 管理员用户 + 角色种子」，直接签发 token |
| GET | `/auth/partner/me` | 用户信息 + 企业主体合并返回 |

### 5.2 partner 路由组（`/api/v1/partner/*`，`RequirePlatform('partner')`）

> 2026-08-14 审计修订：删除未实现的成员账号管理（`/partner/members` 无路由无页面）；补登资源共建/合作内容/导师任务端点（§5.7）。

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/PUT | `/partner/enterprise/profile` | 读 admin/member，写 admin | 企业主体信息维护（含 `enable_public` 展示开关） |
| GET | `/partner/experts` | 仅 admin | 专家列表 |
| GET/POST/PUT/DELETE | `/partner/experts/{id}` | 仅 admin（读/写均 admin；member 只可经 `/experts/me` 读本人档案） | 专家档案（tenant=企业租户，含 `is_public`/`user_id`） |
| GET/PUT | `/partner/experts/me` | 所有 | 专家本人档案（member 可用） |
| PUT | `/partner/me/password` | 所有（限流） | 修改密码 |
| GET | `/partner/workspace/dashboard` | 所有 | 服务台统计（专家数/合作学校数等） |
| GET | `/partner/schools` | 所有 | 合作学校列表（link 反向视图） |
| PUT | `/partner/schools/{tenantId}/status` | 仅 admin | 合作状态双向确认 |
| GET | `/partner/cooperation`、`/partner/cooperation/projects/{id}`、`/partner/cooperation/achievements/{id}`、`/partner/cooperation/agreements/{id}` | 所有 | 合作内容三合一查看 |
| GET | `/partner/mentor-tasks` | 所有 | 导师任务列表（承接的测评任务/进度） |

> **成员账号管理（`/partner/members`）未实现**：规格 F9 与早期 §5.2 曾规划，当前企业成员账号由注册时创建（企业管理员）或运营端代管（`/admin/tenants/{tenantId}/enterprise-admins`），无企业侧自助成员 CRUD 页面与接口。若需实现，按 §10 扩展机制新增。

### 5.7 资源共建端点（co-build，admin+member 均可操作）

> 审计补登（2026-08-14）：以下端点已实现但原 §5 未登记。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/partner/co-build/positions` | 共建岗位列表/新建 |
| GET | `/partner/co-build/positions/{id}` | 共建岗位详情 |
| POST | `/partner/co-build/positions/{id}/edit` | 编辑源岗位（EditSource，保存后置为草稿由学校发布） |
| PUT/DELETE | `/partner/co-build/positions/{id}` | 更新/删除 |
| POST | `/partner/co-build/positions/{id}/submit`、`/withdraw` | 提交/撤回 |
| POST | `/partner/co-build/positions/{id}/save-full` | 整单保存 |
| GET | `/partner/co-build/positions/{id}/responsibilities`、`/certificates`、`/ability-bindings`、`/ability-domains` | 岗位子资源读取 |
| GET/POST | `/partner/co-build/scenes` | 共建场景列表/新建 |
| GET | `/partner/co-build/scenes/{id}` | 场景详情 |
| POST | `/partner/co-build/scenes/{id}/edit` | 编辑源场景 |
| PUT/DELETE | `/partner/co-build/scenes/{id}` | 更新/删除 |
| POST | `/partner/co-build/scenes/{id}/submit`、`/withdraw` | 提交/撤回 |
| GET | `/partner/co-build/scenes/{id}/tasks`、`/weights` | 任务/权重读取 |
| PUT | `/partner/co-build/scenes/{id}/weights` | 权重保存 |
| POST | `/partner/co-build/scenes/{id}/tasks`、`/tasks/reorder` | 任务创建/重排 |
| PUT/DELETE | `/partner/co-build/tasks/{taskId}` | 任务更新/删除 |
| GET/PUT | `/partner/co-build/tasks/{taskId}/evaluation-methods` | 任务测评方式 |
| GET | `/partner/co-build/schools/{tenantId}/abilities`、`/evaluation-methods`、`/co-builders`、`/knowledge-points`、`/courses`、`/ability-bindings`、`/question-banks`、`/questions`、`/random-draw-questions`、`/exams`、`/majors`、`/scenarios`、`/tasks`、`/resources` | 学校数据源接入（授权内只读） |

### 5.8 就业服务端点（employment，admin+member 均可操作；人才与岗位供需服务大厅）

> 2026-08 新增（迁移 162/163）：学校发布就业项目并分配参与企业 → 企业录入岗位（独立或挂项目，挂项目且 published 才上大厅）→ 学生在大厅投递 → 企业只读查看投递。身份解析：token tenant → `partner_enterprises.id`（resolveEnterprise 同共建）。写操作校验边界：新建岗位（唯一携带 schoolTenantId 的写）前置校验学校-企业 active link；更新/删除按 enterprise_id 归属过滤（SQL 层）；publish 绑定项目时校验项目已分配本企业且与岗位同租户。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/partner/employment-projects`、`/{id}` | 分配本企业的就业项目列表/详情（`?schoolTenantId=` 按学校过滤；enterprise_ids 包含判断） |
| GET/POST | `/partner/employment-jobs` | 岗位列表（`?projectId/status` 过滤）/新建（必填 schoolTenantId；projectId 可空=独立岗位；初始 draft） |
| GET/PUT/DELETE | `/partner/employment-jobs/{id}` | 详情/更新/删除（限本企业；仅草稿可删，避免 CASCADE 清空投递） |
| POST | `/partner/employment-jobs/{id}/status` | publish（可绑定/改绑项目，校验项目已分配本企业）/ close |
| GET | `/partner/employment-jobs/{id}/applications`、`/partner/employment-applications/{id}` | 学生投递只读查看（限本企业） |

### 5.3 学校侧联盟接口改造

| 方法 | 路径 | 变更 |
|------|------|------|
| GET | `/alliance/enterprises` | 改为 link 视图（join partner_enterprises：主体信息 + link 管理字段） |
| GET | `/alliance/enterprises/search?keyword=` | 新增：全局企业池搜索（跨租户只读，供"引入"用） |
| POST | `/alliance/enterprises/{id}/link` | 新增：引入企业（创建 link 记录） |
| DELETE | `/alliance/enterprises/{id}/link` | 新增：解除引入（历史协议/项目/成果引用保留，页面不再展示） |
| GET | `/alliance/enterprises/{id}` | 合并视图：全局主体只读 + link 管理字段 + 协议/项目/成果 Tab（逻辑不变） |
| PUT | `/alliance/enterprises/{id}` | 仅更新学校侧字段（rating/status/enterprise_type/is_public/secondary_colleges） |
| POST | `/alliance/enterprises` | 无普通创建端点（学校不直接建主体）；**`POST /alliance/enterprises/register` 代注册企业保留**（学校代企业注册并建 link，前端「代注册企业」对话框） |
| GET | `/alliance/experts` | 按本校 links 企业过滤，跨租户只读；**越权校验：enterprise_id 必须属于本校 links** |
| POST/PUT/DELETE | `/alliance/experts`、`/alliance/experts/{id}` | 保留（学校侧仍维护本校可见专家档案；`PUT /alliance/experts/{id}/display` 切换前台展示） |
| GET | `/alliance/experts/mentor-options` | 新增：共建人选择器数据源（本校已引入企业的专家 + 已绑定企业账号状态），供岗位/场景共建人选择器使用 |
| GET | `/alliance/public/enterprises`、`/experts`、`/projects`、`/achievements`、`/brands`、`/stats` | 改造：数据源从学校租户数据改为「全局企业主体 + links 双控过滤」；无 tenantId 全局展示、带 tenantId 按该校 links 过滤（§3.2） |

### 5.4 测评打分支撑（互动流程三，场景任务配置）

| 方法 | 路径 | 变更 |
|------|------|------|
| POST | `/evaluation/results/{id}/grade`、`/evaluation/results/batch-grade` | 保持现有能力（实际路径为 `/evaluation/results/*`）；配合评分菜单授权（见 F16） |
| — | 任务级企业导师分配 | 新增分配机制：任务/测评配置中选定 `enterprise_mentor` 主体 → 从已绑定企业账号的专家中指定具体评分人（落地到 `task_evaluation_methods` 或新分配字段） |

### 5.5 导入接口处理

- 导入接口已迁移，可正常调整
- 联盟企业/专家不再列入导入实体白名单：泛型 `/import/{entity}` 路由保留，命中白名单外实体返回 400「不支持的实体」（效果等价移除，机制非 404）
- 前端同步移除联盟企业/专家 Excel 导入入口

### 5.6 权限与越权校验

- 企业端：`enterprise_admin` 可写（主体/专家/成员），`enterprise_member` 只读；JWT claims 携带 RoleCodes，鉴权中间件/controller 校验
- 学校端：沿用 `canManageAlliance` + `requireTenant`；专家跨租户读取必须校验企业 ID ∈ 本校 links（防越权）
- **角色收窄（互动流程二，2026-08-17 起配置级）**：`enterprise_mentor` 默认种子不勾联盟菜单即无联盟管理权限（菜单驱动 RBAC，ADR-0008；配置可覆盖）；保留业务共建（job/scene 写）+ 测评打分。影响范围：种子角色权限与联盟菜单授权（授权中间件读菜单）
- 企业专家参与共建/打分直接经企业账号（`alliance_experts.user_id`），无学校侧账号创建

---

## 6. 后端开发计划（WBS）

| # | 任务 | 文件/位置 | 测试 |
|---|------|----------|------|
| B1 | domain：`UserPlatformPartner`、partner 角色常量 | domain 常量层 | — |
| B2 | service/mapper：`AllianceEnterpriseLink` 相关 service + mapper（link CRUD、按学校/企业租户列表） | 新文件 | service/mapper 测试 |
| B3 | service/mapper：`AllianceExpertMapper` 新增按企业 ID 列表查询（跨租户只读 + 归属校验） | 改造 | service/mapper 测试 |
| B4 | service：partner 注册（建租户+企业主体+管理员+角色种子，事务） | 新 service | service 测试 |
| B5 | 认证：`/auth/partner/login`、`/auth/partner/register`、`/auth/partner/me` | 认证 controller/service | controller/service 测试 |
| B6 | partner 路由组 + controller 按域拆分（partner_auth/enterprise/expert/member） | 新 controller 文件 | controller 测试 |
| B7 | 学校侧改造：enterprises link 视图/search/link/unlink/update，移除普通 create（register 保留） | 联盟 controller/service | controller/service 测试 |
| B8 | 学校侧改造：experts 视图按已引入企业过滤 + 越权校验（写接口实际保留，见 §5.3） | 联盟 controller/service | controller/service 测试 |
| B9 | 联盟企业/专家移出导入实体白名单（泛型 `/import/{entity}` 返回 400「不支持的实体」） | 导入实体白名单 | 导入测试 |
| B10 | 互动：企业专家直接绑定机制（mentor-options 数据源返回已绑定企业账号的专家，供选择器绑定；幂等） | 新 service/mapper + controller | service/mapper + controller 测试 |
| B11 | 互动：public 接口数据源改造（全局企业 + links 双控过滤，§3.2） | 联盟 controller/service | controller/service 测试 |
| B12 | 互动：任务级企业导师分配机制（测评配置落定具体评分人） | 测评 service/mapper | service/mapper 测试 |
| B13 | 互动：`enterprise_mentor` 角色收窄（移除 canManageAlliance；种子权限移除联盟菜单） | 种子权限 | 回归测试 |
| B14 | ~~互动：毕业设计课题企业导师选择器后端~~（不在范围：`enterprise_mentor_id` 已随 migration 154 删除，见 §3.3/§4.5） | — | — |

分层约束（Java 框架契约，AGENTS.md 第二部分）：controller 不拼 SQL、不持有 DB 句柄；service 编排+事务；mapper 唯一 SQL；新接口至少一种测试。

---

## 7. 前端开发计划（WBS）

| # | 任务 | 文件/位置 |
|---|------|----------|
| F1 | api-client：AuthPlatform 加 `partner`、token key `zhiyu-partner-token`、`isPartnerPath`、`partnerRequest`、401 跳 `/partner/login` | Vue 请求层（`frontend/portal-vue/src/api/`） |
| F2 | 新增 `api/partner.ts`（auth/profile/experts/members/dashboard/schools） | 新文件 |
| F3 | `api/alliance.ts` 改造：enterpriseApi 改 list/search/link/unlink/update（移除普通 create，保留 register）；expertApi 保留 list/get/create/update/delete + display；新增 mentor-options | 改造 |
| F4 | `/partner/login`：登录 + 注册双 Tab（参考 portal/login 风格） | Vue 门户 `/partner/login` 页 |
| F5 | ~~独立 `/partner/layout` + PartnerAuthGuard~~（已按简化实现落地：partner 业务页面挂在 `PortalLayout` children，认证复用 portal 认证体系 + `RequirePlatform('partner')`；`/partner/login` 为独立登录页） | Vue 门户 `router/index.ts`（PortalLayout children） |
| F6 | `/partner/workspace`：企业服务台首页（统计卡 + 入口卡片，参考 portal/workspace 兜底布局） | 新页面 |
| F7 | `/partner/enterprise`：主体信息维护（改造自 enterprises/new 表单，去掉学校管理字段，含 enable_public 开关） | 新页面 |
| F8 | `/partner/experts/*`：列表 + 详情 + 新建/编辑（改造自现有专家页面，含 is_public 开关） | 新页面 |
| F9 | `/partner/members`：成员账号管理（仅 enterprise_admin）——**未实施**（见 §5.2 备注，当前成员由注册/运营端代管） | 新页面 |
| F10 | `/partner/schools`：合作学校列表；账号安全（改密码） | 新页面 |
| F11 | 导航：`partnerNavigationConfig`（复用菜单/权限机制） | `frontend/portal-vue/src/layouts/navigation-config.ts` |
| F12 | 学校侧 enterprises：已引入列表 + "引入企业"搜索 Dialog；保留评级/状态/前台展示管理；移除新建/编辑主体/导入入口 | 改造 |
| F13 | 学校侧 enterprises/[id]：主体只读 + 管理字段 + 协议/项目/成果 Tab 不变；移除 new/[id]/edit 页 | 改造 |
| F14 | 学校侧 experts：只读列表（企业筛选）+ 专家详情（共建导师入口已移除，共建人选专家走选择器直接勾选企业账号），移除 new/edit | 改造 |
| F15 | 互动：岗位/场景共建人选择器（UserSelector）支持"企业专家"来源（mentor-options 数据源，直接绑定企业侧账号，无影子账号） | `views/job/position-builder/UserSelector.vue`、job/scene 编辑页 |
| F16 | 互动：enterprise_mentor 评分菜单授权（种子菜单补 `/evaluation/scene-results` 等） + 任务级企业导师分配 UI（任务编辑页） | 种子权限、任务编辑组件 |
| F17 | 互动：毕业设计课题页企业导师选择（复用 mentor-options） | graduation 前端（如有页面） |

---

## 8. 部署与验证

1. migration 142（配对 `.down.sql`），部署时 `deploy.sh` 执行 `db/migrations` 迁移
2. 本地门禁：`./mvnw compile -q`；`cd frontend/portal-vue && pnpm build`；`./scripts/spec-check.sh`（见 `AGENTS.md` 4.2）
3. 分支隔离：`git worktree add -b feat/partner-平台 ...` → 开发提交 → 推送 → `./deploy.sh --branch <分支>`
4. 健康检查：`curl -sf http://127.0.0.1/health   # 经生产入口（宿主 nginx→网关→backend）；容器不再发布 8080`；部署通过后自动合并回 master

---

## 9. 实施顺序与风险

### 9.1 实施顺序

```
阶段一（平台底座）：
B1 → B2/B3/B4（service/mapper）→ B5（认证）→ B6（partner 路由组）
→ B7/B8（学校侧改造）→ B9（导入实体白名单）
→ F1/F2/F3（api-client）→ F4~F11（/partner 平台框架）
→ F12~F14（学校侧改造）→ 本地验证 → 提请部署

阶段二（互动闭环，企业平台上线后再迭代）：
B10/B11（企业账号直绑 + public 改造）→ B12（任务级分配）→ B13（角色收窄）→ B14（毕设导师）
→ F15~F17（共建选择器/评分授权/毕设）
```

> 阶段一交付核心诉求（企业注册/登录/自维护 + 学校引入/只读 + 联盟展示数据源切换），阶段二交付深度互动（共建/打分闭环）。每阶段独立部署验证。

### 9.2 风险点

| 风险 | 应对 |
|------|------|
| 跨租户越权（学校读企业专家） | 数据访问层强制校验 enterprise_id ∈ 本校 links |
| 导入文件 | 导入接口可调整；移除路由注册与前端入口 |
| 解除引入后历史引用 | 协议/项目/成果引用保留，页面不再展示，文档说明 |
| partner 用户名唯一性 | 注册接口应用层校验 partner 平台全局唯一（现有唯一约束是租户级，不动） |
| PUT 全列覆盖语义 | 学校侧企业更新改为专用 controller/service 方法（仅 link 管理字段），不复用通用更新兜底 |
| enterprise_mentor 角色收窄引发回归 | B13 单独提交并跑联盟/岗位/场景/测评回归测试；已绑定的旧账号权限随角色权限变更即时生效（权限存 roles.permissions） |
| public 接口语义变化 | 前台展示从"跨租户汇聚"变为"全局企业+双控过滤"，前端展示页（portal/alliance/*）同步适配，避免出现空数据 |

---

## 10. 扩展性预留

| 场景 | 预留机制 |
|------|----------|
| 企业平台新增模块（项目/活动/岗位/课程等） | 均为 `partner_*` 表 + Java `Partner*Controller` 加端点 + Service/Mapper 按域加文件 + `partnerNavigationConfig` 加菜单，与 portal 扩展流程同构 |
| 企业角色扩展 | roles 表支持企业租户自定义角色/权限（复用现有机制，本期仅种子两个默认角色） |
| 合作类型扩展 | link 表 `relation_type` 预留（如校企共建/基地合作），无需改表结构 |
| 资源分享机制泛化 | 专家跨租户只读模式可泛化为"企业资源对合作学校共享"通用机制 |
| 企业成员登录 partner 平台参与测评打分 | 待评分入口（跨租户评分），与 F16 的评分授权共用评价结果表，按 evaluator 归属路由到 partner 侧 |
| 企业注册审核 | 如未来需要审核，可在注册流程加审核态（users.status/institutions.status 已存在），当前注册即生效 |
| 企业侧更多展示形态 | `enable_public` 双控开关可扩展为细粒度（按品牌/专家/成果分别开关） |
