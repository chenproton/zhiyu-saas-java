---
name: mcp-integration
description: |
  base-dev-framework6-java MCP / Model Context Protocol 集成开发指南。基于 Spring AI 2.0.0 MCP，
  同一个 ruoyi-common-mcp 模块同时承载 Server 端（对外暴露工具/资源）与 Client 端（消费外部 MCP Server）两套能力。
  覆盖 @McpTool / @McpResource 注解扫描、McpClientTemplate 调用封装、STREAMABLE 协议端点 /mcp、
  client 默认禁用的开关逻辑，以及"MCP 工具必须委托业务 Service"的铁律。

  触发场景：
  - 需要把现有业务能力（查询/统计/数据导出）通过 @McpTool / @McpResource 暴露给 AI Agent / 外部 MCP Client
  - 需要让本系统作为 MCP Client 去调用外部 MCP Server（知识库、CRM、文件系统等）并把数据交给业务层处理
  - 需要排查 MCP Server 工具未注册、/mcp 端点 404、McpClientTemplate 注入为空、client 未启用等问题

  触发词：MCP、Model Context Protocol、@McpTool、@McpResource、McpClientTemplate、MCP工具、MCP资源、mcp-server、mcp-client、AI工具、agent工具、mcp集成
---

# MCP / Model Context Protocol 集成（base-dev-framework6-java）

> 适用范围：base-dev-framework6-java。包名 `org.dromara`，三层架构（Controller / Service / Mapper，**无 DAO 层**）。
> 本技能内所有类名、注解、配置均来自真实源码，未做臆造。

## 一、概述：Server / Client 两套能力，同一个模块

MCP 能力封装在公共模块 `backend/java/ruoyi-common/ruoyi-common-mcp`，底层基于 **Spring AI 2.0.0**（`<spring-ai.version>2.0.0</spring-ai.version>`）。
该模块的 `pom.xml` 同时引入两个 starter，因此**一个模块两头都能用**：

```xml
<!-- backend/java/ruoyi-common/ruoyi-common-mcp/pom.xml -->
<!-- MCP 服务端 -->
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-starter-mcp-server-webmvc</artifactId>
</dependency>
<!-- MCP 客户端 -->
<dependency>
    <groupId>org.springframework.ai</groupId>
    <artifactId>spring-ai-starter-mcp-client</artifactId>
</dependency>
```

| 角色 | 作用 | 关键载体 | 默认状态 |
|------|------|---------|---------|
| **MCP Server** | 把本系统业务能力暴露成"工具/资源"，供外部 AI Agent / MCP Client 调用 | `@McpTool` / `@McpResource` 注解 + Spring AI 注解扫描器 | **默认开启**（`spring.ai.mcp.server.enabled=true`） |
| **MCP Client** | 让本系统反过来去调用外部 MCP Server，拉回数据后交给业务层 | `McpClientTemplate`（封装 `List<McpSyncClient>`） | **默认关闭**（`spring.ai.mcp.client.enabled=false`） |

- **Server 与 ruoyi-admin 共用端口**：不单开服务，MCP Server 挂载在主应用同一端口下，默认端点 `/mcp`，协议为 `STREAMABLE`（Streamable HTTP）。
- **Client 默认不启用**：只有需要接入外部 MCP Server 时才打开开关并配 connections，避免无谓的连接初始化影响启动。
- **自动装配条件**：`McpAutoConfiguration` 仅当容器内存在 `McpSyncClient` Bean 时才注册 `McpClientTemplate`（`@ConditionalOnBean(McpSyncClient.class)`）。client 没开 → 没有 `McpSyncClient` → 没有 `McpClientTemplate`，业务侧用 `ObjectProvider` 兜底取，取不到就抛提示。

```java
// backend/java/ruoyi-common/ruoyi-common-mcp/src/main/java/org/dromara/common/mcp/config/McpAutoConfiguration.java
@AutoConfiguration
public class McpAutoConfiguration {

    @Bean
    @ConditionalOnBean(McpSyncClient.class)   // 只有存在 McpSyncClient 才注册
    @ConditionalOnMissingBean
    public McpClientTemplate mcpClientTemplate(List<McpSyncClient> mcpSyncClients) {
        return new McpClientTemplate(mcpSyncClients);
    }
}
```

> 该自动配置由 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 注册，业务模块只要依赖 `ruoyi-common-mcp` 即可生效，无需手动 `@Import`。

---

## 二、MCP Server 用法（对外暴露工具/资源）

### 2.1 三个注解

| 注解 | 来源包 | 作用 |
|------|--------|------|
| `@McpTool(name, description)` | `org.springframework.ai.mcp.annotation` | 把一个方法注册为可被远端调用的 MCP 工具 |
| `@McpToolParam(description)` | `org.springframework.ai.mcp.annotation` | 描述工具的入参（供 AI 理解参数语义） |
| `@McpResource(name, uri, description, mimeType)` | `org.springframework.ai.mcp.annotation` | 把一个方法注册为可被读取的 MCP 资源 |

### 2.2 注册机制

- 在任意 Spring Bean（`@Component` / `@Service`）的方法上标 `@McpTool` / `@McpResource`。
- 启动 `ruoyi-admin` 后，**Spring AI MCP 注解扫描器**（`annotation-scanner.enabled=true`）自动发现这些方法并注册到当前应用的 MCP Server。
- 远端 MCP Client 通过 `/mcp` 端点即可发现并调用这些工具/读取资源，**无需任何额外路由配置**。

### 2.3 命名约定（务必遵守）

| 对象 | 约定 | 真实示例 |
|------|------|---------|
| 工具 name | `模块_动作`（小写下划线） | `demo_get_data`、`demo_list_data` |
| 资源 uri | `scheme://path` | `demo://summary` |

### 2.4 反向回调（高级，可选）

除了对外的工具/资源，Server 在处理请求时还可**反向请求 Client** 做模型采样或补充信息，对应两个回调注解（非对外工具）：

| 注解 | 用途 |
|------|------|
| `@McpSampling(clients = "...")` | Server 反向请求 Client 用其模型做一次采样 |
| `@McpElicitation(clients = "...")` | Server 反向请求 Client 补充信息 |

> 注意：`clients` 必须与 `spring.ai.mcp.client.*.connections` 中的连接名一致，且 Spring AI 2.0.0-M6+ 要求 `clients` 不能为空。

---

## 三、MCP Client 用法（消费外部 MCP Server）

### 3.1 McpClientTemplate 核心 API

业务侧**不要直接遍历 `List<McpSyncClient>`**，统一通过 `McpClientTemplate` 调用。它按 `client.getServerInfo().name()` 区分各 Server：

| 方法 | 签名 | 说明 |
|------|------|------|
| 列工具 | `Map<String, List<String>> listTools()` | 返回「Server 名 → 工具名列表」，遍历所有已连接 Server |
| 调全部 | `Map<String, McpToolCallResult> callTool(String toolName, Map<String,Object> args)` | 调所有 Server 上的同名工具 |
| 调指定 | `Optional<McpToolCallResult> callTool(String serverName, String toolName, Map<String,Object> args)` | 只调指定 Server 上的工具 |
| 读资源(全部) | `Map<String, McpResourceReadResult> readResource(String uri)` | 读所有 Server 上的同名资源 |
| 读资源(指定) | `Optional<McpResourceReadResult> readResource(String serverName, String uri)` | 只读指定 Server 上的资源 |
| 找 Client | `Optional<McpSyncClient> findClient(String serverName)` | 按 Server 名找底层 client |
| 取全部 | `List<McpSyncClient> getClients()` | 拿到原始 client 列表（一般不用） |

> Server 名解析逻辑：`McpClientTemplate.getServerName()` 取 `client.getServerInfo().name()`，为空时回退 `"unknown"`。

### 3.2 返回结构（record）

- `McpToolCallResult(String serverName, boolean error, List<McpSchema.Content> content, Object structuredContent)`
  —— `error` 来自 SDK 的 `result.isError()`，调用前应先判 `error`。
- `McpResourceReadResult(String serverName, List<McpSchema.ResourceContents> contents)`

### 3.3 注入方式：用 ObjectProvider 兜底

由于 Client 默认禁用时 `McpClientTemplate` 这个 Bean **根本不存在**，业务服务必须用 `ObjectProvider<McpClientTemplate>` 注入并做空值检查，否则启动直接报「找不到 Bean」：

```java
private final ObjectProvider<McpClientTemplate> mcpClientTemplateProvider;

private <T> T execute(Function<McpClientTemplate, T> action) {
    McpClientTemplate template = mcpClientTemplateProvider.getIfAvailable();
    if (template == null) {
        throw new IllegalStateException("MCP Client 未启用，请配置 spring.ai.mcp.client.enabled=true 并设置 connections");
    }
    return action.apply(template);
}
```

---

## 四、配置示例（核对自 backend/java/ruoyi-admin/application.yml）

### 4.1 Server 段（默认开启）

```yaml
--- # MCP 服务端配置
spring.ai.mcp:
  server:
    # 与 ruoyi-admin 共用端口，默认端点为 /mcp
    enabled: true
    protocol: STREAMABLE
    name: ${spring.application.name}
    version: ${project.version}
    type: SYNC
    annotation-scanner:
      enabled: true              # 注解扫描器：发现 @McpTool / @McpResource 的关键开关
    streamable-http:
      mcp-endpoint: /mcp         # MCP Server 暴露端点
```

### 4.2 Client 段（默认关闭，需用时打开）

```yaml
--- # MCP 客户端配置
spring.ai.mcp:
  client:
    # 需要接入外部 MCP Server 时再打开，并配置 streamable-http/stdio connections
    enabled: false               # 🔴 默认关闭，打开后才会创建 McpSyncClient → McpClientTemplate
    name: ${spring.application.name}-mcp-client
    version: ${project.version}
    type: SYNC
    toolcallback:
      enabled: false
    # Streamable HTTP 多服务端示例
    streamable-http:
      connections:
        knowledge:
          url: http://localhost:9001
        crm:
          url: http://localhost:9002
    # STDIO 多服务端示例
    stdio:
      connections:
        filesystem:
          command: npx
          args:
            - -y
            - '@modelcontextprotocol/server-filesystem'
            - D:/data
```

> connection 名（`knowledge`/`crm`/`filesystem`）即 Server 名匹配依据；`callTool(serverName, ...)` 中的 `serverName` 与之对应（最终以 `getServerInfo().name()` 为准）。

### 4.3 自连自测建议

如需用当前项目「自己连自己」验证链路：启动**两个 `ruoyi-admin` 实例**，一个当 Server，一个当 Client，Client 的 connection url 指向 Server 实例地址。

---

## 五、代码示例（≥5，均取自真实源码）

### 示例 1：定义 MCP 工具（@McpTool） —— `McpDemoServerTool`

```java
// backend/java/ruoyi-modules/ruoyi-demo/.../mcp/McpDemoServerTool.java
@Component
public class McpDemoServerTool {

    @McpTool(name = "demo_get_data", description = "根据业务主键查询演示数据")
    public McpDemoData getData(@McpToolParam(description = "业务主键") String id) {
        // 🔴 真实业务：这里应调用业务 Service（如 demoService.queryById(id)），
        //    而不是 new 一个对象，更不能直接访问 Mapper
        return new McpDemoData(id, "演示数据-" + id, "ruoyi-demo", 100, LocalDateTime.now());
    }

    @McpTool(name = "demo_list_data", description = "查询演示数据列表")
    public List<McpDemoData> listData(@McpToolParam(description = "返回条数") Integer limit) {
        int size = limit == null || limit < 1 ? 3 : Math.min(limit, 20);
        // 真实业务：应委托 demoService.queryList(...) 并保留分页/数据权限
        return IntStream.rangeClosed(1, size)
            .mapToObj(i -> new McpDemoData(String.valueOf(i), "演示数据-" + i, "ruoyi-demo", i * 10, LocalDateTime.now()))
            .toList();
    }
}
```

### 示例 2：定义 MCP 资源（@McpResource）

```java
@McpResource(
    name = "demo_summary",
    uri = "demo://summary",          // scheme://path 命名约定
    description = "演示模块摘要资源",
    mimeType = "text/plain"
)
public String summary() {
    return "ruoyi-demo MCP resource summary";
}
```

### 示例 3：作为 Client 消费外部 MCP —— `McpDemoClientService`

```java
// backend/java/ruoyi-modules/ruoyi-demo/.../mcp/McpDemoClientService.java
@Service
@RequiredArgsConstructor
public class McpDemoClientService {

    // 🔴 用 ObjectProvider 注入，client 未启用时不会导致启动失败
    private final ObjectProvider<McpClientTemplate> mcpClientTemplateProvider;

    /** 查询已接入的 MCP Server 与工具列表 */
    public Map<String, List<String>> listRemoteTools() {
        return execute(McpClientTemplate::listTools);
    }

    /** 调用外部 MCP 工具接收数据 */
    public Map<String, McpToolCallResult> callRemoteTool(String toolName, Map<String, Object> arguments) {
        return execute(template -> template.callTool(toolName, arguments));
    }

    /** 读取外部 MCP 资源 */
    public Map<String, McpResourceReadResult> readRemoteResource(String uri) {
        return execute(template -> template.readResource(uri));
    }

    /** 业务处理入口：MCP 返回数据先转换成业务 BO/DTO，再走业务 Service，不直接入库 */
    public McpDemoHandleResult receiveAndHandle(String toolName, Map<String, Object> arguments) {
        return new McpDemoHandleResult("MCP", true, callRemoteTool(toolName, arguments));
    }

    private <T> T execute(Function<McpClientTemplate, T> action) {
        McpClientTemplate template = mcpClientTemplateProvider.getIfAvailable();
        if (template == null) {
            throw new IllegalStateException("MCP Client 未启用，请配置 spring.ai.mcp.client.enabled=true 并设置 connections");
        }
        return action.apply(template);
    }
}
```

### 示例 4：调用指定 Server 上的工具（callTool 三参重载）

```java
// 只调名为 "knowledge" 的 MCP Server 上的 doc_search 工具
Optional<McpToolCallResult> result =
    mcpClientTemplate.callTool("knowledge", "doc_search", Map.of("keyword", "退款流程"));

result.ifPresent(r -> {
    if (r.error()) {
        throw new ServiceException("MCP 工具调用失败：" + r.serverName());
    }
    // r.content() / r.structuredContent() 转成业务对象后交给 Service
});
```

### 示例 5：Controller 手动触发 Client 调用 —— `McpDemoController`

```java
// backend/java/ruoyi-modules/ruoyi-demo/.../controller/McpDemoController.java
@RequiredArgsConstructor
@RestController
@RequestMapping("/demo/mcp")
public class McpDemoController {

    private final McpDemoClientService mcpDemoClientService;

    @GetMapping("/tools")          // GET /demo/mcp/tools 查看已连接 Server 的工具
    public R<Map<String, List<String>>> tools() {
        try {
            return R.ok(mcpDemoClientService.listRemoteTools());
        } catch (IllegalStateException e) {
            return R.fail(e.getMessage());   // client 未启用时友好返回，不抛 500
        }
    }

    @GetMapping("/receive")        // GET /demo/mcp/receive?toolName=demo_get_data&id=1
    public R<McpDemoHandleResult> receive(@RequestParam(defaultValue = "demo_get_data") String toolName,
                                          @RequestParam(defaultValue = "1") String id) {
        try {
            return R.ok(mcpDemoClientService.receiveAndHandle(toolName, Map.of("id", id)));
        } catch (IllegalStateException e) {
            return R.fail(e.getMessage());
        }
    }
}
```

> 注意：`/demo/mcp/*` 是普通 REST 接口，**不是** MCP 协议接口；真正的 MCP Server 协议入口是 `/mcp`。

### 示例 6（可选）：sampling / elicitation 回调 —— `McpDemoClientHandlers`

```java
@Component
public class McpDemoClientHandlers {

    @McpSampling(clients = "ruoyi-demo")   // clients 必须与 connections 中的连接名一致
    public McpSchema.CreateMessageResult sampling(McpSchema.CreateMessageRequest request) {
        String text = request.systemPrompt() == null ? "demo sampling response" : request.systemPrompt();
        return new McpSchema.CreateMessageResult(McpSchema.Role.ASSISTANT,
            new McpSchema.TextContent(text), "ruoyi-demo-sampling",
            McpSchema.CreateMessageResult.StopReason.END_TURN);
    }

    @McpElicitation(clients = "ruoyi-demo")
    public McpSchema.ElicitResult elicitation(McpSchema.ElicitRequest request) {
        return new McpSchema.ElicitResult(McpSchema.ElicitResult.Action.ACCEPT,
            Map.of("message", request.message()));
    }
}
```

---

## 六、常见错误对比（≥3，重点「委托 Service」铁律）

### 错误 1：在 MCP 工具里直接访问 Mapper（🔴 头号铁律违规）

```java
// ❌ 错误：MCP 工具绕过业务层，直接打 Mapper —— 丢失鉴权/租户/脱敏/审计/幂等
@McpTool(name = "user_get", description = "查用户")
public SysUserVo getUser(@McpToolParam(description = "用户ID") Long userId) {
    return userMapper.selectVoById(userId);   // 越权返回任意租户的用户，含敏感字段
}
```

```java
// ✅ 正确：委托业务 Service，复用既有的权限校验、多租户隔离、@Sensitive 脱敏、@Log 审计
@McpTool(name = "user_get", description = "查用户")
public SysUserVo getUser(@McpToolParam(description = "用户ID") Long userId) {
    return userService.selectUserById(userId);  // 业务规则一处定义，MCP 入口共享
}
```

> **铁律**：MCP 工具方法本质是「另一个入口」，必须像 Controller 一样**只做参数适配 + 调 Service**，
> 绝不在工具方法内写查询/落库逻辑。鉴权、多租户、脱敏、审计、幂等全部由 Service 层兜底。

### 错误 2：MCP Client 返回数据直接入库

```java
// ❌ 错误：把外部 MCP Server 的返回值原样写进自己的库
McpToolCallResult r = template.callTool("crm", "lead_list", args).get();
demoMapper.insertBatch(r.content());   // 外部数据未经校验/转换/去重，污染本系统数据
```

```java
// ✅ 正确：先转换成业务 BO/DTO，做校验、去重、字段映射，再走业务 Service 入库
McpToolCallResult r = template.callTool("crm", "lead_list", args)
    .orElseThrow(() -> new ServiceException("未连接到 crm MCP Server"));
if (r.error()) {
    throw new ServiceException("MCP 工具返回错误");
}
List<LeadBo> bos = convertToBo(r.structuredContent());   // 转换 + 校验
leadService.saveBatch(bos);                               // 走业务 Service
```

### 错误 3：直接 @Autowired McpClientTemplate（client 未启用时启动失败）

```java
// ❌ 错误：client 默认 enabled=false 时 McpClientTemplate Bean 不存在，
//    强依赖注入 → NoSuchBeanDefinitionException，应用起不来
@Autowired
private McpClientTemplate mcpClientTemplate;
```

```java
// ✅ 正确：用 ObjectProvider 弱依赖注入 + getIfAvailable() 兜底
private final ObjectProvider<McpClientTemplate> provider;
...
McpClientTemplate t = provider.getIfAvailable();
if (t == null) {
    throw new IllegalStateException("MCP Client 未启用，请配置 spring.ai.mcp.client.enabled=true 并设置 connections");
}
```

### 错误 4：工具/资源命名不规范

```java
// ❌ 错误：驼峰、无模块前缀，AI 难以理解归属，uri 缺 scheme
@McpTool(name = "getData")                 // 应为 demo_get_data
@McpResource(uri = "summary")              // 应为 demo://summary
```

```java
// ✅ 正确：工具 模块_动作；资源 scheme://path
@McpTool(name = "demo_get_data", description = "根据业务主键查询演示数据")
@McpResource(name = "demo_summary", uri = "demo://summary", description = "演示模块摘要资源", mimeType = "text/plain")
```

---

## 七、最佳实践

1. **Server 工具 = 业务入口**：`@McpTool` 方法只做「参数适配 + 调 Service」，业务逻辑、权限、租户、脱敏、审计、幂等全留在 Service 层，与 Controller 共用同一套规则。
2. **工具粒度对齐业务用例**：一个工具对应一个明确的业务动作（查/列/统计/导出），描述（`description`）写清楚用途和参数语义，方便外部 AI Agent 正确选择和调用。
3. **命名统一**：工具 `模块_动作`（`demo_get_data`），资源 `scheme://path`（`demo://summary`），全小写下划线，便于跨模块识别归属。
4. **Client 默认关、按需开**：生产环境只在确实要接外部 MCP Server 时才把 `spring.ai.mcp.client.enabled` 设为 `true` 并配 connections；不用就保持 `false`，省去无谓连接与启动开销。
5. **Client 注入用 ObjectProvider**：任何依赖 `McpClientTemplate` 的服务都通过 `ObjectProvider` + `getIfAvailable()` 注入，对外接口在 client 未启用时返回友好提示（如 `R.fail(...)`），不抛 500、不影响应用启动。
6. **多 Server 区分调用**：连了多个外部 Server 时优先用 `callTool(serverName, tool, args)` / `readResource(serverName, uri)` 指定目标，避免「调所有 Server 同名工具」带来的歧义和多余请求；先 `listTools()` 探测可用工具再调。
7. **校验返回再用**：每次 `callTool` 后先判 `McpToolCallResult.error()`，外部数据先转成业务 BO/DTO 做校验/去重，再交业务 Service，绝不原样入库。
8. **端点不要乱改**：MCP Server 协议入口固定 `/mcp`（`streamable-http.mcp-endpoint`），与 ruoyi-admin 共用端口；普通验证用的 REST 接口（如 `/demo/mcp/*`）与 MCP 协议端点是两回事，别混淆。
9. **6.x 包名与分层**：所有 MCP 相关类放在 `org.dromara.*`；遵循三层架构（Controller / Service / Mapper，**无 DAO 层**），工具方法不得绕过 Service 直连 Mapper。
10. **依赖统一走公共模块**：业务模块需要 MCP 能力时依赖 `ruoyi-common-mcp` 即可，`McpAutoConfiguration` 自动装配 `McpClientTemplate`（条件：存在 `McpSyncClient` Bean），不要在业务模块重复引入 spring-ai starter 或手写客户端遍历逻辑。
