# 接口契约文档 — 知与 SaaS

> 基于后端源码（`backend/internal/router/`、`backend/internal/handler/`）回溯整理。
> 全量接口约 **700+ 个**（实测 623 条静态注册 + 约 81 条模板展开，含按角色组重复注册的只读接口），本文档以「公共规范 + 通用模式 + 模块清单 + 代表性详写」方式记录，未逐接口展开的遵循同名通用模式。
> 企业平台（Partner）的接口（`/partner/*`、`/auth/partner/*`）在子平台 spec [`partner-enterprise-platform.md`](partner-enterprise-platform.md) §5 单独记载，本文档不重复（§1.11 仅列 SaaS 运营端跨平台管理入口）。
> 2026-08-14 全量审计修订：补齐 AI/快照 bundle/主题设置/通用收藏/社区/荣誉/标签/引用统计/学校管理员等漏登记端点；删除毕业设计/微证书/作业模块等无路由僵尸条目；修正认证规则与机器码词汇表。

---

## 1. 接口清单（按模块分组）

所有接口前缀 `/api/v1`。权限列标记三档：`公开` = 无需 JWT（匿名）；`登录公开` = 任意已登录用户可见（如 `/alliance/public/*`、`/job/public/*`，仍需 JWT）；其余为 JWT 校验后的角色/菜单组。只读接口（List/Get）普遍同时在更宽角色组（jobViewer 含学生）注册。

### 授权模型（2026-08-17 起，ADR-0008「菜单驱动的 API 授权」）

> 角色差异收敛为**菜单权限配置差异**：所有角色的页面与 API 访问权限均由 `/portal/apps/system/org-user/roles` 的菜单勾选驱动（`roles.permissions.menus`），配置一致则权限一致。后端 API 按「模块菜单」声明授权（`RequireMenu`，见 `backend/internal/router/menu_grants.go`），写操作与只读操作均由菜单决定。保留的少量角色特判：
>
> - **平台隔离**（`RequirePlatform` portal/saas/partner）与**租户归属校验**（handler 层，ADR-0003）不变；
> - **关键写白名单**（`RequireSystemPermission`）：密码/租户状态/有效期/审批终审等关键写操作仍限 `school_admin`/`platform_admin` 角色（纵深防御）；
> - **服务台**（`portalWorkspace`）：工作台/社区/个人中心按角色聚合（PRD P-1）；
> - **school_admin「无 menus = 全量」**：未显式配置 menus 时全量放行（与 roles 页回显全选一致）；显式配置后按菜单判定；
> - **学生**：默认种子仅落地页 5 个 + 服务台菜单，落地页菜单隐含授权对应只读 API 面；
> - **B13 配置化**：`enterprise_mentor` 默认种子不勾联盟菜单即无联盟管理权限（原代码级收窄取消，配置可覆盖）；
> - **AI 中心**：用户端登录公开（可见性 service 层判定）；管理端（审核/挂接）由 AI 管理菜单（`/portal/apps/ai/admin/reviews`、`/portal/apps/ai/admin/integrations`）控制，不再限 `school_admin` 角色（2026-08-17 修订）。
>
> 旧权限列标记（`systemAdmin`/`businessUser`/`jobViewer`/`RequireAllianceManager`）在 2026-08-17 重构后由对应菜单组替代，语义映射：`businessUser` ≈ 对应模块管理菜单；`jobViewer` ≈ 模块管理菜单 ∪ 落地页菜单（只读面）；`systemAdmin` ≈ `/portal/apps/system` 菜单 + school_admin 角色兜底；`RequireAllianceManager` ≈ 联盟管理菜单。

### 1.0 全局 / 文件 / 认证 / 公共配置

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/health`、`/health/ready` | 公开 | 健康检查（ready 含 DB+Redis 探活） |
| GET | `/metrics` | 公开 | Prometheus 指标（请求量/耗时/5xx + DB 连接池） |
| GET | `/uploads/{tenantID}/{filename}` | 公开(混合鉴权) | 静态文件：签名 URL 免登录；登录态需租户匹配，跨租户 403 |
| POST | `/api/v1/files/upload` | JWT(限流 20/min/用户) | 文件上传（multipart/form-data, `file` 字段，≤10MB，扩展名白名单 + magic bytes 嗅探） |
| GET | `/api/v1/files/preview` | JWT | 文件预览（服务端转换，office 类） |
| GET | `/api/v1/files/sign-url` | JWT | 生成文件签名 URL（HMAC，15 分钟有效期） |
| POST | `/api/v1/auth/login` | 公开(限流) | 通用登录（saas 语义） |
| POST | `/api/v1/auth/saas/login` | 公开(限流) | SaaS 运营端登录 |
| POST | `/api/v1/auth/portal/login` | 公开(限流) | Portal 教育端登录 |
| POST | `/api/v1/auth/partner/login` | 公开(限流) | Partner 企业端登录 |
| POST | `/api/v1/auth/partner/register` | 公开(限流) | 企业自助注册（建租户+主体+管理员+签发 token） |
| POST | `/api/v1/auth/select-tenant` | 公开(限流) | 多租户账号选择租户 |
| GET | `/api/v1/auth/captcha` | 公开(限流 10/min/IP) | 字符验证码（连续输错 3 次或新设备首次登录时必需） |
| GET | `/api/v1/auth/portal/me` | portal | 当前用户信息（portal） |
| GET | `/api/v1/auth/me` | saas | 当前用户信息（SaaS 运营端） |
| GET | `/api/v1/auth/saas/me` | saas | 当前用户信息（saas 语义别名） |
| GET | `/api/v1/auth/partner/me` | partner | 当前用户信息 + 企业主体合并（partner） |
| GET | `/api/v1/subscriptions` | portal | 当前租户订阅套餐 |
| GET | `/api/v1/settings/theme` | 公开(限流 120/min/IP) | 平台主题色（全局/租户覆盖生效） |
| GET | `/api/v1/portal/workspace/dashboard` | portalWorkspace（30s 缓存） | 工作台聚合 |
| GET | `/api/v1/portal/workspace/my-schedule` | portalWorkspace | 我的课表（学生/教师） |
| GET/POST/PUT/DELETE | `/api/v1/portal/workspace/honors`、`/{id}` | portalWorkspace | 学生荣誉（本人 CRUD，业务用户可读） |
| GET/POST | `/api/v1/portal/community/topics`、`/{id}`、`/{id}/replies` | portalWorkspace | 学习社区帖子/回复/阅读数 |

### 1.1 岗位管理（job，`/job/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/POST | `/job/positions`、`/{id}`、`/`(POST) | businessUser 写 / jobViewer 读 | 岗位内容资源（13 动作，见 §2.1） |
| PUT | `/job/positions/{id}/save-full` | businessUser | 整单保存（构建器一次提交） |
| POST | `/job/positions/{id}/clone` | businessUser | 克隆岗位 |
| GET/POST | `/job/positions/{id}/favorite` | 全部 | 收藏状态/切换收藏 |
| GET | `/job/positions/favorites` | 任一业务管理/落地页菜单 | 我的收藏列表 |
| GET | `/job/public/positions`、`/{id}` | jobViewer | 公开岗位列表（2min 缓存）/详情 |
| GET | `/job/landing/target-positions` | 登录公开 | 岗位大厅推荐岗位 |
| GET | `/job/positions/{id}/snapshot` | jobViewer | 岗位快照 bundle（`?version=`，见 §1.12） |
| GET/POST/PUT/DELETE | `/job/abilities`、`/ability-domains` | jobViewer 读 / businessUser 写 | 能力点、能力域（5 动作 CRUD） |
| GET | `/job/abilities/citation-stats`、`/uncited` | jobViewer | 能力点引用统计/零引用列表 |
| GET/POST/PUT/DELETE | `/job/position-abilities`、`/position-responsibilities`、`/position-certificates` | 同上 | 岗位能力绑定/职责/证书 |
| GET/POST/PUT/DELETE | `/job/certificate-library` | businessUser | 证书库（5 CRUD） |
| GET | `/job/certificate-library/citation-stats`、`/uncited` | jobViewer | 证书库引用统计/零引用 |
| GET/POST/PUT/DELETE | `/job/recommendations` | businessUser | 岗位推荐（4：List/Create/Update/Delete） |
| GET/POST/PUT/DELETE | `/job/learn-roads` | businessUser | 学习路径（5 CRUD） |
| GET/POST/PUT/DELETE | `/job/banners` | businessUser | 岗位首页轮播配置 |
| GET/POST/PUT/DELETE/POST /{id}/status | `/job/batches` | businessUser | 岗位批次（6 动作，见 §2.2） |

### 1.2 场景实训（scene，`/scene/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST/PUT/DELETE + 状态动作 | `/scene/scenarios`、`/{id}` | businessUser 写 / jobViewer 读 | 场景内容资源（写 11 动作；List 挂 2min 缓存） |
| POST | `/scene/scenarios/{id}/clone` | businessUser | 克隆场景 |
| GET | `/scene/scenarios/{id}/snapshot` | jobViewer | 场景快照 bundle（见 §1.12） |
| POST/PUT/DELETE | `/scene/tasks`、`/scene/tasks/reorder` | businessUser 写 / jobViewer 读 | 场景任务 |
| GET/PUT | `/scene/tasks/{taskId}/evaluation-methods` | businessUser 写 / jobViewer 读 | 任务评价方式（GET List / PUT SaveMethods） |
| GET/POST/PUT/DELETE | `/scene/rubric-templates` | businessUser | 量规模板（5 CRUD，软删除） |
| GET/POST/DELETE | `/scene/task-resources` | businessUser | 任务资源绑定（List/Bind/Create/Unbind 4 动作） |
| POST/DELETE | `/scene/task-bindings/knowledge`、`/ability` | businessUser | 任务-知识点/能力点绑定 |
| GET/POST/PUT | `/scene/weights`、`/grade-mappings` | businessUser | 任务权重（Upsert）、等级映射（Upsert） |
| GET/POST/PUT/DELETE/POST /{id}/status | `/scene/batches` | businessUser | 场景批次（6 动作） |

### 1.3 课程教学（lesson，`/lesson/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/POST + 状态动作 | `/lesson/courses`、`/{id}` | businessUser 写 / jobViewer 读 | 课程内容资源（13 动作） |
| POST | `/lesson/courses/{id}/clone` | businessUser | 克隆课程 |
| GET | `/lesson/courses/{id}/snapshot` | jobViewer | 课程快照 bundle（见 §1.12） |
| GET | `/lesson/course-node-evaluation-results` | businessUser | 课程节点评价结果汇总（教师端） |
| GET/POST | `/lesson/node-evaluation-results`、`/{id}`、`/{id}/grade` | 学生 List/Submit / businessUser 读+评分 | 节点评价结果 |
| GET/POST/PUT/DELETE | `/lesson/knowledge-points` | jobViewer 读 / businessUser 写 | 知识点 |
| GET | `/lesson/knowledge-points/citation-stats`、`/uncited` | jobViewer | 知识点引用统计/零引用 |
| POST/PUT/DELETE | `/lesson/nodes`、`/lesson/nodes/reorder` | businessUser 写 / jobViewer 读 | 课程节点 |
| GET/POST/PUT/DELETE | `/lesson/quizzes`、`/quizzes/{id}`、`/quizzes/{id}/questions`、`/quizzes/questions/{questionId}` | businessUser | 节点测验（扁平路径 8 动作：List/Create/ListQuestions/Update/Delete/AddQuestion/UpdateQuestion/DeleteQuestion） |
| GET/POST/DELETE | `/lesson/node-resources`、`/course-resources` | businessUser | 节点/课程资源（扁平路径，List/Bind/Create/Unbind） |
| GET/POST/PUT/DELETE | `/lesson/hybrid-modules`、`/hybrid-modules/batch` | businessUser | 混合教学模块（Upsert/BatchSave） |
| GET/POST/PUT/DELETE/POST /{id}/status | `/lesson/batches` | businessUser | 课程批次（6 动作） |
| POST | `/lesson/behavior-collection/records` | jobViewer | 课堂行为打卡 |
| GET | `/lesson/behavior-collection/aggregate` | businessUser | 行为聚合 |

### 1.4 考核评价（evaluation，`/evaluation/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/POST + 状态动作 | `/evaluation/question-banks`、`/{id}` | businessUser 写 / jobViewer 读 | 题库内容资源（13 动作） |
| GET | `/evaluation/question-banks/{id}/snapshot` | jobViewer | 题库快照 bundle（见 §1.12） |
| GET/POST/PUT/DELETE | `/evaluation/questions`、`/evaluation/questions/batch` | businessUser | 试题 CRUD + 批量创建 |
| GET/POST/PUT/DELETE | `/evaluation/random-draw-questions` | businessUser | 随机抽题（5 CRUD） |
| POST/PUT/DELETE + 状态动作 | `/evaluation/exams`、`/{id}` | businessUser 写 / jobViewer 读 | 试卷（写 11 动作；List/Get 挂 jobViewer） |
| GET | `/evaluation/exams/{id}/snapshot` | jobViewer | 试卷快照 bundle（见 §1.12） |
| POST/PUT/DELETE | `/evaluation/exams/{id}/questions`、`/questions/scores`、`/questions/{questionId}` | businessUser | 组卷（Add/BulkUpdateScores/UpdateScore/Remove） |
| GET/POST/PUT/DELETE/POST /{id}/publish、/{id}/finish | `/evaluation/exam-usages` | businessUser 写 / jobViewer 含学生读 | 考试场次（List/Get 挂 jobViewer；写操作含 Publish/Finish） |
| GET | `/evaluation/exam-center` | jobViewer | 测评中心（学生/教师考试中心聚合） |
| GET/POST | `/evaluation/exam-results` | 教师 List / 学生 Create | 考试成绩 |
| GET | `/evaluation/exam-results/{id}`、POST `/{id}/grade` | businessUser | 成绩详情/教师评分 |
| GET/POST | `/evaluation/results` | jobViewer 读+Submit / businessUser | 评估结果列表/提交 |
| GET/POST | `/evaluation/results/{id}`、`/{id}/grade`、`/results/batch-grade` | businessUser | 结果详情/评分/批量评分 |
| GET/POST | `/evaluation/job-ability/results`、`/summary`、`/{id}`、`/course-scores` | jobViewer 读 | 岗位能力结果/汇总/课程得分；`/course-scores` 当前被学生画像页临时隐藏（`student_portrait.html` `SHOW_COURSE_SCORES` 开关，见 `docs/系统功能清单.md`「六、6 认证结果与能力汇聚」） |
| GET/POST | `/evaluation/job-ability/aggregate`、`/aggregate/status` | businessUser | 触发汇聚/状态 |
| GET/POST/PUT/DELETE | `/evaluation/certifications`、`/{id}` | businessUser | 认证规则（见 §3.4，实际端点以 `/evaluation/certifications` 为前缀） |
| GET/PUT | `/evaluation/certifications/positions/{positionId}/model`、`/weights` | businessUser | 规则模型/两级权重；模型任务当前**仅含场景任务**（临时边界：`certifications.go` `certificationSceneTasksOnly` 开关过滤体系课/混合课课程任务，恢复课程置 false） |
| PUT | `/evaluation/certifications/positions/{positionId}/points/{abilityPointId}/levels` | businessUser | 能力点五档分数线 |
| GET/POST | `/evaluation/certifications/{id}/items`、`/items/{id}/points`、`/{id}/full` | businessUser | 能力项/能力点/全量规则 |
| POST | `/evaluation/certifications/points/{pointId}/tasks`、`/{id}/status` | businessUser | 关联任务/启用停用 |
| PUT/DELETE | `/evaluation/certifications/items/{id}`、`/points/{id}`、`/tasks/{id}` | businessUser | 能力项/能力点/任务更新删除 |
| GET/POST | `/evaluation/portraits`、`/portraits/{id}`、`/portraits/student-dashboard` | jobViewer 含学生 | 学生画像（学生本人强制） |
| POST | `/evaluation/portraits/generate` | businessUser | 画像生成 |
| GET/POST/DELETE | `/evaluation/portraits/archives`、`/archives/{id}` | businessUser | 画像归档 |
| GET/POST | `/evaluation/appeals`、`/{id}`、`/{id}/process` | 全部 | 成绩申诉（创建/处理） |
| GET/POST/PUT/DELETE/POST /{id}/status | `/evaluation/batches` | businessUser | 测评批次（6 动作） |

### 1.5 资源库（library，`/library/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/POST/PUT/DELETE | `/library/resources` | jobViewer 读 / businessUser 写 | 资源库（5 CRUD） |
| GET | `/library/resources/stats`、`/citation-stats`、`/uncited` | jobViewer | 资源统计/引用统计/零引用 |
| POST | `/library/resources/import/preview` | businessUser | 资源批量导入预览 |
| GET/POST/PUT/DELETE | `/library/on-site-questions` | 同上 | 现场问答题库 |
| GET/POST/PUT/DELETE | `/library/tags`、`/resource-tags` | businessUser | 标签管理 + 资源标签绑定 |
| POST | `/library/resource-tags/query` | jobViewer | 资源标签批量查询（库浏览必需） |

### 1.6 教务管理（affairs，`/affairs/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/POST/PUT/DELETE | `/affairs/terms` | businessUser | 学期（4 CRUD） |
| GET/POST + 状态动作 | `/affairs/programs`、`/{id}` | businessUser | 人培方案（13 动作 + GET/PUT `/{id}/courses` + clone） |
| GET/POST/PUT/DELETE | `/affairs/teaching-plans`、`/{id}`、`/entries/{id}`、`/{id}/confirm` | businessUser | 教学计划（生成/确认/条目编辑/导出） |
| GET | `/affairs/teaching-plans/{id}/export` | businessUser | 教学计划导出 Excel |
| GET/POST/PUT/DELETE | `/affairs/venues`、`/period-slots`（含 `/replace`） | 只读 GET `/affairs/period-slots` 登录公开（工作台课表渲染，学生/教师均需）；其余 affairs 管理菜单 | 场地、节次 |
| GET/POST | `/affairs/schedules`（List/Create/auto-schedule/Update/Delete） | businessUser | 排课 |
| POST | `/affairs/schedules/publish` | businessUser | 排课发布（无 {id}，整学期发布） |
| GET | `/affairs/schedules/timetable`、`/export` | businessUser | 课表/导出 |
| GET/POST/PUT/DELETE/POST /{id}/status | `/affairs/batches` | businessUser | 教务批次（6 动作） |
| GET/POST/PUT/DELETE | `/affairs/workflows`、`/affairs/workflows/{id}` | businessUser | 教务审批流模板（与 §1.8 门户级工作流同构） |

### 1.7 门户系统管理（portal + systemAdmin）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/PUT | `/tenants`、`/tenants/{id}` | 列表 `GET /tenants` 与写 `PUT /tenants/{id}`：systemAdmin / 本租户 portal 管理员（归属校验）；详情 `GET /tenants/{id}`：jobViewer 本租户业务角色（教师/学生/企业导师等）可读（handler 强制本租户，跨租户 403） | 租户信息（当前租户）；详情只读面向联盟前台落地页（`/portal/alliance/landing` hero 学校卡）与学校信息页（`/portal/apps/alliance/school`）读取本租户展示信息；**有效期 `valid_from`/`valid_until` 仅平台管理员可修改**，本租户管理员（portal）更新时自动剥离有效期字段（防止自行延长订阅） |
| GET/POST/PUT/DELETE | `/admins`、`/admins/{id}`、`/admins/{id}/reset-password` | systemAdmin | 学校管理员管理（5 动作，重置密码限流）；本租户 portal 管理员经系统管理菜单调用（handler 强制本租户，归属校验在位）；**租户自助新增暂不开放**（产品决策：前端隐藏「新增」入口，`POST /admins` 仍保留供平台侧使用，见 `docs/系统功能清单.md`「十一、1 租户信息」；恢复方式为 `school-admin-manager.tsx` 顶部 `SHOW_ADD_BUTTON` 改为 true） |
| GET/POST/PUT/DELETE | `/organizations`、`/organizations/tree`、`/org-types` | systemAdmin | 组织/组织类型 |
| GET/POST/PUT/DELETE | `/users`（12 个写动作 + List） | systemAdmin 写 / RequireUserRead 读 | 用户管理（创建/批量创建/毕业/删除/改密/绑定角色等） |
| GET/POST/PUT/DELETE | `/staff-titles`、`/user-extension-fields`、`/user-relations` | systemAdmin | 职称/扩展字段/用户关系 |
| GET/POST/PUT/DELETE | `/roles`、`/roles/{id}/assign` | systemAdmin | 角色与授权 |
| GET/POST/PUT/DELETE | `/majors`、`/industries` | businessUser 读 / systemAdmin 写 | 专业/行业字典 |
| GET/POST/PUT/DELETE | `/resource-codes` | systemAdmin | 资源编码 |
| GET | `/logs/login`、`/logs/operation` | systemAdmin | 审计日志 |
| GET/POST | `/favorites`、`/favorites/{targetType}/{id}` | 任一业务管理/落地页菜单 | 通用收藏（场景/课程/题库/试卷） |
| PUT | `/portal/workspace/me`、`/me/password` | portalWorkspace | 个人资料/改密（改密限流） |

### 1.8 工作流 / 审批（portal，school_admin/teacher）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/POST/PUT/DELETE | `/workflows` | school_admin/teacher | 审批流程模板 |
| GET/POST | `/approvals`、`/{id}`、`/{id}/review` | school_admin/teacher | 审批记录 |

### 1.9 联盟（alliance，`/alliance/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/alliance/school-info`、`/enterprises`、`/enterprises/search`、`/enterprises/{id}`、`/grants`、`/grants/resource-options`、`/projects`、`/projects/{id}`、`/projects/{pid}/milestones`、`/achievements`、`/achievements/{id}`、`/experts`、`/experts/mentor-options`、`/experts/{id}`、`/agreements`、`/agreements/{id}`、`/permissions`、`/permissions/{id}`、`/dictionaries/{dictType}`、`/brands`、`/brands/talent-ranking`、`/brands/rank-configs`、`/brands/{id}` | 联盟管理菜单（/portal/apps/alliance 或 /portal/alliance 任一） | 联盟只读视图（含全局企业搜索、授权、导师选项、品牌排行） |
| PUT | `/alliance/school-info` | 联盟管理菜单 | 学校信息 |
| POST | `/alliance/enterprises/register` | 联盟管理菜单 | 学校代企业注册 |
| PUT/DELETE | `/alliance/enterprises/{id}`、`/enterprises/{id}/link` | 联盟管理菜单 | 企业更新/引入/解除引入（DELETE 语义=unlink） |
| PUT | `/alliance/grants` | 联盟管理菜单 | 学校-企业资源授权保存 |
| GET/POST/PUT/DELETE | `/alliance/projects`、`/projects/{id}`、`/projects/{pid}/milestones`、`/achievements`、`/experts`、`/experts/{id}/display`、`/agreements`、`/permissions`、`/dictionaries/{dictType}`、`/brands`、`/brands/rank-configs` | 联盟管理菜单 | 联盟写操作（项目/成果/专家/协议/权限/字典/品牌） |
| GET | `/alliance/public/school-info`、`/enterprises`、`/projects`、`/achievements`、`/experts`、`/agreements`、`/brands`、`/brands/talent-ranking`、`/stats`（List+Get 共 15 个） | 登录公开（限流 120/min/IP） | 联盟公开前台（全局企业主体 + links 双控过滤）；`/experts` 的 `includeNonPublic=true` 查询参数仅同租户 `canManageAlliance` 角色可用，其余登录用户与匿名访客强制 `is_public` 过滤 |
| GET/POST/PUT/DELETE | `/alliance/employment-projects`、`/alliance/employment-projects/{id}` | 联盟管理菜单（企业导师默认不勾联盟菜单即无权限，B13 配置化） | 就业项目 CRUD（L-4；target_groups 面向学生群体，enterprise_ids 参与企业，coverImage 封面图） |
| GET | `/alliance/employment-jobs`、`/alliance/employment-applications` | 联盟管理菜单 | 岗位总览 / 投递总览（筛选 projectId/enterpriseId/status/jobId） |
| PUT | `/alliance/employment-jobs/{id}/status` | 联盟管理菜单 | 学校端治理：下架(closed)/恢复(published)岗位 |
| GET | `/alliance/public/employment-projects`、`/alliance/public/employment-projects/{id}`、`/alliance/public/employment-projects/{id}/jobs`、`/alliance/public/employment-jobs/{id}` | 登录公开（同上限流） | 供需大厅：仅 published；浏览全量可见（不分角色），target_groups 仅在投递时校验资格；项目列表附带 jobCount（在招岗位数）与 coverImage |
| POST/GET | `/alliance/public/employment-jobs/{id}/apply`、`/alliance/public/employment-applications/mine` | 登录公开（仅学生） | 学生投递（档案快照+求职信，唯一约束防重 409；不在岗位 target_groups 面向群体内 403「暂不可投递」）/ 我的投递 |

### 1.10 导入 / 导出 / 模板（portal + businessUser；10min 长超时）

**通用实体**（`/export/{entity}`、`/import/{entity}`、`/import/{entity}/preview`，CSV）：基础字典类（行业/专业/组织/学生/教师等，支持 `?overwrite=1` 覆盖更新）。

**Excel 三件套**（每实体：`/import/{entity}/excel` + `/import/{entity}/preview` + `/templates/{entity}`；全部挂 importExportLimiter 10 次/分钟/用户）：

| 实体 | 说明 |
|------|------|
| positions / scenarios / question-banks / question-banks/{bankId}/questions / exams / courses / granular-courses | 岗位/场景/题库/题目/试卷/体系课/颗粒课 |
| industries / majors / organizations / students / teachers | 基础数据（另含 `/export/{entity}/excel` 导出） |
| alliance-projects / alliance-achievements / alliance-agreements / alliance-permissions / alliance-brands | 联盟 5 实体（企业/专家导入已随 Partner 平台移除） |
| schedules / program-courses / affairs-config | 排课/人培课程/教务配置（含模板下载与 `/affairs/schedules/export`、`/affairs/teaching-plans/{id}/export`） |

### 1.11 SaaS 运营端（saas token + platformAdmin，`/admin/*`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE/PUT /{id}/status | `/admin/tenants` | 租户 CRUD（AdminList/Create/Update/UpdateStatus/Delete） |
| GET/PUT | `/admin/tenants/{id}/enterprise` | 企业租户主体信息 |
| GET/POST/PUT/DELETE/POST /{id}/reset-password | `/admin/tenants/{tenantId}/admins` | 租户管理员管理（5） |
| GET/POST/PUT/DELETE/POST /{id}/reset-password | `/admin/tenants/{tenantId}/enterprise-admins` | 企业租户管理员管理（5） |
| GET/PUT/DELETE | `/admin/tenants/{tenantId}/ai/config` | AI 服务代管（同租户自身配置表） |
| GET/PUT | `/admin/tenants/{tenantId}/subscription` | 租户订阅套餐 |
| PUT/DELETE | `/admin/tenants/{tenantId}/settings/theme` | 租户主题色覆盖管理 |
| GET/PUT | `/admin/settings/theme` | 全局主题色配置 |

### 1.12 AI 智能服务（ai，portal 平台组）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/PUT/DELETE | `/ai/config` | systemAdmin | 租户 AI 服务配置（api_key 仅回传脱敏值） |
| GET | `/ai/usage` | systemAdmin | AI 用量统计（全量 + 近 30 天序列 + 套餐额度） |
| POST | `/ai/chat` | portal 任意登录用户（限流 20/min/用户） | AI 助手对话（非流式；messages ≤ 50 条、单条 ≤ 8000 字符） |
| POST | `/ai/position-assist` | 同上 | 岗位 AI 辅助编写（润色/拆解/推荐；生成内容由前端写入表单，服务端不落库） |
| POST | `/ai/scenario-assist` | 同上 | 场景/任务 AI 辅助编写（基础信息/任务卡片/任务链建议） |

错误映射统一：未配置 → 412 `ai_not_configured`；上游错误 → 502 + 脱敏 message；其余 → 500（见 [`ai-development.md`](../ai-development.md)）。

### 1.13 内容快照 bundle（五类资源，`GET /{base}/{id}/snapshot?version=`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/job/positions/{id}/snapshot` | 岗位快照（全树含职责/能力绑定/证书/认定规则） |
| GET | `/scene/scenarios/{id}/snapshot` | 场景快照（任务链/测评配置/连带引用） |
| GET | `/lesson/courses/{id}/snapshot` | 课程快照（节点树/测验/混合模块/颗粒课一层） |
| GET | `/evaluation/exams/{id}/snapshot` | 试卷快照（题目副本） |
| GET | `/evaluation/question-banks/{id}/snapshot` | 题库快照（已发布题目） |

版本解析：`?version=` 缺省 = 最新已发布快照；快照缺档且 version == live 当前版本 → 回退 live（仅当 live `status='published'`，否则 404）。**安全要求**：学生角色请求时剥离答案/解析字段（`exam_questions.answer/analysis`、`node_quiz_questions.answer`、`random_draw_questions.answer` 等），见 [`resource-snapshot-versioning.md`](../resource-snapshot-versioning.md) §5.2。

---

## 2. 通用模式（契约模板）

### 2.1 内容资源 13 动作（岗位/场景/课程/题库/试卷）

| 动作 | 方法/路径 | 语义 | 状态转移 |
|------|----------|------|---------|
| List | `GET {base}` | 分页列表 | — |
| Get | `GET {base}/{id}` | 详情 | — |
| Create | `POST {base}` | 创建草稿 | → draft |
| Update | `PUT {base}/{id}` | 更新（可编辑态） | draft/rejected/approved/published |
| Delete | `DELETE {base}/{id}` | 物理删除（存在成绩/活跃绑定时删除保护拒绝） | draft/rejected/archived |
| Submit | `POST {base}/{id}/submit` | 提交审批 | → pending |
| Review | `POST {base}/{id}/review` | 审批通过/驳回 | → approved / rejected |
| Publish | `POST {base}/{id}/publish` | 发布（事务内生成快照，版本 +0.1） | → published |
| Archive | `POST {base}/{id}/archive` | 归档 | → archived |
| Unpublish | `POST {base}/{id}/unpublish` | 取消发布 | → draft |
| Withdraw | `POST {base}/{id}/withdraw` | 撤回审批 | → draft |
| SaveDraft | `POST {base}/{id}/save-draft` | 回退草稿 | approved/published → draft |
| Invite | `POST {base}/{id}/invite` | 协作者邀请 | — |

非法转移返回 `409 {"error": "..."}`；动作经 `store.ContentActionStore` 统一校验。5 类内容（岗位/场景/课程/题库/试卷）发布即快照（ADR-0006）。

### 2.2 批次 6 动作（岗位/场景/课程/测评/教务五套同构）

`GET {base}`、`GET {base}/{id}`、`POST {base}`、`PUT {base}/{id}`、`DELETE {base}/{id}`、`POST {base}/{id}/status`（open ↔ closed）。

### 2.3 CRUD 工厂（通用 5 动作）

字典/子资源类接口统一：`GET {base}`（limit/offset/search 分页）→ `{"items":[],"total":n}`；`GET {base}/{id}`；`POST {base}` → `{"id":"..."}`；`PUT {base}/{id}`；`DELETE {base}/{id}`。

### 2.4 导入 Excel 流程

1. `GET /templates/{entity}` → 下载标准 Excel 模板（或"导出为导入模板"）
2. `POST /import/{entity}/preview`（multipart `file`）→ 返回 `{"total": n, "valid": n, "errors": [{row, field, message}]}` 预览结果，前端展示错误行
3. `POST /import/{entity}/excel?overwrite=1` → 执行导入，返回 `{"created": n, "skipped": n, "failed": n, "errors": [...]}`

### 2.5 只读双组注册

List/Get 类只读接口在 businessUser（写）与 jobViewer（读，含学生）双组注册；`GET` 允许菜单放行（RequireRoleOrMenu 仅放行 GET/HEAD/OPTIONS）。

---

## 3. 代表性接口详写

### 3.1 登录

**POST `/api/v1/auth/portal/login`**（saas 同构 `/auth/saas/login`）

- 请求头：`Content-Type: application/json`
- 请求体：
```json
{ "username": "teacher01", "password": "******" }
```
- 校验规则：两字段必填；用户名密码错误 → `401 {"error":"用户名或密码错误"}`；停用用户/停用租户不可登录
- 验证码：连续输错 3 次或新设备首次登录时，需先 `GET /auth/captcha` 获取验证码，登录请求体携带 `captchaId`/`captchaCode`
- 成功响应（单一租户）：
```json
{ "token": "<jwt>", "user": { "id": "...", "loginName": "...", "tenantId": "...", "role": "teacher", "status": "active" } }
```
- 成功响应（多租户账号，需选择租户）：
```json
{ "needsTenantSelection": true, "preAuthToken": "<jwt>", "tenants": [ { "tenantId": "...", "tenantName": "某某学校", "userId": "..." } ] }
```
- 限流：30 次/分钟/IP → `429 {"error":"too many requests","code":429}` + `X-RateLimit-*` 头

**POST `/api/v1/auth/select-tenant`**

- 请求体：`{"preAuthToken": "<jwt>", "tenantId": "..."}` → 成功返回与单租户登录相同的 `{token, user}` 结构；`preAuthToken` 无效 → 401。

### 3.2 当前用户

**GET `/api/v1/auth/me`**

- 请求头：`Authorization: Bearer <token>`
- 响应：
```json
{
  "user": { "id": "...", "loginName": "teacher01", "orgNodeId": "...", "titleIds": [] },
  "tenant": { "id": "...", "name": "某某学校", "status": "active" },
  "orgNode": { "id": "...", "name": "信息工程系" },
  "major": { "id": "...", "name": "..." },  // 无专业时整个键省略（omitempty），不返回 null
  "institution": { "id": "...", "name": "..." },
  "roles": [ { "id": "...", "code": "teacher", "name": "教师" } ]
}
```

### 3.3 内容发布流转（以岗位为例）

**POST `/api/v1/job/positions/{id}/submit`** → `200` 返回完整实体对象（前端按实体消费；不单独返回 `{"id"}`）；已 published 提交 → `409`
**POST `/api/v1/job/positions/{id}/review`** 请求体 `{"status": "approved"|"rejected", "comment": "同意"}` → `200`
**POST `/api/v1/job/positions/{id}/publish`** → `200`
非法流转（如 draft 直接 publish）→ `409 {"error":"当前状态不允许该操作"}`

### 3.4 认证规则（/evaluation/certifications/*，约 20 个接口）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/evaluation/certifications`、`/{id}` | 规则列表/详情/创建 |
| PUT/DELETE | `/evaluation/certifications/{id}` | 更新/删除规则 |
| POST | `/evaluation/certifications/{id}/status` | 启用/停用 |
| GET/POST | `/evaluation/certifications/{id}/items` | 能力项列表/新增（ConfigItems） |
| PUT/DELETE | `/evaluation/certifications/items/{id}` | 能力项更新/删除 |
| GET/POST | `/evaluation/certifications/items/{id}/points` | 能力点列表/新增（ConfigPoints） |
| PUT/DELETE | `/evaluation/certifications/points/{id}` | 能力点更新/删除 |
| POST | `/evaluation/certifications/points/{pointId}/tasks` | 关联任务 |
| PUT/DELETE | `/evaluation/certifications/tasks/{id}` | 关联任务更新/删除 |
| GET/PUT | `/evaluation/certifications/{id}/full` | 全量规则读/写 |
| GET/PUT | `/evaluation/certifications/positions/{positionId}/model`、`/weights` | 规则模型/两级权重；模型任务当前**仅含场景任务**（临时边界：`certifications.go` `certificationSceneTasksOnly` 过滤体系课/混合课课程任务，恢复置 false，见 §1.4 同端点注） |
| PUT | `/evaluation/certifications/positions/{positionId}/points/{abilityPointId}/levels` | 能力点五档分数线 |

业务规则：每岗位唯一规则（`(tenant, position)` 唯一）；能力项可 inherit（继承岗位绑定）或 custom；权重两级（能力点占任务分 0-100 / 任务占岗位分）。

### 3.5 排课

**POST `/api/v1/affairs/schedules`**

- 请求体（示例）：
```json
{
  "termId": "...", "planEntryId": "...", "dayOfWeek": 3,
  "periods": [1, 2], "weekPattern": "all", "classNodeIds": ["..."],
  "teacherId": "...", "venueId": "...", "type": "traditional"
}
```
- 冲突检测：教师/班级/场地任一冲突 → `409 {"error":"排课冲突","conflicts":[{kind,entryId,courseName,className,teacherName,venueName,dayOfWeek,periods,startWeek,endWeek,weekPattern}]}`（结构化冲突项数组）
- 发布：**POST `/affairs/schedules/publish`** → `200 {"published": n, "version": n}`（无 {id}，整学期草稿发布）

### 3.6 文件上传

**POST `/api/v1/files/upload`**（`multipart/form-data`，字段 `file`，单文件 ≤10MB，请求体上限含 multipart 头部）→ `201 {"url": "/uploads/{tenantID}/xxx.png", "name": "...", "size": n, "mimeType": "..."}`；`GET /api/v1/files/preview?url=...` 返回可预览地址；`GET /api/v1/files/sign-url?url=...` 生成 15 分钟签名 URL（无登录态可访问，供 kkfileview 等外部拉取）。文档预览由前端 file-viewer（flyfish-dev，浏览器原生）渲染：凡扩展名落在 `@file-viewer/core` 的 `DEFAULT_SUPPORTED_EXTENSIONS`（208 个扩展名，覆盖 office/pdf/压缩包/邮件/CAD/3D/地理/脑图/绘图/电子书/图片/音视频/代码文本/字体/设计/数据）一律走 `FileViewerPreview`；其余格式回退 kkfileview。kkfileview 服务保留。

### 3.7 工作台聚合

**GET `/api/v1/portal/workspace/dashboard`** → `200` 按角色聚合的 DTO（课程/任务/考试/课表/待办），30s Redis 缓存（键含 userID+角色）。

### 3.8 AI 对话

**POST `/api/v1/ai/chat`**

- 请求体：
```json
{ "messages": [ { "role": "user", "content": "..." } ] }
```
- 护栏：messages 1~50 条、单条 ≤ 8000 字符 → 违反返回 `400`
- 未配置 AI → `412 {"error":"ai_not_configured"}`；上游错误 → `502` + 脱敏后的上游 message；其余 → `500`
- 成功响应：`{"reply": "...", "usage": {"promptTokens": n, "completionTokens": n, "totalTokens": n}}`
- 限流：20 次/分钟/用户

### 3.9 AI 智能服务中心（/ai/kb、/ai/agents、/ai/square、/ai/integrations、/ai/admin/*）

> 完整契约（请求/响应字段、SSE 事件协议、状态机）见 [`ai-service-center.md`](ai-service-center.md) §5；此处登记路由面与公共约定。

**用户端（portal 平台组，任意登录角色，可见性由 service 层判定）**

- 知识库：`GET/POST /ai/kb`，`GET/PUT/DELETE /ai/kb/{id}`，`POST /ai/kb/{id}/submit|unpublish`；文档 `GET/POST /ai/kb/{id}/documents`（POST 为 multipart 上传，≤10MB，扩展名白名单 pdf/docx/txt/md，走 uploadLimiter）、`GET/DELETE /ai/kb/{id}/documents/{docId}`；协作者 `GET/POST /ai/kb/{id}/collaborators`、`PUT/DELETE /ai/kb/{id}/collaborators/{userId}`；库内问答 `POST /ai/kb/{id}/ask`（SSE，aiLimiter）。
- 智能体：`GET/POST /ai/agents`，`GET/PUT/DELETE /ai/agents/{id}`，`POST /ai/agents/{id}/submit|unpublish`；对话 `POST /ai/agents/{id}/chat`（SSE，aiLimiter）；会话 `GET /ai/agents/{id}/conversations`、`GET/PATCH/DELETE /ai/conversations/{id}`（PATCH=重命名，v2.7.3）。
- 广场：`GET /ai/square/kbs|agents`（q/tag/sort=hot|new + 分页）、`GET /ai/integrations?kind=`。
- 收藏：复用通用收藏 `GET/POST /favorites/{targetType}/{id}`，targetType 扩展 `ai_kb`/`ai_agent`，仅 published 对象可收藏（其余 404）。

**管理端（AI 管理菜单，菜单驱动 RBAC）**

- `GET /ai/admin/reviews?type=kb|agent&status=`、`POST /ai/admin/reviews/{type}/{id}/{action}`（action=approve/reject/takedown，reject 必须 comment）
- `GET /ai/admin/overview`
- 挂接 CRUD：`GET/POST /ai/admin/integrations`、`PUT /ai/admin/integrations/{id}`、`POST /ai/admin/integrations/{id}/toggle`、`DELETE /ai/admin/integrations/{id}`（url 仅允许 http/https，防 javascript: XSS）

**SSE 流式协议（chat/ask 共用）**：`event: meta`（conversationId/messageId）→ `event: sources`（命中资料段，无命中则不发送）→ `event: delta`（增量文本 ×N）→ `event: done`；流中途失败发 `event: error`；开始前失败仍返回 HTTP JSON（401/403/404/412/500）。未配置 AI → 412 `ai_not_configured`；上游错误 → 502 脱敏 message。护栏：消息 ≤2000 字符、system_prompt ≤4000 字符、关联知识库 ≤5 个、历史窗口 10 条。

**路由登记表**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /ai/kb | 我的/共享给我的知识库列表 |
| POST | /ai/kb | 创建知识库 |
| GET/PUT/DELETE | /ai/kb/{id} | 详情 / 编辑 / 删除（删除仅 private/rejected 态） |
| POST | /ai/kb/{id}/submit | 提交发布审核 |
| POST | /ai/kb/{id}/unpublish | 下架回私有 |
| GET/POST | /ai/kb/{id}/documents | 文档列表 / multipart 上传 |
| GET/DELETE | /ai/kb/{id}/documents/{id} | 文档详情 / 删除 |
| GET/POST | /ai/kb/{id}/collaborators | 协作者列表 / 添加 |
| PUT/DELETE | /ai/kb/{id}/collaborators/{id} | 变更角色（路径末段为 userId）/ 移除 |
| POST | /ai/kb/{id}/ask | 库内问答（SSE） |
| GET/POST | /ai/agents | 我的智能体列表 / 创建 |
| GET/PUT/DELETE | /ai/agents/{id} | 详情 / 编辑 / 删除 |
| POST | /ai/agents/{id}/submit | 提交审核（响应含 warnings） |
| POST | /ai/agents/{id}/unpublish | 下架 |
| POST | /ai/agents/{id}/chat | 智能体对话（SSE） |
| GET | /ai/agents/{id}/conversations | 我的会话列表 |
| GET/PATCH/DELETE | /ai/conversations/{id} | 会话详情（含消息）/ 重命名 / 删除 |
| POST | /ai/yiknow/chat | YIKnow 通用会话对话（SSE，同 chat 事件协议 meta/delta/done/error；无 agent_id） |
| GET | /ai/yiknow/conversations | YIKnow 通用会话列表（复用 /ai/conversations/{id} 读写删） |
| GET | /ai/square/kbs | 广场知识库（q/tag/sort/分页） |
| GET | /ai/square/agents | 广场智能体 |
| GET | /ai/integrations | 第三方挂接展示（上架中） |
| GET | /ai/admin/reviews | 审核列表（AI 管理菜单） |
| POST | /ai/admin/reviews/{type}/{id}/{action} | 审核操作（type=kb/agent；action=approve/reject/takedown） |
| GET | /ai/admin/overview | 管理概览统计 |
| GET/POST | /ai/admin/integrations | 挂接列表（含下架）/ 新增 |
| PUT/DELETE | /ai/admin/integrations/{id} | 编辑 / 删除 |
| POST | /ai/admin/integrations/{id}/toggle | 上架/下架 |



---

## 4. 公共规范

### 4.1 认证与请求头

| 头 | 格式 | 说明 |
|----|------|------|
| `Authorization` | `Bearer <JWT>` | HS256；Claims：userId/tenantId/roleCodes/permissions(menus+admin)；有效期 7 天；**逐请求校验会话态**（`RequireActiveUser`）：用户/租户停用、改密后旧 token 下一请求即 401（见 `docs/security-standards.md` §2） |
| `Content-Type` | `application/json`（上传为 `multipart/form-data`） | 请求体上限 10MB |
| `X-Request-ID` | 任意 | 中间件生成，日志关联 |

平台隔离：portal/saas/partner 三端 token 互不可用（`RequirePlatform` 中间件，越界 → 403）。

### 4.2 统一响应结构

| 场景 | 结构 |
|------|------|
| 成功（对象） | 业务对象 JSON 直接返回；创建类返回 `{"id":"..."}` |
| 成功（列表） | `{"items": [...], "total": <count>}` |
| 错误 | `{"error": "<消息>", "code": "<机器码>?"}`——`error` 为面向用户的消息（中文），`code` 为可选机器码，仅在需前端按码分支时出现 |

机器码词汇表（`backend/internal/handler/error_codes.go` 为唯一事实源；前端按 `code` 分支，不解析 `error` 文案）：

| code | 状态码 | 场景 |
|------|--------|------|
| `bad_request` | 400 | 参数/校验错误 |
| `unauthorized` | 401 | 未认证/token 失效 |
| `forbidden` | 403 | 无权限/越权/平台不匹配 |
| `not_found` | 404 | 资源不存在 |
| `conflict` | 409 | 状态冲突/唯一键冲突/外键被引用 |
| `too_many_requests` | 429 | 限流（实际响应 code 为数字 `429`，词汇表仅作映射兜底） |
| `internal_error` | 500 | 服务异常 |
| `ai_not_configured` | 412 | 租户未配置 AI |
| `ai_upstream_error` | 502 | AI 上游错误 |
| `captcha_required` | 400 | 登录需先完成验证码 |
| `captcha_wrong` | 400 | 验证码不匹配 |

历史接口中部分错误仅有 `error` 无 `code`（向后兼容，不强制回填）；新增接口统一按上表。前端实际分支的码：`captcha_required` / `captcha_wrong` / `ai_not_configured`。

### 4.3 分页

- 查询参数：`limit`（1-200，默认 50）、`offset`（默认 0）、`search`（对配置列 ILIKE 模糊匹配）
- 排序：默认 `created_at DESC`；排序列白名单（防注入）
- 响应：`{"items":[], "total":<总数>}`

### 4.4 状态码映射表

| 状态码 | 含义 | 常见场景 |
|--------|------|---------|
| 200 | 成功 | 正常返回 |
| 400 | 参数错误 | 无效请求体/缺字段/校验失败/文件格式错误 |
| 401 | 未认证 | 无 token/token 失效/用户名密码错误 |
| 403 | 无权限 | 角色不匹配/菜单无权限/跨租户操作/平台不匹配 |
| 404 | 资源不存在 | 实体不存在/实体不归属当前租户（同一响应） |
| 409 | 状态冲突 | 非法状态流转/唯一键冲突(23505)/外键被引用(23503)/排课冲突 |
| 412 | 前置条件不满足 | 租户未配置 AI（`ai_not_configured`） |
| 429 | 限流 | 登录 30 次/分钟/IP；AI 20 次/分钟/用户；上传 20 次/分钟/用户；导入导出 10 次/分钟/用户；密码写 10 次/分钟/用户；公开读取 120 次/分钟/IP（见 `docs/security-standards.md` §4） |
| 500 | 服务异常 | `{"error":"服务器内部错误"}`（原始 error 记录日志，不泄露） |
| 502 | 上游错误 | AI 上游非 2xx（透传脱敏 message） |

### 4.5 其他约定

- 超时：业务接口 30s；`/import/`、`/export/`、`/templates/` 前缀 10 分钟
- 操作日志：POST/PUT/DELETE 自动记录（跳过 `/behavior-collection/`、`/view`），异步写 `operation_logs`
- 租户校验：缺租户 `403 {"error":"缺少租户信息"}`；越权操作 `403 {"error":"无权操作：资源不属于您的租户"}`

---

## 5. 变更日志

| 版本 | 日期 | 变更内容 | 影响范围 |
|------|------|---------|---------|
| v1.1 | 2026-08-15 | 新增 §3.9 AI 智能服务中心：知识库/智能体/广场/审核上架/第三方挂接路由面 + SSE 流式协议（meta/sources/delta/done/error）+ 通用收藏类型扩展（ai_kb/ai_agent，仅 published 可收藏） | ai 模块（见 ai-service-center.md §5） |
| v1.0 | 2026-08-14 | **全量审计修订**：补齐 AI（§1.12）/快照 bundle（§1.13）/主题设置/通用收藏/社区/荣誉/标签/引用统计/学校管理员/联盟 search-grants-mentor-options-talent-ranking 等漏登记端点；修正认证规则端点（`/evaluation/certifications/*`）；删除僵尸条目（毕业设计/微证书/测评方法字典/作业提交批改/`exam-usages/{id}/start`/`lesson/nodes/{nodeId}/quizzes` 等）；接口数量更新为 700+；机器码词汇表与 error_codes.go 对齐（§4.2）；uploads 路径与状态码表补 412/502 | 全模块文档 |
| v0.9 | 2026-08-04 | 评价标准保存即落库 + 409 重试；联盟字典码中文化→英文编码（迁移 122）；体系课节点测评提交闭环；`/job/student` 重定向至 `/job/landing` | scene/evaluation、alliance 导入识别、lesson |
| v0.8 | 2026-08-03 | 恢复 RequirePlatform 平台隔离中间件；场景导入按文件后缀推断资源类型 | 安全、导入 |
| v0.7 | 2026-08-01 | 删除 `platform_links`/`app_modules` 表与相关接口（迁移 110）；排课导入导出重构；联盟全主体关联 + 批量导入导出 | 前端配置收敛、affairs、alliance |
| v0.6 | 2026-07-31 | 题库详情批量导出题目为导入模板；人培方案克隆含课程设置 | evaluation、affairs |
| v0.5 | 2026-07-29 | 五套批次表统一（岗位/场景/课程/测评/教务）；工作流+审批+批次 handler 补齐 | 全模块 |
| v0.4 | 2026-07-25 | 跨模块共享组件统一、导航整合与门户落地（Phase 3.6/4） | 前端整体 |
| v0.3 | 2026-07-19 | 前端各模块 wire 真实 API，移除 localStorage mock | 前端 |
| v0.2 | 2026-07-11 | 后端 handler/路由主体建设（job/scene/lesson/evaluation 域） | 后端 |
| v0.1 | 2026-07-01 | 初始化 + 部署基建（deploy.sh/docker-compose） | 基建 |
