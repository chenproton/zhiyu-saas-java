# 后端核心域接口对齐报告：affairs 教务 + partner 产教/联盟 + portal 门户 + AI 中心 + auth/系统/租户/文件

> 范围：Go 端 `backend/go/internal/router/{handlers,routes,routes_affairs,routes_partner,routes_ai_center,menu_grants}.go` 及对应 handler；
> Java 端 `backend/java/ruoyi-modules/ruoyi-zhiyu/.../controller/{affairs,partner,alliance,portal,ai,files,superadmin,system,importexport}/ + ZhiyuAuthController.java`。
> 判定标准：功能等价（路径风格差异不计）。Java 路径均带 `/api/v1` 前缀，与 Go 一致。

## 统计摘要

| 状态 | 端点数（按 Go 端 method+path 计） |
|---|---|
| ✅ 已对齐 | 429 |
| ⚠️ 部分对齐 | 51（端点存在，但鉴权/行为有差异） |
| ❌ 缺失 | 0 |
| ➕ Java 端新增 | 0（本域未检出 Go 没有的 Java 独有业务端点） |

另有 4 项**系统性横切差异**（影响全部端点，未计入上表单端点状态，见第 2 节）。

> 说明：routes.go 中 job/scene/lesson/evaluation/library 各只读面与跨模块引用组（约 40 个端点）属其他域报告范围，已抽查其 Java 对应 Controller（job/lesson/scene/evaluation/library 目录）均存在，本报告不重复计入统计。

---

## 1. 分域端点清单

### 1.1 认证 / 验证码 / 公开设置（Go routes.go:38-53, 98）

| Go 端点 | 功能 | Java 对应 | 状态 |
|---|---|---|---|
| GET /auth/captcha (routes.go:44) | 图形验证码 | ZhiyuAuthController.java:84 @GetMapping("/captcha")，Hutool 验证码 + Redis 设备信任（AuthServiceImpl.java:265） | ✅ |
| POST /auth/login (45) | SaaS 平台登录（Go auth_handler.go:107-109 确证走 saas 平台） | ZhiyuAuthController.java:36-38 login(req,"saas") | ✅ |
| POST /auth/saas/login (46) | SaaS 登录显式路径 | ZhiyuAuthController.java:42-44 | ✅ |
| POST /auth/portal/login (47) | 门户登录 | ZhiyuAuthController.java:48-50 login(req,"portal") | ✅ |
| POST /auth/partner/login (48) | 企业端登录 | ZhiyuAuthController.java:54-56 login(req,"partner") | ✅ |
| POST /auth/partner/register (49) | 企业自助注册 | ZhiyuAuthController.java:90 | ✅ |
| POST /auth/select-tenant (51) | 多租户账号选租户签发 token | ZhiyuAuthController.java:60；ZhiyuAuthFilter.java:53 放行预授权 | ✅ |
| GET /auth/portal/me (routes.go:98) | 门户当前用户 | ZhiyuAuthController.java:72 | ✅ |
| GET /auth/me / /auth/saas/me (340-341) | SaaS 当前用户 | ZhiyuAuthController.java:66,78 | ✅ |
| GET /auth/partner/me (routes_partner.go:17) | 企业端当前用户（含 platform=partner 校验 auth_handler.go:541） | ZhiyuAuthController.java:96；AuthServiceImpl.java:338 有同款 platform 校验 | ✅ |
| GET /settings/theme (routes.go:52) | 公开读租户主题色 | SettingsController.java:26；ZhiyuAuthFilter.java:54 公开放行 | ✅ |

### 1.2 文件（Go routes.go:83-88；router.go:143）

| Go 端点 | Java 对应 | 状态 |
|---|---|---|
| POST /files/upload（uploadLimiter） | ZhiyuFileController.java:35 | ✅ |
| GET /files/preview | ZhiyuFileController.java:47 | ✅ |
| GET /files/sign-url | ZhiyuFileController.java:41 | ✅ |
| GET /uploads/{tenantID}/{filename}（签名/登录/联盟公开文件混合鉴权，router.go:133-143） | ZhiyuUploadsController.java:42（同款 HMAC 签名 + 登录态 + IsPublicAllianceFile 放行，注释明言对齐） | ✅ |

### 1.3 系统管理 / 租户 / 用户 / 角色 / 参考数据（Go registerPortalRoutes routes.go:583-667 + 只读组 197-201, 236-248, 333）

| Go 端点 | Java 对应 | 状态 |
|---|---|---|
| GET /tenants、GET/PUT /tenants/{id}（584-586；333 登录可读本租户） | TenantController.java:30,39,44（SystemTenantServiceImpl.java:73 非管理员限本租户，对齐） | ✅ |
| GET/PUT/DELETE /ai/config、GET /ai/usage（589-592） | AiConfigController.java:39-62 | ✅ |
| GET/POST /admins、PUT/DELETE /admins/{id}、POST /admins/{id}/reset-password（594-598） | TenantAdminController.java:34-56 | ✅ |
| GET /organizations、/tree、GET/POST/PUT/DELETE（600-605） | OrganizationController.java:36-66 | ✅ |
| GET/POST/PUT/DELETE /org-types（607-611） | OrgTypeController.java:34-58 | ✅ |
| POST/PUT/DELETE /users、POST /users/{id}/status、/reset-password、/roles、/batch、/batch-graduate、/batch-delete、/batch-org-node（613-622） | UserController.java:61-107（10 端点全） | ✅ |
| GET /users、GET /users/{id}（199-200，RequireUserRead） | UserController.java:42,56 | ✅ |
| GET/POST/GET{}/PUT/DELETE /staff-titles、POST /{id}/status（624-631） | StaffTitleController.java:35-62 | ✅ |
| GET /user-extension-fields、PUT /{id}（633-636） | UserExtensionFieldController.java:31,37 | ✅ |
| GET/POST/DELETE /user-relations（638-642） | UserRelationController.java:33-45 | ✅ |
| GET/POST/PUT/DELETE /roles、GET /{id}、POST /{id}/assign（644-649） | RoleController.java:35-63 | ✅ |
| POST/PUT/DELETE /majors（651-653）+ GET /majors{,/{id}}（239-240） | MajorController.java:34-57 | ✅ |
| POST/PUT/DELETE /industries（655-657）+ GET（241-242） | IndustryController.java:34-58 | ✅ |
| GET/POST/PUT/DELETE /resource-codes（659-663） | ResourceCodeController.java:34-57 | ✅ |
| GET /logs/login（665） | LogController.java:27 | ⚠️ 端点与查询在，但 **Java 端无登录日志写入点**：Go 登录链路调 RecordLoginLog（service/auth.go:35，store/auth.go:92 INSERT INTO login_logs），Java AuthServiceImpl 全文无 LoginLog 写入（grep 0 命中），列表将永远为空 |
| GET /logs/operation（666） | LogController.java:35 | ⚠️ 同上：Go 由 OperationLog 中间件统一审计写操作（routes.go:78，middleware/oplog.go:129）；Java 全模块 SystemOperationLogMapper 只有 LogController 读取、无任何 insert（grep 确认） |
| 参考数据只读组：GET /majors{,/{id}}、/industries{,/{id}}、/organizations{,/tree,/{id}}、/org-types{,/{id}}（239-247，共 9） | 同上新对应 Controller | ✅ |

### 1.4 SaaS 超管（Go registerSuperAdminRoutes routes.go:358-392，26 端点）

| Go 端点组 | Java 对应 | 状态 |
|---|---|---|
| GET/POST/PUT/DELETE /admin/tenants、POST /{id}/status、GET/PUT /{id}/enterprise（359-365） | SuperAdminController.java:46-80 | ✅ |
| /admin/tenants/{tenantId}/admins CRUD + reset-password（367-371，5 端点） | SuperAdminController.java:99-121 | ✅ |
| /admin/tenants/{tenantId}/enterprise-admins CRUD + reset-password（372-376，5 端点） | SuperAdminController.java:129-152 | ✅ |
| GET/PUT /admin/tenants/{tenantId}/subscription（378-379） | SuperAdminController.java:86-91 | ✅ |
| GET/PUT/DELETE /admin/tenants/{tenantId}/ai/config（382-384，超管代租户维护 tenant_ai_configs） | AiTenantConfigController.java:31-42 | ✅ |
| GET/PUT /admin/settings/theme（386-387） | SuperAdminController.java:160-165 | ✅ |
| PUT/DELETE /admin/tenants/{tenantId}/settings/theme（389-390） | SuperAdminController.java:170-175 | ✅ |
| GET /subscriptions（routes.go:99，租户自读订阅） | SubscriptionController.java:24 | ✅ |

### 1.5 门户工作台 / 社区 / 收藏（Go routes.go:127-160）

| Go 端点 | Java 对应 | 状态 |
|---|---|---|
| GET /portal/workspace/dashboard（131，30s 缓存） | PortalWorkspaceController.java:44 | ✅ |
| GET /portal/workspace/my-schedule（132） | PortalWorkspaceController.java:50 | ✅ |
| GET/POST/PUT/DELETE /portal/workspace/honors{,/{id}}（134-137） | PortalWorkspaceController.java:56-74 | ✅ |
| PUT /portal/workspace/me（139）、POST /me/password（140） | PortalWorkspaceController.java:80,86 | ✅ |
| GET/POST /portal/community/topics、GET /topics/{id}、GET/POST /topics/{id}/replies（142-146） | PortalCommunityController.java:35-62 | ✅ |
| GET /favorites、GET/POST /favorites/{targetType}/{id}（157-159） | FavoritesController.java:28-40 | ✅ |
| GET/POST /job/positions/{id}/favorite、GET /job/positions/favorites（154-156，job 域） | JobPositionController.java:138-150 | ✅ |

### 1.6 工作流 / 审批（Go registerWorkflowRoutes routes.go:394-406 + affairs workflows）

| Go 端点 | Java 对应 | 状态 |
|---|---|---|
| GET/POST/GET{}/PUT/DELETE /workflows（396-400） | JobWorkflowController.java:35-62 | ✅ |
| GET/POST /approvals、GET /{id}、POST /{id}/review（402-405） | JobApprovalController.java:32-55 | ✅ |
| GET/POST/GET{}/PUT/DELETE /affairs/workflows（routes_affairs.go:28-32） | AffairsWorkflowController.java:38-65 | ✅ |

### 1.7 affairs 教务（Go routes_affairs.go，72 端点）

| Go 端点组 | Java 对应 | 状态 |
|---|---|---|
| 学期 GET/POST/PUT/DELETE /affairs/terms（15-18） | AffairsTermController.java:36-55 | ✅ |
| 人培方案内容路由 13 个 /affairs/programs（21，registerContentRoutes=List/Get/Create/Update/Delete/submit/review/publish/archive/unpublish/withdraw/save-draft/invite） | TrainingProgramController.java:42-107（13 全） | ✅ |
| GET/PUT /affairs/programs/{id}/courses、POST /{id}/clone（22-24） | TrainingProgramController.java:112-123 | ✅ |
| 批次 6 个 /affairs/batches（27，registerBatchRoutes=List/Get/Create/Update/Delete/status） | AffairsBatchController.java:37-67 | ✅ |
| 教学计划内容路由 13 个 /affairs/teaching-plans（35） | TeachingPlanController.java:47-112 | ✅ |
| PUT/DELETE /teaching-plans/entries/{id}、POST /{id}/confirm、GET /{id}/export（36-40） | TeachingPlanController.java:117-132 | ✅ |
| 场地 GET/POST/PUT/DELETE /affairs/venues（43-46） | AffairsVenueController.java:36-55 | ✅ |
| 节次 POST /period-slots、PUT /replace、PUT/DELETE /{id}（49-53）+ GET 登录公开只读（routes.go:328） | AffairsPeriodSlotController.java:37-59 | ✅ |
| 排课 GET/POST/PUT/DELETE /schedules、POST /auto-schedule、POST /publish、GET /timetable、GET /export（56-64） | AffairsScheduleController.java:45-96 | ✅ |
| POST /import/schedules/excel、/preview（67-68） | ImportExportController.java:83(/import/{entity}/excel)+70(preview)，ImportExportServiceImpl.java:850 case "schedules"（含 termId 参数） | ✅（通用化路径，功能等价） |
| POST /import/program-courses/excel、/preview、GET /templates/program-courses（72-74） | 同上，:852 case "program-courses"（含 programId）；模板 :176 模板 switch | ✅ |
| POST /import/affairs-config/excel、GET /templates/affairs-config（77-78） | 同上，:851 case "affairs-config" | ✅ |

### 1.8 partner 企业端（Go routes_partner.go，73 端点）

| Go 端点组 | Java 对应 | 状态 |
|---|---|---|
| 读与个人操作（partnerUser 组，20-33）：/partner/enterprise/profile GET、/experts/me GET+PUT、/workspace/dashboard、/schools、/cooperation ×4、/mentor-tasks、/me/password（11 端点） | PartnerController.java:52-144 全覆盖 | ✅ |
| 就业服务（37-46，10 端点）：employment-projects list/get、employment-jobs CRUD+status、applications list/get | PartnerEmploymentController.java:39-88 全覆盖 | ✅ |
| 资源共建（48-91，44 端点）：positions 13、scenes 8、tasks 7、weights 2、schools/{tenantId}/* 14 | PartnerCoBuildController.java:64-338 逐条全对应（含 evaluation-methods、weights、14 个 schools 子资源） | ✅ |
| **仅企业管理员写**（adminOnly 组，routes_partner.go:95-104，7 端点）：PUT /enterprise/profile、PUT /schools/{tenantId}/status、experts GET/GET{}/POST/PUT/DELETE | PartnerController.java:57,114,64-97（端点存在） | ⚠️ **Java 端无 enterprise_admin 角色拦截**：Go 路由层 RequireRole(enterprise_admin)；Java PartnerServiceImpl 全文无角色校验（grep Role 仅见种子账号创建 :582-601），enterprise_member 可调全部写接口 |

### 1.9 alliance 联盟/产教（Go routes.go:479-581）

管理面 60 端点（读 26 + 写 34）+ 公开前台 21 端点：

| Go 端点组 | Java 对应 | 状态 |
|---|---|---|
| 管理面只读 26 端点（481-508）：school-info、enterprises(+search,+{id})、grants(+resource-options)、projects(+{id},+milestones)、achievements(+{id})、experts(+mentor-options,+{id})、agreements(+{id})、permissions(+{id})、brands(+talent-ranking,+rank-configs,+{id})、employment-projects(+{id})、employment-jobs、employment-applications | AllianceController.java:34-343 + AllianceEmploymentController.java:33-77，逐条对应 | ✅ |
| 管理面写 34 端点（513-552）：school-info PUT、enterprises register/update/link/unlink×2、grants PUT、employment-projects CUD、employment-jobs status、projects CUD、milestones CUD、achievements CUD、experts display+CUD、agreements CUD、permissions CUD、dictionaries CUD、brands CUD+rank-configs PUT | AllianceController.java:39-343 + AllianceEmploymentController.java:47-72（端点全在） | ⚠️ **授权面缺失**：Go 挂 RequireMenu(allianceManageMenus)（routes.go:232-233，menu_grants.go:94-112）且 handler 层 canManageAlliance 纵深防御（routes.go:510-512 注释）；Java AllianceServiceImpl 无任何 canManage/角色检查（grep 0 命中），任何登录用户可写联盟数据 |
| 公开前台 21 端点（557-580）：school-info、enterprises(+{id})、projects(+{id},+milestones)、achievements(+{id})、agreements、experts(+{id})、brands(+talent-ranking,+{id})、stats、employment-projects(+{id},+{id}/jobs)、employment-jobs/{id}、POST apply、applications/mine | AlliancePublicController.java:29-114（15）+ AlliancePublicEmploymentController.java:31-60（6） | ✅ |
| 字典只读 GET /alliance/dictionaries/{dictType}（routes.go:187，跨模块只读组） | AllianceController.java:242 | ✅ |

### 1.10 AI 中心（Go routes_ai_center.go，42 端点 + /ai/chat 等 3 端点）

| Go 端点组 | Java 对应 | 状态 |
|---|---|---|
| POST /ai/chat、/ai/position-assist、/ai/scenario-assist（routes.go:104-107，aiLimiter） | AiConfigController.java:69-81 | ✅ |
| 知识库 15 端点（routes_ai_center.go:15-30）：kb CRUD+submit/unpublish、documents list/upload/get/delete、collaborators list/add/upsert(PUT)/remove、ask | AiKbController.java:42-133 全 15 个（含 PUT collaborators/{userId} upsert :114） | ✅ |
| 智能体 10 端点（33-41,50）：agents CRUD+submit/unpublish+chat+conversations+preview | AiAgentController.java:37-85 | ✅（SSE 协议 meta/sources/delta/done 对齐，AiWeb.java:52-82 真流式） |
| 会话 3 端点（42-44）：conversations get/delete/patch(rename) | AiConversationController.java:30-40 | ✅ |
| KB 问答记录 + YIKnow 3 端点（47-49）：kb/{id}/asks、yiknow/conversations、yiknow/chat | AiKbController.java:127 + AiYiknowController.java:31-37 | ✅ |
| 广场/挂接 3 端点（53-55）：square/kbs、square/agents、integrations | AiSquareController.java:31-57 | ✅ |
| **管理端 8 端点（61-70）**：admin/reviews、reviews/{type}/{id}/{action}、overview、admin/integrations CRUD+toggle | AiAdminController.java:37-78（端点全在） | ⚠️ **授权面差异**：Go 为菜单驱动 RBAC——RequireMenu("/portal/apps/ai/admin/reviews","/portal/apps/ai/admin/integrations")（routes_ai_center.go:62），自定义角色勾选菜单即授权；Java 仅 AiCenterServiceImpl.java:1123 判断旧单角色字段 user.getRole()=="school_admin"，不支持菜单授权，自定义角色获得 AI 管理菜单后仍会被拒 |

service 层深核：Java IAiCenterService（129 行接口）与 Go AICenterService（ai_center_kb/doc/agent/retrieval/v22/admin 六个文件）逐方法对应——文档上传解析、分块检索、KB 问答（含 sources）、agent 会话持久化、协作者 upsert、广场筛选（majorId/departmentId/kbType/updated 参数一致）、审核动作、挂接维护均等价，SSE 事件协议一致。

### 1.11 导入 / 导出 / 模板（Go registerImportExportRoutes routes.go:408-473，64 端点）

| Go 端点组 | Java 对应 | 状态 |
|---|---|---|
| GET /export/{entity}、POST /import/{entity}、POST /import/{entity}/preview（409-411，通用 CSV） | ImportExportController.java:61,70,116 | ✅ |
| 17 组 Excel 导入 excel/preview（412-445：positions/scenarios/question-banks/questions/exams/courses/granular-courses/industries/majors/organizations/students/teachers/alliance-projects/-achievements/-agreements/-permissions/-brands） | /import/{entity}/excel + /preview 通用化（:83,:70）；实体覆盖 ImportExportServiceImpl.java:832-852 全 19 case；questions 专用 bankId 路径 :95-111 | ✅ |
| 17 个模板下载 GET /templates/*（446-462） | GET /templates/{entity}（:45）+ question-banks/{bankId}/questions（:52） | ✅ |
| 10 个 Excel 导出 POST /export/*/excel（463-472） | POST /export/{entity}/excel（:126）+ questions 专用（:134）；导出实体 switch ImportExportServiceImpl.java:471-504 与 Go 10 个一致 | ✅ |

---

## 2. 系统性横切差异（影响面大，单独列出）

| # | 差异 | Go 证据 | Java 证据 | 影响 |
|---|---|---|---|---|
| S1 | **平台 token 隔离缺失**：Go 强制 RequirePlatform(portal/saas/partner)，partner token 无法调 portal 接口 | routes.go:84(AnyPlatform), 92(portal), 338(saas), 352(partner) | ZhiyuAuthFilter 只校验登录+启用状态（:67-119），TenantContext.getPlatform() 无人调用（仅 AuthServiceImpl.java:338 一处用于 /auth/partner/me） | 跨平台越权面：持 partner/saas token 可访问 portal 业务端点 |
| S2 | **菜单驱动 RBAC（ADR-0008）整体缺失**：Go 按菜单授权面挂载 RequireMenu（业务管理面/只读面/导入导出/工作流/AI 管理） | menu_grants.go 全文；routes.go:117,123,151,167,192,205-234,256,275,287,299,318 | SystemGuard.java:16-17 注释明言「简化为角色码兜底：school_admin/platform_admin 视为系统管理权限，自定义角色菜单授权暂不支持」；业务域（partner/alliance/affairs 等）连角色兜底也无 | ①自定义角色授权模型不工作；②partner/alliance 写接口无角色拦截（1.8/1.9 ⚠️ 项） |
| S3 | **限流全部缺失**：Go 8 类 Redis 限流（login 30/min、captcha 10/min、theme/public-read 120/min、import-export 10/min、upload 20/min、ai 20/min、password 10/min） | routes.go:39-73；routes_affairs.go:11-12 | zhiyu 模块 grep RateLimiter/rateLimit 0 命中 | 登录爆破、验证码刷 CPU、AI 额度打爆、导入导出资源耗尽均无防护 |
| S4 | **审计日志只读不写**（详见 1.3 ⚠️ 两行） | routes.go:78 OperationLog；service/auth.go:35 RecordLoginLog | SystemLogServiceImpl 仅 select；无 insert | /logs/login、/logs/operation 有接口无数据 |

---

## 3. ❌ 缺失清单

无。本域 Go 端全部 HTTP 接口在 Java 端均找到功能等价实现（路径通用化不计缺失）。

## 4. ➕ Java 端新增

本域未检出 Go 端没有的 Java 独有业务端点（89 个 Java Controller 逐映射核对；AiWeb.java 为 SSE 辅助类非端点）。

---

## 5. 最重要缺口 Top 10（按风险排序）

1. **平台 token 隔离缺失（S1）** — partner/saas token 可调 portal 全部业务接口；Go routes.go:92/338/352 vs Java ZhiyuAuthFilter 无对应校验。
2. **partner 企业管理员写接口无角色拦截** — enterprise_member 可改企业资料/专家库/合作状态；Go routes_partner.go:95-104 adminOnly vs Java PartnerController/PartnerServiceImpl 无校验。
3. **alliance 联盟写接口（34 个）无授权校验** — 任何登录用户可改学校联盟信息/项目/成果/协议/品牌；Go routes.go:232-233 RequireMenu + canManageAlliance vs Java AllianceServiceImpl 无对应。
4. **菜单驱动 RBAC 整体缺失（S2）** — 自定义角色通过菜单勾选获权的核心授权模型（ADR-0008）在 Java 端未实现，SystemGuard.java:16-17 自认简化。
5. **AI 管理端授权退化** — 菜单授权 → 旧 user.role=="school_admin" 单字段判断；Go routes_ai_center.go:62 vs Java AiCenterServiceImpl.java:1123。
6. **登录/密码/验证码无限流（S3）** — 登录爆破与验证码刷 CPU 无防护；Go routes.go:39-51 vs Java 0 处限流。
7. **AI/上传/导入导出无限流（S3）** — LLM 按 token 计费额度可被单用户打爆；Go routes.go:66-69。
8. **操作日志有接口无数据（1.3/S4）** — GET /logs/operation 永远空；Go middleware/oplog.go:129 vs Java 无写入点。
9. **登录日志有接口无数据（1.3/S4）** — GET /logs/login 永远空；Go service/auth.go:35 vs Java AuthServiceImpl 无 RecordLoginLog 对应。
10. **系统管理写操作的角色兜底覆盖不全** — Java 仅 system 域服务有 SystemGuard（requireManagePortal/ManageUsers），affairs/partner/alliance/ai 等业务写面既无菜单也无角色校验（S2 的具象化）。

---
*报告生成：逐端点核对 Go 路由 4 文件 + router.go 辅助注册器 vs Java 89 个 Controller 映射注解 + 关键 service/filter 实现。*
