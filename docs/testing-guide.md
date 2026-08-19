# 自动化测试使用指南

> 本文档的核心是 **UI 冒烟测试工具**（`scripts/ui-smoke`），重点讲两件事：
> 1. **全量点击测试**：自动登录并遍历每个页面，点击所有按钮/弹窗/下拉/Tab，测试 CRUD，监控前端异常与接口错误；
> 2. **自定义每个页面的测试流程**：用 ```flow 代码书写精确的页面操作序列（去哪个页面 → 点哪个按钮 → 填哪个字段 → 断言什么），巡检器按序驱动浏览器执行并断言。
>
> 后端/前端单测与静态检查作为「快速门禁」在第三章给出（本地秒级反馈，提交前必跑）。

---

## 一、UI 冒烟测试：全量点击测试

### 1.1 工具能做什么

`scripts/ui-smoke/ui-smoke.mjs` 用 Playwright（系统 Chrome）自动完成「逐页广度巡检」：

- 自动登录每个角色，遍历该角色下**全部页面**（静态路由自动枚举 + 动态路由从后端拉真实 id）；
- 每页点完所有唯一可点元素（按钮/链接/Tab/弹窗内按钮/下拉菜单项）；
- 默认进入 **CRUD 测试**：识别「创建/新增/编辑/删除/启用/禁用」类按钮，创建数据用 `SMOKE_` 前缀，只编辑/删除/启停带 `SMOKE_` 标记的测试数据行，结束后自动清理；
- 同时监控 **前端 console / JS 异常 / 后端接口报错**，发现「点哪儿坏了」这类回归。

它与 flow 的关系：逐页巡检发现「**点哪儿坏了**」；flow 发现「**业务链路断了**」。两者互补。

### 1.2 快速上手

```bash
# 全量 CRUD 巡检（默认 school 角色，约 15-25 分钟）
node scripts/ui-smoke/ui-smoke.mjs

# 全角色（school/teacher/student/partner，约 1 小时）
node scripts/ui-smoke/ui-smoke.mjs --all-roles

# 只巡检单个路由（调试）
node scripts/ui-smoke/ui-smoke.mjs --route /portal/apps/system

# 重构后定向回归：只跑 git 改动涉及的路由（含组件依赖反查）
node scripts/ui-smoke/ui-smoke.mjs --git-diff

# 只跑自定义流程（第二章 flow）
node scripts/ui-smoke/ui-smoke.mjs --flows

# 指定目标环境 / 覆盖账号
node scripts/ui-smoke/ui-smoke.mjs --base-url http://103.236.64.243:2026 --account school:proton:admin123
```

### 1.3 常用选项

| 选项 | 说明 |
|---|---|
| `--base-url` | 目标站点，**必须走 nginx 网关**（默认 `http://127.0.0.1`） |
| `--roles` / `--all-roles` | 角色列表 / 全部角色（默认只跑 school 提速） |
| `--account r:u:p` | 覆盖某角色账号，如 `--account school:proton:admin123` |
| `--route /path` | 只巡检一个路由 |
| `--git-diff [ref]` | 只巡检 git 改动涉及的路由（默认对比 HEAD） |
| `--baseline <json>` | 与上次报告做回归 diff（新增/已修复/持续三类） |
| `--resume <json>` | 断点续跑（跳过上次已 ok/skip 的路由） |
| `--click-only` | 只点击页面元素，不填表单、不测 CRUD（旧默认行为） |
| `--flows` / `--no-flows` | 只跑流程 / 全量时跳过流程 |
| `--flows-spec <path>` | 流程 spec 文件路径，**可指向任意含 flow 块的 markdown 文件**（默认 `docs/spec/06-acceptance-flows.md`） |
| `--fail-on-error` | 发现错误退出码 1（供 CI） |
| `--timeout-min <n>` | 全局看门狗超时（分钟） |
| `--no-cleanup` | 测试后不清理 `SMOKE_` 数据（默认自动清理） |
| `--max-form-submits <n>` | 每页表单提交次数上限（默认 3） |
| `--headed` / `--verbose` | 显示浏览器窗口 / 输出全部日志 |

### 1.4 覆盖范围与安全护栏

**覆盖**：`school/teacher/student` 走 portal 登录（`/portal/login`）；`partner`（企业端）走独立门户（`/partner/login`）。静态路由自动枚举 `frontend/edu/app` 下全部页面（含 `(group)` 分组段，跳过 `[id]` 动态段）；动态详情/编辑页从后端 API 拉真实 id 直接访问。无权限页（遮罩/全 401/403）自动记 `skip` 不算错误。

**安全护栏**（默认开启，保护真实数据）：
- 只操作 `SMOKE_` 前缀测试数据；`/superadmin` 与角色管理页默认不触发 CRUD；
- 语言切换按钮不点（防止危险词失效）；「重新生成/AI 生成」类按钮默认跳过（避免真实 LLM 调用计费）；
- 下拉菜单里的编辑/删除/启用/禁用一律跳过（无法判定来源数据行），避免误操作真实数据。

### 1.5 结果与报告

- 控制台输出：出错页面清单 + CRUD 统计 + 错误聚合（按类型/接口去重）+ 回归 diff。
- JSON 报告 `/tmp/zhiyu-ui-smoke/report.json`：
  - `results[role].routes[]`：每页 `route` / `status`(ok\|skip\|error) / `errors[]` / `crudActions[]`；
  - `errors[].type`：`pageerror`(JS 异常) / `console` / `api`(≥400) / `network` / `page` / `form` / `crud` / `timeout`；
  - `aggregate`：去重错误聚类（含次数与涉及页面）；`diff`：与基线对比。
- 已知噪音：种子数据 `example.com` 占位图、静态资源 404、429 限流、401/403 无权限页。

---

## 二、UI 冒烟测试：自定义每个页面的测试流程（flow 代码书写）

> 这是本文档**最重要**的部分：用 ```flow 代码精确描述「每个页面的具体操作流程」，巡检器按序驱动浏览器逐步执行并断言。

### 2.1 flow 是什么 + 最小示例

每条流程是一个 ```flow 代码块，内容为 YAML。最小示例——只操作一个页面：

````markdown
```flow
flow: my-page-check            # 流程 id（全文件唯一，kebab-case）
desc: 只巡检「课程管理」页的操作流程
steps:
  - role: school               # 执行本步的登录角色
    goto: /portal/apps/lesson/admin
    expectText: 课程管理
  - role: school
    click: 新建课程
    fill: { 课程名称: "SMOKE_调试{rand}" }
    select: { 课程类型: first }
    submit: true
    expectApi: { method: POST, url: /lesson, status: 201 }
```
````

```bash
# 写进独立文件跑（临时/调试，不污染正式 spec）
node scripts/ui-smoke/ui-smoke.mjs --flows-spec /tmp/my-page-flow.md
```

**要点**：`role` 每个步骤独立声明，**全程同一个角色、只操作一个页面完全可行**；不强制跨角色。

### 2.2 DSL 规范（动作详解）

流程结构：`flow` / `story`（PRD 用户故事编号，可选）/ `desc` / `steps`（步骤数组）。每个步骤由一个 `role` + 若干动作键组成，**动作按书写顺序执行**。

| 动作 | 写法 | 含义 |
|---|---|---|
| 跳转 | `goto: /路由` | 跳转页面（带查询串/锚点可写全） |
| 精确点击 | `click: 按钮文字` | 点击精确匹配文字的按钮/链接 |
| 模糊点击 | `clickText: 文字` | 点击包含该文字的可点击元素（卡片/链接/行标题） |
| 表格行操作 | `clickRow: { text: 行内文字, action: 按钮文字 }` | 先按文字定位表格行，再点行内按钮 |
| 卡片操作 | `clickCard: { text: 卡内文字, action: 按钮文字 }` | 先按文字定位卡片（需带 `data-smoke-card`），再点卡内按钮 |
| 填表 | `fill: { 字段label: 值 }` | 按 label 填文本/数字/日期字段 |
| 下拉选择 | `select: { 字段label: 选项文字或first }` | 下拉/Combobox 选择；`first` = 第一个选项 |
| 提交 | `submit: 按钮文字或true` | 点击提交按钮；`true` = 自动识别「保存/创建/确认」等提交词 |
| 确认 | `confirm: true` | 点击弹窗中的确认类按钮（确认/删除/发布/下架） |
| 开关 | `toggle: { label: true或false }` | Radix Switch 按 label 定位邻近 `[role=switch]`，确保目标状态（已满足则不动，幂等）；用于「前台展示」类开关 |
| 复选 | `check: { label: true或false }` | Radix Checkbox 按 label 定位邻近 `[role=checkbox]`，确保目标勾选状态（已满足则不动，幂等）；用于组织树选择器等「名字是 span、勾选在 Checkbox」的布局 |
| 接口断言 | `expectApi: { method: POST, url: /路径片段, status: 201 }` | 断言本步执行期间出现匹配的接口响应 |
| 文字断言 | `expectText: 文字` | 断言页面可见该文字（支持 `{{var}}`） |
| 存变量 | `saveAs: { 变量名: 字段label }` | 把本步 `fill` 的值存入流程上下文 |
| 幂等前置 | `optional: true` | 目标未找到/按钮已禁用记 `skip` 静默跳过；其余失败记 `warn` 不判失败 |
| 看门狗 | `timeoutMs: 10000` | 单步超时（默认 15000，超时判失败） |
| 豁免哨兵 | `skipPageErrorCheck: true` | 豁免本步 pageerror 哨兵（见 §2.4） |

### 2.3 模板变量与上下文

- `{rand}`：每流程运行一次的随机串（6 位），保证 `SMOKE_` 数据名唯一；
- `{{varName}}`：引用 `saveAs` 存入的上下文变量；
- 跨步骤/跨角色传递数据只靠这两者 + `SMOKE_` 名称搜索，不做接口级编排。

### 2.4 执行语义与硬性约束

- 步骤按数组顺序执行；`role` 切换时巡检器按需登录并复用该角色会话；
- 非 `optional` 步骤失败 = 流程失败（失败步骤自动截图 `/tmp/zhiyu-ui-smoke/flow-*.png`，并跳过后续步骤）；
- **pageerror 哨兵（默认开启）**：每步执行窗口内浏览器任何未捕获异常（渲染崩溃、`undefined` 拼接等）即判该步失败——兜「接口 200 但页面白屏」类事故；误伤时单步 `skipPageErrorCheck: true` 豁免；
- 所有创建数据必须 `SMOKE_` 前缀（走统一清理与安全护栏）；
- 不产生真实 LLM 调用；不点击语言切换/超管危险操作；不做业务数值正确性断言、不写条件分支/循环（保持线性、可读）。

### 2.5 完整示例一：单页面流程（含幂等清理）

```yaml
flow: course-list-check
desc: 课程列表页的创建 → 搜索 → 删除完整操作流程
steps:
  # 幂等前置：清理上次失败残留（optional，残留不阻断）
  - role: school
    goto: /portal/apps/lesson/admin
    clickRow: { text: "SMOKE_课程", action: 删除 }
    confirm: true
    optional: true
  # 创建
  - role: school
    click: 新建课程
    fill: { 课程名称: "SMOKE_课程{rand}", 课程简介: "冒烟测试数据" }
    select: { 课程类型: first }
    saveAs: { courseName: 课程名称 }
    submit: true
    expectApi: { method: POST, url: /lesson, status: 201 }
  # 搜索到刚创建的记录
  - role: school
    goto: /portal/apps/lesson/admin
    fill: { 搜索课程名称: "{{courseName}}" }
    click: 搜索
    expectText: "{{courseName}}"
  # 清理
  - role: school
    clickRow: { text: "{{courseName}}", action: 删除 }
    confirm: true
    expectApi: { method: DELETE, url: /lesson/, status: 200 }
```

### 2.6 完整示例二：跨角色业务链路（创建 → 发布 → 对端可见 → 下架）

```yaml
flow: xxx-publish-loop
story: XX-1
desc: 管理员创建并发布 → 学生可见 → 管理员下架并清理
steps:
  - role: school
    goto: /portal/apps/xxx/new
    fill: { 名称: "SMOKE_示例{rand}" }
    saveAs: { name: 名称 }
    submit: true
    expectApi: { method: POST, url: /xxx, status: 201 }
  - role: school
    goto: /portal/apps/xxx
    fill: { 搜索: "{{name}}" }
    clickRow: { text: "{{name}}", action: 发布 }
    expectApi: { method: PUT, url: /xxx/, status: 200 }
  - role: student
    goto: /portal/apps/xxx/square
    expectText: "{{name}}"
  - role: school
    goto: /portal/apps/xxx
    fill: { 搜索: "{{name}}" }
    clickRow: { text: "{{name}}", action: 下架 }
    optional: true
  - role: school
    clickRow: { text: "{{name}}", action: 删除 }
    confirm: true
    optional: true
```

> 更真实的跨角色闭环参考 `docs/spec/06-acceptance-flows.md`（就业供需大厅 / 知识库发布 / 智能体发布 / 第三方挂接 4 条现成流程）。

### 2.7 正式登记 vs 临时调试

| 场景 | 做法 | 运行方式 |
|---|---|---|
| **核心业务链路**（跨角色/跨页面，需长期维护 + 一致性检查） | 写进 `docs/spec/06-acceptance-flows.md`（§2 加清单行 + §3 加 flow 块） | `--flows`（跑全部）/ `--flows-spec docs/spec/06-acceptance-flows.md` |
| **临时/调试单页面流程** | 写独立 markdown 文件，不塞正式 spec | `--flows-spec /tmp/my-flow.md` |

临时文件里的 flow 同样走 `SMOKE_` 护栏与统一清理；若它确实是核心链路，再迁入正式 spec 登记。

---

## 三、快速门禁（后端/前端单测 + 静态检查 + spec）

> 本地秒级反馈的「能不能编译、单点逻辑对不对、有没有破坏架构红线」，提交前必跑。集成测试需要独立测试库。

### 3.1 环境准备（一次性）

| 依赖 | 说明 |
|---|---|
| 后端工具链 | `go vet/build/test`（Go 1.25+） |
| 前端工具链 | Node 20+ / pnpm 9，根目录 `pnpm install`（含 `frontend/edu` + `frontend/packages/*`） |
| **测试库** | 后端集成测试用 `TEST_DATABASE_URL` 指定独立测试库（**绝不指向生产库**，见 §五） |
| UI 冒烟依赖 | `cd scripts/ui-smoke && npm install` + 系统 Google Chrome |
| 测试账号 | `school/school123`、`teacher/teacher123`、`student/student123`、`partner(smokepartner/smoke123)` |

### 3.2 后端测试

```bash
cd backend/go && go vet ./... && go build ./... && go test ./... -count=1
```

- 集成测试经 `testhelper.SetupTestEnv` 自动向测试库跑 migration 并装配生产路由；**未设 `TEST_DATABASE_URL` 时自动 skip**（安全红线，避免误连生产库）：
  ```bash
  TEST_DATABASE_URL="postgres://user:pass@127.0.0.1:5432/zhiyu-saas-test?sslmode=disable" go test ./...
  ```
- 测试文件约定 `xxx_test.go`，分层要求与红线见 `docs/refactor-layering.md`（新接口至少 handler/service/store 一种测试）。

### 3.3 前端测试

```bash
pnpm typecheck && pnpm lint && pnpm test
```

- `typecheck` = `tsc --noEmit`；`lint` = `eslint .`；`test` = `vitest run`；
- vitest 默认**全量收集 `*.test.ts`**（新增测试自动纳入，无需改配置）；测试只跑纯逻辑（`lib/` 工具函数、组件纯逻辑），不渲染真实页面——页面级验证交给 UI 冒烟。

### 3.4 spec 门禁

```bash
./scripts/spec-check.sh
```

12 项硬约束（handler 无裸 SQL/持仓、service 无拼 SQL、store 不读请求、AI 走统一底座、migration up/down 配对、五层 spec 制品、ADR 索引、安全红线、schema↔migration 双向一致等）。阻断级违规必须提交前修掉；提示级（XSS/路由契约/spec 耦合）需人工确认。

---

## 四、配置与扩展

### 4.1 `smoke.config.json`

新功能如果会创建数据，务必在 `scripts/ui-smoke/smoke.config.json` 的 `cleanupApis` 加一条清理映射，否则逐页 CRUD 巡检产生的 `SMOKE_` 数据会残留：

```json
{
  "cleanupApis": [
    { "list": "/api/v1/xxx?limit=100", "del": "/api/v1/xxx/{id}", "fields": ["name"] }
  ]
}
```

其余可扩展配置（优先级：CLI > 配置文件 > 内置默认）：

| 配置项 | 作用 |
|---|---|
| `baseUrl` / `roles` / `accounts` | 目标站点 / 默认角色 / 账号（`--account` 可覆盖） |
| `routeOverrides` | 按路由前缀覆盖，如 `{ "/scene/scenarios": { "maxFormSubmits": 0, "skipFormFields": ["封面"] } }` |
| `excludeRoutes` | 排除路由子串（默认 `/partner`、`/superadmin`） |
| `expectedAuthPages` | 预期无权限页（记 skip 不算错） |
| `dynamicRoutes` | 动态路由（从后端 API 拉真实 id 访问 `[id]` 页） |
| `dangerousWords` / `dangerousWordsEn` | 会被跳过的写数据/危险按钮词表（中英） |
| `cleanupApis` | 巡检后清理 `SMOKE_` 数据的接口映射 |

> 新页面（静态路由）会自动被巡检器枚举（扫描 `frontend/edu/app`），无需手工登记；带 `[id]` 的动态详情/编辑页需在 `dynamicRoutes` 配置真实 id 来源。

### 4.2 扩展巡检器本身（进阶，可选）

只有当需要**新的 DSL 动作类型**（如「拖拽」「上传文件」）或新的点击语义时才改工具源码，普通页面/流程书写**不需要**：

| 文件 | 职责 |
|---|---|
| `scripts/ui-smoke/flows.mjs` | 解析 ```flow 块并逐步骤执行（新增动作在这里加 switch 分支） |
| `scripts/ui-smoke/clicker.mjs` | 页面元素枚举 / 点击队列 / CRUD 动作识别 |
| `scripts/ui-smoke/forms.mjs` | 表单填充 / 提交 |
| `scripts/ui-smoke/routes.mjs` | 静态路由枚举 + 动态路由解析 |
| `scripts/ui-smoke/config.mjs` | 配置默认值 + CLI 参数解析（新 `--xxx` 参数在此注册） |
| `scripts/ui-smoke/report.mjs` | 报告生成 |

> 新增 DSL 动作：在 `docs/spec/06-acceptance-flows.md` §1 补文档 → 在 `flows.mjs` 加执行分支 → 用真实链路验证。改工具属代码改动，按 AGENTS.md 走提交门禁。

---

## 五、红线与注意事项

1. **测试库隔离（最高优先级）**：`TEST_DATABASE_URL` 未设置时后端集成测试会 skip；**绝不指向生产库**（测试会对库执行 migration 与 DELETE 种子数据，误连不可逆）。
2. **UI 冒烟只操作 `SMOKE_` 数据**：CRUD 的创建/编辑/删除/启停只作用于带 `SMOKE_` 前缀的行；`/superadmin` 与角色管理页默认不触发 CRUD。
3. **不产生真实 LLM 调用**：UI 冒烟默认跳过「重新生成/AI 生成」类按钮（按 token 计费）；AI 对话链路不进 flow，由后端集成测试覆盖。
4. **`--base-url` 必须走 nginx 网关**：直连容器内前端端口时 rewrite 会失败。
5. **报告噪音已知项**：种子数据 `example.com` 占位图、静态资源 404、429 限流、401/403 无权限页（记 `info`/`skip` 不算错误）。
6. **新增正式 flow 后跑 `spec-check.sh`**：会做 flow↔PRD 用户故事的提示级一致性检查，避免 flow 漂移。

---

## 六、相关文档

- UI 冒烟工具完整用法：`scripts/ui-smoke/README.md`
- 验收流程 DSL 与清单：`docs/spec/06-acceptance-flows.md`
- 后端分层红线（测试归属）：`docs/refactor-layering.md`
- spec 工作流 / DoD：`docs/spec-standards.md`
- 前端组件复用：`docs/components.md`、`docs/forms-tables.md`
