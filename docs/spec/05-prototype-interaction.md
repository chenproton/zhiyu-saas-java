# 原型 / 交互说明 — 知与 SaaS

> 基于前端门户（Vue 业务门户 `frontend/portal-vue` + Vue 管理端 `frontend/plus-ui`）回溯整理。
> 亮色主题；无独立设计稿。

---

## 1. 页面清单

### 1.1 门户 / 公共

| 页面名 | 路由 | 模块 | 优先级 |
|--------|------|------|--------|
| 登录页 | `/portal/login` | portal | P0 |
| 门户首页 | `/portal` | portal | P0 |
| 我的服务台 | `/portal/workspace` | portal | P0 |
| 应用中心 | `/portal/apps` | portal | P0 |
| 系统管理 | `/portal/apps/system/*`（tenant/resource/org-user/logs 4 组 15+ 页） | portal | P0 |
| 产教融合管理 | `/portal/apps/alliance/*`（school/enterprises/projects/achievements/experts/agreements/permissions/dictionaries/brands） | portal | P0 |
| 联盟公开落地页 | `/portal/alliance/landing`（入口，`/portal/alliance` 无 page 仅子页路由）、`/portal/alliance/brands` 等 | portal | P1 |
| 超管控制台 | `/superadmin` | saas | P0 |

### 1.2 八大业务子系统

| 系统 | 路由前缀 | 页面 | 学生端 |
|------|---------|------|--------|
| 职业岗位学习平台 | `/job` | 岗位管理（列表 + 分步构建器 `positions/[id]/edit`）、岗位推荐、学习路径、批次、工作流、审批中心、岗位归档 | `/job/landing`（岗位主页/详情/学习） |
| 实践场景学习平台 | `/scene` | 场景管理（列表 + 编辑 `scenarios/[id]/edit` + 任务编排 `edit/tasks`）、批次/工作流/审批/归档 | `/scene/landing` |
| 数字课程服务平台 | `/lesson` | 体系课管理（`admin/system`、`admin/system/add`）、颗粒课、混合课、批次/工作流/审批/归档 | `/lesson/landing` |
| 能力评价与测评资源管理 | `/evaluation` | 题库管理、试卷管理（组卷 `exams/[id]`）、岗位能力认定规则、考试使用/结果、场景任务评价、批次/工作流/审批 | `/evaluation/landing`、`/evaluation/exam-usage` |
| 教学资源共享服务平台 | `/library` | 知识点库、能力点库、证书库、现场问答题库、资源库（11 类型）、我的资源 | `/library/landing` |
| 教务管理服务平台 | `/affairs` | 教务配置、人培方案（列表+详情）、教学计划、排课管理、批次/工作流/审批 | — |
| 产教融合与就业服务 | `/portal/apps/alliance` | 见 1.1 | `/portal/alliance` |
| 系统管理 | `/portal/apps/system` | 见 1.1 | — |

> 另含**企业端 Partner**（`/partner/*`：workspace/enterprise/experts/members/schools/cooperation/tasks/settings，独立登录页 `/partner/login`，业务页面挂在 PortalLayout 下，完整规格见 [`partner-enterprise-platform.md`](partner-enterprise-platform.md)）与 **SaaS 超管控制台**（`/superadmin`，见 1.1）。

### 1.3 全局布局

所有业务子系统统一 `PortalLayout`（`frontend/portal-vue/src/layouts/PortalLayout.vue`）：**TopNav（固定）+ 左侧 PlatformSideNav（可折叠）+ 主内容区**；landing 系列页面为独立无壳布局（仅 TopNav）。门户端为 TopNav + 内容。

---

## 2. 关键页面交互说明

### 2.1 登录页 `/portal/login`

- **布局**：居中单卡片账号密码登录（Element Plus `el-card`，无短信/微信 Tab）；开发环境展示测试账号快捷按钮
- **流程**：账号密码 → `portalLogin` → 若返回 `needsTenantSelection` 弹出「选择租户」Dialog（租户列表单选）→ `selectTenant` → 写入 token（localStorage `zhiyu-portal-token`）→ 按角色跳转：
  - `school_admin` → `/portal/apps`
  - `teacher/student` → `/portal/workspace`
  - 其他 → `/portal`
- **错误态**：401「用户名或密码错误」toast 提示；429 限流提示
- **边界**：401 全局拦截自动清 token 并跳回登录页

### 2.2 门户首页 `/portal`

平台卡片墙（`HOME_PLATFORMS`，11 个模块卡片：产教融合/产业岗位/实践场景/COFA测评/数字课程/教学资产/产教资源中心(mall)/教务/教科研/数智决策/OPC；**不含系统管理**——system 只在应用中心菜单；OPC/决策/教科研为锁定占位卡），卡片点击进入子系统首页；未订阅模块灰化禁用（订阅模块控制）。

### 2.3 我的服务台 `/portal/workspace`（角色化 Tab）

| 角色 | Tab 结构 |
|------|---------|
| 学生 | 工作台首页 / 我的学习 / 我的课表 / 我的收藏 / 测评认证 / 学生画像 / 学习社区 / 个人中心 |
| 教师 | 工作台首页 / 我的场景·课程 / 我的课表 / 我的学生 / 个人中心 |
| 学校管理员 | 工作台首页 / 资源运营 / 审批中心 / 教师学生情况 / 个人中心 |

- Tab 结构与 `frontend/portal-vue/src/views/portal/workspace.vue` 一致（`?tab=` 驱动，非法/缺省回 dashboard）
- 数据来自 `workspaceDashboard` 聚合接口（30s 缓存）
- 学生「我的学习」Tab 可筛选（场景/课程等），点击前往真实落地页
- 教师「我的场景·课程」支持 hybrid 评分弹窗（`HybridGradingDialog`；React 时代 grading-iframe-dialog 未移植）

### 2.4 内容列表页（content-list-page 通用模板）

岗位/场景/课程/题库/试卷/人培方案等统一模式（`frontend/portal-vue/src/components/common/content-list-page.vue`）：

- **区域划分**：顶部页头（标题 + 描述 + 新建按钮）→ 筛选区（搜索框 + 批次/专业/状态筛选）→ 列表区（`el-table`：封面+名称、类型/分类、状态徽章（el-tag）、时间、操作列）
- **列宽**：`el-table` 原生列宽（`width`/`min-width`），无拖拽持久化（React 时代可拖拽列宽未移植）
- **状态动作条**（status-action-bar）：按状态机呈现可用操作——draft：编辑/删除/提交审批；pending：撤回/审批；approved：发布/编辑；published：取消发布/归档；archived：恢复/删除
- **行内操作**：编辑 / 克隆 / 删除（ConfirmDialog 二次确认）
- **空态**：Empty 组件（插画 + 引导文案 + 新建按钮）
- **分页**：content-list-page 内置分页（limit/offset），bottom 右侧
- **导入**：导入向导（下载模板 → 上传 → 预览错误行 → 确认执行 → 结果汇总 toast，见 §2.8）

### 2.5 编辑页（editor-shell 分步构建器）

岗位/场景/课程等复杂编辑采用**分步构建器**（左侧步骤条 + 右侧内容面板）：

- 步骤条可回退；每步表单网格布局（Element Plus `el-form` + 栅格）；校验提交时执行
- 「保存草稿」与「整单保存」（save-full）两个动作
- 章节编辑器（课程）/任务编排页（场景 tasks：拖拽重排 + 依赖选择）
- 评价标准配置：eval-method-card/selector/config-module 卡片式选择与配置

### 2.6 学生落地页（landing 四套）

- 列表页：筛选行（landing-filter-row）+ 卡片网格（岗位/场景/课程卡片带封面、难度/评分、收藏按钮）
- 详情页：Header（封面 + 标题 + 关键信息徽章）→ 内容区（课程：节点树/作业/测验；场景：任务链；岗位：职责/能力/证书）
- 学习页 `/[id]/learn`：课程播放/任务执行界面
- 岗位详情页「实践场景」tab 与学习页（`/job/landing/[id]/learn`）场景排列顺序**一致**，均按该岗位关联的第一条学习路径（`/job/learn-roads`）步骤顺序排序（未纳入步骤的场景追加末尾；无关联路径/未登录/加载失败时回退列表原顺序）；排序规则收敛于前端统一排序逻辑；**生效前提**：学习路径读取依赖 `/job/learn-roads` 菜单授权（`RequireMenu(jobManageMenus)`），无该菜单的用户（默认学生）与未登录一致回退列表原顺序，两页行为仍保持一致
- `/job/learn-roads` 管理页：列表列「场景数/任务数」按岗位**实时统计**——场景数 = 该岗位关联（careerPositionId）的全部非归档场景数，任务数 = 这些场景下任务数之和（场景接口返回的 taskCount 实时计数），聚合规则收敛于前端统一统计逻辑；**不使用学习路径 steps 快照**（steps 是保存时缓存，场景/任务增删后不更新，且无学习路径的岗位会错误显示 0/0）。「编辑学习路径」的「场景顺序」列表 = 该岗位关联场景按学习路径步骤顺序排列（与落地页/学习页同一套 `orderScenariosByLearnRoad` 排序，无路径时按列表原顺序），每个场景的任务实时加载自 `scenario_tasks`，列表与岗位关联场景一一对应（不再生成 orphan 假场景卡片；保存时 steps 写回真实场景步骤，残留的过期步骤被收敛）
- 未登录可浏览公开列表（免登录无壳）；未发布内容仅可通过预览接口访问

### 2.7 超管控制台 `/superadmin`

- 单页应用：登录（saasLogin + JWT roleCodes 含 platform_admin 校验）
- 租户管理：表格列表 → 创建 Dialog（一键生成管理员，随机密码仅弹窗展示一次）→ 状态开关 → 编辑
- 订阅套餐：模块开关列表（11 个业务模块，无 ai——AI 功能已下线；后端默认套餐含 ai 条目为历史遗留，见 `PLATFORM_MODULES`），保存即生效
- 租户管理员：列表/新建/重置密码（预览密码 Dialog）

### 2.8 导入向导（导入预览流程）

1. 下载模板（Excel 或"导出为导入模板"）
2. 上传文件 → 解析
3. 预览页：有效行数/错误行明细（行号 + 字段 + 原因）表格
4. 确认执行（可选 `overwrite=1` 覆盖更新）
5. 结果 toast：成功 n 条 / 跳过 n / 失败 n（失败明细可展开）

### 2.9 系统管理-租户信息页 `/portal/apps/system/tenant`

- 租户/学校资料展示与编辑（基础信息/联系信息/网络信息）
- **学校管理员卡片**：本租户学校管理员列表/编辑/删除/修改密码；**「新增」按钮当前隐藏**——租户自助新增学校管理员暂不开放（产品决策，后续可能恢复；恢复方式为前端租户信息页组件顶部 `SHOW_ADD_BUTTON` 改为 true，见 `docs/系统功能清单.md`「十一、1 租户信息」）

---

## 3. 全局交互规则

### 3.1 导航结构

- **顶层**：TopNav（logo + 门户首页/我的服务台/应用中心 + 用户菜单：个人中心/账号设置/退出登录；React 时代「角色切换/字号缩放」未移植，见 `PortalLayout.vue` 注释）
- **二级**：PlatformSideNav（子系统菜单树，按菜单权限 `hasMenuPermission` 过滤渲染）；左侧顶部返回按钮回应用中心
- **面包屑**：编辑页使用步骤条替代面包屑；列表页使用页头标题

### 3.2 弹窗规范

| 场景 | 组件 | 说明 |
|------|------|------|
| 二次确认（删除/取消发布/驳回等） | `el-popconfirm` / `ElMessageBox.confirm` | 危险操作必带，红色确认按钮 |
| 创建/编辑表单 | Dialog（居中 Modal） | 表单 3 项以内优先 Dialog；超过 3 项用独立页面 |
| 复杂选择（用户/组织/资源/知识点/批次） | 选择器 Dialog | knowledge-selector / user-selector / resource-selector 等统一组件 |
| 侧滑详情/配置 | Sheet（Drawer） | 移动端 PlatformSideNav 折叠为抽屉 |
| 跳转新页面 | 编辑页/详情页 | editor-shell 类复杂编辑 |

**关闭前未保存内容确认**

> React 时代基于 Radix `DialogContent` + `unsavedGuard` 的全局未保存守卫**未移植到 Vue 门户**（Vue 用 Element Plus `el-dialog`，`close-on-click-modal` 默认可关）。当前由业务侧按需自行确认（如表单编辑页离开前确认），无统一守卫；如后续需要，以 el-dialog `before-close` 逐弹窗实现。

### 3.3 表单校验

- **提交时校验**（非实时）：表单行网格布局（`el-form` + `el-row`/`el-col`），错误信息显示在字段下方
- 必填/格式由后端校验兜底（400 提示透传中文错误）
- 唯一冲突（code/name）由后端 409/400 提示，前端 toast 展示

### 3.4 操作反馈

| 场景 | 规范 |
|------|------|
| 成功操作 | Toast（默认约 3s）：「创建成功」「已提交审批」「发布成功」 |
| 失败操作 | Toast 展示后端 error 消息（中文） |
| 全局错误 | GlobalApiErrorHandler：401 清 token 跳登录；5xx 通用提示 + 刷新按钮 |
| 加载态 | 列表 skeleton 行；按钮 loading 态（useAsync）；页面级 spinner |
| 批量操作 | 批量删除/毕业/改组织 均需多选 + 二次确认（`ElMessageBox.confirm`） |

### 3.5 内容状态机 UI 流转

状态徽章（各页 `el-tag` 按状态机着色）：draft（灰）/pending（黄）/approved（蓝）/rejected（红）/published（绿）/archived（深灰）；操作按钮按状态动态渲染（见 2.4），非法操作后端 409 兜底。

### 3.6 四态规范

| 状态 | 处理 |
|------|------|
| 初始态（空数据） | Empty 组件插画 + 「暂无数据」+ 新建引导按钮 |
| 加载态 | 表格骨架屏（skeleton rows）；下拉加载 skeleton |
| 错误态 | ErrorState 组件（错误信息 + 重试按钮）；网络错误全局拦截提示 |
| 边界态 | 超长文本 ellipsis + tooltip；超长表格横向滚动；大量数据分页（limit 默认 20/页，上限 200，见 `02-api-contract.md` §4.3） |

---

## 4. 响应式规则

- **断点**：CSS 媒体查询断点（与 Element Plus 栅格对齐：sm 640 / md 768 / lg 1024 / xl 1280；**无 Tailwind 依赖**）
- **已完成的适配**（三轮全量扫描修复，30 文件 43 处）：
  - PlatformSideNav 在移动端折叠为抽屉（Sheet）
  - CRUD 页头部与组织树响应式（表单网格流式、表格横向滚动）
  - portal 登录/首页/工作台响应式
- **具体规则**：
  - 表单：`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3` 流式
  - 表格：外层 `overflow-x-auto`，移动端隐藏低频列
  - 卡片墙：1 → 2 → 3 → 4 列自适应
  - 编辑分步器：移动端步骤条折叠为顶部 Tab
  - TopNav：移动端收敛为 logo + 汉堡菜单
- **字号缩放**：React 时代功能，Vue 门户未移植（`PortalLayout.vue` 注释注明）

---

## 5. 附录：组件速查

- 通用组件清单与用法：见 `AGENTS.md` 第二部分与 `frontend/portal-vue`/`frontend/plus-ui` 源码（Element Plus / RuoYi 框架）
- 表单与表格规范（el-form / el-table / el-dialog）：同见上（Vue 门户基于 Element Plus）
- 后端对应交互语义：`docs/spec/02-api-contract.md`（内容 13 动作、批次 6 动作、导入流程）
