---
name: snail-ai-integration
description: |
  当需要在 本项目 中集成、接入或扩展 Snail AI（com.aizuda 0.0.5）大模型对话 / Agent / OpenAPI 能力时自动使用此 Skill。

  触发场景：
  - 需要接入 Snail AI 智能对话 / Agent 聊天室 / AI 助手，把 RuoYi 当作 Snail AI 客户端网关
  - 需要为业务模块新增 AI 接口（agent-chat 网关接口 或 普通 OpenAPI 接口），并搞清返回结构该用 Result 还是 R
  - 需要配置 snail-ai（Server gRPC 地址、app-id、token、open-api、超时），或排查 enabled=false / 前端 SDK 解析失败 / 5001 认证失败
  - 需要把当前登录用户注册成 Snail AI OpenAPI 用户（externalId=userId），或独立部署 ruoyi-snailai-server

  触发词：AI、Snail AI、SnailAI、大模型、AI对话、Agent、聊天、ai-integration、snail-ai、OpenAPI、AI集成、智能助手
---

# Snail AI 集成（snail-ai-integration）

> 适用框架：base-dev-framework6-java（包名 `org.dromara`，依赖 `com.aizuda:snail-ai-* 0.0.5`）。
> 本仓库 **不使用 langchain4j**（全仓 grep 无 `dev.langchain4j` 依赖），AI 能力一律走 Snail AI。涉及 AI 集成请优先读本 Skill，不要凭印象套用其它框架的 AI SDK 写法。

## 一、概述：Snail AI 三段式架构

Snail AI 由蚂蚁开源（`com.aizuda`，版本 `0.0.5`，与 SnailJob 同源）。它把"大模型治理 + Agent 执行 + 对话网关"拆成三段，RuoYi 在中间充当 **client / 网关**，既不直接持有大模型 Key，也不直接被前端 SDK 当作模型服务。

```
┌──────────────────────────────┐    gRPC :18888 (Server 分发 Chat)    ┌──────────────────────────────────────┐
│  ① SnailAI Server（独立进程） │  ◄────────────────────────────────►  │  ② RuoYi 应用（client / 网关）        │
│  ruoyi-snailai-server         │    HTTP  :8900 (OpenAPI / Chat 网关) │  ruoyi-common-ai + ruoyi-ai 模块      │
│  com.aizuda:snail-ai-starter  │                                     │  snail-ai-agent-chat-starter           │
│                               │                                     │  snail-ai-agent-executor-starter       │
│  · 模型管理（接各家大模型）   │                                     │  snail-ai-openapi-starter              │
│  · 应用管理（app-id / token） │                                     │  · agent-chat 网关（SDK Result 结构）  │
│  · Key / 资源 / RAG / 记忆    │                                     │  · agent-executor（执行 Agent / Skill）│
│  context-path: /snail-ai      │                                     │  · openapi client（注册用户 / 调能力） │
└──────────────────────────────┘                                     └───────────────┬──────────────────────┘
                                                                                       │ HTTP /api/snail/chat/**
                                                                                       ▼
                                                                       ┌──────────────────────────────────────┐
                                                                       │  ③ 前端 SDK（plus-ui / plus-uniapp）   │
                                                                       │  Snail AI Web SDK 直连 Chat 网关       │
                                                                       │  按 Result(status/message/data) 解析   │
                                                                       └──────────────────────────────────────┘
```

三段职责：

| 段 | 物理形态 | 关键端口 | 在本仓库的位置 | 职责 |
|----|---------|---------|---------------|------|
| ① SnailAI Server | 独立 Spring Boot 进程，可独立部署 / 容器化 | gRPC `18888`、HTTP `8900`（context-path `/snail-ai`） | `backend/java/ruoyi-extend/ruoyi-snailai-server/`（`snail-ai-starter`） | 管模型 / 应用 / Key / 资源 / RAG / 短期记忆；下发 Chat 请求 |
| ② RuoYi client | 主应用内的两个模块 | 客户端 gRPC `18889`（接收 Server 分发） | `backend/java/ruoyi-common/ruoyi-common-ai/` + `backend/java/ruoyi-modules/ruoyi-ai/` | agent-chat 网关 + agent-executor + openapi client |
| ③ 前端 SDK | 浏览器 / 小程序内的 Snail AI Web SDK | 直连 ② 的 HTTP 网关 | plus-ui / plus-uniapp | 渲染对话，按 `Result` 结构解析响应 |

> **为什么要独立 Server？** 大模型 Key、应用 Token、模型路由都集中在 Server 治理，RuoYi 不落任何大模型厂商 Key，只持有 Server 颁发的 `app-id` + `token`（`SAI_*`）。Server 可单独扩容、独立升级，与业务进程解耦。

### ② RuoYi client 的三个 starter（`ruoyi-common-ai/pom.xml` 实测）

```xml
<!-- Snail AI Agent 聊天室 -->
<dependency>
    <groupId>com.aizuda</groupId>
    <artifactId>snail-ai-agent-chat-starter</artifactId>
</dependency>
<!-- Snail AI Agent 执行器 -->
<dependency>
    <groupId>com.aizuda</groupId>
    <artifactId>snail-ai-agent-executor-starter</artifactId>
</dependency>
<!-- Snail AI OpenAPI 启动器 -->
<dependency>
    <groupId>com.aizuda</groupId>
    <artifactId>snail-ai-openapi-starter</artifactId>
</dependency>
```

版本统一由根 `pom.xml` 的 `<snailai.version>0.0.5</snailai.version>` 管理（`dependencyManagement` 三段 starter 都引用它）。`backend/java/ruoyi-modules/ruoyi-ai` 在此基础上额外引入 `ruoyi-common-satoken` + `ruoyi-common-web`，对外提供 `/snail-ai/**` 普通接口。

## 二、配置（`backend/java/ruoyi-admin/.../application-dev.yml` 的 `snail-ai:` 段）

```yaml
--- # snail-ai 配置
snail-ai:
  # 启用客户端模式 —— 🔴 默认 false！不打开则 SnailAiConfig 不装配，所有 AI 能力不生效
  enabled: false
  # ==================== Server 连接（client → Server gRPC） ====================
  server:
    host: 127.0.0.1
    port: 18888            # Server 端 gRPC 端口（= snail-ai-starter 的 snail-ai.server.grpc-port）
  # ==================== 客户端配置 ====================
  app-id: 1                                       # 应用 ID（在 Server「应用管理」创建后获取）
  token: SAI_566a6bfbc26e4998b4841cc927d50c5d     # 认证令牌（Server 创建应用时自动生成，SAI_ 前缀）
  port: 18889                                     # 本客户端 gRPC 端口（Server 通过此端口分发 Chat 请求）
  skill-temp-dir: /tmp/snail-ai-agent/skills      # Skill 文件临时目录
  # ==================== OpenAPI Client 配置 ====================
  open-api:
    enabled: true
    web-port: 8900          # Server HTTP 端口
    https: false
    prefix: snail-ai        # API 路径前缀（对应 Server context-path /snail-ai）
    connect-timeout-ms: 5000
    read-timeout-ms: 60000
    chat-timeout-ms: 300000 # 对话超时 5 分钟（流式长会话，别调太小）
```

### 🔴 token 是敏感凭据，禁止硬编码进仓库

`token: SAI_*` 与 Server 端的 `crypto.secret-key` / `crypto.iv` 都是凭据。dev.yml 里的值仅用于本地起步：

- **生产环境**：从 `application-prod.yml` 用 `${SNAIL_AI_TOKEN}` 占位读环境变量，绝不把真实 `SAI_*` 提交。
- Server 端同理：`secret-key: ${SNAIL_AI_CRYPTO_KEY:...}`、`iv: ${SNAIL_AI_CRYPTO_IV:...}`（`application.yml` 已用占位符，prod 务必通过环境变量覆盖默认值）。
- 修改环境配置走 `env-config` Skill 的规范；提交前确认 prod 文件无明文 `SAI_*`。

> 端口速记：Server gRPC `18888` / Server HTTP `8900`（context-path `/snail-ai`，Dockerfile `EXPOSE 8900 18888`）/ client gRPC `18889`。三个端口三件事，别混。

## 三、接入流程

```
1. 起 Server   → 启动 ruoyi-snailai-server（独立进程），在「模型管理」接大模型、「应用管理」建应用拿 app-id + token(SAI_*)
2. 配 client   → application-{env}.yml 的 snail-ai 段填 server.host/port、app-id、token；snail-ai.enabled = true
3. 装配生效    → SnailAiConfig @ConditionalOnProperty 命中，@EnableSnailAiAgent + @EnableSnailAiOpenApi 装配 chat 网关 / executor / openapi
4. 注册用户    → 前端先调 POST /snail-ai/user/register，把当前登录用户注册成 OpenAPI 用户（externalId = userId）
5. 前端对话    → 前端 SDK 直连 agent-chat 网关 /api/snail/chat/**，按 Result(status/message/data) 解析
```

**第 1 步（开关）是最常见的坑**：`enabled` 默认 `false`，不显式置 `true`，`SnailAiConfig` 的 `@ConditionalOnProperty(prefix="snail-ai", name="enabled", havingValue="true")` 不命中，整个自动配置类不装配 —— 表现为"接口 404 / Bean 找不到 / SDK 连不上"，而不是报错。排查 AI 不生效，**第一件事就是看 `snail-ai.enabled`**。

## 四、代码示例（均从真实类提炼）

### 示例 1：自动配置开关（`ruoyi-common-ai/config/SnailAiConfig.java` 原文）

```java
package org.dromara.common.ai.config;

import com.aizuda.snail.ai.agent.starter.EnableSnailAiAgent;
import com.aizuda.snail.ai.openapi.client.starter.EnableSnailAiOpenApi;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/**
 * Snail AI 自动配置
 */
@AutoConfiguration
@ConditionalOnProperty(prefix = "snail-ai", name = "enabled", havingValue = "true")
@EnableSnailAiAgent      // 装配 agent-chat 网关 + agent-executor
@EnableSnailAiOpenApi    // 装配 openapi client（OpenApiUserClient 等）
public class SnailAiConfig {
}
```

- 通过 `META-INF/spring/...AutoConfiguration.imports`（内容仅一行 `org.dromara.common.ai.config.SnailAiConfig`）被 Spring Boot 自动加载。
- **不要**把它改成无条件 `@Configuration`：默认关闭是刻意设计（没接 Server 时不应装配 gRPC 客户端）。要开就改 yml 的 `enabled`，别动这个类。

### 示例 2：🔴 Chat 网关异常处理器 —— 必须返回 SDK `Result`（`SnailAiChatExceptionHandler.java` 提炼）

```java
@Slf4j
@Order(Ordered.HIGHEST_PRECEDENCE) // 抢在 RuoYi 全局 GlobalExceptionHandler 之前
@RestControllerAdvice(assignableTypes = SnailAiChatGatewayController.class) // 仅作用于 Chat 网关
public class SnailAiChatExceptionHandler {

    private static final int AUTHENTICATION_ERROR_STATUS = 5001;

    @ExceptionHandler(SnailAiAuthenticationException.class)
    public Result<Void> handleAuthenticationException(SnailAiAuthenticationException e) {
        log.warn("Snail AI Chat authentication failed: {}", e.getMessage());
        // 🔴 返回 Snail AI SDK 的 Result(status/message/data)，不是 RuoYi 的 R
        return Result.fail(AUTHENTICATION_ERROR_STATUS, defaultMessage(e, "认证失败，请重新登录"));
    }

    @ExceptionHandler(ModelCallException.class)
    public Result<Void> handleModelCallException(ModelCallException e) {
        log.warn("Snail AI Chat model call failed: {}", e.getMessage(), e);
        return Result.fail(defaultMessage(e, "模型调用失败，请稍后再试"));
    }

    @ExceptionHandler(Exception.class) // 兜底也必须吐 Result，否则 SDK 解析失败
    public Result<Void> handleException(Exception e) {
        log.error("Snail AI Chat unexpected exception", e);
        return Result.fail("AI 服务异常，请稍后再试");
    }
}
```

关键点：
- `@RestControllerAdvice(assignableTypes = SnailAiChatGatewayController.class)` —— **只**给 Snail AI 的网关 Controller 兜底，不影响普通业务接口。
- `@Order(HIGHEST_PRECEDENCE)` —— 抢在 RuoYi 通用全局异常处理器之前，确保 Chat 网关的异常不会被包成 `R`。
- 认证失败用专属状态码 `5001`，与 SDK 约定对齐。

### 示例 3：把登录用户注册成 OpenAPI 用户（`ruoyi-ai/controller/SnailAiController.java` 提炼）

```java
@Slf4j
@Validated
@RestController
@RequestMapping("/snail-ai")
@RequiredArgsConstructor
public class SnailAiController extends BaseController {

    private static final int SNAIL_AI_SUCCESS = 1; // Snail AI Result 成功 status = 1
    private final OpenApiUserClient userClient;

    /** 注册当前登录用户并返回 OpenAPI 用户信息（普通接口，返回 R） */
    @PostMapping("/user/register")
    public R<OpenApiUserVO> registerCurrentUser() {
        return R.ok(ensureOpenApiUser());
    }

    private OpenApiUserVO ensureOpenApiUser() {
        Long userId = LoginHelper.getUserId();           // Sa-Token 取当前登录用户
        LoginUser loginUser = LoginHelper.getLoginUser();
        if (loginUser == null || userId == null) {
            throw new SnailAiException("当前登录用户为空");
        }
        OpenApiUserRegisterRequest req = new OpenApiUserRegisterRequest();
        req.setExternalId(String.valueOf(userId));       // 🔴 externalId = RuoYi userId，作为映射锚点
        req.setNickname(loginUser.getNickname());
        Result<OpenApiUserVO> result = userClient.register(req); // 调 Server OpenAPI
        if (result == null || result.getStatus() != SNAIL_AI_SUCCESS || result.getData() == null) {
            throw new SnailAiException(result == null ? "注册 OpenAPI 用户失败，返回为空" : result.getMessage());
        }
        return result.getData();
    }
}
```

关键点：
- **接口本身返回 `R<OpenApiUserVO>`**（普通业务接口，走 RuoYi 通用响应 + 全局异常处理器），因为它不是 Chat 网关接口。
- 内部调 `OpenApiUserClient.register` 返回的是 Snail AI 的 `Result`，判 `status == 1` 才算成功 —— 注意 `Result.status` 与 `R.code` 不是一回事。
- `externalId = userId`：用 RuoYi 的用户 ID 作为 Snail AI OpenAPI 用户的外部标识，保证两侧用户一一映射。

### 示例 4：新增一个"普通"AI 接口（推荐范式 —— 走 R + Sa-Token 权限）

```java
@Slf4j
@Validated
@RestController
@RequestMapping("/snail-ai/assistant")
@RequiredArgsConstructor
public class AiAssistantController extends BaseController {

    private final OpenApiUserClient userClient;

    /**
     * 业务侧调用 AI 能力（如摘要 / 问答），返回 RuoYi 通用 R
     * 注意：这是普通接口，不是 SDK 直连的 Chat 网关，所以用 R + @SaCheckPermission
     */
    @SaCheckPermission("ai:assistant:invoke")   // 6.x 普通接口走 Sa-Token 鉴权
    @PostMapping("/ask")
    public R<String> ask(@Validated @RequestBody AiAskBo bo) {
        // ... 通过 openapi client 调 Server 能力，拿到 Result 后转成业务结果
        return R.ok("answer");
    }
}
```

> 范式判断：**SDK 直连的对话网关** → 挂 agent-chat 网关体系（响应是 `Result`，异常由 `SnailAiChatExceptionHandler` 兜底）；**业务后端主动调 AI** → 写成普通 `R` 接口（`@SaCheckPermission` + 全局异常）。两者别混。

### 示例 5：独立部署 Server（`ruoyi-snailai-server` 提炼）

```java
// ruoyi-snailai-server 主类：本质是委托给 Snail AI starter 启动
@SpringBootApplication
public class SnailAiServerApplication {
    public static void main(String[] args) {
        com.aizuda.snail.ai.starter.SnailAiSpringbootApplication.main(args);
    }
}
```

```yaml
# ruoyi-snailai-server/application.yml（Server 侧，与 client 侧 snail-ai 段不同）
server:
  port: 8900
  servlet:
    context-path: /snail-ai
snail-ai:
  server:
    grpc-port: 18888                 # 对应 client 的 snail-ai.server.port
  crypto:
    secret-key: ${SNAIL_AI_CRYPTO_KEY:0123456789abcdef0123456789abcdef} # 🔴 prod 用环境变量覆盖
    iv: ${SNAIL_AI_CRYPTO_IV:fedcba9876543210fedcba9876543210}
  memory:
    short-term:
      store-type: db                 # 分布式部署用 db；单机可用 memory
```

```dockerfile
# ruoyi-snailai-server/Dockerfile（JDK 21 + ZGC）
FROM bellsoft/liberica-openjdk-rocky:21.0.11-cds
EXPOSE 8900
EXPOSE 18888
ADD ./target/ruoyi-snailai-server.jar ./app.jar
ENTRYPOINT java -XX:+UseZGC ${JAVA_OPTS} -jar app.jar
```

## 五、常见错误对比

### 错误 1 🔴（重灾区）：Chat 网关接口用 RuoYi 的 `R` 包装

```java
// ❌ 错误：给 Chat 网关接口 / 其异常返回 R，前端 Snail AI SDK 解析失败
@ExceptionHandler(Exception.class)
public R<Void> handle(Exception e) {        // SDK 期待 Result{status,message,data}，拿到 R{code,msg,data} → 解析炸
    return R.fail("AI 出错");
}
```

```java
// ✅ 正确：Chat 网关一律返回 SDK 的 Result，由 SnailAiChatExceptionHandler 兜底
@ExceptionHandler(Exception.class)
public Result<Void> handle(Exception e) {
    return Result.fail("AI 服务异常，请稍后再试");
}
```

**铁律**：凡是被前端 Snail AI SDK 直连消费的 Chat 网关接口（`/api/snail/chat/**`），响应结构必须是 SDK 的 `Result(status/message/data)`，**绝不能**被 RuoYi 通用 `R(code/msg/data)` 包装 —— 字段名都不同（`status` vs `code`，`message` vs `msg`），SDK 解析直接失败。这就是 `SnailAiChatExceptionHandler` 存在的全部理由：用 `@Order(HIGHEST_PRECEDENCE)` + `assignableTypes` 抢在 RuoYi 全局异常处理器之前，把网关异常吐成 `Result`。新增 AI 接口前先问自己："它是 SDK 直连的网关接口，还是业务后端自调的普通接口？" 网关 → `Result`；普通 → `R`。**别在同一条链路上混用两种响应结构。**

### 错误 2：以为引入依赖就生效，忘了开 `enabled`

```yaml
# ❌ 错误：依赖装了，但 enabled 还是默认 false → SnailAiConfig 不装配，AI 全不生效（且不报错，最迷惑）
snail-ai:
  enabled: false
```

```yaml
# ✅ 正确：显式打开；同时确认 Server 已起、app-id/token 正确
snail-ai:
  enabled: true
  server: { host: 127.0.0.1, port: 18888 }
  app-id: 1
  token: ${SNAIL_AI_TOKEN}   # 生产走环境变量
```

排查口诀：AI 接口 404 / Bean 注入失败 → 先查 `snail-ai.enabled` 是否为 `true`，再查 Server gRPC `18888` 是否可达。

### 错误 3：把 Server 端的 `SAI_*` token / crypto key 硬编码并提交

```yaml
# ❌ 错误：真实 token / 密钥明文写进 prod 配置并提交，等于泄露应用凭据
snail-ai:
  token: SAI_566a6bfbc26e4998b4841cc927d50c5d
```

```yaml
# ✅ 正确：prod 用环境变量占位，明文只留在不入库的环境里
snail-ai:
  token: ${SNAIL_AI_TOKEN}
```

`token`（`SAI_*`）= Server 颁发的应用认证令牌；`crypto.secret-key` / `crypto.iv` = Server 加解密密钥。三者都属敏感凭据，dev.yml 的样例值仅供本地起步，**严禁**带进生产仓库；统一走 `${ENV_VAR}` 占位 + 环境变量注入。

### 错误 4（6.x 包名 / 规范）：套用旧框架写法

```java
// ❌ 错误：套用 com.ruoyi / plus.ruoyi 旧版或衍生版包名
import com.ruoyi.common.xxx;          // ❌ 包名应为 org.dromara
import plus.ruoyi.common.xxx;         // ❌ 那是 ruoyi-plus-uniapp 二开版的包名，本仓库不是
// ❌ 用 PlusLambdaQuery / likeCast / DAO 层 / TenantEntity(默认) / is_deleted / langchain4j
```

```java
// ✅ 正确：org.dromara 包；普通接口 R<T> + @SaCheckPermission；AI 走 Snail AI 而非 langchain4j
import org.dromara.common.core.domain.R;
import org.dromara.common.satoken.utils.LoginHelper;
```

## 六、最佳实践

1. **先分清"网关接口"还是"普通接口"再动手**：SDK 直连 → `Result`；后端自调 → `R<T>` + `@SaCheckPermission`。这是本 Skill 第一原则，决定了响应结构、异常处理器、鉴权方式。
2. **`enabled` 当作总闸**：本地联调先确认 Server 起好、`enabled: true`；线上灰度可借这个开关一键停用 AI 能力而不必下线整个应用。
3. **凭据零明文**：`token(SAI_*)`、`crypto.secret-key/iv` 一律 `${ENV_VAR}` 占位，dev 样例值不进生产仓库；改配置走 `env-config` Skill，提交前 grep 确认 prod 无明文 `SAI_*`。
4. **用户映射用 `externalId = userId`**：所有需要"当前登录用户"的 AI 能力，先经 `POST /snail-ai/user/register` 把 RuoYi 用户注册到 Snail AI OpenAPI，保持两侧一对一，避免出现游离的匿名 AI 用户。
5. **Result.status 判定别照搬 R.code**：Snail AI `Result` 成功 `status == 1`（见 `SNAIL_AI_SUCCESS = 1`），不要拿 RuoYi 的 `R.SUCCESS=200` 去判 Snail AI 返回。
6. **端口/进程拆清**：Server（gRPC 18888 / HTTP 8900）独立部署、独立扩容；client gRPC 18889 接收分发。Server 故障时 client 侧表现为对话超时（`chat-timeout-ms` 默认 300000ms），排查先看 Server 健康（`management` 端点已全开）。
7. **超时按链路设**：`connect-timeout-ms`(5s) / `read-timeout-ms`(60s) / `chat-timeout-ms`(300s) 分别对应连接 / 普通读 / 流式对话，流式会话长，别把 `chat-timeout-ms` 调小导致长回答被截断。
8. **不引 langchain4j**：本仓库 AI 路线就是 Snail AI，需要对话 / Agent / RAG / 记忆能力时走 Server 治理，不要另行引入 langchain4j 等 SDK 造成两套 AI 栈并存。

## 七、关键文件索引

| 文件 | 作用 |
|------|------|
| `backend/java/ruoyi-common/ruoyi-common-ai/pom.xml` | client 三 starter（chat / executor / openapi）声明 |
| `backend/java/ruoyi-common/ruoyi-common-ai/.../config/SnailAiConfig.java` | `@ConditionalOnProperty(enabled=true)` 自动配置开关 |
| `backend/java/ruoyi-common/ruoyi-common-ai/.../handler/SnailAiChatExceptionHandler.java` | Chat 网关异常处理器（吐 `Result`，`@Order` 最高优先级） |
| `backend/java/ruoyi-common/ruoyi-common-ai/.../AutoConfiguration.imports` | 注册 `SnailAiConfig` 为自动配置 |
| `backend/java/ruoyi-modules/ruoyi-ai/.../controller/SnailAiController.java` | `/snail-ai/user/register` 注册 OpenAPI 用户（返回 `R`） |
| `backend/java/ruoyi-admin/.../application-dev.yml`（`snail-ai:` 段） | client 配置：server 地址 / app-id / token / open-api / 超时 |
| `backend/java/ruoyi-extend/ruoyi-snailai-server/`（pom + Dockerfile + application.yml） | 独立 Server：snail-ai-starter / JDK21+ZGC / gRPC18888+HTTP8900 |
| 根 `pom.xml` → `<snailai.version>0.0.5</snailai.version>` | Snail AI 全家桶版本统一管理 |
