---
name: architecture-design
description: |
  本项目 系统架构设计、模块划分、分层与解耦、跨模块依赖管理。覆盖模块拓扑、ruoyi-api 契约层、标准三层架构、common 子模块职责、何时新建模块、领域边界划分。

  触发场景：
  - 规划新业务模块的位置与依赖（放 ruoyi-modules 还是新建 module）
  - 设计跨模块调用，需要在 ruoyi-api 定接口契约 / DTO / Event
  - 梳理依赖关系、消除业务模块之间的直接 import 耦合
  - 重构现有代码、划分领域边界、评估三层职责是否越界
  - 咨询 Spring Boot 4 / Jakarta EE 10 / Jetty 代际下的工程组织方式

  触发词：架构设计、模块划分、分层、解耦、依赖管理、ruoyi-api、契约层、模块拓扑、重构、领域划分、系统设计、代码组织

  注意：具体技术方案对比（如 Easy-Es vs MySQL 全文检索）请用 tech-decision；开发具体 CRUD 模块请用 crud-development；缓存/Redis 选型请用 redis-cache。
---

# 架构设计（base-dev-framework6-java）

## 一、概述

本项目 是基于 **Spring Boot 4.1.0 / Java 21 / Jakarta EE 10 / Jetty** 的多模块单体（Modular Monolith）。包名前缀统一为 `org.dromara`，Maven 用 `flatten-maven-plugin` 统一 `revision`（仓库内 revision 字符串仍写 `5.5.3`，但依赖代际是 6.x 的 Spring Boot 4 新一代）。

架构设计在本项目中要回答四个问题：

1. **新代码放哪个模块**——按职责落到 `backend/java/ruoyi-common/*`（公共能力）、`backend/java/ruoyi-modules/*`（业务）、`ruoyi-api`（跨模块契约）、`backend/java/ruoyi-extend/*`（外置 server）。
2. **模块之间怎么调**——🔴 跨业务模块调用一律走 `ruoyi-api` 暴露的接口契约，**绝不**直接 import 另一个业务模块的实现类。
3. **一个模块内部怎么分层**——标准三层 `Controller → Service → Mapper`，**无 DAO 层**。
4. **什么时候要新建模块**——见第六节判定标准，默认不新建，优先复用已有 24 个 common 子模块与 6 个业务模块。

> 6.x 相对早期版本最重要的架构演进就是 **`ruoyi-api` 契约层的引入**——它把"模块间共享什么"从隐式的 import 变成了显式的接口约定，是本技能的核心。

## 二、模块拓扑

```
base-dev-framework6-java (root, packaging=pom；flatten 统一 revision)
│  <modules>: ruoyi-admin / ruoyi-common / ruoyi-extend / ruoyi-modules / ruoyi-api
│
├── ruoyi-admin                 # 唯一可执行入口（spring-boot-maven-plugin repackage）
│       装配：mysql 驱动 + ruoyi-api + ruoyi-system + ruoyi-job + ruoyi-ai
│             + ruoyi-workflow + ruoyi-demo + ruoyi-gen + 各 common starter
│       职责：只做装配与启动，不写业务代码
│
├── ruoyi-api                   # ★ 跨模块 API 契约层（仅依赖 ruoyi-common-core）
│   └── org.dromara
│       ├── system/api          #   ConfigService / DeptService / OssService / PostService
│       │   ├── domain          #     RoleService / UserService / MessageService / TaskAssigneeService
│       │   └── model           #     DTO（UserDTO/DeptDTO/OssDTO...）+ Model（LoginUser/各 *LoginBody/RegisterBody）
│       └── workflow/api        #   WorkflowService + StartProcessDTO/CompleteTaskDTO/FlowCopyDTO
│           ├── domain          #     + event：ProcessEvent / ProcessTaskEvent / ProcessDeleteEvent
│           └── event
│
├── backend/java/ruoyi-common/               # 24 个公共能力子模块（由 ruoyi-common-bom 统一版本）
│   ├── core / web / mybatis / redis / satoken / security / log / doc / json
│   ├── excel / oss / encrypt / sensitive / translation / mail / sms / social
│   └── ai / mcp / elasticsearch / mqtt / push / job        # 6.x 新增方向
│
├── backend/java/ruoyi-modules/              # 业务模块（互不直接依赖，仅经 ruoyi-api 通信）
│   ├── ruoyi-system            #   系统管理（用户/角色/菜单/部门/字典/OSS，重数据权限 + MPJ）
│   ├── ruoyi-workflow          #   Warm-Flow 工作流
│   ├── ruoyi-job               #   SnailJob 业务任务
│   ├── ruoyi-ai                #   Snail AI 接入
│   ├── ruoyi-gen               #   代码生成器（FreeMarker + 多前端栈）
│   └── ruoyi-demo              #   示例（含 MCP server/client 示例）
│
└── backend/java/ruoyi-extend/               # ★ 外置独立 Server（独立进程、独立端口，与主应用解耦）
    ├── ruoyi-monitor-admin     #   Spring Boot Admin 监控端
    ├── ruoyi-snailjob-server   #   SnailJob 调度服务端
    └── ruoyi-snailai-server    #   Snail AI 服务端（管模型/应用/Key）
```

### 依赖方向（单向，禁止反向 / 环）

```
ruoyi-admin ─依赖→ backend/java/ruoyi-modules/* ─依赖→ ruoyi-api ─依赖→ ruoyi-common-core
     │                   │
     └───────────────────┴─────────依赖→ backend/java/ruoyi-common/*（按需）

backend/java/ruoyi-extend/*  独立进程，不参与主应用装配
ruoyi-api       只依赖 ruoyi-common-core（保持契约层极薄，避免把公共依赖污染进契约）
```

- `ruoyi-api` 是依赖收敛点：所有业务模块都能 `import` 它，但它自己**不依赖任何业务模块**，从而打破"A 依赖 B、B 依赖 A"的循环可能。
- 业务模块之间**没有直接依赖边**——`ruoyi-workflow` 不依赖 `ruoyi-system` 的实现，只依赖 `ruoyi-api`。

## 三、标准三层架构（无 DAO）

本项目业务模块内部是**标准三层**，🔴 **没有独立 DAO 层**，查询条件直接在 Service 里用 `QueryBuilder` 构建，Mapper 直接继承 `BaseMapperPlus`。

```
domain/Entity.java              extends BaseEntity（org.dromara.common.mybatis.core.domain）
domain/bo/EntityBo.java         @AutoMapper(target = Entity.class, reverseConvertGenerate = false)
domain/vo/EntityVo.java         @AutoMapper(target = Entity.class)
mapper/EntityMapper.java        extends BaseMapperPlus<Entity, EntityVo>（连表再叠加 MPJBaseMapper<Entity>）
service/IEntityService.java     业务接口
service/impl/EntityServiceImpl  @RequiredArgsConstructor @Service；BO→Entity 用 MapstructUtils.convert
controller/EntityController     extends BaseController；返回 R<T>；方法级 @SaCheckPermission
```

| 层 | 职责 | 不该做的事 |
|----|------|-----------|
| **Controller** | 接参（BO + 分组校验 `AddGroup/EditGroup`）、鉴权 `@SaCheckPermission`、日志 `@Log`、调 Service、包 `R<T>` | 写业务逻辑、直接调 Mapper、拼 SQL |
| **Service** | 业务编排、事务、查询条件构建（`QueryBuilder.lambda`）、BO/Entity/VO 转换（`MapstructUtils`）、跨模块协作 | 处理 HTTP 语义、返回 `R<T>` |
| **Mapper** | 数据访问，继承 `BaseMapperPlus<Entity, EntityVo>`，提供 `selectVoPage` 等 | 写业务判断 |

> 🔴 6.x 不存在 `buildQueryWrapper()` 风格的 DAO 方法、不存在 `PlusLambdaQuery` / `likeCast`；查询用 `QueryBuilder.lambda(Entity.class)` 配 `eqIfText/likeIfText/eqIfPresent/inIfNotEmpty` 这类条件辅助。这是与早期版本（四层 + DAO）的根本分层差异。

## 四、跨模块解耦：ruoyi-api 契约层（核心）

### 4.1 铁律

🔴 **跨业务模块调用必须经过 `ruoyi-api` 暴露的接口契约**（如 `UserService` / `WorkflowService`），消费方只 `import` 接口与 DTO，**永远不直接 import 另一个业务模块的实现类或 Entity**。

为什么：
- 业务模块之间没有 Maven 依赖边，编译期就杜绝了"workflow 偷用 system 的内部类"。
- 实现可替换：`SysUserServiceImpl implements ISysUserService, UserService`——对内用 `ISysUserService`（系统模块自用的全功能接口），对外只暴露 `UserService`（契约层的精简只读视图）。
- 数据传输用 DTO（如 `UserDTO`），不暴露 Entity，避免把 ORM 注解、租户字段、逻辑删除字段泄漏到其它模块。

### 4.2 新增一个对外能力的标准步骤

```
1. 在 ruoyi-api 定契约：
   org.dromara.{domain}.api.XxxService           ← 接口（只放跨模块真正需要的方法）
   org.dromara.{domain}.api.domain.XxxDTO         ← 传输对象（不引 Entity）
   org.dromara.{domain}.api.event.XxxEvent        ← 需要异步解耦时定义事件（Spring Event）
2. 在业务模块实现：
   {模块}ServiceImpl implements I{模块}Service, XxxService   ← 一个 Bean 同时满足内/外两套接口
3. 消费方注入接口（不是实现）：
   @RequiredArgsConstructor + private final XxxService xxxService;
```

### 4.3 事件解耦（更松的协作）

当 A 模块只需"广播一件事"、不关心谁处理时，用 `ruoyi-api` 里定义的 Event + Spring 监听，而非同步调用接口。工作流就是范例：流转时发 `ProcessEvent` / `ProcessTaskEvent`，业务模块各自 `@EventListener` 订阅，互不感知。

| 协作方式 | 适用 | 载体 |
|----------|------|------|
| 同步接口调用 | 需要立即拿到返回值（查用户昵称、查流程状态） | `ruoyi-api` 的 `XxxService` |
| 事件广播 | 一对多、无返回、可异步（流程节点流转通知） | `backend/java/ruoyi-api/event` 的 `XxxEvent` + `@EventListener` |

## 五、ruoyi-common 子模块职责表（24 个）

> 选型决策时优先复用下表能力，不要在业务模块里重造轮子。版本由 `ruoyi-common-bom` 统一。

| 子模块 | 职责 | 关键技术（6.x） |
|--------|------|----------------|
| `ruoyi-common-core` | 最底层：通用工具、常量、`R<T>`、`ServiceException`、`MapstructUtils` | MapStruct-Plus、Hutool、Lombok |
| `ruoyi-common-web` | Web 基座：`BaseController`、全局异常、Servlet 配置 | Jetty（已排除 Tomcat） |
| `ruoyi-common-mybatis` | ORM 基座：`BaseEntity`、`BaseMapperPlus`、`QueryBuilder`、分页、逻辑删除 | MyBatis-Plus(boot4) + MPJ |
| `ruoyi-common-redis` | 缓存/分布式锁：`RedisUtils`、`CacheUtils`、Spring Cache | Redisson 4.6.1 + Fory 序列化 |
| `ruoyi-common-satoken` | 认证：`LoginHelper`、Token 校验 | Sa-Token 1.45.0 + JWT |
| `ruoyi-common-security` | 鉴权切面、权限注解支撑 | 配合 Sa-Token |
| `ruoyi-common-log` | 操作日志：`@Log`、`OperLogEvent` | AOP |
| `ruoyi-common-doc` | 接口文档 | SpringDoc OpenAPI（无 Knife4j） |
| `ruoyi-common-json` | JSON 序列化：`JsonUtils`、`JsonFieldProcessor` | Jackson（无 Fastjson2） |
| `ruoyi-common-excel` | 导入导出 | Apache FESOD 2.0.2 |
| `ruoyi-common-oss` | 对象存储统一 S3 协议 | AWS SDK v2（适配 MinIO/OSS/COS） |
| `ruoyi-common-encrypt` | 字段加解密：`@EncryptField` | BouncyCastle + Hutool Crypto |
| `ruoyi-common-sensitive` | 脱敏：`@Sensitive` | AOP |
| `ruoyi-common-translation` | 翻译填充：`@Translation`、三阶段 collect/prepare/process | `TranslationInterface<T>` |
| `ruoyi-common-mail` | 邮件 | Jakarta Mail + Angus |
| `ruoyi-common-sms` | 短信 | SMS4J 3.3.5 |
| `ruoyi-common-social` | 社交登录 | JustAuth 1.16.7 |
| `ruoyi-common-job` | 定时/重试客户端 | SnailJob 2.0.0 client |
| `ruoyi-common-ai` | AI 能力基座 | Snail AI 0.0.5 |
| `ruoyi-common-mcp` | MCP Server/Client | Spring AI 2.0 + MCP |
| `ruoyi-common-elasticsearch` | 搜索 | Easy-Es 3.0.2 |
| `ruoyi-common-mqtt` | IoT 消息 | mica-mqtt 2.6.6 |
| `ruoyi-common-push` | 统一推送（SSE + WebSocket 双传输） | spring-websocket（排除 Tomcat） |
| `ruoyi-common-bom` | 仅做版本管理，不含代码 | dependencyManagement 聚合 |

## 六、何时新建模块（决策标准）

默认**不新建模块**，优先在 `backend/java/ruoyi-modules/ruoyi-system` 或合适的现有业务模块内加包。满足以下任一条件才考虑新建：

| 应新建 common 子模块（`ruoyi-common-xxx`） | 应新建业务模块（`backend/java/ruoyi-modules/ruoyi-xxx`） | 应新建外置 server（`backend/java/ruoyi-extend/xxx`） |
|------|------|------|
| 引入了一套独立的第三方技术栈（如新 MQ/搜索/AI） | 是一个完整、可独立演进的业务域（如工作流、AI 应用） | 需要独立进程/独立端口/独立伸缩 |
| 多个业务模块都要复用、且与业务无关 | 有自己的表、菜单、权限标识体系 | 是控制台/调度台/网关类基础设施 |
| 能抽象成"能力"而非"业务"（加解密、翻译、推送） | 想让它可被按需装配（如 gen 用 profile 开关） | 不参与主应用 `ruoyi-admin` 装配 |

**新建模块清单**（缺一不可）：
1. 建目录 + `pom.xml`（parent 指向 `base-dev-framework6-java`，依赖只声明真正需要的 common/api）；
2. 在父 `pom.xml` 的 `<modules>` 注册；
3. 若是业务模块，在 `backend/java/ruoyi-admin/pom.xml` 加依赖才会被装配进主应用；
4. 包名 `org.dromara.{模块名}`，按三层建包 `domain/mapper/service/controller`；
5. 若需对外暴露能力，回到 `ruoyi-api` 补契约接口 + DTO（先定契约再实现）。

## 七、领域边界划分原则

- **按业务域聚合，不按技术分层拆模块**：一个业务域（如工作流）的 Entity/Service/Controller 都在同一模块内，不要把所有 Entity 抽到一个"data 模块"。
- **公共能力下沉到 common，业务能力上浮到 modules**：判断标准是"换一个业务系统还用不用得上"——用得上→common，用不上→modules。
- **契约最小化**：`ruoyi-api` 只放跨模块真正调用的方法和字段，不要把业务模块的全部 Service 方法都搬上去，否则契约层会变成"第二个业务模块"。
- **外置 server 自治**：`backend/java/ruoyi-extend/*` 各自是独立 Spring Boot 应用，通过网络协议（HTTP/调度协议）与主应用交互，不共享内存对象。

## 八、代码示例

### 示例 1：在 ruoyi-api 定义契约接口（system 域）

```java
// ruoyi-api: org.dromara.system.api.UserService —— 跨模块只读视图
package org.dromara.system.api;

import org.dromara.system.api.domain.UserDTO;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * 通用 用户服务（契约层：只暴露跨模块真正需要的方法）
 */
public interface UserService {

    /** 通过用户ID查询昵称 */
    String selectNicknameById(Long userId);

    /** 通过用户ID查询用户（返回 DTO，不暴露 Entity） */
    UserDTO selectById(Long userId);

    /** 批量查询 用户ID → 昵称 映射 */
    Map<Long, String> selectUserNicksByIds(Collection<Long> userIds);

    /** 通过角色ID查询用户ID */
    List<Long> selectUserIdsByRoleIds(Collection<Long> roleIds);
}
```

### 示例 2：业务模块实现契约（一个 Bean 满足内/外两套接口）

```java
// backend/java/ruoyi-modules/ruoyi-system: 同时实现内部接口 ISysUserService 与对外契约 UserService
@Service
@RequiredArgsConstructor
public class SysUserServiceImpl implements ISysUserService, UserService {

    private final SysUserMapper baseMapper; // BaseMapperPlus，无独立 DAO 层

    @Override
    public Map<Long, String> selectUserNicksByIds(Collection<Long> userIds) {
        // 直接用 QueryBuilder 构建条件（无 buildQueryWrapper / PlusLambdaQuery）
        List<SysUserVo> list = baseMapper.selectVoList(
            QueryBuilder.lambda(SysUser.class).in(SysUser::getUserId, userIds));
        return StreamUtils.toMap(list, SysUserVo::getUserId, SysUserVo::getNickName);
    }
    // ... 其余 ISysUserService / UserService 方法
}
```

### 示例 3：跨模块消费契约（workflow 调 system，真实写法）

```java
// backend/java/ruoyi-modules/ruoyi-workflow: WorkflowGlobalListener —— 注入契约接口，不碰 system 实现
@Component
@RequiredArgsConstructor
public class WorkflowGlobalListener {

    private final IFlwTaskService flwTaskService;     // workflow 自己的内部接口
    private final UserService userService;            // ← 来自 ruoyi-api 的跨模块契约

    private void buildNickNameMap(Collection<Long> userIds) {
        // 经契约调用 system，不 import 任何 org.dromara.system.domain.* 实现类
        Map<Long, String> nickNameMap = userService.selectUserNicksByIds(userIds);
        // ... 使用昵称
    }
}
```

### 示例 4：事件解耦（ruoyi-api 定义事件，业务模块订阅）

```java
// 发布方（ruoyi-workflow）：流程流转时广播，不关心谁处理
ProcessEvent event = new ProcessEvent();
event.setFlowCode(flowCode);
event.setBusinessId(businessId);
event.setStatus(status);
SpringUtils.context().publishEvent(event); // org.dromara.workflow.api.event.ProcessEvent

// 订阅方（任意业务模块）：自行监听，与 workflow 解耦
@EventListener
public void onProcess(ProcessEvent event) {
    if ("finish".equals(event.getStatus())) {
        // 处理业务完结逻辑
    }
}
```

### 示例 5：标准三层模块骨架（无 DAO）

```java
// controller —— 只做接参/鉴权/包 R<T>
@RestController
@RequiredArgsConstructor
@RequestMapping("/system/notice")
public class SysNoticeController extends BaseController {

    private final ISysNoticeService noticeService;

    @SaCheckPermission("system:notice:add")
    @Log(title = "通知公告", businessType = BusinessType.INSERT)
    @PostMapping
    public R<Void> add(@Validated(AddGroup.class) @RequestBody SysNoticeBo bo) {
        return toAjax(noticeService.insertByBo(bo));
    }
}

// service impl —— 业务编排 + 条件构建 + 转换，直接用 baseMapper
@Service
@RequiredArgsConstructor
public class SysNoticeServiceImpl implements ISysNoticeService {

    private final SysNoticeMapper baseMapper; // extends BaseMapperPlus<SysNotice, SysNoticeVo>

    @Override
    public Boolean insertByBo(SysNoticeBo bo) {
        SysNotice add = MapstructUtils.convert(bo, SysNotice.class); // 非 BeanUtils
        return baseMapper.insert(add) > 0;
    }
}
```

## 九、常见错误对比

### 错误 1：业务模块直接 import 另一个业务模块的实现/Entity

```java
// ❌ 错误：workflow 直接依赖 system 的内部实现，制造模块间硬耦合
import org.dromara.system.service.impl.SysUserServiceImpl;
import org.dromara.system.domain.SysUser;
private final SysUserServiceImpl sysUserServiceImpl;

// ✅ 正确：只依赖 ruoyi-api 的契约接口与 DTO
import org.dromara.system.api.UserService;
import org.dromara.system.api.domain.UserDTO;
@RequiredArgsConstructor
public class Xxx { private final UserService userService; }
```

### 错误 2：新增对外能力时跳过契约层，把方法塞进业务接口

```java
// ❌ 错误：直接在 ISysUserService 加方法，再让别的模块依赖 ruoyi-system 模块
// → 业务模块之间产生 Maven 依赖边，迟早出现循环依赖

// ✅ 正确：先在 ruoyi-api 定 UserService 契约 + UserDTO，
//          SysUserServiceImpl 再 implements UserService，消费方只依赖 ruoyi-api
```

### 错误 3：套用早期版本的四层 + DAO 架构

```java
// ❌ 错误：6.x 没有 DAO 层，没有 buildQueryWrapper / PlusLambdaQuery
public class SysUserDao { LambdaQueryWrapper<SysUser> buildQueryWrapper(SysUserBo bo){...} }

// ✅ 正确：三层架构，查询条件在 Service 用 QueryBuilder 现场构建
List<SysUserVo> list = baseMapper.selectVoList(
    QueryBuilder.lambda(SysUser.class).likeIfText(SysUser::getUserName, bo.getUserName()));
```

### 错误 4：用错包名 / 基类 / 转换工具

```java
// ❌ 错误：plus.ruoyi.* / com.ruoyi.* 包名；继承 TenantEntity（默认非租户场景）；BeanUtils 拷贝
package plus.ruoyi.system.domain;
public class SysUser extends TenantEntity { }
SysUser u = new SysUser(); BeanUtils.copyProperties(bo, u);

// ✅ 正确：org.dromara.* 包名；继承 BaseEntity；MapstructUtils 转换
package org.dromara.system.domain;
public class SysUser extends BaseEntity { }
SysUser u = MapstructUtils.convert(bo, SysUser.class);
```

## 十、最佳实践

1. **画依赖图先于写代码**——动手前确认新代码所在模块的"出向依赖"只指向 `ruoyi-api` / `backend/java/ruoyi-common/*`，不指向其它业务模块。
2. **契约先行**——任何跨模块需求，先在 `ruoyi-api` 提交接口 + DTO（必要时 + Event），再写实现；评审时把"契约 diff"作为架构变更的审查重点。
3. **DTO 与 Entity 物理隔离**——`ruoyi-api` 里只放 DTO/Model，绝不引入业务模块的 Entity，防止 ORM/租户/逻辑删除细节外泄。
4. **能力下沉、业务上浮**——发现某段逻辑"换个项目还能用"，及时下沉到合适的 `ruoyi-common-xxx`；保持业务模块聚焦业务。
5. **优先复用 24 个 common 子模块**——选型时先查第五节职责表，避免重复造缓存/Excel/翻译/推送轮子。
6. **外置 server 走网络协议**——`backend/java/ruoyi-extend/*` 与主应用解耦，绝不让主应用通过内存对象耦合监控端/调度端/AI 端。
7. **代际特征落到工程**——Spring Boot 4 / Jakarta EE 10 下用 `jakarta.*` 命名空间、boot4 系列 starter、Jetty 容器；新引依赖优先选 boot4 适配版，避免混入 javax.* 旧代际包。
8. **守住分层职责边界**——Controller 不写业务、Service 不返回 `R<T>`、Mapper 不做业务判断；条件构建只用 `QueryBuilder`，杜绝 DAO 层与 `buildQueryWrapper` 回潮。
