---
name: security-guard
description: |
  本项目 安全开发规范。包含 Sa-Token 1.45.0（boot4+jwt）认证授权、字段/接口加解密、接口安全（限流/防重/XSS/SQL 注入防护）、登录 Token 会话管理。

  触发场景：
  - 给 Controller 接口加 Sa-Token 鉴权（@SaCheckLogin / @SaCheckPermission / @SaCheckRole / @SaIgnore）
  - 在代码里获取当前登录用户（LoginHelper.getUserId / getLoginUser / getDeptId）或操作会话（StpUtil）
  - 对实体字段或接口报文做加解密（@EncryptField / @ApiEncrypt）
  - 给接口配置限流（@RateLimiter）、防重复提交（@RepeatSubmit）、XSS/SQL 注入防护

  触发词：安全、Sa-Token、@SaCheckPermission、@SaCheckLogin、@SaCheckRole、登录认证、Token、LoginHelper、StpUtil、加密、@EncryptField、@ApiEncrypt、限流、@RateLimiter、防重复、@RepeatSubmit、XSS、漏洞防护、权限标识
---

# 安全开发规范（security-guard）

本技能聚焦 base-dev-framework6-java的**安全四件套**：认证授权（Sa-Token）、字段/接口加解密、接口安全（限流/防重/防注入）、登录 Token 会话管理。

> 6.x 铁律：包名一律 `org.dromara.*`。禁止出现 `plus.ruoyi` / `com.ruoyi`、禁止 DAO 层、禁止 `PlusLambdaQuery` / `likeCast`、禁止默认继承 `TenantEntity`、禁止逻辑删除字段写成 `is_deleted`。
>
> 边界划分（本技能只点到为止，详见各自技能）：
> - **行级数据权限**（部门隔离、本人数据、`@DataPermission`）属于 **data-permission** 技能。
> - **字段脱敏展示**（手机号打码、身份证打码、`@Sensitive`）属于 **data-desensitize** 技能。
> - 本技能负责的是「能不能进来（认证）/ 能不能调（授权）/ 数据落库与传输的加解密 / 接口被刷与被注入的防护」。

---

## 一、概述

| 维度 | 6.x 方案 | 所在模块 |
|------|----------|----------|
| 认证授权 | Sa-Token 1.45.0（spring-boot4 starter + jwt 简单模式） | `ruoyi-common-satoken` |
| 鉴权拦截 | `SaInterceptor` 路由拦截 + clientid/Token 一致性校验 | `ruoyi-common-security` |
| 字段加解密 | `@EncryptField`（MyBatis 拦截器在落库/读取时透明加解密） | `ruoyi-common-encrypt` |
| 接口加解密 | `@ApiEncrypt`（请求体解密 + 响应体加密，AES+RSA 混合） | `ruoyi-common-encrypt` |
| 限流 | `@RateLimiter`（Redisson 令牌） | `ruoyi-common-redis` |
| 防重复提交 | `@RepeatSubmit`（Redis 幂等锁） | `ruoyi-common-redis` |
| XSS / SQL 注入 | `@Xss` 校验注解 + 全局 XSS 过滤 + MyBatis-Plus 参数化 | `ruoyi-common-core` / `ruoyi-common-web` |

加密底座为 **BouncyCastle 1.84**，国密 SM2/SM4 与 RSA/AES 均由其提供算法实现。

---

## 二、认证授权（Sa-Token）

### 2.1 注解清单

所有鉴权注解来自 `cn.dev33.satoken.annotation.*`，加在 Controller 方法（或类）上。鉴权由 `SaInterceptor` 在拦截器层统一处理（见 `SecurityConfig.addInterceptors`）。

| 注解 | 作用 | 关键参数 |
|------|------|----------|
| `@SaCheckLogin` | 只校验登录态 | `type`（指定登录类型，多端场景） |
| `@SaCheckPermission` | 校验菜单权限标识 | `value`、`mode`、`orRole` |
| `@SaCheckRole` | 校验角色标识 | `value`、`mode` |
| `@SaIgnore` | 忽略本方法/类的所有鉴权（优先级最高） | — |

> `mode = SaMode.AND`（默认）要求**同时满足**所有项；`mode = SaMode.OR` 满足**任一**即可。

### 2.2 权限来源

`SaPermissionImpl implements StpInterface` 是权限数据源：

- `getPermissionList()` → 返回当前登录用户的**菜单权限**（`LoginUser.getMenuPermission()`），供 `@SaCheckPermission` 比对。
- `getRoleList()` → 返回**角色标识**（`LoginUser.getRolePermission()`），供 `@SaCheckRole` 比对。
- 本地拿不到登录用户时，回退到远程 `PermissionService`（微服务/分库场景）。

### 2.3 LoginHelper —— 在业务代码里取当前登录信息

`org.dromara.common.satoken.utils.LoginHelper` 是封装好的静态助手，**优先用它，不要直接拼 `StpUtil.getExtra` 字符串 key**：

| 方法 | 返回 | 说明 |
|------|------|------|
| `LoginHelper.getUserId()` | `Long` | 当前用户 ID（从 Token extra 取） |
| `LoginHelper.getUserIdStr()` | `String` | 用户 ID 字符串 |
| `LoginHelper.getUsername()` | `String` | 用户名 |
| `LoginHelper.getDeptId()` | `Long` | 部门 ID |
| `LoginHelper.getDeptName()` | `String` | 部门名称 |
| `LoginHelper.getDeptCategory()` | `String` | 部门类别编码 |
| `LoginHelper.getLoginUser()` | `LoginUser` | 完整登录用户对象（含权限集合），未登录返回 `null` |
| `LoginHelper.getUserType()` | `UserType` | 用户类型（pc / app 等） |
| `LoginHelper.isSuperAdmin()` | `boolean` | 是否超级管理员 |
| `LoginHelper.isLogin()` | `boolean` | 是否已登录 |

> `LoginHelper.login(loginUser, model)` 用于登录建会话，登录态写入 `StpUtil` 的 extra（userId/userName/deptId 等）与 TokenSession（完整 LoginUser）。登录场景一般由系统登录接口处理，业务侧极少手写。

### 2.4 StpUtil —— Sa-Token 原生入口

需要底层能力（注销、踢人下线、查 Token 超时、临时权限等）时用 `cn.dev33.satoken.stp.StpUtil`：

- `StpUtil.isLogin()` / `StpUtil.checkLogin()`：判断/强制登录态。
- `StpUtil.getLoginIdAsString()`：取登录 ID（格式为 `userType:userId`）。
- `StpUtil.logout()`：当前会话注销。
- `StpUtil.getTokenValue()` / `StpUtil.getTokenTimeout()`：取 Token 值 / 剩余有效期。
- `StpUtil.getExtra(key)`：读 Token 扩展字段（`LoginHelper` 内部即基于它，业务侧优先用 `LoginHelper`）。

### 2.5 拦截器统一校验

`SecurityConfig`（`ruoyi-common-security`）通过 `SaInterceptor` 做全局拦截，除登录态外还做了 6.x 特有的两层校验：

1. **clientid 一致性**：请求头/参数里的 `clientid` 必须与 Token extra 里的一致，否则抛 `NotLoginException`（防 Token 跨客户端盗用）。
2. **客户端访问规则**：按 Token 携带的 `clientAccessPath`（接口白名单）与 `clientIpWhitelist`（IP 白名单）做 `NotPermissionException` 拦截。

放行路径由 `SecurityProperties.getExcludes()` 配置（如登录、验证码、静态资源），写在 `application.yml` 的 `security.excludes`。

---

## 三、权限标识规范

权限标识统一格式：**`${module}:${business}:${action}`**（三段，冒号分隔，全小写）。

| 段 | 含义 | 示例 |
|----|------|------|
| `module` | 模块/领域 | `system`、`workflow`、`demo` |
| `business` | 业务对象 | `user`、`dict`、`menu` |
| `action` | 操作动作 | `list`、`query`、`add`、`edit`、`remove`、`export`、`import` |

约定动作命名（与 框架菜单数据一致）：

| 动作 | 标识 action | HTTP |
|------|-------------|------|
| 列表/分页 | `list` | GET `/list` |
| 详情 | `query` | GET `/{id}` |
| 新增 | `add` | POST |
| 修改 | `edit` | PUT |
| 删除 | `remove` | DELETE `/{ids}` |
| 导出 | `export` | POST `/export` |
| 导入 | `import` | POST `/importData` |

支持**通配符前缀**：`system:user:*` 命中所有 `system:user:` 开头的权限；`@SaCheckPermission("system:user:*")` 即可一次放行整个用户模块。

> 角色标识（`@SaCheckRole`）走另一套命名（如 `admin`、`superadmin`），不要和权限标识混用。超级管理员角色 key 用 `SystemConstants.SUPER_ADMIN_ROLE_KEY` 常量，不要硬编码字符串。

---

## 四、加解密

### 4.1 字段加解密 @EncryptField（落库透明加解密）

`org.dromara.common.encrypt.annotation.@EncryptField` 加在**实体字段**上，由 MyBatis 拦截器（`MybatisEncryptInterceptor` 写入、`MybatisDecryptInterceptor` 读取）在持久层透明完成加解密——数据库里存密文，Java 对象里始终是明文。

支持算法（`AlgorithmType` 枚举）：

| 算法 | 需要参数 | 说明 |
|------|----------|------|
| `DEFAULT` | 无 | 走 `application.yml` 的 `mybatis-encryptor` 全局配置 |
| `BASE64` | 无 | 仅编码（非加密，不可用于敏感数据） |
| `AES` | `password` | 对称，密钥 16 位 |
| `SM4` | `password` | 国密对称，密钥 16 位 |
| `RSA` | `publicKey` / `privateKey` | 非对称 |
| `SM2` | `publicKey` / `privateKey` | 国密非对称 |

`encode` 指定密文编码方式（HEX / BASE64），对 `BASE64` 算法不生效。

### 4.2 接口加解密 @ApiEncrypt（报文级加解密）

`@ApiEncrypt` 加在 **Controller 方法**上，由 `CryptoFilter` 过滤器处理：

- **请求解密**：前端用后端 RSA 公钥加密 AES 随机密钥（放请求头），用该 AES 密钥加密请求体；后端 `DecryptRequestBodyWrapper` 解出 AES 密钥再解请求体。
- **响应加密**：`@ApiEncrypt(response = true)` 时，`EncryptResponseBodyWrapper` 对响应体加密返回。默认 `response = false`（只解请求不加响应）。

典型用于**修改密码、登录**等敏感报文。开关与密钥配置在 `api-decrypt`（`ApiDecryptProperties`）。

> 区分：`@EncryptField` 解决「数据库里别存明文」，`@ApiEncrypt` 解决「网络传输别走明文」，两者正交，可同时用。

---

## 五、接口安全

### 5.1 限流 @RateLimiter

`org.dromara.common.redis.annotation.@RateLimiter`（Redisson 实现），加在方法上：

| 参数 | 默认 | 说明 |
|------|------|------|
| `time` | 60 | 限流窗口（秒） |
| `count` | 100 | 窗口内最大次数 |
| `key` | `""` | 支持 SpEL，如 `#code`、`#user.id`，按参数维度限流 |
| `limitType` | `DEFAULT` | `DEFAULT`(全局) / `IP`(按来源IP) / `CLUSTER`(集群实例) |
| `message` | `{rate.limiter.message}` | 国际化提示 code |

### 5.2 防重复提交 @RepeatSubmit

`org.dromara.common.redis.annotation.@RepeatSubmit`，基于 Redis 幂等锁，在 `interval` 内（默认 5000ms）相同请求被判为重复提交并拦截。**新增/修改类写操作建议都加**：

| 参数 | 默认 | 说明 |
|------|------|------|
| `interval` | 5000 | 间隔（毫秒），此间隔内重复视为重提 |
| `timeUnit` | `MILLISECONDS` | 时间单位 |
| `message` | `{repeat.submit.message}` | 国际化提示 code |

### 5.3 XSS / SQL 注入防护

- **XSS 字段校验**：`org.dromara.common.core.xss.@Xss` 加在 BO/参数字段上，由 `XssValidator` 校验，命中脚本则抛校验异常（默认提示「不允许任何脚本运行」），配合 `@Validated` 生效。
- **全局 XSS 过滤**：框架在 `ruoyi-common-web` 注册全局 XSS 过滤器，对请求参数做 HTML 转义（可在 `xss` 配置里设置 `excludes` / `urlPatterns`）。
- **SQL 注入**：统一用 MyBatis-Plus 的 `LambdaQueryWrapper` / `Wrappers` 参数化查询，**严禁字符串拼接 SQL**；排序字段等必须用白名单校验，杜绝 `${}` 直接拼接外部入参。

---

## 六、代码示例

### 示例 1：标准 CRUD Controller 鉴权（权限标识 + 防重 + 日志）

```java
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/system/dict/data")
public class SysDictDataController extends BaseController {

    private final ISysDictDataService dictDataService;

    // 列表：仅需 list 权限
    @SaCheckPermission("system:dict:list")
    @GetMapping("/list")
    public R<PageResult<SysDictDataVo>> list(SysDictDataBo bo, PageQuery pageQuery) {
        return R.ok(dictDataService.selectPageDictDataList(bo, pageQuery));
    }

    // 新增：权限 + 操作日志 + 防重复提交
    @SaCheckPermission("system:dict:add")
    @Log(title = "字典数据", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping
    public R<Void> add(@Validated @RequestBody SysDictDataBo bo) {
        dictDataService.insertDictData(bo);
        return R.ok();
    }

    // 删除：DELETE + 路径变量
    @SaCheckPermission("system:dict:remove")
    @Log(title = "字典数据", businessType = BusinessType.DELETE)
    @DeleteMapping("/{dictCodes}")
    public R<Void> remove(@PathVariable Long[] dictCodes) {
        dictDataService.deleteDictDataByIds(Arrays.asList(dictCodes));
        return R.ok();
    }
}
```

### 示例 2：角色校验与 AND/OR 组合

```java
// 仅登录即可
@SaCheckLogin
@GetMapping("/basic/loginOnly")
public R<Void> loginOnly() { return R.ok(); }

// 同时拥有 admin 与 operator 角色（AND）
@SaCheckRole(value = {"admin", "operator"}, mode = SaMode.AND)
@GetMapping("/advance/multiRoleAnd")
public R<Void> multiRoleAnd() { return R.ok(); }

// 多权限任一即可（OR）
@SaCheckPermission(value = {"system:user:add", "system:user:delete"}, mode = SaMode.OR)
@GetMapping("/advance/multiPermOr")
public R<Void> multiPermOr() { return R.ok(); }

// 权限不足时用角色兜底：无 export 权限则看是否有 admin/operator 角色
@SaCheckPermission(value = "system:user:export", orRole = {"admin", "operator"})
@GetMapping("/permWithOrRole")
public R<Void> permWithOrRole() { return R.ok(); }

// 完全放行（优先级最高，覆盖类级注解）
@SaIgnore
@GetMapping("/open")
public R<Void> open() { return R.ok(); }
```

### 示例 3：业务代码获取当前登录用户（LoginHelper）

```java
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements IOrderService {

    @Override
    public void createOrder(OrderBo bo) {
        // 优先用 LoginHelper，不要手写 StpUtil.getExtra("userId")
        Long userId = LoginHelper.getUserId();
        Long deptId = LoginHelper.getDeptId();

        LoginUser loginUser = LoginHelper.getLoginUser();
        if (loginUser == null) {
            throw new ServiceException("登录态已失效，请重新登录");
        }
        // 超管放行特殊逻辑
        if (LoginHelper.isSuperAdmin()) {
            // ...
        }
        bo.setCreateBy(userId);
        bo.setCreateDept(deptId);
        // ...
    }
}
```

### 示例 4：字段加密实体 @EncryptField

```java
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("test_demo")
public class TestDemoEncrypt extends TestDemo {

    // RSA 非对称：库里存密文，对象里读到明文
    @EncryptField(algorithm = AlgorithmType.RSA,
        publicKey = "MIGfMA0GCSq...AQAB",
        privateKey = "MIICdQIBADAN...")
    private String testKey;

    // AES 对称：仅需 16 位 password
    @EncryptField(algorithm = AlgorithmType.AES, password = "10rfylhtccpuyke5")
    private String value;

    // @EncryptField                              // 什么都不写 → 走 yml 默认配置
    // @EncryptField(algorithm = AlgorithmType.SM4, password = "10rfylhtccpuyke5")  // 国密 SM4
}
```

### 示例 5：接口加解密 @ApiEncrypt（修改密码）

```java
@RestController
@RequestMapping("/system/user/profile")
public class SysProfileController extends BaseController {

    // 请求体（旧密码/新密码）由前端用 AES+RSA 混合加密，后端 CryptoFilter 自动解密
    @ApiEncrypt
    @PutMapping("/updatePwd")
    public R<Void> updatePwd(@Validated @RequestBody SysUserPasswordBo bo) {
        // 进到方法时 bo 已是明文
        // ... 校验旧密码、更新新密码
        return R.ok();
    }
}
```

### 示例 6：限流 + XSS 字段校验

```java
// 按 IP 限流：10 秒内最多 2 次
@RateLimiter(count = 2, time = 10, limitType = LimitType.IP)
@PostMapping("/sendCode")
public R<Void> sendCode(@RequestParam String phone) { return R.ok(); }

// 按参数维度限流（SpEL 取 key）
@RateLimiter(count = 2, time = 10, limitType = LimitType.IP, key = "#value")
@GetMapping("/ratelimiter")
public R<String> ratelimiter(String value) { return R.ok(value); }

// BO 字段加 XSS 校验（配合 @Validated）
public class ArticleBo {
    @Xss(message = "标题不允许任何脚本")
    @NotBlank(message = "标题不能为空")
    private String title;
}
```

---

## 七、常见错误对比

### 错误 1：包名/工具类用了旧框架前缀

```java
// ❌ 错误：6.x 不存在这些包
import com.ruoyi.common.utils.SecurityUtils;
Long userId = SecurityUtils.getUserId();

// ✅ 正确：6.x 用 org.dromara + LoginHelper
import org.dromara.common.satoken.utils.LoginHelper;
Long userId = LoginHelper.getUserId();
```

### 错误 2：手写 Token extra 字符串 key 取登录信息

```java
// ❌ 错误：硬编码 key，易写错且不可维护
Long deptId = Convert.toLong(StpUtil.getExtra("deptId"));

// ✅ 正确：用封装好的 LoginHelper
Long deptId = LoginHelper.getDeptId();
```

### 错误 3：权限标识三段格式写错

```java
// ❌ 错误：少段 / 用了点分 / 大写
@SaCheckPermission("user:list")          // 缺 module 段
@SaCheckPermission("system.dict.list")   // 应为冒号分隔
@SaCheckPermission("System:Dict:List")   // 应全小写

// ✅ 正确：module:business:action 三段、冒号、小写
@SaCheckPermission("system:dict:list")
```

### 错误 4：写操作不加防重，或在 BO 上做加解密

```java
// ❌ 错误：新增接口无防重，用户连点产生重复数据
@SaCheckPermission("system:dict:add")
@PostMapping
public R<Void> add(@Validated @RequestBody SysDictDataBo bo) { ... }

// ✅ 正确：补 @RepeatSubmit
@SaCheckPermission("system:dict:add")
@RepeatSubmit()
@PostMapping
public R<Void> add(@Validated @RequestBody SysDictDataBo bo) { ... }
```

> `@EncryptField` 只能加在 **Entity 字段**（持久层拦截），加在 VO/BO 上不会触发落库加解密。

---

## 八、最佳实践

1. **每个写接口三件套**：`@SaCheckPermission`（授权）+ `@Log`（审计日志）+ `@RepeatSubmit`（防重）。查询接口至少有 `@SaCheckPermission`。
2. **权限标识严格三段**：`module:business:action`，与菜单表 `perms` 字段保持一致；新增模块前先确认菜单数据已配好对应 perms。
3. **取登录信息一律走 LoginHelper**：`getUserId/getDeptId/getLoginUser`，不直接拼 `StpUtil.getExtra` 字符串 key；判断超管用 `LoginHelper.isSuperAdmin()`。
4. **敏感数据双管齐下**：库里存密文用 `@EncryptField`（手机号、银行卡、密钥等），网络传输敏感报文用 `@ApiEncrypt`（登录、改密）。国密优先选 `SM2/SM4`。
5. **加密密钥不硬编码到代码**：生产环境密钥走 `application.yml` 的 `mybatis-encryptor`/`api-decrypt` 配置 + 环境变量占位符（`${...}`），不要把私钥提交进仓库。
6. **限流分场景选 limitType**：短信/验证码等用 `IP`（防单 IP 刷），全局资源用 `DEFAULT`，集群均摊用 `CLUSTER`；按用户维度限流用 `key` + SpEL。
7. **SQL 注入零容忍**：全程参数化（`LambdaQueryWrapper` / `#{}`），排序、动态列名等外部入参用白名单校验，禁止 `${}` 直接拼接。
8. **开放接口显式 @SaIgnore**：确需匿名访问的接口（回调、健康检查）显式标注并在 `security.excludes` 登记，不要靠"忘了加鉴权"形成隐式开放。
9. **区分技能边界**：行级数据隔离去 **data-permission**（`@DataPermission`），字段脱敏展示去 **data-desensitize**（`@Sensitive`）；本技能不重复造轮子。
10. **前端权限只泛述**：前端按钮级权限由前端权限指令/Hook 控制（与后端 `perms` 对齐），具体前端实现见前端相关技能，本技能不约束前端定制指令写法。

---

> 关联源码：
> - `backend/java/ruoyi-common/ruoyi-common-satoken/`：`LoginHelper`、`SaPermissionImpl`、`SaTokenConfig`、`SaTokenExceptionHandler`
> - `backend/java/ruoyi-common/ruoyi-common-security/`：`SecurityConfig`、`SecurityProperties`、`AllUrlHandler`
> - `backend/java/ruoyi-common/ruoyi-common-encrypt/`：`@EncryptField`、`@ApiEncrypt`、`AlgorithmType`、`CryptoFilter`、`Mybatis*Interceptor`
> - `backend/java/ruoyi-common/ruoyi-common-redis/`：`@RateLimiter`、`@RepeatSubmit`、`LimitType`
> - `backend/java/ruoyi-common/ruoyi-common-core/xss/`：`@Xss`、`XssValidator`
> - 真实用法参考：`backend/java/ruoyi-modules/ruoyi-system` 各 Controller、`backend/java/ruoyi-modules/ruoyi-demo/SaTokenTestController` / `TestDemoEncrypt` / `RedisRateLimiterController`
