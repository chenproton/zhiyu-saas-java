# 知育前端全站点击巡检工具（UI Smoke Test）

自动登录并遍历系统每个页面（含弹窗/下拉/Tab），**默认测试 CRUD 按钮功能**（创建/编辑/删除/启用/禁用），同时监控前端 console、JS 异常与后端接口报错，用于发现"点哪儿坏了"这类回归问题。加 `--click-only` 可退回到旧行为：只点击页面元素，不填表单、不触发写数据按钮。不校验业务正确性，只报错。

## 安装（一次性）

```bash
cd scripts/ui-smoke
npm install
# 系统需安装 Google Chrome（脚本默认 channel: 'chrome'）
```

## 使用

```bash
# 全量 CRUD 巡检（默认 school 角色，大表页行内按钮只点首行，约 15-25 分钟）
node scripts/ui-smoke/ui-smoke.mjs

# 全角色巡检（school/teacher/student/partner，约 1 小时）
node scripts/ui-smoke/ui-smoke.mjs --all-roles

# 指定角色
node scripts/ui-smoke/ui-smoke.mjs --roles teacher
node scripts/ui-smoke/ui-smoke.mjs --roles school,teacher,student

# 重构后定向巡检：只跑 git 改动涉及的路由（几分钟出结果）
node scripts/ui-smoke/ui-smoke.mjs --git-diff

# 与上次报告做回归对比（新增/已修复/持续错误）
node scripts/ui-smoke/ui-smoke.mjs --baseline /tmp/zhiyu-ui-smoke/report.json

# 只跑验收流程（spec 06 驱动的跨角色业务链路，几分钟出结果）
node scripts/ui-smoke/ui-smoke.mjs --flows

# 全量巡检但跳过验收流程（默认先跑流程再逐页巡检）
node scripts/ui-smoke/ui-smoke.mjs --all-roles --no-flows

# 只巡检指定路由（调试）
node scripts/ui-smoke/ui-smoke.mjs --route /portal/apps/system

# 只点击页面，不测试 CRUD 按钮/表单（旧默认行为）
node scripts/ui-smoke/ui-smoke.mjs --click-only

# 只跑 git 改动涉及的路由 + 点击模式
node scripts/ui-smoke/ui-smoke.mjs --git-diff --click-only
```

## 常用选项

| 选项 | 默认 | 说明 |
|---|---|---|
| `--base-url` | `http://127.0.0.1` | 目标站点，**必须走 nginx 网关**；直连 3020 时容器内 Next rewrite 会失败 |
| `--roles` | `school` | 逗号分隔角色列表（默认只跑 school 提速；全量用 `--all-roles`） |
| `--all-roles` | - | 跑全部角色 school,teacher,student,partner |
| `--account` | - | 覆盖角色账号，如 `--account school:school:newpass` |
| `--max-clicks` | `100` | 每页点击次数安全阀（默认点完所有唯一可点元素） |
| `--workers` | `1` | 并发巡检路数（CRUD 模式会强制降为 1） |
| `--config` | `smoke.config.json` | 配置文件（危险词/账号/排除清单等） |
| `--exclude` | - | 按路由子串排除，逗号分隔 |
| `--route` | - | 只巡检一个路由（单页调试） |
| `--git-diff [ref]` | `HEAD` | 只巡检 git 改动涉及的路由（含组件依赖反查） |
| `--baseline` | - | 与上次报告做回归 diff（新增/已修复/持续三分类） |
| `--resume` | - | 跳过上次报告中已 ok/skip 的路由（按 角色:路由 记录，断点续跑） |
| `--timeout-min` | 不限 | 全局看门狗超时（分钟），超时强制结束并保留结果 |
| `--tail-backend` | 关 | 用 docker compose 抓取后端日志 error/panic 增量 |
| `--fail-on-error` | 关 | 发现错误退出码 1（供 CI） |
| `--click-only` | 关 | 只点击页面元素，不测试 CRUD 按钮/表单（旧默认行为） |
| `--flows` | 关 | 只跑验收流程（`docs/spec/06-acceptance-flows.md` 的 ```flow 块，跨角色业务链路） |
| `--no-flows` | 关 | 全量巡检时跳过验收流程（默认先跑流程；`--click-only`/`--route`/`--git-diff` 模式自动跳过） |
| `--flows-spec` | spec 06 | 验收流程 spec 文件路径 |
| `--click-dangerous` | 关 | 允许点击写数据按钮（CRUD 模式下只操作 `SMOKE_` 测试数据） |
| `--test-forms` | 默认开启 | 已合并到默认 CRUD 行为，保留仅作兼容 |
| `--no-cleanup` | 关 | CRUD 测试后不清理 `SMOKE_` 前缀数据 |
| `--max-form-submits <n>` | `3` | 每页表单提交次数上限 |
| `--headed` / `--verbose` | 关 | 显示窗口 / 连 warning 与噪音一并输出 |

## 覆盖范围

- **角色**：`school`/`teacher`/`student` 走 portal 登录页（`/portal/login`）；`partner`（企业端）为独立认证门户（`/partner/login`），巡检 `/partner` 下全部页面（workspace/enterprise/experts/members/schools/cooperation/tasks/settings，可在 `smoke.config.json` 用 `partnerRoutes` 覆盖）
- **静态路由**：自动枚举 `apps/edu/app` 下全部页面（含 `(group)` 分组段，跳过动态段 `[id]`）
- **动态路由**：从后端 API 拉真实实体 id，直接访问 `[id]` 详情/编辑页（含岗位编辑页 `/job/positions/[id]/edit`、联盟成果/协议/项目编辑页 `/portal/apps/alliance/{achievements,agreements,projects}/[id]/edit`、企业专家 `/partner/experts/[id]([/edit])`、企业共建 `/partner/co-build/positions/scenes/[id]/edit([/tasks])` 等；portal/partner 各自用本域 token 解析）
- **每页交互**：点完所有唯一可点元素（按钮/链接/Tab，含弹窗内按钮），**下拉菜单项（Radix `[role="menu"]`/`menuitem`）在菜单打开期间立即点击**（菜单项随菜单关闭即卸载，无法走队列延迟点击；重开触发器以点完多个项）；**列表行内按钮去重**：同一按钮类型只点前 `maxRowClicks` 行（默认 1 行，大表页从 5000+ 元素降到几十，SMOKE_ 测试数据行豁免以保 CRUD 覆盖）；弹窗/下拉打开后 Esc 关闭，跳转后回访继续，点击产生的新元素（Tab 切换等）增量补充
- **CRUD 测试**（默认）：识别"创建/新增/编辑/删除/启用/禁用"类按钮，创建数据时使用 `SMOKE_` 前缀，编辑/删除/启用/禁用只操作带 `SMOKE_` 标记的测试数据行，最后自动清理；**独立编辑页表单测试仅对巡检创建的 `SMOKE_` 实体执行**（真实实体编辑页只点击不提交，防止改名/覆盖真实数据）
- **无权限页**：自动识别（遮罩/全 401/403）记为 `skip`，不算错误
- **安全性**：默认只操作 `SMOKE_` 前缀测试数据；**下拉菜单项因 portal 化无法判定来源数据行，其中的编辑/删除/启用/禁用一律跳过**（导航/表单入口/普通项可点），避免误操作真实数据；`/superadmin` 与 `/portal/apps/system/org-user/roles` 默认不触发 CRUD 操作，避免改乱权限；语言切换按钮不点（防止危险词失效）；locale 被切英文时自动切回；**「重新生成/AI 生成」类按钮默认跳过**（会真实调用 LLM 按 token 计费，全量巡检不触发）

## 验收流程（flows）

业务流程以机器可读 YAML 写在 [`docs/spec/06-acceptance-flows.md`](../../docs/spec/06-acceptance-flows.md)（DSL 规范见该文件 §1）：每条流程是一串跨角色步骤（goto/click/clickRow/fill/select/submit/confirm/expectApi/expectText），巡检器按序执行并断言接口响应与页面文字。逐页巡检发现「点哪儿坏了」，验收流程发现「业务链路断了」，两者互补。流程产生的数据同样以 `SMOKE_` 前缀创建并参与统一清理；`optional` 步骤（幂等前置）中「未找到目标/按钮已禁用」记 `skip` 静默跳过，其余失败记 `warn` 不判失败。失败步骤自动截图到 `/tmp/zhiyu-ui-smoke/flow-*.png`。

## 报告说明

- 控制台输出：出错页面清单 + **CRUD 统计** + **错误聚合**（按类型/接口去重聚类）+ **回归 diff**（与基线对比的新增/已修复/持续错误）
- JSON 报告 `/tmp/zhiyu-ui-smoke/report.json`：
  - `results[role].routes[]`：每页的 route/status(ok\|skip\|error)/clicks/actions(点击序列，含 `actionType`)/errors[]/info[]/forms[]/crudActions[]/createdIds[]
  - `crudActions[].action`：`create` / `edit` / `delete` / `enable` / `disable`
  - `errors[].type`：`pageerror`(JS 异常) / `console`(console.error) / `api`(≥400 接口) / `network`(请求失败) / `page`(巡检本身失败) / `form`(表单提交失败) / `crud`(CRUD 操作失败) / `timeout`(单路由超时)
  - `info[].type`：`auth`(401/403，预期权限页不计错误) / `rate-limit`(429 限流，不计错误)
  - `errors[]` 附带 `clickIndex`（第几次点击触发）与 `url`（触发时页面地址），便于复现
  - `aggregate`：去重后的错误聚类（含出现次数与涉及页面）
  - `diff`：与基线的回归对比结果
  - `cleanup`：CRUD 测试后清理的 SMOKE_ 数据条数
- 已知噪音：种子数据 `example.com` 占位图片、静态资源 404（`--verbose` 可看到）

## 配置示例（smoke.config.json）

```json
{
  "baseUrl": "http://127.0.0.1",
  "roles": ["school", "teacher", "student", "partner"],
  "expectedAuthPages": ["/superadmin"],
  "cleanupApis": [
    { "list": "/api/v1/tenants?limit=100", "del": "/api/v1/tenants/{id}", "fields": ["name"] }
  ],
  "routeOverrides": {
    "/scene/scenarios": { "maxFormSubmits": 1, "skipFormFields": ["封面"] }
  }
}
```

## 动作分类（actionType）

每个被点击的元素会标注动作类型，为后续扩展做准备：

- `nav`：站内链接、返回/查看/详情等导航按钮
- `overlay`：打开弹窗/下拉/Tab 切换等覆盖层按钮
- `form-trigger`：页面级创建/新增入口（点击后进入表单测试流程）
- `edit`：编辑按钮（CRUD 模式下只操作 `SMOKE_` 行）
- `delete`：删除按钮（CRUD 模式下只操作 `SMOKE_` 行）
- `enable`：启用/激活按钮（CRUD 模式下只操作 `SMOKE_` 行）
- `disable`：禁用/停用按钮（CRUD 模式下只操作 `SMOKE_` 行）
- `submit`：弹窗或页面内的保存/提交/创建/确定按钮
- `destructive`：删除/禁用/停用/冻结/锁定等危险操作（`--click-only` 模式下识别）
- `unknown`：无文本/无 aria-label 的图标按钮

## 注意事项

- 测试账号 `school/school123`、`teacher/teacher123`、`student/student123` 需存在于目标环境（`--account` 可覆盖）
- **登录验证码自动识别**：登录接口要求验证码（新设备/失败计数触发）时，巡检会自动从 Redis 读取答案并填写（`docker exec zhiyu-redis redis-cli GET zhiyu:captcha:answer:{id}`，需 Redis 容器可达）；portal/partner 登录使用固定设备标识 `smoke-device-*`，信任标记（30 天滑窗）在首次巡检写入后，后续运行不再触发新设备验证码
- `partner` 角色默认账号 `smokepartner/smoke123`：登录接口返回 401 时自动调用 `POST /api/v1/auth/partner/register` 注册巡检企业「巡检测试企业」并直接登录（无需预建账号）；若账号已存在但密码不符（注册冲突 409）会报错提示用 `--account partner:user:pass` 修正。巡检企业是空数据企业，页面多为空态属正常
- 默认进入 CRUD 测试模式：创建数据带 `SMOKE_` 前缀，编辑/删除/启用/禁用只操作带 `SMOKE_` 标记的行，结束后自动清理（`--no-cleanup` 可关闭）
- `/superadmin` 与 `/portal/apps/system/org-user/roles` 默认不触发 CRUD 操作，防止改乱权限影响后续测试
- `--click-only` 回退到旧行为：只点击页面，不填表单、不点危险按钮
- 巡检会在页面内点击，可能产生浏览记录等无害副作用
- 大内存压力下渲染进程可能崩溃，工具会自动换页重试（最多 2 次），报告记录崩溃页面
- 连续多页 401 时会自动重新登录一次
