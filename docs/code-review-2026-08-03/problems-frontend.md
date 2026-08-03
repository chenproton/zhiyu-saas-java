# 全量代码审查问题清单 — 前端

> 审查日期：2026-08-03
> 审查范围：apps/edu（app 页面 226 + components 98 + hooks/lib 22）+ packages（api-client 27 / shared-types 27 / ui 57），共 462 文件，逐行完整阅读
> ✅ 已回查验证：每条问题已重新阅读代码确认，详见 [problems-verification.md](problems-verification.md)（前端）
> 文件清单与勾选状态见 [checklist.md](checklist.md)
> 严重级别：`[严重]` 必须修复｜`[中]` 建议修复｜`[低]` 可选
> 后端问题清单见 [problems-backend.md](problems-backend.md)

---

## 1. 安全（[SEC]）

| 文件:行号 | 问题 |
|-----------|------|
| `components/knowledge-graph/knowledge-graph-d3-view.tsx:334-336` | d3 tooltip 用 `.html()` 拼接用户可控 `d.label`（知识点/课件名）→ 存储型 XSS，必须改 `.text()` 或转义 ✅ 已修复（escapeHtml 转义） |
| `components/shared/resource-preview-modal.tsx:230-237` | `href={resource.url}` 渲染用户可控 URL，`javascript:` 协议可执行，需协议白名单 ✅ 已修复（isSafeExternalUrl 协议白名单） |
| `app/portal/login/page.tsx:226-231` | 硬编码明文测试账号（school/school123、teacher/teacher123、student/student123）随生产发布 ✅ 已修复（仅开发环境显示） |
| `app/lesson/landing/[id]/page.tsx:1086-1101,1279-1289` | 学生提交的附件 URL 未校验协议直接 `<a href target=_blank>`，javascript: 可被教师端点击执行 |
| `app/portal/apps/system/org-user/teachers/page.tsx:363` | 密码输入框 `type="text"` 明文显示，应 `type="password"` |
| `app/superadmin/page.tsx:153-192` | 客户端 `atob` 裸解 JWT（中文用户名时 JSON.parse 抛错误判登录态）+ 绕过 api-client 手写 fetch 登录 |
| `app/scene/scenarios/[id]/edit/tasks/page.tsx` 及多处 | coverImage/URL 直接拼 CSS `url('${...}')` 未转义（`scene-card.tsx:44`、`banks/[id]/page.tsx:196`、`lesson/landing/[id]/page.tsx:379`、`cert-cards.tsx:47` 等） |
| `api-helpers.ts:136-140,247-252` | token 存 localStorage，暴露于 XSS 风险面（无 httpOnly cookie） |
| `api/import-export.ts:31-33,126` | entity 参数未 encodeURIComponent，可构造路径穿越片段 |
| `lib/resource-type-constants.tsx:61` | 图片类型允许 SVG 上传，配合后端无类型限制 → 存储型 XSS 攻击面 |
| `app/portal/workspace/_components/portrait-tab.tsx:3-11`、`grading-iframe-dialog.tsx:53-58` | iframe 无 sandbox、无加载失败兜底，且默认 http://111.170.170.202:3003 明文地址（生产 https 混合内容拦截） |

---

## 2. 功能缺陷（[严重]，必须修复）

| 文件:行号 | 问题 |
|-----------|------|
| `components/shared/rich-text-editor.tsx:46,50,57,59` | 调用 `toast.error/.success`，但 toast 是函数（无方法）→ 任何 PDF 上传动作抛 `TypeError`，上传流程整体不可用 ✅ 已修复（删除 any toast prop，改用 @zhiyu/ui toast 函数调用，2 个调用方同步清理） |
| `app/lesson/admin/system/add/page.tsx:365,653` | 编辑模式 `contentCode` 硬编码 `'CNT-SQL001'`，保存时把假编码写回每个已有节点 → 批量污染真实编码 ✅ 已修复（编辑加载时回填 course.code） |
| `app/lesson/admin/system/add/page.tsx:629-632,1201-1211` | 自定义知识点（kp-custom-*）保存时被过滤剔除且无创建接口调用 → 静默丢失 ✅ 已修复（保存前 knowledgeApi.create 持久化并映射真实 ID） |
| `app/lesson/admin/hybrid/add/page.tsx:167-494` | 编辑已有课程时表单不回填（无 effect）；节点树/模块内容从未持久化（无 courseNodeApi 调用）；`handleFinish` 保存失败也跳转丢数据 ✅ 部分修复（编辑回填 rootForm + handleFinish 失败不跳转；节点持久化为较大功能改动待办） |
| `app/lesson/admin/granular/add/page.tsx:311-345` | create 分支未设 hasSavedRef，保存成功前点"取消"会删除刚创建的课程；`handleFinish` 失败仍跳转 |
| `app/affairs/programs/[id]/_components/courses-tab.tsx:219-243` | 未关联行（linkType=none）保存时被丢弃，而后端整表 PUT → 关联被删除；岗位分组行只产生 1 条 payload ⚠️ 待业务确认（岗位分组折叠/保存语义涉及排课数据，需产品确认后修复） |
| `app/portal/apps/alliance/achievements/[id]/page.tsx:94` | `filter(a.type === kind)` kind 为复数 'scenes'/'courses'，枚举为单数 'scene'/'course' → 添加场景/课程功能永久不可用 ✅ 已修复（kind 映射为单数枚举） |
| `app/portal/apps/alliance/experts/[id]/edit/page.tsx:125-132` | payload 缺 expertType/professionalFields/photos/rating/positionDirection，后端全字段 UPDATE → 保存即清空专家数据 ✅ 已修复（补齐字段与回填） |
| `app/portal/apps/alliance/projects/page.tsx:123,240` | 前台展示 Switch 绑定 `onToggleEnabled={async () => {}}` 空实现 → 开关不持久化、点击回弹（同类：achievements/page.tsx:232、brands/*/page.tsx 多个） ✅ 部分修复（projects 已持久化；achievements/brands 同模式待办） |
| `app/portal/workspace/_components/teacher-courses-tab.tsx:46-816` | 三块详情视图全 mock 假数据；课程类型按 index%2 伪造；备课/上课 URL 硬编码虚构 id（hybrid-1/task-1-1） |
| `app/portal/workspace/_components/hybrid-grading-dialog.tsx:367-390,71-97` | 评分按钮无 onClick；学生名单恒空 → 评分对话框名不副实 |
| `app/portal/workspace/_components/assessment-tab.tsx:194-198` | "进入/查看"按钮无 onClick，考试入口失效 |
| `app/evaluation/exams/[id]/page.tsx:222-232` | onDragOver 每次拖过一行触发整卷 PUT + 重拉全量（无节流） ✅ 已修复（拖动目标行去重） |
| `app/portal/apps/system/resource/package/page.tsx:112-116,28-41` | onRetry 不发起请求（点重试永久转圈）；未开通模块被 filter 掉，"未开通"徽标永不出现 |
| `components/evaluation/question-form-dialog.tsx:212` | `score: 0` 硬编码 → 编辑题目分值被重置为 0 ✅ 已修复（score state 回填） |
| `components/evaluation/question-form-dialog.tsx:141-143,580-600` + `question-preview.tsx:32` | 判断题 answer 为数组 `["true"]`，代码按字符串比较 → 编辑回显失败、预览恒显示"错误" |
| `app/portal/workspace/_components/schedule-grid.tsx:270-272,378` | WeekView 事件匹配只看 dayOfWeek/period 与当前日期无关 → 切周/翻月课表内容不变 |
| `app/scene/scenarios/[id]/edit/tasks/page.tsx:507-563,735-791` | 克隆后权重不重分配（总权重>100%）；临时任务 delete 必失败；保存部分失败留脏（下次保存重复创建）；任务级 weight 不持久化 |
| `app/affairs/programs/[id]/page.tsx` | `importEntityName/exportEntityName` 传空串 → 导出必然 404（content-list-page 无守卫） |
| `app/portal/apps/system/org-user/roles/page.tsx:242-259` | permissions.menus 不存在时全选所有菜单 → 新建/旧角色默认全量权限 ✅ 已修复（menus 缺失时不授予任何菜单） |
| `components/job/position-builder/step-ability-modeling.tsx:431-434` | 编辑职责时按 Escape 执行保存 → 空名称职责被直接删除，且 abilityBindings 未清理产生孤儿绑定 |

---

## 3. 中等缺陷（[中]，建议修复）

### 3.1 数据一致性 / 契约

| 文件:行号 | 问题 |
|-----------|------|
| `api/auth.ts:7-8,17` | saasLogin/saasMe 用 `request()`（默认 portal token）→ 后端 `meWithPlatform` 校验平台不符返回 403"无效平台" |
| `api/job.ts:72` | saveFull 期望 `{position}`，后端返回裸 `CareerPosition` → 调用方取 resp.position 恒 undefined |
| `api/system.ts:71-78` | approval.review 传 `nextStepIdx`，后端请求体只有 action/remark → stepIdx 永不生效 |
| `shared-types/src/index.ts:1-22` | barrel `export *` 同名冲突（Position/Workflow/ApprovalRecord/ApprovalStatus/Batch/PositionCertificate 等约 10 组）→ 包根导入不可解析 |
| `shared-types/src/evaluation-rules.ts:295-297` | methodsToEvalRuleConfig 的 `allKeys` 在空值守卫之前执行 → 传空直接 TypeError |
| `api/lesson.ts:9,104-112` | courseNode 响应类型用 deprecated lesson-source 旧模型（type/parentId 必填）与实际后端 refType/sortOrder 不符 |
| `app/evaluation/exam-usage/results/page.tsx:76` | 专业名称塞进 majorId 字段 → majorMap 恒 miss |
| `app/evaluation/scene-results/page.tsx:204-208` | user.className/enrollmentYear 不在 User 契约上 → 届/班级分组永远落入单组 |
| `app/scene/scenarios/[id]/edit/tasks/_components/tasks-logic.tsx:316,371-372` | exam↔homework 归一化不对称 → 作业测评方式被静默改写为"试卷" |
| `app/evaluation/job-ability/page.tsx:49-65` | positionApi/certApi.list 未传 limit（后端默认 50）→ 数据截断；逐规则 N+1 getFullRule |
| `app/portal/apps/alliance/school/page.tsx:153-154` + `tenant/page.tsx:160-162` | 租户省份不在硬编码表时被静默替换为北京/东城区 → 保存后永久覆盖真实数据 |
| `app/portal/apps/alliance/agreements/[id]/page.tsx:96-101,114-118` + `projects/[id]/page.tsx:99-119,170` | 整对象回传后端（含 createdAt/updatedAt/tenantId 等只读字段） |
| `components/shared/eval-method-config-module.tsx:65` | Partial 强转 EvalRuleConfig 无运行时兜底 |
| `app/lesson/admin/system/add/page.tsx:1078-1082` | 动态拼接 Tailwind 类名（hover:border-xxx）JIT 不生成 → hover 样式全失效 |
| `app/lesson/admin/granular/add/page.tsx:231,95-97` | 自定义知识点 sourceId 匹配逻辑失效 → 刷新后自定义标记丢失 |
| `app/evaluation/landing/exams/[id]/page.tsx:127` | usageIdFromQuery 未命中时静默回退第一条 → 可能开始错误的考试 |
| `components/shared/multi-org-node-picker.tsx:238-240` | 取消全选后回退显示初始 value，勾选框"复活" |
| `components/shared/user-selector.tsx:200-265` | 无防抖搜索 + limit 200 无分页；N+1 回显；value 引用变化重置用户勾选 |
| `components/shared/content-list-page.tsx:337-343,989-1007` | CSV 重复导入确认弹窗被 hasExcel 门控永不弹出（死路） |
| `components/shared/content-list-page.tsx:739-753` | 非 Excel 实体导出全部数据与"导出需选中"语义矛盾 |
| `components/shared/content-list-page.tsx:350` | `limit: 1000` 硬编码无翻页，超 1000 条静默截断（多处同类：hooks 3 个、select 组件、页面等约 20 处） |
| `app/portal/workspace/_components/learning-tab.tsx:80-115` | 硬编码假统计（5 门/2 待完成/86h）+ 死按钮 |
| `app/portal/workspace/page.tsx:68-81,741-743` | 硬编码假统计（8 门课/256 人/1256 在线）+ 假活跃度 +12.5% + "张老师" |
| `components/portal/yi-know-assistant.tsx:535-595` | AI 助手回复为硬编码虚构数据（12 个场景/8 家企业） |
| `components/portal/footer.tsx`、`platform-footer.tsx`、`library/landing/page.tsx:1128` | 假客服电话/邮箱/XX 职业技术学院/假 ICP 号随生产发布 |
| `components/shared/batch-group-page.tsx:186-190` | 批次编号 `Math.random()*10000` 无唯一性保证 |
| `components/shared/image-list-upload.tsx:41-44` | 上传失败静默降级 blob URL（刷新失效） |
| `components/shared/knowledge-selector.tsx:50-55` | 硬编码后端知识点 id（kp-1~kp-10），id 变更即筛选失效 |
| `app/portal/workspace/_components/career-tab.tsx:22-88` | "我的收藏"全 mock 空数组、无数据加载 |
| `app/portal/workspace/_components/community-tab.tsx:13-137` | 学习小组/导师/话题全 mock + 死按钮 |
| `app/portal/workspace/_components/teacher-profile-tab.tsx:13-14,104-129` | 通知偏好/账号安全全 mock 占位 |
| `app/portal/workspace/_components/profile-tab.tsx:23-47` | "我的荣誉奖励"全写死假数据（含假附件名） |
| `components/providers/data-provider.tsx:850-901,976-984` | createProcessEvaluation/createAppealRecord 等 7 个函数只改本地 state 不调 API → 刷新即丢 |
| `components/providers/data-provider.tsx:342-348` | 审批中心不拉 online_exam 类型 |
| `components/providers/data-provider.tsx:130-143` | submitterName 用审批人姓名冒充提交人 |
| `app/evaluation/question-banks/[id]/page.tsx:316-366` | 批量删除/复制/移动 forEach 不 await 无 catch，失败静默 |
| `app/portal/apps/system/logs/login/page.tsx:61-66`、`operation/page.tsx:61-67` | 搜索只过滤当前页 20 条（跨页搜不到）与分页总数矛盾 |
| `app/scene/scenarios/[id]/edit/tasks/page.tsx:1590-1592` | saveMethods 二次失败吞错，examId 未持久化 |
| `app/job/student/[id]/page.tsx:109-125` | 单任务失败清空全部 scenarios |
| `app/scene/landing/[id]/learn/page.tsx:1048,1080` | 文件上传/测评提交 catch 全吞无反馈；maxScore 硬编码 100 |
| `app/portal/apps/alliance/enterprises/page.tsx:53-58` | 4 列表 Promise.all 任一失败整页报错 |
| `app/evaluation/job-ability/results/page.tsx:126-129` | summary 返回覆盖用户手动选择的岗位 |

### 3.2 性能

| 文件:行号 | 问题 |
|-----------|------|
| `app/job/student/[id]/learn/page.tsx:55-57`、`job-home.tsx:95-99`、`learn-roads/page.tsx:577-580`、`scene/landing/[id]/page.tsx:424-437`、`student/[id]/page.tsx:109-125` | 每场景一个 taskApi.list 的 N+1 扇出（最多上千并发） |
| `components/shared/user-selector.tsx:245-263` | 每个缺失 id 一个 get 请求 |
| `components/portal/top-nav.tsx:43-61` | setInterval 每秒 setState 整树重渲染 |
| `app/evaluation/job-ability/page.tsx:56-65` | 逐规则串行 getFullRule |
| `app/portal/apps/system/org-user/positions/page.tsx:103-105` | limit 1000 后客户端过滤，超限不完整 |
| `app/portal/apps/alliance/agreements/page.tsx:40-44` | 企业+项目各 limit 1000 全量仅做名称映射 |
| `components/shared/approval-list-page.tsx:81` | mapRecord 引用变化使 useMemo 失效 |
| `app/portal/apps/system/tenant/_components/school-admin-manager.tsx:74-82` | adminFetcher 每渲染重建 → 父组件任何 state 变化重复拉取管理员列表 |

### 3.3 组件/状态 bug

| 文件:行号 | 问题 |
|-----------|------|
| `components/shared/portal-sidebar-crud-page.tsx:186,217-226` | 组织筛选纯前端但 total/totalPages 服务端分页 → 可翻到空页 |
| `components/shared/alliance-detail-shell.tsx:46-53` | tabs 异步加载时 activeTab 空 → 渲染空内容 |
| `components/shared/brand-relation-select.tsx:71,78` | 两个 SelectItem 同 value="__none"（Radix 行为异常） |
| `components/shared/resource-selector.tsx:374-403` | 创建失败仍弹"已上传并选中"，提交后端不存在的 id |
| `components/shared/resource-selector.tsx:691-787` | venue/facility/software 表单字段从未提交（metadata 丢失） |
| `hooks/use-org-tree.ts:42-72` | 登出后 loading 永久 true（UI 永远转圈） |
| `hooks/use-subscription-modules.ts:27-30` | 订阅接口失败 → 全部菜单隐藏（失败态成最严拦截态） |
| `ui/PlatformSideNav.tsx:73-81` | 手动折叠的分组在导航后被强制重新展开 |
| `lib/external-links.ts:13-48` | 8 个平台地址硬编码 http://111.170.170.202:xxxx 内网 IP（公网不可达/mixed content） |
| `components/evaluation-rules/evaluation-rules-editor.tsx:1916` | 试卷详情"关闭"按钮操作无用的 setPaperDetailOpen → 弹窗关不掉 |
| `components/evaluation-rules/evaluation-rules-editor.tsx:311-312,1957-1985` | 题库答题方式/正确率仅存本地 state 未写入 config → 保存丢失 |
| `components/evaluation-rules/evaluation-rules-editor.tsx:3220-3232,2438-2440` | 替换模板只改本地不调 API；API 失败仍本地更新（假成功） |
| `components/evaluation-rules/evaluation-rules-editor.tsx:202-240` | 默认评审步骤不进 config.reviewSteps → 落库缺步骤 |
| `app/lesson/admin/_components/assessment/course-evaluation-rules-dialog.tsx:48` | liveConfig 跨开关持久，重新打开不重置 |
| `app/affairs/teaching-plans/[id]/page.tsx:354-357` | 编辑态改教师立即持久化，"取消"不回滚 |
| `app/portal/apps/alliance/agreements/new/page.tsx:71` | 非函数式 setState 快速输入丢字段 |
| `ui/multi-select-search.tsx:121-127,170-178` | 硬编码 id "multi-select-all" 多实例冲突；按 label 反查 value 可能删错选项 |
| `ui/multi-select.tsx:93-98,108-141` | 选项 div+onClick 无键盘支持；X 为 span 非按钮 |
| `ui/dialog.tsx:80-94` | 自定义 onOpenAutoFocus 绕过 Radix FocusScope，无可聚焦元素时焦点落背景页 |
| `app/evaluation/scene-results/[id]/page.tsx:531,543,573` | 评分校验上限用 `weight || 0` 而显示用 `weight || 100` → 自相矛盾 |

### 3.4 后端 API 上限截断（limit 被 maxPageSize=200/50 截断，数据静默不完整）

`schedule-grid-tab.tsx:87,99`（500→200）、`my-resources/page.tsx:135-188`、`industries/page.tsx:38`、`scene/landing/[id]/learn/page.tsx:239-256`（10000/1000→200）、`job-ability/page.tsx:49`、`scene/landing/[id]/page.tsx:424` 等约 15 处

---

## 4. 低危汇总（[低]，常见模式）

- **catch 吞错显示"暂无/不存在"**：`banks/[id]/page.tsx:109-117`、`landing/exams/page.tsx:38`、`landing/page.tsx:144`、`lesson/landing/page.tsx:118`、`brands/*/page.tsx`（6 页）、`experts/page.tsx`、`achievements/page.tsx`、`dictionaries/page.tsx:39`、`scene-results/[id]/page.tsx:880`、`exam-usage/results/page.tsx:64`、`exams/[id]/page.tsx:111`、`projects/[id]/edit/page.tsx:64-76`、`enterprises/[id]/page.tsx:22-31`、`job/student/[id]/page.tsx:93`、`job/student/[id]/learn/page.tsx:36`、`my-schedule-tab.tsx:30`、`teacher-dashboard-tab.tsx:73-78`、`school-admin-*-tab.tsx`、`dashboard-tab.tsx:92`、`learn/page.tsx:208-233` 等约 30 处
- **硬编码假数据/占位文案**：`footer.tsx`、`platform-footer.tsx`、`library/landing/page.tsx:1128`、`top-nav.tsx:167-174`（个人中心无 onClick）、`prep-associate-dialog.tsx:15-39`（恒"暂无可用"）、`assessment-tab.tsx:194`、`career-tab.tsx:272-335`（进入场景无 onClick）、`duty-table.tsx`、`scene-list.tsx:112-117`（事件冒泡）、`task-description-card.tsx:149-163`（富文本工具栏 27 个按钮无 onClick）、`atomic-modules.tsx:718-959`（题库/场景引用 EMPTY 死 UI）、`learning-path.tsx:101-111`（死分支）、`dashboard-tab.tsx:129`（查看全部无 onClick）等约 20 处
- **死代码/无效状态**：`exams/page.tsx:33`、`question-banks/page.tsx:31,114-121`、`scene-results/page.tsx:88`、`teacher-courses-tab.tsx:636`、`teacher-dashboard-tab.tsx:99`、`learning-tab.tsx`、`my-schedule-tab.tsx`、`method-config-dialog.tsx:1-1642`（整个文件未 import）、`evaluation-rules-editor.tsx:162,159,4644`（selectedQuestionForDetail 无 setter、showAddQuestion 无入口）等
- **a11y 缺失**：图标按钮无 aria-label（landing-pagination、pagination-bar、duty-table、stat-card、ability-tree 等约 15 处）、div onClick 无键盘支持（cover-image-upload、resource-upload-zone、resource-selector、user-selector、grading-iframe-dialog 等约 10 处）、aria-pressed/aria-expanded 缺失
- **limit: 1000/9999 硬编码无分页**：约 25 处（后端上限 200 会截断）
- **Promise.all 批量操作失败不提示**：`job/archive/page.tsx:119`、`scene/archive/page.tsx:104-137`
- **`as any` 绕过类型**：约 40 处（question-banks、positions、exams、knowledge、school、experts 等页面）
- **cancelled 竞态防护无效**（async 体内无检查）：`org-types/page.tsx:57`、`bank-question-selector-panel.tsx:85`、`use-org-tree.ts` 等
- **次要**：`toast` 双份提示（api 层已全局 toast + 本地再弹）、`new Date(x).toLocaleDateString()` 无非法值守卫（约 15 处）、`status-badge`/`editStatuses` 与后端状态机不一致（status-action-bar.tsx:255）、`nav-config` 双份维护、`system 菜单` 双份维护（menu-permissions.ts:62-124 vs navigation-config.ts）、`navigation-config.ts:16-17` 假用户信息、`formatSize` 重复实现（2 处）、`next-env.d.ts`/`vitest.config.ts` 配置正常

---

## 5. 前端修复优先级建议

1. **P0**：XSS（d3 tooltip .html()）；`rich-text-editor` toast 误用；`system/add` 节点编码污染与自定义知识点丢失；`hybrid/add` 编辑不回填 + 节点不持久化；`courses-tab` 未关联行被删除；`achievements/[id]` 单复数枚举错配；`experts/[id]/edit` 全字段清空
2. **P1**：`api/auth.ts` saas token 错配（403 需登录态失效）；`saveFull` 响应类型；`shared-types` barrel 冲突；`evaluation-rules-editor` 保存链路（模板/答题方式/默认步骤）；`teacher-courses-tab` 假数据；`schedule-grid` 周视图；`login/page` 测试账号下线
3. **P2**：N+1 请求收敛（任务列表/学习路径/用户回显）；limit 截断统一分页；catch 吞错补错误态；`use-org-tree` 登出卡死；`subscription-modules` 失败态误拦截菜单
4. **P3**：假数据/占位按钮逐页清理（社区/收藏/荣誉/通知/学习统计）；a11y 批量补齐；`as any` 收敛
