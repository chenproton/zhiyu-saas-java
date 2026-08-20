# 自动化测试使用指南

> 本文档的核心是 **UI 冒烟测试工具**（`scripts/ui-smoke`）：自动登录并遍历每个页面（全量页面访问冒烟），点击所有按钮/弹窗/下拉/Tab，测试 CRUD，监控前端异常与接口错误。
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
| `--fail-on-error` | 发现错误退出码 1（供 CI） |
| `--timeout-min <n>` | 全局看门狗超时（分钟） |
| `--no-cleanup` | 测试后不清理 `SMOKE_` 数据（默认自动清理） |
| `--max-form-submits <n>` | 每页表单提交次数上限（默认 3） |
| `--headed` / `--verbose` | 显示浏览器窗口 / 输出全部日志 |

### 1.4 覆盖范围与安全护栏

**覆盖**：`school/teacher/student` 走 portal 登录（`/portal/login`）；`partner`（企业端）走独立门户（`/partner/login`）。静态路由自动枚举 `frontend/portal-vue/src/router/index.ts` 下全部路由（跳过纯 redirect 项）；动态详情/编辑页从后端 API 拉真实 id 直接访问。无权限页（遮罩/全 401/403）自动记 `skip` 不算错误。

**安全护栏**（默认开启，保护真实数据）：
- 只操作 `SMOKE_` 前缀测试数据；`/superadmin` 与角色管理页默认不触发 CRUD；
- 语言切换按钮不点（防止危险词失效）；
- 下拉菜单里的编辑/删除/启用/禁用一律跳过（无法判定来源数据行），避免误操作真实数据。

### 1.5 结果与报告

- 控制台输出：出错页面清单 + CRUD 统计 + 错误聚合（按类型/接口去重）+ 回归 diff。
- JSON 报告 `/tmp/zhiyu-ui-smoke/report.json`：
  - `results[role].routes[]`：每页 `route` / `status`(ok\|skip\|error) / `errors[]` / `crudActions[]`；
  - `errors[].type`：`pageerror`(JS 异常) / `console` / `api`(≥400) / `network` / `page` / `form` / `crud` / `timeout`；
  - `aggregate`：去重错误聚类（含次数与涉及页面）；`diff`：与基线对比。
- 已知噪音：种子数据 `example.com` 占位图、静态资源 404、429 限流、401/403 无权限页。

---

## 三、快速门禁（后端/前端单测 + 静态检查 + spec）

> 本地秒级反馈的「能不能编译、单点逻辑对不对、有没有破坏架构红线」，提交前必跑。集成测试需要独立测试库。

### 3.1 环境准备（一次性）

| 依赖 | 说明 |
|---|---|
| 后端工具链 | JDK 21 / Maven（`backend/java`，`./mvnw compile -q` 编译门禁） |
| 前端工具链 | Node 20+ / pnpm，`frontend/portal-vue` 与 `frontend/plus-ui` 各自 `pnpm install` + `pnpm build` |
| UI 冒烟依赖 | `cd scripts/ui-smoke && npm install` + 系统 Google Chrome |
| 测试账号 | `school/school123`、`teacher/teacher123`、`student/student123`、`partner(smokepartner/smoke123)` |

### 3.2 后端测试

```bash
cd backend/java && ./mvnw compile -q    # 编译门禁（JDK 21）
./mvnw test -q                          # 单测（controller/service/mapper 层，JUnit 5 + Mockito）
```

- 单测位于 `backend/java/*/src/test/java/`；分层要求与红线见根 `AGENTS.md` 第二部分（新接口至少 controller/service/mapper 测试一种）。
- 集成测试需要独立测试库的场景（写库型测试）：**绝不指向生产库**（误连不可逆），未配置时跳过。

### 3.3 前端测试

```bash
cd frontend/portal-vue && pnpm build     # 业务门户构建（含 vue-tsc 类型检查）
cd frontend/plus-ui && pnpm build        # 管理端构建
```

- 前端门禁以构建 + 类型检查（`vue-tsc`）为主；纯逻辑工具函数可配单测（页面级验证交给 UI 冒烟）。

### 3.4 spec 门禁

```bash
./scripts/spec-check.sh
```

14 项校验（controller 无裸 SQL/DB 句柄/MyBatis 注解、service 无拼 SQL、mapper 不读请求/租户上下文、LLM 直连红线、migration up/down 配对、spec 五层制品、ADR 索引、安全红线、schema↔migration 双向一致等，详见 `spec-standards.md` §九）。阻断级违规必须提交前修掉；提示级（路由契约覆盖/验收流程一致性/新端点租户校验/LLM 直连/down 不可逆标注）需人工确认。

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

> 新页面（静态路由）会自动被巡检器枚举（扫描 `frontend/portal-vue/src/router/index.ts`），无需手工登记；带 `[id]` 的动态详情/编辑页需在 `dynamicRoutes` 配置真实 id 来源。

### 4.2 扩展巡检器本身（进阶，可选）

只有当需要**新的 DSL 动作类型**（如「拖拽」「上传文件」）或新的点击语义时才改工具源码，普通页面/流程书写**不需要**：

| 文件 | 职责 |
|---|---|
| `scripts/ui-smoke/clicker.mjs` | 页面元素枚举 / 点击队列 / CRUD 动作识别 |
| `scripts/ui-smoke/forms.mjs` | 表单填充 / 提交 |
| `scripts/ui-smoke/routes.mjs` | 静态路由枚举 + 动态路由解析 |
| `scripts/ui-smoke/config.mjs` | 配置默认值 + CLI 参数解析（新 `--xxx` 参数在此注册） |
| `scripts/ui-smoke/report.mjs` | 报告生成 |

> 新增点击语义（如拖拽/上传）时改 `clicker.mjs`/`forms.mjs`；改工具属代码改动，按 AGENTS.md 走提交门禁。

---

## 五、红线与注意事项

1. **测试库隔离（最高优先级）**：后端集成测试（写库型）必须指向独立测试库，**绝不指向生产库**（测试会对库执行 migration 与 DELETE 种子数据，误连不可逆）；未配置时跳过。
2. **UI 冒烟只操作 `SMOKE_` 数据**：CRUD 的创建/编辑/删除/启停只作用于带 `SMOKE_` 前缀的行；`/superadmin` 与角色管理页默认不触发 CRUD。
3. **`--base-url` 必须走 nginx 网关**：直连容器内前端端口时 rewrite 会失败。
4. **报告噪音已知项**：种子数据 `example.com` 占位图、静态资源 404、429 限流、401/403 无权限页（记 `info`/`skip` 不算错误）。

---

## 六、相关文档

- UI 冒烟工具完整用法：`scripts/ui-smoke/README.md`
- 后端分层红线（测试归属）：根 `AGENTS.md` 第二部分（controller/service/mapper）
- spec 工作流 / DoD：`docs/spec-standards.md`
- 前端组件复用：`AGENTS.md` 第二部分 + `frontend/portal-vue`/`frontend/plus-ui` 源码
