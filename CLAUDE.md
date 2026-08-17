# CLAUDE.md - base-dev-framework6-java

## 语言设置
**必须使用中文**与用户对话。

## 项目定位

本项目 **base-dev-framework6-java** 是**公司统一研发基础框架**（`org.dromara` 包名、Spring Boot 4 / Java 21 / Jakarta EE 10），**前后端一体化单仓库**：根目录为后端多模块 Maven 工程，前端 plus-ui（Vue3 + Element Plus + pnpm）位于仓库内 `plus-ui/` 目录，代码生成器内置模板产出前端骨架。

> 🔴 **本项目遵循框架约定**：包名 `org.dromara`，**三层架构无 DAO 层**（Controller→Service→Mapper，直接用 `BaseMapperPlus`），Entity 继承 `BaseEntity`，查询用 `QueryBuilder.lambda`，标准 REST 路径（`/list`、`/{id}`）。不要套用 `plus.ruoyi` / DAO 层 / `PlusLambdaQuery` / `/pageXxx` 等其它衍生版约定。

## 🔴 文件编码规范（必须遵守）

- 所有源码与配置文件统一 **UTF-8（无 BOM）、LF 换行**（遵循 `.editorconfig`）。Java 4 空格，JSON/YAML 2 空格。
- 绝对禁止 UTF-8 with BOM / GBK / GB2312 / ANSI 混用。
- `java: 非法字符: '﻿'` → 优先判定为 BOM：定位文件 → 移除文件头 BOM → 扫描同目录 `.java` → 重新编译验证。
- 中文注释/日志/文档必须可读，不允许乱码。

## 🔴 Git Flow 分支与提交规范（必须遵守）

> 提交代码、创建/合并分支、发版前**必须**先阅读 `docs/Git Flow 开发协作简易指南.md`，并**强制**按以下约定执行。

### 分支模型与硬性红线

| 分支 | 命名 | 来源 | 合并去向 | 说明 |
|------|------|------|---------|------|
| main | `main` | - | - | 生产基线，**只接受** `release/*` 与 `hotfix/*` 的合并，合并后**必须打唯一版本 Tag**（如 `v1.2.0`） |
| dev | `dev` | main | release | 开发主线，接受 `feat/*`、`hotfix/*`、`release/*` 的合并 |
| release | `release/<版本>` | dev | main & dev | 预发/冻结分支，验证通过后合并 main 与 dev，**立即删除** |
| feature | `feat/<禅道ID_描述_代号>` | dev | dev | 个人功能分支，开发完合并回 dev **后删除** |
| hotfix | `hotfix/<版本_代号>` | main | main & dev & release | 线上紧急修复，**必须反向同步回 dev**（存在活跃 release 时也同步） |
| customer | `cust/<name>` | **main 的稳定 Tag** | - | 客户定制分支，通用功能经"重构/配置化"后回流 dev |

1. 🔴 **严禁** `dev` 或其他功能开发分支直接合并入 `main`；`main` 只接受 `release` 与 `hotfix` 的合并。
2. 🔴 发布链路严格 `dev` → `release/<版本>` → `main`；**合并到 main 后必须打唯一版本 Tag** 作为不可变代码基线。
3. 🔴 `hotfix` **必须**反向同步回 `dev`（闭环）；存在活跃 `release` 分支时必须同步到该 `release`。
4. 🔴 `cust/<name>` 必须基于 `main` 的**稳定 Tag** 拉出；客户定制通用功能需"重构/配置化"后才能合并回 `dev` 主线。

### 提交信息格式（强制）

每次提交**必须**写 Commit message（否则不允许提交），格式：`type(scope): subject`，**主体需关联禅道 Issue ID**：

```text
<type>(<scope>): <subject> [Bug-<IssueID>]
```

示例：`fix(api): 增加课程章节分级接口 [Bug 1111]`

`type` 取值：`feat`（新功能）/ `fix`（修补 Bug）/ `docs`（文档）/ `style`（格式）/ `refactor`（重构）/ `chore`（构建/工具）/ `test`（测试）。

### MR 合并准则（强制）

1. 提交 MR 前**必须**本地编译 + 基础自测通过。
2. MR 必须经过**至少 1 位**同事 Code Review 才能合并；**main 与 release 分支**的 MR 须技术负责人或项目维护者最终批准。
3. MR 标题遵循 `type: subject [禅道指令 ID]` 格式，描述需说明功能点、影响范围、测试结果。
4. `feat` / `hotfix` 分支 MR 合并完成后**必须勾选删除源分支**。

## 🔴 Skills 强制评估（必须遵守）

> 每次用户提问时，UserPromptSubmit Hook 会注入技能评估提示。必须严格遵循：

1. **评估**：根据注入的技能列表，列出匹配的技能及理由（无匹配则写"无匹配技能"）。
2. **激活**：对每个匹配技能调用 `Skill(技能名)`。
3. **实现**：激活完成后再开始实现。

**Skills 位置**：`.claude/skills/[skill-name]/SKILL.md`。

> 本仓库内置 **`.claude/agents/`**（6 个后端 subagent）与 **`.claude/skills/`**（分场景技能体系）。二者**互补共存**：agents 是后端专项子代理，技能是场景化编码规范。

## 🔴 经验沉淀目录加载（会话开始时）

会话开始（首次响应用户）前，若 `.claude/docs/experience/` 有内容，执行：
```bash
ls -t .claude/docs/experience/*/*-exp-summary.md 2>/dev/null | head -1
```
有输出 → 读取该最近摘要作为本次会话经验上下文（已沉淀的禁令/踩过的坑）。读完即可，不必复述。
**例外**：用户首条是简单问候或与项目无关的纯通用问题，可跳过。

---

## 核心架构（必须牢记）

| 项目 | 框架规范 |
|------|-------------|
| 包名 | `org.dromara.*` |
| 分层 | **Controller → Service(接口+impl) → Mapper**（无 DAO 层） |
| Mapper | `extends BaseMapperPlus<Entity, Vo>`（复杂模块 + `MPJBaseMapper<Entity>`） |
| 查询构建 | Service 层 `QueryBuilder.lambda(Entity.class)` / `QueryBuilder.lambdaJoin("u", Entity.class)` |
| 条件辅助 | `eqIfText` / `likeIfText` / `eqIfPresent` / `inIfNotEmpty` / `betweenParams` |
| Entity 基类 | `BaseEntity`（`org.dromara.common.mybatis.core.domain`） |
| 对象转换 | `MapstructUtils.convert(bo, Entity.class)`（MapStruct-Plus） |
| BO/VO 注解 | BO `@AutoMapper(target=Entity, reverseConvertGenerate=false)`；VO `@AutoMapper(target=Entity)` |
| 主键策略 | 雪花 ID（`@TableId`） |
| 逻辑删除 | `@TableLogic`（`del_flag`）；乐观锁 `@Version` |
| 分页 | `PageQuery` + `PageResult`：`mapper.selectVoPage(pageQuery.build(), lqw)` → `PageResult.build(records, total)` |
| 响应包装 | `R<T>` / `R<Void>` / `PageResult<T>` |
| 权限标识 | `@SaCheckPermission("${module}:${business}:${action}")` |
| 业务异常 | `ServiceException` |
| 日志审计 | `@Log(title=..., businessType=BusinessType.X)`；防重 `@RepeatSubmit`；分组校验 `AddGroup/EditGroup/QueryGroup` |
| 当前时间 | `DateUtils`（extends Hutool `DateUtil`） |

### 标准 CRUD 模块结构

```
org.dromara.{module}/
├── controller/EntityController.java     extends BaseController, 返回 R<T>
├── service/IEntityService.java
├── service/impl/EntityServiceImpl.java   @RequiredArgsConstructor @Service
├── mapper/EntityMapper.java              extends BaseMapperPlus<Entity, EntityVo>
└── domain/
    ├── Entity.java                       extends BaseEntity
    ├── bo/EntityBo.java                  @AutoMapper(target=Entity, reverseConvertGenerate=false)
    └── vo/EntityVo.java                  @AutoMapper(target=Entity)
```

生成器默认方法集合：`queryById` / `queryPageList` / `queryList` / `insertByBo` / `updateByBo` / `deleteWithValidByIds`，再叠加唯一校验、数据权限、MPJ、缓存、Excel 导入导出、关联维护。

### 模块拓扑

```
ruoyi-admin          # 唯一可执行入口
ruoyi-api            # 跨模块 API 契约层（仅依赖 common-core；跨模块调用走它，不直接 import 实现）
ruoyi-common/*       # 24 个公共能力模块（core/web/mybatis/redis/satoken/security/log/doc/excel/oss/json/
                     #   encrypt/sensitive/translation/mail/sms/social + ai/mcp/elasticsearch/mqtt/push/job）
ruoyi-modules/*      # system / ai / workflow / job / gen / demo
ruoyi-extend/*       # monitor-admin / snailjob-server / snailai-server（独立部署 Server）
```

## 技术栈（关键版本）

| 维度 | 技术 | 版本 |
|------|------|------|
| 运行 | Java / Spring Boot / 容器 | 21 / 4.1.0 / Jetty |
| 持久 | MyBatis-Plus(boot4) / MPJ / dynamic-datasource | 3.5.16 / 1.5.7 / 4.5.0 |
| 认证 | Sa-Token(boot4) | 1.45.0 |
| 缓存 | Redisson / 序列化 Apache Fory | 4.6.1 / 1.2.0 |
| 任务 | SnailJob | 2.0.0 |
| 存储 | AWS SDK v2 S3（适配 MinIO/OSS/COS） | 2.42.9 |
| Excel | Apache FESOD | 2.0.2 |
| AI | Snail AI / Spring AI + MCP | 0.0.5 / 2.0.0 |
| 搜索 | Easy-Es / ES Client | 3.0.2 / 7.17.28 |
| 其它 | mica-mqtt / SMS4J / JustAuth / Warm-Flow / SpringDoc | 2.6.6 / 3.3.5 / 1.16.7 / 1.8.8 / 3.0.3 |

> 实证辟谣：无 `langchain4j`（AI 走 Snail AI + Spring AI/MCP）；无 `Fastjson2`（JSON 用 Jackson）；无 `Knife4j`（SpringDoc 原生）。

## 代码生成器（ruoyi-gen，6.x 重构）

- 模板引擎 **FreeMarker(.ftl)**（已由 Velocity 迁移），模板在 `ruoyi-modules/ruoyi-gen/src/main/resources/fm/`。
- **多前端栈**：`gen_table.frontend_type` → `fm/<type>/`：`vue`（Element Plus）/ `react`（Ant Design Pro）。新增前端栈只加 `fm/<type>/` 目录 + 4 个 FTL，不在 Java 里加硬编码分支。
- 上下文变量大幅扩充（needXxx 列开关、enableExport/Status/Unique/Sort、树字面量），写 `.ftl` 直接用已算好的值，别在模板里再扫列。

## 绝对禁止的写法（框架）

| 错误 | 正确 |
|------|------|
| 包名 `plus.ruoyi.*` / `com.ruoyi.*` | `org.dromara.*` |
| 引入 DAO 层 / `buildQueryWrapper()` | 无 DAO，Service 直接用 `BaseMapperPlus` + `QueryBuilder` |
| Entity `extends TenantEntity` | `extends BaseEntity` |
| `extends ServiceImpl<>` | 接口 + impl，不继承 |
| `PlusLambdaQuery` / `likeCast` | `QueryBuilder.lambda` + `likeIfText/eqIfText` |
| `BeanUtil.copyProperties()` | `MapstructUtils.convert()` |
| API `/pageXxxs`、`/getXxx/{id}` | 标准 `GET /list`、`GET /{id}`、`POST`、`PUT`、`DELETE /{ids}` |
| 逻辑删除 `is_deleted` | `del_flag`（`@TableLogic`） |
| Controller 暴露 Entity | 用 BO 入参、VO 出参 |
| 管理接口漏权限注解 | `@SaCheckPermission` + 写操作 `@Log` |
| 跨模块直接 import 另一业务模块实现 | 走 `ruoyi-api` 接口契约 |
| `> nul`（Windows 会建名为 nul 的文件） | 不重定向，或 `> /dev/null 2>&1` |

## 快速命令

| 命令 | 用途 |
|------|------|
| `/dev` | 开发新功能（全栈代码生成） |
| `/crud` | 快速 CRUD（FreeMarker + 双前端栈） |
| `/check` | 代码规范检查（框架约定） |
| `/progress` | 项目进度报告 |
| `/next` | 下一步建议 |
| `/start` | 项目快速启动 |

## 开发前检查清单

- [ ] 已读目标模块最近似的现有代码（优先复用其写法）
- [ ] 包名 `org.dromara`，三层无 DAO，Entity `extends BaseEntity`
- [ ] 查询用 `QueryBuilder.lambda` + IfText/IfPresent 条件，分页 `selectVoPage`+`PageResult.build`
- [ ] BO/VO 用 `@AutoMapper`，转换用 `MapstructUtils`
- [ ] 写接口带权限 `@SaCheckPermission` + 日志 `@Log`，标准 REST 路径
- [ ] 不违反"绝对禁止"表；UTF-8 无 BOM
