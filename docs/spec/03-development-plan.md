# 开发计划表 — 知与 SaaS

> 回溯式文档：M0~M5 里程碑与任务按 git 提交历史（2026-07-01 ~ 2026-08-04，1996 个 commit）反推，状态均为已完成；M6~M8 为 08-04 之后的迭代摘要（安全加固、企业平台 Partner、资源快照）。供后续版本规划参考，新迭代按同样节奏制定 WBS。

---

## 1. 里程碑划分

| 里程碑 | 目标描述 | 周期 | 交付物 | 状态 |
|--------|---------|------|--------|------|
| M0 基建初始化 | 仓库初始化、部署脚本、环境隔离 | 07-01 ~ 07-03 | deploy.sh / docker-compose / .env 机制 | ✅ 完成 |
| M1 后端核心域建设 | 租户/组织/用户/角色 + 岗位/场景/课程/测评 handler 主体 | 07-11 ~ 07-18 | 路由与 handler 主体、数据库 baseline | ✅ 完成 |
| M2 前端对接与统一 | 前端各模块 wire 真实 API、跨模块共享组件统一、导航整合 | 07-17 ~ 07-25 | portal 门户/应用中心、landing 页、共享组件库 | ✅ 完成 |
| M3 流程与治理 | 内容状态机统一、批次/审批/工作流四系统统一、store 分层迁移 | 07-18 ~ 07-28 | ContentActionStore、五套批次、统一审批、store 层重构 | ✅ 完成 |
| M4 联盟与教务 | 联盟台账/导入导出、教务（学期/人培/排课）、Excel 三件套 | 07-26 ~ 07-31 | alliance 全主体、affairs 全链路、import/export 体系 | ✅ 完成 |
| M5 平台化与体验 | 工作台 v2、移动端适配、超管控制台、安全加固 | 07-27 ~ 08-04 | 角色工作台、响应式全量修复、RequirePlatform 恢复、五轮代码审查 | ✅ 完成 |
| M6 安全加固与门禁 | 安全非功能落地（密钥/限流/上传）、spec-check.sh 门禁 | 08-05 ~ 08-12 | security-standards.md 全部落地、spec-check.sh 门禁 | ✅ 完成 |
| M7 企业平台 Partner | 企业全局实体 + 专家账号直绑 + 企业端资源共建 + 联盟前台公开 | 08-12 ~ 08-14 | ADR-0007、partner-enterprise-platform.md、迁移 142/145/146/154/155 | ✅ 完成 |
| M8 资源快照与版本固化 | 发布即快照、成绩行版本盖章、快照查询剥离学生答案 | 08-14 | ADR-0006、resource-snapshot-versioning.md、迁移 158 | ✅ 完成 |

> M6~M8 为摘要级登记（细节见对应 ADR 与 spec 章节），未回溯补写任务级 WBS。

### 提交密度参考

```
07-01 █ (init)
07-11 ████████████████████████████████████████████████
07-16 ████████████████████████████████████████████
07-19 ████████████████████████████████████████████████
07-23 ████████████████████████████████████████████████████████████
07-27 ██████████████████████████████████████████
07-31 ██████████████████████████████████████████████████████████████████
08-03 ████████████████████████████████████████████████████████████
```

---

## 2. 任务拆解（WBS）

> 负责人列：单 Agent 任务记为 `A`，多 Agent 并行记为 `A1/A2/...`（git 分支 `feat/agent-*`）；工时按提交量与复杂度估算（人·天）。

### M0 基建初始化（07-01 ~ 07-03）

| 任务名 | 负责人 | 预估工时 | 依赖 | 状态 |
|--------|--------|---------|------|------|
| 仓库初始化（monorepo：apps/packages/backend） | A | 1 | — | ✅ |
| deploy.sh 一键部署脚本（首装依赖/.env/建库/种子） | A | 2 | 仓库初始化 | ✅ |
| docker-compose（postgres/redis/后端/前端/kkfileview） | A | 1 | 脚本 | ✅ |
| CI 工作流（前端 typecheck/lint/test，后端 gofmt/vet/build/test） | A | 1 | 仓库初始化 | ✅ |

### M1 后端核心域建设（07-11 ~ 07-18）

| 任务名 | 负责人 | 预估工时 | 依赖 | 状态 |
|--------|--------|---------|------|------|
| baseline schema（109 表）+ 迁移机制（001_baseline + .down 配对） | A1 | 4 | M0 | ✅ |
| 认证体系：JWT 双平台 token / 登录限流 / 租户选择 | A2 | 2 | baseline | ✅ |
| 租户/组织/用户/角色/基础字典 handler + 租户创建事务 | A1 | 3 | baseline | ✅ |
| 岗位域（positions/abilities/职责/证书/批次） | A2 | 3 | baseline | ✅ |
| 场景域（scenarios/tasks/评价方法/量规） | A3 | 3 | baseline | ✅ |
| 课程域（courses/nodes/作业/测验/行为） | A2 | 3 | baseline | ✅ |
| 测评域（题库/试卷/考试/认证规则/毕业设计/微证书） | A3 | 4 | baseline | ✅ |
| 统一响应/分页/错误码/操作日志/上传 | A1 | 2 | baseline | ✅ |

### M2 前端对接与统一（07-17 ~ 07-25）

| 任务名 | 负责人 | 预估工时 | 依赖 | 状态 |
|--------|--------|---------|------|------|
| 登录页（三 Tab + 租户选择弹窗）+ AuthProvider | A1 | 2 | M1 认证 | ✅ |
| 门户首页/应用中心（11 模块卡片）+ TopNav | A1 | 2 | 登录 | ✅ |
| 各模块 wire 真实 API（移除 localStorage mock） | A2/A3 并行 | 6 | M1 接口 | ✅ |
| 学生落地页（job/scene/lesson/evaluation landing 四套） | A2 | 3 | 公开接口 | ✅ |
| 共享组件下沉公共组件库（StatusBadge/ConfirmDialog/ImportWizard 等） | A3 | 3 | — | ✅ |
| api-client 工厂（createCrudApi/createContentApi）+ shared-types | A3 | 3 | — | ✅ |

### M3 流程与治理（07-18 ~ 07-28）

| 任务名 | 负责人 | 预估工时 | 依赖 | 状态 |
|--------|--------|---------|------|------|
| 内容状态机统一（domain/status.go + ContentActionStore） | A1 | 2 | M1 | ✅ |
| 五套批次表统一 + registerBatchRoutes 工厂 | A1 | 1 | 状态机 | ✅ |
| 统一审批（workflows + approval_records + any/all 推进） | A2 | 2 | 状态机 | ✅ |
| store 分层迁移（70+ 文件，ListConfig 下沉） | A3 | 5 | — | ✅ |
| 身份类型体系移除，统一角色权限树 | A2 | 2 | — | ✅ |
| 测试覆盖（113 Go 测试 + 30 前端测试） | A1/A2 | 3 | 各模块 | ✅ |

### M4 联盟与教务（07-26 ~ 07-31）

| 任务名 | 负责人 | 预估工时 | 依赖 | 状态 |
|--------|--------|---------|------|------|
| alliance 全主体（企业/协议/项目/成果/专家/权限/品牌/字典） | A1 | 4 | M1 | ✅ |
| alliance 批量导入导出（7 实体 + 中文字典识别） | A2 | 3 | 实体 | ✅ |
| 教务：学期/人培方案（克隆）/教学计划（生成/确认） | A3 | 3 | M1 | ✅ |
| 排课（场地/节次/自动排课/冲突检测/发布/课表导出） | A3 | 3 | 教学计划 | ✅ |
| Excel 三件套统一（模板/预览/导入 + 长超时） | A2 | 2 | — | ✅ |

### M5 平台化与体验（07-27 ~ 08-04）

| 任务名 | 负责人 | 预估工时 | 依赖 | 状态 |
|--------|--------|---------|------|------|
| 工作台 v2（学生/教师/学校管理员角色化 Tab + 驾驶舱折线图） | A1 | 3 | 聚合接口 | ✅ |
| 移动端适配三轮全量扫描（30 文件 43 处） | A2 | 3 | — | ✅ |
| SaaS 超管控制台（租户 CRUD + 订阅开关 + 管理员重置密码） | A3 | 2 | 认证 | ✅ |
| 安全加固：RequirePlatform 恢复 / 外键级联治理（迁移 115/116） | A2 | 2 | — | ✅ |
| 五轮代码审查修复（P1 数据正确性 → P3 精选） | 全部 | 3 | — | ✅ |
| 联盟前台落地页 + 体系课/场景课对齐 | A1 | 2 | M4 | ✅ |

---

## 3. 资源与风险

### 3.1 人力分配

| 角色 | 负责领域 |
|------|---------|
| Agent A（后端域） | 认证/租户/组织/用户、内容状态机、批次审批、store 分层 |
| Agent B（后端域） | 岗位/课程域、联盟、教务排课、导入导出 |
| Agent C（前端域） | 门户/工作台/应用中心、共享组件、学生落地页、移动端 |
| 全 Agent | 测试覆盖、代码审查修复、部署验证（deploy.sh --branch 隔离） |

协作模式：`git worktree` 分支隔离（`feat/agent-*`），独立部署验证后自动合并回 master，互不阻塞。

### 3.2 外部依赖

| 依赖 | 说明 | 状态 |
|------|------|------|
| file-viewer 文档预览（flyfish-dev） | 浏览器原生（flyfish-dev/file-viewer），覆盖全部 208 扩展名，无服务端转换 | 已启用 |
| kkfileview 文档预览服务 | 可选 profile，端口 8012（保留作 file-viewer 不支持格式的回退） | 可选启用 |
| Redis | 缓存/限流，未配置自动降级 | 已就绪（docker） |
| PostgreSQL 15 | 主数据库 | 已就绪（docker） |
| 设计稿 | 无外部设计稿，组件库（Element Plus + 亮色主题）即视觉规范 | 内置 |

### 3.3 风险项与应对

| 风险 | 影响 | 应对方案 |
|------|------|---------|
| 多 Agent 并行冲突 | 相同文件并发修改 | worktree 分支隔离 + 部署前 rebase master + 审查合并 |
| 接口变更波及前端 | mock 与真实接口不一致 | api-client 单一来源 + shared-types 类型约束 + CI typecheck |
| 状态机非法流转 | 数据一致性 | ContentActionStore 统一校验 + 409 冲突语义 |
| 租户数据越权 | 数据泄露 | 三重校验 + 平台隔离 + 无跨租户特权原则 |
| 导入大文件超时 | 导入失败 | 10min 长超时 + 预览先行 + 行级错误报告 |
| 部署编译错误 | 阻塞上线 | deploy.sh 质量门禁（Maven 编译 + portal-vue/plus-ui 构建 + spec-check）前置拦截 |

---

## 4. 评审节点

| 节点 | 时机 | 形式 | 产出 |
|------|------|------|------|
| Spec 评审 | 每里程碑开工前 | 本文档 + PRD/接口契约/Schema 四份规格对齐 | 里程碑任务清单 |
| 代码评审 | 每批次合并前 | CI 门禁 + 人工 review（审查记录） | `docs/code-review-checklist.md` 审查清单 |
| 部署验证 | 每次代码修改后 | `./deploy.sh --branch` 隔离部署 + 健康检查 + 业务冒烟（见 §5） | 自动合并回 master |
| UAT 验收 | 每里程碑结束 | 学生端/管理端全流程走查 | 里程碑完成状态（见 §1） |
| 五轮审查 | 08-03 ~ 08-04 | P1 数据正确性 → P2 精选 → P3 清理 | `docs/code-review-checklist.md`（含各批次修复明细） |

## 5. 部署契约（deploy.sh 行为约定）

> 与实现同源：`deploy.sh` 是**唯一部署入口**（Java + Vue 单栈：Java 后端 + portal-vue/plus-ui 前端 + PostgreSQL）。建库建表（`db/migrations` 纯 psql 执行 + 种子数据由 java-backend SeedRunner 初始化）统一只经 deploy.sh。

### 5.1 执行顺序（顺序即契约）

1. **取部署锁**（`/run/zhiyu-deploy.lock`，flock 不可用即拒绝部署）——先于任何系统级动作（apt / 安装 Node / 装 nginx / 配 docker mirror），避免并发部署互踩
2. 校验分支 → 在隔离 worktree（`/tmp/zhiyu-build-cache`）上以 `origin/master` 为基座合并目标分支
3. 增量构建：源码 hash 比对**只构建变更部分**——Java 后端（`backend/java` Maven 构建）+ `frontend/portal-vue` + `frontend/plus-ui`；前端构建在 `systemd-run` 单元内执行（`MemoryMax=6G`，`.env` 中 `VITE_*` 经 `--setenv` 显式透传）
4. **第一段启动**：只起数据层 `postgres` / `redis`
5. **全库备份**（`/opt/zhiyu-saas/backups`，目录 700 / 文件 600，保留最近 7 份）
6. **执行迁移**：`db/migrations/*.up.sql` 纯 psql 执行（`ON_ERROR_STOP=1`，遇错立即停止，不叠加半应用 DDL）+ **Java 框架表初始化**（deploy 幂等初始化）
7. **第二段启动**：再起业务容器 `java-backend` / `nginx` / `kkfileview`（前端 portal-vue/plus-ui 为静态产物，rsync 到 `$DEPLOY_DIR/web/` 由 nginx 容器 bind mount，无独立容器）
8. **健康门禁**：带 healthcheck 的服务必须 `healthy`（`Up (health: starting)` / `Up (unhealthy)` 不算就绪）；网关容器重启后自检两次失败即回滚
9. **业务冒烟**：`/portal/login` 200、`/health` 200、`/api/v1/auth/captcha` 200（API+Redis）、`/api/v1/settings/theme` 200（API+DB 读）、`/api/v1/tenants` 401（鉴权中间件生效）；任一失败即回滚
10. 首次建库时补跑**种子数据**（java-backend SeedRunner，失败仅 warn 不回滚）
11. 等待 **kkfileview** 就绪（最长 180s，非核心服务，未就绪仅 warn）
12. 写入构建指纹 → 生成生产 nginx 配置（临时文件 + `cmp` 去重 + 原子 mv，`nginx -t` 失败自动复位并**不回滚**）→ 合并分支到 master
13. 收尾清理：本项目已退出容器、构建缓存（超 `BUILD_CACHE_LIMIT_GB` 才裁剪，**全宿主范围**）、悬空镜像（`until=24h`）、每仓库只留最新 1 个镜像标签；并检测上传卷根目录旧布局，提示执行 `scripts/migrate_uploads.sh`

**失败处理分三类**（不是所有失败都回滚）：
- **回滚**（`rollback_deploy` → 回上一版镜像 + 重做健康检查 + 报错退出，**不合并 master**）：数据层/业务容器启动失败、baseline 与增量迁移失败、健康门禁未过、网关自检两次失败、业务冒烟未过；
- **仅告警继续**：全库备份失败（无备份不该阻断）、种子初始化失败、kkfileview 未就绪；
- **直接退出但不回滚**（此时新版本已通过冒烟、已在线上）：nginx 配置生成失败 / `nginx -t` 失败（自动复位配置）/ nginx 启动失败。

回滚后会把 `.env` 的 `IMAGE_TAG` 复位到回滚版本，避免下次 `docker compose up` 又拉起失败版本。
注意「回滚到上一版镜像」只保证**当次部署失败时可回退一步**：部署成功后清理只保留最新 1 个镜像标签，
之后要回退旧版本须 `git checkout <旧 commit>` 重新构建（见 AGENTS.md 第七节）。

### 5.2 密钥注入边界

| 容器 | 可见密钥 | 理由 |
|---|---|---|
| `java-backend` | 显式白名单：`ZHIYU_DB_HOST/PORT/USER/PASSWORD`（数据源）、`ZHIYU_REDIS_HOST/PORT/PASSWORD`（Redis 口令）、`JWT_SECRET`（Sa-Token 签名密钥，application.yml `${JWT_SECRET:...}`）、`SEED_ADMIN_PASSWORD`（SeedRunner 种子）、`ZHIYU_UPLOAD_DIR`（上传目录） | 运行期实际读取的全部变量（`application-prod.yml` + application.yml）。**不再用 `env_file: .env`**：那会把仅宿主机需要的 `SEED_ADMIN_PASSWORD` 与全部 `VITE_*` 一并灌进运行容器 |
| `postgres` | 仅 `POSTGRES_*`（值来自 `DB_USER`/`DB_PASSWORD`/`DB_NAME`） | 建库账号 |
| `frontend` / `nginx` / `redis` / `kkfileview` | **无**（redis 仅 `--requirepass` 命令行参数，kkfileview 仅 `KK_*` 预览配置） | 静态产物与第三方组件不得持有可伪造 token 的 `JWT_SECRET` / 数据库口令 |

密钥另有三条硬约束：`.env` 权限 600（含构建树内副本）、口令不进进程 argv（psql 走 `PGPASSWORD`）、部署输出与日志不回显任何口令。

### 5.3 备份与恢复（已实测）

- 备份：每次部署迁移前全库 `pg_dump` 到 `/opt/zhiyu-saas/backups`（目录 700 / 文件 600，保留最近 7 份，约 11MB/份）。
- 恢复：**一律用容器内 psql**（`docker exec -i zhiyu-postgres psql ...`），客户端与 dump 同源；
  pg_dump 15.18+ 输出 `\restrict/\unrestrict` 元命令，宿主旧版 psql（<15.14 / <16.10）会报 `invalid command \restrict`。
- 恢复演练（2026-08-19 实测）：最新备份恢复到临时库 `restore_drill` 成功，表数与 `04-database-schema.md` 头部一致（业务表 + Java 栈 RuoYi 框架表，框架表由 deploy 框架表初始化），与生产一致；宿主 psql 16.14 亦可恢复。
- 约定：覆盖生产前必须先恢复到临时库比对表数与关键表行数。

### 5.4 质量门禁

CI（`.github/workflows/ci.yml`）：Java Maven 编译 + portal-vue/plus-ui 构建 + `spec-check.sh` + **shell（`bash -n` 全量 + shellcheck，覆盖 deploy/scripts 全部脚本）**。

**`deploy.sh` 质量门禁默认开启**，`--skip-gates` 仅应急跳过。原因：CI 触发条件是 `push: [master]`，而 deploy.sh 部署成功后直推 master —— 门禁若只靠 CI，等于事后报警，红了也拦不住已写入的 master。

门禁的几条**边界必须知道**（否则会高估覆盖度）：
1. **`spec-check.sh` 无条件执行**（秒级），纯文档/纯脚本改动同样校验；
2. **语言级门禁随构建触发**：Java Maven 编译只在 Java 源码指纹变化时跑，portal-vue/plus-ui 构建只在前端指纹变化时跑 —— 无源码变更的部署不会重复跑它们（CI 仍会在 master 上全量跑）；

## 6. 后续迭代建议

> 2026-08-20 起（用户决策）：ui-smoke **仅保留全量页面访问冒烟 + CRUD 巡检**，flow 业务流程测试已移除
> （scripts/ui-smoke/flows.mjs 与 docs/spec/06-acceptance-flows.md 同步删除，spec-check 第 12 项因 06 文件缺失恒跳过）。
> 核心业务链路（跨角色/跨页面的端到端链）正确性改由**后端集成测试 + 逐页巡检**覆盖，不再维护 flow DSL。

1. **S1（建议）**：补齐 OPC 专区/决策中心/教科研三个占位模块的产品定义
2. **S2（建议）**：商城 marketplace 重启用（表结构已保留）或明确移除归档
3. **S3（建议）**：学生端数据 mock 替换为真实 API（workspace `_data/` 标注"后续应替换"）
4. **S4（建议）**：按本文档粒度逐接口补全契约文档与自动化契约测试（如 pytest/openapi schema）
