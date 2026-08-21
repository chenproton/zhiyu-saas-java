---
name: backend-annotations
description: |
  本项目 后端高级注解的总索引 / 速查表。当需要用翻译序列化、限流、防重、脱敏、数据权限、操作日志、字段加密、分布式锁、多数据源、权限校验、分组校验、对象映射等跨切面注解时自动使用此 Skill。本 Skill 重点完整覆盖最常用又没有单独技能的「翻译注解 @Translation」（ID→名称 / 字典→标签 序列化映射），其余有专门技能的注解只做一句话说明 + 指向。

  触发场景：
  - 给 VO 字段加 @Translation，把 userId 转成用户名、deptId 转部门名、字典值转字典标签、ossId 转 URL
  - 给接口加 @RateLimiter 限流 / @RepeatSubmit 防重复提交
  - 给字段加 @Sensitive 脱敏 / @EncryptField 加密
  - 给查询加 @DataPermission + @DataColumn 数据权限
  - 给 Controller 加 @Log 操作日志 / @SaCheckPermission 权限 / @Lock4j 分布式锁 / @DS 切多数据源
  - BO 用 @AutoMapper 对象映射，参数用 AddGroup / EditGroup / QueryGroup 分组校验

  触发词：注解、@Translation、翻译、ID转名称、字典转标签、@RateLimiter、限流、@RepeatSubmit、防重复、@Sensitive、@DataPermission、@DataColumn、@Log、@EncryptField、@ApiEncrypt、@Lock4j、@DS、@SaCheckPermission、@AutoMapper、分组校验、AddGroup、EditGroup、QueryGroup、TransConstant、TranslationInterface、TranslationType、ossId转url
---

# 后端高级注解索引 / 速查（base-dev-framework6-java）

> 本 Skill 是 本项目 **跨切面注解的总索引**。每个注解给出：作用、用在哪、关键参数、一个最小示例。
> 对已有专门技能的注解，只做**一句话说明 + 指向**，不重复展开；重点**完整覆盖翻译注解 `@Translation`**。

## 6.x 铁律（写注解前必读）

- **包名一律 `org.dromara.*`**，不是 `plus.ruoyi.*`，更不是 `com.ruoyi.*`。
- 注解名以**本仓库真实源码**为准。例如对象映射注解是**单数 `@AutoMapper`**（不是 `@AutoMappers`）；
  翻译注解是 `@Translation`（本仓库**不存在** `@SerialMap` 这个注解，不要写）。
- 数据查询用 MyBatis-Plus 原生 `LambdaQueryWrapper` / `QueryWrapper`，没有 `PlusLambdaQuery`、`likeCast` 之类的封装。
- 逻辑删除字段是 `del_flag`（不是 `is_deleted`）；Entity 基类按表实际需要选 `BaseEntity` / `TenantEntity`，**不要默认套 `TenantEntity`**。

---

## 注解总览表

| 注解 | 所在模块 | 用在哪 | 一句话作用 | 详情位置 |
|------|---------|--------|-----------|---------|
| `@Translation` / `@TranslationType` | ruoyi-common-translation | VO 字段 / 翻译实现类 | 序列化时把 ID 转名称、字典值转标签、ossId 转 URL | **本 Skill 详解** |
| `@RateLimiter` | ruoyi-common-redis | Controller 方法 | 接口限流（次数 / 时间窗 / 限流维度） | 指向 security-guard / redis-cache |
| `@RepeatSubmit` | ruoyi-common-redis | Controller 方法 | 防表单重复提交（间隔内拦截） | 指向 security-guard |
| `@Sensitive` | ruoyi-common-sensitive | VO / DTO 字段 | 数据脱敏（手机号、邮箱、身份证…） | 指向 data-desensitize / security-guard |
| `@DataPermission` + `@DataColumn` | ruoyi-common-mybatis | Mapper 方法 / 类 | 行级数据权限（部门 / 创建人占位符替换） | 指向 data-permission |
| `@Log` | ruoyi-common-log | Controller 方法 | 记录操作日志（标题 + 业务类型） | 指向 log-audit |
| `@EncryptField` | ruoyi-common-encrypt | Entity 字段 | 入库 / 出库字段级加密（AES / SM4 / RSA / SM2） | 指向 security-guard |
| `@ApiEncrypt` | ruoyi-common-encrypt | Controller 方法 | 接口级请求 / 响应体加密 | 指向 security-guard |
| `@Lock4j` | lock4j（三方） | 方法 | 分布式锁（基于 Redisson / key 表达式） | 指向 redis-cache |
| `@DS` | dynamic-datasource（三方） | 类 / 方法 | 切换多数据源（主从 / 多库） | 指向 architecture-design |
| `@SaCheckPermission` / `@SaCheckLogin` / `@SaCheckRole` | ruoyi-common-satoken | Controller 方法 / 类 | Sa-Token 鉴权 | 指向 security-guard |
| `@AutoMapper` | mapstruct-plus（三方） | BO / VO 类 | 声明与 Entity 的映射目标，生成转换代码 | **本 Skill 速查** |
| `AddGroup` / `EditGroup` / `QueryGroup` | ruoyi-common-core | 校验注解 `groups` | 分组校验（新增 / 编辑 / 查询用不同规则） | **本 Skill 速查** |

> 真实路径：翻译注解在 `ruoyi-common/ruoyi-common-translation/.../annotation/`；限流 / 防重在 `ruoyi-common-redis/.../annotation/`；脱敏在 `ruoyi-common-sensitive`；数据权限在 `ruoyi-common-mybatis/.../annotation/`；操作日志在 `ruoyi-common-log/.../annotation/`；加密在 `ruoyi-common-encrypt/.../annotation/`。

---

## 一、`@Translation` 翻译注解（本 Skill 重点 · 完整展开）

这是 6.x 里**最常用又没有单独技能**的注解。它的本质是：在 **VO 序列化为 JSON 的那一刻**，
把某个字段（通常是 ID 或字典值）翻译成可读文本（用户名 / 部门名 / 字典标签 / OSS 文件 URL），
**省去后端手动 join 查询、前端再做字典映射**。

### 1.1 三个组成部分

| 组成 | 注解 / 接口 | 位置 | 说明 |
|------|-----------|------|------|
| 字段标记 | `@Translation(type=..., mapper=..., other=...)` | 标在 **VO 字段** 上 | 声明「这个字段要被翻译」以及用什么类型、取哪个源字段的值 |
| 类型声明 | `@TranslationType(type = "...")` | 标在**翻译实现类**上 | 声明这个实现类负责哪种翻译，`type` 要与字段上的 `type` 一一对应 |
| 翻译逻辑 | `implements TranslationInterface<T>` | 翻译实现类 | 实现 `translation(key, other)`，建议同时覆盖 `translationBatch` 做批量查询 |

源码（`Translation.java`）的三个参数：

```java
public @interface Translation {
    String type();              // 翻译类型，必须与某个 @TranslationType 的 type 对应
    String mapper() default ""; // 映射字段：不为空时取该字段的值作为翻译键（key）
    String other() default "";  // 其他条件，例如字典 type（sys_user_gender）
}
```

`type` / `mapper` / `other` 的协同规则（来自源码注释）：
- **不设 `mapper`**：取**当前字段自身**的值作为翻译键 key；
- **设了 `mapper`**：取 `mapper` 指向的**另一个字段**的值作为翻译键 key（典型：本字段 `createByName` 显示名字，key 取自 `createBy`）；
- `other`：传给翻译实现的额外参数，**字典翻译**时用来传字典 type（如 `"sys_user_gender"`）。

### 1.2 内置翻译类型常量（`TransConstant`）

直接用常量，**不要硬编码字符串**。本仓库 `TransConstant` 真实定义如下：

```java
public interface TransConstant {
    String USER_ID_TO_NAME     = "user_id_to_name";      // 用户id -> 账号
    String USER_ID_TO_NICKNAME = "user_id_to_nickname";  // 用户id -> 昵称
    String DEPT_ID_TO_NAME     = "dept_id_to_name";      // 部门id -> 名称
    String DICT_TYPE_TO_LABEL  = "dict_type_to_label";   // 字典value -> 标签
    String OSS_ID_TO_URL       = "oss_id_to_url";        // ossId -> 文件 URL
}
```

对应的内置实现类（位于 `translation/core/impl/`）：
`UserNameTranslationImpl` / `NicknameTranslationImpl` / `DeptNameTranslationImpl` /
`DictTypeTranslationImpl` / `OssUrlTranslationImpl`。

### 1.3 VO 字段最常见的 3 种写法（均来自真实源码）

**① ID 转名称（mapper 取另一个字段）** —— 来自 `TestDemoVo.java`：

```java
/** 创建人（原始 ID 字段） */
private Long createBy;

/** 创建人账号（翻译后显示）：取 createBy 的值 -> 翻译为用户名 */
@Translation(type = TransConstant.USER_ID_TO_NAME, mapper = "createBy")
private String createByName;
```

序列化结果：JSON 里 `createByName` 自动变成用户账号，无需 Service 手动查 user 表。

**② ossId 转 URL（不设 mapper，取本字段值）** —— 来自 `SysUserVo.java` / `ProfileUserVo.java`：

```java
/** 头像：本字段存的是 ossId，序列化时自动翻译成可访问 URL */
@Translation(type = TransConstant.OSS_ID_TO_URL)
private String avatar;
```

**③ 字典值转标签（用 other 传字典 type）** —— 来自 `FlowTaskVo.java`：

```java
/** 业务状态：flowStatus 是字典值，按字典 type=wf_business_status 翻译成中文标签 */
@Translation(type = TransConstant.DICT_TYPE_TO_LABEL, mapper = "flowStatus", other = "wf_business_status")
private String flowStatusName;
```

### 1.4 翻译实现接口 `TranslationInterface<T>`

```java
public interface TranslationInterface<T> {
    /** 单条翻译：key 是被翻译的键，other 是附加条件 */
    T translation(Object key, String other);

    /** 批量翻译（默认退化为逐条；强烈建议覆盖以批量查库，避免 N+1） */
    default Map<Object, T> translationBatch(Set<Object> keys, String other) { ... }
}
```

字典翻译实现示例（`DictTypeTranslationImpl`，已加 `@TranslationType`）：

```java
@AllArgsConstructor
@TranslationType(type = TransConstant.DICT_TYPE_TO_LABEL)   // 类型与 VO 字段对应
public class DictTypeTranslationImpl implements TranslationInterface<String> {

    private final DictService dictService;

    @Override
    public String translation(Object key, String other) {
        // key = 字典值，other = 字典 type
        if (key instanceof String dictValue && StringUtils.isNotBlank(other)) {
            return dictService.getDictLabel(other, dictValue);
        }
        return null;
    }

    @Override
    public Map<Object, String> translationBatch(Set<Object> keys, String other) {
        // 一次取出该字典 type 的全部映射，避免逐条查 —— 这就是 translationBatch 的价值
        Map<String, String> dictMap = dictService.getAllDictByDictType(other);
        ...
    }
}
```

### 1.5 新增一个自定义翻译类型（4 步）

以「分类 ID 转分类名」为例（参考工作流 `FlowConstant.CATEGORY_ID_TO_NAME` 的真实做法）：

1. **定义类型常量**：在自己模块的常量类里加 `String CATEGORY_ID_TO_NAME = "category_id_to_name";`
2. **写实现类**：`@TranslationType(type = CATEGORY_ID_TO_NAME)` + `implements TranslationInterface<String>`，
   实现 `translation` / `translationBatch`，注入对应 Service 查名称。
3. **注册为 Bean**：实现类放进 Spring 容器（`@Component` 或 `@Configuration` 里 `@Bean`，参考内置实现的装配方式）。
4. **VO 字段标注**：`@Translation(type = CATEGORY_ID_TO_NAME, mapper = "categoryId")`。

> **批量优先**：列表接口返回大量记录时，务必覆盖 `translationBatch`，否则每行都触发一次 `translation` 单查，造成 N+1。

---

## 二、限流 / 防重 / 安全 / 加密类（指向 security-guard）

> 以下注解的**机制、所有参数、风控配置**详见 **security-guard** 技能；此处只给定位 + 最小示例。

### `@RateLimiter` 接口限流（ruoyi-common-redis）

作用：基于 Redis 对接口做次数限流。关键参数：`time`（窗口秒，默认 60）、`count`（次数，默认 100）、
`limitType`（`DEFAULT` / `IP` / `CLUSTER`）、`key`（支持 SpEL，如 `#code.id`）、`message`（支持国际化）。

```java
// 真实示例（RedisRateLimiterController）：10 秒内最多 2 次，按 IP 维度
@RateLimiter(count = 2, time = 10, limitType = LimitType.IP)
@GetMapping("/test")
public R<String> test() { ... }
```
→ 详见 **security-guard** / **redis-cache**。

### `@RepeatSubmit` 防重复提交（ruoyi-common-redis）

作用：间隔时间内的相同请求视为重复提交并拦截。关键参数：`interval`（默认 5000）、`timeUnit`（默认毫秒）、`message`。

```java
// 真实示例（TestDemoController）：2 秒内重复提交被拦截
@RepeatSubmit(interval = 2, timeUnit = TimeUnit.SECONDS)
@PostMapping
public R<Void> add(@RequestBody TestDemoBo bo) { ... }
```
→ 详见 **security-guard**。

### `@Sensitive` 数据脱敏（ruoyi-common-sensitive）

作用：序列化时按策略对字段脱敏。关键参数：`strategy`（`SensitiveStrategy` 枚举，如 `PHONE` / `EMAIL` / `ID_CARD`）、
`roleKey` / `perms`（命中角色 / 权限的用户可看明文）。

```java
// 真实示例（SysUserVo）：邮箱脱敏，但拥有 system:user:edit 权限的人看明文
@Sensitive(strategy = SensitiveStrategy.EMAIL, perms = "system:user:edit")
private String email;
```
→ 详见 **data-desensitize** / **security-guard**。

### `@EncryptField` / `@ApiEncrypt` 加密（ruoyi-common-encrypt）

- `@EncryptField`：标在 **Entity 字段**，入库自动加密、查询自动解密。参数 `algorithm`（AES / SM4 / RSA / SM2）、`password` / `publicKey` / `privateKey`、`encode`。
- `@ApiEncrypt`：标在 **Controller 方法**，对请求体（默认）/ 响应体（`response = true`）做整体加解密。

```java
@EncryptField(algorithm = AlgorithmType.AES)
private String phonenumber;

@ApiEncrypt(response = true)   // 请求与响应都加密
@PostMapping("/save")
public R<Void> save(@RequestBody Bo bo) { ... }
```
→ 详见 **security-guard**。

### `@SaCheckPermission` / `@SaCheckLogin` / `@SaCheckRole`（ruoyi-common-satoken）

作用：Sa-Token 鉴权。`@SaCheckPermission` 支持多权限 + `mode`（`SaMode.AND` / `SaMode.OR`）。

```java
// 真实示例（SaTokenTestController）
@SaCheckPermission("system:user:view")
@SaCheckPermission(value = {"system:user:edit", "system:log:view"}, mode = SaMode.AND)
```
→ 详见 **security-guard**。

---

## 三、数据权限类（指向 data-permission）

### `@DataPermission` + `@DataColumn`（ruoyi-common-mybatis）

作用：在 SQL 上**自动拼接行级数据权限条件**。`@DataPermission` 内放一个或多个 `@DataColumn`，
每个 `DataColumn` 把权限模板里的占位符 `key` 替换为实际列名 `value`。可选 `joinStr`（默认 select 用 OR、其他用 AND）。

```java
// 真实示例（SysUserMapper）：deptName 占位符 -> dept_id 列，userName -> create_by 列
@DataPermission({
    @DataColumn(key = "deptName", value = "dept_id"),
    @DataColumn(key = "userName", value = "create_by")
})
List<SysUserVo> selectPageUserList(...);
```
→ 数据范围类型、自定义权限、忽略数据权限等详见 **data-permission**。

---

## 四、日志 / 锁 / 多数据源类

### `@Log` 操作日志（ruoyi-common-log）→ 指向 log-audit

作用：AOP 记录操作日志到 `sys_oper_log`。关键参数：`title`（模块名）、`businessType`（`BusinessType` 枚举：`INSERT` / `UPDATE` / `DELETE` / `EXPORT` / `IMPORT` / `GRANT`…）、
`isSaveRequestData` / `isSaveResponseData`、`excludeParamNames`（排除敏感参数）。

```java
// 真实示例（TestDemoController）
@Log(title = "测试单表", businessType = BusinessType.INSERT)
@PostMapping
public R<Void> add(@RequestBody TestDemoBo bo) { ... }
```
→ 详见 **log-audit**。

### `@Lock4j` 分布式锁（lock4j 三方）→ 指向 redis-cache

作用：方法级分布式锁（底层 Redisson）。`keys` 支持 SpEL 拼锁 key，可配 `expire` / `acquireTimeout`。

```java
// 真实示例（RedisLockController）：按入参 key 加锁
@Lock4j(keys = {"#key"})
@GetMapping("/testLock4j")
public R<String> testLock4j(String key, String value) { ... }
```
→ 详见 **redis-cache**。

### `@DS` 多数据源切换（dynamic-datasource 三方）→ 指向 architecture-design

作用：标在类 / 方法上切换数据源（如主从读写分离）。

```java
@DS("slave")   // 切到从库查询
public List<Xxx> listFromSlave() { ... }
```
→ 主从配置 / 事务注意事项详见 **architecture-design**。

---

## 五、对象映射 / 分组校验（本 Skill 速查）

### `@AutoMapper` 对象映射（mapstruct-plus 三方，**单数**）

作用：标在 **BO / VO 类**上声明与目标 Entity 的映射关系，由 MapStruct Plus 生成转换代码，
配合 `MapstructUtils.convert(...)` 完成 BO↔Entity↔VO 转换。**注意是单数 `@AutoMapper`，不是 `@AutoMappers`。**

```java
// 真实示例（TestDemoBo / TestDemoVo）
@AutoMapper(target = TestDemo.class, reverseConvertGenerate = false)  // BO -> Entity
public class TestDemoBo extends BaseEntity { ... }

@AutoMapper(target = TestDemo.class)   // Entity -> VO
public class TestDemoVo implements Serializable { ... }
```

### 分组校验 `AddGroup` / `EditGroup` / `QueryGroup`（ruoyi-common-core）

作用：同一个 BO 在新增 / 编辑 / 查询时套用**不同的校验规则**。在校验注解的 `groups` 里指定分组，
在 Controller 入参用 `@Validated(分组.class)` 激活。

```java
// BO 字段（真实示例 TestDemoBo）：主键编辑时必填，其余新增 + 编辑都必填
@NotNull(message = "主键不能为空", groups = {EditGroup.class})
private Long id;

@NotNull(message = "部门id不能为空", groups = {AddGroup.class, EditGroup.class})
private Long deptId;

// Controller：编辑接口激活 EditGroup 校验
@PostMapping("/edit")
public R<Void> edit(@Validated(EditGroup.class) @RequestBody TestDemoBo bo) { ... }
```

---

## 常见错误对比（≥3）

### 错误 1：把翻译注解写成 `@SerialMap`（不存在的注解）

```java
// ❌ 本仓库根本没有 @SerialMap 注解（那是别的框架 / 旧版的概念）
@SerialMap(type = "user_id_to_name", mapper = "createBy")
private String createByName;

// ✅ 6.x 用 @Translation
@Translation(type = TransConstant.USER_ID_TO_NAME, mapper = "createBy")
private String createByName;
```

### 错误 2：`@Translation` 的 `type` 硬编码字符串 / 与实现类不对应

```java
// ❌ 硬编码字符串，拼错没有编译期检查；且若没有 type 匹配的实现类，翻译静默失败
@Translation(type = "userIdToName")
private String createByName;

// ✅ 用 TransConstant 常量，且确保有 @TranslationType(type = 同值) 的实现类
@Translation(type = TransConstant.USER_ID_TO_NAME, mapper = "createBy")
private String createByName;
```

### 错误 3：字典翻译漏传 `other`（字典 type）

```java
// ❌ 字典翻译没给 other，DictTypeTranslationImpl 因 other 为空直接返回 null
@Translation(type = TransConstant.DICT_TYPE_TO_LABEL, mapper = "status")
private String statusName;

// ✅ 必须用 other 指定字典 type
@Translation(type = TransConstant.DICT_TYPE_TO_LABEL, mapper = "status", other = "sys_normal_disable")
private String statusName;
```

### 错误 4：对象映射注解写成复数 `@AutoMappers`

```java
// ❌ 6.x 本仓库只有单数注解
@AutoMappers(target = TestDemo.class)

// ✅
@AutoMapper(target = TestDemo.class)
```

### 错误 5：把数据权限的 `@DataColumn` 写到方法外或漏掉包裹的 `@DataPermission`

```java
// ❌ @DataColumn 必须被 @DataPermission 包裹，不能单独用
@DataColumn(key = "deptName", value = "dept_id")
List<XxxVo> list();

// ✅
@DataPermission({
    @DataColumn(key = "deptName", value = "dept_id")
})
List<XxxVo> list();
```

---

## 最佳实践

1. **翻译优先用内置常量 + 内置实现**：`TransConstant` 已覆盖用户、部门、字典、OSS 四大高频场景，能复用就不要自己写实现类。
2. **列表场景必须覆盖 `translationBatch`**：自定义翻译实现一定要实现批量方法，否则列表接口每行单查造成 N+1，性能差。
3. **`mapper` 用于「展示字段 ≠ 源字段」**：源 ID 字段（如 `createBy`）保留，单独加一个展示字段（如 `createByName`）用 `mapper` 指回源字段，前端拿到的是可读文本，又不丢原始 ID。
4. **注解归位**：脱敏 / 翻译标在 **VO**；加密标在 **Entity**；限流 / 防重 / 日志 / 鉴权 / 锁标在 **Controller 方法**；数据权限标在 **Mapper 方法**；映射标在 **BO / VO 类**；分组校验在 **BO 字段 + Controller 入参**两处配合。
5. **常量优先、不硬编码**：翻译 type 用 `TransConstant`、业务类型用 `BusinessType` 枚举、脱敏策略用 `SensitiveStrategy` 枚举、限流维度用 `LimitType` 枚举。
6. **专门技能深读**：本 Skill 只做索引；限流 / 加密 / 鉴权深读 **security-guard**，脱敏深读 **data-desensitize**，数据权限深读 **data-permission**，操作日志深读 **log-audit**，缓存 / 锁深读 **redis-cache**。
7. **坚守 6.x 铁律**：包名 `org.dromara.*`、逻辑删除 `del_flag`、对象映射单数 `@AutoMapper`、翻译用 `@Translation`（无 `@SerialMap`），不要把旧版 / 别框架的注解名带进来。
