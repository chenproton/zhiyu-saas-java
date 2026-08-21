# 产品需求文档（PRD）— 知与 SaaS

> 本文档基于现有代码实现回溯整理，作为「规格先行」模式的基础文档。
> 适用范围：`zhiyu-saas` 一期已实现范围。本文档记录系统当前实际能力与设计意图，供后续迭代与需求管理使用。

---

## 1. 背景与目标

### 1.1 为什么要做

职业教育与产教融合场景下，学校（职业院校/应用型本科）普遍面临以下痛点：

| 痛点 | 现状 | 平台价值 |
|------|------|---------|
| 人才培养与产业岗位脱节 | 课程体系由学科逻辑驱动，不指向具体岗位能力 | 岗位能力建模先行（岗位→职责→能力点），课程/场景/测评全部回挂能力点 |
| 学生能力无数据沉淀 | 成绩单只有分数，无法证明"胜任某岗位" | 课程/节点/场景多级评价结果统一汇入岗位能力汇聚，形成能力画像与档案（**临时边界**：当前汇聚仅用场景任务） |
| 教学资源建设零散 | 资源散落，不可复用、不可评估 | 统一资源库（11 类资源）+ 知识点/能力点双索引 + 评价量规复用 |
| 校企合作管理靠手工 | 企业、协议、项目、成果、专家信息分散，无台账 | 联盟管理平台，全主体台账 + 合作字典 + 品牌运营 |
| 教务排课靠人工冲突 | 场地/教师/班级冲突频繁返工 | 教学计划→自动排课→冲突检测（409 提示三类冲突） |

### 1.2 产品定位

**知与（zhiyu）** 是面向职业教育/产教融合场景的一体化 SaaS 平台，覆盖从**岗位能力建模 → 场景/课程资源建设 → 学生评测认证 → 教务排课 → 毕业认定**的完整育人闭环。SaaS 多租户，一行一校（或一企业），按订阅套餐开通功能模块。

### 1.3 成功指标（建议量化）

| 指标 | 目标（建议值） | 数据来源 |
|------|---------------|---------|
| 租户开通全流程时长 | ≤ 5 分钟（超管一键建租户+管理员） | `/admin/tenants` |
| 内容建设效率 | 岗位/场景/课程/题库支持 Excel 批量导入，单批 10 分钟内完成 | import 接口（10min 长超时） |
| 内容发布审批闭环 | 从提交到发布的审批全链路可达 | content 状态机 + approval_records |
| 学生评价覆盖 | 学生可完成节点作业/测验/场景任务/考试/现场问答等多种测评 | evaluation 模块 |
| 系统可用性 | 健康检查通过率 ≥ 99.9%，登录限流保护 | `/health`、登录限流 |

---

## 2. 范围界定

### 2.1 本期已实现功能（11 个平台模块）

| 模块 ID | 模块名 | 系统 | 说明 |
|---------|--------|------|------|
| system | 系统管理 | portal | 租户信息、订阅套餐、组织架构、账户、角色权限、基础字典、审计日志 |
| career | 职业岗位学习平台 | job | 岗位库、能力模型、岗位推荐、学习路径、批次/审批 |
| scene | 实践场景学习平台 | scene | 场景任务链、评价量规、等级映射、批次/审批 |
| course | 数字课程服务平台 | lesson | 体系课/颗粒课/混合课、节点（作业/测验/资源）、课堂行为 |
| ability | 能力评价与测评资源管理平台 | evaluation | 题库/试卷/考试、认证规则、能力画像、成绩申诉 |
| resource | 教学资源共享服务平台 | library | 资源库、知识点/能力点/证书库、现场问答题库 |
| affairs | 教务管理服务平台 | affairs | 学期、人培方案、教学计划、排课、批次/审批 |
| alliance | 产教融合与就业服务平台 | portal/alliance | 校企合作台账、品牌运营、对外展示落地页 |
| opc | OPC专区 | — | 占位 |
| decision | 敏捷决策中心 | — | 占位 |
| research | 教科研服务中心 | — | 占位 |

另含：**门户/工作台**（portal：登录、应用中心、我的服务台）、**SaaS 超管控制台**（superadmin：租户 CRUD + 订阅套餐开关）、**企业平台 Partner**（企业管理员/成员/专家、资源共建/就业服务/联盟公开，完整规格见 [`partner-enterprise-platform.md`](partner-enterprise-platform.md)）。

> 模块口径：上表 11 个为前端 `PLATFORM_MODULES` 业务模块（无 ai——AI 功能已于 2026-08 随单栈迁移整体下线）；后端默认订阅套餐另含 `ai` 模块条目，属历史遗留、无实际功能。

### 2.2 明确不做（一期范围外）

- **商城 marketplace**：`apps/marketplace`（React 时代）源码已随单栈迁移移除；`institutions/orders/withdrawals` 等商城表保留但无业务接口支撑；门户首页卡片墙仍渲染「产教资源中心」(mall) 卡片（无路由、恒锁定）
- **短信/微信登录**：前端登录页为单卡片账号密码登录（无短信/微信 Tab）
- **OPC 专区、敏捷决策中心、教科研服务**：门户首页与应用中心渲染锁定态入口卡片，无页面无接口
- **平台地址/跳转配置**：`platform_links`/`app_modules` 表已删除（迁移 110），固定地址收敛到前端配置
- **跨租户数据访问**：平台管理员无跨租户读取特权（明确的产品边界，防止数据泄露）
- **课程/节点作业提交与批改**：数据表已建但无接口与页面（休眠）
- **毕业设计与毕业资格查询**：数据表已建但无接口与页面（休眠）；**微证书发放**：同（表已建、无路由）

---

## 3. 用户故事

角色定义：`platform_admin`（平台运营）、`school_admin`（学校管理员）、`teacher`（教师）、`student`（学生）、`enterprise_mentor`（企业导师）。

### 3.1 系统与租户

| # | 用户故事 | 验收标准（AC） |
|---|---------|---------------|
| S-1 | 作为 platform_admin，我希望一键创建租户并生成管理员账号，以便学校快速开通 | 创建租户时自动生成订阅包（默认 5 模块）、5 个组织类型、4 个默认角色、1 个管理员（随机密码仅返回一次）；租户可禁用/启用/删除 |
| S-2 | 作为 platform_admin，我希望开关租户的订阅模块，以便控制功能边界 | 订阅包 modules JSON 增删后，租户用户仅可访问已订阅模块 |
| S-3 | 作为 school_admin，我希望维护组织树（学校→院系→专业→班级），以便按组织管理用户 | 组织树递归创建，禁止成环（循环引用 409）；用户归属组织节点 |

### 3.2 岗位能力（career）

| # | 用户故事 | 验收标准（AC） |
|---|---------|---------------|
| J-1 | 作为 teacher，我希望按"岗位→职责→能力点"建模岗位，以便课程设计有据可依 | 岗位草稿可编辑；职责可排序；能力点绑定带权重（0-100）与达标等级；同一租户内岗位 code 唯一 |
| J-2 | 作为 teacher，我希望岗位经审批后发布，以便对外展示 | 内容 6 状态机：draft→pending→approved→rejected→published→archived；只有 published 进入公开列表（未发布岗位可通过详情预览接口访问） |
| J-3 | 作为 student，我希望浏览公开岗位并按需收藏，以便规划职业方向 | 公开列表 2min 缓存；收藏仅本人可见 |
| J-4 | 作为 teacher，我希望从 Excel 批量导入岗位，以便快速建库 | 支持导入预览（错误行提示）与正式导入；同名岗位提示重复 |

### 3.3 场景实训（scene）

| # | 用户故事 | 验收标准（AC） |
|---|---------|---------------|
| SC-1 | 作为 teacher，我希望编排场景任务链（依赖/难度/权重），以便还原产业流程 | 任务支持依赖关系（dependency_ids）、难度 1-5、权重 0-100 校验；任务重排接口 |
| SC-2 | 作为 teacher，我希望为任务配置评价方式与量规，以便统一评分口径 | 评价方式（method_key）任务内唯一；量规评分点（task_eval_points）+ 评审步骤 + 评分规则；模板可复用（软删除） |
| SC-3 | 作为 student，我希望按场景任务链提交交付物并看到评分，以便完成实训 | 学生提交任务交付物 → 教师评分 → 结果写入 scene_evaluation_results 并汇入能力 |

### 3.4 课程教学（course）

| # | 用户故事 | 验收标准（AC） |
|---|---------|---------------|
| C-1 | 作为 teacher，我希望建设体系课（课程→节点树），以便结构化组织教学内容 | 节点树形（parent_id），支持测验（8 个子接口）、资源绑定；作业提交/批改接口休眠（数据表已建、无接口无页面，见注） |
| C-2 | 作为 student，我希望完成节点测验/作业并查看成绩，以便检验学习效果 | 测验/现场问答可完成并查看成绩；节点作业提交/批改休眠（见注）；(homework, student) 唯一约束防重复提交 |
| C-3 | 作为 teacher，我希望记录课堂行为（考勤/抢答/表扬），以便过程性评价 | behavior-collection 记录打卡；（course, student, date）唯一；支持聚合查询 |
| C-4 | 作为 school_admin，我希望课程经批次发布与审批流控制，以便管控上线节奏 | 批次 open/closed；课程绑定批次；审批流（workflows + approval_records）推进状态 |

> 注：C-1/C-2 中的课程/节点作业提交与批改接口尚未实现，数据表已建但休眠（无接口无页面），见 `docs/resource-snapshot-versioning.md` §8.7。

### 3.5 测评认证（ability）

| # | 用户故事 | 验收标准（AC） |
|---|---------|---------------|
| E-1 | 作为 teacher，我希望建题库→组卷→安排考试场次，以便组织考试 | 题库/试卷共享内容状态机；组卷支持手工/随机抽题；场次（exam_usage）可开始/完成 |
| E-2 | 作为 student，我希望参加考试并查询成绩，以便了解掌握度 | 场次开始后答题提交 → exam_results；(usage, user) 唯一 |
| E-3 | 作为 teacher，我希望配置岗位认证规则（能力项/权重/关联任务），以便认定学生能力 | 每岗位唯一认证规则；两级权重（能力点占任务分/任务占岗位分）；规则可启用/停用 |
| E-4 | 作为 school_admin，我希望维护毕业设计（选题/归档/评阅/答辩）与毕业资格，以便完成毕业认定 | 毕设选题容量控制；归档查重标记；毕业资格查询快照（学分/场景/认证）（注：毕业设计/毕业资格接口尚未实现，数据表已建但无路由，见 02-api-contract 变更日志 v1.0） |
| E-5 | 作为 student，我希望对评分结果发起申诉，以便保障公平 | 申诉单流程：创建→教师处理（受理/驳回） |

### 3.6 资源库（resource）

| # | 用户故事 | 验收标准（AC） |
|---|---------|---------------|
| R-1 | 作为 teacher，我希望上传/维护 11 类教学资源，以便课程节点与场景任务复用 | 资源类型字典（文档/表格/图片/链接/音频/视频/压缩包/场地/设施/软件/其他）；资源可被节点/任务绑定（多对多） |

### 3.7 教务排课（affairs）

| # | 用户故事 | 验收标准（AC） |
|---|---------|---------------|
| A-1 | 作为 school_admin，我希望配置学期→人培方案→教学计划，以便排课有依据 | 人培方案（培养目标/学分/课程清单）可克隆；教学计划按 (program, term) 唯一 |
| A-2 | 作为 school_admin，我希望自动排课并识别冲突，以便节省排课工时 | auto-schedule 自动排；教师/班级/场地三类冲突返回 409 且指明冲突项 |
| A-3 | 作为 school_admin，我希望课表发布后学生可查看，以便教学有序 | 排课条目草稿→发布；学生工作台 my-schedule 查询本人课表 |

### 3.8 产教联盟（alliance）

| # | 用户故事 | 验收标准（AC） |
|---|---------|---------------|
| L-1 | 作为 school_admin，我希望维护合作企业/协议/项目/成果/专家台账，以便产教合作规范管理 | 企业状态流转（negotiating/active/paused/terminated）；协议挂项目；项目带里程碑；专家评级（copper/silver/gold） |
| L-2 | 作为 school_admin，我希望运营品牌内容（人才/雇主/岗位/专业/师资/文化），以便对外招生宣传 | 品牌内容统一表 + 专题页（grid 布局 + content_blocks）；前台落地页展示 |
| L-3 | 作为访客/学生，我希望浏览校企合作公开信息，以便了解学校产教实力 | `/alliance/public/*` 15 个公开接口；联盟字典（8 类 40 条种子）英文编码 |
| L-4 | 作为 school_admin，我希望发布就业项目（指定参与企业与面向学生群体），企业针对项目录入岗位，学生在供需大厅浏览并投递，以便打通人才与岗位供需链路 | 项目 publish_status(draft/published) 控制上架，展示状态由起止日期派生；项目可配置封面图（landing 供需大厅以封面大卡+统计行展示，参考 landingpage1 风格）；浏览全量可见（任何登录角色）；target_groups 组内 AND/组间 OR 控制学生**投递资格**（空=全校可投，不符 403）；岗位可独立或挂项目（挂项目且 published 才上大厅）；投递落档案快照+求职信、(job_id,student_id) 唯一防重；企业端只读查看投递；学校端可下架岗位 |

### 3.9 工作台与门户（portal）

| # | 用户故事 | 验收标准（AC） |
|---|---------|---------------|
| P-1 | 作为 teacher/student/school_admin，我希望登录后进入角色化工作台，以便直达常用功能 | 登录后按角色跳转（school_admin→应用中心，teacher/student→工作台）；工作台数据按角色聚合（30s 缓存，键含 userID） |
| P-2 | 作为用户，我希望通过菜单权限控制页面可见性，以便按岗位职责隔离功能 | **菜单驱动的 API 授权（ADR-0008）**：角色=菜单权限集合，页面可见性与后端 API 授权均由 roles 配置的 menus 驱动（勾选菜单即授予对应页面的全部 CRUD/审批操作）；school_admin/platform_admin 未显式配置 menus 时全量放行（roles 页回显全选，显式配置后按菜单判定）；保留特判：关键写白名单（密码/租户状态/有效期/审批终审限 school_admin，纵深防御）、服务台按角色聚合（P-1）、平台隔离与租户归属校验不变 |

---

## 4. 功能详述

### 4.1 登录与认证

- **输入**：用户名 + 密码（账号密码 Tab；短信/微信为占位）
- **系统处理**：HS256 JWT 签发（7 天有效期）；Claims 携带 userId/tenantId/roleCodes/permissions；登录接口按 IP 限流 30 次/分钟（Redis 计数，未配置 Redis 自动降级）；**验证码**：字符验证码，连续输错 3 次触发、新设备首次登录必须校验（`/auth/captcha`）；**逐请求会话校验**：用户/租户停用、改密后旧 token 下一请求即失效（`RequireActiveUser`，见 `docs/security-standards.md` §2）
- **输出**：portal / saas / partner 三端 token（平台隔离，token 携带 platform 声明，不可跨端互用）；多租户账号在登录时返回 `needsTenantSelection`，前端弹窗选租户后调用 `select-tenant` 换取最终 token
- **业务规则**：`login_name` 全局唯一（`tenantID + "_" + 用户名` 拼接存储）；密码 bcrypt；平台隔离（portal token 不可访问 saas 接口，反之亦然）

### 4.2 内容统一状态机

统一内容状态机覆盖**5 类版本化内容实体**：岗位、场景、课程、题库、试卷（统一内容动作校验）；这 5 类含 `version` 列、发布即快照（ADR-0006，`versionedContentTables`）。**人培方案、教学计划不接入六态**：仅两态（draft/published、draft/confirmed），不版本化，但同列 `AllowedContentTables` 白名单，共享提交/发布/归档等统一动作的表名校验；**题目（exam_questions）不接入内容状态机**（随题库/试卷整体流转）。

状态 6 个：`draft` / `pending` / `approved` / `rejected` / `published` / `archived`。

允许流转（`allowedStatusTransitions`，非法转移返回 409）：

| 当前状态 | 可进入 |
|---|---|
| draft | pending、archived |
| pending | draft（撤回）、approved、rejected |
| rejected | draft、pending、archived |
| approved | draft、published、archived |
| published | draft（取消发布）、archived |
| archived | draft（恢复） |

- **可编辑态**：draft / rejected / approved / published（`published` 可继续编辑，编辑后重新发布生成新版本，历史学习/测评数据经快照保留，见 `docs/resource-snapshot-versioning.md`）
- **可删除态**：draft / rejected / archived（物理删除，外键级联清理子表）
- 每次动作经统一内容动作服务校验合法转移，非法转移返回 409

### 4.3 审批流

- 工作流模板：多步骤（steps JSONB），可绑定专业（major_ids）、使用计数
- 审批记录：current_step_idx 推进；any/all 模式；同目标同 pending 记录唯一（partial unique index）
- 审批动作推进实体状态（如 pending→approved→published）

### 4.4 评价结果统一模型

- 课程级 `course_evaluation_results`、节点级 `node_evaluation_results`、场景任务级 `scene_evaluation_results` 三表同构：method_key + evaluator_type + 各评价点分数（jsonb）+ 客观题答案/主观内容/抽题记录 + status + total_score
- 唯一约束 `(tenant, 主体, evaluatee, method_key)` 防重复评价
- 结果异步汇聚到 `job_ability_results`（岗位能力汇聚，aggregate 任务带运行日志）

### 4.5 批次发布

岗位(batches)/课程(lesson_batches)/测评(evaluation_batches)/场景(scene_batches)/教务(affairs_batches) 五套同构批次表：name/code/org_node_id/workflow_id/status(open/closed)/count；内容绑定批次后经批次统一发布。

### 4.6 租户隔离

- 所有业务表带 `tenant_id`；行级隔离（非库级隔离）
- 写操作三重校验：`requireTenant` → `verifyRequestTenant` → `verifyTenantOwnership`
- 平台管理员无跨租户特权

### 4.7 导入导出

- 内容实体（岗位/场景/体系课/颗粒课/题库/题目/试卷）与基础数据（行业/专业/组织/学生/教师/联盟 7 实体/排课/人培课程/教务配置）支持 Excel 导入
- 流程：上传 → 预览（错误行明细）→ 确认导入；同名/同 code 冲突提示
- 导出支持"导入模板 Excel 导出并回导"（题库详情批量导出题目为模板）
- 10 分钟长超时（常规接口 30s）

---

## 5. 非功能需求

### 5.1 性能

| 项 | 指标 | 实现 |
|----|------|------|
| 常规接口超时 | 30s | 框架统一中间件；import/export/templates 前缀 10min |
| 分页上限 | 200 条/页，默认 20 | `maxPageSize=200`，limit 钳制 [1,200]，默认 20（`LimitOffsetQuery`） |
| 请求体上限 | 10MB | `maxJSONBodySize` |
| 缓存 | 落地页考试 2min、公开岗位 2min、场景列表 2min、工作台 30s | Redis（键含租户+查询参数 / userID）；Redis 为部署必需服务（compose depends_on healthy，见 `deploy/docker-compose.yml`） |
| 异步化 | 操作日志、能力汇聚 | OpLogBuffer 异步缓冲 + scheduler 定时聚合 |

### 5.2 安全

| 项 | 说明 |
|----|------|
| 认证 | JWT HS256，密钥 `JWT_SECRET`（.env，禁止入库）；有效 7 天 |
| 授权 | 三级中间件：平台隔离（RequirePlatform）→ 角色（RequireRole）→ 菜单/按钮权限；GET 放行仅限只读（RequireRoleOrMenu 限制 GET/HEAD/OPTIONS） |
| 数据权限 | 租户行级隔离；写操作三重校验；登录日志 + 操作日志审计（POST/PUT/DELETE 自动记录） |
| 限流 | 登录 6 接口 30 次/分钟/IP（`/auth/login`、`/auth/saas/login`、`/auth/portal/login`、`/auth/partner/login`、`/auth/partner/register`、`/auth/select-tenant`），Redis 计数，429 + X-RateLimit-* 头；另有验证码/上传/导入导出/密码写/公开读取限流，见 `docs/security-standards.md` §4 |
| SQL 注入 | 排序白名单；数据访问层参数化查询 |
| 敏感信息 | 密码 bcrypt；管理员初始密码仅返回一次 |
| 部署加固 | 后端容器只读文件系统 + cap_drop；上传目录独立 |

### 5.3 兼容性

| 项 | 说明 |
|----|------|
| 浏览器 | 现代浏览器（Chrome/Edge/Firefox/Safari 近 2 个主版本）；移动端适配已完成 3 轮全量扫描 |
| 后端运行时 | Java 21 / Spring Boot 4（CI 校验 Maven 编译） |
| 前端运行时 | Node ≥ 20（CI 用 22）、pnpm；`plus-ui` 单工程双构建——Vue 业务门户（`src-portal`，Vue 3.5 + Element Plus）+ 管理端（`src`，RuoYi 框架） |
| 数据库 | MySQL 8.0（docker 3306 映射）；Redis 7（必需，后端启动依赖，见 compose healthcheck） |
| 文档预览 | kkfileview 服务（docker compose profile，默认启用，端口 8012）；浏览器原生可渲染格式（图片/PDF 等）直接展示，其余经 kkfileview 转换预览（前端 `/kkfileview/onlinePreview?url=<签名URL>`，见 `02-api-contract.md` §3.6） |

### 5.4 可维护性

- 后端分层：controller（HTTP 适配）→ service（编排+事务）→ mapper（数据访问，无 DAO 层）；Java 框架契约详见根 `AGENTS.md` 第二部分
- 新增 controller 禁止拼 SQL/持有 DB 句柄；新接口必须附带 controller/service/mapper 测试至少一种
- 前端组件规范见 `AGENTS.md` 第二部分（Vue 门户/管理端组件体系）
- 质量门禁：`deploy.sh` 默认开启——Maven 编译 + plus-ui（admin+portal）构建 + spec-check（见根 `AGENTS.md` 4.2）

---

## 6. 附录

### 6.1 术语表

| 术语 | 含义 |
|------|------|
| 租户（Tenant） | 独立数据隔离单位（一所学校/一家企业），`tenant_id` 行级隔离 |
| 平台（Platform） | portal（教育端）/ saas（运营端）/ partner（企业端）三端 token 体系 |
| 内容状态机 | draft/pending/approved/rejected/published/archived 六态流转 |
| 批次（Batch） | 内容发布单元，五套同构（岗位/课程/测评/场景/教务） |
| 能力点（AbilityPoint） | 能力字典最小单元（NL 编码），岗位/课程/场景/评价共同引用 |
| 量规（Rubric） | 评价评分标准（rubric/score_rule 两种模式） |
| 评价方法（EvaluationMethod） | 测评方式字典（题库/随堂测/现场问答/现场评审/成果评价/作业/答辩等） |
| 人培方案（TrainingProgram） | 人才培养方案（培养目标/学分/课程清单） |
| 教学计划（TeachingPlan） | 基于人培方案的学期化执行计划 |
| 排课（Schedule） | 教学计划条目 + 场地/节次 → 课表条目（草稿/发布） |
| 联盟（Alliance） | 校企合作管理域（企业/协议/项目/成果/专家/品牌） |

### 6.2 参考资料

- 架构分层：根 `AGENTS.md` 第二部分（Java 框架契约）
- 前端组件：`plus-ui/src-portal`（Element Plus）与 `plus-ui/src`（RuoYi 框架）
- 审查指引：`docs/code-review-checklist.md`（审查清单）
- 接口契约：`docs/spec/02-api-contract.md`
- 数据库设计：`docs/spec/04-database-schema.md`
- 原型交互：`docs/spec/05-prototype-interaction.md`
