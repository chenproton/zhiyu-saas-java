# Go+React → Java+Vue 迁移对齐核对总报告（2026-08-19）

> 核对方式：5 路并行逐文件核对（后端按域 3 路 + 前端 1 路 + 基础设施 1 路），判定标准为**功能等价**（路径风格差异不计）。每个条目在分报告中均有「文件:行号」双侧证据。
> 明细报告（同目录）：
> - [后端 job 域（129 端点）](./zhiyu-parity-backend-job.md)
> - [后端 lesson/scene/evaluation/library 四域（275 端点）](./zhiyu-parity-backend-lsee.md)
> - [后端核心域：affairs/partner/alliance/portal/AI/auth/系统/文件（480 端点）](./zhiyu-parity-backend-core.md)
> - [前端 React 191 路由 vs portal-vue](./zhiyu-parity-frontend.md)
> - [基础设施：schema/认证/定时任务/上传/监控](./zhiyu-parity-infra.md)

## 一、总体结论

**业务功能覆盖：两端已基本对齐。** Go 端全部 HTTP 接口在 Java 端均找到功能等价实现（整接口缺失 = 0）；React 全部 191 条路由在 Vue 侧均有对应页面（整页缺失 = 0）。Java 侧是刻意的 1:1 移植（控制器注释普遍写明"对齐 Go …，前端契约零改动"），并修复了个别 Go 端自身偏离前端契约的问题。

**差距集中在「横切设施」而非业务端点**：服务端授权模型（菜单 RBAC / 平台隔离 / 角色守卫）、限流、审计日志写入、定时任务——这 4 类是上线前必须补齐的；另有 1 个后端功能差异和 8 个前端页内功能差异。

## 二、统计汇总

### 后端（按域）

| 域 | Go 端点数 | ✅ 已对齐 | ⚠️ 部分对齐 | ❌ 缺失 | 明细 |
|---|---|---|---|---|---|
| job 招聘/岗位 | 129 | 128 | 1 | 0 | [报告](./zhiyu-parity-backend-job.md) |
| lesson/scene/evaluation/library/favorites（含 import/export 27） | 275 | 274 | 1 | 0 | [报告](./zhiyu-parity-backend-lsee.md) |
| affairs/partner/alliance/portal/AI/auth/系统/文件/超管 | 480 | 429 | 51 | 0 | [报告](./zhiyu-parity-backend-core.md) |

> 注：核心域的 51 个 ⚠️ 绝大部分由同一根因（鉴权横切未迁移）造成，不是 51 个独立功能缺失。

### 前端（React 191 条路由 → portal-vue）

| ✅ 已对齐 | ⚠️ 部分对齐 | ❌ 整页缺失 | ➕ Vue 新增 |
|---|---|---|---|
| 180 | 8 | 0（仅 2 个索引重定向未实现，轻微） | ~30（导入导出中心 /import-export、/approvals、/workflows 聚合页、/portal/community、/portal/favorites 等） |

前端路由覆盖度 100%；缺口全部是**页内功能级**。plus-ui（Java 栈专属管理端）额外覆盖 system/monitor/代码生成/工作流引擎，Go 栈无对应物，不计缺口。

### 基础设施

| 项 | 状态 |
|---|---|
| 数据库 schema（169 表，Java 123 实体 + Mapper SQL 覆盖其余活跃表） | ✅（业务表共用 Go 迁移，无独立迁移机制属既定架构） |
| 认证（登录/多租户/验证码/逐请求状态校验/401 文案） | ✅ |
| 文件上传/预览/签名 URL/静态回源（含 HMAC 混合鉴权） | ✅ |
| 菜单驱动服务端授权 RequireMenu（ADR-0008） | ❌ 未迁移 |
| 每日 02:00 岗位能力汇聚定时任务 | ❌ 未迁移 |
| 登录日志 IP 归属地（ip2region） | ⚠️ 框架有能力，业务未接 |
| 敏感字段输出脱敏（mask） | ⚠️ 待确认覆盖度 |

## 三、缺口清单（按优先级）

### P0 — 安全/越权类（上线前必须补齐）

1. **菜单驱动服务端授权（ADR-0008 RequireMenu）整体缺失**：Go 端全部业务路由挂 RequireMenu 中间件（backend/go/internal/router/menu_grants.go、middleware/menu.go）；Java zhiyu 全部 controller 中 @SaCheckPermission 出现 **0 次**，SystemGuard.java:16-17 自认"简化为角色码兜底"。菜单权限仅回传前端做 UI 控制，服务端无拦截。
2. **平台 token 隔离缺失**：Go routes.go:92/338/352 用 RequirePlatform 强制 portal/saas/partner 三端 token 隔离；Java ZhiyuAuthFilter 无平台校验（partner token 可调 portal 接口）。
3. **partner 管理员写接口（7 个）无 enterprise_admin 拦截**（Go routes_partner.go:95-104 adminOnly，Java 无角色校验）。
4. **alliance 管理面写接口（34 个）无服务端授权**（Go routes.go:232 RequireMenu + canManageAlliance，Java 零检查）。
5. **AI 管理端授权退化**：菜单授权 → 旧 user.role=="school_admin" 单字段（AiCenterServiceImpl.java:1123）。
6. **affairs/partner/alliance/ai 业务写面普遍无菜单也无角色校验**，仅 system 域有 SystemGuard。

### P1 — 防护/可观测类

7. **限流全缺**：登录/验证码/密码限流（Go routes.go:39-51）、AI 调用/上传/导入导出限流均未迁移（LLM 按 token 计费额度可被刷爆）。
8. **审计日志有查询无写入**：/logs/operation（Go middleware/oplog.go:129 统一审计）与 /logs/login（Go service/auth.go:35 RecordLoginLog）在 Java 端只有读取接口，无任何 insert 点，列表恒空。
9. **每日岗位能力汇聚定时任务缺失**：Go scheduler.go（02:00 cron + job_run_logs + advisory lock + 告警 webhook）；Java 无 @Scheduled，SnailJob 配置 enabled: false，仅剩手动触发 POST /aggregate。
10. 登录日志 IP 归属地未接（Go internal/geo，Java 框架 RegionUtils 未接入 zhiyu 登录链路）。

### P2 — 功能差异类

11. **场景任务测评方法「临时考试联动」未迁移**：Go 绑定 paper/question_bank/quiz 类测评方法时自动创建 exam_usages 并按「任务名+同天序号」命名（EnsureExamUsageForMethod）；Java SceneEvalMethodServiceImpl.java:54/166 注释明确"暂缓实现"。**后端唯一的功能性差异。**
12. PUT /job/positions/{id}/save-full 响应包装差异：Go 返回裸 CareerPosition、Java 返回 {position}——**Java 与两侧前端契约一致，是 Go 偏离自身声明**（React 未消费返回值故未暴露），建议以 Java 为准。

### P3 — 前端页内功能差异（8 项，详见前端报告）

13. /evaluation/scene-results/:id 场景测评详情：**现场评审评分链路几乎整体缺失**（评审步骤选择、现场问答/抽题、评价点逐项评分、学生自评、材料附件预览；React 1487 行 vs Vue 193 行）——前端最大单页缺口。
14. /affairs/scheduling 排课：Vue 以列表+弹窗替代 React 的「场地×节次可视化排课网格」与「班级/教师双视角周课表」；Vue 另增自动排课/导出。
15. /portal/apps/system/org-user/roles 角色管理：缺角色权限配置对话框（系统/菜单/数据权限 Tab）。
16. /evaluation/exam-usage/results 考试结果：缺导出、评分状态列、学生考试记录详情。
17. 联盟管理 achievements/agreements/projects 三页缺批量导入；agreements 另缺「前台展示」开关。
18. /affairs/teachers 教务域版缺导入/导出按钮。
19. 轻微：/partner、/portal/apps/system 索引重定向未实现；404 行为差异（React 有 NotFound 页，Vue 静默跳 /portal）。

### 观察项（非缺口）

- Go GET /job/public/positions 有租户级 2min 缓存，Java 无缓存层（功能等价，性能特征不同）。
- Go 迁移中 27 张表 Java 完全未引用，其中绝大多数为 Go 侧也不再引用的历史遗留表（graduation_project_*、app_modules、withdrawals 等）；institutions 表 Go 旧登录/导入路径仍读，建议确认是否需要对齐或清理。

## 四、迁移完成度判断

| 维度 | 完成度 |
|---|---|
| 后端业务端点覆盖 | **100%**（0 缺失） |
| 后端业务行为等价 | ~99%（唯一功能差异 = 场景临时考试联动） |
| 前端页面覆盖 | **100%**（0 缺页）；页内功能 ~96%（8 页有差异） |
| 服务端授权模型 | **未迁移**（最大风险项） |
| 横切设施（限流/审计写/定时任务/登录地点） | 部分迁移 |

**结论：功能面迁移已基本完成，可以按模块逐步切流验证；但「鉴权 + 限流 + 审计 + 定时任务」四项横切缺口未补前，不建议将 Java 栈作为唯一生产栈。** 建议补齐顺序：P0 授权模型 → P1 限流/审计/定时任务 → P2 场景临时考试联动 → P3 前端页内差异。
