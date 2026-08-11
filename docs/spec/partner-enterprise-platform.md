# 企业平台（Partner）规格文档 — 知与 SaaS

> 二期规格：企业服务台 / Partner 平台（与 Portal 学校平台平级）。
> 状态：方案设计完成，待实施。含三大校企互动流程（联盟展示/岗位场景共建/测评打分）完整分析。

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
| 前端路由段 | `/portal/*`，独立 login/layout/Guard | `/partner/*`，独立 login/layout/Guard |
| Token key | `zhiyu-portal-token` | `zhiyu-partner-token` |
| API 前缀 | `/api/v1` + `RequirePlatform('portal')` | `/api/v1/partner/*` + `RequirePlatform('partner')`（新路由文件 `routes_partner.go`） |
| 角色/权限 | roles + user_roles + permissions + 菜单权限 | 企业租户内种子角色 `enterprise_admin` / `enterprise_member`，复用同一套机制 |
| 导航菜单 | `lib/navigation-config.ts` | `partnerNavigationConfig`（未来加功能 = 加菜单 + 加页面） |
| 跨平台合作 | — | 合作关联表（学校租户 × 企业租户） |

### 2.2 核心决策（已确认）

1. **企业 = 全局独立实体**：一个企业可被多个学校"引入"，企业主体全局唯一
2. **自助注册即生效**：注册无需审核，学校侧"引入"即建立合作关系
3. **专家数据存企业侧**：企业服务台维护，学校端只读、按已引入企业自动加载
4. **账号体系**：注册时创建企业管理员账号（`enterprise_admin`），管理员可在服务台添加成员账号（`enterprise_member`）
5. **前端形态**：同一 Next.js 应用（apps/edu）内新增 `/partner` 路由段，复用现有组件与 api-client
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
| 协作影子账号 `users`（platform=portal, role=school，业务角色 enterprise_mentor 经 user_roles 关联） | 学校租户 | 学校侧可被业务表引用的身份（现有岗位共建人/场景共建人/评分人/授课教师均引用 `users.id`） |

**绑定关系（迁移为正式字段）**：
- `alliance_experts.user_id`（新增，可空）：专家档案 ↔ 企业成员账号。成员登录后可在"我的档案"认领自己的专家档案，认领后由本人维护
- `alliance_expert_mentor_links`（新表）：专家档案 ↔ 学校租户影子账号
  ```
  id, tenant_id(学校), expert_id, user_id(影子账号),
  enabled boolean DEFAULT true, created_by, created_at,
  UNIQUE (tenant_id, expert_id)   -- 防重复启用
  ```
  学校"启用专家为共建导师"时创建；一个专家可被多个学校分别启用（各自影子账号），同校不重复

**演进方向**：影子账号是过渡方案（业务表零改动）；目标态为业务引用直接指向 partner 侧实体（跨租户引用），绑定表保留 expert_id ↔ 账号关系以便未来平滑迁移。

### 3.2 互动流程一：产业联盟展示使用

**参与者**：企业（主体信息+专家维护方）、学校（link 管理方）、门户访客（`/portal/alliance/*` 前台展示页）

**现状**：
- `/api/v1/alliance/public/*`（GET，挂在 jobViewer 组，需 portal JWT + 角色，**非匿名**）
- `is_public` 由学校维护；store 层查询**完全不按租户过滤**，所有学校的公开数据跨租户汇聚展示
- 前台页面：`landing`（学校信息卡 + 统计卡 + 企业/项目/成果/专家区块 + 品牌 Tab）、各列表页/详情页（public-cards.tsx）

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
- 毕业设计：`graduation_project_topics.enterprise_mentor_id`（**无 FK、无角色校验、前端未使用**，当前是悬空引用）
- `enterprise_mentor` 角色权限过宽：businessUser 组全写权限 + `canManageAlliance`（联盟全量 CRUD）

**目标流程**：
1. 企业维护专家档案，可选绑定企业成员账号（3.1）
2. 学校引入企业 → 专家只读可见（`GET /alliance/experts`）
3. 学校在岗位/场景共建人选择器中选"企业专家"（新数据源：已引入企业的专家）→ 后端按绑定表启用/创建影子账号（username 规范化如 `em_{企业code}_{专家ID前8位}`，`UNIQUE(tenant_id, expert_id)` 防重复）→ 岗位 `collaborators` / 场景 `co_builder_ids` 写入影子账号 id
4. 企业导师影子账号可登录 portal 参与共建（岗位/场景编辑）、被排课（teacher_type=企业导师）
5. 毕业设计课题正式选择企业导师（复用选择器，修复悬空引用）

**权限收窄（重要）**：移除 `enterprise_mentor` 的 `canManageAlliance` 全量权限，联盟管理归 `school_admin`/`teacher`；保留共建（job/scene 写）+ 测评打分。
**一期范围**：共建人选择器支持"企业专家"来源 + 影子账号启用机制 + 毕业设计导师选择 + 权限收窄。
**演进**：跨租户引用模式（业务表直接引用 partner 侧用户/专家 ID）。

### 3.4 互动流程三：企业专家参与学生测评打分

**现状**：
- 测评配置：`task_evaluation_methods.eval_subjects` 支持 `enterprise_mentor` 主体（声明式，含领域/年限/人数/权重参数）；`task_review_steps.subject_type='enterprise_mentor'` 支持复审步骤
- 打分 API 层开放（businessUser 组可 grade/batch-grade，仅同租户校验），**但 enterprise_mentor 种子菜单不含 `/evaluation/*`，前端看不到评分页**
- 学生提交测评可指定 `evaluatorId`（仅同租户校验，无角色校验）
- **缺失**：任务级企业导师分配机制（当前只有配置层面的声明，无实际把人分配到位）

**目标流程**：
1. 教师在场景任务配置评价方法：主体 `enterprise_mentor` + 权重 + 人数（沿用现有 evaluation-rules-editor 配置器）
2. 任务级分配：教师从"已引入企业的专家（已启用影子账号）"中选择评分人（新分配机制，落地到任务/测评配置）
3. 学生完成任务提交测评（`evaluator_id`=影子账号，`evaluator_type=enterprise_mentor`）
4. 企业导师登录（影子账号）→ 评分页 → 打分 → 结果回写（status: pending → evaluated）
5. 教师查看评分汇总/统计（沿用现有场景结果页）
6. （未来）企业成员登录 partner 平台 → "待评分测评"入口 → 跨租户评分回写

**一期范围**：`/evaluation/scene-results` 评分菜单授权给 enterprise_mentor + 任务级分配机制 + 影子账号打分闭环；毕业设计 `enterprise_score` 与导师绑定。
**演进**：partner 平台待评分入口（跨租户评分），是"企业专家通过自己平台深度参与"的标志性能力。

### 3.5 互动衔接点清单（现状 → 目标）

| # | 现状 | 目标 | 章节 |
|---|------|------|------|
| 1 | 专家档案归属学校租户，学校手工创建 | 企业租户维护，学校只读 | §3.1 |
| 2 | 岗位/场景共建人仅能选学校租户 users | 支持从已引入企业专家启用影子账号 | §3.3 |
| 3 | enterprise_mentor 拥有联盟全量 CRUD 与全部业务写权限 | 收窄为共建 + 打分 | §3.3 |
| 4 | 测评 enterprise_mentor 主体仅有声明式配置 | 任务级分配 + 评分菜单授权，形成打分闭环 | §3.4 |
| 5 | `graduation_project_topics.enterprise_mentor_id` 悬空 | 正式选择器 + 绑定 | §3.3 |
| 6 | public 接口跨租户汇聚学校数据 | 全局企业主体 + links 双控过滤 | §3.2 |
| 7 | 学校信息两套并存（school-info / tenants） | 保持现状，文档记录，不做本期改造 | §3.2 |

---

## 4. 数据模型

> migration 编号：`139_partner_enterprise`（当前最大为 138，实施时以实际为准），必须配对 `.up.sql` / `.down.sql`。

### 4.1 `tenants` 加 `type`

```sql
ALTER TABLE tenants ADD COLUMN type varchar(16) NOT NULL DEFAULT 'school';
-- 企业租户 = 'enterprise'
```

现有逻辑不受影响（默认 school）。

### 4.2 `alliance_enterprises` → 重命名为 `partner_enterprises`（企业主体，全局唯一）

- `tenant_id` 语义改变：从"学校租户"变为"企业自己的租户"（企业注册时创建企业租户）
- **保留主体字段**：`name`、`unified_social_credit_code`、`industry`、`region`、`description`、`logo_url`、`cover_image`、`cooperation_types`、`contact_person`、`contact_phone`、`contact_email`、`address`、`established_year`、`employee_count`、`business_license_photos`、`qualification_photos`、`intellectual_property_photos`、`cover_photos`
- **新增**：`enable_public boolean NOT NULL DEFAULT true`（企业侧"愿意对外展示"开关，互动流程一的双控之一，企业服务台维护；注册时默认开启）
- **移除（移到 link 表）**：`enterprise_type`、`rating`、`status`、`is_public`、`secondary_colleges`、`rating_record`、`created_by`
- `name` 增加全局唯一约束（企业主体唯一）
- 重命名后 `alliance_experts.enterprise_id` 外键自动指向新表名（PostgreSQL RENAME 行为）

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

### 4.5 新表 `alliance_expert_mentor_links`（专家 ↔ 学校影子账号）

```sql
CREATE TABLE alliance_expert_mentor_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,                 -- 学校租户
    expert_id UUID NOT NULL REFERENCES alliance_experts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,                   -- 学校租户内 enterprise_mentor 影子账号 users.id
    enabled boolean NOT NULL DEFAULT true,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, expert_id)            -- 同校不重复启用
);
CREATE INDEX idx_expert_mentor_links_tenant ON alliance_expert_mentor_links(tenant_id);
```

支撑互动流程二/三：学校"启用专家为共建导师"时创建影子账号并登记；未来跨租户引用模式迁移的依据。

### 4.6 账号体系（复用现有表，无新表）

| 对象 | 设计 |
|------|------|
| `users` | 企业侧：`platform='partner'`、`role='enterprise'`、`tenant_id=企业租户`；partner 平台内 username 全局唯一（注册接口应用层校验，避免影响 portal 用户） |
| `users` | 学校侧：`platform='portal'`、`role='school'`（学校租户内统一 school，与现有 teacher/student 一致）、业务角色 `enterprise_mentor` 经 user_roles 关联（影子账号） |
| `roles` | 企业租户创建时种子 `enterprise_admin`（全部企业权限）/ `enterprise_member`（只读），租户隔离不冲突 |
| `user_roles` | 复用，绑定企业角色 |

### 4.7 数据重置

TRUNCATE `partner_enterprises`（原 alliance_enterprises）、`alliance_experts`、`alliance_expert_mentor_links` 及协议/项目/成果表（其 `enterprise_ids` 引用随之失效，开发数据整体重置）。不编写数据迁移。

### 4.8 migration 139 清单

| 文件 | 内容 |
|------|------|
| `139_partner_enterprise.up.sql` | tenants 加 type；重命名 alliance_enterprises → partner_enterprises 并删列、加 name 唯一约束、加 enable_public；建 alliance_enterprise_links；alliance_experts 加 user_id；建 alliance_expert_mentor_links；TRUNCATE 联盟数据 |
| `139_partner_enterprise.down.sql` | 反向：删 mentor_links/link 表；回改名；还原列；删 type 列 |

---

## 5. API 契约

### 5.1 认证（公开路由，登录限流组）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/partner/login` | 复用 `loginWithPlatform` 流程（platform=partner） |
| POST | `/auth/partner/register` | 公开注册：事务内创建「企业租户 + partner_enterprises 主体 + 管理员用户 + 角色种子」，直接签发 token |
| GET | `/auth/partner/me` | 用户信息 + 企业主体合并返回 |

### 5.2 partner 路由组（`/api/v1/partner/*`，`RequirePlatform('partner')`，新文件 `routes_partner.go`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/PUT | `/partner/enterprise/profile` | admin/member | 企业主体信息维护（含 `enable_public` 展示开关） |
| GET/POST/PUT/DELETE | `/partner/experts`、`/partner/experts/{id}` | 写操作 admin，读 admin/member | 专家 CRUD（tenant=企业租户，含 `is_public`/`user_id`） |
| GET/POST/PUT/DELETE | `/partner/members`、`/partner/members/{id}` | 仅 enterprise_admin | 成员账号管理 |
| PUT | `/partner/me/password` | 所有 | 修改密码 |
| GET | `/partner/workspace/dashboard` | 所有 | 服务台统计（专家数/合作学校数等） |
| GET | `/partner/schools` | 所有 | 合作学校列表（link 反向视图） |

### 5.3 学校侧联盟接口改造（`alliance_handler.go` / `alliance_crud_handler.go`）

| 方法 | 路径 | 变更 |
|------|------|------|
| GET | `/alliance/enterprises` | 改为 link 视图（join partner_enterprises：主体信息 + link 管理字段） |
| GET | `/alliance/enterprises/search?keyword=` | 新增：全局企业池搜索（跨租户只读，供"引入"用） |
| POST | `/alliance/enterprises/{id}/link` | 新增：引入企业（创建 link 记录） |
| DELETE | `/alliance/enterprises/{id}/link` | 新增：解除引入（历史协议/项目/成果引用保留，页面不再展示） |
| GET | `/alliance/enterprises/{id}` | 合并视图：全局主体只读 + link 管理字段 + 协议/项目/成果 Tab（逻辑不变） |
| PUT | `/alliance/enterprises/{id}` | 仅更新学校侧字段（rating/status/enterprise_type/is_public/secondary_colleges） |
| POST | `/alliance/enterprises` | **移除**（学校不再创建企业） |
| GET | `/alliance/experts` | 按本校 links 企业过滤，跨租户只读；**越权校验：enterprise_id 必须属于本校 links** |
| POST/PUT/DELETE | `/alliance/experts`、`/alliance/experts/{id}` | **移除**（学校不再维护专家） |
| POST | `/alliance/experts/{id}/mentor-link` | 新增（互动流程二/三）：启用专家为共建导师（创建影子账号 + 登记 mentor_links，幂等） |
| DELETE | `/alliance/experts/{id}/mentor-link` | 新增：停用/删除影子账号绑定 |
| GET | `/alliance/experts/mentor-options` | 新增：共建人选择器数据源（本校已引入企业的专家 + 启用状态），供岗位/场景共建人选择器使用 |
| GET | `/alliance/public/enterprises`、`/experts`、`/projects`、`/achievements`、`/brands`、`/stats` | 改造：数据源从学校租户数据改为「全局企业主体 + links 双控过滤」；无 tenantId 全局展示、带 tenantId 按该校 links 过滤（§3.2） |

### 5.4 测评打分支撑（互动流程三，`evaluation_result_handler.go` / 场景任务配置）

| 方法 | 路径 | 变更 |
|------|------|------|
| PUT | `/evaluation/scene-results/{id}/grade`、`/batch-grade` | 保持现有能力；配合评分菜单授权（见 F16） |
| — | 任务级企业导师分配 | 新增分配机制：任务/测评配置中选定 `enterprise_mentor` 主体 → 从已启用影子账号中指定具体评分人（落地到 `task_evaluation_methods` 或新分配字段） |

### 5.5 导入接口处理

- `resource_import_handler.go` 已迁移，可正常调整
- 在 routes.go 移除 `/import/alliance-enterprises*`、`/import/alliance-experts*` 路由注册，接口 404 即失效
- 前端同步移除联盟企业/专家 Excel 导入入口

### 5.6 权限与越权校验

- 企业端：`enterprise_admin` 可写（主体/专家/成员），`enterprise_member` 只读；JWT claims 携带 RoleCodes，handler 校验
- 学校端：沿用 `canManageAlliance` + `requireTenant`；专家跨租户读取必须校验企业 ID ∈ 本校 links（防越权）
- **角色收窄（互动流程二）**：`enterprise_mentor` 移除 `canManageAlliance` 权限，联盟管理归 `school_admin`/`teacher`；保留业务共建（job/scene 写）+ 测评打分；影响范围：`handler/common.go:205-217` 与种子角色权限（`store/tenants.go:490-497`）
- 影子账号创建：仅学校租户可发起（`canManageAlliance`），服务端生成初始密码，学校侧可重置（沿用现有用户管理）

---

## 6. 后端开发计划（WBS）

| # | 任务 | 文件/位置 | 测试 |
|---|------|----------|------|
| B1 | domain：`UserPlatformPartner`、partner 角色常量 | `internal/domain/models.go` | — |
| B2 | store：`alliance_enterprise_link_store.go`（link CRUD、ListBySchoolTenant、ListByEnterpriseTenant） | 新文件 | store 测试 |
| B3 | store：`alliance_expert_store.go` 新增 `ListByEnterpriseIDs`（跨租户只读+归属校验） | 改造 | store 测试 |
| B4 | store/service：partner 注册（建租户+企业主体+管理员+角色种子，事务） | 新 `partner_*_store.go` + service | handler 测试 |
| B5 | 认证：`/auth/partner/login`、`/auth/partner/register`、`/auth/partner/me` | `auth_handler.go` | handler 测试 |
| B6 | partner 路由组 + handler 按域拆分（`partner_auth/enterprise/expert/member_handler.go`） | 新 `routes_partner.go` + 新 handler 文件 | handler 测试 |
| B7 | 学校侧改造：enterprises link 视图/search/link/unlink/update，移除 create | `alliance_handler.go`、`alliance_crud_handler.go` | handler 测试 |
| B8 | 学校侧改造：experts 只读 + 越权校验，移除写接口 | 同上 | handler 测试 |
| B9 | 移除 `/import/alliance-enterprises*`、`/import/alliance-experts*` 路由注册 | `routes.go` | — |
| B10 | 互动：影子账号启用机制（mentor-link 接口：创建 enterprise_mentor 账号 + mentor_links 登记，幂等；mentor-options 数据源） | 新 store/handler | store + handler 测试 |
| B11 | 互动：public 接口数据源改造（全局企业 + links 双控过滤，§3.2） | `alliance_handler.go` | handler 测试 |
| B12 | 互动：任务级企业导师分配机制（测评配置落定具体评分人） | `evaluation_*_handler.go`/store | handler 测试 |
| B13 | 互动：`enterprise_mentor` 角色收窄（移除 canManageAlliance；种子权限移除联盟菜单） | `common.go`、`store/tenants.go` 种子 | 回归测试 |
| B14 | 互动：毕业设计课题企业导师选择器后端（校验 mentor-link 关系） | `graduation_handler.go` | handler 测试 |

分层约束：handler 不拼 SQL、不持有 `*pgxpool.Pool`；service 编排+事务；store 唯一 SQL；500 统一 `respondServerError`；新接口至少一种测试。

---

## 7. 前端开发计划（WBS）

| # | 任务 | 文件/位置 |
|---|------|----------|
| F1 | api-client：AuthPlatform 加 `partner`、token key `zhiyu-partner-token`、`isPartnerPath`、`partnerRequest`、401 跳 `/partner/login` | `packages/api-client/src/api-helpers.ts` |
| F2 | 新增 `api/partner.ts`（auth/profile/experts/members/dashboard/schools） | 新文件 |
| F3 | `api/alliance.ts` 改造：enterpriseApi 改 list/search/link/unlink/update（移除 create）；expertApi 仅 list/get；新增 mentor-link/mentor-options | 改造 |
| F4 | `/partner/login`：登录 + 注册双 Tab（参考 portal/login 风格） | `apps/edu/app/partner/login/page.tsx` |
| F5 | `/partner/layout`：PartnerAuthGuard（token + platform=partner）+ 独立侧栏 | `apps/edu/app/partner/layout.tsx` |
| F6 | `/partner/workspace`：企业服务台首页（统计卡 + 入口卡片，参考 portal/workspace 兜底布局） | 新页面 |
| F7 | `/partner/enterprise`：主体信息维护（改造自 enterprises/new 表单，去掉学校管理字段，含 enable_public 开关） | 新页面 |
| F8 | `/partner/experts/*`：列表 + 详情 + 新建/编辑（改造自现有专家页面，含 is_public 开关） | 新页面 |
| F9 | `/partner/members`：成员账号管理（仅 enterprise_admin） | 新页面 |
| F10 | `/partner/schools`：合作学校列表；账号安全（改密码） | 新页面 |
| F11 | 导航：`partnerNavigationConfig`（复用菜单/权限机制） | `lib/navigation-config.ts` |
| F12 | 学校侧 enterprises：已引入列表 + "引入企业"搜索 Dialog；保留评级/状态/前台展示管理；移除新建/编辑主体/导入入口 | 改造 |
| F13 | 学校侧 enterprises/[id]：主体只读 + 管理字段 + 协议/项目/成果 Tab 不变；移除 new/[id]/edit 页 | 改造 |
| F14 | 学校侧 experts：只读列表（企业筛选）+ 专家详情"启用为共建导师"操作（mentor-link），移除 new/edit | 改造 |
| F15 | 互动：岗位/场景共建人选择器（UserSelector）支持"企业专家"来源（mentor-options 数据源 + 已启用标识） | `components/shared/user-selector.tsx`、job/scene 编辑页 |
| F16 | 互动：enterprise_mentor 评分菜单授权（种子菜单补 `/evaluation/scene-results` 等） + 任务级企业导师分配 UI（任务编辑页） | 种子权限、任务编辑组件 |
| F17 | 互动：毕业设计课题页企业导师选择（复用 mentor-options） | graduation 前端（如有页面） |

---

## 8. 部署与验证

1. migration 139（配对 `.down.sql`），部署时 `go run ./cmd/migrate/main.go up`
2. 本地门禁：`cd backend && go vet ./... && go build ./... && gofmt -l .`；`pnpm typecheck && pnpm lint`
3. 分支隔离：`git worktree add -b feat/partner-平台 ...` → 开发提交 → 推送 → `./deploy.sh --branch <分支>`
4. 健康检查：`curl -sf http://127.0.0.1:8080/health`；部署通过后自动合并回 master

---

## 9. 实施顺序与风险

### 9.1 实施顺序

```
阶段一（平台底座）：
B1 → B2/B3/B4（store）→ B5（认证）→ B6（partner 路由组）
→ B7/B8（学校侧改造）→ B9（导入路由移除）
→ F1/F2/F3（api-client）→ F4~F11（/partner 平台框架）
→ F12~F14（学校侧改造）→ 本地验证 → 提请部署

阶段二（互动闭环，企业平台上线后再迭代）：
B10/B11（影子账号 + public 改造）→ B12（任务级分配）→ B13（角色收窄）→ B14（毕设导师）
→ F15~F17（共建选择器/评分授权/毕设）
```

> 阶段一交付核心诉求（企业注册/登录/自维护 + 学校引入/只读 + 联盟展示数据源切换），阶段二交付深度互动（共建/打分闭环）。每阶段独立部署验证。

### 9.2 风险点

| 风险 | 应对 |
|------|------|
| 跨租户越权（学校读企业专家） | store 层强制校验 enterprise_id ∈ 本校 links |
| 导入文件 | `resource_import_handler.go` 可调整；移除路由注册与前端入口 |
| 解除引入后历史引用 | 协议/项目/成果引用保留，页面不再展示，文档说明 |
| partner 用户名唯一性 | 注册接口应用层校验 partner 平台全局唯一（现有唯一约束是租户级，不动） |
| PUT 全列覆盖语义 | 学校侧企业更新改为专用 handler（仅 link 管理字段），不复用 `ValidateUpdateExisting` 兜底 |
| enterprise_mentor 角色收窄引发回归 | B13 单独提交并跑联盟/岗位/场景/测评回归测试；已绑定的旧账号权限随角色权限变更即时生效（权限存 roles.permissions） |
| 影子账号双头管理 | 账号生命周期（启用/停用/密码重置）由学校侧负责；企业侧仅维护专家档案（user_id 绑定），文档写明职责边界 |
| public 接口语义变化 | 前台展示从"跨租户汇聚"变为"全局企业+双控过滤"，前端展示页（portal/alliance/*）同步适配，避免出现空数据 |

---

## 10. 扩展性预留

| 场景 | 预留机制 |
|------|----------|
| 企业平台新增模块（项目/活动/岗位/课程等） | 均为 `partner_*` 表 + `routes_partner.go` 加路由 + handler 按域加文件 + `partnerNavigationConfig` 加菜单，与 portal 扩展流程同构 |
| 企业角色扩展 | roles 表支持企业租户自定义角色/权限（复用现有机制，本期仅种子两个默认角色） |
| 合作类型扩展 | link 表 `relation_type` 预留（如校企共建/基地合作），无需改表结构 |
| 资源分享机制泛化 | 专家跨租户只读模式可泛化为"企业资源对合作学校共享"通用机制（mentor_links 是其第一个实例） |
| 跨租户引用迁移 | 影子账号模式过渡后，mentor_links 保留 expert_id ↔ user_id 关系，可平滑迁移为业务表直接引用 partner 侧 |
| 企业成员登录 partner 平台参与测评打分 | 待评分入口（跨租户评分），与 F16 的评分授权共用评价结果表，按 evaluator 归属路由到 partner 侧 |
| 企业注册审核 | 如未来需要审核，可在注册流程加审核态（users.status/institutions.status 已存在），当前注册即生效 |
| 企业侧更多展示形态 | `enable_public` 双控开关可扩展为细粒度（按品牌/专家/成果分别开关） |
