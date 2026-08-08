# 知育前端全站点击巡检工具（UI Smoke Test）

自动登录并遍历系统每个页面（包括弹窗/下拉/Tab），监控前端 console、JS 异常与后端接口报错，用于发现"点哪儿坏了"这类回归问题。不校验业务正确性，只报错。

## 安装（一次性）

```bash
cd scripts/ui-smoke
pnpm install
# 系统已装 Google Chrome 可直接用（脚本默认 channel: 'chrome'）；
# 新机器需先安装 Chrome，或允许脚本下载 Playwright 自带浏览器：
#   npx playwright install chromium --with-deps
```

## 使用

```bash
# 默认：本机 nginx 网关(http://127.0.0.1)、三个角色全量巡检、每页点击全部唯一可点元素（含弹窗/下拉/Tab 切换后新出现的元素）、3 路并发
node scripts/ui-smoke/ui-smoke.mjs

# 指定站点 / 角色 / 点击量
node scripts/ui-smoke/ui-smoke.mjs --base-url http://127.0.0.1 --roles teacher

# 同时抓取后端容器日志增量（error/panic 行）
node scripts/ui-smoke/ui-smoke.mjs --tail-backend

# 只巡检指定路由（调试用）
node scripts/ui-smoke/ui-smoke.mjs --route /portal/apps/system

# 允许点击会写数据的按钮（保存/提交/删除等，默认跳过防污染）
node scripts/ui-smoke/ui-smoke.mjs --click-dangerous
```

## 常用选项

| 选项 | 默认 | 说明 |
|---|---|---|
| `--base-url` | `http://127.0.0.1` | 目标站点，**必须走 nginx 网关**；直连 3020 时容器内 Next rewrite 到 127.0.0.1:8080 会失败 |
| `--roles` | `school,teacher,student` | 逗号分隔角色列表（登录页标注的测试账号） |
| `--max-clicks` | `100` | 每页点击次数安全阀（默认每页点完所有唯一可点元素，一般触达不到） |
| `--workers` | `3` | 并发巡检路数 |
| `--exclude` | - | 按路由子串排除，逗号分隔 |
| `--route` | - | 只巡检一个路由 |
| `--tail-backend` | 关 | 运行期间用 `docker compose logs --since` 增量抓取后端 error/panic |
| `--fail-on-error` | 关 | 发现错误退出码 1（供 CI） |
| `--headed` | 关 | 显示浏览器窗口 |
| `--verbose` | 关 | 连 warning 与已知噪音（example.com 占位图）一起输出 |
| `--report` | `/tmp/zhiyu-ui-smoke/report.json` | 报告 JSON 输出路径 |

## 报告说明

- 控制台输出：每个出错页面的错误清单（类型 + 摘要）
- JSON 报告：按角色/路由分组，字段含 `route / status(ok|skip|error) / clicks / errors[]`，`errors[].type` 取值：
  - `pageerror` — 前端 JS 异常（React 崩溃）
  - `console` — 前端 `console.error`
  - `api` — 后端接口 ≥400 响应（**服务端错误的直接信号**）
  - `network` — 请求失败
  - `page` — 页面巡检本身失败（如加载超时）
- `status: skip` 表示该页无权限/未登录被重定向，属预期
- 已知噪音：种子数据中 `example.com` 占位图片被浏览器拦截（`--verbose` 可看到）

## 注意事项

- 默认跳过会**修改数据**的按钮（保存/提交/删除/发布/确认等），防止污染数据；弹窗点开后按 Esc 关闭，不确认任何操作
- 巡检账号为 `school/school123`、`teacher/teacher123`、`student/student123`（portal 平台），需存在于目标环境
- 动态路由（`[id]`）不直接枚举，靠点击页面内链接/表格行自然进入
