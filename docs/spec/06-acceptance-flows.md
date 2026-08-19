# 验收流程（Acceptance Flows）— 知与 SaaS

> 本文件是冒烟巡检（`scripts/ui-smoke`）的**机器可读业务流程规约**：把 PRD 用户故事的核心链路落成可执行的点击流程，巡检器按 `flow` 代码块顺序驱动浏览器逐步执行并断言。
> 定位：五层制品之外的第六层补充制品（执行层）。与逐页广度巡检互补——逐页巡检发现「点哪儿坏了」，本文件的流程发现「业务链路断了」。
> 维护规则：新增/变更核心业务链路时同步本文件（spec-first）；`spec-check.sh` 对 flow↔PRD 用户故事做提示级一致性检查。

---

## 1. DSL 规范

每条流程是一个 ` ```flow ` 代码块，内容为 YAML：

```yaml
flow: <流程 id，全文件唯一，kebab-case>
story: <01-prd.md 用户故事编号，如 L-4>
desc: <一句话业务语义>
steps:
  - role: school | teacher | student | partner   # 执行本步的登录角色
    # ── 动作（按书写顺序执行，至少一个）──
    goto: /route/path                            # 跳转页面（带查询串可写全）
    click: 按钮文字                               # 点击精确匹配文字的按钮/链接
    clickText: 文字                               # 点击包含该文字的可点击元素（卡片/链接，用于卡片网格）
    clickRow: { text: 行内文字, action: 按钮文字 }  # 表格行内操作（先按文字定位行，再点行内按钮）
    clickCard: { text: 卡内文字, action: 按钮文字 } # 卡片网格内操作（卡片需带 data-smoke-card，先按文字定位卡片再点卡内按钮）
    fill: { 字段label: 值 }                       # 按 label 填充文本/数字/日期字段
    select: { 字段label: 选项文字 或 first }        # 下拉/Radix Select/Combobox 选择；first = 第一个选项
    submit: 按钮文字 或 true                      # 点击提交按钮（true = 自动识别 保存/创建/确认 等提交词）
    confirm: true                                # 点击弹窗中的确认类按钮（确认/删除/发布/下架）
    toggle: { 字段label: true 或 false }          # 开关（Radix Switch）确保处于目标状态：按 label 文案定位邻近
                                                 # [role=switch]，已满足则不动（幂等）；无 label 关联时兜底页面唯一开关
    check: { 字段label: true 或 false }           # 复选（Radix Checkbox）确保目标勾选状态：按 label 文案定位邻近
                                                 # [role=checkbox]，已满足则不动（幂等）；用于组织树等「名字是 span、勾选在 Checkbox」的布局
    # ── 断言与上下文（可选）──
    expectApi: { method: POST, url: /path/片段, status: 201 }   # 断言本步执行期间出现匹配的接口响应
    expectText: 文字                             # 断言页面可见该文字（支持 {{var}}）
    saveAs: { 变量名: 字段label }                 # 把本步 fill 的值存入流程上下文
    optional: true                               # 幂等前置：未找到目标/按钮已禁用（前置已完成）记 skip 静默跳过；
                                                 # 其余失败记 warn 不判失败
    timeoutMs: 10000                             # 单步看门狗（默认 15000）
    skipPageErrorCheck: true                     # 豁免本步 pageerror 哨兵（默认开启：步骤窗口内任何
                                                 # 未捕获前端异常=步骤失败，覆盖「接口正常但页面白屏」事故类）
```

**模板变量**：
- `{rand}`：每流程运行一次的随机串（6 位），保证 SMOKE_ 数据名唯一；
- `{{varName}}`：引用 `saveAs` 存入的上下文变量；
- 跨角色传递数据只允许这两种机制 + SMOKE_ 名称搜索，不做接口级编排。

**执行语义**：
- 步骤按数组顺序执行；`role` 切换时巡检器按需登录并复用该角色会话；
- 非 `optional` 步骤失败 = 流程失败（报告记录失败步骤与原因）；流程失败不影响后续流程与逐页巡检；
- `optional` 步骤按错误类型分级：未找到目标 / 按钮已禁用 → `skip`（幂等前置已完成，不警告不截图）；其余失败 → `warn`（如残留无法清理、页面回归），流程仍判通过；
- **pageerror 哨兵（默认开启）**：每步执行窗口内浏览器任何未捕获异常（React 渲染崩溃、`undefined` 拼接等）即判该步失败——2026-08 AI 工坊事故（接口全 200 但管理页白屏）暴露「只断言接口与文字、不看脚本错误」的盲区，此哨兵兜底该类问题；误伤时可用 `skipPageErrorCheck` 单步豁免；
- 所有创建数据必须使用 `SMOKE_` 前缀（走巡检器统一清理与安全护栏）；
- 不产生真实 LLM 调用；不点击语言切换/超管危险操作（继承巡检器危险词护栏）。

**刻意不做**：业务数值正确性断言、视觉/DOM 布局校验、条件分支/循环、流程间数据依赖。保持线性、可读、可维护。

---

## 2. 流程清单

| flow id | story | 角色链 | 业务链路 |
|---------|-------|--------|---------|
| employment-hall-loop | L-4 | school→partner→student→partner→school | 学校引入并激活企业→发布就业项目→企业录岗位并挂项目发布→学生大厅可见并投递→企业查看投递→学校下架治理 |
| ai-kb-publish-loop | KB-1/KB-3/AD-1 | teacher→school→student→school→teacher | 教师建知识库→提交审核→学校管理员通过→学生广场可见→管理员下架→教师清理 |
| ai-agent-publish-loop | AG-1/AD-1 | teacher→school→student→school→teacher | 教师建智能体→提交审核→管理员通过→学生广场可见→管理员下架→教师清理 |
| ai-integration-loop | AD-2 | school→student→school | 管理员挂接第三方应用→学生广场应用区可见→管理员下架 |
| job-publish-loop | J-1/J-2/J-3 | teacher→school→teacher→student→school→teacher | 教师建岗位→填基础信息保存→提交审批→学校通过→发布→学生公开岗位大厅可见→取消发布→教师删除 |
| course-publish-loop | C-1/C-4/C-2 | teacher→school→teacher→student→teacher→school | 教师建体系课并编排节点→提交审批→学校通过→发布→学生落地页可见并进入学习→取消发布删除清理 |
| exam-loop | E-1/E-2 | school→teacher→school→teacher→student | 学校给学生分配班级（前置）→教师建试卷加判断题→审批通过→发布→创建考试场次并开启→学生考试中心参加答题→查分可见 |
| scene-task-loop | SC-1/SC-2/SC-3 | teacher→school→teacher→student→teacher→school | 教师编排场景与任务并配置测评形式→审批通过→发布→学生提交任务→教师评分→取消发布清理 |
| affairs-plan-loop | A-1/A-2/A-3 | school→school→student | 学校建人培方案并设岗位课程→审批发布→生成教学计划弹窗就绪验证→学生工作台课表入口正常（完整计划+排课链路见 teaching-plan-schedule-loop） |
| alliance-public-loop | L-1/L-3 | school→student→school | 学校维护合作协议台账（前台展示开）→学生公开页企业详情可见→学校清理 |
| resource-reuse-loop | R-1 | teacher→student(车辆场景) | 教师创建链接资源→绑定到场景任务→完成配置落库→任务卡片可见→清理 |
| teaching-plan-schedule-loop | A-1/A-2/A-3 | school→teacher→school→student | 建体系课发布→建人培方案挂课程审批发布→生成教学计划审批发布→排课发布课表→学生课表可见（自给课程/计划数据，闭环完整） |

### 2.1 覆盖登记（PRD 39 个用户故事的 flow 归属）

DoD 第 7 条只要求**核心业务链路**（跨角色/跨页面）有 flow，单页 CRUD 由 handler/service 单测 + 逐页巡检覆盖。据此三分类：

| 归属 | 用户故事 | 说明 |
|---|---|---|
| **已有 flow** | J-1/J-2/J-3、L-4、KB-1/KB-3、AG-1、AD-1、AD-2、C-1/C-4/C-2、E-1/E-2、SC-1/SC-2/SC-3、A-1/A-2/A-3、L-1/L-3、R-1 | 见下方 §3；SC-1 的「任务依赖编排」与 A-2 的「自动排课 API」无 UI 入口，flow 按 UI 现状裁剪（见各 flow 说明）；A-1/A-2/A-3 完整链路由 teaching-plan-schedule-loop 覆盖（网格排课经 DSL clickCell 驱动） |
| **不需 flow（单页/单角色 CRUD 或非 UI）** | S-1/S-2/S-3、J-4（Excel 导入，另有导入向导单测）、C-3、E-3/E-4/E-5、P-1/P-2（登录与菜单权限由巡检登录本身覆盖）、KB-2、AG-2/AG-3、SQ-1 | 由单测 + `ui-smoke` 逐页巡检 + 后端集成测试覆盖 |
| **不进本文件（DSL 约束）** | ST-1、AG-2 的流式问答 | 涉及真实 LLM 调用，由后端集成测试覆盖 |

> AI 智能服务中心的对话链路（SSE 流式问答、私有库泄露防线 ST-1）涉及真实 LLM 调用，按 DSL 约束不进本文件，由后端集成测试覆盖（`backend/go/internal/handler/ai_center_flow_test.go`：TestAICenter_AgentChatStream 含泄露防线断言、TestAICenter_KBAsk 含溯源断言）。

---

## 3. 流程定义

### 3.1 就业供需大厅闭环（employment-hall-loop）

> 对应 PRD L-4。前置：巡检 partner 账号对应企业名为「巡检测试企业」（巡检环境固定账号）。企业引入/激活为 `optional` 幂等前置——已引入/已激活时步骤失败不阻断。
> 残留说明：partner 已发布岗位按产品设计仅草稿可删，流程收尾执行「下架+取消发布+删除项目」，关闭态岗位与投递记录残留（下次运行互不影响，可按 SQL 定期清理）。

```flow
flow: employment-hall-loop
story: L-4
desc: 学校发布就业项目 → 企业录入岗位并挂项目发布 → 学生大厅浏览投递 → 企业只读查看投递 → 学校下架治理
steps:
  # ── 前置：确保巡检测试企业已被引入且合作中（幂等）──
  - role: school
    goto: /portal/apps/alliance/enterprises
    click: 引入企业
    optional: true
  - role: school
    fill: { 输入企业名称关键词: 巡检测试企业 }
    click: 搜索
    expectText: 巡检测试企业
    optional: true
  - role: school
    click: 引入
    expectApi: { method: POST, url: /alliance/enterprises/, status: 201 }
    optional: true
  - role: school
    goto: /portal/apps/alliance/enterprises
    fill: { 搜索企业名称或行业: 巡检测试企业 }
    clickRow: { text: 巡检测试企业, action: 编辑 }
    select: { 合作状态: 合作中 }
    submit: true
    expectApi: { method: PUT, url: /alliance/enterprises/, status: 200 }
    optional: true
  # ── 学校：创建并发布就业项目 ──
  - role: school
    goto: /portal/apps/alliance/employmentproject/new
    fill: { 项目名称: "SMOKE_春招项目{rand}", 发起单位: "SMOKE_就业指导中心" }
    select: { 项目类型: 春季招聘, 参与企业: 巡检测试企业 }
    saveAs: { projectName: 项目名称 }
    submit: 创建
    expectApi: { method: POST, url: /alliance/employment-projects, status: 201 }
  - role: school
    goto: /portal/apps/alliance/employmentproject
    fill: { 搜索项目名称: "{{projectName}}" }
    clickRow: { text: "{{projectName}}", action: 发布 }
    expectApi: { method: PUT, url: /alliance/employment-projects/, status: 200 }
  # ── 企业：录入岗位并挂项目发布 ──
  # partner 端 /partner/employment-jobs/new 在 usePartnerAuth 的 authLoading 期间只渲染 spinner，
  # goto 后立刻 fill 会「未找到字段」。故先单独一步等表单字段出现，再填。
  - role: partner
    goto: /partner/employment-jobs/new
    expectText: 岗位名称
    timeoutMs: 20000
  - role: partner
    fill: { 岗位名称: "SMOKE_装配工程师{rand}", 工作地点: 苏州, 招聘人数: "5" }
    select: { 合作学校: first, 岗位类型: 全职, 所属就业项目: "{{projectName}}" }
    saveAs: { jobName: 岗位名称 }
    submit: true
    expectApi: { method: POST, url: /partner/employment-jobs, status: 201 }
  # 与 /new 页同理：partner 端页面在 usePartnerAuth 的 authLoading 期间只有 spinner，
  # goto 后需先等列表渲染（搜索框出现）再操作，否则「未找到字段」
  - role: partner
    goto: /partner/employment-jobs
    # 注意不能等 placeholder 文案（「搜索岗位名称...」是 placeholder，非可见文本，expectText 等不到）；
    # 等刚创建的岗位出现即代表列表已渲染
    expectText: "{{jobName}}"
    timeoutMs: 20000
  - role: partner
    fill: { 搜索岗位名称: "{{jobName}}" }
    clickRow: { text: "{{jobName}}", action: 发布 }
    submit: 发布
    expectApi: { method: POST, url: /partner/employment-jobs/, status: 200 }
  # ── 学生：大厅可见并投递 ──
  - role: student
    goto: /portal/alliance/employment
    expectText: "{{projectName}}"
  - role: student
    clickText: "{{projectName}}"
    click: 岗位列表
    expectText: "{{jobName}}"
  - role: student
    clickText: "{{jobName}}"
    click: 立即投递
    fill: { 求职信（选填）: "SMOKE_求职信{rand}" }
    saveAs: { coverLetter: 求职信（选填） }
    submit: 确认投递
    expectApi: { method: POST, url: /apply, status: 201 }
    expectText: 已投递
  # ── 企业：只读查看投递 ──
  - role: partner
    goto: /partner/employment-jobs
    fill: { 搜索岗位名称: "{{jobName}}" }
    clickText: "{{jobName}}"
    click: 投递
    clickRow: { text: 巡检-学生 }
    expectText: "{{coverLetter}}"
    optional: true
  # ── 收尾：学校下架岗位、取消发布并删除项目 ──
  - role: school
    goto: /portal/apps/alliance/employmentjob
    fill: { 搜索岗位名称: "{{jobName}}" }
    clickRow: { text: "{{jobName}}", action: 下架 }
    expectApi: { method: PUT, url: /alliance/employment-jobs/, status: 200 }
    optional: true
  - role: school
    goto: /portal/apps/alliance/employmentproject
    fill: { 搜索项目名称: "{{projectName}}" }
    clickRow: { text: "{{projectName}}", action: 取消发布 }
    expectApi: { method: PUT, url: /alliance/employment-projects/, status: 200 }
    optional: true
  - role: school
    goto: /portal/apps/alliance/employmentproject
    fill: { 搜索项目名称: "{{projectName}}" }
    clickRow: { text: "{{projectName}}", action: 删除 }
    confirm: true
    expectApi: { method: DELETE, url: /alliance/employment-projects/, status: 200 }
    optional: true
```

### 3.2 知识库发布闭环（ai-kb-publish-loop）

```flow
flow: ai-kb-publish-loop
story: KB-1
desc: 教师建知识库 → 提交审核 → 学校管理员通过 → 学生广场可见 → 管理员下架 → 教师清理
steps:
  # 幂等清理（上次失败残留；工坊为卡片布局，用 clickCard 定位）
  - role: teacher
    goto: /portal/apps/ai/studio
    clickCard: { text: "SMOKE_AI库", action: 删除 }
    confirm: true
    optional: true
  - role: teacher
    goto: /portal/apps/ai/studio
    click: 新建知识库
    fill: { 名称: "SMOKE_AI库{rand}" }
    saveAs: { kbName: 名称 }
    submit: true
    expectApi: { method: POST, url: /ai/kb, status: 201 }
  # 回归护栏：进入库管理页验证动态路由参数解析（Next 15+ params 为 Promise，
  # 误读 params.id 会得到 undefined → 页面报错；2026-08 事故，见 ai-service-center §11）
  - role: teacher
    goto: /portal/apps/ai/studio
    clickCard: { text: "{{kbName}}", action: 编辑 }
    expectText: 文档管理
    timeoutMs: 20000
  - role: teacher
    goto: /portal/apps/ai/studio
    clickCard: { text: "{{kbName}}", action: 提交审核 }
    expectApi: { method: POST, url: /ai/kb/, status: 200 }
  - role: school
    goto: /portal/apps/ai/admin/reviews
    clickRow: { text: "{{kbName}}", action: 通过 }
    confirm: true
    expectApi: { method: POST, url: /ai/admin/reviews/, status: 200 }
  # v1.3 起广场平铺无 Tab：/square 重定向落地页 #square 锚点，三区内容同页可见，直接断言
  - role: student
    goto: /portal/apps/ai/square
    expectText: "{{kbName}}"
    timeoutMs: 20000
  - role: school
    goto: /portal/apps/ai/admin/reviews
    # 状态筛选是 Radix Select：先点触发器（当前值「待审核」）展开下拉，再选「已发布」选项
    click: 待审核
  - role: school
    click: 已发布
    clickRow: { text: "{{kbName}}", action: 下架 }
    confirm: true
    expectApi: { method: POST, url: /ai/admin/reviews/, status: 200 }
  - role: teacher
    goto: /portal/apps/ai/studio
    clickCard: { text: "{{kbName}}", action: 删除 }
    confirm: true
    expectApi: { method: DELETE, url: /ai/kb/, status: 200 }
```

### 3.3 智能体发布闭环（ai-agent-publish-loop）

```flow
flow: ai-agent-publish-loop
story: AG-1
desc: 教师建智能体 → 提交审核（警告确认）→ 管理员通过 → 学生广场可见 → 管理员下架 → 教师清理
steps:
  - role: teacher
    goto: /portal/apps/ai/studio
    clickCard: { text: "SMOKE_AI助手", action: 删除 }
    confirm: true
    optional: true
  - role: teacher
    goto: /portal/apps/ai/studio
    click: 新建智能体
    # 「新建智能体」是**跳转**到独立构建页 /portal/apps/ai/studio/agents/new（不再是弹窗），
    # 页面需等 majors/kbs/organizations 等数据加载完才渲染表单，故本步只确认构建页就绪
    expectText: 角色提示词
    timeoutMs: 20000
  - role: teacher
    # 字段 label 取自 agent-form.tsx：输入框 placeholder「智能体名称」、Label「角色提示词」
    # 角色提示词必须按 **placeholder** 定位：其 Label 与 Textarea 不在同一父容器
    # （agent-form.tsx:242 Label 在 flex 行内），按 label 找会回退并填到别的输入框 →
    # systemPrompt 为空 → 前端校验拦下、连请求都不发（2026-08-19 实测踩到）
    fill: { 智能体名称: "SMOKE_AI助手{rand}", 定义智能体的角色设定与回答规则: "SMOKE 巡检用提示词，仅测链路" }
    saveAs: { agentName: 智能体名称 }
    submit: 创建智能体
    expectApi: { method: POST, url: /ai/agents, status: 201 }
    timeoutMs: 20000
  - role: teacher
    goto: /portal/apps/ai/studio
    clickCard: { text: "{{agentName}}", action: 提交审核 }
    expectApi: { method: POST, url: /ai/agents/, status: 200 }
  # 审核列表切 Tab 后需等接口回数据再定位行（同一步内 clickRow 只有 8s 窗口，
  # 智能体审核 Tab 首次加载常超过该窗口 → 拆成「切 Tab 并等行出现」+「点通过」两步）
  - role: school
    goto: /portal/apps/ai/admin/reviews
    click: 智能体审核
    expectText: "{{agentName}}"
    timeoutMs: 25000
  - role: school
    clickRow: { text: "{{agentName}}", action: 通过 }
    confirm: true
    expectApi: { method: POST, url: /ai/admin/reviews/, status: 200 }
  - role: student
    goto: /portal/apps/ai/square
    expectText: "{{agentName}}"
    timeoutMs: 20000
  - role: school
    goto: /portal/apps/ai/admin/reviews
    click: 智能体审核
  - role: school
    # 状态筛选是 Radix Select：先点触发器（当前值「待审核」）展开下拉，再选「已发布」选项
    click: 待审核
  - role: school
    click: 已发布
    clickRow: { text: "{{agentName}}", action: 下架 }
    confirm: true
    expectApi: { method: POST, url: /ai/admin/reviews/, status: 200 }
  - role: teacher
    goto: /portal/apps/ai/studio
    clickCard: { text: "{{agentName}}", action: 删除 }
    confirm: true
    expectApi: { method: DELETE, url: /ai/agents/, status: 200 }
```

### 3.4 岗位发布闭环（job-publish-loop）

> 覆盖内容资源的完整状态机 draft→pending→approved→published→（取消发布）→删除，
> 是 job/scene/course/evaluation **四域共用** `ContentListPage`+`ApprovalListPage`+`EditorShell` 的代表链路：
> 这条通了，四域的「建→审→发→学生可见」骨架就都通了。
> 标签依据（均取自代码，非猜测）：新建按钮 `新建{entityLabel}`（`content-list-page.tsx:1389`）、
> 行内动作 `提交审批`/`发布`/`取消发布`/`删除`（`status-action-bar.tsx`）、审批动作 `通过`/`驳回`
> （`_components/approval-dialogs.tsx:299,303`）、编辑器字段 `岗位名称`（`step-basic-info.tsx:856`）、
> 编辑器按钮 `保存草稿`（`editor-shell.tsx`）、学生入口 `/job/landing`（审批页 detailHref 同源）。

```flow
flow: job-publish-loop
story: J-1
desc: 教师建岗位并填基础信息 → 提交审批 → 学校通过 → 发布 → 学生公开岗位大厅可见 → 取消发布 → 教师删除
steps:
  # 幂等清理（上次失败残留）
  - role: teacher
    goto: /job/positions
    clickRow: { text: "SMOKE_岗位", action: 删除 }
    confirm: true
    optional: true
  # 新建 = 直接建草稿并跳编辑器（content-list-page.tsx:handleCreate，无创建弹窗）
  - role: teacher
    goto: /job/positions
    click: 新建岗位
    expectApi: { method: POST, url: /job/positions, status: 201 }
    timeoutMs: 20000
  - role: teacher
    fill: { 岗位名称: "SMOKE_岗位{rand}" }
    saveAs: { jobName: 岗位名称 }
    submit: 保存草稿
    expectApi: { method: PUT, url: /job/positions/, status: 200 }
  # 前置：自建一条「审批人 = 巡检 school 账号」的审批流。
  # 不能用 select first 随便挑已有审批流：审批权限按 workflow.steps[].approverIds **逐用户**判定
  # （backend `isUserApproverForStep`），挑到别人的流程 → 审批必然 403。
  # 也不依赖批次分组：产品支持提交审批时直接关联审批流（本 flow 走该路径）。
  - role: school
    goto: /job/workflows
    clickRow: { text: "SMOKE_岗位审批流", action: 删除 }
    confirm: true
    optional: true
  - role: school
    goto: /job/workflows
    click: 新建审批流程
    expectText: 流程名称
  - role: school
    fill: { 流程名称: "SMOKE_岗位审批流{rand}" }
    saveAs: { wfName: 流程名称 }
  - role: school
    # 步骤名称必填：buildWorkflowSteps 会 filter 掉 name 为空的步骤，
    # 名称空 → built.length===0 → 前端报「请至少配置一个审批步骤」且不发请求
    click: 添加步骤
    fill: { 步骤名称: SMOKE_一次审批 }
  - role: school
    # UserSelector 为弹窗式：点占位按钮开弹窗（动作按 YAML 书写顺序执行）
    click: 选择审批人
    expectText: 选择用户
  - role: school
    # 用户列表是表格：clickRow 省略 action 时点击整行，正好触发 toggleUser 勾选
    # （不用 clickText：getByText 可能先命中隐藏节点导致点击超时）
    fill: { 搜索用户...: 巡检-学校管理员 }
    clickRow: { text: 巡检-学校管理员 }
  - role: school
    click: 确认
  - role: school
    submit: 创建流程
    expectApi: { method: POST, url: /workflows, status: 201 }
  # 提交审批：切到「按审批流程提交」并选中刚建的流程（confirmDisabled 在选中后解除）
  - role: teacher
    goto: /job/positions
    clickRow: { text: "{{jobName}}", action: 提交审批 }
    expectText: 提交审批
  - role: teacher
    click: 按审批流程提交
    select: { 选择审批流程: "{{wfName}}" }
    submit: 确认并提交审批
    expectApi: { method: POST, url: /approvals, status: 201 }
  - role: school
    goto: /job/approvals
    clickRow: { text: "{{jobName}}", action: 通过 }
    submit: 通过
    expectApi: { method: POST, url: /approvals/, status: 200 }
  # 发布/取消发布由**所有者 teacher** 执行：/job/positions 按归属与状态筛选，
  # school 账号打开该列表看不到 teacher 名下的岗位行（审批在 /job/approvals 才可见）
  - role: teacher
    goto: /job/positions
    expectText: "{{jobName}}"
    timeoutMs: 20000
  - role: teacher
    # 「发布」直接生效、无确认弹窗（与删除/取消发布不同），故不加 confirm
    clickRow: { text: "{{jobName}}", action: 发布 }
    expectApi: { method: POST, url: /job/positions/, status: 200 }
  # 学生侧公开岗位大厅可见（J-3）
  - role: student
    goto: /job/landing
    expectText: "{{jobName}}"
    timeoutMs: 20000
  - role: teacher
    # 「取消发布」同样直接生效、无确认弹窗
    goto: /job/positions
    clickRow: { text: "{{jobName}}", action: 取消发布 }
    expectApi: { method: POST, url: /job/positions/, status: 200 }
  - role: teacher
    goto: /job/positions
    clickRow: { text: "{{jobName}}", action: 删除 }
    confirm: true
    expectApi: { method: DELETE, url: /job/positions/, status: 200 }
  - role: school
    goto: /job/workflows
    clickRow: { text: "{{wfName}}", action: 删除 }
    confirm: true
    optional: true
```

> **首次运行提示**：本 flow 的路由与按钮文案均来自代码静态核对，但审批弹窗（`通过` 是否需要填意见后再点 `通过`）
> 与发布确认弹窗的按钮词在实机上可能略有差异；首次 `--flows` 运行若在这两步失败，按报告里的实际按钮文案微调即可，
> 其余步骤无需改动。

### 3.5 第三方挂接管理闭环（ai-integration-loop）

```flow
flow: ai-integration-loop
story: AD-2
desc: 管理员挂接第三方应用 → 学生广场应用区可见 → 管理员下架清理
steps:
  - role: school
    goto: /portal/apps/ai/admin/integrations
    clickRow: { text: "SMOKE_应用", action: 删除 }
    confirm: true
    optional: true
  - role: school
    goto: /portal/apps/ai/admin/integrations
    click: 新增
    fill: { 名称: "SMOKE_应用{rand}", URL: "https://example.com/app{rand}" }
    saveAs: { appName: 名称 }
    submit: true
    expectApi: { method: POST, url: /ai/admin/integrations, status: 201 }
  - role: student
    goto: /portal/apps/ai/landing#square
    expectText: "{{appName}}"
    timeoutMs: 20000
  - role: school
    goto: /portal/apps/ai/admin/integrations
    clickRow: { text: "{{appName}}", action: 下架 }
    expectApi: { method: POST, url: /ai/admin/integrations/, status: 200 }
  - role: school
    goto: /portal/apps/ai/admin/integrations
    clickRow: { text: "{{appName}}", action: 删除 }
    confirm: true
    expectApi: { method: DELETE, url: /ai/admin/integrations/, status: 200 }
    optional: true
```

### 3.6 体系课发布与学习闭环（course-publish-loop）

> 对应 PRD C-1/C-4/C-2。覆盖内容资源状态机（draft→pending→approved→published）+ 学生快照可见 + 学习页节点渲染，
> 是 lesson 域 `ContentListPage`+`ApprovalListPage`+`EditorShell` 的代表链路（与 job-publish-loop 同骨架，差异见各步注释）。
> 审批流为自建前置（同 job flow：审批权限按 workflow.steps[].approverIds 逐用户判定，必须选巡检 school 账号）。
> C-1/C-2 的作业提交/批改接口休眠未实现，本 flow 不覆盖；「生成快照」由发布事务自动完成，无手工步骤。

```flow
flow: course-publish-loop
story: C-1
desc: 教师建体系课并编排节点 → 提交审批（自建审批流）→ 学校通过 → 发布 → 学生落地页可见并进入学习页 → 取消发布删除清理
steps:
  # 幂等清理（上次失败残留；删除按钮仅 draft/rejected/archived 态可见，published 残留先取消发布）
  - role: teacher
    goto: /lesson/admin/system
    clickRow: { text: "SMOKE_体系课", action: 取消发布 }
    optional: true
  - role: teacher
    clickRow: { text: "SMOKE_体系课", action: 删除 }
    confirm: true
    optional: true
  # 新建体系课 = 直接建草稿并跳全屏编辑器（无创建弹窗）
  - role: teacher
    goto: /lesson/admin/system
    click: 新建体系课
    expectApi: { method: POST, url: /lesson/courses, status: 201 }
    timeoutMs: 20000
  # 编辑器异步加载（Suspense），等节点树按钮出现
  - role: teacher
    expectText: 添加节点
    timeoutMs: 20000
  # 「全局课程信息」Collapsible 默认折叠，先展开再填课程名称
  - role: teacher
    clickText: 全局课程信息
    fill: { 课程名称: "SMOKE_体系课{rand}" }
    saveAs: { courseName: 课程名称 }
  # 建节点：节点仅入前端 state，保存草稿时落库（POST /lesson/nodes 201）
  - role: teacher
    click: 添加节点
    fill: { 请输入节点名称: "SMOKE_章节{rand}" }
    saveAs: { nodeName: 请输入节点名称 }
    submit: 确认添加
  - role: teacher
    submit: 保存草稿
    expectApi: { method: PUT, url: /lesson/courses/, status: 200 }
  # 完成配置 = 再保存一次并返回列表
  - role: teacher
    click: 完成配置
  # ── school 自建审批流（与 job flow 同组件同文案，仅路由不同）──
  - role: school
    goto: /lesson/admin/workflows
    clickRow: { text: "SMOKE_课程审批流", action: 删除 }
    confirm: true
    optional: true
  - role: school
    goto: /lesson/admin/workflows
    click: 新建审批流程
    expectText: 流程名称
  - role: school
    fill: { 流程名称: "SMOKE_课程审批流{rand}" }
    saveAs: { wfName: 流程名称 }
  - role: school
    click: 添加步骤
    fill: { 步骤名称: SMOKE_一次审批 }
  - role: school
    click: 选择审批人
    expectText: 选择用户
  - role: school
    fill: { 搜索用户...: 巡检-学校管理员 }
    clickRow: { text: 巡检-学校管理员 }
  - role: school
    click: 确认
  - role: school
    submit: 创建流程
    expectApi: { method: POST, url: /workflows, status: 201 }
  # ── teacher 提交审批（未绑批次 → 按审批流程提交）──
  - role: teacher
    goto: /lesson/admin/system
    clickRow: { text: "{{courseName}}", action: 提交审批 }
    expectText: 提交审批
  - role: teacher
    click: 按审批流程提交
    select: { 选择审批流程: "{{wfName}}" }
    submit: 确认并提交审批
    expectApi: { method: POST, url: /approvals, status: 201 }
  # ── school 审批通过（确认按钮「确认通过」，非「通过」）──
  - role: school
    goto: /lesson/admin/approvals
    clickRow: { text: "{{courseName}}", action: 通过 }
    submit: 确认通过
    expectApi: { method: POST, url: /approvals/, status: 200 }
  # ── teacher 发布（无确认弹窗）──
  - role: teacher
    goto: /lesson/admin/system
    expectText: "{{courseName}}"
    timeoutMs: 20000
  - role: teacher
    clickRow: { text: "{{courseName}}", action: 发布 }
    expectApi: { method: POST, url: /lesson/courses/, status: 200 }
  # ── student：落地页可见 → 详情 → 学习页断言节点名（学生走快照 bundle，未发布课程 404）──
  - role: student
    goto: /lesson/landing
    expectText: "{{courseName}}"
    timeoutMs: 20000
  - role: student
    clickText: "{{courseName}}"
    expectText: 开始学习
    timeoutMs: 20000
  - role: student
    click: 开始学习
  # 学习页侧边栏默认折叠（体系课非混合 expandSidebar=false），先展开节点列表再断言节点名
  - role: student
    click: 展开节点列表
    expectText: "{{nodeName}}"
    timeoutMs: 20000
  # ── 收尾：取消发布 → 删除；school 删审批流 ──
  - role: teacher
    goto: /lesson/admin/system
    clickRow: { text: "{{courseName}}", action: 取消发布 }
    expectApi: { method: POST, url: /lesson/courses/, status: 200 }
    optional: true
  - role: teacher
    clickRow: { text: "{{courseName}}", action: 删除 }
    confirm: true
    expectApi: { method: DELETE, url: /lesson/courses/, status: 200 }
    optional: true
  - role: school
    goto: /lesson/admin/workflows
    clickRow: { text: "{{wfName}}", action: 删除 }
    confirm: true
    optional: true
```

### 3.7 考试安排闭环（exam-loop）

> 对应 PRD E-1/E-2。覆盖：试卷（ContentListPage）建→审→发 + 判断题自动判分 + 场次安排（exam-usage）创建并开启 + 学生考试中心参加答题并查分。
> 客观题（判断题）提交即自动判分（gradingStatus=evaluated），学生端立即见分，免教师手工评分。
> **前置（幂等）**：学生参与考试按班级开放，巡检学生账号默认无班级归属，需学校先将其加入一个班级（组织架构学生管理真实路径）。
> **历史缺陷（2026-08-20 实测发现并修复）**：① 场次「参与班级」MultiOrgNodePicker 确认按钮 type=submit，
> 点击后 submit 事件沿 React 组件树冒泡到外层宿主表单（portal 不隔离）→ 场次被提前创建且 target_ids 为空；
> 已修复：确认按钮改 confirmType="button"+onConfirm，picker form onSubmit 加 stopPropagation。
> ② 场次列表页初始加载从不置 loading=false，表格永远「加载中」；已修复（fetchUsages 补 setLoading(false)）。
> 两处修复后 E-2 学生参加/查分链路恢复，本 flow 全链路验证。

```flow
flow: exam-loop
story: E-1
desc: 学校给学生分配班级（前置）→ 教师建试卷加判断题 → 审批通过 → 发布 → 创建考试场次（请求成功）→ 清理
steps:
  # ── 前置：给巡检学生分配班级（组织架构学生管理；已分配过则跳过，保存幂等）──
  - role: school
    goto: /portal/apps/system/org-user/students
    fill: { 搜索姓名、登录账号...: 巡检-学生 }
    clickRow: { text: 巡检-学生, action: 编辑 }
    expectText: 编辑学生
    timeoutMs: 20000
  # OrgNodePicker 触发器文案 = 未分配时 placeholder「选择班级」，已分配时显示班级名；
  # 已分配时「选择班级」找不到 → optional 记 skip（幂等前置已完成），直接保存不变更
  - role: school
    clickText: 选择班级
    fill: { 搜索节点名称...: 软件技术2401 }
    optional: true
  - role: school
    clickText: 软件技术2401
    submit: true
    optional: true
  - role: school
    submit: 保存
    expectApi: { method: PUT, url: /users/, status: 200 }
    timeoutMs: 20000
  # ── teacher：建试卷（ContentListPage 弹窗表单）──
  - role: teacher
    goto: /evaluation/exams
    clickRow: { text: "SMOKE_试卷", action: 删除 }
    confirm: true
    optional: true
  - role: teacher
    goto: /evaluation/exams
    click: 新建试卷
    expectText: 试卷名称
  - role: teacher
    fill: { 请输入试卷名称: "SMOKE_试卷{rand}" }
    saveAs: { examName: 请输入试卷名称 }
    submit: true
    expectApi: { method: POST, url: /evaluation/exams, status: 201 }
    timeoutMs: 20000
  # 试卷详情：新增题目（下拉菜单）→ 判断题
  - role: teacher
    expectText: 新增题目
    timeoutMs: 20000
  - role: teacher
    click: 新增题目
  - role: teacher
    click: 判断题
    fill: { 请输入题目内容...: "SMOKE_判断题{rand}：测试链路是否通" }
  - role: teacher
    click: 正确
    submit: 保存并关闭
    expectApi: { method: POST, url: /evaluation/questions, status: 201 }
    timeoutMs: 20000
  # ── 审批（workflow 前置同 job flow，路由 /evaluation/workflows）──
  - role: school
    goto: /evaluation/workflows
    clickRow: { text: "SMOKE_试卷审批流", action: 删除 }
    confirm: true
    optional: true
  - role: school
    goto: /evaluation/workflows
    click: 新建审批流程
    expectText: 流程名称
  - role: school
    fill: { 流程名称: "SMOKE_试卷审批流{rand}" }
    saveAs: { wfName: 流程名称 }
  - role: school
    click: 添加步骤
    fill: { 步骤名称: SMOKE_一次审批 }
  - role: school
    click: 选择审批人
    expectText: 选择用户
  - role: school
    fill: { 搜索用户...: 巡检-学校管理员 }
    clickRow: { text: 巡检-学校管理员 }
  - role: school
    click: 确认
  - role: school
    submit: 创建流程
    expectApi: { method: POST, url: /workflows, status: 201 }
  - role: teacher
    goto: /evaluation/exams
    clickRow: { text: "{{examName}}", action: 提交审批 }
    expectText: 提交审批
  - role: teacher
    click: 按审批流程提交
    select: { 选择审批流程: "{{wfName}}" }
    submit: 确认并提交审批
    expectApi: { method: POST, url: /approvals, status: 201 }
  - role: school
    goto: /evaluation/approvals
    clickRow: { text: "{{examName}}", action: 通过 }
    submit: 确认通过
    expectApi: { method: POST, url: /approvals/, status: 200 }
  - role: teacher
    goto: /evaluation/exams
    expectText: "{{examName}}"
    timeoutMs: 20000
  - role: teacher
    clickRow: { text: "{{examName}}", action: 发布 }
    expectApi: { method: POST, url: /evaluation/exams/, status: 200 }
  # ── teacher：创建考试场次（修复后正常流程：确认班级 → 创建 → 列表验证 → 开启）──
  - role: teacher
    goto: /evaluation/exam-usage
    click: 创建考试使用
    expectText: 选择试卷
    timeoutMs: 20000
  - role: teacher
    select: { 选择试卷: "{{examName}}" }
    fill: { 请输入考试名称: "SMOKE_场次{rand}" }
    saveAs: { usageName: 请输入考试名称 }
  # 参与班级：确认按钮已修复为 type=button（不再提前提交外层表单），确认后点「创建」正常创建
  - role: teacher
    click: 添加班级
    fill: { 搜索...: 软件技术2401 }
  - role: teacher
    check: { 软件技术2401: true }
    submit: true
  - role: teacher
    submit: 创建
    expectApi: { method: POST, url: /evaluation/exam-usages, status: 201 }
    timeoutMs: 20000
  # 列表验证 + 开启（列表 loading 已修复）
  - role: teacher
    goto: /evaluation/exam-usage
    expectText: "{{usageName}}"
    timeoutMs: 20000
  - role: teacher
    clickRow: { text: "{{usageName}}", action: 开启 }
    expectApi: { method: POST, url: /evaluation/exam-usages/, status: 200 }
  # ── student：考试中心参加答题 → 查分（班级已生效，ClassMatch=true）──
  - role: student
    goto: /evaluation/landing/exam-center
    expectText: "{{usageName}}"
    timeoutMs: 20000
  - role: student
    expectText: 开始考试
    timeoutMs: 20000
  - role: student
    click: 开始考试
  - role: student
    click: 正确
    submit: 提交试卷
    expectApi: { method: POST, url: /evaluation/exam-results, status: 201 }
    timeoutMs: 30000
  - role: student
    goto: /evaluation/landing/exam-center
    expectText: 已交卷
    timeoutMs: 20000
  # ── 收尾：删场次 + 删试卷（取消发布→删除，级联清理场次）；school 删审批流 ──
  - role: teacher
    goto: /evaluation/exam-usage
    clickRow: { text: "{{usageName}}", action: 删除 }
    confirm: true
    optional: true
  - role: teacher
    goto: /evaluation/exams
    clickRow: { text: "{{examName}}", action: 取消发布 }
    optional: true
  - role: teacher
    clickRow: { text: "{{examName}}", action: 删除 }
    confirm: true
    optional: true
  - role: school
    goto: /evaluation/workflows
    clickRow: { text: "{{wfName}}", action: 删除 }
    confirm: true
    optional: true
```

> **残留说明**：场次随试卷删除级联清理（exam_usages.exam_id ON DELETE CASCADE）；学生考试结果记录无 UI 删除入口，属预期残留。
> **残留说明**：学生考试结果记录（exam_results）无 UI 删除入口，属预期残留（与 job 投递记录同口径）。
> 场次删除仅对「手动创建」的安排可用（自动创建的不允许编辑/删除）。

### 3.8 场景任务闭环（scene-task-loop）

> 对应 PRD SC-1/SC-2/SC-3。覆盖：场景（ContentListPage）建→审→发 + 任务编排（添加任务落库）+ 测评形式配置（完成配置时落库）+
> 学生提交任务（文字说明，免文件）+ 教师评分。
> **按 UI 现状裁剪**：任务依赖（dependency_ids）无编辑控件（模型/接口在，前端未实现）不入 flow；难度⭐/拖拽排序 DSL 不可驱动（默认值+创建顺序即可）；
> 场景列表有 2min 租户缓存，学生可见性断言给足 timeout。
> **残留说明**：学生提交/评分记录无 UI 删除入口；**已有测评结果的场景删除返回 409**（产品限制），flow 收尾的删除步骤记 WARN 属预期——场景以草稿态残留，下次运行幂等清理同样 409 容忍。

```flow
flow: scene-task-loop
story: SC-1
desc: 教师编排场景与任务并配置测评形式 → 提交审批（自建审批流）→ 学校通过 → 发布 → 学生提交任务 → 教师评分 → 清理
steps:
  # 幂等清理（删除仅草稿/驳回/归档态可见，published 残留先取消发布）
  - role: teacher
    goto: /scene
    clickRow: { text: "SMOKE_场景", action: 取消发布 }
    optional: true
  - role: teacher
    clickRow: { text: "SMOKE_场景", action: 删除 }
    confirm: true
    optional: true
  # 新建场景 = 直接建草稿跳编辑器（无弹窗）
  - role: teacher
    goto: /scene
    click: 新建场景
    expectApi: { method: POST, url: /scene/scenarios, status: 201 }
    timeoutMs: 20000
  - role: teacher
    expectText: 场景名称
    timeoutMs: 20000
  - role: teacher
    fill: { 场景名称: "SMOKE_场景{rand}" }
    saveAs: { sceneName: 场景名称 }
    submit: 保存草稿
    expectApi: { method: PUT, url: /scene/scenarios/, status: 200 }
  # 下一步 → 任务链配置
  - role: teacher
    click: 下一步
  # 添加任务（弹窗确认按钮「添加」，点即落库 201）
  - role: teacher
    click: 添加任务
    fill: { 输入任务名称: "SMOKE_任务{rand}" }
    saveAs: { taskName: 输入任务名称 }
    submit: 添加
    expectApi: { method: POST, url: /scene/tasks, status: 201 }
  # 配置任务测评形式：选「作业」；弹窗「保存」仅写本地 state，完成配置时才落库
  - role: teacher
    click: 配置任务测评形式
  - role: teacher
    click: 作业
    submit: 保存
  # 完成配置：逐任务保存 + 测评方式落库
  - role: teacher
    click: 完成配置
    expectApi: { method: PUT, url: /scene/tasks/, status: 200 }
    timeoutMs: 20000
  # ── school 自建审批流（/scene/workflows 同组件）──
  - role: school
    goto: /scene/workflows
    clickRow: { text: "SMOKE_场景审批流", action: 删除 }
    confirm: true
    optional: true
  - role: school
    goto: /scene/workflows
    click: 新建审批流程
    expectText: 流程名称
  - role: school
    fill: { 流程名称: "SMOKE_场景审批流{rand}" }
    saveAs: { wfName: 流程名称 }
  - role: school
    click: 添加步骤
    fill: { 步骤名称: SMOKE_一次审批 }
  - role: school
    click: 选择审批人
    expectText: 选择用户
  - role: school
    fill: { 搜索用户...: 巡检-学校管理员 }
    clickRow: { text: 巡检-学校管理员 }
  - role: school
    click: 确认
  - role: school
    submit: 创建流程
    expectApi: { method: POST, url: /workflows, status: 201 }
  # ── teacher 提交审批 / school 通过 / teacher 发布 ──
  - role: teacher
    goto: /scene
    clickRow: { text: "{{sceneName}}", action: 提交审批 }
    expectText: 提交审批
  - role: teacher
    click: 按审批流程提交
    select: { 选择审批流程: "{{wfName}}" }
    submit: 确认并提交审批
    expectApi: { method: POST, url: /approvals, status: 201 }
  - role: school
    goto: /scene/approvals
    clickRow: { text: "{{sceneName}}", action: 通过 }
    submit: 确认通过
    expectApi: { method: POST, url: /approvals/, status: 200 }
  - role: teacher
    goto: /scene
    expectText: "{{sceneName}}"
    timeoutMs: 20000
  - role: teacher
    clickRow: { text: "{{sceneName}}", action: 发布 }
    expectApi: { method: POST, url: /scene/scenarios/, status: 200 }
  # ── student：大厅可见 → 学习页提交任务（文字说明，免文件）──
  - role: student
    goto: /scene/landing
    expectText: "{{sceneName}}"
    timeoutMs: 30000
  - role: student
    clickText: "{{sceneName}}"
    expectText: 开始学习
    timeoutMs: 20000
  - role: student
    click: 开始学习
  # 学习页侧边栏默认折叠，先展开任务列表再选中任务
  - role: student
    click: 展开任务列表
    clickText: "{{taskName}}"
  - role: student
    click: 上传作业
    fill: { 描述你的成果/作业内容...: "SMOKE_作业说明{rand}" }
    submit: 提交测评
    expectApi: { method: POST, url: /evaluation/results, status: 201 }
    timeoutMs: 20000
  # ── teacher：评分（scene-results 列表 → 展开 → 评分 → 提交评分）──
  # 场景列表按 updated_at DESC，刚发布的场景自动选中第一个并带出提交记录；
  # 不可再点场景行：点击已选场景会清空结果且同 id 不重跑加载（页面缺陷，规避）
  - role: teacher
    goto: /evaluation/scene-results
    expectText: "{{sceneName}}"
    timeoutMs: 20000
  - role: teacher
    expectText: 全部展开
    timeoutMs: 20000
  - role: teacher
    click: 全部展开
  - role: teacher
    clickText: 评分
    expectText: 提交评分
    timeoutMs: 20000
  - role: teacher
    submit: 提交评分
    expectApi: { method: POST, url: /evaluation/results/, status: 200 }
    timeoutMs: 20000
  # ── 收尾：取消发布 → 删除场景；school 删审批流（学生提交/评分记录无 UI 删除，残留容忍）──
  - role: teacher
    goto: /scene
    clickRow: { text: "{{sceneName}}", action: 取消发布 }
    expectApi: { method: POST, url: /scene/scenarios/, status: 200 }
    optional: true
  - role: teacher
    clickRow: { text: "{{sceneName}}", action: 删除 }
    confirm: true
    expectApi: { method: DELETE, url: /scene/scenarios/, status: 200 }
    optional: true
  - role: school
    goto: /scene/workflows
    clickRow: { text: "{{wfName}}", action: 删除 }
    confirm: true
    optional: true
```

### 3.9 教务计划闭环（affairs-plan-loop）

> 对应 PRD A-1/A-2/A-3。覆盖：人培方案（ContentListPage）建→设岗位课程→审→发 + 生成教学计划弹窗就绪验证 + 学生工作台课表入口。
> **按 UI 现状裁剪**：学期创建弹窗用日历组件（react-day-picker）DSL 不可驱动，flow 复用环境既有学期；
> 「自动排课」仅 API（`/affairs/schedules/auto-schedule`）无 UI 入口，网格手动排课 DSL 不可驱动；
> 学生课表入口（工作台「我的课表」Tab）渲染校验（空态/已发布均正常，pageerror 哨兵兜白屏）。
> **环境前置缺失（2026-08-20 实测）**：测试租户（巡检 school 租户）**无已发布体系课、无教学计划**（均在其它租户）：
> 人培方案课程行的「体系课」下拉为空 → 教学计划 generate 400「该人培方案尚未配置课程」；排课页「请选择教学计划」无可选项。
> flow 以「岗位行可保存 + 方案审批发布 + 生成弹窗中方案可选 + 学生课表入口渲染」验证 A-1 链路，A-2 排课与计划生成待租户补数据后补全。

```flow
flow: affairs-plan-loop
story: A-1
desc: 学校建人培方案并设岗位课程 → 审批发布 → 生成教学计划弹窗就绪验证 → 学生工作台课表入口正常
steps:
  # 幂等清理（方案删除仅草稿/驳回态可见，published 残留先取消发布）
  - role: school
    goto: /affairs/programs
    clickRow: { text: "SMOKE_方案", action: 取消发布 }
    optional: true
  - role: school
    clickRow: { text: "SMOKE_方案", action: 删除 }
    confirm: true
    optional: true
  # A-1：新建人培方案（ContentListPage 直接建草稿，跳详情编辑）
  - role: school
    goto: /affairs/programs
    click: 新建人培方案
    expectApi: { method: POST, url: /affairs/programs, status: 201 }
    timeoutMs: 20000
  - role: school
    expectText: 方案名称
    timeoutMs: 20000
  - role: school
    fill: { 方案名称: "SMOKE_方案{rand}" }
    saveAs: { programName: 方案名称 }
    # 新建后跳详情为**编辑态**（URL 是真实 id，isNew=false），保存按钮是「保存基本信息」
    submit: 保存基本信息
    expectApi: { method: PUT, url: /affairs/programs/, status: 200 }
    timeoutMs: 20000
  # 课程设置：切 Tab → 添加岗位/课程行（默认岗位类型）→ 选第一个岗位 → 保存
  # （教学计划生成要求方案配置「课程」行；测试租户无已发布体系课——课程下拉为空「未找到体系课」——
  #   岗位行可正常保存，但 generate 因此 400「该人培方案尚未配置课程」，属环境前置数据缺失，见 flow 说明）
  - role: school
    click: 课程设置
  - role: school
    click: 添加岗位/课程
  - role: school
    select: { 搜索岗位...: first }
  - role: school
    click: 保存
    expectApi: { method: PUT, url: /affairs/programs/, status: 200 }
    timeoutMs: 20000
  - role: school
    click: 返回列表
  # ── 审批（workflow 前置同 job flow，路由 /affairs/workflows；学校建可自审，无创建者限制）──
  - role: school
    goto: /affairs/workflows
    clickRow: { text: "SMOKE_方案审批流", action: 删除 }
    confirm: true
    optional: true
  - role: school
    goto: /affairs/workflows
    click: 新建审批流程
    expectText: 流程名称
  - role: school
    fill: { 流程名称: "SMOKE_方案审批流{rand}" }
    saveAs: { wfName: 流程名称 }
  - role: school
    click: 添加步骤
    fill: { 步骤名称: SMOKE_一次审批 }
  - role: school
    click: 选择审批人
    expectText: 选择用户
  - role: school
    fill: { 搜索用户...: 巡检-学校管理员 }
    clickRow: { text: 巡检-学校管理员 }
  - role: school
    click: 确认
  - role: school
    submit: 创建流程
    expectApi: { method: POST, url: /workflows, status: 201 }
  - role: school
    goto: /affairs/programs
    clickRow: { text: "{{programName}}", action: 提交审批 }
    expectText: 提交审批
  - role: school
    click: 按审批流程提交
    select: { 选择审批流程: "{{wfName}}" }
    submit: 确认并提交审批
    expectApi: { method: POST, url: /approvals, status: 201 }
  - role: school
    goto: /affairs/approvals
    clickRow: { text: "{{programName}}", action: 通过 }
    submit: 确认通过
    expectApi: { method: POST, url: /approvals/, status: 200 }
  - role: school
    goto: /affairs/programs
    expectText: "{{programName}}"
    timeoutMs: 20000
  - role: school
    clickRow: { text: "{{programName}}", action: 发布 }
    expectApi: { method: POST, url: /affairs/programs/, status: 200 }
  # A-1→A-2 就绪验证：生成教学计划弹窗打开后，已发布方案可被选中（方案在下拉中可选），随后取消关闭
  # （生成动作本身因测试租户无已发布体系课而 400，见 flow 说明；弹窗可选即证明 A-1 发布链就绪）
  - role: school
    goto: /affairs/teaching-plans
    click: 新建教学计划
    expectText: 人培方案（已发布）
    timeoutMs: 20000
  - role: school
    select: { 请选择人培方案: "{{programName}}" }
    expectText: "{{programName}}"
    timeoutMs: 20000
  - role: school
    click: 取消
  # A-2/A-3：学生工作台「我的课表」Tab 入口正常（pageerror 哨兵兜渲染崩溃）
  # （排课页因测试租户无已确认教学计划——教学计划均在其它租户——无法选择计划，跳过错开）
  - role: student
    goto: /portal/workspace
    click: 我的课表
    expectText: 我的课表
    timeoutMs: 20000
  # ── 收尾：取消发布 → 删除方案；删审批流（教学计划/排课记录残留容忍）──
  - role: school
    goto: /affairs/programs
    clickRow: { text: "{{programName}}", action: 取消发布 }
    expectApi: { method: POST, url: /affairs/programs/, status: 200 }
    optional: true
  - role: school
    clickRow: { text: "{{programName}}", action: 删除 }
    confirm: true
    expectApi: { method: DELETE, url: /affairs/programs/, status: 200 }
    optional: true
  - role: school
    goto: /affairs/workflows
    clickRow: { text: "{{wfName}}", action: 删除 }
    confirm: true
    optional: true
```

> **首次运行提示**：`请选择教学计划: first` 依赖排课页加载的教学计划顺序，若首项不是刚生成的计划，可按报告改为选择方案名关联的计划；生成教学计划成功后页面跳转详情，若断言失败按报告微调。

### 3.10 联盟公开页闭环（alliance-public-loop）

> 对应 PRD L-1/L-3。覆盖：合作协议台账（挂企业 + 前台展示开关）→ 学生公开页企业详情「合作协议」区可见 → 清理。
> 可见性规则（alliance_public_agreements 测试坐实）：协议 `is_public=true` 且关联公开企业才展示；前台展示开关用 DSL `toggle` 动作驱动。
> 企业前置（幂等）：巡检企业需已引入且合作中（与 employment-hall-loop 同前置）。

```flow
flow: alliance-public-loop
story: L-1
desc: 学校维护合作协议台账（挂巡检测试企业并开前台展示）→ 学生公开页企业详情可见 → 学校清理
steps:
  # 幂等前置：巡检企业合作中 + 本校前台展示开（双控：企业 enable_public 且链接 is_public，否则公开页不可见）
  - role: school
    goto: /portal/apps/alliance/enterprises
    fill: { 搜索企业名称或行业: 巡检测试企业 }
    clickRow: { text: 巡检测试企业, action: 编辑 }
    select: { 合作状态: 合作中 }
    toggle: { 在本校前台展示: true }
    submit: true
    expectApi: { method: PUT, url: /alliance/enterprises/, status: 200 }
    optional: true
  # 幂等清理：删 SMOKE_ 协议残留
  - role: school
    goto: /portal/apps/alliance/agreements
    clickRow: { text: "SMOKE_协议", action: 删除 }
    confirm: true
    optional: true
  # L-1：新建合作协议（名称 + 挂企业 + 日期 + 前台展示开关）
  - role: school
    goto: /portal/apps/alliance/agreements/new
    fill: { 请输入协议名称: "SMOKE_协议{rand}" }
    saveAs: { agreementName: 请输入协议名称 }
    select: { 选择合作企业: 巡检测试企业 }
  - role: school
    fill: { 生效日期: "2026-01-01", 到期日期: "2026-12-31" }
    toggle: { 前台展示: true }
    submit: 创建
    expectApi: { method: POST, url: /alliance/agreements, status: 201 }
    timeoutMs: 20000
  # L-3：学生公开页企业详情「合作协议」Tab 可见（is_public=true 且企业公开；协议内容是 Tab 页，需先切 Tab）
  - role: student
    goto: /portal/alliance/enterprises
    clickText: 巡检测试企业
  - role: student
    click: 合作协议
    expectText: "{{agreementName}}"
    timeoutMs: 20000
  # ── 收尾：删除协议 ──
  - role: school
    goto: /portal/apps/alliance/agreements
    fill: { 搜索协议名称: "{{agreementName}}" }
    clickRow: { text: "{{agreementName}}", action: 删除 }
    confirm: true
    expectApi: { method: DELETE, url: /alliance/agreements/, status: 200 }
    optional: true
```

### 3.11 资源复用闭环（resource-reuse-loop）

> 对应 PRD R-1。覆盖：链接类型资源创建（免文件上传，DSL 无 upload 动作）→ 绑定到场景任务（配置任务资源选择器）→ 完成配置落库 → 任务卡片可见 → 清理。
> 资源→课程节点绑定路径在体系课编辑器内（重链路，课程链已有 course-publish-loop），此处取场景任务路径验证「资源可被任务绑定（多对多）」。
> 场景仅作绑定载体：不审批不发布，草稿态即可绑定，删除按钮草稿态可用。
> **角色说明**：巡检环境 teacher 角色未配置 library 资源管理菜单（`roles.permissions.menus` 缺 `/library/resources/link`），本 flow 用 school（school_admin 无显式菜单=全量放行）；PRD R-1 语义由学校侧资源管理覆盖。

```flow
flow: resource-reuse-loop
story: R-1
desc: 学校创建链接资源 → 编排场景任务并绑定资源 → 完成配置落库 → 任务卡片可见 → 清理
steps:
  # 幂等清理：删 SMOKE_ 资源残留（资源库列表）
  - role: school
    goto: /library/resources/link
    clickRow: { text: "SMOKE_资源", action: 删除 }
    confirm: true
    optional: true
  # R-1：创建链接类型资源（链接免文件上传）
  - role: school
    goto: /library/resources/link
    click: 新建资源
    fill: { 输入资源名称: "SMOKE_资源{rand}" }
    saveAs: { resourceName: 输入资源名称 }
  - role: school
    fill: { URL 地址: "https://example.com/res{rand}" }
    submit: 上传到资源库
    expectApi: { method: POST, url: /library/resources, status: 201 }
    timeoutMs: 20000
  - role: school
    expectText: "{{resourceName}}"
    timeoutMs: 20000
  # ── 载体：场景 + 任务（草稿态即可绑定）──
  - role: school
    goto: /scene
    clickRow: { text: "SMOKE_资源场景", action: 删除 }
    confirm: true
    optional: true
  - role: school
    goto: /scene
    click: 新建场景
    expectApi: { method: POST, url: /scene/scenarios, status: 201 }
    timeoutMs: 20000
  - role: school
    expectText: 场景名称
    timeoutMs: 20000
  - role: school
    fill: { 场景名称: "SMOKE_资源场景{rand}" }
    saveAs: { sceneName: 场景名称 }
    submit: 保存草稿
  - role: school
    click: 下一步
  - role: school
    click: 添加任务
    fill: { 输入任务名称: "SMOKE_资源任务{rand}" }
    saveAs: { taskName: 输入任务名称 }
    submit: 添加
    expectApi: { method: POST, url: /scene/tasks, status: 201 }
  # 绑定：配置任务资源在 EditCardDialog 弹窗内 → 搜索选中刚建的资源 → 保存关弹窗（否则顶栏被弹窗覆盖）
  - role: school
    click: 配置任务资源
    fill: { 搜索资源名称...: "{{resourceName}}" }
  - role: school
    clickText: "{{resourceName}}"
    expectText: "{{resourceName}}"
    timeoutMs: 20000
  - role: school
    submit: 保存
  - role: school
    click: 完成配置
    expectApi: { method: PUT, url: /scene/tasks/, status: 200 }
    timeoutMs: 20000
  # ── 收尾：删除场景（含任务绑定随删）；删资源 ──
  - role: school
    goto: /scene
    clickRow: { text: "{{sceneName}}", action: 删除 }
    confirm: true
    expectApi: { method: DELETE, url: /scene/scenarios/, status: 200 }
    optional: true
  - role: school
    goto: /library/resources/link
    clickRow: { text: "{{resourceName}}", action: 删除 }
    confirm: true
    optional: true
```

### 3.12 教学计划与排课全链路（teaching-plan-schedule-loop）

> 对应 PRD A-1/A-2/A-3。覆盖完整链路：建体系课并发布 → 建人培方案（选专业+挂课程行）并审批发布 →
> 生成教学计划（条目自动挂专业班级）→ 教学计划审批发布 → 排课（网格 cell 排入一节）→ 发布课表 →
> 学生工作台课表可见。
> 本条 flow 自给前置数据（课程/方案/计划均在本 flow 创建），解决测试租户无已发布课程/计划的缺口；
> 排课网格空单元格无文字属性，由 DSL 新增 `clickCell` 动作（行文字×列头文字定位）驱动；
> 教学计划生成后为 draft，需走内容通用状态机（提交审批→通过→发布）才能被排课页选择（排课页仅列 published）。
> 课程/方案/教学计划共用一条自建审批流（workflows 全局，审批人=巡检 school 账号）。
> **收尾残留**：教学计划/排课记录/课表无 UI 删除入口（或受引用限制），以草稿/已发布状态残留（SMOKE_ 前缀，定期 SQL 清理）；
> flow 收尾 best-effort 清理方案/课程并删除审批流。

```flow
flow: teaching-plan-schedule-loop
story: A-1
desc: 建体系课发布 → 建人培方案挂课程审批发布 → 生成教学计划并审批发布 → 排课发布课表 → 学生课表可见
steps:
  # ── 幂等清理（best-effort：方案/课程取消发布→删除；计划/排课残留容忍）──
  - role: school
    goto: /affairs/programs
    clickRow: { text: "SMOKE_计划方案", action: 取消发布 }
    optional: true
  - role: school
    clickRow: { text: "SMOKE_计划方案", action: 删除 }
    confirm: true
    optional: true
  - role: teacher
    goto: /lesson/admin/system
    clickRow: { text: "SMOKE_计划课程", action: 取消发布 }
    optional: true
  - role: teacher
    clickRow: { text: "SMOKE_计划课程", action: 删除 }
    confirm: true
    optional: true
  # ── 自建审批流（课程/方案/教学计划共用）──
  - role: school
    goto: /lesson/admin/workflows
    clickRow: { text: "SMOKE_计划审批流", action: 删除 }
    confirm: true
    optional: true
  - role: school
    goto: /lesson/admin/workflows
    click: 新建审批流程
    expectText: 流程名称
  - role: school
    fill: { 流程名称: "SMOKE_计划审批流{rand}" }
    saveAs: { wfName: 流程名称 }
  - role: school
    click: 添加步骤
    fill: { 步骤名称: SMOKE_一次审批 }
  - role: school
    click: 选择审批人
    expectText: 选择用户
  - role: school
    fill: { 搜索用户...: 巡检-学校管理员 }
    clickRow: { text: 巡检-学校管理员 }
  - role: school
    click: 确认
  - role: school
    submit: 创建流程
    expectApi: { method: POST, url: /workflows, status: 201 }
  # ── 建体系课并发布（供方案课程行引用）──
  - role: teacher
    goto: /lesson/admin/system
    click: 新建体系课
    expectApi: { method: POST, url: /lesson/courses, status: 201 }
    timeoutMs: 20000
  - role: teacher
    expectText: 添加节点
    timeoutMs: 20000
  - role: teacher
    clickText: 全局课程信息
    fill: { 课程名称: "SMOKE_计划课程{rand}" }
    saveAs: { courseName: 课程名称 }
  - role: teacher
    submit: 保存草稿
    expectApi: { method: PUT, url: /lesson/courses/, status: 200 }
  - role: teacher
    click: 完成配置
  - role: teacher
    goto: /lesson/admin/system
    clickRow: { text: "{{courseName}}", action: 提交审批 }
    expectText: 提交审批
  - role: teacher
    click: 按审批流程提交
    select: { 选择审批流程: "{{wfName}}" }
    submit: 确认并提交审批
    expectApi: { method: POST, url: /approvals, status: 201 }
  - role: school
    goto: /lesson/admin/approvals
    clickRow: { text: "{{courseName}}", action: 通过 }
    submit: 确认通过
    expectApi: { method: POST, url: /approvals/, status: 200 }
  - role: teacher
    goto: /lesson/admin/system
    expectText: "{{courseName}}"
    timeoutMs: 20000
  - role: teacher
    clickRow: { text: "{{courseName}}", action: 发布 }
    expectApi: { method: POST, url: /lesson/courses/, status: 200 }
  # ── 建人培方案：选专业（软件技术）+ 挂刚发布的体系课 → 审批发布 ──
  - role: school
    goto: /affairs/programs
    click: 新建人培方案
    expectApi: { method: POST, url: /affairs/programs, status: 201 }
    timeoutMs: 20000
  - role: school
    expectText: 方案名称
    timeoutMs: 20000
  - role: school
    fill: { 方案名称: "SMOKE_计划方案{rand}" }
    saveAs: { programName: 方案名称 }
    select: { 请选择专业: 软件技术 }
    submit: 保存基本信息
    expectApi: { method: PUT, url: /affairs/programs/, status: 200 }
    timeoutMs: 20000
  - role: school
    click: 课程设置
  - role: school
    click: 添加岗位/课程
  - role: school
    select: { 岗位: 体系课 }
  - role: school
    select: { 搜索体系课...: "{{courseName}}" }
  - role: school
    click: 保存
    expectApi: { method: PUT, url: /affairs/programs/, status: 200 }
    timeoutMs: 20000
  - role: school
    click: 返回列表
  - role: school
    clickRow: { text: "{{programName}}", action: 提交审批 }
    expectText: 提交审批
  - role: school
    click: 按审批流程提交
    select: { 选择审批流程: "{{wfName}}" }
    submit: 确认并提交审批
    expectApi: { method: POST, url: /approvals, status: 201 }
  - role: school
    goto: /affairs/approvals
    clickRow: { text: "{{programName}}", action: 通过 }
    submit: 确认通过
    expectApi: { method: POST, url: /approvals/, status: 200 }
  - role: school
    goto: /affairs/programs
    expectText: "{{programName}}"
    timeoutMs: 20000
  - role: school
    clickRow: { text: "{{programName}}", action: 发布 }
    expectApi: { method: POST, url: /affairs/programs/, status: 200 }
  # ── 生成教学计划（draft）→ 审批 → 发布（排课页仅列 published）──
  - role: school
    goto: /affairs/teaching-plans
    click: 新建教学计划
    expectText: 人培方案（已发布）
    timeoutMs: 20000
  - role: school
    select: { 请选择人培方案: "{{programName}}" }
  - role: school
    select: { 请选择学期: first }
    submit: 生成教学计划
    expectApi: { method: POST, url: /affairs/teaching-plans, status: 201 }
    timeoutMs: 20000
  - role: school
    goto: /affairs/teaching-plans
    clickRow: { text: "{{courseName}}", action: 提交审批 }
    expectText: 提交审批
    timeoutMs: 20000
  - role: school
    click: 按审批流程提交
    select: { 选择审批流程: "{{wfName}}" }
    submit: 确认并提交审批
    expectApi: { method: POST, url: /approvals, status: 201 }
  - role: school
    goto: /affairs/approvals
    clickRow: { text: "{{courseName}}", action: 通过 }
    submit: 确认通过
    expectApi: { method: POST, url: /approvals/, status: 200 }
  - role: school
    goto: /affairs/teaching-plans
    expectText: "{{courseName}}"
    timeoutMs: 20000
  - role: school
    clickRow: { text: "{{courseName}}", action: 发布 }
    expectApi: { method: POST, url: /affairs/teaching-plans/, status: 200 }
  # ── 排课：选计划 → 待排条目 → 排入 周一·上午第一节课 ──
  # 条目自动挂专业（软件技术）班级，弹窗班级预填；场地必选
  - role: school
    goto: /affairs/scheduling
    expectText: 请选择教学计划
    timeoutMs: 20000
  - role: school
    select: { 请选择教学计划: "{{programName}}" }
    clickText: "{{courseName}}"
    timeoutMs: 20000
  - role: school
    clickCell: { 上午第一节课: 周一 }
    expectText: 编辑排课
    timeoutMs: 20000
  - role: school
    select: { 选择场地: first }
    submit: 保存
    expectApi: { method: POST, url: /affairs/schedules, status: 201 }
    timeoutMs: 20000
  # ── 发布课表（课表视图与发布 Tab）──
  - role: school
    click: 课表视图与发布
    expectText: 发布
    timeoutMs: 20000
  - role: school
    click: 发布
    expectApi: { method: POST, url: /affairs/schedules/publish, status: 200 }
    timeoutMs: 20000
  # ── 学生课表可见（学生已属 软件技术2401，排课班级来自专业班级）──
  - role: student
    goto: /portal/workspace
    click: 我的课表
    expectText: "{{courseName}}"
    timeoutMs: 20000
  # ── 收尾：取消发布+删除方案/课程；删审批流（计划/排课/课表残留容忍）──
  - role: school
    goto: /affairs/programs
    clickRow: { text: "{{programName}}", action: 取消发布 }
    optional: true
  - role: school
    clickRow: { text: "{{programName}}", action: 删除 }
    confirm: true
    optional: true
  - role: teacher
    goto: /lesson/admin/system
    clickRow: { text: "{{courseName}}", action: 取消发布 }
    optional: true
  - role: teacher
    clickRow: { text: "{{courseName}}", action: 删除 }
    confirm: true
    optional: true
  - role: school
    goto: /lesson/admin/workflows
    clickRow: { text: "{{wfName}}", action: 删除 }
    confirm: true
    optional: true
```
