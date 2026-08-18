---
name: bug-detective
description: |
  排查已发生的问题、定位 Bug 原因。（与 error-handler 区别：本 Skill 用于"排查问题"，error-handler 用于"设计异常处理机制"）

  触发场景：
  - 代码运行报错，需要定位原因
  - 功能不正常，需要排查
  - 接口返回错误，需要分析
  - 日志分析、调试代码
  - "为什么不工作"、"怎么不生效"

  触发词：Bug、报错、不工作、调试、排查、为什么、出问题、失败、不生效、无效、找不到原因、定位问题

  注意：如果是要设计异常处理机制（try-catch、全局异常、错误码），请使用 error-handler。
---

# Bug 排查指南（base-dev-framework6-java）

> 本指南针对 **base-dev-framework6-java**（包名 `org.dromara.*`、三层无 DAO、Service 层用 `QueryBuilder.lambda(Entity.class)` 构建查询、`MapstructUtils` 转换、`@TableLogic` 逻辑删除字段 `del_flag`）。
> 排查方法论（决策树 / 分层定位 / 二分法）是框架无关的通用思路，可以放心套用；但所有**具体代码、字段、类名**都按 框架来。

## 快速诊断入口

> **描述你的问题，根据关键词快速定位。**

### 错误关键词索引

| 关键词/现象 | 可能原因 | 跳转章节 |
|------------|---------|---------|
| `NullPointerException` | 对象为空（查询返回 null） | [#NPE 排查](#1-nullpointerexception) |
| `BadSqlGrammarException` / `SQLSyntaxError` | SQL/字段名错误 | [#SQL 异常](#2-sql-异常字段表名) |
| `401` / `未认证` | Sa-Token Token 问题 | [#权限问题](#3-权限问题sa-token) |
| `403` / `无权限` | `@SaCheckPermission` 配置 | [#权限问题](#3-权限问题sa-token) |
| `404` / `接口不存在` | URL 路径错误 | [#前端接口调用失败](#前端问题排查) |
| `500` / `服务器错误` | 后端异常 | [#日志分析](#日志分析与堆栈定位) |
| `data 为 null` / `msg 有值 data 没值` | `R.ok(String)` 重载陷阱 | [#R.ok() 陷阱](#1-rok-返回-string-的重载陷阱) |
| `MapstructUtils.convert 返回 null` | `@AutoMapper` 缺失/源对象 null | [#对象转换问题](#对象转换问题mapstructutils) |
| `查询无结果` / `数据查不到` | `del_flag` / 租户 / 条件问题 | [#查询不到数据](#查询不到数据系统排查) |
| `查询条件不生效` | Service 层 wrapper 条件没拼上 | [#查询条件不生效](#3-查询条件不生效qureybuilder) |
| `ID 精度丢失` / `ID 末尾变 0` | 雪花 ID 大数 JS 精度 | [#雪花 ID 精度问题](#4-雪花-id-精度丢失) |
| `NoSuchBeanDefinitionException` | 包路径/注解问题 | [#Bean 注入失败](#5-bean-注入失败) |
| `事务不回滚` | 异常被吞 / 非 public 方法 | [#事务问题](#6-事务不回滚) |
| `前端取不到数据` | 响应格式/响应式赋值 | [#前端问题排查](#前端问题排查) |

---

## 问题诊断决策树

### 接口返回错误

```
接口返回错误
├─ 状态码 4xx
│  ├─ 400 → 请求参数格式/类型错误
│  │         检查：@RequestBody/@RequestParam、参数名、类型、分组校验 @Validated(AddGroup.class)
│  ├─ 401 → Sa-Token 过期/未登录
│  │         检查：Authorization 头、Token 是否有效、StpUtil 登录态
│  ├─ 403 → 无权限访问
│  │         检查：@SaCheckPermission("module:business:action")、用户角色、菜单 perms
│  └─ 404 → 接口路径不存在
│            检查：@RequestMapping 路径、Controller 是否被扫描（org.dromara.* 包下）
│
├─ 状态码 500
│  ├─ 控制台有堆栈 → 按异常类型定位（堆栈含 org.dromara.xxx.XxxServiceImpl:行号）
│  │   ├─ NullPointerException        → 对象未初始化 / Mapper 查询返回 null
│  │   ├─ BadSqlGrammarException      → SQL 语法 / 字段名 / 表名错误
│  │   ├─ ServiceException            → 业务逻辑主动抛出（看 message）
│  │   └─ 其他异常                     → 看具体异常信息 + 堆栈首行业务类
│  └─ 无堆栈信息 → 检查 GlobalExceptionHandler 是否吞掉了异常
│
└─ 状态码 200 但数据不对
   ├─ data 为 null，msg 有值
   │  └─ ⭐ R.ok(String) 重载陷阱！用 R.ok(null, str) 或 R.ok(msg, str)
   ├─ data 为 null，msg 也为 null
   │  ├─ 查询条件没拼上     → 检查 Service 层 QueryBuilder.lambda 条件
   │  ├─ 逻辑删除被过滤      → 检查 del_flag（@TableLogic，'0' 正常 '1' 删）
   │  └─ 租户不匹配         → 多租户表检查 tenant_id
   ├─ data 部分字段缺失
   │  └─ @AutoMapper 配置 / 字段名不一致
   └─ data 格式不对（如 ID 末尾变 0）
      └─ 雪花 ID 大数问题，VO 用 String 或加序列化
```

### 页面不显示 / 报错

```
页面问题（Element Plus 代码生成页面 / Ant Design Pro）
├─ 浏览器控制台有 JS 错误
│  ├─ TypeError      → 类型错误，检查变量定义 / .value 使用
│  ├─ ReferenceError → 引用错误，检查 import
│  └─ 组件报错        → 检查组件属性/插槽
│
├─ Network 有红色（失败）请求
│  └─ 接口问题 → 转到"接口返回错误"决策树
│
└─ 无错误但不显示
   ├─ v-if 条件为 false → 检查条件逻辑
   ├─ 数据未赋值        → 检查 ref/reactive 的 .value / toRefs
   ├─ 列表为空          → 接口 records 是否有数据（转后端排查）
   └─ 权限指令拦截       → v-hasPermi 未命中导致按钮不渲染
```

---

## 分层定位指南

### 快速判断问题在哪一层

```
步骤 1：用 Postman/curl 直接调接口（绕过前端）
├─ 返回正确数据 → 问题在【前端】（响应式赋值 / 渲染 / 权限指令）
└─ 返回错误/空  → 问题在【后端】

步骤 2（后端）：打断点或加日志，看请求到没到 Controller
├─ Controller 收到请求且参数正常 → 问题在 Service（业务逻辑 / 查询条件）
├─ Controller 没收到            → URL 路径 / 包扫描 / 路由问题
└─ Controller 参数为空           → 请求参数传递 / @RequestBody 绑定问题

步骤 3（后端）：直接在数据库执行 SQL（带 del_flag / tenant_id 条件）
├─ 有数据 → 查询条件构建问题（Service 层 wrapper 条件没拼对）
└─ 无数据 → 数据本身不存在 / 已逻辑删除 / 租户不匹配
```

### 各层常见问题速查（6.x 三层无 DAO）

| 层级 | 常见问题 | 排查重点 |
|------|---------|---------|
| **Controller** | 参数绑定失败、路径 404、权限拦截 | `@RequestMapping`、`@RequestBody`、`@PathVariable`、`@SaCheckPermission` |
| **Service** | 业务逻辑错误、**查询条件没拼上**、事务回滚 | `QueryBuilder.lambda(Entity.class)` + `eqIfText/likeIfText`、`@Transactional` |
| **Mapper** | SQL 语法、字段映射、逻辑删除过滤 | `extends BaseMapperPlus<Entity, Vo>`、`@TableName`、`@TableField`、`@TableLogic` |
| **前端 API** | 请求配置、参数格式、路径前缀 | `request` from `@/utils/request`、`listXxx/getXxx` 命名 |
| **前端组件** | 响应式、生命周期、权限指令 | `ref/reactive` + `toRefs`、`onMounted`、`v-hasPermi` |

> **6.x 没有 DAO 层**：查询条件构建在 **Service 层**用 `QueryBuilder.lambda(Entity.class)`，Service 直接注入 `XxxMapper extends BaseMapperPlus<Entity, Vo>`。本框架不存在独立 DAO 接口、不存在 DAO 层的 wrapper 构建方法、也不存在自定义 Plus 链式查询类。如果你在排查中看到这类名字，那是别的衍生版本，不是本框架。

---

## 后端问题排查

### 常见错误类型

#### 1. NullPointerException

**原因**：对象为 null 时调用方法或访问属性，最常见是 Mapper 查询返回 null。

```java
// 检查可能为 null 的位置
SysUser user = userMapper.selectById(id);  // 查不到时返回 null
user.getNickName();                        // 若 user 为 null 则 NPE

// 修复：显式判空，用业务异常给出可读提示
if (ObjectUtil.isNull(user)) {
    throw new ServiceException("用户不存在");
}
```

**6.x 常见场景**：
- `xxxMapper.selectById(id)` / `selectVoById(id)` 返回 null 后直接链式调用
- `MapstructUtils.convert(source, Target.class)` 的 `source` 为 null（convert 会返回 null）
- Stream 映射链路中间某环节为 null

#### 2. SQL 异常（字段/表名）

**常见原因**：字段名/表名错误、SQL 语法错误、类型不匹配、唯一键冲突。Spring 通常包装成 `BadSqlGrammarException`。

```sql
-- 检查表是否存在
SHOW TABLES LIKE 'sys_oss';

-- 检查字段是否存在（确认 Entity @TableField 与列名一致）
DESC sys_oss;

-- 直接执行最小 SQL 复现报错
SELECT * FROM sys_oss WHERE oss_id = 1;

-- 检查唯一键冲突
SELECT * FROM sys_dict_type WHERE dict_type = 'sys_user_sex';
```

排查要点：
- Entity 的 `@TableName("xxx")` 与库表名是否一致；字段 `@TableField` 与列名是否一致。
- 多数据库（MySQL/PostgreSQL/Oracle）类型严格性差异：拼接函数、分页语法不同。

#### 3. 权限问题（Sa-Token）

**表现**：接口返回 401（未登录/Token 失效）或 403（已登录但无权限）。

```java
// 1. 检查接口是否加了权限注解（格式：module:business:action）
@SaCheckPermission("system:user:list")
@GetMapping("/list")
public R<PageResult<SysUserVo>> list(SysUserBo bo, PageQuery pageQuery) { ... }
```

```sql
-- 2. 权限串必须与菜单 perms 一致
SELECT * FROM sys_menu WHERE perms = 'system:user:list';

-- 3. 用户是否拥有对应角色
SELECT r.* FROM sys_role r
JOIN sys_user_role ur ON r.role_id = ur.role_id
WHERE ur.user_id = #{userId};

-- 4. 角色是否绑定了含该 perms 的菜单
SELECT m.* FROM sys_menu m
JOIN sys_role_menu rm ON m.menu_id = rm.menu_id
WHERE rm.role_id = #{roleId} AND m.perms = 'system:user:list';
```

401 优先查 Token：`Authorization` 头是否携带、是否过期（`StpUtil.isLogin()`）、前端登录态是否丢失。

#### 4. 雪花 ID 精度丢失

```
后端返回：1234567890123456789
前端收到：1234567890123456000  ← 末尾几位变 0
```

**原因**：JS `Number` 最大安全整数 `2^53-1 = 9007199254740991`，雪花 ID 是 Long，超出精度。

```java
// 方案 1：VO 中 ID 用 String（类型约定 ID 用 string|number，序列化为字符串最稳）
public class XxxVo implements Serializable {
    private String id;
}

// 方案 2：字段级序列化为字符串
@JsonSerialize(using = ToStringSerializer.class)
private Long id;
```

> 6.x 通常已在 Jackson 全局配置中处理 Long 序列化；若个别接口仍丢精度，按上面两种方案兜底。

#### 5. Bean 注入失败

```
NoSuchBeanDefinitionException: No qualifying bean of type '...'
```

排查步骤：
```java
// 1. 实现类是否标注 @Service / @Component / @Repository
@Service
@RequiredArgsConstructor
public class XxxServiceImpl implements IXxxService { ... }

// 2. 包路径是否在扫描范围内 —— 必须在 org.dromara.* 下
//    （新模块包名错写成其他根包会扫不到）

// 3. 是否存在循环依赖（A 注入 B，B 又注入 A）

// 4. 接口与实现是否匹配：IXxxService 接口 ↔ XxxServiceImpl 实现
```

> 跨模块调用要走 `ruoyi-api` 暴露的接口（如 `UserService`/`WorkflowService`），**不要直接 import 另一个业务模块的实现类**，否则会出现找不到 Bean / 模块耦合问题。

#### 6. 事务不回滚

```java
// 1. 多表写操作必须加事务，且 rollbackFor = Exception.class
@Transactional(rollbackFor = Exception.class)
public Boolean insertByBo(XxxBo bo) { ... }

// 2. 异常被 try-catch 吞掉 → 事务感知不到，不回滚
try {
    // 写操作
} catch (Exception e) {
    log.error("保存失败", e);  // ❌ 仅记录不抛 → 事务不回滚
    throw e;                  // ✅ 必须重新抛出（或抛 ServiceException）
}

// 3. @Transactional 在非 public 方法 / 同类内部自调用上不生效
// 4. 默认仅对 RuntimeException 回滚，受检异常需 rollbackFor 指定
```

### 日志分析与堆栈定位

**堆栈关键信息**：
```
1. 异常类型：NullPointerException / BadSqlGrammarException / ServiceException ...
2. 异常信息：message 文本
3. 业务定位行：堆栈中找第一行 org.dromara.xxx 开头的类，如
   at org.dromara.system.service.impl.SysUserServiceImpl.insertByBo(SysUserServiceImpl.java:120)
4. 请求参数：检查入参是否符合预期
```

**添加调试日志**（注意类名注解是 `@Slf4j` 不是 `@Slf4f`）：
```java
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class XxxServiceImpl implements IXxxService {
    public void doSomething(Long id) {
        log.info("开始处理, id: {}", id);
        // ...
        log.debug("中间状态: {}", state);
        log.info("处理完成, 结果: {}", result);
    }
}
```

排查节奏：先定位堆栈首个 `org.dromara.*` 业务类与行号 → Read 该文件对应行 → 结合入参/SQL 还原现场 → 给出修复方案。

---

## 本框架特有问题库（重点！）

### 1. R.ok() 返回 String 的重载陷阱

当 Controller 返回类型是 `R<String>` 时，`R.ok(stringValue)` 会匹配到 `ok(String msg)` 重载，数据被放进 `msg` 而不是 `data`。

```java
// ❌ 错误：R.ok(String) 命中 ok(String msg)，data 为 null
@GetMapping("/getCode")
public R<String> getCode() {
    String code = "ABC123";
    return R.ok(code);  // 前端收到 { code: 200, msg: "ABC123", data: null }
}

// ✅ 正确：显式用 ok(String msg, T data)
@GetMapping("/getCode")
public R<String> getCode() {
    String code = "ABC123";
    return R.ok(null, code);       // { code: 200, msg: null, data: "ABC123" }
    // 或
    return R.ok("获取成功", code);  // { code: 200, msg: "获取成功", data: "ABC123" }
}
```

**排查信号**：前端拿到 200 但 `data` 为 null、`msg` 里却有值；返回验证码、Token、URL 这类字符串时高发。

### 2. 查询不到数据 → 优先怀疑逻辑删除 / 租户

数据"明明插入了却查不到"，6.x 最常见三个原因：`del_flag` 被逻辑删除过滤、`tenant_id` 不匹配（多租户表）、查询条件没拼上。

```java
// Entity：逻辑删除字段是 del_flag（不是别的命名），由 @TableLogic 自动追加 del_flag='0'
public class Xxx extends BaseEntity {
    @TableLogic
    private String delFlag;   // 列名 del_flag：'0' 正常、'1' 已删除
}
```

```sql
-- 单表查询排查（必带 del_flag）
SELECT * FROM 表名 WHERE id = ? AND del_flag = '0';

-- 多租户表再叠加 tenant_id
SELECT * FROM 表名 WHERE id = ? AND del_flag = '0' AND tenant_id = '000000';
```

- 若把上面 SQL 里的 `del_flag='0'` 去掉能查到 → 数据被逻辑删除了（被 `removeById` 软删）。
- 若把 `tenant_id` 去掉能查到 → 租户隔离命中，检查当前登录用户/请求头租户上下文。
- 若都加上仍查不到 → 数据确实不存在，或查询条件根本没拼上（见下一条）。

### 3. 查询条件不生效（QueryBuilder）

6.x **没有 DAO 层**，查询条件在 **Service 层**用 `QueryBuilder.lambda(Entity.class)` 构建，条件用 `eqIfText/likeIfText/eqIfPresent/inIfNotEmpty/betweenParams`（这些 `IfText/IfPresent` 方法会在值为空时自动跳过条件）。

```java
// ✅ 正确：Service 层构建查询条件（生成器风格）
private LambdaQueryWrapper<Xxx> buildQuery(XxxBo bo) {
    Map<String, Object> params = bo.getParams();
    return QueryBuilder.lambda(Xxx.class)
        .eqIfPresent(Xxx::getStatus, bo.getStatus())          // 值为 null 自动跳过
        .likeIfText(Xxx::getName, bo.getName())               // 空字符串自动跳过；String 模糊匹配
        .inIfNotEmpty(Xxx::getType, bo.getTypeList())         // 集合空自动跳过
        .betweenParams(Xxx::getCreateTime, params, "beginTime", "endTime")  // 日期范围从 params 取
        .build();
}

// 分页查询
public PageResult<XxxVo> queryPageList(XxxBo bo, PageQuery pageQuery) {
    LambdaQueryWrapper<Xxx> lqw = buildQuery(bo);
    Page<XxxVo> page = xxxMapper.selectVoPage(pageQuery.build(), lqw);
    return PageResult.build(page.getRecords(), page.getTotal());
}
```

**条件没生效的排查点**：
- 用了 `eqIfText`/`likeIfText` 但传进来的是 `null`/空串 → 条件被有意跳过（这是设计行为，不是 Bug）。若本意必传，改用 `eq`/`like`。
- 日期范围查不到 → `bo.getParams()` 里 key 必须是 `beginTime`/`endTime`（与前端 `addDateRange` / `useDateRangeQuery` 对齐），key 写错条件就丢了。
- `likeIfText` 只对 **String 字段**做模糊匹配；对数值/日期字段要模糊匹配应改用范围条件（`betweenParams`），不要硬套 like。

> ⚠️ 本框架的条件辅助方法**只有这一套**：`eqIfText/likeIfText/eqIfPresent/neIfPresent/betweenIfPresent/betweenParams/inIfNotEmpty/findInSetIfPresent`。没有针对非字符串字段做类型转换模糊匹配的扩展方法——数值/日期字段要范围匹配请用 `betweenParams`。

### 对象转换问题（MapstructUtils）

```java
// 现象：MapstructUtils.convert 返回 null 或字段缺失
XxxVo vo = MapstructUtils.convert(entity, XxxVo.class);
```

排查步骤：
1. **源对象是否为 null** —— convert 源为 null 时直接返回 null（最常见）。
2. **目标类是否标注 `@AutoMapper`**（本框架就是这一个映射注解，BO/VO 各标一个）：
   ```java
   // BO：映射到 Entity，单向
   @AutoMapper(target = Xxx.class, reverseConvertGenerate = false)
   public class XxxBo implements Serializable { ... }

   // VO：映射到 Entity
   @AutoMapper(target = Xxx.class)
   public class XxxVo implements Serializable { ... }
   ```
3. **字段名是否一致** —— MapStruct-Plus 按字段名映射，名称对不上的字段不会被复制（导致部分字段缺失）。
4. **重新编译** —— MapStruct 在编译期生成转换代码，改了注解/字段后未重新编译会用旧的生成类。

> 转换用的是 MapStruct-Plus 的 `MapstructUtils` + `@AutoMapper`，**不是** `BeanUtils` 之类的反射拷贝。映射注解只有 `@AutoMapper` 一个，不要去找其他变体写法。

---

## 查询不到数据：系统排查

> 当排查涉及"数据查不到"时，AI 应主动连接数据库验证，而不只是给 SQL 让用户跑。

### 步骤 1：读取数据库配置

```
Read backend/java/ruoyi-admin/src/main/resources/application-dev.yml
```
解析：数据库类型（MySQL/PostgreSQL/Oracle/SQL Server）、host（`${DB_HOST:127.0.0.1}`）、端口、库名、用户名/密码。

### 步骤 2：连接执行查询

```bash
# MySQL（最常用）
mysql -h127.0.0.1 -P3306 -uroot -p密码 数据库名 -e "SELECT * FROM 表 WHERE id=? AND del_flag='0'"

# PostgreSQL
PGPASSWORD=密码 psql -h 127.0.0.1 -p 5432 -U root -d 数据库名 -c "SELECT * FROM 表 WHERE id=? AND del_flag='0'"
```

### 步骤 3：按结果分析

```
查询结果分析决策树：
├─ 有数据
│  ├─ 数据正确 → 问题不在库，转查代码（查询条件 / 转换 / 前端）
│  ├─ 数据不对 → 定位是哪个字段值有问题
│  └─ del_flag='1' → 数据已逻辑删除
├─ 无数据
│  ├─ 去掉 del_flag 条件能查到 → 已被逻辑删除
│  ├─ 去掉 tenant_id 条件能查到 → 租户隔离命中（多租户表）
│  └─ 都去掉仍无 → ID 写错 / 数据从未写入
└─ 执行报错
   ├─ 表不存在 → 表名 / 库名错
   ├─ 字段不存在 → @TableField 与列名不一致
   └─ 语法错误 → SQL 语法（注意多数据库差异）
```

### 常用排查 SQL

```sql
-- 数据存在性（单表）
SELECT * FROM 表名 WHERE id = ? AND del_flag = '0';

-- 多租户表再加 tenant_id
SELECT * FROM 表名 WHERE id = ? AND del_flag = '0' AND tenant_id = '000000';

-- 最近写入的数据
SELECT * FROM 表名 ORDER BY create_time DESC LIMIT 10;

-- 权限：用户最终拥有的 perms
SELECT DISTINCT m.perms FROM sys_menu m
JOIN sys_role_menu rm ON m.menu_id = rm.menu_id
JOIN sys_user_role ur ON rm.role_id = ur.role_id
WHERE ur.user_id = ? AND m.perms IS NOT NULL;

-- 字典数据
SELECT * FROM sys_dict_data WHERE dict_type = ? ORDER BY dict_sort;
```

---

## SQL 日志排查（看真实执行的 SQL）

ORM 拼出来的 SQL 与你以为的不一样时，最可靠的办法是打印**回填了真实参数的完整 SQL**。6.x 可用框架内置的 `SqlLogInterceptor`。

### 开启 SQL 日志

在 `application-dev.yml`（开发环境）开启：
```yaml
mybatis-plus:
  sql-log:
    enabled: true   # 开启后控制台打印每条 SQL 的完整语句 + 参数 + 耗时
```

开启后控制台会输出形如：
```
==>  执行 SQL: SELECT * FROM sys_user WHERE id = 1 AND del_flag = '0' AND tenant_id = '000000'
==>  耗时: 6 ms
```

### 用 SQL 日志排查的典型场景

1. **查询条件不生效** → 看打印的 SQL 里到底有没有那个 `WHERE` 条件。
   - 条件缺失 → Service 层 `eqIfText/likeIfText` 因值为空被跳过，或参数没传到。
2. **逻辑删除 / 租户** → 看 SQL 末尾是否自动追加了 `del_flag = '0'` / `tenant_id = ?`，确认拦截器生效。
3. **慢查询** → 看打印的耗时，超过 200ms 的 SQL 转 `performance-doctor` 优化（加索引 / 改 N+1）。
4. **参数对不上** → 完整 SQL 里能直接看到回填的真实参数值，比断点看 wrapper 更直观。

> 生产环境（prod）通常不开 `sql-log`，靠日志文件（`./logs/` 下的滚动日志）排查；开发环境优先用 `sql-log.enabled=true` 看实时完整 SQL。

---

## 常见错误对比（错 vs 对）

> 排查时若发现代码沿用了下面"错误一侧"的旧套路（多半来自把别的衍生版本经验硬套到本框架），先纠正再继续。

### 对比 1：查询条件该放哪一层

```java
// ❌ 错误做法：以为有独立 DAO 层，把查询条件放到一个 DAO 接口的 wrapper 构建方法里
//    本框架没有 DAO 层、没有 DAO 的 wrapper 构建方法、也没有自定义 Plus 链式查询类
//    （这些都是别的版本的概念，本框架找不到）

// ✅ 正确：Service 直接注入 Mapper，条件用 QueryBuilder.lambda(Entity.class) 在 Service 层构建
@Service
@RequiredArgsConstructor
public class XxxServiceImpl implements IXxxService {
    private final XxxMapper xxxMapper;   // extends BaseMapperPlus<Xxx, XxxVo>

    private LambdaQueryWrapper<Xxx> buildQuery(XxxBo bo) {
        return QueryBuilder.lambda(Xxx.class)
            .eqIfPresent(Xxx::getStatus, bo.getStatus())
            .likeIfText(Xxx::getName, bo.getName())
            .build();
    }
}
```

### 对比 2：对象转换注解

```java
// ❌ 错误做法：用反射式拷贝工具（如 BeanUtils.copyProperties）替代框架转换；
//    或者去找一个并不存在的"复数版映射注解"。本框架两者都不用。

// ✅ 正确：目标类标 @AutoMapper（单个注解），转换走 MapstructUtils.convert
@AutoMapper(target = Xxx.class)
public class XxxVo implements Serializable { ... }
XxxVo vo = MapstructUtils.convert(entity, XxxVo.class);
```

### 对比 3：逻辑删除字段名

```java
// ❌ 错误做法：把逻辑删除字段命名成别的版本的约定（如布尔风格命名），
//    导致 @TableLogic 追加的条件列名与库表 del_flag 对不上，查询全部被过滤。

// ✅ 正确：本框架逻辑删除字段是 del_flag，由 BaseEntity 体系约定
@TableLogic
private String delFlag;     // 列名 del_flag：'0' 正常、'1' 删除
```

### 对比 4：堆栈/包名认知

```
// ❌ 错误做法：在异常堆栈里按别的版本的根包名去找业务类，自然找不到对应代码。

// ✅ 正确：框架业务类都在 org.dromara.* 下，按这个根包定位
at org.dromara.system.service.impl.SysUserServiceImpl.insertByBo(SysUserServiceImpl.java:120)
```

---

## 前端问题排查

> 前端是**代码生成器产物**（Vue + Element Plus，或 React + Ant Design Pro），通过浏览器控制台 / 网络请求面板排查，**不涉及移动端**。

### 1. 接口调用失败

排查步骤：
1. 打开浏览器开发者工具（F12）→ Network。
2. 找到失败请求，看状态码与响应体。

| 状态码 | 含义 | 解决方向 |
|--------|------|---------|
| 400 | 请求参数错误 | 检查参数类型/格式、分组校验 |
| 401 | 未认证 | Token 是否携带/有效，重新登录 |
| 403 | 无权限 | `@SaCheckPermission` 与角色菜单 perms |
| 404 | 接口不存在 | URL 路径、后端是否启动、包扫描 |
| 500 | 服务端错误 | 看后端控制台堆栈（org.dromara.*） |

### 2. 拿到数据但页面不显示 / 不更新

```typescript
// 检查接口确实返回了数据
console.log('API 返回:', res)

// 列表赋值：注意响应式
state.tableData = res.rows        // reactive + toRefs 模式
// 或
dataList.value = res.rows         // ref 模式，必须 .value

// 表单回填用逐字段/Object.assign，避免直接替换 reactive 引用
Object.assign(form, res.data)
```

常见原因：
- `ref` 忘了 `.value`；直接替换 `reactive` 对象引用导致丢失响应式。
- 接口返回的是 `rows`/`records`，前端取错字段。
- `v-hasPermi=['module:business:xxx']` 未命中 → 按钮/区域不渲染（不是 Bug，是权限）。

### 3. 调试技巧

```typescript
console.log('变量值:', value)
console.table(arrayData)   // 数组以表格展示
debugger                   // 断点
// 安装 Vue Devtools 查看组件树 / 响应式状态 / 事件
```

---

## 排查清单（按顺序逐条核对）

后端：
- [ ] 看堆栈：定位第一行 `org.dromara.*` 业务类 + 行号，确认异常类型。
- [ ] `R<String>` 接口 data 为 null？→ 检查是否误用 `R.ok(str)`，改 `R.ok(null, str)`。
- [ ] 数据查不到？→ DB 直查 `... AND del_flag='0'`（多租户再加 `tenant_id`）。
- [ ] 查询条件没生效？→ 开 `sql-log.enabled=true` 看完整 SQL；确认 `eqIfText/likeIfText` 值非空。
- [ ] 转换返回 null / 缺字段？→ 源对象非 null、目标类有 `@AutoMapper`、字段名一致、已重新编译。
- [ ] 401/403？→ Token 有效性、`@SaCheckPermission` 串与菜单 perms、角色绑定。
- [ ] Bean 找不到？→ `@Service` 注解、包在 `org.dromara.*` 下、跨模块走 `ruoyi-api`。
- [ ] 事务不回滚？→ `@Transactional(rollbackFor=Exception.class)`、异常未被吞、public 方法。
- [ ] ID 末尾变 0？→ VO 用 String 或 `@JsonSerialize(using=ToStringSerializer.class)`。

前端：
- [ ] F12 Network 看状态码 → 4xx/5xx 转后端排查。
- [ ] 200 但页面空？→ 接口字段（rows/records）取对没、响应式 `.value`/`toRefs` 用对没。
- [ ] 按钮不显示？→ `v-hasPermi` 权限是否命中。

通用方法论：
- [ ] 二分法逐步缩小范围（先分前后端，再分层）。
- [ ] 确保问题可稳定复现。
- [ ] 优先看日志/完整 SQL，胜过凭描述猜测。

---

## Skill 联动建议

| 排查发现 | 推荐激活 | 说明 |
|---------|---------|------|
| 查询性能慢 / SQL 慢 | `performance-doctor` | 优化索引、缓存、N+1 |
| 权限配置问题 | `security-guard` | Sa-Token 权限设计 |
| 行级数据权限不生效 | `data-permission` | `@DataPermission` + `@DataColumn` 列名对齐 |
| SQL 语法 / 表结构问题 | `database-ops` | 检查表结构、建表、字段 |
| 前端组件用法不清 | `ui-pc` | Element Plus 代码生成页面组件用法 |
| 对象转换 / CRUD 结构 | `crud-development` | BO/VO/@AutoMapper、三层结构 |
| 异常处理机制缺失 | `error-handler` | 设计 try-catch / 错误码 / 全局异常 |
| 接口设计规范 | `api-development` | RESTful 路径、R<T> 响应 |

---

## 🔗 关联技能边界

本技能专注于**排查已经发生的问题**（找因）。遇到以下场景请改用其他技能：

| 场景 | 应使用技能 | 判断关键词 |
|------|-----------|-----------|
| 设计 try-catch / 错误码 / 全局异常处理器 | `error-handler` | "怎么处理异常"、"错误码规范"、"ServiceException 怎么用" |
| 页面慢、SQL 慢、内存泄漏等性能问题 | `performance-doctor` | "响应慢"、"卡顿"、"EXPLAIN"、"慢查询" |
| 只是不知道文件在哪 / 代码结构不清楚 | `project-navigator` | "在哪里"、"找一下"、"目录结构" |

**一句话辨别**：
- "**为什么 X 不工作**" → bug-detective（你在找因）。
- "**X 该怎么处理错误**" → error-handler（你在设计果）。
- "**X 为什么这么慢**" → performance-doctor（你在量性能）。
