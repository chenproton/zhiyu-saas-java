---
name: writing-plans
description: |
  当需要把已确定的方案/需求拆解成"可直接执行的细颗粒计划"时自动使用此 Skill。补齐 brainstorm（方案）与 /dev、/crud（执行）之间的「计划层」断层，产出带精确文件路径、验证命令、规范提交的任务台账。

  触发场景：
  - 头脑风暴/需求已定，要拆成可执行的实施计划
  - add-todo 的一句话待办太粗，需要细到"文件+命令+验收"
  - 复杂功能开发前，先出一份可被 /dev 自主执行的任务台账
  - 把 docs/需求文档.md / docs/brainstorm-*.md 落成 docs/tasks/active 任务卡

  触发词：写计划、制定计划、实施计划、拆解任务、任务拆解、计划层、把方案落地、详细步骤、可执行计划、计划文档、writing-plans、开发计划、实施方案
---

# 计划层（writing-plans）指南

## 概述

本技能是框架 SDLC 链路上的「计划层」，补齐 `brainstorm`（产出方案）与 `/dev`、`/crud`（执行）之间长期缺失的一环。

```
brainstorm(方案)  →  【writing-plans(计划)】  →  /dev、/crud(执行)  →  /progress(聚合)
```

它把"方案级文档"翻译成**可被人或 `/dev` 直接执行的细颗粒计划**：每个任务带精确文件路径、2-5 分钟勾选步骤、验证命令、规范提交信息。**产物落 `docs/tasks/active/*.md`**（复用 task-tracker 台账），从而 `/progress`、`/update-status` 无需任何改造即可聚合，`/dev` 直接消费。

> **本技能采用"契约式细颗粒计划"，并做了本框架适配**：不照搬"所有任务都写完整代码"（那对 CRUD 是浪费、与代码生成器重复、且会生成违规代码），改为"颗粒度反比于框架自动生成程度"。

> 🔴 **本技能的方法论（把方案拆成可执行计划）是框架无关的；但每条任务里注入的"框架约束/路径/验证命令"必须严格对齐 base-dev-framework6-java**。脱离这些约束，生成出来的代码就不符合本仓库规约。

---

## 何时用 / 何时不用

| 场景 | 用本技能? | 改用 |
|------|:---:|------|
| 方案已定，要拆成可执行计划 | ✅ | - |
| 复杂多步/跨模块功能开发前 | ✅ | - |
| 还在发散、不知道怎么做 | ❌ | `brainstorm` |
| 单条小事/Bug 修复/小改动 | ❌ | `/add-todo` |
| 计划已就位，要开始执行 | ❌ | `/dev` 或 `/crud` |
| 只是要个任务台账容器/格式 | ❌（本技能负责"内容"，不只是容器） | `task-tracker` |

---

## 核心原则：颗粒度 = 反比于「框架自动生成程度」

本框架有代码生成器（`ruoyi-gen`，FreeMarker `fm/` 模板）+ 24 个 common 公共能力模块，**大量代码不该由计划层重写**。

| 两端 | 毛病 |
|------|------|
| add-todo（太粗） | 只有一句话"做什么"，执行时还要现想文件/命令/验收 |
| 全量写完整代码（太细） | 每个任务都写满完整代码 → 对 CRUD 浪费、与生成器重复、易写出不合 `org.dromara` 规约的代码 |

**甜点 = 能生成器生成的只编排、不写代码；框架不生成的才写代码骨架。**

### 颗粒度判定表

| 任务类型 | 框架自动生成? | 颗粒度 | 计划写什么（≠重写代码） |
|---------|:---:|:---:|---|
| 建表 DDL | 半自动 | 中 | 完整建表 SQL（雪花ID/审计字段/`del_flag`/`tenant_id`（如启用多租户））+ 字典项清单 |
| 标准 CRUD 后端（Entity~Controller~Mapper） | ✅ 全自动 生成器/`/crud` | 粗·编排 | "在 gen 配置表 → 调 `/crud` 或代码生成器 → 校验三层生成"，**不写 Java** |
| 标准 CRUD 前端（api.ts/types.ts/列表页/表单） | ✅ 半自动 | 粗·编排 | "按 generator `fm/` 模板/约定产出 api.ts/types.ts/index.vue\|tsx"，**不逐行写、不硬编码 plus-ui 路径** |
| 非 CRUD 后端逻辑（自定义 Service/事件/回调/算法） | ❌ | 细·骨架 | 方法签名 + 关键实现骨架 + 为什么 + 复用哪个 common 模块 |
| 第三方集成（ai/mcp/sms/oss/mqtt…） | ❌ | 细·骨架 | 接口 + 实现类 + 配置项 + 复用 common + 失败降级 |
| 复杂查询/统计 | ❌ | 细·骨架 | Service 层 `QueryBuilder.lambda(Entity.class)` 写法 + `eqIfText/likeIfText/betweenParams` + SQL 骨架 |
| 定制 UI 页（大屏/工作台/图表，非标准 CRUD） | ❌ | 细·转码 | 引用 `docs/prototypes/*.html` → `html-to-code` + 组件映射 + e2e 截图门 |
| 权限/菜单/字典配置 | 半自动 | 中 | 菜单 SQL + 权限标识 `${module}:${business}:${action}` + 字典项清单 |
| 跨模块调用/契约 | ❌ | 中·骨架 | 在 `ruoyi-api` 定接口契约（接口 + DTO/Model/Event），业务模块实现 |

---

## 输入与输出

### 输入（每次必读，不可凭记忆）
1. `docs/需求文档.md` —— 需求（只读）
2. `docs/brainstorm-*.md` —— 已确定的方案（若有）
3. `CLAUDE.md` / `AGENTS.md` —— 框架模块 vs 业务模块边界（**别动框架公共模块**）
4. 参考代码（真实存在的标准模块）：
   - 后端三层：`ruoyi-modules/ruoyi-system`（带数据权限/MPJ 的复杂样板）、`ruoyi-modules/ruoyi-demo`（标准单表样板）
   - 公共能力：`ruoyi-common/ruoyi-common-mybatis`（QueryBuilder/BaseMapperPlus）等 24 个子模块
   - 生成器模板：`ruoyi-modules/ruoyi-gen/src/main/resources/fm/`（`fm/java/*.ftl`、`fm/vue/*.ftl`、`fm/react/*.ftl`）
   - 前端工程 plus-ui 在**仓库内 `plus-ui/` 目录**——计划里前端步骤写"按 generator 模板/约定产出 api.ts/types.ts/index.vue|tsx 放入 `plus-ui/src` 对应目录"

### 输出
- 写入 `docs/tasks/active/task-{YYYYMMDD-HHMMSS}-{业务简称}.md`
- **复用 task-tracker 富模板**（需求/方案/实现步骤/关键决策/当前进度/变更记录）
- 「实现步骤」区即可执行计划，`/dev`、`/crud` 逐条消费、回写 `[x]`

> 不另起 `docs/plans/` 目录——落 `docs/tasks/active/` 才能让 `/progress`、`/update-status` 零改造聚合。

---

## 计划头部模板（契约头）

每份计划开头必须有：

```markdown
## 计划契约头
- **目标**：{一句话}
- **架构**：{2-3 句：模块归属、三层落点、关键技术}
- **技术栈**：{涉及的 common 模块 / 框架能力}
- **模块归属**：ruoyi-modules/ruoyi-{module}（包 org.dromara.{module}）
- **跨模块契约**：{若需被其它模块调用，先在 ruoyi-api 定接口；否则填"无"}
- **端支持**：PC 后台（plus-ui，仓库内 `plus-ui/`；Vue=Element Plus / React=Ant Design Pro）
- **文件清单表**：

| 文件 | 操作 | 负责什么 |
|------|------|---------|
| `ruoyi-modules/ruoyi-{module}/.../domain/Xxx.java` | 新增 | 实体（extends BaseEntity） |
| `ruoyi-modules/ruoyi-{module}/.../controller/XxxController.java` | 新增 | 接口入口（标准 REST） |
| `（仓库内 plus-ui/）按 fm/vue 约定的 api/xxx.ts` | 新增 | 前端 API（写入 `plus-ui/src/api`） |
| ... | | |
```

---

## 任务条目标准结构（无论粗细都必带）

```markdown
- [ ] N. {任务标题}（类型：CRUD编排 / 非CRUD骨架 / UI转码 / 配置 / 跨模块契约）
  - 文件：{精确路径，只落业务目录；前端用"按 fm/ 约定产出"描述，不硬编码 plus-ui 路径}
  - 框架约束：{该任务相关的 框架规约提醒}
  - 步骤：{2-5 分钟勾选粒度}
  - 验证：{mvn -pl ruoyi-modules/ruoyi-{module} -am -DskipTests compile（Java 21）；前端如需则"在 plus-ui 前端仓库 type-check/build"}
  - 提交：{feat/fix(scope): ...}
  - 依赖：{前置任务编号}
```

---

## 🔴 框架约束注入清单（适配 框架的命门）

计划生成的每段代码/编排都必须遵守。**这是本框架计划层的命门——脱离这些约束，生成的"完整代码"会违规。**

### 后端（Java，框架约定）
- 包名 `org.dromara.{module}`（**禁 `com.ruoyi`、禁 `plus.ruoyi`**）
- **三层无 DAO**：Controller → Service（`implements IXxxService`，**禁 `extends ServiceImpl`**，且 **没有 DAO 层**）→ Mapper（`extends BaseMapperPlus<Entity, Vo>`）
- 查询条件写在 **Service 层**：`QueryBuilder.lambda(Entity.class)`（联表 `QueryBuilder.lambdaJoin("u", Entity.class)`）；条件辅助 `eqIfText` / `likeIfText` / `eqIfPresent` / `inIfNotEmpty` / `betweenParams`（**禁 DAO `buildQueryWrapper`、禁 `PlusLambdaQuery`/`likeCast`**）
- 分页：`Page<Vo> r = xxxMapper.selectVoPage(pageQuery.build(), lqw); return PageResult.build(r.getRecords(), r.getTotal());`（`PageQuery` + `PageResult`）
- Entity `extends BaseEntity`（`org.dromara.common.mybatis.core.domain.BaseEntity`）；`@Data` + `@EqualsAndHashCode(callSuper=true)` + `@TableName`；主键 `@TableId`、雪花 ID（**禁 `AUTO_INCREMENT`**）；逻辑删除字段 `del_flag` + `@TableLogic`（**禁 `is_deleted`**）；乐观锁 `@Version`（如有）
- BO：`implements Serializable` + `@AutoMapper(target=Entity.class, reverseConvertGenerate=false)`（**禁 `@AutoMappers`**）；日期范围保留 `params = new HashMap<>()`；分组校验 `AddGroup/EditGroup/QueryGroup`
- VO：`implements Serializable` + `@AutoMapper(target=Entity.class)`；导出对象 `@ExcelIgnoreUnannotated` + `@ExcelProperty/@ExcelDictFormat`（仅导入导出）；ID→名称用 `@Translation(...)`
- 对象转换 `MapstructUtils.convert(bo, Entity.class)`（**禁 `BeanUtil.copyProperties`**）
- API 路径**标准 REST**：`GET /list`、`GET /{id}`、`POST`、`PUT`、`DELETE /{ids}`、`POST /export`（树表 `list` 不分页）（**禁 `/pageXxxs`、`/getXxx/{id}`、`/addXxx`**）
- 返回具体 VO（**禁 `Map<String,Object>`**）；Controller 返回 `R<T>`/`R<Void>`，`extends BaseController`
- Controller 类上 `@Validated @RestController @RequiredArgsConstructor @RequestMapping`；权限 `@SaCheckPermission("${module}:${business}:${action}")`；写操作 `@Log(title, businessType)`；防重 `@RepeatSubmit`；分组校验 `@Validated(AddGroup.class)`
- **先 import 再用短类名**（禁内联全限定名）
- 普通 CRUD 用简洁 JavaDoc（说"做什么"+ 关键参数语义）
- 业务异常 `ServiceException`
- 跨模块调用走 `ruoyi-api` 暴露的接口契约（如 `UserService`/`WorkflowService`），**不直接 import 另一个业务模块的实现类**

### 前端 PC（plus-ui，仓库内 `plus-ui/`，代码生成器产物）
- 前端栈由 `gen_table.frontend_type` 决定，对应 `fm/<type>/` 模板目录：`vue`（Element Plus）/ `react`（Ant Design Pro）
- **Vue**：`<script setup lang="ts">` + Element Plus `el-*` 原生组件；新版生成器用 hooks（`useLoading`/`useSearchToggle`/`useFormDialog`/`useDateRangeQuery`）；字典 `toRefs<any>(useDict(...))`；权限指令 `v-hasPermi=['module:business:add']`；复用 `right-toolbar/pagination/dict-tag` 等（**禁 reference 定制版的 `A*` 封装组件如 AFormInput/AModal/ASearchForm**）
- **React**：`antd` + `@ant-design/pro-components`（ProTable/ModalForm/PageContainer）+ `ahooks`
- API 文件：`request` from `@/utils/request`、`AxiosPromise` from `@/utils/api-types`、`PageResult` from `@/api/types`；命名 `listXxx/getXxx/addXxx/updateXxx/delXxx` 对应 `GET /list、GET /{id}、POST、PUT、DELETE /{ids}`（**禁 reference 定制版 `[err, data] = await` 调用与 `pageXxxs` 命名**）
- 类型文件：`VO/Form/Query`；`Form` 继承 `BaseEntity`，非树表 `Query` 继承 `PageQuery`；ID 用 `string|number`
- 计划里前端步骤**只描述"按 fm/vue 或 fm/react 模板/约定产出 api.ts/types.ts/index.vue|tsx"**，**不写 plus-ui 具体路径硬编码**

> 🔴 **本框架不含移动端**（用户选择不含 uniapp）：计划里**禁出现** plus-uniapp / plus-app / `@/wd` / `wd-*` / `wot-design` / `uni.showToast` / `rpx` 等移动端约定。

### 通用
- 文件只落业务目录：`ruoyi-modules/ruoyi-{module}/`（业务模块）；**不动框架公共模块**（`ruoyi-common/*`、`ruoyi-admin`、`ruoyi-api`(契约层除外)、`ruoyi-system`、`ruoyi-gen`、`ruoyi-extend/*`）
- UTF-8 无 BOM；LF；Java 4 空格、JSON/YAML 2 空格；东八区时间；不按名杀宿主进程；规范 commit `feat/fix(scope)`

---

## UI 任务的原型处理

`writing-plans` **不产 HTML、不手搓原型**。

- 原型**已存在**（brainstorm/kickoff 经工作站 ui-studio 产出 `docs/prototypes/*.html`）→ 计划步骤 = `用 html-to-code 把 docs/prototypes/X.html 转成 plus-ui（Vue/React）页面 + e2e 截图对照原型`。
- 原型**不存在** → 计划**回标一步**「先走 brainstorm/工作站 ui-studio 出原型」，不让 writing-plans 或 dev 现编 HTML。

---

## 验证门（复用 /dev、/check，不自定义）

- 后端编译（受影响模块）：`mvn -pl ruoyi-modules/ruoyi-{module} -am -DskipTests compile`（**Java 21**）
- 后端全量编译（必要时）：`mvn -DskipTests compile`
- 前端：plus-ui 在**仓库内 `plus-ui/` 目录**，可写 **`pnpm -C plus-ui install` / `pnpm -C plus-ui build`** 等前端命令进行构建验证。
- UI 任务额外过「e2e 截图保真闭环」（复用 `e2e-test-pc`）

---

## 实战示例

### 示例 1：标准 CRUD（粗·编排，不写代码）

> 需求：优惠券模板管理（coupon_template），PC 后台 CRUD，归属新业务模块 ruoyi-mall。

```markdown
- [ ] 1. 建表 + 字典（类型：配置）
  - 文件：`scripts/sql/` 下建表脚本（或交给生成器导入）
  - 框架约束：雪花ID、审计字段（create_by/create_time/update_by/update_time）、del_flag 逻辑删除、如启用多租户加 tenant_id
  - 步骤：写 coupon_template 建表 SQL；加字典 coupon_type（满减/折扣）
  - 验证：SQL 在本地库执行通过
  - 提交：feat(mall): 优惠券模板建表与字典
  - 依赖：无

- [ ] 2. 后端三层 CRUD（类型：CRUD编排）
  - 文件：`ruoyi-modules/ruoyi-mall/src/main/java/org/dromara/mall/.../couponTemplate/*`（生成器产出）
  - 框架约束：包名 org.dromara.mall、Entity extends BaseEntity、Mapper extends BaseMapperPlus<Entity,Vo>、Service implements IXxxService（不继承 ServiceImpl、无 DAO）、查询在 Service 用 QueryBuilder.lambda、标准 REST 路径
  - 步骤：在 gen 配置 coupon_template 表 → 调 `/crud` 或代码生成器（FreeMarker fm/java）生成 Entity/BO/VO/Mapper/IService/ServiceImpl/Controller → 校验三层完整、无 DAO、路径为 GET /list 等标准 REST
  - 验证：`mvn -pl ruoyi-modules/ruoyi-mall -am -DskipTests compile`
  - 提交：feat(mall): 优惠券模板后端 CRUD
  - 依赖：1

- [ ] 3. PC 前端页面（类型：CRUD编排）
  - 文件：（仓库内 plus-ui/）按 generator fm/vue（或 fm/react）模板/约定产出 couponTemplate 的 api.ts / types.ts / index.vue|tsx
  - 框架约束：Vue 用 Element Plus el-* + hooks（useFormDialog/useDateRangeQuery）、v-hasPermi；API 命名 listXxx/getXxx/addXxx/updateXxx/delXxx；types 含 VO/Form/Query
  - 步骤：代码生成器一并产出 api/types/index → 列表页 + 表单弹窗 → 与后端标准 REST 联调
  - 验证：在 plus-ui 前端仓库执行 type-check / build（本后端仓库无前端命令）
  - 提交：feat(mall): 优惠券模板管理页
  - 依赖：2
```

### 示例 2：非 CRUD 业务逻辑（细·骨架，写代码）

> 需求：用户领券（高并发、防超发、防重复领取）。

```markdown
- [ ] 4. 领券服务（类型：非CRUD骨架）
  - 文件：`ruoyi-modules/ruoyi-mall/src/main/java/org/dromara/mall/service/impl/CouponReceiveServiceImpl.java`
  - 框架约束：org.dromara.mall、implements ICouponReceiveService（无 DAO）、复用 ruoyi-common-redis(RedisUtils/RLock)、MapstructUtils.convert、ServiceException、先 import 再短类名
  - 步骤（骨架）：
    ```
    // 复用 RedisUtils 分布式锁 + Lua 原子扣减库存
    RLock lock = RedisUtils.getClient().getLock("coupon:receive:" + templateId);
    try {
        if (!lock.tryLock(...)) throw new ServiceException("领取太频繁");
        // 1. 校验是否已领（Service 用 QueryBuilder.lambda 查 coupon_record）→ 已领抛 ServiceException
        // 2. Lua 原子扣库存：不足抛 ServiceException
        // 3. MapstructUtils.convert 写 coupon_record（雪花ID、BaseEntity 审计字段自动填充）
    } finally { if (lock.isHeldByCurrentThread()) lock.unlock(); }  // 必须 finally 释放
    ```
  - 验证：`mvn -pl ruoyi-modules/ruoyi-mall -am -DskipTests compile`；并发测试
  - 提交：feat(mall): 用户领券防超发与防重复
  - 依赖：1,2
```

### 示例 3：定制 UI 页（细·转码，引用原型）

> 需求：PC 端"营销数据看板"（非标准 CRUD，需视觉还原）。

```markdown
- [ ] 5. 营销看板页（类型：UI转码）
  - 文件：（仓库内 plus-ui/）按约定产出 marketing/dashboard 页（Vue=Element Plus / React=AntD Pro）
  - 前置：原型 `docs/prototypes/marketing/dashboard.html`（若缺 → 先走 brainstorm/工作站 ui-studio 补，本任务挂起）
  - 框架约束：Vue 用 el-* 原生组件（禁 A* 封装）；API 命名 listXxx/getXxx；请求走 @/utils/request
  - 步骤：html-to-code 转 dashboard.html → 套 Element Plus 图表/卡片布局 → 接后端统计 API
  - 验证：在 plus-ui 前端仓库 type-check / build；**e2e 截图对照原型**（e2e-test-pc）
  - 提交：feat(mall): 营销数据看板页
  - 依赖：4
```

### 示例 4：跨模块契约（中·骨架，先定 api）

> 需求：mall 模块下单时要校验用户状态，需调用 system 模块的用户能力。

```markdown
- [ ] 6. 跨模块用户校验契约（类型：跨模块契约）
  - 文件：`ruoyi-api/.../system/api/`（接口契约，若已有 UserService 则直接复用）
  - 框架约束：跨模块走 ruoyi-api 接口契约（接口 + DTO/Model），不直接 import ruoyi-system 实现类
  - 步骤：确认 ruoyi-api 是否已暴露所需用户查询接口 → 缺则在 ruoyi-api 定接口 + DTO，ruoyi-system 实现 → mall 注入接口调用
  - 验证：`mvn -pl ruoyi-modules/ruoyi-mall -am -DskipTests compile`
  - 提交：feat(mall): 下单用户状态校验（经 ruoyi-api 契约）
  - 依赖：2
```

---

## 与体系衔接 / 关联技能边界

| 关系对象 | 边界 |
|---------|------|
| `brainstorm` | 上游：产"方案"；本技能读 `docs/brainstorm-*.md` 拆"计划" |
| `task-tracker` | 容器：本技能复用其模板/落点；task-tracker=台账格式，writing-plans=细颗粒计划生产者 |
| `/dev`、`/crud` | 下游：计划落 `docs/tasks/active/`，逐条执行回写；CRUD 任务**编排调用代码生成器**，本技能不重造 codegen |
| `/progress`、`/update-status` | 已扫描 `docs/tasks/active/`，零改造聚合 |
| `/check` | 执行后过全栈规范检查（对齐本约束清单） |
| `/add-todo` | add-todo=单条快速待办；writing-plans=成体系计划，并存不冲突 |
| `html-to-code` | UI 任务引用，本技能不产 HTML |
| `crud-development` | 标准 CRUD 的详细 6.x 规约与 fm/ 模板说明在该技能，本技能只编排不重述 |

**链路**：`brainstorm` 定方案 → `writing-plans` 拆计划入 `docs/tasks/active/` → `/crud`、`/dev` 执行 → 里程碑 `/progress` 聚合。

---

## 常见错误与最佳实践

### ❌ 错误 1：给标准 CRUD 写完整代码
把标准 CRUD 的 Entity/Service/Controller 全写进计划 → 与代码生成器重复、易违规。
✅ **正确**：CRUD 只写"在 gen 配表 → 调 /crud 或生成器 → 校验三层"的编排步骤。

### ❌ 错误 2：注入了错误的框架约束（沿用 reference 定制版）
计划里写 `com.ruoyi`/`plus.ruoyi`、DAO 层、`extends ServiceImpl`、`buildQueryWrapper`、`PlusLambdaQuery`/`likeCast`、`TenantEntity`、`is_deleted`、`/pageXxxs`、`A*` 组件、`@/wd` → 全是 reference 定制版约定，在本项目（遵循 框架约定）里**都错**。
✅ **正确**：每个任务带"框架约束"行，照本技能 框架「约束注入清单」（`org.dromara`、三层无 DAO、Service 层 QueryBuilder、BaseEntity、del_flag、标准 REST、el-*）。

### ❌ 错误 3：自己产 HTML 充原型
在计划里手搓 HTML 或让 dev 现编页面 → 违反 CLAUDE.md。
✅ **正确**：引用 `docs/prototypes/*.html`（工作站产）走 html-to-code；缺则回标补原型。

### ❌ 错误 4：计划落错目录
写到 `docs/plans/` 或散文档 → `/progress` 聚合不到、`/dev` 找不到。
✅ **正确**：一律落 `docs/tasks/active/*.md`。

### ❌ 错误 5：任务颗粒度失衡
非 CRUD 复杂逻辑只写一句话，或给配置类任务写满代码。
✅ **正确**：照"颗粒度判定表"——反比于框架自动生成程度。

### ❌ 错误 6：写本仓库不存在的前端命令/路径
计划里写移动端（plus-uniapp/plus-app）步骤 → 本项目**不含移动端**。plus-ui 在仓库内 `plus-ui/` 目录，可正常写 `pnpm -C plus-ui build` 等命令。
✅ **正确**：前端步骤写"按 fm/vue|fm/react 约定产出 api.ts/types.ts/index.vue|tsx"，验证写"在 plus-ui 前端仓库 type-check/build"，不出现任何移动端约定。

---

## 双系统同步

本技能为 Skill，须同步 Codex 镜像（按 `add-skill` 规范）：
- 主：`.claude/skills/writing-plans/SKILL.md`
- 镜像：`.codex/skills/writing-plans/SKILL.md`（内容完全相同，`diff` 无差异）
- 登记：`.claude/hooks/skill-forced-eval.cjs` 技能列表 + `AGENTS.md` 技能表
- 多租户：默认 Entity `extends BaseEntity`；模块若启用多租户隔离，按 6.x `multi-tenant` 技能约定追加 `tenant_id` 与租户处理，不在本技能默认写死。
