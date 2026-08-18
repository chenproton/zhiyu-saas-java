---
name: i18n-development
description: |
  本项目 国际化（i18n）开发技能，以后端为主。讲清 MessageUtils.message() 读取
  messages*.properties、MessageSource + LocaleResolver 的请求头语言切换机制、消息码命名约定、
  校验/异常消息国际化（@NotBlank message 用 {code}）等核心实现。前端 plus-ui 国际化仅一句带过。

  触发场景：
  - 需要给后端接口返回的提示语做多语言（中文 / 英文）翻译
  - 需要新增或修改 messages.properties 消息码，并让 MessageUtils 正确读取
  - 校验注解（@NotBlank / @NotNull / @Range）的 message 想走国际化、@RateLimiter/@RepeatSubmit 想用国际化文案
  - 需要排查"切了语言但返回还是中文 / 始终返回 code 原文"的问题
  - 需要理解 LocaleResolver 如何按请求头 content-language / Accept-Language 切语言

  触发词：国际化、多语言、i18n、翻译、MessageUtils、语言切换、content-language、messages.properties、locale、MessageSource、LocaleResolver、zh_CN、en_US
---

# base-dev-framework6-java 国际化（i18n）开发指南（后端为主）

> 6.x 铁律：包名一律 `org.dromara`；后端国际化只认 `MessageUtils.message(code, args)` + `messages*.properties`，
> 不要凭印象引用 `com.ruoyi` / `plus.ruoyi` 的旧路径。本技能所有结论均核对自真实源码（见文末「源码引用」）。

## 一、概述

本项目 的后端国际化是一套非常轻量的实现，核心只有三个角色：

| 角色 | 类 / 文件 | 职责 |
|------|-----------|------|
| 翻译入口 | `MessageUtils`（`ruoyi-common-core`） | 静态方法 `message(code, args)`，把消息码翻译成当前语言的文案 |
| 消息源 | Spring `MessageSource`（由 Boot 自动装配） | 加载 `i18n/messages*.properties` 资源包，按 Locale 取值 |
| 区域解析 | `I18nLocaleResolver` + `I18nConfig`（`ruoyi-common-web`） | 每个请求从请求头解析 `Locale`，决定用哪一份语言包 |

数据流：

```
HTTP 请求（带 content-language: en_US）
   │
   ▼
I18nLocaleResolver.resolveLocale()  ──► 解析出 Locale(en_US) 存入 LocaleContextHolder
   │
   ▼
业务代码调用 MessageUtils.message("user.login.success")
   │
   ▼
MessageSource.getMessage(code, args, LocaleContextHolder.getLocale())
   │
   ▼
命中 i18n/messages_en_US.properties → "Login successful"
```

关键特征（务必牢记）：

1. **后端国际化只翻译"提示/错误消息"**，不翻译业务数据本身（字典翻译走 `SerialMap`/字典体系，不在本技能范围）。
2. **语言由请求头决定**，每个请求独立。后端不保存"用户当前语言"，前端每次请求都带上语言头。
3. **找不到 code 时返回 code 原文**，不会抛异常（见 `MessageUtils` 的 try-catch）——这是排查"返回了一串 key"问题的关键。

---

## 二、后端核心：MessageUtils

`MessageUtils` 位于 `ruoyi-common-core` 的 `org.dromara.common.core.utils` 包下，源码极简：

```java
package org.dromara.common.core.utils;

import org.springframework.context.MessageSource;
import org.springframework.context.NoSuchMessageException;
import org.springframework.context.i18n.LocaleContextHolder;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class MessageUtils {

    private static final MessageSource MESSAGE_SOURCE = SpringUtils.getBean(MessageSource.class);

    /**
     * 根据消息键和参数 获取消息 委托给 spring messageSource
     *
     * @param code 消息键（messages.properties 中的 key）
     * @param args 占位符参数（按 {0} {1} 顺序替换）
     * @return 国际化翻译值；找不到时返回 code 本身
     */
    public static String message(String code, Object... args) {
        try {
            return MESSAGE_SOURCE.getMessage(code, args, LocaleContextHolder.getLocale());
        } catch (NoSuchMessageException e) {
            return code;
        }
    }
}
```

要点逐条拆解：

- **静态工具类**：私有构造，直接 `MessageUtils.message(...)` 调用，不需要注入。
- **`Object... args` 变长参数**：对应 properties 里的 `{0}`、`{1}` 占位符，按位置替换。
- **`LocaleContextHolder.getLocale()`**：当前线程的 Locale，由 `I18nLocaleResolver` 在请求进入时写入。
- **降级返回 code**：`NoSuchMessageException` 被吞掉并返回 `code`。所以如果接口返回了 `user.login.xxx`
  这样的原始 key，说明 properties 里**没有这个 key**（拼写错 / 漏配 / 语言包未命中），而不是报错。

### 业务代码中的真实用法（来自源码）

```java
// 登录成功提示（SysLoginService）
recordLoginInfo(username, Constants.LOGIN_SUCCESS, MessageUtils.message("user.login.success"));

// 注册成功（SysRegisterService）
recordLoginInfo(username, Constants.REGISTER, MessageUtils.message("user.register.success"));

// 带占位符参数：密码输入错误 {0} 次，账户锁定 {1} 分钟（SysLoginService）
MessageUtils.message(loginType.getRetryLimitExceed(), maxRetryCount, lockTime);

// Controller 中直接返回翻译文案（AuthController）
return R.fail(MessageUtils.message("auth.grant.type.error"));
```

> 约定：业务层凡是要给前端展示的"提示/错误"文案，统一走 `MessageUtils.message(code)`，
> **不要硬编码中文字符串**，否则无法切英文。

---

## 三、资源文件：messages*.properties

资源文件位于 `backend/java/ruoyi-admin/src/main/resources/i18n/`，由 `application.yml` 的 `basename` 指定：

```yaml
# backend/java/ruoyi-admin/src/main/resources/application.yml
spring:
  messages:
    # 国际化资源文件路径（basename = i18n/messages）
    basename: i18n/messages
```

目录下三个文件：

| 文件 | 作用 | 命中条件 |
|------|------|---------|
| `messages.properties` | **默认/兜底**语言包 | 任何 Locale 都找不到对应语言包时回退到它 |
| `messages_zh_CN.properties` | 中文（简体） | Locale = `zh_CN` |
| `messages_en_US.properties` | 英文（美国） | Locale = `en_US` |

> `basename: i18n/messages` 是"前缀"，Spring 会自动在后面拼 `_语言_国家.properties`。
> 例如 Locale=`en_US` → 加载 `i18n/messages_en_US.properties`；找不到则回退 `messages.properties`。

### 文件内容样例（核对自真实文件）

`messages.properties` / `messages_zh_CN.properties`（内容一致）：

```properties
#错误消息
not.null=* 必须填写
user.not.exists=对不起, 您的账号：{0} 不存在.
user.password.retry.limit.exceed=密码输入错误{0}次，账户锁定{1}分钟
user.login.success=登录成功
user.register.success=注册成功
length.not.valid=长度必须在{min}到{max}个字符之间
##权限
no.permission=您没有数据的权限，请联系管理员添加权限 [{0}]
repeat.submit.message=不允许重复提交，请稍候再试
rate.limiter.message=访问过于频繁，请稍候再试
```

`messages_en_US.properties`（同 key，英文 value）：

```properties
#错误消息
not.null=* Required fill in
user.not.exists=Sorry, your account: {0} does not exist
user.password.retry.limit.exceed=Password input error {0} times, account locked for {1} minutes
user.login.success=Login successful
user.register.success=Register successful
length.not.valid=The length must be between {min} and {max} characters
##权限
no.permission=You do not have permission to the data，please contact your administrator to add permissions [{0}]
repeat.submit.message=Repeat submit is not allowed, please try again later
rate.limiter.message=Visit too frequently, please try again later
```

### 占位符两种风格（重要区别）

| 占位符 | 用在哪 | 替换来源 | 例子 |
|--------|--------|---------|------|
| `{0}` `{1}` 数字 | `MessageUtils.message(code, args)` 的 args | 调用方按位置传参 | `user.password.retry.limit.exceed=密码输入错误{0}次` |
| `{min}` `{max}` 命名 | **校验注解**的 message | 校验注解的属性（如 `@Range` 的 min/max） | `length.not.valid=长度必须在{min}到{max}个字符之间` |

> 数字占位符 `{0}` 由 `MessageFormat` 在 `MessageUtils` 内填充；命名占位符 `{min}/{max}` 由
> Hibernate Validator 用注解属性填充（见第五节）。两者机制不同，不要混用。

### 消息码命名约定

观察现有 key，命名遵循"**点分层级 + 业务前缀 + 语义后缀**"：

```
user.login.success           用户.登录.成功
user.password.not.match      用户.密码.不匹配
user.register.save.error     用户.注册.保存.失败
auth.grant.type.error        认证.授权类型.错误
sms.code.not.blank           短信.验证码.不能为空
no.create.permission         没有.创建.权限
repeat.submit.message        重复提交.消息
length.not.valid             长度.不合法
```

新增 key 时遵守：
1. **全小写、点分隔**，按"模块 → 子域 → 含义"分层。
2. 校验类后缀常用 `.not.blank` / `.not.null` / `.not.valid` / `.length.valid`。
3. **三个文件必须同步新增同一个 key**（default + zh_CN + en_US），否则切语言时会漏翻译回退到默认包。

---

## 四、语言切换：LocaleResolver（按请求头）

切语言的全部逻辑在 `ruoyi-common-web` 的两个类：`I18nConfig`（注册）+ `I18nLocaleResolver`（解析）。

### 4.1 注册解析器 I18nConfig

```java
// org.dromara.common.web.config.I18nConfig
@AutoConfiguration(before = WebMvcAutoConfiguration.class)
public class I18nConfig {

    @Bean
    public LocaleResolver localeResolver() {
        return new I18nLocaleResolver();
    }
}
```

用 `@AutoConfiguration(before = WebMvcAutoConfiguration.class)` 把自定义解析器**抢在**
Spring MVC 默认解析器之前注册，从而覆盖默认的 `AcceptHeaderLocaleResolver`。

### 4.2 解析逻辑 I18nLocaleResolver

```java
// org.dromara.common.web.core.I18nLocaleResolver
public class I18nLocaleResolver implements LocaleResolver {

    @Override
    public Locale resolveLocale(HttpServletRequest request) {
        String language = request.getHeader("content-language");
        Locale locale = Locale.getDefault();
        if (language != null && !language.isEmpty()) {
            // 把 zh_CN 这种下划线写法转成标准 BCP-47 标签 zh-CN
            locale = Locale.forLanguageTag(language.replace('_', '-'));
        }
        return locale;
    }

    @Override
    public void setLocale(HttpServletRequest request, HttpServletResponse response, Locale locale) {
        // 当前项目不在服务端主动切换区域，保留空实现
    }
}
```

逐条要点：

1. **认的请求头是 `content-language`**（注意：不是 `Accept-Language`）。前端发请求时把当前语言写进
   `content-language` 头，例如 `content-language: en_US` 或 `content-language: zh_CN`。
2. **缺省回退 `Locale.getDefault()`**：请求头为空时用 JVM 默认 Locale（通常跟随服务器系统语言）。
3. **`replace('_', '-')` + `forLanguageTag`**：把 `zh_CN`（下划线）规范成 `zh-CN`（BCP-47 连字符），
   再解析成 `Locale`。所以前端传 `zh_CN` 或 `zh-CN` 都能识别。
4. **`setLocale` 空实现**：服务端不主动改语言，语言完全由每次请求的头决定（无状态）。

### 4.3 前端怎么带这个头

前端（plus-ui / 移动端）在 axios/请求封装的拦截器里，把当前选择的语言塞进 `content-language` 请求头即可。
例如把用户在界面上切换的语言（`zh_CN` / `en_US`）作为该头的值发出，后端就会用对应语言包翻译返回的提示。

> 一句话带过前端：**plus-ui 在仓库内 `frontend/plus-ui/` 目录**，PC 端界面文案用 Vue i18n（`$t()` / `useI18n`）做前端翻译，
> 与后端 properties 各管一段——前端管"按钮、表头、菜单"等界面静态文案，后端管"接口返回的提示/错误消息"。
> 移动端国际化不在本技能范围，**不展开**。

---

## 五、校验/异常消息国际化

这是后端国际化最常用、也最容易踩坑的场景。

### 5.1 校验注解：message 用 `{code}` 花括号包裹

校验注解（`@NotBlank` / `@NotNull` / `@Range` …）的 `message` 属性，**用 `{消息码}` 写法**，
Hibernate Validator 会自动把它当成国际化 key 去 `MessageSource` 里查（前提是 `ValidatorConfig`
把校验器的 messageSource 设成了 Spring 的 messageSource，见下文）。

来自真实源码 `TestI18nController` 的示例：

```java
@Validated
@RestController
@RequestMapping("/demo/i18n")
public class TestI18nController {

    // 参数级校验：message = "{not.null}" → 翻译为 messages.properties 里 not.null 的值
    @GetMapping("/test1")
    public R<Void> test1(@NotBlank(message = "{not.null}") String str) {
        return R.ok(str);
    }

    // Bean 级校验
    @Data
    public static class TestI18nBo {

        @NotBlank(message = "{not.null}")
        private String name;

        // {length.not.valid} 里的 {min}/{max} 会被 @Range 的 min/max 属性自动填充
        @NotNull(message = "{not.null}")
        @Range(min = 0, max = 100, message = "{length.not.valid}")
        private Integer age;
    }
}
```

对应 properties：

```properties
not.null=* 必须填写
length.not.valid=长度必须在{min}到{max}个字符之间
```

> **关键约定**：校验注解里写 `"{not.null}"`（带花括号）才会被当成国际化 key；
> 写 `"必须填写"`（纯文本）则是固定文案，不翻译。`{length.not.valid}` 里的 `{min}`/`{max}`
> 由 `@Range(min=0, max=100)` 的属性自动注入，这就是"命名占位符"的来源。

### 5.2 校验器国际化的开关：ValidatorConfig

校验注解的 `{code}` 能命中 properties，靠的是 `ruoyi-common-core` 的 `ValidatorConfig`
把 Spring 的 `MessageSource` 绑给了 Hibernate Validator：

```java
// org.dromara.common.core.config.ValidatorConfig
@Bean
public Validator validator(MessageSource messageSource) {
    LocalValidatorFactoryBean factoryBean = new LocalValidatorFactoryBean();
    // 国际化：把校验消息源指向 Spring messageSource（即 messages*.properties）
    factoryBean.setValidationMessageSource(messageSource);
    factoryBean.setProviderClass(HibernateValidator.class);
    Properties properties = new Properties();
    // 快速失败：遇到第一个校验失败立即返回
    properties.setProperty("hibernate.validator.fail_fast", "true");
    factoryBean.setValidationProperties(properties);
    return factoryBean;
}
```

所以校验失败消息会跟随请求头语言切换，且**快速失败模式**下只返回第一个错误。

### 5.3 异常消息国际化：BaseException

业务异常的根类 `BaseException`（`ruoyi-common-core`）在 `getMessage()` 里调用 `MessageUtils.message(code, args)`，
让异常文案也走国际化：

```java
// org.dromara.common.core.exception.base.BaseException#getMessage
@Override
public String getMessage() {
    String message = null;
    if (!StringUtils.isEmpty(code)) {
        // 有错误码 → 走国际化翻译
        message = MessageUtils.message(code, args);
    }
    if (message == null) {
        // 没翻译到 → 用 defaultMessage 兜底
        message = defaultMessage;
    }
    return message;
}
```

即：抛 `new SomeException(code, args)` 时，最终展示给前端的消息会按当前语言翻译；
若只传了 `defaultMessage`（纯文本）则直接用文本，不翻译。

### 5.4 注解文案国际化：@RepeatSubmit / @RateLimiter

防重复提交、限流注解的 `message` 也支持国际化，但写法是 **`{code}` 包裹后由切面判断**：

```java
// RepeatSubmitAspect：message 以 { 开头、} 结尾时，去掉花括号当 code 翻译
String message = repeatSubmit.message();
if (StringUtils.startsWith(message, "{") && StringUtils.endsWith(message, "}")) {
    message = MessageUtils.message(StringUtils.substring(message, 1, message.length() - 1));
}
throw new ServiceException(message);
```

对应 properties 里的 `repeat.submit.message` / `rate.limiter.message`。
所以 `@RepeatSubmit(message = "{repeat.submit.message}")` 会被翻译，而 `@RepeatSubmit(message = "请勿重复提交")` 是固定文本。

---

## 六、代码示例（≥5）

### 示例 1：Service 返回国际化提示

```java
// 给前端的提示走 MessageUtils，不要硬编码中文
public R<Void> logout() {
    StpUtil.logout();
    return R.ok(MessageUtils.message("user.logout.success"));
    // zh_CN → 退出成功；en_US → Exit successful
}
```

### 示例 2：带占位符参数的消息

```java
// properties: user.password.retry.limit.exceed=密码输入错误{0}次，账户锁定{1}分钟
String msg = MessageUtils.message("user.password.retry.limit.exceed", errorNumber, lockTime);
// 传入 errorNumber=3, lockTime=10 → "密码输入错误3次，账户锁定10分钟"
```

### 示例 3：参数级校验国际化

```java
@GetMapping("/check")
public R<Void> check(@NotBlank(message = "{user.username.not.blank}") String username) {
    return R.ok();
    // 校验失败：zh_CN → 用户名不能为空；en_US → Username cannot be blank
}
```

### 示例 4：Bean 校验 + 命名占位符

```java
@Data
public class UserBo {
    @NotBlank(message = "{user.username.not.blank}")
    @Length(min = 2, max = 20, message = "{user.username.length.valid}")
    private String userName;
    // properties: user.username.length.valid=账户长度必须在{min}到{max}个字符之间
    // {min}/{max} 由 @Length 的属性自动填充
}
```

### 示例 5：业务异常国际化

```java
// 抛带 code 的异常，getMessage() 自动翻译
if (userService.checkUserNameUnique(user)) {
    throw new ServiceException("user.register.save.error", new Object[]{user.getUserName()});
    // zh_CN → 保存用户 xxx 失败，注册账号已存在
    // en_US → Failed to save user xxx, The registered account already exists
}
```

### 示例 6：新增一组消息码（三文件同步）

```properties
# messages.properties 与 messages_zh_CN.properties
order.status.invalid=订单状态不合法
order.amount.exceed=订单金额超过上限 {0} 元

# messages_en_US.properties
order.status.invalid=Invalid order status
order.amount.exceed=Order amount exceeds the limit of {0} yuan
```

```java
throw new ServiceException("order.amount.exceed", new Object[]{maxAmount});
```

---

## 七、常见错误对比（≥3）

### 错误 1：硬编码中文，无法切英文

```java
// ❌ 错误：写死中文，en_US 请求也只能拿到中文
return R.fail("登录失败");

// ✅ 正确：走国际化 code，跟随请求头语言
return R.fail(MessageUtils.message("user.password.not.match"));
```

### 错误 2：只在一个 properties 里加 key，漏改其它语言包

```properties
# ❌ 错误：只在 messages_zh_CN.properties 加了 order.cancel.fail
#    en_US 请求找不到该 key → 回退到 messages.properties，若那里也没有 → 返回 code 原文 "order.cancel.fail"

# ✅ 正确：三个文件同步加（default + zh_CN + en_US）
# messages.properties / messages_zh_CN.properties
order.cancel.fail=取消订单失败
# messages_en_US.properties
order.cancel.fail=Failed to cancel order
```

### 错误 3：校验注解 message 忘了花括号

```java
// ❌ 错误：纯文本被当成固定文案，不会去 properties 翻译
@NotBlank(message = "not.null")          // 前端直接看到字符串 "not.null"
@NotBlank(message = "用户名不能为空")      // 固定中文，无法切英文

// ✅ 正确：用 {code} 花括号包裹，才会被 Validator 当国际化 key
@NotBlank(message = "{user.username.not.blank}")
```

### 错误 4：以为认的是 Accept-Language

```text
❌ 错误认知：前端发 Accept-Language: en-US 就能切语言
   —— I18nLocaleResolver 读的是 content-language 头，Accept-Language 不生效。

✅ 正确：前端把语言写进 content-language 头（值如 zh_CN / en_US），
   下划线/连字符都行（内部 replace('_','-') 后再 forLanguageTag 解析）。
```

### 错误 5：用了 6.x 禁用的旧包名/旧概念

```text
❌ org.dromara 项目里禁止出现：plus.ruoyi / com.ruoyi 包名、DAO 层、PlusLambdaQuery、
   likeCast、默认 TenantEntity、is_deleted 字段、移动端 useI18n、plus-uniapp 相关写法。
   本技能聚焦后端 i18n，移动端国际化不写。

✅ 后端国际化只用：org.dromara.common.core.utils.MessageUtils、
   org.dromara.common.web.core.I18nLocaleResolver、i18n/messages*.properties。
```

---

## 八、最佳实践

1. **凡是给前端看的提示/错误，一律 `MessageUtils.message(code)`**，禁止硬编码中文字符串。
2. **新增 key 三文件同步**：`messages.properties`（默认兜底）、`messages_zh_CN.properties`、`messages_en_US.properties`
   缺一不可，避免切语言时回退到 code 原文。
3. **消息码命名守约定**：全小写、点分层级、按"模块.子域.含义"组织，校验类用 `.not.blank` / `.not.valid` 等后缀。
4. **占位符分清两类**：`MessageUtils` 的 args 用 `{0}{1}` 数字占位；校验注解的命名占位 `{min}{max}`
   由注解属性自动填充，不要手动传。
5. **校验注解 message 必须 `{code}` 包裹**才走国际化；`@RepeatSubmit`/`@RateLimiter` 同理用花括号。
6. **业务异常优先用 `code + args` 构造**（如 `ServiceException`/`BaseException` 体系），让异常文案自动翻译；
   只有真的没有合适 code 时才用 `defaultMessage` 纯文本兜底。
7. **排查"返回了一串 key"**：先确认 properties 里有没有该 key、拼写是否一致、目标语言包是否漏配——
   因为 `MessageUtils` 找不到时静默返回 code，不报错。
8. **properties 文件统一 UTF-8 无 BOM**，中文 value 直接写中文（Spring Boot 默认按 UTF-8 读取 messages），
   不要再用旧的 `\uXXXX` 转义。
9. **语言无状态**：后端不存"用户语言偏好"，每个请求都靠 `content-language` 头决定语言，前端负责每次带头。
10. **前端 plus-ui 国际化各管一段**（一句带过）：界面静态文案用 Vue i18n（`$t()`/`useI18n`），
    接口返回提示用后端 properties，两边 key 体系独立，不要试图共用同一份语言文件。

---

## 源码引用（本技能所有结论的出处）

| 文件 | 路径（相对本项目根） | 说明 |
|------|----------------------------------|------|
| MessageUtils | `backend/java/ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/utils/MessageUtils.java` | 翻译入口 `message(code, args)` |
| I18nConfig | `backend/java/ruoyi-common/ruoyi-common-web/src/main/java/org/dromara/common/web/config/I18nConfig.java` | 注册 LocaleResolver Bean |
| I18nLocaleResolver | `backend/java/ruoyi-common/ruoyi-common-web/src/main/java/org/dromara/common/web/core/I18nLocaleResolver.java` | 按 `content-language` 头解析 Locale |
| ValidatorConfig | `backend/java/ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/config/ValidatorConfig.java` | 校验器绑定 MessageSource + 快速失败 |
| BaseException | `backend/java/ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/exception/base/BaseException.java` | 异常 `getMessage()` 走国际化 |
| RepeatSubmitAspect | `backend/java/ruoyi-common/ruoyi-common-redis/src/main/java/org/dromara/common/redis/aspectj/RepeatSubmitAspect.java` | `{code}` 花括号判断 → 翻译 |
| TestI18nController | `backend/java/ruoyi-modules/ruoyi-demo/src/main/java/org/dromara/demo/controller/TestI18nController.java` | 官方国际化示例（message=`{code}`） |
| application.yml | `backend/java/ruoyi-admin/src/main/resources/application.yml`（`spring.messages.basename=i18n/messages`） | 资源包前缀配置 |
| messages.properties | `backend/java/ruoyi-admin/src/main/resources/i18n/messages.properties` | 默认/兜底语言包 |
| messages_zh_CN.properties | `backend/java/ruoyi-admin/src/main/resources/i18n/messages_zh_CN.properties` | 中文语言包 |
| messages_en_US.properties | `backend/java/ruoyi-admin/src/main/resources/i18n/messages_en_US.properties` | 英文语言包 |
