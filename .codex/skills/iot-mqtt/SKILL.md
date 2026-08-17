---
name: iot-mqtt
description: |
  本项目 MQTT 物联网通信开发指南，基于 mica-mqtt 客户端 starter。涵盖 Broker 连接配置、订阅（@MqttClientSubscribe 注解 / 全局监听）、发布（MqttClientTemplate）、QoS 等级、Topic 设计、设备上下线状态、集群与共享订阅扩展指引。所有内容基于 ruoyi-common-mqtt 真实源码。

  触发场景：
  - 接入 MQTT Broker（EMQX / Mosquitto / mica 自带 server），开发物联网设备通信
  - 编写 MQTT 订阅/发布逻辑，处理设备上行消息、下发控制指令
  - 处理设备上线/离线状态、遗嘱消息、保留消息、QoS 与 Topic 通配符
  - 排查 MQTT 连不上 Broker、clientId 冲突被踢、订阅收不到消息等问题

  触发词：MQTT、物联网、IoT、设备通信、设备消息、mica-mqtt、publish、subscribe、QoS、Topic、EMQX、Mosquitto、共享订阅、设备上线、设备离线、遗嘱消息、保留消息、传感器、iot-mqtt
---

# iot-mqtt — MQTT 物联网通信

## 概述

本项目的 MQTT 能力封装在 `ruoyi-common-mqtt` 模块，底层基于 **mica-mqtt**（`org.dromara.mica-mqtt`，原 `net.dreamlu`，国产开源、纯 Java/AIO、t-io 网络框架）的 **客户端 starter**：`mica-mqtt-client-spring-boot-starter`，版本由根 `pom.xml` 的 `<mica-mqtt.version>2.6.6</mica-mqtt.version>` 统一管理。

**本仓库封装的完整度（重要，先看清边界）**：

| 能力 | 是否本仓库已封装 | 说明 |
|------|----------------|------|
| 自动配置 + 虚拟线程优化 | ✅ 已封装 | `MqttAutoConfiguration`，用 JDK 虚拟线程替换 tio 线程池 |
| 连接状态监听（上线/离线日志） | ✅ 已封装骨架 | `MqttClientConnectListener`，**仅打印日志**，业务逻辑需自己补 |
| 全局消息监听 | ✅ 已封装骨架 | `MqttClientGlobalMessageListener`，**仅打印日志**，业务逻辑需自己补 |
| 发布 `MqttClientTemplate` | ⬜ mica-mqtt 原生提供 | 直接注入即可用，本仓库未二次封装 |
| 注解订阅 `@MqttClientSubscribe` | ⬜ mica-mqtt 原生提供 | demo 模块 `MqttController` 有真实示例 |
| 遗嘱消息 / 保留消息 / 共享订阅 | ⬜ mica-mqtt 原生能力 | 本仓库未封装，需用原生 API 自行启用（见下文扩展指引） |
| MQTT Server（Broker） | ❌ 不在本仓库 | 本仓库只做**客户端**，Broker 用 EMQX/Mosquitto 或 mica 自带 server 单独部署 |

**结论**：本仓库 MQTT 属于「**轻封装客户端接入层**」——只提供了自动配置（含虚拟线程优化）和两个**只打日志的监听器骨架**。真正的发布/订阅/QoS/遗嘱/共享订阅全部是 **mica-mqtt 原生能力**，本 skill 既覆盖本仓库已封装部分，也给出原生能力的扩展指引。

> **6.x 铁律**：包名 `org.dromara.common.mqtt`（不是 `plus.ruoyi` / `com.ruoyi`）；本模块无 Entity/DAO，纯通信层。

### 模块结构（真实文件）

```
ruoyi-common/ruoyi-common-mqtt/
├── pom.xml                                          # 依赖 mica-mqtt-client-spring-boot-starter + common-core + common-json
└── src/main/
    ├── java/org/dromara/common/mqtt/
    │   ├── config/MqttAutoConfiguration.java        # 自动配置：注册监听器 Bean + 虚拟线程定制
    │   └── listener/
    │       ├── MqttClientConnectListener.java        # 连接/断开监听（IMqttClientConnectListener）
    │       └── MqttClientGlobalMessageListener.java  # 全局消息监听（IMqttClientGlobalMessageListener）
    └── resources/META-INF/spring/
        └── org.springframework.boot.autoconfigure.AutoConfiguration.imports  # 注册自动配置
```

demo 示例（真实文件，订阅/发布范例）：
`ruoyi-modules/ruoyi-demo/src/main/java/org/dromara/demo/controller/MqttController.java`

## 引入与启用

### 1. 模块依赖

`ruoyi-common-mqtt` 已在 BOM 注册。在需要 MQTT 的业务模块 `pom.xml` 引入（参考 `ruoyi-demo/pom.xml`）：

```xml
<dependency>
    <groupId>org.dromara</groupId>
    <artifactId>ruoyi-common-mqtt</artifactId>
</dependency>
```

### 2. 开关（默认关闭）

自动配置带 `@ConditionalOnProperty(value = "mqtt.client.enabled", havingValue = "true")`，**默认 `enabled: false` 不启动**。要启用，在 `application.yml` 设 `mqtt.client.enabled: true`。

## 连接配置

配置根为 **`mqtt.client`**（注意是 mica-mqtt starter 的原生前缀，不是 `mqtt.*`）。`ruoyi-admin/src/main/resources/application.yml` 真实片段：

```yaml
--- # mqtt 配置
# https://mica-mqtt.dreamlu.net/guide/spring/client.html
mqtt.client:
  enabled: false                 # 是否开启客户端，默认 true（本仓库默认设为 false）
  ip: 127.0.0.1                  # Broker 地址，默认 127.0.0.1
  port: 1883                     # Broker 端口，默认 1883
  name: Mqtt-Client             # 客户端名称
  client-id: 000001             # 客户端 Id（非常重要，一般为设备 sn，全局不可重复）
  username: ruoyi               # 认证用户名
  password: 123456             # 认证密码
  timeout: 5                    # 连接超时（秒），默认 5
  re-interval: 5000             # 重连间隔（毫秒），默认 5000
  version: mqtt_5              # 协议版本：MQTT_3_1 / mqtt_3_1_1 / mqtt_5，默认 mqtt_5
  read-buffer-size: 8KB        # 接收 buffer，默认 8k
  max-bytes-in-message: 10MB   # 单条消息最大字节，默认 10M
  keep-alive-secs: 60          # 心跳保活（秒）
  session-expiry-interval-secs: 0  # 保留 session 时的有效期
  mqtt-executor-size: 2        # 工作线程数，做 emqx 转发等大消息量时调大
  ssl:                         # SSL/TLS 双向认证（默认关闭）
    enabled: false
    keystore-path:
    keystore-pass:
    truststore-path:
    truststore-pass:
```

**关键点**：

- `client-id` 必须**全局唯一**：同一 clientId 重复连接会被 Broker 互踢（典型现象：设备频繁掉线重连）。生产中常用「设备 sn」或「业务前缀 + sn」。
- `version` 默认 `mqtt_5`，需要兼容老设备时降到 `mqtt_3_1_1`。
- SSL 走 `mqtt.client.ssl.*`，需提供 keystore/truststore；端口通常改为 `8883`。

### 虚拟线程优化（本仓库特有）

`MqttAutoConfiguration#mqttClientCustomizer()` 用 JDK 21 **虚拟线程**（`VirtualThreadTaskExecutor`）替换 mica-mqtt 默认的 tio/group/biz 线程池，三个执行器分别命名 `tio-worker-virtual` / `tio-group-virtual` / `biz-worker-virtual`。这是本仓库针对高并发设备连接做的性能优化，**无需手动配置**，引入即生效。

## 订阅

### 方式一：注解订阅 `@MqttClientSubscribe`（推荐，最常用）

mica-mqtt 原生注解 `org.dromara.mica.mqtt.core.annotation.MqttClientSubscribe`，标注在 **Spring Bean 的方法**上即自动订阅。来自真实 `MqttController`：

```java
import org.dromara.mica.mqtt.codec.MqttQoS;
import org.dromara.mica.mqtt.core.annotation.MqttClientSubscribe;

// QoS0 + 通配符 #（匹配 /test 下任意层级）
@MqttClientSubscribe("/test/#")
public void subQos0(String topic, byte[] payload) {
    log.info("topic:{} payload:{}", topic, new String(payload, StandardCharsets.UTF_8));
}

// 指定 QoS1
@MqttClientSubscribe(value = "/qos1/#", qos = MqttQoS.QOS1)
public void subQos1(String topic, byte[] payload) {
    log.info("topic:{} payload:{}", topic, new String(payload, StandardCharsets.UTF_8));
}
```

**Topic 占位符 `${}`**（mica-mqtt 1.3.8+）：注解里的 `${}` 默认替换成单层通配符 `+`；注意 mica-mqtt 会**先用 Spring Boot 配置替换 `${}`**，配置里存在同名 key 时优先取配置值，要小心避免冲突：

```java
// /sys/+/+/thing/sub/register —— productKey、deviceName 各为一层通配
@MqttClientSubscribe("/sys/${productKey}/${deviceName}/thing/sub/register")
public void thingSubRegister(String topic, byte[] payload) {
    log.info("topic:{} payload:{}", topic, new String(payload, StandardCharsets.UTF_8));
}
```

**自动反序列化**（mica-mqtt 2.4.5+）：注解 `deserialize` 指定反序列化器（默认 JSON），方法参数支持 2~3 个，按类型自动映射：

```java
import org.dromara.mica.mqtt.codec.message.MqttPublishMessage;
import org.dromara.mica.mqtt.core.deserialize.MqttJsonDeserializer;

@MqttClientSubscribe(value = "/test/json", deserialize = MqttJsonDeserializer.class)
public void testJson(String topic, MqttPublishMessage message, TestDemo data) {
    // 参数映射规则：
    //   String           → topic
    //   MqttPublishMessage → 原始消息（可拿到 mqtt5 的 props）
    //   byte[] / ByteBuffer → payload 原始字节
    //   其他类型          → 走 deserialize（默认 json）反序列化
    log.info("topic:{} json data:{}", topic, data);
}
```

### 方式二：全局消息监听（本仓库已封装骨架）

`MqttClientGlobalMessageListener implements IMqttClientGlobalMessageListener`，能监听到**所有订阅**的消息，已在 `MqttAutoConfiguration` 注册为 Bean。当前实现**只打日志**，业务逻辑需自己在 `onMessage` 里补：

```java
@Slf4j
public class MqttClientGlobalMessageListener implements IMqttClientGlobalMessageListener {
    @Override
    public void onMessage(ChannelContext context, String topic, MqttPublishMessage message, byte[] payload) {
        log.info("MqttGlobalMessageEvent => topic: {}, msg: {}", topic, new String(payload, StandardCharsets.UTF_8));
        // TODO 业务：按 topic 路由、落库、转发 SSE/WebSocket 给前端…
    }
}
```

> 全局监听适合「统一审计 / 网关式转发」；具体业务订阅优先用 `@MqttClientSubscribe`，职责更清晰。

## 发布

mica-mqtt 原生提供 `org.dromara.mica.mqtt.spring.client.MqttClientTemplate`，注入即用（本仓库未二次封装）。来自真实 `MqttController`：

```java
import org.dromara.mica.mqtt.spring.client.MqttClientTemplate;
import org.springframework.context.annotation.Lazy;

@Lazy                          // 关键：用 @Lazy 避免与 starter 初始化顺序冲突
@Autowired
private MqttClientTemplate client;

@GetMapping("/send")
public boolean send() {
    client.publish("/test/client", "测试测试".getBytes(StandardCharsets.UTF_8));
    return true;
}
```

**注意**：注入 `MqttClientTemplate` **必须加 `@Lazy`**（demo 真实写法），否则容易在 starter 客户端尚未就绪时触发初始化顺序问题。`publish(topic, byte[])` 是最常用重载；mica-mqtt 还提供带 QoS、retain（保留消息）的重载，需要时查 mica-mqtt 官方文档。

## QoS 与 Topic 设计

### QoS 三级（`org.dromara.mica.mqtt.codec.MqttQoS`）

| 枚举 | 等级 | 语义 | 适用场景 |
|------|------|------|---------|
| `MqttQoS.QOS0` | 0 | 最多一次，不保证送达 | 高频传感器上报（温湿度、心跳），丢一两条无所谓 |
| `MqttQoS.QOS1` | 1 | 至少一次，可能重复 | 设备控制指令、告警（业务需做幂等去重） |
| `MqttQoS.QOS2` | 2 | 恰好一次，开销最大 | 计费、不可重复的关键指令 |

订阅时通过注解 `qos = MqttQoS.QOS1` 指定；不写默认 QoS0。

### Topic 设计约定（业界 + 本仓库 demo 风格）

- **分层斜杠**：`/{业务域}/{产品}/{设备}/{动作}`，如 demo 的 `/sys/${productKey}/${deviceName}/thing/sub/register`。
- **上下行分离**：上行（设备→平台）用 `.../post`，下行（平台→设备）用 `.../set` 或 `.../cmd`，避免设备订阅到自己发的消息形成回环。
- **通配符**：`+` 匹配**单层**，`#` 匹配**多层**（只能放末尾）。平台侧网关用 `#` 全收，设备侧只订自己的精确 topic。
- **禁忌**：topic 不要以 `/` 开头时混用、不要在 topic 里放高基数变量（如时间戳），否则 Broker 订阅树膨胀。

## 设备上下线状态

`MqttClientConnectListener implements IMqttClientConnectListener`（本仓库已注册 Bean），回调里处理本客户端自身的连接/断开。当前实现**只打日志**，业务逻辑需自己补：

```java
@Slf4j
public class MqttClientConnectListener implements IMqttClientConnectListener {
    @Override
    public void onConnected(ChannelContext context, boolean isReconnect) {
        log.info("MqttConnectedEvent:{}", context);
        // TODO：上线后重新订阅 / 上报在线状态 / 标记设备 online
    }
    @Override
    public void onDisconnect(ChannelContext context, Throwable throwable, String remark, boolean isRemove) {
        log.info("MqttDisconnectEvent:{}", context, throwable);
        // 源码注释保留了「断线时更新 clientId/username/password」示例（被注释掉），
        // 适用于 token 过期需换凭据重连的场景：
        // mqttClientCreator.clientId(...).username(...).password(...);
    }
}
```

> ⚠️ 区分两类「上下线」：上面这个监听的是**本服务作为 MQTT 客户端**自身的连接状态。要感知「**海量终端设备**的上下线」，正确做法是订阅 Broker 的系统主题（EMQX 的 `$SYS/brokers/+/clients/+/connected|disconnected`）或用设备**遗嘱消息（LWT）**，而非这个监听器。

## 代码示例（≥5，基于真实类）

### 示例 1：开启 MQTT 客户端（配置）

```yaml
mqtt.client:
  enabled: true                # 改为 true 才会启动（默认 false）
  ip: 192.168.1.100
  port: 1883
  client-id: device-sn-000001  # 必须全局唯一
  username: iot_user
  password: iot_pass
  version: mqtt_5
```

### 示例 2：订阅设备上报 + 落库（业务 Service 中）

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class DeviceReportSubscriber {

    private final IDeviceDataService deviceDataService;

    // 订阅所有产品下所有设备的属性上报（+ 单层通配）
    @MqttClientSubscribe("/sys/+/+/thing/property/post")
    public void onPropertyPost(String topic, byte[] payload) {
        String json = new String(payload, StandardCharsets.UTF_8);
        log.info("设备属性上报 topic={} payload={}", topic, json);
        deviceDataService.saveReport(topic, json);   // 业务落库
    }
}
```

### 示例 3：JSON 自动反序列化订阅

```java
@MqttClientSubscribe(value = "/sys/+/+/event/alarm", deserialize = MqttJsonDeserializer.class)
public void onAlarm(String topic, MqttPublishMessage message, DeviceAlarm alarm) {
    // alarm 已由 JSON 自动反序列化；message 可拿 mqtt5 props
    log.warn("设备告警 topic={} level={} msg={}", topic, alarm.getLevel(), alarm.getMessage());
}
```

### 示例 4：平台下发控制指令（发布）

```java
@Service
@RequiredArgsConstructor
public class DeviceCommandService {

    @Lazy
    @Autowired
    private MqttClientTemplate client;

    /** 向指定设备下发指令，下行 topic 用 /set 与上行分离 */
    public boolean sendCommand(String productKey, String deviceName, String cmdJson) {
        String topic = String.format("/sys/%s/%s/thing/service/set", productKey, deviceName);
        return client.publish(topic, cmdJson.getBytes(StandardCharsets.UTF_8));
    }
}
```

### 示例 5：上线后重新订阅 + 在线状态标记（扩展连接监听）

> 思路示例：在 `MqttClientConnectListener.onConnected` 里调业务（需把业务 Bean 注入监听器，可在 `MqttAutoConfiguration` 改造构造参数注入）。

```java
@Override
public void onConnected(ChannelContext context, boolean isReconnect) {
    log.info("MQTT 已连接 reconnect={} ctx={}", isReconnect, context);
    if (isReconnect) {
        // 断线重连后，按需补订阅 / 重发在线心跳
        deviceStatusService.markGatewayOnline();
    }
}
```

### 示例 6：全局监听做统一转发（把 MQTT 消息推给前端 SSE/WebSocket）

```java
@Override
public void onMessage(ChannelContext context, String topic, MqttPublishMessage message, byte[] payload) {
    String msg = new String(payload, StandardCharsets.UTF_8);
    log.info("全局 MQTT topic={} msg={}", topic, msg);
    // 复用本仓库 ruoyi-common-sse / websocket 能力，把设备消息实时推给监控大屏
    // SseMessageUtils.publishMessage(...);  // 详见 realtime-communication skill
}
```

## 常见错误对比（≥3）

### 错误 1：以为引入依赖就会连 Broker

| ❌ 错误 | ✅ 正确 |
|--------|--------|
| 引入 `ruoyi-common-mqtt`，期望自动连上 MQTT | 自动配置带 `@ConditionalOnProperty("mqtt.client.enabled"=true)`，且 `application.yml` 默认 `enabled: false`，**必须显式改 true** 才启动客户端 |

### 错误 2：用错配置前缀

| ❌ 错误 | ✅ 正确 |
|--------|--------|
| 配 `mqtt.ip` / `mqtt.broker.url` / `spring.mqtt.*` | 前缀是 mica-mqtt starter 原生的 **`mqtt.client`**（`mqtt.client.ip` / `mqtt.client.port` …），写错前缀配置不生效，仍连默认 `127.0.0.1:1883` |

### 错误 3：多实例/多设备共用同一 client-id

| ❌ 错误 | ✅ 正确 |
|--------|--------|
| 所有节点/设备都用 `client-id: 000001` | clientId 全局唯一，重复连接会被 Broker 互踢导致**频繁掉线重连**。集群部署用「前缀 + 实例标识」，设备用 sn |

### 错误 4：注入 MqttClientTemplate 不加 @Lazy

| ❌ 错误 | ✅ 正确 |
|--------|--------|
| `@Autowired private MqttClientTemplate client;`（无 `@Lazy`） | demo 真实写法是 `@Lazy @Autowired`，避免与 starter 客户端初始化顺序冲突导致启动异常 |

### 错误 5：把「本客户端连接监听」当成「终端设备上下线」

| ❌ 错误 | ✅ 正确 |
|--------|--------|
| 在 `MqttClientConnectListener` 里统计成千上万台设备的在线数 | 该监听只反映**本服务自身**作为 MQTT 客户端的连接。海量设备上下线靠 Broker 系统主题（`$SYS/.../connected`）或设备遗嘱消息 LWT |

## 扩展指引：本仓库未封装、需用 mica-mqtt 原生能力

下列均为 **mica-mqtt 通用能力**，本仓库未做封装，需要时按 mica-mqtt 官方文档（`https://mica-mqtt.dreamlu.net`）启用：

- **遗嘱消息（LWT / Last Will）**：在 `MqttClientCustomizer` 里通过 `creator.willMessage(...)` 配置，设备异常断开时 Broker 自动发布遗嘱到指定 topic（常用于设备离线通知）。本仓库 `mqttClientCustomizer()` 当前只配了虚拟线程，可在此追加遗嘱。
- **保留消息（Retained）**：发布时用 mica-mqtt 带 `retain=true` 的 `publish` 重载，新订阅者上线即收到该 topic 最后一条保留消息（适合下发设备「最新配置/状态」）。
- **共享订阅（集群必备）**：MQTT5 / EMQX 用 `$share/{group}/{topic}` 前缀（如 `$share/g1/sys/+/+/property/post`），多个后端实例分摊消费同一 topic，避免集群下每个实例都重复处理同一条消息。直接把共享前缀写进 `@MqttClientSubscribe` 的 topic 即可（依赖 Broker 支持）。
- **断线换凭据重连**：`MqttClientConnectListener.onDisconnect` 源码注释里保留了示例——token/密码过期时通过 `mqttClientCreator.clientId(...).username(...).password(...)` 更新后由框架自动重连。
- **MQTT Server（Broker）**：本仓库只做客户端。自建 Broker 用 EMQX / Mosquitto，或 mica 自带 `mica-mqtt-server-spring-boot-starter`（见官方 server 文档），本仓库未引入。

## 最佳实践

1. **生产 clientId 唯一性**：用「业务前缀-实例号」或设备 sn，禁止硬编码固定值；集群多实例务必区分。
2. **凭据外置**：`username/password` 走 `${ENV:default}` 环境变量占位，不要明文进生产配置（参考 env-config skill）。
3. **QoS 按需选级**：高频遥测用 QoS0 省开销，控制指令用 QoS1 + 业务幂等去重，关键计费才用 QoS2。
4. **Topic 上下行分离 + 命名规范**：上行 `/post`、下行 `/set`，平台网关订阅用 `#`/`+`，设备只订自己的精确 topic。
5. **集群上共享订阅**：多实例部署必须用 `$share/group/...` 共享订阅（依赖 Broker），否则一条上报被每个实例重复处理。
6. **监听器只做轻逻辑**：`onMessage`/`onConnected` 里别做重 IO 阻塞；落库/转发交给异步线程或消息队列（本仓库已用虚拟线程，但耗时业务仍建议异步化）。
7. **消息编码统一 UTF-8**：payload 收发统一 `StandardCharsets.UTF_8`（与全仓库 UTF-8 无 BOM 规范一致），避免中文乱码。
8. **复用本仓库实时推送**：设备消息要推前端监控大屏时，在全局监听里复用 `ruoyi-common-sse` / WebSocket（详见 realtime-communication skill），不要另造轮子。
9. **SSL 生产建议**：对接公网 Broker 时开启 `mqtt.client.ssl.enabled` + 8883 端口 + 双向证书。
10. **不要在监听器里假定 Broker 行为**：遗嘱、保留、共享订阅是否生效取决于 Broker（EMQX 全支持，Mosquitto 部分支持），上线前在目标 Broker 实测。

## 关联技能

- `realtime-communication`：把 MQTT 设备消息通过 SSE/WebSocket 实时推给前端
- `env-config`：MQTT 连接凭据的多环境配置与环境变量占位
- `redis-cache`：设备在线状态、最近上报数据缓存
- `architecture-design`：IoT 平台分层与设备接入架构
