---
name: log-audit
description: |
  base-dev-framework6-java操作日志 / 登录日志 / 审计追踪开发指南。涵盖 @Log 注解、
  BusinessType 操作类型、LogAspect 切面、OperLogEvent / LoginInfoEvent 异步事件、敏感参数
  脱敏（excludeParamNames / isSaveRequestData / isSaveResponseData）、sys_oper_log /
  sys_login_info 查询导出。所有成员名、包路径均核对自真实源码（org.dromara.common.log.*）。

  触发场景：
  - 为 Controller 写接口加 @Log 注解记录操作日志
  - 配置操作类型 BusinessType（INSERT / UPDATE / DELETE / EXPORT / IMPORT / GRANT / FORCE 等）
  - 排除敏感参数（密码、token）不写入日志库，或控制请求/响应是否落库
  - 查询、导出、清空 sys_oper_log 操作日志与 sys_login_info 登录日志
  - 定位"接口为什么没记日志""日志里为什么没有参数""密码怎么进了日志"

  触发词：操作日志、登录日志、审计、审计追踪、@Log、sys_oper_log、sys_login_info、sys_logininfor、
  BusinessType、OperatorType、BusinessStatus、LogAspect、OperLogEvent、LoginInfoEvent、
  recordLoginInfo、excludeParamNames、isSaveRequestData、isSaveResponseData、日志脱敏、日志记录、日志参数
---

# log-audit · 操作日志 / 登录日志 / 审计追踪（base-dev-framework6-java）

> 本技能所有类名、注解成员、枚举值、事件字段、表名均核对自真实源码：
> `backend/java/ruoyi-common/ruoyi-common-log/src/main/java/org/dromara/common/log/`
> 与 `backend/java/ruoyi-modules/ruoyi-system/.../service/impl/SysOperLogServiceImpl.java`、`SysLoginInfoServiceImpl.java`、
> `backend/java/ruoyi-admin/.../web/service/SysLoginService.java`。**不要凭 5.x / 其他版本记忆编造成员名。**

---

## 0. 6.x 铁律（写日志代码前先读）

| 项 | 框架约定正确值 | ❌ 禁止（属于 5.x / plus 老版 / 其他分支） |
|----|----------------------|------------------------------------------|
| 包前缀 | `org.dromara.common.log.*` | `com.ruoyi.*`、`plus.ruoyi.*` |
| 注解 | `org.dromara.common.log.annotation.Log` | 自造 `@OperLog`、`@AuditLog` |
| 操作类型枚举 | `BusinessType`（org.dromara.common.log.enums） | `DictOperType`、`OperType`（本版**没有**这些类） |
| 登录事件 | `LoginInfoEvent` | `LoginLogEvent`、`LogininforEvent`、`LoginLogPublisher`（本版**没有**） |
| 操作日志事件 | `OperLogEvent` | `SysOperLog` 直接当事件发布 |
| 登录日志表 | `sys_login_info`（@TableName 实测） | 旧名 `sys_logininfor`（5.x 用，本版已改名） |
| 操作日志表 | `sys_oper_log` | —— |
| 数据访问 | Mapper + `QueryBuilder.lambda()` / `lambda()` 链式 | DAO 层、`PlusLambdaQuery`、`likeCast`（本版无 DAO 层） |
| 实体基类 | `SysOperLog` / `SysLoginInfo` 普通实体 | `TenantEntity`（默认，日志表不强加多租户基类） |

> 提醒：登录日志表名在本版是 `sys_login_info`（核对 `SysLoginInfo` 的 `@TableName("sys_login_info")`），
> 5.x 习惯写的 `sys_logininfor` 在这里**不存在**。触发词保留 `sys_logininfor` 仅为兼容用户口语，落代码时一律用真实表名。

---

## 1. 概述：日志体系两条独立链路

本项目 的审计能力由 `ruoyi-common-log` 模块提供，分两条互不相干的链路：

```
① 操作日志（业务接口审计）
   Controller 方法标 @Log
        │ AOP 环绕
   LogAspect.doAround()  → 组装 OperLogEvent
        │ SpringUtils.context().publishEvent(operLog)   （同步发布）
   SysOperLogServiceImpl.recordOper(@Async @EventListener)  （异步消费 → 落 sys_oper_log）

② 登录日志（认证审计）
   SysLoginService.recordLoginInfo(username, status, message)  → new LoginInfoEvent()
        │ SpringUtils.context().publishEvent(loginInfoEvent)
   SysLoginInfoServiceImpl.recordLoginInfo(@Async @EventListener)  （异步消费 → 落 sys_login_info）
```

关键设计：
- **解耦**：切面/登录服务只负责"发事件"，落库由 `@EventListener` 监听者完成；监听者带 `@Async`，**异步入库不阻塞主请求**。
- **失败不影响业务**：`LogAspect.handleLog` 整段包在 try-catch 里，记日志抛异常只 `log.error("记录操作日志异常", exp)`，绝不把异常抛回业务线程。
- 操作日志切点是 `@annotation(controllerLog)`，即**只有标了 `@Log` 的方法才记**，不是全局拦截。

---

## 2. @Log 注解：用法与全部成员

注解定义（真实源码 `annotation/Log.java`）：

```java
@Target({ElementType.PARAMETER, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Log {
    String title() default "";                              // 模块标题
    BusinessType businessType() default BusinessType.OTHER; // 业务操作类型
    OperatorType operatorType() default OperatorType.MANAGE;// 操作人类别
    boolean isSaveRequestData() default true;               // 是否保存请求参数
    boolean isSaveResponseData() default true;              // 是否保存响应结果
    String[] excludeParamNames() default {};                // 排除指定请求参数名
}
```

成员逐项说明：

| 成员 | 类型 | 默认值 | 落库字段（OperLogEvent） | 说明 |
|------|------|--------|------------------------|------|
| `title` | String | `""` | `title` | 模块名，如 `"用户管理"`，建议与菜单/业务对应 |
| `businessType` | `BusinessType` | `OTHER` | `businessType`（存 `ordinal()`） | 操作类型，见第 3 节 |
| `operatorType` | `OperatorType` | `MANAGE` | `operatorType`（存 `ordinal()`） | 操作人类别：OTHER / MANAGE / MOBILE |
| `isSaveRequestData` | boolean | `true` | `operParam` | false 则不记录请求参数 |
| `isSaveResponseData` | boolean | `true` | `jsonResult` | false 则不记录返回结果 |
| `excludeParamNames` | String[] | `{}` | 影响 `operParam` | 按参数名排除敏感字段 |

标注位置：**Controller 的写接口方法**（增删改、授权、导入导出、强退、清空等）。查询类 `list/getInfo` 通常不标（避免日志爆量）。

---

## 3. BusinessType 操作类型枚举（核对源码，共 10 个）

真实源码 `enums/BusinessType.java`，**按声明顺序，ordinal 落库**：

| ordinal | 枚举值 | 含义 | 典型接口 |
|--------:|--------|------|---------|
| 0 | `OTHER` | 其它（默认） | 不分类的操作 |
| 1 | `INSERT` | 新增 | `add()` |
| 2 | `UPDATE` | 修改 | `edit()` |
| 3 | `DELETE` | 删除 | `remove()` |
| 4 | `GRANT` | 授权 | 角色授权、数据权限分配 |
| 5 | `EXPORT` | 导出 | `export()` 导 Excel |
| 6 | `IMPORT` | 导入 | `importData()` |
| 7 | `FORCE` | 强退 | 强制下线在线用户 |
| 8 | `GENCODE` | 生成代码 | 代码生成器 |
| 9 | `CLEAN` | 清空数据 | 清空日志/缓存 |

> ⚠️ ordinal 与顺序强绑定：枚举里**不能随意插入或重排**，否则历史日志的 `business_type` 数值会错位对应。
> 新增类型只能追加到末尾。

配套枚举：
- `OperatorType`：`OTHER(0)` / `MANAGE(1 后台用户)` / `MOBILE(2 手机端用户)`，默认 `MANAGE`。
- `BusinessStatus`：`SUCCESS(0)` / `FAIL(1)`，由切面自动判定（捕获异常即置 FAIL 并写 `errorMsg`），**不是 @Log 成员**。

---

## 4. LogAspect 切面工作流（理解才能排错）

真实源码 `aspect/LogAspect.java`，关键流程：

1. `@Around("@annotation(controllerLog)")` 环绕标了 `@Log` 的方法，用 `StopWatch` 计时。
2. `joinPoint.proceed()` 执行业务；成功传 `jsonResult`，抛异常则 `status=FAIL` 并记 `errorMsg`（截断到 3800 字）。
3. `handleLog` 组装 `OperLogEvent`：
   - 从 `ServletUtils.getRequest()` 取 IP、URI（截断到 255）、请求方式、`clientKey`。
   - 从 `LoginHelper.getLoginUser()` 取 `operName / userId / deptId / deptName / deviceType / browser / os`。
   - `getControllerMethodDescription` 写入 `title`、`businessType.ordinal()`、`operatorType.ordinal()`。
   - `isSaveRequestData=true` → `setRequestValue` 记请求参数；`isSaveResponseData=true && jsonResult!=null` → 记 `jsonResult`。
   - `costTime` = StopWatch 毫秒。
4. `SpringUtils.context().publishEvent(operLog)` 发布事件。
5. 监听者 `SysOperLogServiceImpl.recordOper`（`@Async @EventListener`）转 BO、`AddressUtils.getRealAddressByIP` 解析操作地点、`insertOperlog` 落 `sys_oper_log`，`operTime = LocalDateTime.now()`。

长度上限常量（写日志内容超长会被截断，排错时注意）：
- URL：255（`MAX_URL_LENGTH`）
- clientKey：32（`MAX_CLIENT_KEY_LENGTH`）
- 参数/返回/错误消息：3800（`MAX_CONTENT_LENGTH`）

---

## 5. 敏感参数脱敏（最易踩坑，重点）

日志会把请求参数序列化进 `operParam`，**如果不排除，密码、token 会明文入库**。三个开关：

### 5.1 excludeParamNames —— 按参数名排除（首选）

```java
// 重置密码：把 password / oldPassword / newPassword 排除，避免明文落库
@Log(title = "用户管理", businessType = BusinessType.UPDATE,
     excludeParamNames = {"password", "oldPassword", "newPassword"})
@PutMapping("/resetPwd")
public R<Void> resetPwd(@RequestBody SysUserBo user) { ... }
```

源码 `setRequestValue` / `argsArrayToString` 的处理逻辑：
- 切面先对参数 `excludeParamNames` + `SystemConstants.EXCLUDE_PROPERTIES`（框架内置排除项，如 servlet 对象）合并排除。
- 表单参数走 `MapUtil.removeAny(paramsMap, excludeParamNames)`。
- JSON Body 走 `JsonUtils.toJsonStringExcludeFields(arg, exclude)`，按**字段名**剔除。
- 排除是按**名字**匹配，DTO 里字段叫什么就排什么；嵌套对象同名字段也会被剔。

### 5.2 isSaveRequestData = false —— 整体不记请求参数

```java
// 文件上传：参数是二进制流，没必要也不应记录
@Log(title = "用户头像", businessType = BusinessType.UPDATE, isSaveRequestData = false)
@PostMapping("/avatar")
public R<AvatarVo> avatar(@RequestPart("avatarfile") MultipartFile file) { ... }
```

> 注：切面本身已通过 `isFilterValue` 自动过滤 `MultipartFile / HttpServletRequest / HttpServletResponse / BindingResult` 这类对象，
> 但业务字段（如 base64、超大文本）仍需手动 `isSaveRequestData=false` 或 `excludeParamNames`。

### 5.3 isSaveResponseData = false —— 不记返回结果

```java
// 返回体里含 token / 完整用户敏感信息时，关闭响应记录
@Log(title = "登录", businessType = BusinessType.OTHER, isSaveResponseData = false)
@PostMapping("/login")
public R<LoginVo> login(...) { ... }
```

口诀：**密码/旧密码/新密码/token/secret/私钥 → 一律进 `excludeParamNames`；二进制/大文本 → `isSaveRequestData=false`；含敏感返回体 → `isSaveResponseData=false`。**

---

## 6. 登录日志（sys_login_info）

登录日志是**独立链路**，不走 @Log，由认证流程主动发事件。

事件 `LoginInfoEvent`（源码 `event/LoginInfoEvent.java`）字段：`username` / `status` / `message` / `request`(HttpServletRequest) / `args`(Object[])。

发布方（真实源码 `SysLoginService.recordLoginInfo`，注册流程在 `SysRegisterService` 同样发布）：

```java
public void recordLoginInfo(String username, String status, String message) {
    LoginInfoEvent loginInfoEvent = new LoginInfoEvent();
    loginInfoEvent.setUsername(username);
    loginInfoEvent.setStatus(status);   // Constants.LOGIN_SUCCESS / LOGIN_FAIL / LOGOUT / REGISTER
    loginInfoEvent.setMessage(message);
    loginInfoEvent.setRequest(ServletUtils.getRequest());
    SpringUtils.context().publishEvent(loginInfoEvent);
}
```

消费方 `SysLoginInfoServiceImpl.recordLoginInfo`（`@Async @EventListener`）：
- 用 `UserAgentUtil.parse` 解析 OS / 浏览器，`ServletUtils.getClientIP` 取 IP，`AddressUtils` 解析归属地。
- 按 `clientKey` 反查客户端（`clientService.queryByClientId`）。
- 状态归一：`LOGIN_SUCCESS / LOGOUT / REGISTER → SUCCESS`，`LOGIN_FAIL → FAIL`。
- 落 `sys_login_info`，`loginTime = LocalDateTime.now()`。

> 自定义登录方式（如第三方/扫码登录）要让登录日志生效，**必须在认证成功/失败处调用 `recordLoginInfo`** 主动发事件，否则 `sys_login_info` 不会有记录——它不像操作日志那样靠注解自动触发。

---

## 7. 查询 / 导出操作日志

真实接口 `SysOperlogController`（`/monitor/operlog`），权限前缀 `monitor:operlog:*`：

```java
@SaCheckPermission("monitor:operlog:list")
@GetMapping("/list")
public R<PageResult<SysOperLogVo>> list(SysOperLogBo operLog, PageQuery pageQuery) {
    return R.ok(operLogService.selectPageOperLogList(operLog, pageQuery));
}

@Log(title = "操作日志", businessType = BusinessType.EXPORT)   // 导出本身也记一条 EXPORT 日志
@SaCheckPermission("monitor:operlog:export")
@PostMapping("/export")
public void export(SysOperLogBo operLog, HttpServletResponse response) {
    List<SysOperLogVo> list = operLogService.selectOperLogList(operLog);
    ExcelBuilder.of(list, SysOperLogVo.class).sheetName("操作日志").toResponse(response);
}

@Log(title = "操作日志", businessType = BusinessType.CLEAN)
@SaCheckPermission("monitor:operlog:remove")
@Lock4j
@DeleteMapping("/clean")
public R<Void> clean() {
    operLogService.cleanOperLog();
    return R.ok();
}
```

查询条件构造（`SysOperLogServiceImpl.buildQueryWrapper`，6.x 链式查询，**无 DAO 层**）：

```java
return QueryBuilder.lambda(SysOperLog.class)
    .likeIfText(SysOperLog::getOperIp, operLog.getOperIp())
    .likeIfText(SysOperLog::getTitle, operLog.getTitle())
    .eq(operLog.getBusinessType() != null && operLog.getBusinessType() > 0,
        SysOperLog::getBusinessType, operLog.getBusinessType())
    .func(f -> { if (ArrayUtil.isNotEmpty(operLog.getBusinessTypes()))
        f.in(SysOperLog::getBusinessType, Arrays.asList(operLog.getBusinessTypes())); })
    .eqIfPresent(SysOperLog::getStatus, operLog.getStatus())
    .likeIfText(SysOperLog::getOperName, operLog.getOperName())
    .betweenParams(SysOperLog::getOperTime, params, "beginTime", "endTime")
    .build();
```

登录日志查询同理在 `SysLoginInfoServiceImpl.buildQueryWrapper`，用 `loginInfoMapper.lambda()` 链式，按 `ipaddr / status / userName / loginTime` 区间过滤，接口在 `SysLoginInfoController`（`/monitor/logininfor`，权限 `monitor:logininfor:*`）。

---

## 8. 代码示例（≥5 个真实可用片段）

### 示例 1 · 标准增删改三连（来自真实 Controller 风格）

```java
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;

@Log(title = "岗位管理", businessType = BusinessType.INSERT)
@SaCheckPermission("system:post:add")
@PostMapping
public R<Void> add(@Validated @RequestBody SysPostBo post) { ... }

@Log(title = "岗位管理", businessType = BusinessType.UPDATE)
@SaCheckPermission("system:post:edit")
@PutMapping
public R<Void> edit(@Validated @RequestBody SysPostBo post) { ... }

@Log(title = "岗位管理", businessType = BusinessType.DELETE)
@SaCheckPermission("system:post:remove")
@DeleteMapping("/{postIds}")
public R<Void> remove(@PathVariable Long[] postIds) { ... }
```

### 示例 2 · 导出 / 导入（来自 SysUserController 真实代码）

```java
@Log(title = "用户管理", businessType = BusinessType.EXPORT)
@SaCheckPermission("system:user:export")
@PostMapping("/export")
public void export(SysUserBo user, HttpServletResponse response) {
    List<SysUserExportVo> list = userService.selectUserExportList(user);
    ExcelBuilder.of(list, SysUserExportVo.class).sheetName("用户数据").toResponse(response);
}

@Log(title = "用户管理", businessType = BusinessType.IMPORT)
@SaCheckPermission("system:user:import")
@PostMapping(value = "/importData", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public R<Void> importData(@RequestPart("file") MultipartFile file, boolean updateSupport) { ... }
```

### 示例 3 · 授权 GRANT（来自 SysRoleController / SysUserController 真实代码）

```java
@Log(title = "角色管理", businessType = BusinessType.GRANT)
@SaCheckPermission("system:role:edit")
@PutMapping("/authUser/cancel")
public R<Void> cancelAuthUser(@RequestBody SysUserRole userRole) { ... }
```

### 示例 4 · 强退 FORCE（来自 SysUserOnlineController 真实代码）

```java
@Log(title = "在线用户", businessType = BusinessType.FORCE)
@SaCheckPermission("monitor:online:forceLogout")
@DeleteMapping("/{tokenId}")
public R<Void> forceLogout(@PathVariable String tokenId) { ... }
```

### 示例 5 · 敏感参数脱敏（重置密码，excludeParamNames）

```java
@Log(title = "用户管理", businessType = BusinessType.UPDATE,
     excludeParamNames = {"password", "oldPassword", "newPassword"})
@SaCheckPermission("system:user:resetPwd")
@PutMapping("/resetPwd")
public R<Void> resetPwd(@Validated(EditGroup.class) @RequestBody SysUserBo user) { ... }
```

### 示例 6 · 自定义登录链路补登录日志（手动发 LoginInfoEvent）

```java
// 第三方/扫码登录成功后，主动记录登录日志（否则 sys_login_info 无记录）
LoginInfoEvent event = new LoginInfoEvent();
event.setUsername(username);
event.setStatus(Constants.LOGIN_SUCCESS);
event.setMessage(MessageUtils.message("user.login.success"));
event.setRequest(ServletUtils.getRequest());
SpringUtils.context().publishEvent(event);
```

---

## 9. 常见错误对比（≥3 组）

### 错误 1 · 用了不存在的枚举名

```java
// ❌ 本版没有 DictOperType / OperType，这是其他分支或臆造的类
@Log(title = "用户", businessType = DictOperType.ADD)

// ✅ 6.x 操作类型枚举是 BusinessType，新增是 INSERT
import org.dromara.common.log.enums.BusinessType;
@Log(title = "用户管理", businessType = BusinessType.INSERT)
```

### 错误 2 · 密码明文进日志（没排除）

```java
// ❌ 请求体含 password，默认 isSaveRequestData=true，密码会明文写进 sys_oper_log.oper_param
@Log(title = "用户管理", businessType = BusinessType.UPDATE)
@PutMapping("/resetPwd")
public R<Void> resetPwd(@RequestBody SysUserBo user) { ... }

// ✅ 用 excludeParamNames 按字段名排除敏感参数
@Log(title = "用户管理", businessType = BusinessType.UPDATE,
     excludeParamNames = {"password", "oldPassword", "newPassword"})
@PutMapping("/resetPwd")
public R<Void> resetPwd(@RequestBody SysUserBo user) { ... }
```

### 错误 3 · 把 @Log 标在 Service / 查询接口上

```java
// ❌ 标在 Service 方法上不生效——切点是 Controller 层 @annotation(controllerLog)，
//    且 list 查询标日志会让 sys_oper_log 爆量
@Log(title = "用户", businessType = BusinessType.OTHER)   // Service 里写
public List<SysUserVo> selectUserList(SysUserBo bo) { ... }

// ✅ 只在 Controller 的写接口（增删改/授权/导入导出/强退/清空）上标，查询不标
@Log(title = "用户管理", businessType = BusinessType.INSERT)
@PostMapping
public R<Void> add(@RequestBody SysUserBo user) { ... }
```

### 错误 4 · 误用旧表名 / 把事件当实体直接 insert

```java
// ❌ 旧表名 sys_logininfor 在本版不存在（已改名）；也不能跳过事件直接 new SysOperLog 入库
String sql = "select * from sys_logininfor";   // 表不存在

// ✅ 本版登录日志表是 sys_login_info（实体 SysLoginInfo @TableName("sys_login_info")），
//    操作日志靠 @Log 触发、由 @EventListener 异步落 sys_oper_log，不要手动绕过事件
```

---

## 10. 最佳实践清单

1. **写接口必标 @Log，查询接口不标**：增删改、授权、导入导出、强退、清空都要标；`list/getInfo/getOne` 不标，避免日志表暴涨。
2. **title 用业务模块名**：与菜单/业务对齐（如"用户管理""角色管理""操作日志"），便于按 title 模糊检索。
3. **businessType 选最贴近的语义值**：新增 INSERT、修改 UPDATE、删除 DELETE、授权 GRANT、导入 IMPORT、导出 EXPORT、强退 FORCE、清空 CLEAN，拿不准才用 OTHER。
4. **敏感参数三件套**：密码/旧密码/新密码/token/secret → `excludeParamNames`；二进制/超大文本 → `isSaveRequestData=false`；敏感返回体 → `isSaveResponseData=false`。
5. **BusinessType 枚举只能末尾追加**：依赖 `ordinal()` 落库，插入/重排会让历史数据错位。
6. **导出操作本身也记一条 EXPORT 日志**（见 `/export` 真实写法），符合审计闭环。
7. **自定义登录方式要手动发 `LoginInfoEvent`**：登录日志不靠注解，认证成功/失败处调用 `recordLoginInfo` 才会落 `sys_login_info`。
8. **不要在日志监听器里抛异常阻塞业务**：监听者 `@Async`，且切面已整体 try-catch；自定义增强时也要吞掉异常只记 `log.error`。
9. **长字段注意截断上限**：URL 255 / clientKey 32 / 参数·返回·错误 3800 字，超长会被 `limit()` 截断，排查"日志被截断"先看这三个常量。
10. **包路径只用 `org.dromara.common.log.*`**：禁止 `com.ruoyi` / `plus.ruoyi`；查询统一用 `QueryBuilder.lambda()` / `mapper.lambda()` 链式，本版无 DAO 层、无 `PlusLambdaQuery` / `likeCast`。

---

## 引用源文件（均已逐字核对）

- `backend/java/ruoyi-common/ruoyi-common-log/src/main/java/org/dromara/common/log/annotation/Log.java`
- `backend/java/ruoyi-common/ruoyi-common-log/src/main/java/org/dromara/common/log/aspect/LogAspect.java`
- `backend/java/ruoyi-common/ruoyi-common-log/src/main/java/org/dromara/common/log/enums/BusinessType.java`
- `backend/java/ruoyi-common/ruoyi-common-log/src/main/java/org/dromara/common/log/enums/OperatorType.java`
- `backend/java/ruoyi-common/ruoyi-common-log/src/main/java/org/dromara/common/log/enums/BusinessStatus.java`
- `backend/java/ruoyi-common/ruoyi-common-log/src/main/java/org/dromara/common/log/event/OperLogEvent.java`
- `backend/java/ruoyi-common/ruoyi-common-log/src/main/java/org/dromara/common/log/event/LoginInfoEvent.java`
- `backend/java/ruoyi-modules/ruoyi-system/.../service/impl/SysOperLogServiceImpl.java`
- `backend/java/ruoyi-modules/ruoyi-system/.../service/impl/SysLoginInfoServiceImpl.java`
- `backend/java/ruoyi-modules/ruoyi-system/.../controller/monitor/SysOperlogController.java`
- `backend/java/ruoyi-modules/ruoyi-system/.../controller/system/SysUserController.java`（@Log 真实用法）
- `backend/java/ruoyi-modules/ruoyi-system/.../domain/SysOperLog.java`（@TableName("sys_oper_log")）
- `backend/java/ruoyi-modules/ruoyi-system/.../domain/SysLoginInfo.java`（@TableName("sys_login_info")）
- `backend/java/ruoyi-admin/.../web/service/SysLoginService.java`（recordLoginInfo 发 LoginInfoEvent）
