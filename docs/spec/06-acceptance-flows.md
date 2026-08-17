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
    # ── 断言与上下文（可选）──
    expectApi: { method: POST, url: /path/片段, status: 201 }   # 断言本步执行期间出现匹配的接口响应
    expectText: 文字                             # 断言页面可见该文字（支持 {{var}}）
    saveAs: { 变量名: 字段label }                 # 把本步 fill 的值存入流程上下文
    optional: true                               # 失败记 warn 不判失败（用于幂等前置步骤）
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

> AI 智能服务中心的对话链路（SSE 流式问答、私有库泄露防线 ST-1）涉及真实 LLM 调用，按 DSL 约束不进本文件，由后端集成测试覆盖（`backend/internal/handler/ai_center_flow_test.go`：TestAICenter_AgentChatStream 含泄露防线断言、TestAICenter_KBAsk 含溯源断言）。

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
  - role: partner
    goto: /partner/employment-jobs/new
    fill: { 岗位名称: "SMOKE_装配工程师{rand}", 工作地点: 苏州, 招聘人数: "5" }
    select: { 合作学校: first, 岗位类型: 全职, 所属就业项目: "{{projectName}}" }
    saveAs: { jobName: 岗位名称 }
    submit: true
    expectApi: { method: POST, url: /partner/employment-jobs, status: 201 }
  - role: partner
    goto: /partner/employment-jobs
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
    fill: { 名称: "SMOKE_AI助手{rand}", 角色提示词: "你是 SMOKE 测试助手" }
    saveAs: { agentName: 名称 }
    submit: 创建智能体
    expectApi: { method: POST, url: /ai/agents, status: 201 }
    # 创建成功自动进入编辑器：断言编辑器渲染（动态路由参数回归护栏）
    expectText: 角色提示词
    timeoutMs: 20000
  - role: teacher
    goto: /portal/apps/ai/studio
    clickCard: { text: "{{agentName}}", action: 提交审核 }
    expectApi: { method: POST, url: /ai/agents/, status: 200 }
  - role: school
    goto: /portal/apps/ai/admin/reviews
    click: 智能体审核
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

### 3.4 第三方挂接管理闭环（ai-integration-loop）

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
