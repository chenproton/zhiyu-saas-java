---
name: json-serialization
description: |
  当需要处理 JSON 序列化、反序列化、数据类型转换、日期处理、大数字精度保护时自动使用此 Skill。基于 base-dev-framework6-java的 ruoyi-common-json 模块，涵盖 JsonUtils 工具类、JacksonConfig 全局配置、BigNumberSerializer 大数字精度保护、CustomDateDeserializer/CustomLocalDateTimeDeserializer 日期反序列化、JsonValueEnhancer 响应增强、@JsonPattern JSON 校验等真实实现。

  触发场景：
  - JSON 序列化 / 反序列化对象、数组、Map（toJsonString / parseObject / parseArray / parseMap）
  - 大数字精度问题（Long / BigInteger 超出 JS 安全整数范围、BigDecimal 转字符串）
  - 日期时间格式化与多格式反序列化（统一 yyyy-MM-dd HH:mm:ss、东八区/默认时区）
  - 复杂泛型类型转换（TypeReference）、JSON 树操作、字段移除
  - JSON 格式校验（@JsonPattern / JsonUtils.isJson）、响应字段增强（翻译/脱敏）

  触发词：JSON、序列化、反序列化、JsonUtils、Jackson、日期格式、精度、BigDecimal、Long、大数字、类型转换、TypeReference、JSON校验、JsonValueEnhancer、JsonMapper、BigNumberSerializer

  核心警告（6.x 铁律）：
  - 包名 org.dromara，禁用 plus.ruoyi / com.ruoyi / Fastjson（本仓库无 Fastjson2）
  - 本版本基于 Jackson 3，包名是 tools.jackson.*（不是 com.fasterxml.jackson.*）
  - JSON 唯一入口是 JsonUtils（org.dromara.common.json.utils.JsonUtils），禁止手动 new ObjectMapper
  - Long/BigInteger 超出 JS 安全整数自动转 String，BigDecimal 始终转 String，禁止重复造轮子
---

# base-dev-framework6-java · JSON 序列化 / 反序列化 / 精度保护

## 一、概述（统一用 Jackson，本仓库无 Fastjson）

本技能对应模块 `ruoyi-common/ruoyi-common-json`，**全项目 JSON 序列化与反序列化统一使用 Jackson**。

> 🔴 **关键事实（已逐项核对源码）**：
> 1. `ruoyi-common-json/pom.xml` **只依赖** `spring-boot-starter-jackson` 与 `ruoyi-common-core`，**没有任何 Fastjson / Fastjson2 依赖**。全项目搜不到 `com.alibaba.fastjson`。要做 JSON 一律走 Jackson，不要引入 Fastjson。
> 2. 本 6.x 版本使用的是 **Jackson 3**，包名前缀是 `tools.jackson.*`（如 `tools.jackson.databind.json.JsonMapper`、`tools.jackson.core.type.TypeReference`），**不是**老的 `com.fasterxml.jackson.*`。核心映射器类型是 `JsonMapper`（不是旧的 `ObjectMapper`）。写代码时务必用 `tools.jackson.*` 的 import。
> 3. 全局唯一的 JSON 入口是 `org.dromara.common.json.utils.JsonUtils`，它内部持有一个由 Spring 容器注入的 `JsonMapper` 单例（`SpringUtils.getBean(JsonMapper.class)`）。**禁止在业务代码里 `new ObjectMapper()` / `new JsonMapper()`**——那会绕过全局的精度保护和日期格式配置，导致前端拿到错误数据。

模块目录结构（真实）：

| 子包 | 关键类 | 职责 |
|------|--------|------|
| `utils` | `JsonUtils` | 全局 JSON 工具类（序列化/反序列化/校验/字段移除） |
| `config` | `JacksonConfig` | 全局 Jackson 配置（精度保护 + 日期格式 + 时区） |
| `config` | `JsonEnhancementConfig` | 注册响应增强器 Bean |
| `handler` | `BigNumberSerializer` | 大数字精度保护序列化器 |
| `handler` | `CustomDateDeserializer` | `Date` 多格式反序列化 |
| `handler` | `CustomLocalDateTimeDeserializer` | `LocalDateTime` 多格式反序列化 |
| `enhance` | `JsonValueEnhancer` / `JsonFieldProcessor` / `JsonFieldContext` / `JsonEnhancementContext` | 出站响应字段增强（翻译/脱敏，三阶段生命周期） |
| `validate` | `@JsonPattern` / `JsonPatternValidator` / `JsonType` | 字符串 JSON 格式校验注解 |

自动装配入口在 `resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`，因此 `JacksonConfig` 与 `JsonEnhancementConfig` 在引入该模块的项目里自动生效，无需手动配置。

---

## 二、JsonUtils 工具类（唯一入口）

`JsonUtils` 是 `@NoArgsConstructor(access = PRIVATE)` 的静态工具类，全部方法为静态方法。以下为**真实存在的方法签名**（来自源码，未杜撰）：

| 方法 | 签名 | 说明 |
|------|------|------|
| 序列化 | `String toJsonString(Object object)` | 对象转 JSON 字符串；`object == null` 返回 `null` |
| 序列化(排除字段) | `String toJsonStringExcludeFields(Object object, String... fieldNames)` | 转 JSON 并**递归**移除指定字段 |
| 反序列化(类) | `<T> T parseObject(String text, Class<T> clazz)` | 字符串转对象；`text` 为空返回 `null` |
| 反序列化(字节) | `<T> T parseObject(byte[] bytes, Class<T> clazz)` | 字节数组转对象；空数组返回 `null` |
| 反序列化(泛型) | `<T> T parseObject(String text, TypeReference<T> typeReference)` | 复杂泛型反序列化 |
| 转 Dict | `Dict parseMap(String text)` | 转 Hutool `cn.hutool.core.lang.Dict`（即 Map） |
| 转 Dict 列表 | `List<Dict> parseArrayMap(String text)` | 转 `List<Dict>` |
| 转对象列表 | `<T> List<T> parseArray(String text, Class<T> clazz)` | 转 `List<T>`；`text` 为空返回**空列表**（非 null） |
| 获取映射器 | `JsonMapper getJsonMapper()` | 返回全局 `JsonMapper` 单例 |
| 移除字段 | `JsonNode removeFields(JsonNode node, String... fieldNames)` | 在 JSON 树上递归移除字段 |
| 是否 JSON | `boolean isJson(String str)` | 是否合法 JSON（对象或数组） |
| 是否 JSON 对象 | `boolean isJsonObject(String str)` | 是否 `{}` |
| 是否 JSON 数组 | `boolean isJsonArray(String str)` | 是否 `[]` |

> ⚠️ 注意空返回值差异：`parseObject` 系列在入参为空时返回 `null`，但 `parseArray` 返回**空 ArrayList**——遍历前不用判空，但取首元素仍需判断 `isEmpty()`。

---

## 三、大数字精度保护（防前端 JS 精度丢失）

JavaScript 的 `Number` 只能安全表示到 `2^53-1`（`9007199254740991`）。后端的雪花 ID、`Long`、`BigInteger` 一旦超过这个范围，直接以数字形式传给前端就会**精度丢失**（末位被抹成 0）。本项目通过 `BigNumberSerializer` 在序列化阶段自动处理。

`JacksonConfig#registerJavaTimeModule()` 中的真实注册（来自源码）：

```java
SimpleModule module = new SimpleModule();
// Long / long / BigInteger：超出 JS 安全整数范围时序列化为字符串
module.addSerializer(Long.class, BigNumberSerializer.INSTANCE);
module.addSerializer(Long.TYPE, BigNumberSerializer.INSTANCE);
module.addSerializer(BigInteger.class, BigNumberSerializer.INSTANCE);
// BigDecimal：始终序列化为字符串（彻底避免浮点精度问题）
module.addSerializer(BigDecimal.class, ToStringSerializer.instance);
```

`BigNumberSerializer` 核心逻辑（继承 `tools.jackson.databind.ser.jdk.NumberSerializer`）：

```java
private static final long MAX_SAFE_INTEGER = 9007199254740991L;
private static final long MIN_SAFE_INTEGER = -9007199254740991L;

@Override
public void serialize(Number value, JsonGenerator gen, SerializationContext provider) {
    // 在安全范围内：按数字输出；超出范围：按字符串输出，前端用 String 接收避免精度丢失
    if (value.longValue() >= MIN_SAFE_INTEGER && value.longValue() <= MAX_SAFE_INTEGER) {
        super.serialize(value, gen, provider);
    } else {
        gen.writeString(value.toString());
    }
}
```

**规则总结**：

| 类型 | 序列化结果 | 原因 |
|------|-----------|------|
| `Long` / `long` / `BigInteger`（在安全范围内，如 `100`） | 数字 `100` | 不影响精度，保持数字便于前端运算 |
| `Long` / `long` / `BigInteger`（超出安全范围，如雪花 ID `1789...`） | 字符串 `"1789..."` | 防止 JS 精度丢失 |
| `BigDecimal`（如金额 `0.1`） | 字符串 `"0.1"` | 彻底避免浮点误差 |

> 🔴 因此 **VO 中的金额字段建议用 `BigDecimal`**，前端用字符串接收再做展示；ID 字段是 `Long` 时前端要用 `string` 类型接收大 ID。这是全局自动行为，无需在字段上加任何注解。

---

## 四、日期时间格式（统一格式 + 多格式容错）

### 4.1 序列化（出站）

`JacksonConfig` 对 `LocalDateTime` 注册了固定格式的序列化器：

```java
DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
module.addSerializer(LocalDateTime.class, new LocalDateTimeSerializer(formatter));
```

时区配置（`jsonInitCustomizer`）：

```java
builder.defaultTimeZone(TimeZone.getDefault());
```

> 说明：序列化器使用 `tools.jackson.databind.ext.javatime.ser.LocalDateTimeSerializer`（Jackson 3 的 JavaTime 扩展包）。时区取 JVM 默认时区，生产环境务必把容器/服务器时区设为东八区（`Asia/Shanghai`），或在启动参数加 `-Duser.timezone=Asia/Shanghai`，否则 `LocalDateTime` 与 `Date` 的展示会偏移。

**统一格式**：所有 `LocalDateTime` 出站统一为 `yyyy-MM-dd HH:mm:ss`，例如 `2026-06-20 14:30:00`。

### 4.2 反序列化（入站，多格式容错）

`Date` 与 `LocalDateTime` 的反序列化交给自定义解析器，底层用 Hutool `DateUtil.parse` **自动识别多种格式**（如 `2026-06-20`、`2026-06-20 14:30:00`、`2026/06/20` 等），无需前端严格对齐格式：

```java
// CustomLocalDateTimeDeserializer（Date 版同理，返回 parse.toJdkDate()）
@Override
public LocalDateTime deserialize(JsonParser p, DeserializationContext ctxt) {
    String text = p.getString();
    if (text == null || text.isBlank()) {
        return null;   // 空字符串安全转 null，不抛异常
    }
    DateTime parse = DateUtil.parse(text.trim());  // Hutool 智能识别格式
    return parse.toLocalDateTime();
}
```

> 注意：反序列化器使用 `tools.jackson.databind.ValueDeserializer`（Jackson 3），不是旧版 `JsonDeserializer`。

---

## 五、复杂泛型（TypeReference）

普通 `Class<T>` 无法表达 `List<User>`、`Map<String, List<Order>>` 这类带泛型参数的类型（类型擦除）。必须用 `TypeReference`（注意 import 是 **`tools.jackson.core.type.TypeReference`**）：

```java
import tools.jackson.core.type.TypeReference;
import org.dromara.common.json.utils.JsonUtils;

// 反序列化为 List<UserVo>
List<UserVo> users = JsonUtils.parseObject(json, new TypeReference<List<UserVo>>() {});

// 反序列化为 Map<String, List<OrderVo>>
Map<String, List<OrderVo>> map =
    JsonUtils.parseObject(json, new TypeReference<>() {});  // Java 钻石语法可省略泛型

// 简单 List 也可以直接用 parseArray（更直观）
List<UserVo> list = JsonUtils.parseArray(json, UserVo.class);
```

> 选择建议：单层 `List<某类>` 用 `parseArray(text, Clazz.class)` 更简洁；嵌套泛型（List 套 Map、Map 套 List）必须用 `parseObject(text, TypeReference)`。

---

## 六、响应增强（JsonValueEnhancer）

`JsonValueEnhancer` 是项目的**出站响应统一增强器**，在 Controller 返回对象写出 HTTP 响应前，对字段做翻译、脱敏等处理。它由 `JsonEnhancementConfig` 注册为 Bean，注入所有 `JsonFieldProcessor` 实现。

`JsonFieldProcessor` 采用**三阶段生命周期**（解决 N+1 查询）：

| 阶段 | 方法 | 时机 | 用途 |
|------|------|------|------|
| collect | `collect(fieldContext, context)` | 递归扫描对象树时每字段一次 | 采集需处理的字段 key 存入 context |
| prepare | `prepare(context)` | collect 全部完成后**仅一次** | 批量 IO（如一次性批量查库），消除 N+1 |
| process | `process(fieldContext, value, context)` | 渲染 JSON 树时每字段一次 | 取 prepare 结果替换字段值 |

`supports(fieldContext)` 用于判断该处理器是否处理该字段（默认 `true`）。`JsonFieldContext` 提供 `getAnnotation(注解类型)`，因此处理器可基于字段上的自定义注解决定是否生效。

> 典型用法：字典值翻译（`status=0` → `正常`）、ID 转名称、敏感字段脱敏，都可通过实现 `JsonFieldProcessor` + 在字段上加自定义注解实现，且 prepare 阶段批量查询避免逐条查库。日常业务一般不需要直接调用 `JsonValueEnhancer`，它由框架在响应链路自动触发；只有要**新增一种字段增强能力**时才实现 `JsonFieldProcessor`。

---

## 七、JSON 格式校验（@JsonPattern）

当某个 `String` 字段需要存储 JSON（如配置项、扩展属性），可用 `@JsonPattern` 校验其是否为合法 JSON：

```java
import org.dromara.common.json.validate.JsonPattern;
import org.dromara.common.json.validate.JsonType;

public class ConfigBo {

    // 默认 type = ANY，对象或数组都允许
    @JsonPattern(message = "扩展配置必须是合法 JSON")
    private String extJson;

    // 限定必须是 JSON 对象 {}
    @JsonPattern(type = JsonType.OBJECT, message = "必须是 JSON 对象")
    private String objConfig;

    // 限定必须是 JSON 数组 []
    @JsonPattern(type = JsonType.ARRAY)
    private String arrConfig;
}
```

`JsonType` 三种取值：`OBJECT`（`{}`）、`ARRAY`（`[]`）、`ANY`（对象或数组都可，默认）。

> 校验规则（来自 `JsonPatternValidator`）：**空字符串视为合法**（交给 `@NotBlank`/`@NotNull` 控制是否允许空），非空时按 `type` 调用 `JsonUtils.isJson / isJsonObject / isJsonArray`。

代码里临时判断字符串是否为 JSON，直接用 `JsonUtils`：

```java
if (JsonUtils.isJson(str))        { /* 合法 JSON（对象或数组） */ }
if (JsonUtils.isJsonObject(str))  { /* 是 {} */ }
if (JsonUtils.isJsonArray(str))   { /* 是 [] */ }
```

---

## 八、完整代码示例（≥5）

### 示例 1：对象序列化与反序列化

```java
import org.dromara.common.json.utils.JsonUtils;

UserVo user = new UserVo();
user.setUserId(1789012345678901234L);  // 大 ID
user.setNickName("张三");

// 序列化：userId 因超出 JS 安全整数，自动输出为字符串 "1789012345678901234"
String json = JsonUtils.toJsonString(user);

// 反序列化
UserVo parsed = JsonUtils.parseObject(json, UserVo.class);
```

### 示例 2：列表反序列化（两种写法）

```java
String json = "[{\"userId\":1,\"nickName\":\"A\"},{\"userId\":2,\"nickName\":\"B\"}]";

// 写法一：parseArray（推荐，单层 List 最简洁；text 为空返回空 List 不会 NPE）
List<UserVo> list1 = JsonUtils.parseArray(json, UserVo.class);

// 写法二：TypeReference（嵌套泛型时必须用这个）
List<UserVo> list2 = JsonUtils.parseObject(json, new TypeReference<List<UserVo>>() {});
```

### 示例 3：转 Map / Dict

```java
String json = "{\"name\":\"张三\",\"age\":18,\"roles\":[\"admin\",\"user\"]}";

// 转 Hutool Dict（即 Map），可链式取值
Dict dict = JsonUtils.parseMap(json);
String name = dict.getStr("name");
Integer age = dict.getInt("age");

// 转 Dict 列表
List<Dict> rows = JsonUtils.parseArrayMap("[{\"id\":1},{\"id\":2}]");
```

### 示例 4：序列化时排除敏感字段

```java
// 输出 JSON，但递归移除 password、salt 字段（适合日志打印场景）
String safeJson = JsonUtils.toJsonStringExcludeFields(user, "password", "salt");
log.info("用户数据：{}", safeJson);   // 日志里不含密码
```

### 示例 5：金额 BigDecimal 自动转字符串

```java
public class OrderVo {
    private Long orderId;        // 大 ID 自动转 String
    private BigDecimal amount;   // 金额始终转 String，避免 0.1+0.2 浮点误差
}

OrderVo order = new OrderVo();
order.setOrderId(1789012345678901234L);
order.setAmount(new BigDecimal("99.90"));

// 输出：{"orderId":"1789012345678901234","amount":"99.90"}
String json = JsonUtils.toJsonString(order);
```

### 示例 6：复杂嵌套泛型

```java
String json = "{\"vip\":[{\"id\":1}],\"normal\":[{\"id\":2}]}";

Map<String, List<UserVo>> grouped =
    JsonUtils.parseObject(json, new TypeReference<Map<String, List<UserVo>>>() {});
```

---

## 九、常见错误对比（≥3）

### 错误 1：手动 new ObjectMapper / 引入 Fastjson

```java
// ❌ 错误：绕过全局配置，丢失大数字精度保护和统一日期格式
ObjectMapper mapper = new ObjectMapper();
String json = mapper.writeValueAsString(user);   // userId 大 ID 精度丢失！

// ❌ 更错误：本仓库根本没有 Fastjson2 依赖，编译都过不了
String json = JSON.toJSONString(user);            // com.alibaba.fastjson 不存在

// ✅ 正确：统一走 JsonUtils（内部持有配置好的全局 JsonMapper）
String json = JsonUtils.toJsonString(user);
```

### 错误 2：import 用了老的 com.fasterxml.jackson 包

```java
// ❌ 错误：本 6.x 版本是 Jackson 3，包名是 tools.jackson.*
import com.fasterxml.jackson.core.type.TypeReference;   // 找不到/不匹配

// ✅ 正确：Jackson 3 的 TypeReference
import tools.jackson.core.type.TypeReference;
List<UserVo> list = JsonUtils.parseObject(json, new TypeReference<List<UserVo>>() {});
```

### 错误 3：前端用 number 接收大 ID 导致精度丢失

```typescript
// ❌ 错误：TS interface 把雪花 ID 声明为 number，末位被 JS 抹成 0
interface User { userId: number }   // 1789012345678901234 → 1789012345678901200

// ✅ 正确：后端已把超范围 Long 序列化为字符串，前端用 string 接收
interface User { userId: string }
```

### 错误 4：用 List.of() 配合反序列化或缓存返回不可变集合

```java
// ❌ 错误：parseArray 期望可变集合参与后续 add，Map.of/List.of 不可变会抛 UnsupportedOperationException
List<UserVo> list = JsonUtils.parseArray(json, UserVo.class);
list.addAll(List.of(extra));   // 若把返回赋值给不可变集合再操作会出错

// ✅ 正确：JsonUtils.parseArray 内部用 List.class 构造，本身返回可变 ArrayList，直接 add 即可
list.add(extra);
```

---

## 十、最佳实践

1. **唯一入口原则**：所有 JSON 操作只走 `JsonUtils`，禁止 `new ObjectMapper()` / `new JsonMapper()`，也禁止引入 Fastjson——保证全局精度保护、日期格式、时区配置生效。
2. **大数字字段**：ID 用 `Long`（超范围自动转 String），金额用 `BigDecimal`（始终转 String）；前端对应字段一律用 `string` 类型接收，避免精度丢失。
3. **泛型选型**：单层 `List<X>` 用 `parseArray(text, X.class)`；嵌套泛型用 `parseObject(text, new TypeReference<>(){})`，且 import 必须是 `tools.jackson.core.type.TypeReference`。
4. **空值预期**：`parseObject` 系列空入参返回 `null`，`parseArray` 空入参返回**空列表**——按此区别决定是否判空。
5. **日期统一**：实体/VO 用 `LocalDateTime`，出站统一 `yyyy-MM-dd HH:mm:ss`；入站靠 Hutool 多格式容错，但生产时区务必设为东八区（`-Duser.timezone=Asia/Shanghai`）。
6. **JSON 字符串字段校验**：存 JSON 的 `String` 字段加 `@JsonPattern`（按需 `type=OBJECT/ARRAY`）做格式校验，空值交给 `@NotBlank` 控制。
7. **日志脱敏**：打印对象 JSON 时用 `toJsonStringExcludeFields(obj, "password", "secret", ...)` 移除敏感字段，避免密钥进日志。
8. **字段增强扩展**：需要"翻译/脱敏/ID 转名称"类出站处理时，实现 `JsonFieldProcessor`（三阶段：collect 采集 → prepare 批量查 → process 替换），在 prepare 阶段批量查询消除 N+1，不要逐字段查库。
9. **包名铁律**：所有引用保持 `org.dromara.*`，禁用 `plus.ruoyi` / `com.ruoyi`；Jackson 类型用 `tools.jackson.*`，不要混入 `com.fasterxml.jackson.*`。
