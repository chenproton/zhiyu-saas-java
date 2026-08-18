---
name: data-desensitize
description: |
  数据脱敏开发指南（base-dev-framework6-java）。基于 Jackson 的"序列化期 PII 掩码"——给 VO 字段加 @Sensitive(strategy=...)，对象返回前端时按策略把手机号/身份证/银行卡等敏感字段打码。这是 PII 脱敏（DB 里仍是明文），不是敏感词过滤、不改库、不加解密。配合权限感知按角色放行明文。

  触发场景：
  - 给返回前端的 VO 字段做脱敏（手机号、身份证、银行卡、邮箱、地址、姓名等）
  - 选择/扩展脱敏策略，或对 Token/私钥用高安全脱敏、自定义可见长度
  - 让管理员/特定角色看明文、普通用户看掩码（权限感知放行）
  - 排查"脱敏不生效""字段被打码但 DB 也想看明文""非 String 字段脱敏无效"

  触发词：脱敏、数据脱敏、@Sensitive、SensitiveStrategy、敏感数据、PII、掩码、手机号脱敏、身份证脱敏、银行卡脱敏、MASK_HIGH_SECURITY、STRING_MASK、DesensitizedUtils、data-desensitize
---

# 数据脱敏（base-dev-framework6-java）

## 一、概述

本技能讲的是 **序列化期 PII（个人可识别信息）脱敏**：在对象被 Jackson 序列化成 JSON 返回前端的那一刻，按字段上的 `@Sensitive` 注解把敏感内容（手机号、身份证、银行卡号、邮箱、地址、姓名、Token、私钥等）替换为掩码（如 `138****8888`）。

**必须先分清三件事（最常被混淆）：**

| 概念 | 是不是本技能 | 说明 |
|------|------------|------|
| PII 脱敏（@Sensitive） | ✅ 是 | 输出时掩码，**DB 里仍是明文**，只为了不把完整敏感信息暴露给前端/日志 |
| 敏感词过滤 | ❌ 不是 | 那是过滤违禁词/脏话，与本技能完全无关，不要混为一谈 |
| 字段加解密（@EncryptField） | ❌ 不是 | 那是落库前加密、读出后解密，DB 里是密文；脱敏不改库、不可逆地遮挡显示 |

**关键特征：**
- **注解驱动 + 序列化期生效**：不改 Service/DAO 逻辑，只在 VO 字段加注解，返回时自动掩码。
- **只作用于 String 字段**：非 String 类型（Long、List 等）不会被脱敏（见源码 `value instanceof String text` 判断）。
- **权限感知**：通过 `SensitiveService` 决定当前用户是否需要脱敏——管理员/授权角色可看明文。
- **不可逆**：掩码是单向遮挡，前端拿到的就是 `***`，不存在"再解码出原文"。

> **模块位置**：`backend/java/ruoyi-common/ruoyi-common-sensitive/`（脱敏核心）依赖 `ruoyi-common-core` 的 `DesensitizedUtils`。
> **包名基线**：原版包名 `org.dromara.common.sensitive.*` / `org.dromara.common.core.utils.*`。**禁止**写成 `plus.ruoyi.*` / `com.ruoyi.*`。

### 真实源码引用（本技能完全基于以下文件，未凭空编造）

| 文件 | 作用 |
|------|------|
| `backend/java/ruoyi-common/ruoyi-common-sensitive/.../annotation/Sensitive.java` | `@Sensitive` 注解：`strategy()` + `roleKey()` + `perms()` |
| `backend/java/ruoyi-common/ruoyi-common-sensitive/.../core/SensitiveStrategy.java` | 脱敏策略枚举（17 种，含 6.x 新增 4 种） |
| `backend/java/ruoyi-common/ruoyi-common-sensitive/.../core/SensitiveService.java` | 权限感知接口 `isSensitive(roleKey, perms)`，默认管理员不过滤 |
| `backend/java/ruoyi-common/ruoyi-common-sensitive/.../handler/SensitiveJsonFieldProcessor.java` | 序列化期处理器，判断注解 + 调权限服务 + 执行掩码 |
| `backend/java/ruoyi-common/ruoyi-common-sensitive/.../config/SensitiveConfig.java` | `@AutoConfiguration` 自动注册处理器 Bean |
| `backend/java/ruoyi-common/ruoyi-common-core/.../utils/DesensitizedUtils.java` | `mask()` / `maskHighSecurity()`，供 STRING_MASK / MASK_HIGH_SECURITY 调用 |

---

## 二、脱敏策略枚举表（SensitiveStrategy，全部 17 种）

下表逐项核对自 `SensitiveStrategy.java` 源码。前 13 种基于 Hutool `DesensitizedUtil`，后 4 种是 **6.x 新增/自有实现**。

| 策略枚举 | 用途 | 底层实现（源码） | 输入示例 → 输出示例 |
|---------|------|-----------------|---------------------|
| `ID_CARD` | 身份证 | `DesensitizedUtil.idCardNum(s, 3, 4)` | `110101199003071234` → `110***********1234` |
| `PHONE` | 手机号 | `DesensitizedUtil::mobilePhone` | `13812348888` → `138****8888` |
| `ADDRESS` | 地址 | `DesensitizedUtil.address(s, 8)` | `北京市朝阳区xx路1号` → 保留前段，尾部 8 字掩码 |
| `EMAIL` | 邮箱 | `DesensitizedUtil::email` | `duandazhi@gmail.com` → `d********@gmail.com` |
| `BANK_CARD` | 银行卡 | `DesensitizedUtil::bankCard` | `6217000130008255666` → `6217 **** **** *566 6`（分组掩码） |
| `CHINESE_NAME` | 中文名 | `DesensitizedUtil::chineseName` | `张三丰` → `张**` |
| `FIXED_PHONE` | 固定电话 | `DesensitizedUtil::fixedPhone` | `01086551122` → `0108*****22` |
| `USER_ID` | 用户 ID | `Convert.toStr(DesensitizedUtil.userId())` | 任意 → `0`（固定脱敏值，整段隐去） |
| `PASSWORD` | 密码 | `DesensitizedUtil::password` | `1234567890` → `**********`（全掩码） |
| `IPV4` | IPv4 | `DesensitizedUtil::ipv4` | `192.0.2.1` → `192.*.*.*` |
| `IPV6` | IPv6 | `DesensitizedUtil::ipv6` | `2001:0db8:...` → `2001:*:*:*:*:*:*:*` |
| `CAR_LICENSE` | 车牌（含新能源） | `DesensitizedUtil::carLicense` | `苏D40000` → `苏D4***0` |
| `FIRST_MASK` | 只显示第一个字符 | `DesensitizedUtil::firstMask` | `123456` → `1*****` |
| **`STRING_MASK`** 🆕 | **通用字符串脱敏（可配前后可见 + 中间长度）** | `DesensitizedUtils.mask(s, 4, 4, 4)` | `123456789012` → `1234****9012`（前 4 可见 + 4 个 * + 后 4 可见） |
| **`MASK_HIGH_SECURITY`** 🆕 | **高安全（Token/私钥）：前 2 后 2，中间全掩** | `DesensitizedUtils.maskHighSecurity(s, 2, 2)` | `sk-1a2b3c4d5e` → `sk******5e` |
| **`CLEAR`** 🆕 | **清空为 `""`** | `DesensitizedUtil.clear()` | 任意 → `""`（空字符串） |
| **`CLEAR_TO_NULL`** 🆕 | **清空为 `null`** | `DesensitizedUtil.clearToNull()` | 任意 → `null`（字段直接消失/为 null） |

> 🆕 = 6.x 新增。`STRING_MASK` / `MASK_HIGH_SECURITY` 由 `org.dromara.common.core.utils.DesensitizedUtils`（继承 Hutool `DesensitizedUtil`）实现；`CLEAR` / `CLEAR_TO_NULL` 用于"宁可不显示也不要泄露"的场景。

### STRING_MASK / MASK_HIGH_SECURITY 的精确规则（核对 DesensitizedUtils 源码）

`mask(value, prefixVisible, suffixVisible, maskLength)` —— 默认 `(4,4,4)`：
- 长度 ≤ `maskLength` → **全掩码**（`****`）；
- 长度 ≤ `prefixVisible + maskLength` → 前段保留，尾部用固定长度掩码；
- 长度 ≤ `prefixVisible + maskLength + suffixVisible` → 前缀 + 中间掩码 + 剩余后缀；
- 标准形态 → `前 prefixVisible 位` + `maskLength 个 *` + `后 suffixVisible 位`。

`maskHighSecurity(value, prefixVisible, suffixVisible)` —— 默认 `(2,2)`：
- 长度 ≤ `prefixVisible` → 全掩码；
- 长度 ≤ `prefixVisible + suffixVisible` → 优先掩码后面；
- 标准形态 → `前 2 位` + `(len-2-2) 个 *` + `后 2 位`。**中间长度不固定，随原文长度变化**，因此 Token/私钥更难被反推位数。

---

## 三、序列化期生效机制（为什么"加个注解就掩码"）

链路（核对 `SensitiveJsonFieldProcessor` + `SensitiveConfig`）：

```
Controller 返回 R<XxxVo>
        ↓ Jackson 序列化每个字段
SensitiveJsonFieldProcessor.supports()  ← 字段上有 @Sensitive 吗？
        ↓ 有
SensitiveJsonFieldProcessor.process()
   ├─ value 是 String 吗？不是 → 原样返回（不脱敏）
   ├─ sensitiveService.isSensitive(roleKey, perms) == true ?
   │     ├─ true  → strategy().desensitizer().apply(text)  → 输出掩码
   │     └─ false → 返回原文（放行明文）
   └─ 写入 JSON
```

关键事实：
- 处理器实现 `JsonFieldProcessor`（`@Order(100)`），由 `SensitiveConfig` 的 `@AutoConfiguration` 自动注册，**业务侧零配置**。
- `@Sensitive` 是 `@Target(FIELD)`、`RUNTIME` 保留，**只能加在字段上**（不能加在方法/类）。
- **只处理 String**：源码里 `!(value instanceof String text)` 直接返回原值，所以 Long 型手机号、List 等不会脱敏（见"常见错误"）。
- `SensitiveService` 用 `@Autowired(required = false)` 注入——**未注入时（service 为 null）不脱敏，原样输出**。生产环境必须自行实现该接口（见第六节）。

---

## 四、用法：在 VO 字段加注解（代码示例 ≥5）

脱敏注解一律加在 **返回前端的 VO** 的 String 字段上，不要加在 Entity / BO。

### 示例 1：最常见——手机号 + 身份证 + 邮箱

```java
package org.dromara.system.domain.vo;

import org.dromara.common.sensitive.annotation.Sensitive;
import org.dromara.common.sensitive.core.SensitiveStrategy;
import lombok.Data;

@Data
public class SysUserVo {

    private Long userId;

    private String userName;

    /** 手机号：输出 138****8888 */
    @Sensitive(strategy = SensitiveStrategy.PHONE)
    private String phonenumber;

    /** 身份证：输出 110***********1234 */
    @Sensitive(strategy = SensitiveStrategy.ID_CARD)
    private String idCard;

    /** 邮箱：输出 d********@gmail.com */
    @Sensitive(strategy = SensitiveStrategy.EMAIL)
    private String email;
}
```

### 示例 2：银行卡 + 中文姓名 + 地址

```java
@Data
public class CustomerVo {

    /** 中文名：张** */
    @Sensitive(strategy = SensitiveStrategy.CHINESE_NAME)
    private String realName;

    /** 银行卡：分组掩码 */
    @Sensitive(strategy = SensitiveStrategy.BANK_CARD)
    private String bankCardNo;

    /** 地址：尾部 8 字掩码 */
    @Sensitive(strategy = SensitiveStrategy.ADDRESS)
    private String address;
}
```

### 示例 3：Token / 私钥用高安全脱敏（6.x 新增 MASK_HIGH_SECURITY）

```java
@Data
public class AppCredentialVo {

    /** API Token：sk******5e（前 2 后 2，中间随长度全掩） */
    @Sensitive(strategy = SensitiveStrategy.MASK_HIGH_SECURITY)
    private String apiToken;

    /** 私钥同理，绝不可整段回显 */
    @Sensitive(strategy = SensitiveStrategy.MASK_HIGH_SECURITY)
    private String privateKey;
}
```

> Token/私钥**不要**用 `PHONE`/`STRING_MASK`（固定可见位数易被推断），统一用 `MASK_HIGH_SECURITY`。

### 示例 4：自定义可见长度——STRING_MASK（6.x 新增）

```java
@Data
public class OrderVo {

    /**
     * 订单号默认 STRING_MASK = mask(s,4,4,4)：前 4 + 4个* + 后 4。
     * 想换成"前 6 后 2"等其它可见长度 → 见第五节"自定义策略"，
     * 不要在字段上传参（注解只认 strategy，无法传可见长度）。
     */
    @Sensitive(strategy = SensitiveStrategy.STRING_MASK)
    private String orderNo;
}
```

### 示例 5：CLEAR / CLEAR_TO_NULL——"宁可不显示也不泄露"

```java
@Data
public class SecretVo {

    /** 普通用户连掩码都不给，直接清空为 "" */
    @Sensitive(strategy = SensitiveStrategy.CLEAR)
    private String internalRemark;

    /** 直接置 null（前端字段为 null / 配合 NON_NULL 时字段消失） */
    @Sensitive(strategy = SensitiveStrategy.CLEAR_TO_NULL)
    private String secretToken;
}
```

### 示例 6：权限感知——授权角色看明文（roleKey / perms）

```java
@Data
public class SysUserVo {

    /**
     * 仅当 SensitiveService.isSensitive 判定"需要脱敏"时才打码；
     * roleKey/perms 由你自定义的 SensitiveService 实现来解读
     * （原版接口只声明 isSensitive，角色放行逻辑需自行实现）。
     */
    @Sensitive(strategy = SensitiveStrategy.PHONE, roleKey = {"admin"}, perms = {"system:user:viewPhone"})
    private String phonenumber;
}
```

> 注意：`roleKey` / `perms` 是注解里声明的"放行条件元数据"，**真正决定是否脱敏的是 `SensitiveService.isSensitive(roleKey, perms)` 的实现**，原版接口不含默认放行逻辑，必须自己实现（见下节）。

---

## 五、权限感知：让管理员/特定角色看明文

`SensitiveService` 源码极简（按业务自行重写）：

```java
package org.dromara.common.sensitive.core;

public interface SensitiveService {
    /** 返回 true 表示需要脱敏；false 表示放行明文 */
    boolean isSensitive(String[] roleKey, String[] perms);
}
```

注释明确写着"**默认管理员不过滤，需自行根据业务重写实现**"。处理器侧逻辑：`service != null && isSensitive(...) == true` 才打码。

业务侧实现（放在主应用，如 `ruoyi-admin` / `ruoyi-system` 可见的配置类中）：

```java
package org.dromara.web.service.impl; // 示例包，置于主应用模块

import org.dromara.common.core.utils.StreamUtils;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.common.sensitive.core.SensitiveService;
import org.springframework.stereotype.Service;

import java.util.Arrays;

@Service
public class SensitiveServiceImpl implements SensitiveService {

    @Override
    public boolean isSensitive(String[] roleKey, String[] perms) {
        // 超管不脱敏，直接放行明文
        if (LoginHelper.isSuperAdmin()) {
            return false;
        }
        boolean roleHit = roleKey.length > 0
            && Arrays.stream(roleKey).anyMatch(LoginHelper.getLoginUser().getRolePermission()::contains);
        boolean permHit = perms.length > 0
            && Arrays.stream(perms).anyMatch(LoginHelper.getLoginUser().getMenuPermission()::contains);
        // 命中放行角色/权限 → 不脱敏；否则脱敏
        return !(roleHit || permHit);
    }
}
```

> 上例仅示意（`LoginHelper` API 以你项目实际为准）。要点：**注入即生效**——一旦 Spring 容器里有 `SensitiveService` Bean，处理器就开始按它的判定脱敏；没有 Bean 时全部原样输出（开发期可借此关闭脱敏）。

---

## 六、自定义策略（追加枚举 / 调整可见长度）

注解只能传 `strategy`，**无法在字段上传可见长度参数**。要"前 6 后 2"这种自定义掩码，正确做法是在 `SensitiveStrategy` 枚举里追加一项（源码末尾有注释 `//可自行添加其他脱敏策略`）：

```java
// 在 SensitiveStrategy 枚举中追加（org.dromara.common.sensitive.core.SensitiveStrategy）

/** 订单号专用：前 6 可见 + 2 个 * + 后 2 可见 */
ORDER_NO(s -> DesensitizedUtils.mask(s, 6, 2, 2)),

/** 邮箱前缀更长保留：自定义 */
EMAIL_KEEP4(s -> DesensitizedUtils.mask(s, 4, 0, 4)),

/** 高安全自定义：前 4 后 4（默认 MASK_HIGH_SECURITY 是 2,2） */
TOKEN_KEEP4(s -> DesensitizedUtils.maskHighSecurity(s, 4, 4));
```

然后字段上引用新枚举：`@Sensitive(strategy = SensitiveStrategy.ORDER_NO)`。

要点：
- Token/私钥的自定义可见长度 → 用 `DesensitizedUtils.maskHighSecurity(s, p, suf)`；
- 普通字段自定义前后可见 + 中间固定掩码长度 → 用 `DesensitizedUtils.mask(s, p, suf, maskLen)`；
- 脱敏函数签名固定为 `Function<String,String>`，入参出参都是 `String`。

---

## 七、常见错误对比（≥3，全部踩坑实录）

### ❌ 错误 1：把脱敏当成敏感词过滤 / 当成加密

```java
// ❌ 误解：以为 @Sensitive 会过滤违禁词，或以为它把数据库里也变密文
@Sensitive(strategy = SensitiveStrategy.PHONE) // 这只是"输出 JSON 时打码"
private String phone;
```

```text
✅ 正确认知：
- @Sensitive 是 PII 脱敏，DB 里 phone 仍是 13812348888 明文；
- 它不过滤敏感词（那是另一回事）；
- 想"落库密文"请用 @EncryptField（字段加密，是另一套机制），别混用。
```

### ❌ 错误 2：注解加在 Entity / BO，或加在非 String 字段

```java
// ❌ 加在 Entity：Entity 不应直接返回前端，且改库读写都会带注解干扰
public class SysUser { @Sensitive(strategy=...) String phone; }

// ❌ 加在 Long 字段：源码 value instanceof String 判断，非 String 直接跳过，不脱敏
@Sensitive(strategy = SensitiveStrategy.PHONE)
private Long phonenumber;   // 永远不会被打码
```

```java
// ✅ 正确：只在【返回前端的 VO】的【String 字段】上加
public class SysUserVo {
    @Sensitive(strategy = SensitiveStrategy.PHONE)
    private String phonenumber;   // String 类型才生效
}
```

### ❌ 错误 3：没实现/没注入 SensitiveService，却以为脱敏已生效

```text
现象：VO 字段加了 @Sensitive，接口返回却仍是完整手机号。
原因：SensitiveJsonFieldProcessor 用 @Autowired(required=false) 注入 SensitiveService，
      容器里没有该 Bean 时 service==null → process() 直接返回原文，不脱敏。
```

```java
// ✅ 正确：在主应用实现并注册 SensitiveService Bean（见第五节），
//         决定"什么角色脱敏、什么角色放行明文"。
@Service
public class SensitiveServiceImpl implements SensitiveService { ... }
```

### ❌ 错误 4：用错策略导致敏感信息被反推

```java
// ❌ Token 用 PHONE/STRING_MASK：固定可见位数，长度/前后缀暴露，易被猜
@Sensitive(strategy = SensitiveStrategy.STRING_MASK)
private String apiToken;
```

```java
// ✅ Token/私钥统一用 MASK_HIGH_SECURITY（前 2 后 2，中间随长度全掩）
@Sensitive(strategy = SensitiveStrategy.MASK_HIGH_SECURITY)
private String apiToken;
```

---

## 八、最佳实践

1. **只在出参 VO 的 String 字段加注解**：Entity/BO 不加；非 String 字段先转 String 再脱敏，或确认它本就不需脱敏。
2. **按数据类型选策略**：手机号 `PHONE`、身份证 `ID_CARD`、银行卡 `BANK_CARD`、姓名 `CHINESE_NAME`、邮箱 `EMAIL`、地址 `ADDRESS`、车牌 `CAR_LICENSE`、Token/私钥 `MASK_HIGH_SECURITY`、通用/自定义可见长度 `STRING_MASK`。
3. **Token/私钥永远用 `MASK_HIGH_SECURITY`**，不要用固定可见位数的策略。
4. **生产必须实现 `SensitiveService`**：明确定义哪些角色/权限放行明文（超管放行、普通用户脱敏），不要依赖"没 Bean 就不脱敏"的开发期默认。
5. **自定义掩码走枚举扩展，不在字段传参**：需要"前 6 后 2"等用 `DesensitizedUtils.mask/maskHighSecurity` 新增枚举项。
6. **脱敏 ≠ 安全终点**：脱敏只防"前端/日志泄露完整 PII"。真正落库保密用字段加密（`@EncryptField`），传输保密用 HTTPS/接口加密（`@ApiEncrypt`），三者各司其职。
7. **不可逆要清楚**：`CLEAR`/`CLEAR_TO_NULL` 会丢字段值，确认前端确实不需要该字段再用；其它掩码也无法在前端还原原文。
8. **日志脱敏分开看**：本技能管的是 JSON 序列化输出；若是操作日志（`sys_oper_log`）里要排除敏感参数，那属于 `@Log(excludeParamNames=...)`（log-audit 技能），不是 `@Sensitive`。

---

## 九、与其它技能的边界

| 你的诉求 | 用哪个技能/注解 | 说明 |
|---------|----------------|------|
| 返回前端时遮挡 PII（本技能） | `@Sensitive` + `SensitiveStrategy` | 序列化期掩码，DB 仍明文 |
| 字段落库加密、读出解密 | `@EncryptField`（security-guard） | DB 里是密文，可逆 |
| 整个接口请求/响应体加密 | `@ApiEncrypt`（security-guard） | 传输层加密 |
| 操作日志里排除密码/Token 参数 | `@Log(excludeParamNames=...)`（log-audit） | 日志脱敏，非 JSON 脱敏 |
| 行级数据隔离（按部门/本人） | `@DataPermission`（data-permission） | 数据权限，不是字段脱敏 |

> 一句话区分：**data-desensitize = 输出层把 PII 打码（明文留库）**；要"库里也别明文"是字段加密，要"日志别记敏感参数"是 log-audit，要"看不到别人的数据行"是 data-permission。
