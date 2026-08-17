---
name: data-permission
description: |
  base-dev-framework6-java行级数据权限开发指南。覆盖 @DataPermission + @DataColumn
  注解、6 种数据范围枚举（DataScopeType）、PlusDataPermissionHandler 工作原理、与 MPJ 联表
  别名配合、临时忽略数据权限、不生效排查。所有约定均来自真实源码
  ruoyi-common/ruoyi-common-mybatis 与 ruoyi-modules/ruoyi-system（SysUser/SysRole/SysDept/SysPost）。

  触发场景：
  - 为业务模块的列表/分页/导出/删除接口加部门级、本人级数据隔离过滤。
  - 配置自定义数据权限（角色绑定指定部门集合），或扩展新的 dataScope 类型。
  - 临时忽略数据权限查全量数据（如查自己的资料、定时任务全量统计）。
  - 排查「数据权限不生效」「越权能看到别人部门数据」「SQL 报数据权限解析异常」。
  - 在 MPJ（mybatis-plus-join）联表查询里让 @DataColumn 的列名对齐 SQL 表别名。

  触发词：数据权限、@DataPermission、@DataColumn、DataScope、DataScopeType、行级权限、
  数据隔离、部门权限、本人权限、自定义权限、权限过滤、数据过滤、按部门过滤、按创建人过滤、
  PlusDataPermissionHandler、PlusDataPermissionInterceptor、DataPermissionHelper、忽略数据权限、
  ignore、dept_id、create_by、create_dept、SpEL 模板、deptName、userName

  本项目 base-dev-framework6-java 遵循框架约定！包名 org.dromara.*；三层无 DAO，注解写在
  Mapper / Service 上（不是 DAO）；禁用 plus.ruoyi/com.ruoyi/buildQueryWrapper/PlusLambdaQuery/
  likeCast/TenantEntity(默认)/is_deleted 这些 ruoyi-plus-uniapp 衍生写法。

  注意：本技能只管「行级数据权限」。登录认证、Token、Sa-Token、菜单/按钮功能权限请用 security-guard。
---

# 行级数据权限开发（base-dev-framework6-java）

## 一、概述

数据权限解决的是「**同一张表，不同用户只能看到属于自己范围的行**」的问题——例如部门 A 的
经理只能看到部门 A 及其子部门的用户，普通员工只能看到自己创建的数据。它与「功能权限」
（能不能点这个按钮、能不能访问这个接口，由 Sa-Token 的 `@SaCheckPermission` 控制）是两个维度。

框架的数据权限实现位于 `ruoyi-common/ruoyi-common-mybatis`，核心三件：

| 组件 | 全限定名 | 职责 |
|------|----------|------|
| 注解 | `org.dromara.common.mybatis.annotation.DataPermission` / `DataColumn` | 声明「按哪些列过滤」 |
| 拦截器 | `org.dromara.common.mybatis.interceptor.PlusDataPermissionInterceptor` | 挂在 MyBatis-Plus 拦截器链上，改写 SQL |
| 处理器 | `org.dromara.common.mybatis.handler.PlusDataPermissionHandler` | 真正拼数据过滤 SQL 片段 |
| 枚举 | `org.dromara.common.mybatis.enums.DataScopeType` | 6 种数据范围 → SpEL SQL 模板 |
| 助手 | `org.dromara.common.mybatis.helper.DataPermissionHelper` | 上下文变量 / 临时忽略入口 |

一句话原理：**注解声明列 → AOP 把注解塞进线程上下文 → MyBatis 拦截器在 SQL 执行前，
根据当前登录用户角色的 `dataScope` 把 SpEL 模板渲染成 `(dept_id IN (...))` 这样的条件，
用括号包住后 AND 进原 WHERE。**

> 🔴 6.x 铁律：包名 `org.dromara.*`；本框架三层无 DAO，注解放在 **Mapper 方法** 或
> **带注解的 Service 方法/类** 上，绝不存在 DAO 层。不要写 `com.ruoyi` / `plus.ruoyi`、
> 不要用 `buildQueryWrapper` / `PlusLambdaQuery` / `likeCast` 这些非原版写法。

## 二、注解用法（@DataPermission + @DataColumn）

`@DataPermission` 是「组注解」，里面是一个 `@DataColumn` 数组。`@DataColumn` 的两个核心属性：

- `key`：SpEL 模板里的**占位符变量名**（如 `deptName`、`userName`），用于匹配 `DataScopeType` 模板。
- `value`：占位符要替换成的**真实数据库列名 / SQL 别名**（如 `dept_id`、`create_by`、`d.dept_id`）。

⚠️ `key` 和 `value` 是约定俗成的「角色」语义，不要被字面意思误导：

- `key = "deptName"` 代表「**部门维度**」，`value` 填部门所在列（如 `dept_id`、`create_dept`）。
- `key = "userName"` 代表「**本人维度**」，`value` 填创建人所在列（如 `create_by`）。

```java
// 真实源码：SysUserMapper.java（按部门 + 按本人双维度过滤）
@DataPermission({
    @DataColumn(key = "deptName", value = "dept_id"),
    @DataColumn(key = "userName", value = "create_by")
})
default Page<SysUserVo> selectPageUserList(Page<SysUser> page, Wrapper<SysUser> queryWrapper) {
    return this.selectVoPage(page, queryWrapper);
}
```

```java
// 真实源码：SysDeptMapper.java（只按部门维度过滤，列名就是 dept_id 本身）
@DataPermission({
    @DataColumn(key = "deptName", value = "dept_id")
})
default List<SysDeptVo> selectDeptList(Wrapper<SysDept> queryWrapper) {
    return this.selectVoList(queryWrapper);
}
```

```java
// 真实源码：SysRoleMapper.java（角色表的部门列叫 create_dept，不是 dept_id —— value 跟着表结构走）
@DataPermission({
    @DataColumn(key = "deptName", value = "create_dept"),
    @DataColumn(key = "userName", value = "create_by")
})
default Page<SysRoleVo> selectPageRoleList(@Param("page") Page<SysRole> page,
                                           @Param(Constants.WRAPPER) Wrapper<SysRole> queryWrapper) {
    return this.selectVoPage(page, queryWrapper);
}
```

### 注解可放的位置

`@DataPermission` 的 `@Target` 是 `{METHOD, TYPE}`，`@DataColumn` 是 `METHOD`。因此：

- **Mapper 接口的某个 default 方法上**（最常见，见上面三例）。
- **Mapper 接口 / Service 类的类级别上**（整个类的方法都生效——`DataPermissionAdvice` 会在
  方法上找不到注解时回退到类上找，含 JDK 动态代理接口）。
- **Service 方法 / 类上**：6.x 通过 `DataPermissionAdvice`（AOP `MethodInterceptor`）把方法/类上的
  `@DataPermission` 写进 `DataPermissionHelper`，因此 Service 自定义查询同样能用。

> 列名对齐很关键：`value` 必须能匹配最终执行 SQL 里该列出现的写法。如果 SQL 给表起了别名
> （`FROM sys_user u`），则要写 `value = "u.dept_id"`；不带别名的单表查询写 `value = "dept_id"` 即可。详见第六节。

### joinStr：控制多条件的拼接符

`@DataPermission(joinStr = "OR")` 可指定多个角色/多列条件之间的连接符。不填时默认：
**查询语句用 `OR`，更新/删除语句用 `AND`**（见 `PlusDataPermissionHandler#buildDataFilter`：
`String joinStr = isSelect ? " OR " : " AND ";`）。多数业务保持默认即可。

## 三、数据范围类型（DataScopeType 6 种，按真实枚举核对）

每个角色（`sys_role.data_scope`）配一个 code，处理器据此选 SpEL 模板。下表逐字摘自
`DataScopeType.java`（`code` / `sqlTemplate` / `elseSql`）：

| 枚举 | code | 含义 | SpEL 模板（sqlTemplate） |
|------|------|------|--------------------------|
| `ALL` | `1` | 全部数据权限 | 空模板，直接放行不加任何条件 |
| `CUSTOM` | `2` | 自定义（角色绑定的部门集合） | ` #{#deptName} IN ( #{@sdss.getRoleCustom( #roleId )} ) ` |
| `DEPT` | `3` | 本部门 | ` #{#deptName} = #{#user.deptId} ` |
| `DEPT_AND_CHILD` | `4` | 本部门及以下 | ` #{#deptName} IN ( #{@sdss.getDeptAndChild( #user.deptId )} )` |
| `SELF` | `5` | 仅本人 | ` #{#userName} = #{#user.userId} ` |
| `DEPT_AND_CHILD_OR_SELF` | `6` | 本部门及以下 或 本人 | ` #{#deptName} IN ( #{@sdss.getDeptAndChild( #user.deptId )} ) OR #{#userName} = #{#user.userId} ` |

模板里的内置对象：

- `#user`：当前登录用户 `LoginUser`（`#user.deptId`、`#user.userId`）。由
  `DataPermissionHelper` 自动塞进上下文。
- `#deptName` / `#userName`：来自 `@DataColumn.key`，会被替换为对应的 `value`（真实列名）。
- `@sdss`：Spring Bean `ISysDataScopeService`（系统数据权限服务），`getRoleCustom(roleId)`
  返回自定义角色绑定的部门 id 集合，`getDeptAndChild(deptId)` 返回某部门及其所有子部门 id。

每个枚举还有 `elseSql`（除 `ALL` 外都是 ` 1 = 0 `）：当某角色的模板**因当前注解列不匹配而无法渲染**时，
兜底拼 `1 = 0`（查不到任何行），属于「失败时收紧而非放开」的安全默认。

## 四、PlusDataPermissionHandler 工作原理

执行链路（一次带数据权限的查询）：

1. **AOP 设上下文**：方法被调用前，`DataPermissionAdvice#invoke` 读取方法（再回退到类/代理接口）
   上的 `@DataPermission`，`DataPermissionHelper.setPermission(...)` 写入线程级 `ThreadLocal`。
2. **拦截器触发**：`PlusDataPermissionInterceptor`（继承 MyBatis-Plus `BaseMultiTableInnerInterceptor`）
   在 `beforeQuery`（查询）/`beforePrepare`（更新、删除）里先判断：
   - `InterceptorIgnoreHelper.willIgnoreDataPermission(ms.getId())` → 命中忽略则直接返回；
   - `dataPermissionHandler.invalid()`（当前线程没有 `@DataPermission`）→ 返回，不改 SQL。
3. **拼过滤片段**：`PlusDataPermissionHandler#getSqlSegment` 取当前 `LoginUser`：
   - 如果 `LoginHelper.isSuperAdmin()`（超级管理员/租户管理员）→ **原样返回 where，不过滤**。
   - 否则 `buildDataFilter(...)`：遍历当前用户**参与计算的角色**，对每个角色按
     `DataScopeType.findCode(role.getDataScope())` 选模板，用 SpEL 渲染（`#user`、列名变量、`@sdss`），
     把各条件用 `OR`/`AND` 拼起来。任一角色是 `ALL` → 直接返回空串（放行）。
4. **括号包裹 + AND 注入**：渲染出的 `dataFilterSql` 被 `CCJSqlParserUtil.parseExpression` 解析为
   表达式，**单独用括号包住**（防止与原条件 `OR` 串味），再 `new AndExpression(where, parenthesis)`
   AND 进原 WHERE。最终 SQL 形如：`... WHERE 原条件 AND (dept_id IN (...) OR create_by = ...)`。
5. **收尾**：`finally` 里 `DataPermissionHelper.removePermission()` 清线程上下文，避免污染下个请求。

> 关键点：**SQL 是在 MyBatis 拦截器层、SQL 执行前自动改写的**，业务代码无需手写任何过滤条件——
> 你只负责在 Mapper/Service 上声明 `@DataColumn` 把「业务列」告诉框架。

### 角色与接口的绑定（6.x 增强）

6.x 不是「把用户所有角色一锅炖」，而是引入 `DataPermissionAccess`：处理器从当前请求 handler 上
读取 `@SaCheckPermission` / `@SaCheckRole`，得到本接口要求的权限标识/角色 key，再用
`LoginUser#getDataScopeRoleMap()` **只挑出与该接口权限匹配的角色**参与数据范围计算
（`scopeRoles(...)`）。当接口有权限约束但用户没有任何匹配角色且 `access.constrained()` 为真时，
直接返回 ` 1 = 0 `（看不到数据）。这意味着「同一个用户在不同接口下，生效的数据范围可能不同」。

## 五、代码示例（≥5）

### 示例 1：列表分页按「部门 + 本人」过滤（最常见模板）

```java
public interface OrderMapper extends BaseMapperPlus<Order, OrderVo> {

    @DataPermission({
        @DataColumn(key = "deptName", value = "dept_id"),
        @DataColumn(key = "userName", value = "create_by")
    })
    default Page<OrderVo> selectPageOrderList(Page<Order> page, Wrapper<Order> queryWrapper) {
        return this.selectVoPage(page, queryWrapper);
    }
}
```

角色 dataScope=3（本部门）时，框架自动改写为
`... AND (dept_id = #{user.deptId})`；dataScope=5（仅本人）时改写为
`... AND (create_by = #{user.userId})`。

### 示例 2：只按部门过滤（部门树、字典等无创建人语义的表）

```java
@DataPermission({
    @DataColumn(key = "deptName", value = "dept_id")
})
default List<DeviceVo> selectDeviceList(Wrapper<Device> queryWrapper) {
    return this.selectVoList(queryWrapper);
}
```

### 示例 3：部门列名不是 dept_id（跟着真实表结构走）

```java
// 角色表用 create_dept 记录归属部门，而非 dept_id
@DataPermission({
    @DataColumn(key = "deptName", value = "create_dept"),
    @DataColumn(key = "userName", value = "create_by")
})
default Page<RoleVo> selectPageRoleList(@Param("page") Page<Role> page,
                                        @Param(Constants.WRAPPER) Wrapper<Role> queryWrapper) {
    return this.selectVoPage(page, queryWrapper);
}
```

### 示例 4：类级别注解，整个 Mapper 统一过滤

```java
@DataPermission({
    @DataColumn(key = "deptName", value = "dept_id"),
    @DataColumn(key = "userName", value = "create_by")
})
public interface ContractMapper extends BaseMapperPlus<Contract, ContractVo> {
    // 本接口所有 default 方法 / selectXxx 都自动套用上面这套数据权限
}
```

### 示例 5：更新/删除也受控（默认用 AND 收紧）

```java
@DataPermission({
    @DataColumn(key = "deptName", value = "dept_id")
})
default int deleteByBizId(Long id) {
    // DELETE 走 beforePrepare 分支，joinStr 默认 AND：
    // DELETE FROM biz WHERE id = ? AND (dept_id = #{user.deptId})
    // 越权删除会因 AND 条件不满足而删 0 行
    return this.deleteById(id);
}
```

### 示例 6：临时忽略数据权限查全量（见第七节）

```java
// 查「我自己的资料」，必须忽略数据权限，否则按本部门过滤可能查不到本人
SysUserVo me = DataPermissionHelper.ignore(() -> userService.selectUserById(loginUserId));
```

## 六、与 MPJ 联表别名配合

当 SQL 给表起了别名（手写 SQL、MPJ `mybatis-plus-join` 的 `MPJLambdaWrapper`、或多表 JOIN），
最终 WHERE 里的列会带别名前缀。此时 **`@DataColumn.value` 必须写成带别名的全列名**，
否则 JSqlParser 解析出的过滤片段列名对不上实际 SQL，要么报歧义错误，要么过滤错表。

```java
// 联表：订单 o 左连客户 c，按订单表的部门 + 创建人过滤
// SELECT ... FROM biz_order o LEFT JOIN biz_customer c ON ...
@DataPermission({
    @DataColumn(key = "deptName", value = "o.dept_id"),   // 别名 o.
    @DataColumn(key = "userName", value = "o.create_by")
})
default Page<OrderJoinVo> selectJoinPage(Page<Order> page, MPJLambdaWrapper<Order> wrapper) {
    return ...;
}
```

要点：

- 别名前缀（`o.` / `d.` / `u.`）以你 JOIN 语句里实际写的别名为准，大小写、拼写要一致。
- 多表都需过滤时，可在数组里给多列分别加别名条件（不同 `key` 或重复 `key` 配不同 `value`）。
- 单表查询（无 JOIN、无别名）就写裸列名 `dept_id`，**不要画蛇添足加别名**，否则反而对不上。
- 子查询/UNION：`PlusDataPermissionInterceptor#processSelect` 已处理 `SetOperationList`，
  每个子 SELECT 都会被套数据权限，但别名仍需各自对齐。

## 七、临时忽略数据权限（查全量）

某些场景必须绕过数据权限拿全量数据：查自己的资料/改密码、系统定时任务统计、跨部门导出报表等。
6.x 统一入口是 `DataPermissionHelper.ignore(...)`，**有 `Runnable` 和 `Supplier<T>` 两个重载**：

```java
import org.dromara.common.mybatis.helper.DataPermissionHelper;

// 有返回值（真实源码：SysUserController 查当前用户）
SysUserVo user = DataPermissionHelper.ignore(() -> userService.selectUserById(loginUser.getUserId()));

// 无返回值（真实源码：SysProfileController 改资料 / 重置密码）
int rows = DataPermissionHelper.ignore(() -> userService.updateUserProfile(user));
DataPermissionHelper.ignore(() -> userService.resetUserPwd(userId, BCrypt.hashpw(newPwd)));
```

原理：`ignore` 内部走 `DataPermissionIgnoreContext.enable()`，借助 MyBatis-Plus 的
`InterceptorIgnoreHelper`/`IgnoreStrategy` 在当前线程**栈式**地打开「忽略数据权限」开关，
`finally` 里 `disable()` **恢复到进入前的状态**（支持嵌套，不会误关外层）。拦截器在
`beforeQuery`/`beforePrepare` 一开始就检查 `willIgnoreDataPermission(ms.getId())`，命中即跳过改写。

> ⚠️ `ignore` 只在 lambda 作用域内有效，且必须包住「实际触发 SQL 的那一行」。把查询写在
> lambda 外、只在 lambda 里赋值，是忽略不掉的——SQL 在 lambda 外执行时上下文已恢复。

设置自定义 SpEL 变量（高级）：`DataPermissionHelper.setVariable("key", value)` 可往上下文里
塞自定义变量供模板使用（扩展数据范围类型时会用到）。

## 八、排查不生效

| 现象 | 根因 | 处理 |
|------|------|------|
| 完全不过滤，能看到全部数据 | 当前用户是超级管理员/租户管理员 | `LoginHelper.isSuperAdmin()` 为真时**设计上就不过滤**，换普通用户测 |
| 完全不过滤 | 角色 `data_scope = 1`（ALL） | 命中 ALL 直接放行，去 `sys_role` 改角色数据范围 |
| 完全不过滤 | 方法/类上**没有** `@DataPermission`，或注解被加在 DAO 上（本框架无 DAO） | 注解必须在 Mapper 方法/类或被 AOP 代理的 Service 上 |
| SQL 报「数据权限解析异常」 | `value` 列名/别名拼错，JSqlParser 解析失败 | 核对 `value` 与最终 SQL 列名（含别名）逐字一致 |
| 抛「key与value长度不匹配」 | `@DataColumn` 的 `key[]` 与 `value[]` 数组长度不等 | 一个 `key` 配一个 `value`，成对出现 |
| 抛「角色数据范围异常 => x」 | `sys_role.data_scope` 的值不在 1~6 枚举内 | 修正为合法 code（见第三节表） |
| 过滤了，但过滤错列/联表查歧义 | 有别名却写了裸列名（或反之） | 联表写 `o.dept_id`，单表写 `dept_id`，与 SQL 对齐 |
| 该看到的本人数据反而看不到 | 角色是 `DEPT`，但表只有 `create_by` 没 `dept_id`，模板兜底拼了 `1=0` | 该接口改用 `SELF`/`DEPT_AND_CHILD_OR_SELF`，或补 `deptName` 列映射 |
| 忽略不生效，仍被过滤 | 触发 SQL 的代码不在 `ignore(() -> ...)` lambda 内 | 把真正执行查询的调用整体包进 lambda |
| 某接口数据范围和别处不一样 | 6.x 按 `@SaCheckPermission` 绑定角色（`DataPermissionAccess`） | 正常行为：只有与接口权限匹配的角色参与计算 |

排查顺序建议：**先看是不是超管 → 再看角色 dataScope → 再看注解有没有/位置对不对 →
最后核对列名别名是否对齐**。可临时打开 SQL 日志（`SqlLogInterceptor`）看改写后的真实 SQL。

## 九、最佳实践

1. **列名跟表走，别照抄**：`SysUser` 用 `dept_id`，`SysRole` 用 `create_dept`——`value` 永远以
   目标表真实列为准，不要无脑复制别的 Mapper。
2. **部门维度 + 本人维度成对配**：业务表通常同时给 `deptName→dept_id` 和 `userName→create_by`
   两个 `@DataColumn`，这样无论角色是部门范围还是仅本人都能正确过滤。
3. **联表必带别名**：用了 MPJ/JOIN 就给 `value` 加表别名前缀，且与 JOIN 语句一致。
4. **忽略要精准**：只在确需全量的接口用 `DataPermissionHelper.ignore`，且包住执行 SQL 的那一行；
   不要图省事整个 Service 关数据权限。
5. **更新/删除也要加**：数据隔离不只是「看」，删除/更新接口同样挂 `@DataPermission`，默认 `AND`
   兜底能挡住越权改删。
6. **优先类级别复用**：一个 Mapper 里多数方法用同一套列映射时，把 `@DataPermission` 提到接口类上。
7. **新增数据范围类型**：扩展时改 `DataScopeType` 枚举 + 在 `ISysDataScopeService` 实现对应
   `@sdss.xxx` 方法，必要时用 `DataPermissionHelper.setVariable` 注入模板变量；不要绕过框架手拼 SQL。
8. **与 security-guard 分工**：数据权限管「行级范围」，功能权限（能不能访问接口/按钮）交给
   Sa-Token 的 `@SaCheckPermission`，二者叠加使用，不要混为一谈。
