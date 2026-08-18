---
name: realtime-push
description: |
  base-dev-framework6-java统一实时推送开发指南。基于 ruoyi-common-push 模块，
  一套 API（PushHelper）底层支持 SSE / WebSocket 双传输，业务代码只调 PushHelper，
  传输方式由 message.transport 配置决定，切换传输无需改动任何业务代码。覆盖单发、广播、
  批量推送、多实例集群 Redis topic 广播、统一消息体 PushPayloadDTO（PushTypeEnum / PushSourceEnum）。
  所有约定均来自 org.dromara.common.push 真实源码与 application.yml 的 message: 段。

  触发场景：
  - 业务需要从服务端主动把消息推给指定用户 / 全部在线用户（通知、公告、AI 流式、工作流提醒）。
  - 需要在前端建立长连接接收实时消息，前端连接路径统一为 /resource/message。
  - 多实例集群部署，需要把消息从任意一个节点广播到所有节点上的在线连接。
  - 需要在 SSE 与 WebSocket 之间切换传输方式，且要求业务代码零改动。
  - 排查"消息推不出去 / 集群下只有部分人收到 / 切了 websocket 报错"等推送问题。

  触发词：实时推送、消息推送、SSE、WebSocket、PushHelper、服务端推送、广播、在线消息、ws、
  EventSource、双传输、message.transport、集群广播、realtime-push、通知推送
---

# realtime-push - 统一实时推送（SSE + WebSocket 双传输）

> 模块：`backend/java/ruoyi-common/ruoyi-common-push`，包 `org.dromara.common.push`。
> 跨模块消息体：`ruoyi-api` → `org.dromara.system.api.domain.PushPayloadDTO`。
> 配置段：`application.yml` 的 `message:`。前端连接路径统一为 `/resource/message`。

## 1. 核心思想：一套 API，两种传输

本项目 把"实时推送"抽象成**一套统一 API + 两种可插拔传输**：

- **业务层只认 `PushHelper`**：所有发送动作（单发 / 广播 / 批量）全部调用 `PushHelper` 的静态方法，
  业务代码里**永远不出现** `SseEmitter` / `WebSocketSession` 这类底层对象。
- **底层传输由配置决定**：`message.transport` 取值 `sse`（默认）或 `websocket`。换传输只改一行配置，
  业务代码一行都不用动——这就是"双传输"的价值。
- **传输切换靠条件装配**：`@ConditionalOnMessageTransport("sse")` / `("websocket")` 注解配合
  `MessageTransportCondition` 条件类，按 `message.transport` 的值决定注册 SSE 还是 WebSocket 的那套 Bean。

### 关键类一览（全部来自真实源码）

| 角色 | 类 | 说明 |
|------|----|------|
| 业务统一入口 | `PushHelper` | 静态工具类，业务唯一调用点 |
| 会话管理抽象 | `PushSessionManager`（接口） | 定义 `sendMessage` / `publishMessage` / `publishAll` / `subscribeMessage` |
| SSE 实现 | `SseEmitterSessionManager` | 管理 `SseEmitter`，心跳、连接清理 |
| WebSocket 实现 | `WebSocketSessionManager` | 管理 `WebSocketSession`，心跳、连接清理 |
| 统一消息体 | `PushPayloadDTO`（ruoyi-api） | 跨模块 DTO，含 type / source / message / data / path |
| 推送参数封装 | `PushDTO`（ruoyi-common-push） | `userIds + payload`，userIds 为空即广播 |
| 传输枚举 | `MessageTransportEnum` | `SSE("sse")` / `WEBSOCKET("websocket")` |
| 条件注解 | `@ConditionalOnMessageTransport` + `MessageTransportCondition` | 按 transport 装配 |
| 集群广播监听 | `MessageTopicListener` | 启动后订阅 Redis topic，跨实例分发 |
| 配置项 | `MessageProperties` | 绑定前缀 `message` |
| 公共装配 | `MessageAutoConfiguration` | `message.enabled=true` 时生效，注册 `MessageProperties` |
| SSE 装配 | `MessageSseConfiguration` | `transport=sse` 时注册 SSE 三件套 |
| WS 装配 | `MessageWebSocketConfiguration` | `transport=websocket` 时注册 WS 全套 |
| SSE 接入接口 | `SseController` | `GET ${message.path}` 建立 SSE 连接 |
| WS 握手处理 | `PlusWebSocketHandler` + `PlusWebSocketInterceptor` | 握手鉴权 + 全生命周期事件 |

> 自动装配清单：`ruoyi-common-push/.../META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
> 注册了 `MessageAutoConfiguration` / `MessageSseConfiguration` / `MessageWebSocketConfiguration` 三个配置。

## 2. 配置（application.yml 的 message: 段）

真实配置（`backend/java/ruoyi-admin/src/main/resources/application.yml`）：

```yaml
--- # 统一消息推送配置
message:
  enabled: true
  # sse / websocket
  transport: sse
  # 统一访问路径（前端连接 / 后端 SseController 映射都用它）
  path: /resource/message
  # websocket 允许的跨域来源
  allowedOrigins: '*'
  # SSE 连接超时时间，单位毫秒（默认 24h = 86400000）
  sse-timeout: 86400000
  # 本地连接心跳检测间隔，单位秒（默认 60s）
  heartbeat-interval: 60
  # WebSocket 单次发送超时时间，单位毫秒（默认 10s）
  web-socket-send-time-limit: 10000
  # WebSocket 发送缓冲区大小（默认 64000 字节）
  web-socket-buffer-size-limit: 64000
```

配置项与 `MessageProperties` 字段一一对应（注意 yml 的 kebab-case 自动映射到 Java 的 camelCase）：

| yml key | Java 字段 | 默认值 | 作用 |
|---------|----------|--------|------|
| `enabled` | `enabled` | `true` | 总开关。`false` 则 `PushHelper.isEnabled()` 返回 false，所有发送直接 return |
| `transport` | `transport` | `sse` | 传输方式，决定装配哪一套；`MessageTransportEnum.of()` 找不到时回落 `SSE` |
| `path` | `path` | `/resource/message` | 统一访问路径，SSE 接口映射 + WebSocket handler 注册路径 |
| `allowedOrigins` | `allowedOrigins` | `{"*"}` | 仅 WebSocket 跨域用 |
| `sse-timeout` | `sseTimeout` | `86400000`(24h) | `new SseEmitter(timeout)` 的超时 |
| `heartbeat-interval` | `heartbeatInterval` | `60`(s) | SSE / WS 共用的心跳 + 失效连接清理周期 |
| `web-socket-send-time-limit` | `webSocketSendTimeLimit` | `10000` | `ConcurrentWebSocketSessionDecorator` 单次发送超时 |
| `web-socket-buffer-size-limit` | `webSocketBufferSizeLimit` | `64000` | 发送缓冲区上限 |

> **铁律**：`message.enabled=false` 会让 `MessageAutoConfiguration` 整体不生效
> （`@ConditionalOnProperty(prefix="message", name="enabled", havingValue="true", matchIfMissing=true)`），
> 同时 `PushHelper.isEnabled()` 也会拦住所有发送。要彻底关闭推送，把 `enabled` 设为 `false` 即可。

## 3. 统一消息体 PushPayloadDTO（跨模块）

`PushPayloadDTO` 位于 `ruoyi-api`（`org.dromara.system.api.domain`），是**前后端约定的统一消息结构**，
所有传输方式发出的最终都是它的 JSON。字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `messageId` | `Long` | 消息记录 ID（可空，关联落库消息） |
| `type` | `String` | 消息类型，取自 `PushTypeEnum` |
| `source` | `String` | 消息来源，取自 `PushSourceEnum` |
| `message` | `String` | 文本消息内容 |
| `data` | `Object` | 扩展数据（任意业务对象，序列化成 JSON） |
| `path` | `String` | 前端跳转路径（点击通知后前端跳转用） |
| `timestamp` | `Long` | 构建时自动填入 `System.currentTimeMillis()` |

`PushTypeEnum`（`ruoyi-common-core`）：`MESSAGE("message")` / `NOTICE("notice")` / `LLM("llm")` / `CUSTOM("custom")`。

`PushSourceEnum`（`ruoyi-common-core`）：`BACKEND("backend")` / `NOTICE("notice")` / `WORKFLOW("workflow")` / `LLM("llm")` / `CLIENT("client")`。

构建工厂方法（`PushPayloadDTO.of(...)`，三个重载）：

```java
// 1) 字符串形式（缺省 type/source 时回落 MESSAGE / BACKEND）
PushPayloadDTO.of("message", "backend", "你有一条新消息", null);

// 2) 枚举形式（推荐，类型安全）
PushPayloadDTO.of(PushTypeEnum.NOTICE, PushSourceEnum.BACKEND, "系统将于今晚维护", null);

// 3) 带前端跳转路径
PushPayloadDTO.of(PushTypeEnum.NOTICE, PushSourceEnum.WORKFLOW,
    "您有一条待办审批", taskData, "/workflow/todo");
```

## 4. 发送消息（业务唯一入口 PushHelper）

`PushHelper` 全部是静态方法，**业务直接调，不需要注入任何 Bean**。所有方法内部先 `isEnabled()` 守门，
再委托给 `SpringUtils.getBean(PushSessionManager.class)`——拿到的是当前传输对应的实现。

### 示例 1：给指定用户发文本（最简单）

```java
import org.dromara.common.push.helper.PushHelper;

// 给 userId=1 的用户推一句话，内部用默认 type=MESSAGE / source=BACKEND 封装
PushHelper.sendMessage(1L, "您的订单已发货");
```

### 示例 2：全局广播文本（所有在线用户）

```java
// 不传 userId 即广播给当前所有在线连接
PushHelper.sendMessage("系统公告：今晚 22:00 进行例行维护");
```

### 示例 3：给指定用户发结构化消息体（推荐做法）

```java
import org.dromara.common.core.enums.PushSourceEnum;
import org.dromara.common.core.enums.PushTypeEnum;
import org.dromara.system.api.domain.PushPayloadDTO;
import org.dromara.common.push.helper.PushHelper;

PushPayloadDTO payload = PushPayloadDTO.of(
    PushTypeEnum.NOTICE, PushSourceEnum.BACKEND,
    "您有一条新的工单分配", workOrderVo, "/order/detail/123");
PushHelper.sendMessage(2L, payload);
```

### 示例 4：批量推给一批用户（集群安全，走 Redis）

```java
import java.util.List;

List<Long> userIds = List.of(101L, 102L, 103L);
PushPayloadDTO payload = PushPayloadDTO.of(
    PushTypeEnum.MESSAGE, PushSourceEnum.WORKFLOW, "流程已流转到您", null);
// publishMessage 会发到 Redis topic，集群所有节点的对应用户都能收到
PushHelper.publishMessage(userIds, payload);
```

### 示例 5：集群级全局广播（推荐用于真正的全员通知）

```java
// publishAll 走 Redis topic 广播，集群下每个节点的全部在线用户都收到
PushHelper.publishAll("全员通知：系统升级完成，请刷新页面");

// 或带结构化消息体
PushPayloadDTO payload = PushPayloadDTO.of(
    PushTypeEnum.NOTICE, PushSourceEnum.BACKEND, "新版本已上线", null);
PushHelper.publishAll(payload);
```

### PushHelper 方法对照表

| 方法 | 作用域 | 是否走 Redis（集群安全） |
|------|--------|------------------------|
| `sendMessage(Long userId, String message)` | 单用户，**仅本节点** | 否（直发本地会话） |
| `sendMessage(String message)` | 广播，**仅本节点** | 否（直发本地会话） |
| `sendMessage(Long userId, PushPayloadDTO payload)` | 单用户，**仅本节点** | 否 |
| `sendMessage(PushPayloadDTO payload)` | 广播，**仅本节点** | 否 |
| `publishMessage(List<Long> userIds, PushPayloadDTO payload)` | 指定用户列表 | **是**（Redis topic 跨节点） |
| `publishMessage(PushDTO dto)` | 由 dto.userIds 决定（空=广播） | **是** |
| `publishAll(String message)` | 全局广播 | **是** |
| `publishAll(PushPayloadDTO payload)` | 全局广播 | **是** |

> **核心区别**：`sendMessage` 只把消息发给**当前 JVM 节点**上的在线连接；`publishMessage` / `publishAll`
> 先把消息丢进 Redis topic（`global:message`），由各节点的 `MessageTopicListener` 收到后再下发本地连接。
> **集群部署一律用 `publishMessage` / `publishAll`**，否则只有跟发送请求落在同一节点的用户能收到。

## 5. 集群广播机制（Redis topic）

多实例部署时，用户的长连接（SSE / WebSocket）只存在于"它握手命中的那个节点"的内存里。
要让任意节点都能把消息送达任意在线用户，靠 Redis 发布订阅：

- 常量 `MessageConstants.MESSAGE_TOPIC = "global:message"`（订阅主题）。
- `publishMessage` / `publishAll` 内部调 `RedisUtils.publish(MESSAGE_TOPIC, pushDTO, ...)` 把 `PushDTO`
  发到 topic（`SseEmitterSessionManager` / `WebSocketSessionManager` 各有实现，逻辑一致）。
- 启动时 `MessageTopicListener`（`ApplicationRunner`，`getOrder()=-1` 最先初始化）调
  `subscribeMessage(...)` 订阅 topic。每个节点都订阅。
- 收到消息后分发：`userIds` 非空 → 逐个 `sendMessage(userId, payload)` 单发；为空 → `sendMessage(payload)` 广播。
  这里的 `sendMessage` 是**本地下发**，于是消息最终到达每个节点上各自的在线连接。

```
业务调 PushHelper.publishAll(payload)
      │
      ▼
RedisUtils.publish("global:message", PushDTO.broadcast(payload))
      │ Redis 发布订阅 fan-out 到所有节点
      ├──────────────┬──────────────┐
      ▼              ▼              ▼
   节点A           节点B           节点C
MessageTopicListener 各自收到 → sendMessage(payload) 下发本地 SSE/WS 连接
```

> **结论**：只要用 `publishMessage` / `publishAll`，业务代码无需关心集群拓扑，
> Redis topic 自动把消息扩散到所有节点的在线连接。

## 6. 传输切换是怎么生效的（条件装配）

`@ConditionalOnMessageTransport(value)` 标在配置类 / 接口上，由 `MessageTransportCondition` 判定：

```java
// MessageTransportCondition.matches() 真实逻辑
Boolean enabled  = env.getProperty("message.enabled", Boolean.class, true);
String transport = env.getProperty("message.transport", MessageTransportEnum.SSE.getCode()); // 默认 sse
String expected  = (String) attributes.get("value");
return enabled && expected.equalsIgnoreCase(transport);
```

- `transport=sse` → 仅 `MessageSseConfiguration` 生效：注册 `SseEmitterSessionManager`、`SseController`、`MessageTopicListener`。
- `transport=websocket` → 仅 `MessageWebSocketConfiguration` 生效：注册 `WebSocketSessionManager`、
  `PlusWebSocketHandler`、`PlusWebSocketInterceptor`、`WebSocketConfigurer`、`MessageTopicListener`。
- 两套都实现了 `PushSessionManager` 接口，所以 `PushHelper.getSessionManager()` 拿到的实现随配置切换，
  **业务调用方完全无感**。

## 7. 前端连接路径

两种传输前端连接地址都基于 `message.path`（默认 `/resource/message`，握手都需带登录态）：

- **SSE**：`new EventSource('/resource/message')`（`SseController` 用 `GET ${message.path}` 映射，
  返回 `text/event-stream`；另有 `${message.path}/close` 用于主动断开）。鉴权走统一登录态，
  `SseController.connect()` 内用 `StpUtil.getTokenValue()` + `LoginHelper.getUserId()` 识别用户。
- **WebSocket**：`new WebSocket('ws(s)://host/resource/message')`，握手由 `PlusWebSocketInterceptor`
  在 `beforeHandshake` 里用 `LoginHelper.getLoginUser()` + `StpUtil.getTokenValue()` 写入会话属性，
  无登录态 `PlusWebSocketHandler.afterConnectionEstablished` 会 `close(CloseStatus.BAD_DATA)`。
  心跳约定：客户端发文本 `ping`，服务端回 `pong`（`MessageConstants.PING/PONG`）。

> 默认路径前缀 `/resource` 通常已在鉴权白名单/网关侧放行（保持与框架默认一致即可），
> 改 `message.path` 时记得同步前端连接地址与网关转发规则。

## 8. 常见错误对比（核对源码）

### 错误 1：集群下用 sendMessage 导致"部分用户收不到"

```java
// ❌ 错误：sendMessage 只发当前节点本地会话，集群下别的节点的用户收不到
PushHelper.sendMessage(userId, payload);

// ✅ 正确：publishMessage 走 Redis topic，集群所有节点都能送达
PushHelper.publishMessage(List.of(userId), payload);
```

### 错误 2：直接注入 / new 底层会话管理器

```java
// ❌ 错误：业务层不应感知具体传输实现，且 new 出来的不受 Spring 管理、没心跳没集群
SseEmitterSessionManager mgr = new SseEmitterSessionManager(...);
mgr.sendMessage(userId, "...");

// ✅ 正确：永远只调 PushHelper 静态方法，传输实现由配置自动选
PushHelper.sendMessage(userId, "...");
```

### 错误 3：手写 SseEmitter / WebSocketSession 自建推送通道

```java
// ❌ 错误：绕过统一模块自己写 @GetMapping 返回 SseEmitter，
//          既无统一鉴权/心跳/集群，又破坏 "一套 API 两种传输" 的约定
@GetMapping(value = "/my/sse", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter custom() { return new SseEmitter(); }

// ✅ 正确：业务只产生消息，发送统一交给 PushHelper；连接由框架的 SseController/WS handler 统一管理
PushPayloadDTO payload = PushPayloadDTO.of(PushTypeEnum.LLM, PushSourceEnum.LLM, chunk, null);
PushHelper.sendMessage(userId, payload);
```

### 错误 4：以为关了 transport 就关了推送

```yaml
# ❌ 误解：把 transport 改成别的值并不能"关闭"推送，MessageTransportEnum.of() 找不到会回落 sse
message:
  transport: none   # 实际仍会按 sse 装配

# ✅ 正确：要彻底关闭推送用 enabled
message:
  enabled: false
```

## 9. 最佳实践

1. **业务层只认 `PushHelper`**：从不出现 `SseEmitter` / `WebSocketSession` / `SseEmitterSessionManager`
   / `WebSocketSessionManager`。换传输只改 `message.transport`，业务零改动。
2. **集群一律 publish 系列**：`publishMessage` / `publishAll` 走 Redis topic，跨节点送达；
   `sendMessage` 只用于"明确单机 / 调试 / 确知用户在本节点"的场景。
3. **优先用枚举构建消息体**：`PushPayloadDTO.of(PushTypeEnum.x, PushSourceEnum.y, ...)` 比字符串字面量
   更安全；需要前端点击跳转时用带 `path` 的重载。
4. **type / source 语义化**：通知用 `NOTICE`、AI 流式用 `LLM`、工作流提醒用 `WORKFLOW`，便于前端按
   type/source 分流渲染。
5. **心跳 / 超时走配置**：SSE 默认 24h 超时、60s 心跳；WebSocket 心跳同样 60s 清理 + `ping/pong`。
   高并发或弱网下按需调 `heartbeat-interval`、`sse-timeout`、`web-socket-send-time-limit`。
6. **多端在线天然支持**：会话以 `userId -> (token -> 连接)` 存储，同一用户多设备各持一条连接，
   单发会下发到该用户**所有**在线连接，无需业务额外处理。
7. **不要在 Controller 里暴露"发消息"接口**：`SseController` 里注释掉的 `/send`、`/sendAll`
   是 demo，源码已明确标注"禁止使用，请在业务逻辑中用工具发送"——发送一律走 `PushHelper`。
8. **关推送用 enabled**：`message.enabled=false` 会让整个 `MessageAutoConfiguration` 不装配，
   同时 `PushHelper.isEnabled()` 兜底拦截，干净彻底。

## 10. 6.x 铁律（务必遵守）

- 包名一律 `org.dromara.*`：本模块 `org.dromara.common.push.*`，消息体 `org.dromara.system.api.domain.PushPayloadDTO`，
  枚举 `org.dromara.common.core.enums.PushTypeEnum / PushSourceEnum`。
- ❌ 禁止出现 `plus.ruoyi` / `com.ruoyi` 包名（那是旧版 / uniapp 二开版的约定，框架不用）。
- ❌ 本模块与 DAO 层 / `PlusLambdaQuery` / `likeCast` / `TenantEntity`（默认） / `is_deleted` / `AForm` /
  `@/wd` / `plus-uniapp` 等约定无关——推送不碰持久层与前端 UI 组件库，不要把这些概念套进来。
- 鉴权统一走 Sa-Token（`StpUtil` / `LoginHelper`），连接的用户身份由统一登录态识别，业务不自管 token。
- 发送统一走 `PushHelper`，连接统一由 `SseController` / `PlusWebSocketHandler` 管理，不要另起炉灶。

## 引用的真实源文件

- `backend/java/ruoyi-common/ruoyi-common-push/.../helper/PushHelper.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../core/PushSessionManager.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../core/SseEmitterSessionManager.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../core/WebSocketSessionManager.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../dto/PushDTO.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../enums/MessageTransportEnum.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../annotation/ConditionalOnMessageTransport.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../condition/MessageTransportCondition.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../config/MessageAutoConfiguration.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../config/MessageSseConfiguration.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../config/MessageWebSocketConfiguration.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../controller/SseController.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../handler/PlusWebSocketHandler.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../interceptor/PlusWebSocketInterceptor.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../listener/MessageTopicListener.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../properties/MessageProperties.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../constant/MessageConstants.java`
- `backend/java/ruoyi-common/ruoyi-common-push/.../resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- `backend/java/ruoyi-api/.../system/api/domain/PushPayloadDTO.java`
- `backend/java/ruoyi-common/ruoyi-common-core/.../enums/PushTypeEnum.java`
- `backend/java/ruoyi-common/ruoyi-common-core/.../enums/PushSourceEnum.java`
- `backend/java/ruoyi-admin/src/main/resources/application.yml`（`message:` 段）
