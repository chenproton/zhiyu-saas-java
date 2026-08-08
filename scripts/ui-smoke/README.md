# 知育前端全站点击巡检工具（UI Smoke Test）

自动登录并遍历系统每个页面（含弹窗/下拉/Tab），监控前端 console、JS 异常与后端接口报错，用于发现"点哪儿坏了"这类回归问题（重点场景：代码重构后检查每个页面是否报错）。不校验业务正确性，只报错。

## 安装（一次性）

```bash
cd scripts/ui-smoke
npm install
# 系统需安装 Google Chrome（脚本默认 channel: 'chrome'）
```

## 使用

```bash
# 全量巡检（三角色 × 全部页面，每页点完所有唯一可点元素）
node scripts/ui-smoke/ui-smoke.mjs

# 单角色快速巡检
node scripts/ui-smoke/ui-smoke.mjs --roles teacher

# 重构后定向巡检：只跑 git 改动涉及的路由（几分钟出结果）
node scripts/ui-smoke/ui-smoke.mjs --git-diff

# 与上次报告做回归对比（新增/已修复/持续错误）
node scripts/ui-smoke/ui-smoke.mjs --baseline /tmp/zhiyu-ui-smoke/report.json

# 只巡检指定路由（调试）
node scripts/ui-smoke/ui-smoke.mjs --route /portal/apps/system
```

## 常用选项

| 选项 | 默认 | 说明 |
|---|---|---|
| `--base-url` | `http://127.0.0.1` | 目标站点，**必须走 nginx 网关**；直连 3020 时容器内 Next rewrite 会失败 |
| `--roles` | `school,teacher,student` | 逗号分隔角色列表 |
| `--account` | - | 覆盖角色账号，如 `--account school:school:newpass` |
| `--max-clicks` | `100` | 每页点击次数安全阀（默认点完所有唯一可点元素） |
| `--workers` | `3` | 并发巡检路数 |
| `--config` | `smoke.config.json` | 配置文件（危险词/账号/排除清单等） |
| `--exclude` | - | 按路由子串排除，逗号分隔 |
| `--route` | - | 只巡检一个路由（单页调试） |
| `--git-diff [ref]` | `HEAD` | 只巡检 git 改动涉及的路由（含组件依赖反查） |
| `--baseline` | - | 与上次报告做回归 diff（新增/已修复/持续三分类） |
| `--resume` | - | 跳过上次报告中已 ok/skip 的路由（断点续跑） |
| `--timeout-min` | 不限 | 全局看门狗超时（分钟），超时强制结束并保留结果 |
| `--tail-backend` | 关 | 用 docker compose 抓取后端日志 error/panic 增量 |
| `--fail-on-error` | 关 | 发现错误退出码 1（供 CI） |
| `--click-dangerous` | 关 | 允许点击写数据按钮（默认跳过防污染） |
| `--headed` / `--verbose` | 关 | 显示窗口 / 连 warning 与噪音一并输出 |

## 覆盖范围

- **静态路由**：自动枚举 `apps/edu/app` 下全部页面（跳过分组段）
- **动态路由**：从后端 API 拉真实实体 id，直接访问 `[id]` 详情页（如岗位/场景/试卷/联盟品牌等详情与编辑页）
- **每页交互**：点完所有唯一可点元素（按钮/链接/Tab，含表格每行按钮逐个点），弹窗/下拉打开后 Esc 关闭，跳转后回访继续，点击产生的新元素（Tab 切换等）增量补充
- **无权限页**：自动识别（遮罩/全 401/403）记为 `skip`，不算错误
- **安全性**：中英文危险词表（保存/删除/禁用/创建/完成/返回等）默认跳过，语言切换按钮不点（防止危险词失效）；locale 被切英文时自动切回

## 报告说明

- 控制台输出：出错页面清单 + **错误聚合**（按类型/接口去重聚类）+ **回归 diff**（与基线对比的新增/已修复/持续错误）
- JSON 报告 `/tmp/zhiyu-ui-smoke/report.json`：
  - `results[role].routes[]`：每页的 route/status(ok|skip|error)/clicks/actions(点击序列)/errors[]
  - `errors[].type`：`pageerror`(JS 异常) / `console`(console.error) / `api`(≥400 接口) / `network`(请求失败) / `page`(巡检本身失败)
  - `errors[]` 附带 `clickIndex`（第几次点击触发）与 `url`（触发时页面地址），便于复现
  - `aggregate`：去重后的错误聚类（含出现次数与涉及页面）
  - `diff`：与基线的回归对比结果
- 已知噪音：种子数据 `example.com` 占位图片（`--verbose` 可看到）

## 注意事项

- 测试账号 `school/school123`、`teacher/teacher123`、`student/student123` 需存在于目标环境（`--account` 可覆盖）
- 默认跳过写数据按钮，弹窗只开不确认，不污染数据；`--click-dangerous` 慎用
- 巡检会在页面内点击，可能产生浏览记录等无害副作用
- 大内存压力下渲染进程可能崩溃，工具会自动换页重试（最多 2 次），报告记录崩溃页面
