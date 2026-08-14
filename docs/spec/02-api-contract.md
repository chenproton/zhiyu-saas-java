# 接口契约文档 — 知与 SaaS

> 基于后端源码（`backend/internal/router/`、`backend/internal/handler/`）回溯整理。
> 全量接口约 **560+ 个**（含按角色组重复注册的只读接口），本文档以「公共规范 + 通用模式 + 模块清单 + 代表性详写」方式记录，未逐接口展开的遵循同名通用模式。
> 企业平台（Partner）的接口（`/partner/*`、`/auth/partner/*`）在子平台 spec [`partner-enterprise-platform.md`](partner-enterprise-platform.md) §5 单独记载，本文档不重复。

---

## 1. 接口清单（按模块分组）

所有接口前缀 `/api/v1`。权限列标记三档：`公开` = 无需 JWT（匿名）；`登录公开` = 任意已登录用户可见（如 `/alliance/public/*`、`/job/public/*`，仍需 JWT）；其余为 JWT 校验后的角色/菜单组。只读接口（List/Get）普遍同时在更宽角色组（jobViewer 含学生）注册。

### 1.0 全局 / 文件 / 认证

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/health` | 公开 | 健康检查 |
| GET | `/uploads/{filename}` | 公开 | 静态文件 |
| POST | `/api/v1/files/upload` | JWT | 文件上传（multipart/form-data, `file` 字段） |
| GET | `/api/v1/files/preview` | JWT | 文件预览（返回预览 URL） |
| POST | `/api/v1/auth/login` | 公开(限流) | 通用登录（saas 语义） |
| POST | `/api/v1/auth/saas/login` | 公开(限流) | SaaS 运营端登录 |
| POST | `/api/v1/auth/portal/login` | 公开(限流) | Portal 教育端登录 |
| POST | `/api/v1/auth/select-tenant` | 公开 | 多租户账号选择租户 |
| GET | `/api/v1/auth/portal/me` | portal | 当前用户信息（portal） |
| GET | `/api/v1/auth/me` | portal | 当前用户信息（通用，含租户/机构/组织/角色） |
| GET | `/api/v1/subscriptions` | portal | 当前租户订阅套餐 |
| GET | `/api/v1/stats/me` | saas | 我的统计 |

### 1.1 岗位管理（job，`/job/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/POST | `/job/positions`、`/{id}`、`/`(POST) | businessUser 写 / jobViewer 读 | 岗位内容资源（13 动作，见 §2.1） |
| PUT | `/job/positions/{id}/save-full` | businessUser | 整单保存（构建器一次提交） |
| POST | `/job/positions/{id}/clone` | businessUser | 克隆岗位 |
| GET/POST | `/job/positions/{id}/favorite` | 全部 | 收藏状态/切换收藏 |
| GET | `/job/positions/favorites` | 全部 | 我的收藏列表 |
| GET | `/job/public/positions`、`/{id}` | jobViewer | 公开岗位列表（2min 缓存）/详情 |
| GET/POST/PUT/DELETE | `/job/abilities`、`/ability-domains` | jobViewer 读 / businessUser 写 | 能力点、能力域（5 动作 CRUD） |
| GET/POST/PUT/DELETE | `/job/position-abilities`、`/position-responsibilities`、`/position-certificates` | 同上 | 岗位能力绑定/职责/证书 |
| GET/POST/PUT/DELETE | `/job/certificate-library` | businessUser | 证书库（5 CRUD） |
| GET/POST/PUT/DELETE | `/job/recommendations` | businessUser | 岗位推荐（4：List/Create/Update/Delete） |
| GET/POST/PUT/DELETE | `/job/learn-roads` | businessUser | 学习路径（5 CRUD） |
| GET/POST/PUT/DELETE | `/job/banners` | businessUser | 岗位首页轮播配置 |
| GET/POST/PUT/DELETE/POST /{id}/status | `/job/batches` | businessUser | 岗位批次（6 动作，见 §2.2） |

### 1.2 场景实训（scene，`/scene/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST/PUT/DELETE + 状态动作 | `/scene/scenarios`、`/{id}` | businessUser 写 / jobViewer 读 | 场景内容资源（写 11 动作；List 挂 2min 缓存） |
| POST | `/scene/scenarios/{id}/clone` | businessUser | 克隆场景 |
| POST/PUT/DELETE | `/scene/tasks`、`/scene/tasks/reorder` | businessUser 写 / jobViewer 读 | 场景任务 |
| PUT | `/scene/tasks/{taskId}/evaluation-methods` | businessUser | 保存任务评价方式（SaveMethods） |
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
| GET | `/lesson/courses/{id}/assessments` | businessUser | 课程评估汇总 |
| POST | `/lesson/courses/{id}/homeworks/{homeworkId}/submit` | jobViewer | 课程作业提交 |
| GET | `/lesson/courses/{id}/homeworks/{homeworkId}/submissions` | businessUser | 作业提交列表 |
| POST | `/lesson/courses/{id}/homeworks/{homeworkId}/grade` | businessUser | 作业批改 |
| POST | `/lesson/nodes/{nodeId}/homeworks/{homeworkId}/submit`、`/grade` | 学生/教师 | 节点作业提交/批改 |
| GET/POST/PUT/DELETE | `/lesson/knowledge-points` | jobViewer 读 / businessUser 写 | 知识点 |
| POST/PUT/DELETE | `/lesson/nodes`、`/lesson/nodes/reorder` | businessUser 写 / jobViewer 读 | 课程节点 |
| GET/POST | `/lesson/node-evaluation-results` | jobViewer | 节点评价结果列表/提交 |
| GET/POST/PUT/DELETE | `/lesson/nodes/{nodeId}/quizzes`（8 动作） | businessUser | 节点测验：ListQuizzes/CreateQuiz/ListQuestions/UpdateQuiz/DeleteQuiz/AddQuestion/UpdateQuestion/DeleteQuestion |
| GET/POST/PUT/DELETE | `/lesson/nodes/{nodeId}/homeworks` | businessUser | 节点作业（5 CRUD） |
| GET/POST/DELETE | `/lesson/nodes/{nodeId}/resources`、`/lesson/courses/{courseId}/resources` | businessUser | 节点/课程资源（4 动作） |
| GET/POST/PUT/DELETE | `/lesson/hybrid-modules` | businessUser | 混合教学模块 |
| GET/POST/PUT/DELETE/POST /{id}/status | `/lesson/batches` | businessUser | 课程批次（6 动作） |
| POST | `/lesson/behavior-collection/records` | jobViewer | 课堂行为打卡 |
| GET | `/lesson/behavior-collection/aggregate` | businessUser | 行为聚合 |

### 1.4 考核评价（evaluation，`/evaluation/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/POST + 状态动作 | `/evaluation/question-banks`、`/{id}` | businessUser 写 / jobViewer 读 | 题库内容资源（13 动作） |
| GET/POST/PUT/DELETE | `/evaluation/questions`、`/evaluation/questions/batch` | businessUser | 试题 CRUD + 批量创建 |
| GET/POST/PUT/DELETE | `/evaluation/random-draw-questions` | businessUser | 随机抽题（5 CRUD） |
| POST/PUT/DELETE + 状态动作 | `/evaluation/exams`、`/{id}` | businessUser 写 / jobViewer 读 | 试卷（写 11 动作） |
| POST/PUT/DELETE | `/evaluation/exams/{id}/questions`（组卷 4 动作） | businessUser | 组卷/调分值/改题/删题 |
| GET/POST/PUT/DELETE/POST /{id}/finish、/{id}/start | `/evaluation/exam-usages` | businessUser 写 / jobViewer 含学生读+start | 考试场次 |
| GET/POST | `/evaluation/exam-results` | 教师 List / 学生 Create | 考试成绩 |
| GET/POST | `/evaluation/results` | jobViewer 读+Submit / businessUser | 评估结果列表/提交 |
| GET/POST | `/evaluation/results/{id}/grade`、`/results/batch-grade` | businessUser | 评分/批量评分 |
| GET/POST | `/evaluation/job-ability/results`、`/summary`、`/aggregate`、`/aggregate/status` | jobViewer 读 / businessUser | 岗位能力汇聚结果/触发聚合 |
| GET/POST/PUT/DELETE | `/evaluation/certification/...`（21 个） | businessUser | 认证规则/模型/权重/能力项/任务，见 §3.4 |
| GET/POST/PUT/DELETE | `/evaluation/graduation/topics`、`/archives`、`/evaluations`、`/query`（11 个） | businessUser | 毕业设计 |
| GET/POST/PUT/DELETE | `/evaluation/portraits`（generate/archives） | jobViewer 含学生 / businessUser | 学生画像 |
| GET/POST/PUT/DELETE | `/evaluation/micro-cert/templates`、`/certificates/issue`、`/history` | businessUser | 微证书 |
| GET/POST | `/evaluation/methods/categories`、`/methods`、`/methods/{id}/toggle` | jobViewer | 测评方法字典 |
| GET/POST | `/evaluation/appeals`、`/{id}`、`/{id}/process` | 全部 | 成绩申诉 |
| GET/POST/PUT/DELETE/POST /{id}/status | `/evaluation/batches` | businessUser | 测评批次（6 动作） |
| GET | `/evaluation/landing/exams`、`/landing/certifications/{id}/grades` | portal 业务角色（2min 缓存） | 学生落地页 |

### 1.5 资源库（library，`/library/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/POST/PUT/DELETE | `/library/resources` | jobViewer 读 / businessUser 写 | 资源库（5 CRUD） |
| GET/POST/PUT/DELETE | `/library/on-site-questions` | 同上 | 现场问答题库 |

### 1.6 教务管理（affairs，`/affairs/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/POST/PUT/DELETE | `/affairs/terms` | businessUser | 学期（4 CRUD） |
| GET/POST + 状态动作 | `/affairs/programs`、`/{id}` | businessUser | 人培方案（13 动作 + GET/PUT `/{id}/courses` + clone） |
| GET/POST/PUT/DELETE/POST /{id}/status | `/affairs/batches` | businessUser | 教务批次（6 动作） |
| GET/POST/PUT/DELETE | `/affairs/workflows` | businessUser | 工作流（5 CRUD） |
| GET/POST | `/affairs/teaching-plans`、`/{id}`、`/entries/{id}`、`/{id}/confirm` | businessUser | 教学计划（生成/确认） |
| GET/POST/PUT/DELETE | `/affairs/venues`、`/period-slots` | jobViewer 读 / businessUser 写 | 场地、节次 |
| GET/POST | `/affairs/schedules`（8 个：List/Create/auto-schedule/Update/Delete/publish/timetable/export） | businessUser | 排课 |
| GET | `/portal/workspace/my-schedule` | portalWorkspace | 我的课表（学生/教师） |

### 1.7 门户系统管理（portal + systemAdmin，`/portal/...` 与 `/...`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/PUT | `/tenants`、`/tenants/{id}` | systemAdmin | 租户信息（当前租户） |
| GET/POST/PUT/DELETE | `/organizations`、`/organizations/tree`、`/org-types` | systemAdmin | 组织/组织类型 |
| GET/POST/PUT/DELETE | `/users`（10 个写动作 + List） | systemAdmin 写 / RequireUserRead 读 | 用户管理（创建/批量创建/毕业/删除/改密/绑定角色等） |
| GET/POST/PUT/DELETE | `/staff-titles`、`/user-extension-fields`、`/user-relations` | systemAdmin | 职称/扩展字段/用户关系 |
| GET/POST/PUT/DELETE | `/roles`、`/roles/{id}/assign` | systemAdmin | 角色与授权 |
| GET/POST/PUT/DELETE | `/majors`、`/industries` | businessUser 读 / systemAdmin 写 | 专业/行业字典 |
| GET/POST/PUT/DELETE | `/resource-codes` | systemAdmin | 资源编码 |
| GET | `/logs/login`、`/logs/operation` | systemAdmin | 审计日志 |
| GET | `/portal/workspace/dashboard` | portalWorkspace（30s 缓存） | 工作台聚合 |
| PUT | `/portal/workspace/me`、`/me/password` | portalWorkspace | 个人资料/改密 |

### 1.8 工作流 / 审批（portal，school_admin/teacher）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET/POST/PUT/DELETE | `/workflows` | school_admin/teacher | 审批流程模板 |
| GET/POST | `/approvals`、`/{id}`、`/{id}/review` | school_admin/teacher | 审批记录 |

### 1.9 联盟（alliance，`/alliance/*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/alliance/public/school-info`、`/enterprises`、`/projects`、`/achievements`、`/experts`、`/brands`（List+Get 共 12 个）+ `GET /stats` | 登录公开（任意已登录用户） | 登录公开只读 |
| GET/PUT | `/alliance/school-info` | systemAdmin | 学校信息 |
| GET/POST/PUT/DELETE | `/alliance/enterprises`（5 CRUD）+ `/enterprises/{eid}/agreements`（4） | systemAdmin | 合作企业 |
| GET/POST/PUT/DELETE | `/alliance/projects`（5 CRUD）+ `/projects/{pid}/milestones`（4） | systemAdmin | 合作项目 |
| GET/POST/PUT/DELETE | `/alliance/achievements`、`/experts`、`/agreements`、`/permissions`、`/brands` | systemAdmin | 成果/专家/协议/权限/品牌（各 5 CRUD） |
| GET/POST/PUT/DELETE | `/alliance/dictionaries/{dictType}`、`/dictionaries/{dictType}/{id}` | systemAdmin | 合作字典 |

### 1.10 导入 / 导出 / 模板（portal + businessUser；10min 长超时）

**通用实体**（`/export/{entity}`、`/import/{entity}`、`/import/{entity}/preview`，CSV）：基础字典类（行业/专业/组织/学生/教师等，支持 `?overwrite=1` 覆盖更新）。

**Excel 三件套**（每实体：`/import/{entity}/excel` + `/import/{entity}/preview` + `/templates/{entity}`）：

| 实体 | 说明 |
|------|------|
| positions / scenarios / question-banks / question-banks/{bankId}/questions / exams / courses / granular-courses | 岗位/场景/题库/题目/试卷/体系课/颗粒课 |
| industries / majors / organizations / students / teachers | 基础数据（另含 `/export/{entity}/excel` 导出） |
| alliance-projects / alliance-achievements / alliance-agreements / alliance-permissions / alliance-brands | 联盟 5 实体（企业/专家导入已随 Partner 平台移除） |
| schedules / program-courses / affairs-config | 排课/人培课程/教务配置 |

### 1.11 SaaS 运营端（saas token + platformAdmin，`/admin/*`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/PUT/DELETE/PUT /{id}/status | `/admin/tenants` | 租户 CRUD（AdminList/Create/Update/UpdateStatus/Delete） |
| GET/POST/PUT/DELETE/POST /{id}/reset-password | `/admin/tenants/{id}/admins` | 租户管理员管理（5） |
| GET/PUT | `/admin/subscriptions` | 订阅套餐 |

---

## 2. 通用模式（契约模板）

### 2.1 内容资源 13 动作（岗位/场景/课程/题库/试卷）

| 动作 | 方法/路径 | 语义 | 状态转移 |
|------|----------|------|---------|
| List | `GET {base}` | 分页列表 | — |
| Get | `GET {base}/{id}` | 详情 | — |
| Create | `POST {base}` | 创建草稿 | → draft |
| Update | `PUT {base}/{id}` | 更新（可编辑态） | draft/rejected/approved/published |
| Delete | `DELETE {base}/{id}` | 物理删除 | draft/rejected/archived |
| Submit | `POST {base}/{id}/submit` | 提交审批 | → pending |
| Review | `POST {base}/{id}/review` | 审批通过/驳回 | → approved / rejected |
| Publish | `POST {base}/{id}/publish` | 发布 | → published |
| Archive | `POST {base}/{id}/archive` | 归档 | → archived |
| Unpublish | `POST {base}/{id}/unpublish` | 取消发布 | → draft |
| Withdraw | `POST {base}/{id}/withdraw` | 撤回审批 | → draft |
| SaveDraft | `POST {base}/{id}/save-draft` | 回退草稿 | approved/published → draft |
| Invite | `POST {base}/{id}/invite` | 协作者邀请 | — |

非法转移返回 `409 {"error": "..."}`；动作经 `store.ContentActionStore` 统一校验。

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
  "major": null,
  "roles": [ { "id": "...", "code": "teacher", "name": "教师" } ]
}
```

### 3.3 内容发布流转（以岗位为例）

**POST `/api/v1/job/positions/{id}/submit`** → `200 {"id":"..."}`；已 published 提交 → `409`
**POST `/api/v1/job/positions/{id}/review`** 请求体 `{"approved": true, "comment": "同意"}` → `200`
**POST `/api/v1/job/positions/{id}/publish`** → `200`
非法流转（如 draft 直接 publish）→ `409 {"error":"当前状态不允许该操作"}`

### 3.4 认证规则（21 个接口速览）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/evaluation/certification/rules`、`/{id}` | 规则列表/详情 |
| GET/PUT | `/evaluation/certification/rules/{id}/model`、`/weights` | 规则模型/两级权重 |
| POST | `/evaluation/certification/rules`、`/rules/{id}/items`、`/points`、`/tasks` | 创建规则/能力项/能力点/关联任务 |
| PUT | `/evaluation/certification/rules/{id}`、`/items/{itemId}`、`/points/{pointId}`、`/tasks/{taskId}`、`/full` | 更新 |
| POST | `/evaluation/certification/rules/{id}/status` | 启用/停用 |
| DELETE | `/evaluation/certification/rules/{id}`、`/items/{itemId}`、`/points/{pointId}`、`/tasks/{taskId}` | 删除 |

业务规则：每岗位唯一规则（`(tenant, position)` 唯一）；能力项可 inherit（继承岗位绑定）或 custom；权重两级（能力点占任务分 0-100 / 任务占岗位分）。

### 3.5 排课

**POST `/api/v1/affairs/schedules`**

- 请求体（示例）：
```json
{
  "termId": "...", "teachingPlanEntryId": "...", "dayOfWeek": 3,
  "periods": [1, 2], "weekPattern": "all", "classNodeIds": ["..."],
  "teacherId": "...", "venueId": "...", "type": "traditional"
}
```
- 冲突检测：教师/班级/场地任一冲突 → `409 {"error":"教师 张三 在第 3 周 周三 1-2 节已有课"}`（明确冲突项）
- 发布：**POST `/affairs/schedules/{id}/publish`** → `200 {"published": n, "version": n}`

### 3.6 文件上传

**POST `/api/v1/files/upload`**（`multipart/form-data`，字段 `file`，≤10MB）→ `200 {"url": "/uploads/xxx.png"}`；`GET /api/v1/files/preview?url=...` 返回可预览地址。文档预览由前端 file-viewer（flyfish-dev，浏览器原生）渲染：凡扩展名落在 `@file-viewer/core` 的 `DEFAULT_SUPPORTED_EXTENSIONS`（208 个扩展名，覆盖 office/pdf/压缩包/邮件/CAD/3D/地理/脑图/绘图/电子书/图片/音视频/代码文本/字体/设计/数据）一律走 `FileViewerPreview`；其余格式回退 kkfileview。kkfileview 服务保留。

### 3.7 工作台聚合

**GET `/api/v1/portal/workspace/dashboard`** → `200` 按角色聚合的 DTO（课程/任务/考试/课表/待办），30s Redis 缓存（键含 userID+角色）。

---

## 4. 公共规范

### 4.1 认证与请求头

| 头 | 格式 | 说明 |
|----|------|------|
| `Authorization` | `Bearer <JWT>` | HS256；Claims：userId/tenantId/roleCodes/permissions(menus+admin)；有效期 7 天 |
| `Content-Type` | `application/json`（上传为 `multipart/form-data`） | 请求体上限 10MB |
| `X-Request-ID` | 任意 | 中间件生成，日志关联 |

平台隔离：portal token 访问 saas 路由（或反之）→ `403 {"error":"平台不匹配"}`（`RequirePlatform` 中间件）。

### 4.2 统一响应结构

| 场景 | 结构 |
|------|------|
| 成功（对象） | 业务对象 JSON 直接返回；创建类返回 `{"id":"..."}` |
| 成功（列表） | `{"items": [...], "total": <count>}` |
| 错误 | `{"error": "<消息>", "code": "<机器码>?"}`——`error` 为面向用户的消息（中文），`code` 为可选机器码，仅在需前端按码分支时出现 |

机器码词汇表（前端按 `code` 分支，不解析 `error` 文案）：

| code | 状态码 | 场景 |
|------|--------|------|
| `ai_not_configured` | 412 | 租户未配置 AI |
| `too_many_requests` | 429 | 限流 |
| `invalid_transition` | 409 | 非法状态流转 |
| `platform_mismatch` | 403 | 平台隔离越界 |
| `tenant_mismatch` | 403 | 越权（资源不属于本租户） |

历史接口中部分错误仅有 `error` 无 `code`（向后兼容，不强制回填）；新增接口统一按上表。

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
| 429 | 限流 | 登录 30 次/分钟/IP |
| 500 | 服务异常 | `{"error":"服务器内部错误"}`（原始 error 记录日志，不泄露） |

### 4.5 其他约定

- 超时：业务接口 30s；`/import/`、`/export/`、`/templates/` 前缀 10 分钟
- 操作日志：POST/PUT/DELETE 自动记录（跳过 `/behavior-collection/`、`/view`），异步写 `operation_logs`
- 租户校验：缺租户 `403 {"error":"缺少租户信息"}`；越权操作 `403 {"error":"无权操作：资源不属于您的租户"}`

---

## 5. 变更日志

| 版本 | 日期 | 变更内容 | 影响范围 |
|------|------|---------|---------|
| v0.9 | 2026-08-04 | 评价标准保存即落库 + 409 重试；联盟字典码中文化→英文编码（迁移 122）；体系课节点测评提交闭环；`/job/student` 重定向至 `/job/landing` | scene/evaluation、alliance 导入识别、lesson |
| v0.8 | 2026-08-03 | 恢复 RequirePlatform 平台隔离中间件；场景导入按文件后缀推断资源类型 | 安全、导入 |
| v0.7 | 2026-08-01 | 删除 `platform_links`/`app_modules` 表与相关接口（迁移 110）；排课导入导出重构；联盟全主体关联 + 批量导入导出 | 前端配置收敛、affairs、alliance |
| v0.6 | 2026-07-31 | 题库详情批量导出题目为导入模板；人培方案克隆含课程设置 | evaluation、affairs |
| v0.5 | 2026-07-29 | 五套批次表统一（岗位/场景/课程/测评/教务）；工作流+审批+批次 handler 补齐 | 全模块 |
| v0.4 | 2026-07-25 | 跨模块共享组件统一、导航整合与门户落地（Phase 3.6/4） | 前端整体 |
| v0.3 | 2026-07-19 | 前端各模块 wire 真实 API，移除 localStorage mock | 前端 |
| v0.2 | 2026-07-11 | 后端 handler/路由主体建设（job/scene/lesson/evaluation 域） | 后端 |
| v0.1 | 2026-07-01 | 初始化 + 部署基建（deploy.sh/docker-compose） | 基建 |
