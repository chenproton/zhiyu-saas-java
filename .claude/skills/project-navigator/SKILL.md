---
name: project-navigator
description: |
  base-dev-framework6-java项目结构导航与代码定位向导。帮助快速理解多模块拓扑、判断"某类东西放在哪个模块"、"我要找 X 该去哪个目录"，并提供标准 CRUD 模块内部结构与真实参考代码位置。

  触发场景：
  - 不知道某个文件/类在哪个模块，想快速定位（工具类、缓存、权限、配置、SQL、代码生成模板等）
  - 想了解整体项目结构、各模块职责、模块之间的依赖与边界
  - 准备新建一个业务模块，但不确定该放进 ruoyi-system 还是新建 ruoyi-xxx
  - 想找一段标准参考代码（标准 CRUD 模块长什么样、跨模块接口怎么暴露）
  - 想搞清楚 ruoyi-common / ruoyi-modules / ruoyi-api / ruoyi-extend 各装什么

  触发词：项目结构、文件在哪、目录、模块、代码位置、找、定位、在哪里、哪个文件、参考代码、模块职责、ruoyi-common、ruoyi-modules、ruoyi-api、ruoyi-extend、ruoyi-gen、放哪、新建模块、结构导航
---

# project-navigator · base-dev-framework6-java 项目结构导航

> 本技能只负责"导航与定位"——告诉你某类代码住在哪个模块、哪个目录、参考哪个真实文件。
> 具体怎么写 CRUD、怎么用缓存/权限/翻译，请激活对应的专项技能（crud-development / redis-cache / security-guard 等）。

## 一、概述

本项目 base-dev-framework6-java 是采用 Spring Boot 4.1.0 + JDK 21 的多模块 Maven 单体后端。
工程根 `pom.xml` 为聚合 `pom`，下挂 5 个一级模块：`ruoyi-admin` / `ruoyi-api` / `ruoyi-common` / `ruoyi-modules` / `ruoyi-extend`。
另有非 Java 资源目录 `script/`（SQL、Docker、启动脚本）。

记住三条主线，定位八九不离十：

1. **能力住 `ruoyi-common`**（缓存、权限、日志、Excel、OSS、翻译…，共 24 个子模块）。
2. **业务住 `ruoyi-modules`**（system / ai / workflow / job / gen / demo）。
3. **对外契约住 `ruoyi-api`**（跨模块调用只认这里的接口 + DTO + Event，不直接 import 别的业务模块实现类）。

启动入口、运行配置（`application*.yml`）在 `ruoyi-admin`；外置独立 Server（监控、调度、AI 服务端）在 `ruoyi-extend`。

> 6.x 铁律（导航时务必牢记）：
> - 根包是 **`org.dromara`**，**不是** `com.ruoyi`、**不是** `plus.ruoyi`。
> - 后端是 **三层（Controller / Service+Impl / Mapper）**，**没有 DAO 层**，不存在 `buildQueryWrapper()` 那套 DAO 写法。
> - 前端在**仓库内 `plus-ui/` 目录**（Vue3 + Element Plus）。本项目含 Java 后端 + 仓库内前端 + 代码生成器内置的前端模板（`ruoyi-gen/.../fm/vue|react`）。

## 二、模块拓扑（每个模块"放什么"）

```
base-dev-framework6-java (root pom)
├── ruoyi-admin                       # ★唯一可执行入口（Spring Boot repackage）
│   └── src/main
│       ├── java/org/dromara/web      #   登录/认证 Web 层：controller / service / event / listener / domain.vo
│       └── resources                 #   application.yml / -dev / -prod、logback-plus.xml、banner.txt、i18n/、ip2region_v4.xdb
│
├── ruoyi-api                         # ★跨模块 API 契约层（仅依赖 common-core，业务模块来实现）
│   └── src/main/java/org/dromara
│       ├── system/api                #   ConfigService/DeptService/OssService/UserService… 接口 + domain(DTO) + model(LoginUser/*LoginBody)
│       └── workflow/api              #   WorkflowService 接口 + domain(StartProcessDTO…) + event(ProcessEvent)
│
├── ruoyi-common                      # 24 个公共能力子模块（由 ruoyi-common-bom 聚合版本）
│   ├── ruoyi-common-bom              #   依赖版本聚合（不含代码）
│   ├── ruoyi-common-core             #   ★基础：utils/、constant/、exception/、domain(R/PageQuery…)、enums/、validate/、xss/
│   ├── ruoyi-common-web              #   Web 通用：advice(全局异常)、filter、interceptor、handler、config
│   ├── ruoyi-common-mybatis          #   ★ORM：BaseEntity/BaseMapperPlus、QueryBuilder、PageResult、数据权限切面、MyBatis-Plus 配置
│   ├── ruoyi-common-redis            #   ★缓存：RedisUtils/CacheUtils、@RateLimiter、@RepeatSubmit、Redisson 配置
│   ├── ruoyi-common-satoken          #   ★认证：LoginHelper、SaTokenConfig、SaPermissionImpl（Sa-Token 鉴权）
│   ├── ruoyi-common-security         #   安全：权限注解处理、登录用户工具
│   ├── ruoyi-common-log              #   ★操作日志：@Log 注解、LogAspect、操作日志事件
│   ├── ruoyi-common-doc              #   接口文档：SpringDoc / Swagger 配置
│   ├── ruoyi-common-excel            #   Excel 导入导出（基于 Apache FESOD（fesod-sheet））
│   ├── ruoyi-common-oss              #   对象存储抽象：本地/阿里云/腾讯/七牛/MinIO
│   ├── ruoyi-common-json             #   JSON 序列化增强（JsonUtils、大数字精度、日期）
│   ├── ruoyi-common-encrypt          #   字段加解密 @EncryptField / 接口加密 @ApiEncrypt
│   ├── ruoyi-common-sensitive        #   数据脱敏 @Sensitive
│   ├── ruoyi-common-translation      #   ★翻译：@Translation + TranslationInterface（ID 转名称/字典转标签）
│   ├── ruoyi-common-mail             #   邮件 MailUtils
│   ├── ruoyi-common-sms              #   短信（多厂商 SmsFactory）
│   ├── ruoyi-common-social           #   第三方登录（JustAuth）
│   ├── ruoyi-common-ai               #   ★6.x 新增：AI 能力公共封装
│   ├── ruoyi-common-mcp              #   ★6.x 新增：MCP（Model Context Protocol）支持
│   ├── ruoyi-common-elasticsearch    #   ★6.x 新增：ES 检索公共封装
│   ├── ruoyi-common-mqtt             #   ★6.x 新增：MQTT 物联网消息
│   ├── ruoyi-common-push             #   ★6.x 新增：统一消息推送（WebSocket/SSE 等）
│   └── ruoyi-common-job              #   SnailJob 任务公共封装
│
├── ruoyi-modules                     # 业务模块
│   ├── ruoyi-system                  #   ★系统管理：用户/角色/菜单/部门/字典/配置/OSS/通知…（重数据权限 + MPJ）
│   ├── ruoyi-ai                      #   ★Snail AI 接入（SnailAiController 等）
│   ├── ruoyi-workflow                #   Warm-Flow 工作流（流程定义/任务/实例）
│   ├── ruoyi-job                     #   SnailJob 业务任务
│   ├── ruoyi-gen                     #   ★代码生成器（FreeMarker 模板 + 多前端栈，gen profile 按需启用）
│   └── ruoyi-demo                    #   示例模块（TestDemo 标准 CRUD、MCP server/client、队列、ES 示例）
│
├── ruoyi-extend                      # ★外置独立 Server（与主应用分开部署）
│   ├── ruoyi-monitor-admin           #   Spring Boot Admin 监控端
│   ├── ruoyi-snailjob-server         #   SnailJob 调度服务端
│   └── ruoyi-snailai-server          #   Snail AI 服务端（管模型/应用/Key）
│
└── script                            # 非 Java 资源
    ├── sql                           #   ★数据库脚本：ry_vue.sql / ry_job.sql / ry_workflow.sql / ry_ai.sql + oracle/postgres/sqlserver/
    ├── docker                        #   docker-compose.yml / database.yml / nginx / redis
    └── bin                           #   ry.bat / ry.sh 启动脚本
```

## 三、"我要找 X 去哪"映射表

| 我要找 / 我要改 | 去哪个模块 / 目录 | 真实路径示例（相对工程根） |
|----------------|-------------------|----------------------------|
| **通用工具类**（字符串/日期/集合/对象转换/树） | `ruoyi-common-core` → `utils/` | `ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/utils/` |
| **统一响应 `R<T>`** | `ruoyi-common-core` → `core/domain/` | `ruoyi-common/ruoyi-common-core/.../core/domain/` |
| **分页 `PageQuery`** | `ruoyi-common-mybatis` → `core/page/` | `ruoyi-common/ruoyi-common-mybatis/.../core/page/` |
| **业务异常 `ServiceException`** | `ruoyi-common-core` → `exception/` | `ruoyi-common/ruoyi-common-core/.../core/exception/` |
| **缓存 / 分布式锁 / 限流注解** | `ruoyi-common-redis` | `ruoyi-common/ruoyi-common-redis/.../RedisUtils.java`、`CacheUtils.java`、`RateLimiter.java` |
| **认证 / 登录用户 / Sa-Token** | `ruoyi-common-satoken` | `ruoyi-common/ruoyi-common-satoken/.../LoginHelper.java`、`SaTokenConfig.java` |
| **数据权限 / BaseEntity / QueryBuilder / 分页结果** | `ruoyi-common-mybatis` | `ruoyi-common/ruoyi-common-mybatis/.../core/` |
| **全局异常处理 / Web 拦截器 / 过滤器** | `ruoyi-common-web` → `advice/` `interceptor/` `filter/` | `ruoyi-common/ruoyi-common-web/.../common/web/advice/` |
| **操作日志 `@Log` / 切面** | `ruoyi-common-log` | `ruoyi-common/ruoyi-common-log/...` |
| **翻译 `@Translation`（ID→名称）** | `ruoyi-common-translation` | `ruoyi-common/ruoyi-common-translation/...` |
| **脱敏 `@Sensitive` / 加密 `@EncryptField`** | `ruoyi-common-sensitive` / `ruoyi-common-encrypt` | `ruoyi-common/ruoyi-common-sensitive/...` |
| **Excel 导入导出** | `ruoyi-common-excel` | `ruoyi-common/ruoyi-common-excel/...` |
| **文件 / 对象存储 OSS** | `ruoyi-common-oss` | `ruoyi-common/ruoyi-common-oss/...` |
| **短信 / 邮件 / 消息推送** | `ruoyi-common-sms` / `-mail` / `-push` | `ruoyi-common/ruoyi-common-sms/...` |
| **某业务功能**（用户/角色/菜单/字典/配置等） | `ruoyi-modules/ruoyi-system` | `ruoyi-modules/ruoyi-system/src/main/java/org/dromara/system/` |
| **AI 对话功能** | `ruoyi-modules/ruoyi-ai`（+ `ruoyi-common-ai`） | `ruoyi-modules/ruoyi-ai/...` |
| **工作流 / 审批流** | `ruoyi-modules/ruoyi-workflow` | `ruoyi-modules/ruoyi-workflow/...` |
| **定时 / 业务任务** | `ruoyi-modules/ruoyi-job`（+ `ruoyi-common-job`） | `ruoyi-modules/ruoyi-job/...` |
| **代码生成器逻辑** | `ruoyi-modules/ruoyi-gen` → `gen/` | `ruoyi-modules/ruoyi-gen/src/main/java/org/dromara/gen/` |
| **代码生成器模板（FreeMarker）** | `ruoyi-gen/.../resources/fm/` | `ruoyi-modules/ruoyi-gen/src/main/resources/fm/{java,vue,react,sql,xml}/*.ftl` |
| **跨模块对外接口 / DTO / Event** | `ruoyi-api` | `ruoyi-api/src/main/java/org/dromara/system/api/`、`.../workflow/api/` |
| **SQL 初始化脚本** | `script/sql` | `script/sql/ry_vue.sql`、`ry_job.sql`、`ry_workflow.sql`、`ry_ai.sql` |
| **运行配置 / 多环境 / 日志配置** | `ruoyi-admin/src/main/resources` | `ruoyi-admin/src/main/resources/application.yml`、`application-dev.yml`、`logback-plus.xml` |
| **登录 / 认证 Web 入口** | `ruoyi-admin` → `web/` | `ruoyi-admin/src/main/java/org/dromara/web/controller/` |
| **Mapper XML（自定义 SQL）** | 对应模块 `resources/mapper/{模块}/` | `ruoyi-modules/ruoyi-system/src/main/resources/mapper/system/`、`.../demo/TestDemoMapper.xml` |
| **监控 / 调度 / AI 服务端** | `ruoyi-extend` | `ruoyi-extend/ruoyi-monitor-admin`、`ruoyi-snailjob-server`、`ruoyi-snailai-server` |
| **Docker / Nginx / Redis 部署文件** | `script/docker` | `script/docker/docker-compose.yml`、`nginx/conf/nginx.conf` |

> 拿不准时的定位口诀：**"是能力（横切）还是业务？"** —— 能跨业务复用的 → `ruoyi-common-*`；
> 跟具体业务表强绑定的 → `ruoyi-modules/ruoyi-xxx`；要被别的模块调用的接口 → `ruoyi-api`。

## 四、标准 CRUD 模块内部结构

一个标准业务表（如 `system`、`demo` 模块里的单表），其 Java 代码按以下七类摆放（**包根 `org.dromara`，无 DAO 层**）：

```
org/dromara/{module}/
├── domain/Entity.java            # 实体，extends BaseEntity（org.dromara.common.mybatis.core.domain.BaseEntity）
│                                 #   @TableName / @TableId / @Version 乐观锁 / @TableLogic 逻辑删除
├── domain/bo/EntityBo.java       # 业务对象（入参），@AutoMapper(target=Entity)、带分组校验注解 @NotBlank(groups=AddGroup)
├── domain/vo/EntityVo.java       # 视图对象（出参），@AutoMapper(target=Entity)、可挂 @Translation / @Sensitive / @ExcelProperty
├── mapper/EntityMapper.java      # extends BaseMapperPlus<Entity, EntityVo>（复杂模块再叠加 MPJBaseMapper<Entity>）
├── service/IEntityService.java   # Service 接口
├── service/impl/EntityServiceImpl.java  # @RequiredArgsConstructor @Service；BO→Entity 用 MapstructUtils.convert；实现 IEntityService（不继承 ServiceImpl 基类）
└── controller/EntityController.java     # extends BaseController；返回 R<T>/R<Void>；方法挂 @SaCheckPermission + @Log + @RepeatSubmit
```

复杂模块还会出现这些"配套"目录（可选）：

```
org/dromara/{module}/
├── event/        # 领域事件（如 OssConfigChangeEvent）
├── listener/     # 事件监听器（如 OssConfigChangeListener）
├── runner/       # 启动后初始化（ApplicationRunner）
└── resources/mapper/{module}/EntityMapper.xml   # 需要手写复杂 SQL 时的 XML（与 Java Mapper 配对）
```

生成器默认方法集合：`queryById` / `queryPageList` / `queryList` / `insertByBo` / `updateByBo` / `deleteWithValidByIds`，
再按需叠加：唯一校验、数据权限（`@DataPermission`）、MPJ 联表、缓存、Excel 导入导出、关联表维护。

## 五、参考代码位置（照着抄最稳）

定位完目录后，**优先打开下面这些真实文件作为模板**，而不是凭记忆写：

### 1. 标准单表 CRUD —— `ruoyi-demo` 的 TestDemo（最干净的范本）

```
ruoyi-modules/ruoyi-demo/src/main/java/org/dromara/demo/
├── domain/TestDemo.java                       # 实体：extends BaseEntity，含 @Version + @TableLogic + @OrderBy
├── domain/bo/TestDemoBo.java                  # BO（入参 + 分组校验）
├── domain/vo/TestDemoVo.java                  # VO（出参）
├── domain/vo/TestDemoImportVo.java            # Excel 导入专用 VO
├── mapper/TestDemoMapper.java                 # Mapper
├── service/ITestDemoService.java              # Service 接口
├── service/impl/TestDemoServiceImpl.java      # Service 实现
└── controller/TestDemoController.java         # Controller
ruoyi-modules/ruoyi-demo/src/main/resources/mapper/demo/TestDemoMapper.xml   # 配套 XML
```

`TestDemo.java` 关键骨架（真实代码节选，注意包名 `org.dromara` 与 `BaseEntity`）：

```java
package org.dromara.demo.domain;

import org.dromara.common.mybatis.core.domain.BaseEntity;
// ...
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("test_demo")
public class TestDemo extends BaseEntity {
    @TableId(value = "id")
    private Long id;
    @Version
    private Long version;       // 乐观锁
    @TableLogic
    private Long delFlag;       // 逻辑删除
}
```

### 2. 带事件/缓存/配置的进阶范本 —— `ruoyi-system` 的 SysConfig

```
ruoyi-modules/ruoyi-system/src/main/java/org/dromara/system/
├── domain/SysConfig.java
├── domain/bo/SysConfigBo.java
├── domain/vo/SysConfigVo.java
├── mapper/SysConfigMapper.java
├── service/ISysConfigService.java
├── service/impl/SysConfigServiceImpl.java     # 含缓存读写（参数缓存）
└── controller/system/SysConfigController.java  # @SaCheckPermission("system:config:xxx") + @Log
```

> 注意 `ruoyi-system` 的 controller 进一步分包：`controller/system/`（业务）与 `controller/monitor/`（监控）。

### 3. 跨模块接口契约范本 —— `ruoyi-api`

要给别的模块暴露能力时，**先在 `ruoyi-api` 定接口与 DTO，再回业务模块写实现**：

```
ruoyi-api/src/main/java/org/dromara/system/api/
├── ConfigService.java / DeptService.java / UserService.java …   # 对外接口
├── domain/                                                      # 传输用 DTO
└── model/LoginUser.java / *LoginBody.java                       # 登录模型
ruoyi-api/src/main/java/org/dromara/workflow/api/
├── WorkflowService.java
├── domain/StartProcessDTO.java …
└── event/ProcessEvent.java
```

### 4. 代码生成模板范本 —— `ruoyi-gen`

改生成产物的样子，就改这里的 FreeMarker 模板：

```
ruoyi-modules/ruoyi-gen/src/main/resources/fm/
├── java/{domain,bo,vo,mapper,service,serviceImpl,controller}.java.ftl
├── xml/mapper.xml.ftl
├── sql/{mysql,oracle,postgres,sqlserver}.sql.ftl
├── vue/{index.vue,index-tree.vue,api.ts,types.ts}.ftl
└── react/{index.tsx,index-tree.tsx,api.ts,types.ts}.ftl
```

## 六、新建模块放哪

判断顺序：

1. **属于既有业务域** → 直接进对应模块。比如新增"系统通告""字典扩展"这类 → 进 `ruoyi-modules/ruoyi-system`，按第四节七类结构补文件即可。
2. **是一块独立业务域**（与 system/ai/workflow 都不沾边，是一个新领域，如"商城""IoT 设备"） → 在 `ruoyi-modules/` 下**新建 `ruoyi-xxx` 子模块**：
   - 在根 `pom.xml` 与 `ruoyi-modules/pom.xml` 注册 `<module>ruoyi-xxx</module>`；
   - 新模块 `pom.xml` 按需引入 `ruoyi-common-*` 依赖（用到缓存就引 `ruoyi-common-redis`，要数据权限就引 `ruoyi-common-mybatis`）；
   - 让 `ruoyi-admin` 依赖该新模块（否则启动时不会被装配）；
   - 代码包根仍是 `org.dromara.xxx`，内部按第四节标准结构组织。
3. **是横切能力**（缓存策略、统一加解密、新中间件封装，多个业务模块都要复用） → 进 `ruoyi-common/` 下**新建 `ruoyi-common-xxx`**，并在 `ruoyi-common-bom` 登记版本。
4. **需要被其它业务模块调用** → 接口与 DTO 先放 `ruoyi-api`，新模块只写实现，调用方依赖 `ruoyi-api`（**绝不**直接 import 新模块的实现类）。
5. **是要独立部署的 Server**（不随主应用一起跑） → 进 `ruoyi-extend/`。

SQL 与数据库初始化脚本统一放 `script/sql/`（主库脚本写进 `ry_vue.sql` 或按域拆分），别散落在各模块里。

## 七、常见错误对比（导航/定位易踩坑）

| ❌ 错误做法 | ✅ 正确做法 | 原因 |
|------------|-----------|------|
| 在 `ruoyi-modules/ruoyi-system/.../dao/` 里找/建 DAO 层 | 直接用 `mapper/` 下的 `Mapper`（extends `BaseMapperPlus`），查询用 `QueryBuilder` | 6.x 是三层架构，**根本没有 DAO 层**，也没有 `buildQueryWrapper()` |
| 把包名写成 `com.ruoyi.xxx` 或 `plus.ruoyi.xxx` 去搜文件 | 一律按 `org.dromara.xxx` 搜 | 框架约定根包是 **`org.dromara`** |
| A 业务模块直接 `import org.dromara.system.service.impl.XxxServiceImpl` | 调 `ruoyi-api` 里的 `XxxService` 接口 | 跨模块只认 `ruoyi-api` 契约，直接依赖实现会破坏模块边界 |
| 在本仓库里找 `plus-ui` / 前端 Vue 页面源码 | 前端在**仓库内 `plus-ui/`**（`src/views`、`src/api`） | 本项目前后端一体化 |
| 把全局 `application.yml` 当作放在某个 common 模块里 | 运行配置只在 **`ruoyi-admin/src/main/resources`** | `ruoyi-admin` 是唯一可执行入口，配置与启动都在这 |
| 改代码生成产物时去改 `ruoyi-gen` 的 Java 业务代码 | 改 `ruoyi-gen/src/main/resources/fm/**/*.ftl` 模板 | 生成的样子由 FreeMarker 模板决定，不是 Java 逻辑 |
| 缓存工具去 `ruoyi-common-core` 找 | 缓存在 `ruoyi-common-redis`（`RedisUtils`/`CacheUtils`） | core 只放最基础的 utils/异常/domain，中间件能力各有专属 common 子模块 |

## 八、最佳实践

1. **先定位再动手**：任何"加功能/改代码"前，先用本技能确认目标文件所在模块与目录，避免在错误的层（如臆想的 DAO 层）瞎找。
2. **照真实文件抄**：新建 CRUD 优先打开 `TestDemo`（最干净）或 `SysConfig`（带事件/缓存）作为模板，逐文件对照，比凭记忆更可靠。
3. **横切 vs 业务 的判断**：写之前问自己"这能跨业务复用吗？"——能就进 `ruoyi-common-*`，不能就进 `ruoyi-modules/ruoyi-xxx`。
4. **跨模块走契约**：任何模块间调用，先看 `ruoyi-api` 有没有现成接口；没有就先在 `ruoyi-api` 加接口+DTO，再回模块写实现。
5. **配置集中在 admin**：环境差异（端口、数据源、Redis 地址）只改 `ruoyi-admin` 的 `application-{dev,prod}.yml`，不要散落到子模块。
6. **SQL 集中在 script**：建表/初始化脚本统一 `script/sql/`，与模块 Java 代码分离，方便部署同步。
7. **6.x 三铁律常驻脑中**：包根 `org.dromara`、三层无 DAO、前端在独立 `plus-ui` 仓库——定位与写代码时反复自检，杜绝 `com.ruoyi`/`plus.ruoyi`/DAO/`buildQueryWrapper` 的旧习惯。
8. **善用专项技能接力**：本技能定位到位后，写实现请激活 crud-development（写 CRUD）、redis-cache（缓存）、security-guard（权限）、database-ops（SQL/表）等专项技能，各司其职。
