---
name: error-handler
description: |
  设计 base-dev-framework6-java的异常处理机制、错误码体系与日志规范。讲解 ServiceException 业务异常的抛出方式、GlobalExceptionHandler 全局异常处理器如何把各类异常统一收敛成 R 响应、R 的错误码体系、@Slf4j 日志规范，以及 try-catch 的正确用法与校验失败提示。

  触发场景：
  - 需要在 Service 层抛出业务异常并给前端友好提示（如"流程分类不存在"、"权限不足"）
  - 需要设计或扩展全局异常处理器，统一某类异常的返回格式
  - 需要确定接口返回的错误码（401/403/404/500/601）以及 R.fail 的用法
  - 需要规范日志打印（log.error 带堆栈 vs log.info 业务流水）
  - 需要让 @Validated 参数校验失败时返回可读的中文提示
  - 需要判断"何时主动抛 ServiceException、何时交给全局兜底"

  触发词：异常处理、ServiceException、try-catch、全局异常、GlobalExceptionHandler、错误码、日志规范、@Slf4j、错误提示、校验异常、R响应

  注意：本技能讲"设计异常处理机制"；如果是排查已经发生的 Bug（报错、功能不正常），请使用 bug-detective。
---

# 异常处理机制设计（error-handler）

> 适用框架：base-dev-framework6-java（包名 `org.dromara`）。
> 本技能讲"**如何设计异常处理机制**"——抛什么异常、谁来兜底、返回什么码、怎么打日志。
> 排查"**已经发生的 Bug**"（某接口报 500、某功能不生效）请改用 `bug-detective`。

## 一、概述

6.x 的异常处理是一套"**业务主动抛 + 全局统一兜底**"的双层机制，核心由三个真实类构成：

| 角色 | 真实类 | 位置 | 职责 |
|------|--------|------|------|
| 业务异常 | `ServiceException` | `ruoyi-common-core` → `org.dromara.common.core.exception.ServiceException` | 业务层显式抛出的"可预期失败"，带 code/message |
| 国际化基类异常 | `BaseException` | `org.dromara.common.core.exception.base.BaseException` | 按错误码 + MessageSource 解析提示，`UserException` 等继承它 |
| 全局处理器 | `GlobalExceptionHandler` | `ruoyi-common-web` → `org.dromara.common.web.handler.GlobalExceptionHandler` | `@RestControllerAdvice`，把各类异常收敛为统一 `R` 响应 |
| Sa-Token 处理器 | `SaTokenExceptionHandler` | `ruoyi-common-satoken` → `org.dromara.common.satoken.handler.SaTokenExceptionHandler` | 专门处理未登录/无权限/无角色异常 |
| 统一响应体 | `R<T>` | `org.dromara.common.core.domain.R` | 含 `code` / `msg` / `data` 三字段 |
| 状态码常量 | `HttpStatus`（接口） | `org.dromara.common.core.constant.HttpStatus` | `R.fail` 使用的业务码（200/401/500/601 等） |

设计哲学：
- **业务层只管"抛"**：遇到可预期失败（数据不存在、权限不足、状态非法）直接 `throw new ServiceException(...)`，不自己拼 `R.fail`，不自己 try-catch 吞掉。
- **全局只管"收"**：`GlobalExceptionHandler` 用 `@ExceptionHandler` 把所有异常转成 `R`，Controller 永远不需要写 try-catch。
- **Sa-Token 单独收**：认证/授权异常不在主处理器，而在 `satoken` 模块的处理器里，提示文案按异常类型细分。

## 二、ServiceException —— 业务异常的标准抛法

`ServiceException extends RuntimeException`，是 `final` 类，字段 `code`（Integer，可空）、`message`、`detailMessage`（内部调试用，不返回前端）。

### 真实构造方法（核对源码，没有静态 of 工厂）

```java
// 1) 仅消息（最常用，code 为 null，全局处理器返回默认 500 码）
throw new ServiceException("流程分类不存在，无法修改");

// 2) 消息 + 错误码（需要前端区分处理时用）
throw new ServiceException("登录已过期", 401);

// 3) 占位符格式化（底层用 Hutool StrFormatter，{} 占位）
throw new ServiceException("用户[{}]不存在", userId);

// 4) 链式设置内部调试明细（detailMessage 不返回前端，仅供排查）
throw new ServiceException("导入失败").setDetailMessage("第 3 行手机号格式非法");
```

> 🔴 6.x 铁律：原版没有 `ServiceException.of(...)` 静态方法。请用 `new ServiceException(...)`。
> 不要凭印象写 `ServiceException.of()`，那是某些衍生版/工具版的写法，原版编译不过。

### detailMessage 用途

`detailMessage` 是给开发者看的"内部明细"，前端拿到的只是 `message`。当一个对外提示需要笼统（"导入失败，请检查文件"），但日志里又想留详细原因时，用它分离两层信息。

## 三、GlobalExceptionHandler —— 全局兜底（核对源码逐项）

`@RestControllerAdvice` + 一组 `@ExceptionHandler`，把异常映射成 `R<Void>`。下表是源码真实处理的异常清单：

| 异常类型 | 返回码 | 返回 msg | 日志级别 |
|----------|--------|----------|----------|
| `ServiceException`（业务异常） | 有 code 用 code，否则 500 | `e.getMessage()` | `log.error(message)` |
| `BaseException`（国际化异常） | 500 | `e.getMessage()`（按 code 国际化） | `log.error(message)` |
| `HttpRequestMethodNotSupportedException`（请求方式不支持） | 405 | "不支持 'XXX' 请求" | `log.error` |
| `MissingPathVariableException`（缺路径变量） | 500 | "请求路径中缺少必需的路径变量[xxx]" | `log.error` |
| `MethodArgumentTypeMismatchException`（参数类型不匹配） | 500 | "请求参数类型不匹配，参数[xxx]要求类型为..." | `log.error` |
| `NoHandlerFoundException`（找不到路由） | 404 | "请求地址不存在" | `log.error` |
| `MethodArgumentNotValidException`（@RequestBody 校验失败） | 500 | 拼接所有字段的 defaultMessage | `log.error` |
| `BindException`（表单/Query 校验失败） | 500 | 拼接所有错误的 defaultMessage | `log.error` |
| `ConstraintViolationException`（方法参数约束违反） | 500 | 拼接所有 violation message | `log.error` |
| `HandlerMethodValidationException`（@Validated 方法级校验） | 500 | 拼接所有错误的 defaultMessage | `log.error` |
| `JsonParseException`（JSON 解析失败） | 400 | "请求数据格式错误" | `log.error` |
| `HttpMessageNotReadableException`（请求体读取失败） | 400 | "请求参数格式错误" | `log.error` |
| `ExpressionException`（SpEL 解析异常） | 500 | "SpEL解析失败：..." | `log.error` |
| `IOException`（含 SSE 连接中断） | 不返回 R（void） | —（SSE 中断直接屏蔽） | `log.error`（非 SSE 时） |
| `AsyncRequestTimeoutException`（SSE 超时） | 不处理（空方法） | — | — |
| `RuntimeException`（未知运行时异常） | 500 | "发生未知异常，请联系管理员 [错误编号: 8位随机]" | `log.error` 带堆栈 |
| `Exception`（最终兜底） | 500 | "发生系统异常，请联系管理员 [错误编号: 8位随机]" | `log.error` 带堆栈 |

关键设计点（直接来自源码）：

1. **ServiceException 只打 message、不打堆栈**：因为它是"可预期业务失败"，堆栈无意义，`log.error(e.getMessage())` 即可。
2. **未知异常打错误编号**：`RuntimeException` / `Exception` 兜底时用 `RandomUtil.randomNumbers(8)` 生成 8 位编号，既写进日志又拼进返回 msg，运维拿编号能在日志里定位完整堆栈，前端不暴露内部细节。
3. **校验异常统一拼接**：四类校验异常（MethodArgumentNotValid / Bind / ConstraintViolation / HandlerMethodValidation）都用 `StreamUtils.join(..., ", ")` 把多个字段错误拼成一句，返回前端时是逗号分隔的可读中文。
4. **SSE 容错**：`IOException` 里判断 URI 是否包含 `message.path`，是则认为是 SSE 关闭浏览器导致的正常中断，直接 return 不打错误日志。

## 四、Sa-Token 认证授权异常（独立处理器）

认证/授权异常**不在** `GlobalExceptionHandler`，而在 `SaTokenExceptionHandler`（`ruoyi-common-satoken`）：

| 异常 | 返回码 | 文案 |
|------|--------|------|
| `NotPermissionException`（缺权限码） | 403 | "没有访问权限，请联系管理员授权" |
| `NotRoleException`（缺角色） | 403 | "没有访问权限，请联系管理员授权"（日志区分"角色权限校验失败"） |
| `NotLoginException`（未登录/失效） | 401 | 按 `e.getType()` 细分：TOKEN_TIMEOUT→"登录已过期，请重新登录"；BE_REPLACED→"当前账号已在其他设备登录，您已被强制下线"；KICK_OUT→"账号已被管理员强制下线"；TOKEN_FREEZE→"账号已被冻结，请联系管理员处理"；默认→"登录状态异常，请重新登录" |

设计要点：未登录异常按 Sa-Token 的 `type` 分支给出**不同人话提示**，而不是统一一句"未登录"，前端能据 401 + msg 决定跳登录页还是弹"被踢下线"提示。

## 五、错误码体系（R 的 code）

`R<T>` 三字段：`code`（int）、`msg`（String）、`data`（T）。码值来自 `HttpStatus` 接口常量：

| 常量 | 值 | 含义 | 触发处 |
|------|----|------|--------|
| `SUCCESS` | 200 | 操作成功 | `R.ok()` / `R.data()` |
| `BAD_REQUEST` | 400 | 参数/格式错误 | JSON 解析、请求体读取失败 |
| `UNAUTHORIZED` | 401 | 未认证 | Sa-Token NotLogin、SseException |
| `FORBIDDEN` | 403 | 无权限 | Sa-Token NotPermission/NotRole |
| `NOT_FOUND` | 404 | 资源不存在 | NoHandlerFoundException |
| `BAD_METHOD` | 405 | 请求方式不支持 | HttpRequestMethodNotSupported |
| `ERROR` | 500 | 系统/业务错误 | `R.fail()`、未捕获异常、无 code 的 ServiceException |
| `WARN` | 601 | 业务警告 | `R.warn(msg)` |

`R` 的构造静态方法（按需选）：

```java
R.ok();                 // code=200, msg="操作成功", data=null
R.ok(data);             // 带数据
R.ok("自定义提示", data); // 自定义提示 + 数据
R.data(data);           // 语义化的"带数据成功"
R.fail();               // code=500, msg="操作失败"
R.fail("自定义失败提示"); // code=500 + 自定义 msg
R.fail(401, "登录已过期"); // 自定义码 + msg
R.warn("数据已存在，已为您跳过"); // code=601 警告
R.isSuccess(r);         // 判断 r.code == 200
R.isError(r);           // 判断非成功
```

> 🔴 业务码与 HTTP 状态码是**两套**。多数接口 HTTP 仍是 200，靠 `R.code` 区分成败。
> 仅认证(401)/无权限(403)/未实现(SSE)等少数场景，处理器加了 `@ResponseStatus` 同步改 HTTP 状态。

## 六、日志规范（@Slf4j）

6.x 统一用 Lombok `@Slf4j` 注入 `log`，**禁止**手写 `LoggerFactory.getLogger`。

| 级别 | 用途 | 是否带堆栈 | 示例 |
|------|------|-----------|------|
| `log.error` | 系统/未知异常、需要排查的失败 | 未知异常带堆栈（最后一参传 `e`） | `log.error("请求地址'{}',发生系统异常, 错误编号: {}", uri, errorId, e);` |
| `log.error`（业务异常） | ServiceException 这类可预期失败 | **不带堆栈**，只打 message | `log.error(e.getMessage());` |
| `log.warn` | 可恢复的异常情况、降级 | 一般不带堆栈 | `log.warn("短信网关超时，已降级为本地记录: {}", phone);` |
| `log.info` | 关键业务流水、状态流转 | 否 | `log.info("订单[{}]支付成功，金额={}", orderNo, amount);` |
| `log.debug` | 调试细节、入参出参 | 否 | `log.debug("查询条件: {}", JsonUtils.toJsonString(bo));` |

规范要点：
1. **占位符用 `{}`，不要字符串拼接**：`log.info("用户{}登录", userId)` 而非 `"用户" + userId`，避免无谓拼接开销。
2. **打堆栈把异常对象放最后一个参数**：`log.error("xxx={}", v, e)`，SLF4J 会识别末尾 Throwable 自动打印堆栈，不要写成 `e.getMessage()` 丢失栈。
3. **可预期业务失败别打全堆栈**：ServiceException 只记 message，避免日志被业务校验失败的栈刷屏。
4. **未知异常配错误编号**：参考全局处理器，给前端一个编号、把编号 + 堆栈记日志，便于联调时报编号查日志。

## 七、代码示例（≥5）

### 示例 1：Service 层主动抛业务异常（最常见）

```java
@Slf4j
@Service
public class SysPostServiceImpl implements ISysPostService {

    @Override
    public int deleteById(Long postId) {
        // 可预期失败：岗位仍有用户在用，直接抛 ServiceException
        if (userMapper.countUserByPostId(postId) > 0) {
            throw new ServiceException("该岗位下存在用户，无法删除");
        }
        return postMapper.deleteById(postId);
    }
}
```
> Controller 不需要任何 try-catch，全局处理器自动转成 `R.fail(500, "该岗位下存在用户，无法删除")`。

### 示例 2：带错误码 + 占位符的业务异常

```java
@Override
public LoginUser checkLogin(String username, String token) {
    if (StringUtils.isBlank(token)) {
        // 带 401 码，前端据码跳登录页
        throw new ServiceException("登录凭证缺失，请重新登录", 401);
    }
    SysUserVo user = userMapper.selectByUsername(username);
    if (user == null) {
        // 占位符格式化，{} 由 Hutool StrFormatter 填充
        throw new ServiceException("用户[{}]不存在或已被禁用", username);
    }
    return buildLoginUser(user);
}
```

### 示例 3：@Validated 校验失败自动转可读提示（无需手写处理）

```java
// DTO（BO）声明校验注解
@Data
public class SysPostBo {
    @NotBlank(message = "岗位名称不能为空")
    private String postName;

    @NotBlank(message = "岗位编码不能为空")
    private String postCode;
}

// Controller 加 @Validated 即可，校验失败由 GlobalExceptionHandler 兜底
@PostMapping
public R<Void> add(@Validated @RequestBody SysPostBo bo) {
    return toAjax(postService.insert(bo));
}
```
> 当 postName / postCode 都为空时，`MethodArgumentNotValidException` 被全局处理器捕获，
> 返回 `R.fail("岗位名称不能为空, 岗位编码不能为空")`（多字段逗号拼接）。**不要**在 Controller 自己 try-catch 校验异常。

### 示例 4：try-catch 的正确用法 —— 仅"补充上下文后重抛"

```java
@Override
public void importUser(MultipartFile file) {
    try {
        List<UserImportVo> rows = ExcelUtil.importExcel(file.getInputStream(), UserImportVo.class);
        doImport(rows);
    } catch (IOException e) {
        // 捕获是为了：记详细日志 + 换成对前端友好的业务异常，而不是吞掉
        log.error("用户导入失败，文件={}", file.getOriginalFilename(), e);
        throw new ServiceException("导入失败，请检查文件格式").setDetailMessage(e.getMessage());
    }
}
```
> 原则：**catch 后必须做事**（记日志 / 转业务异常 / 资源清理），不允许空 catch 或只 `e.printStackTrace()` 吞掉。

### 示例 5：扩展全局处理器，新增某类异常的统一处理

```java
// 自定义模块异常处理器，同样用 @RestControllerAdvice
@Slf4j
@RestControllerAdvice
public class PaymentExceptionHandler {

    /**
     * 第三方支付网关异常统一收敛为 601 警告码（可恢复，前端弹提示而非报错）
     */
    @ExceptionHandler(PayGatewayException.class)
    public R<Void> handlePayGateway(PayGatewayException e, HttpServletRequest request) {
        log.warn("请求地址'{}',支付网关异常: {}", request.getRequestURI(), e.getMessage());
        return R.warn("支付渠道暂不可用，请稍后重试");
    }
}
```
> 新增处理器只需声明 `@RestControllerAdvice` + `@ExceptionHandler`，Spring 自动织入，**不要**去改原版 `GlobalExceptionHandler`。

## 八、常见错误对比（≥3）

### 错误 1：在 Controller / Service 自己拼 R.fail 代替抛异常

```java
// ❌ 错误：分散在各处的 R.fail，无法统一日志/监控，且破坏分层
public R<Void> delete(Long id) {
    if (countUser(id) > 0) {
        return R.fail("该岗位下存在用户，无法删除"); // 业务判断混进返回处理
    }
    return toAjax(mapper.deleteById(id));
}

// ✅ 正确：Service 抛 ServiceException，Controller 只管正常流程
public R<Void> delete(Long id) {
    return toAjax(postService.deleteById(id)); // 失败时 deleteById 内部抛异常
}
```

### 错误 2：用 ServiceException.of()（原版不存在该方法）

```java
// ❌ 错误：原版 ServiceException 没有静态 of 工厂，编译不通过
throw ServiceException.of("xxx");

// ✅ 正确：用 new
throw new ServiceException("xxx");
```

### 错误 3：catch 后吞异常或打印到控制台

```java
// ❌ 错误：吞掉异常，前端永远拿到"成功"，问题被隐藏
try {
    doSomething();
} catch (Exception e) {
    // 什么都不做 / e.printStackTrace();
}

// ✅ 正确：记日志 + 转业务异常向上抛
try {
    doSomething();
} catch (Exception e) {
    log.error("业务处理失败", e);
    throw new ServiceException("处理失败，请稍后重试");
}
```

### 错误 4：日志用字符串拼接 + 丢失堆栈

```java
// ❌ 错误：拼接开销 + 末尾 e.getMessage() 丢栈，排查时只有一行消息
log.error("用户" + userId + "处理失败: " + e.getMessage());

// ✅ 正确：占位符 + 末尾传异常对象（SLF4J 自动打堆栈）
log.error("用户{}处理失败", userId, e);
```

## 九、最佳实践

1. **业务可预期失败一律 `throw new ServiceException(...)`**，让全局处理器统一转 `R`，绝不在业务里手拼 `R.fail`。
2. **Controller 不写 try-catch**，所有异常交给 `GlobalExceptionHandler` / `SaTokenExceptionHandler` 收敛。
3. **catch 必须有意义**：记日志、转换异常、释放资源三选一以上，禁止空 catch。
4. **错误码语义化**：能预期的失败用 `new ServiceException(msg, code)` 指定码（如 401）；纯业务失败用无码构造走默认 500；可恢复的弱提示用 `R.warn`（601）。
5. **校验交给注解**：参数合法性用 `@NotBlank` / `@Validated` 等注解 + DTO 声明 message，校验异常由全局处理器拼成可读提示，不要在方法里手写 if 判空再抛。
6. **日志分级清晰**：业务流水 `log.info`、可恢复异常 `log.warn`、系统/未知异常 `log.error` 带堆栈、调试细节 `log.debug`；统一用 `@Slf4j`。
7. **未知异常给编号**：兜底处理器生成错误编号写日志 + 回前端，既保护内部细节又便于按编号定位。
8. **detailMessage 分离内外**：对前端笼统、对日志详细时，用 `setDetailMessage` 存调试明细（不返回前端）。

## 十、6.x 铁律（必须遵守）

- 包名一律 `org.dromara.*`，禁用 `plus.ruoyi` / `com.ruoyi`。
- 三层架构（Controller / Service / Mapper），无独立 DAO 层；查询用 `LambdaQueryWrapper`，禁用 `PlusLambdaQuery` / `likeCast`。
- 实体默认继承 `BaseEntity`，逻辑删除字段与多租户按原版约定，禁止默认套 `TenantEntity` / 写死 `is_deleted`。
- `ServiceException` 用 `new`，**没有** `.of()` 静态工厂。
- 日志统一 `@Slf4j`，禁止手写 Logger。

## 十一、与相关技能的边界

- **本技能（error-handler）**：设计异常处理机制——抛什么、谁兜底、返什么码、怎么打日志。
- **bug-detective**：排查"已经发生"的 Bug（某接口 500、某功能不生效），定位根因。设计机制看本技能，**排查具体故障请转 `bug-detective`**。
- **security-guard**：Sa-Token 认证授权的配置细节（`@SaCheckPermission` 等），认证异常的文案在本技能讲，权限校验的注解用法去那里。
- **log-audit**：操作日志/审计（`@Log` 注解、`sys_oper_log`），与本技能的"运行日志（log.info/error）"是两回事。

## 引用的真实源文件

- `backend/java/ruoyi-common/ruoyi-common-web/src/main/java/org/dromara/common/web/handler/GlobalExceptionHandler.java`
- `backend/java/ruoyi-common/ruoyi-common-satoken/src/main/java/org/dromara/common/satoken/handler/SaTokenExceptionHandler.java`
- `backend/java/ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/exception/ServiceException.java`
- `backend/java/ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/exception/base/BaseException.java`
- `backend/java/ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/exception/user/UserException.java`
- `backend/java/ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/domain/R.java`
- `backend/java/ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/constant/HttpStatus.java`
