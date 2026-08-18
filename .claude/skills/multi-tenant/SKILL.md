---
name: multi-tenant
description: |
  base-dev-framework6-java多租户（SaaS 数据隔离）开发指南。讲清原版多租户的真实
  实现机制：MyBatis-Plus 的 TenantLineInnerInterceptor 插件 + 表的 tenant_id 列自动拼接
  过滤条件，配合 TenantHelper 做动态切换 / 忽略隔离，配合 sys_tenant、sys_tenant_package
  做租户与套餐管理。所有约定以 ruoyi-common-tenant 模块、MybatisPlusConfig 拦截器链、
  backend/java/script/sql 建表脚本的真实代码为准。

  触发场景：
  - 新建业务表 / 业务模块，需要让数据按租户隔离（自动只查当前租户的数据）。
  - 用 TenantHelper 临时忽略租户过滤查全量数据，或动态切换到指定租户执行一段逻辑。
  - 排查"租户隔离不生效"或"查不到别的租户数据是正常还是 Bug"。

  触发词：多租户、租户隔离、tenant_id、TenantHelper、租户切换、租户配置、ignore、动态租户、
  排除表、sys_tenant、租户套餐、DEFAULT_TENANT_ID、数据隔离、TenantLineInnerInterceptor、
  TenantEntity、租户插件、SaaS、租户上下文

  本项目 base-dev-framework6-java 遵循框架约定！包名 org.dromara.*；三层无 DAO；
  原版多租户走"租户插件 + tenant_id 列自动过滤"，不是靠改 SQL 手写 where。
---

# 多租户（数据隔离）开发（base-dev-framework6-java）

## 一、概述：原版多租户的真实实现机制

本项目 的多租户**不是**通过"每张表手写 `where tenant_id = ?`"实现的，而是
依赖 **MyBatis-Plus 官方的 `TenantLineInnerInterceptor` 租户行级插件**：插件在 SQL 执行前
解析 AST，**自动**为带 `tenant_id` 列的表追加 `tenant_id = '当前租户'` 过滤条件，
INSERT 时自动回填 `tenant_id`。开发者写普通 CRUD，隔离由插件透明完成。

整套能力由 `ruoyi-common-tenant` 模块提供，核心三块：

| 组成 | 真实位置 / 类 | 职责 |
|------|--------------|------|
| 租户行级插件 | `TenantLineInnerInterceptor`（MyBatis-Plus 自带）+ 自定义 `TenantLineHandler` | 自动拼 `tenant_id` 过滤 / 回填 |
| 租户上下文工具 | `org.dromara.common.tenant.helper.TenantHelper` | 动态切换、忽略隔离、取当前租户 |
| 租户常量 | `TenantConstants.DEFAULT_TENANT_ID`（默认 `"000000"`） | 超管 / 默认租户标识 |
| 租户数据表 | `sys_tenant`、`sys_tenant_package` | 租户与套餐管理 |

### Entity 基类：BaseEntity vs TenantEntity（核对源码，别想当然）

> 🔴 这是最容易讲错的点，必须以源码为准，**不要照搬定制版的"Entity 默认继承 TenantEntity"论**。

本仓库 `ruoyi-common-mybatis` 的 **`BaseEntity` 只有 5 个公共字段**
（`createDept` / `createBy` / `createTime` / `updateBy` / `updateTime`），
**不含 `tenantId`**（已核对 `BaseEntity.java` 源码）：

```java
// ruoyi-common-mybatis/.../core/domain/BaseEntity.java（真实源码节选）
public class BaseEntity implements Serializable {
    @TableField(fill = FieldFill.INSERT)
    private Long createDept;
    @TableField(fill = FieldFill.INSERT)
    private Long createBy;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updateBy;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
```

原版多租户在 `ruoyi-common-tenant` 中提供 **`TenantEntity extends BaseEntity`**，
在 BaseEntity 五字段基础上**多一个 `tenantId` 字段**：

```java
// ruoyi-common-tenant 提供的 TenantEntity（原版设计）
public class TenantEntity extends BaseEntity {
    /** 租户编号，插件自动填充，业务代码不要手动 set */
    private String tenantId;
}
```

**两者关系**：`TenantEntity` 是 `BaseEntity` 的**子类**，二者是"是否携带租户字段"的差别，
不是替代关系。**需要租户隔离的业务实体继承 `TenantEntity`，不需要隔离的继承 `BaseEntity`**。
`tenantId` 字段值由租户插件在 INSERT 时自动回填，查询时自动作为过滤条件，
**业务代码不要手动 set `tenantId`，也不要把它写进 BO 的查询条件**。

### ⚠️ 本地副本现状核对（重要，避免找不到类时误判为 Bug）

经核对本仓库源码，当前本项目（base-dev-framework6-java）疑似裁剪掉了多租户模块：

- `ruoyi-common` 下**未找到** `ruoyi-common-tenant` 模块、`TenantHelper`、`TenantEntity`、`TenantConstants`。
- `MybatisPlusConfig.mybatisPlusInterceptor()` 拦截器链里**只注册了**数据权限 / 分页 / 乐观锁三个插件，
  `TenantLineInnerInterceptor` **仅出现在该类底部的注释说明里**（"TenantLineInnerInterceptor 多租户插件"），**没有 addInnerInterceptor 进链**。
- `backend/java/script/sql/ry_workflow.sql` 等工作流表仍保留 `tenant_id varchar(40) DEFAULT NULL COMMENT '租户id'` 列（建表层预留）。

> 结论：本副本当前**未启用多租户**（插件未进链 = 不会自动过滤）。本技能下文描述的是
> **标准多租户机制**——这是框架的真实设计。若本地要启用，
> 需补回 `ruoyi-common-tenant` 依赖并把租户插件注册进拦截器链（见"六、启用与排查"）。
> **判断隔离是否生效，第一步永远是确认插件是否真的在 `mybatisPlusInterceptor()` 里进链了。**

---

## 二、建业务表如何支持租户隔离

让一张业务表参与租户隔离，需要两步——**建表加列** + **实体继承 TenantEntity**：

### 1. 建表：加 tenant_id 列

```sql
CREATE TABLE `biz_order` (
  `id`        bigint(20)   NOT NULL COMMENT '主键',
  `tenant_id` varchar(40)  DEFAULT '000000' COMMENT '租户编号',  -- 🔴 关键：参与隔离必须有这列
  `order_no`  varchar(64)  NOT NULL COMMENT '订单号',
  `amount`    decimal(10,2) DEFAULT NULL COMMENT '金额',
  `create_dept` bigint(20) DEFAULT NULL,
  `create_by`   bigint(20) DEFAULT NULL,
  `create_time` datetime   DEFAULT NULL,
  `update_by`   bigint(20) DEFAULT NULL,
  `update_time` datetime   DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB COMMENT='业务订单表';
```

要点：列名固定为 `tenant_id`（与插件 `TenantLineHandler.getTenantIdColumn()` 约定一致），
类型 `varchar(40)`，与原版 SQL 脚本里 `tenant_id varchar(40)` 完全一致。

### 2. 实体继承 TenantEntity（而非 BaseEntity）

```java
package org.dromara.biz.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import org.dromara.common.tenant.core.TenantEntity; // 🔴 继承 TenantEntity 才带 tenantId
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("biz_order")
public class BizOrder extends TenantEntity {

    private Long id;
    private String orderNo;
    private java.math.BigDecimal amount;

    // 注意：不要在这里再声明 tenantId，它在父类 TenantEntity 里，插件自动维护
}
```

之后写普通 CRUD（见 `crud-development` 技能），**无需任何额外代码**，
查询自动只返回当前租户数据，新增自动回填 `tenant_id`。

> 不想隔离的表（如全局字典、超管配置），实体继续继承 `BaseEntity` 即可，
> 或把表名加入 `tenant.excludes` 排除列表（见第五节）。

---

## 三、TenantHelper 用法（动态切换 / 忽略 / 取租户）

`org.dromara.common.tenant.helper.TenantHelper` 是操作租户上下文的唯一入口，
所有方法都是静态方法。核心三组能力：

### 1. 获取当前租户 / 判断是否启用

```java
// 取当前请求线程绑定的租户编号
String tenantId = TenantHelper.getTenantId();

// 判断多租户功能是否启用（即 tenant.enable=true 且插件已加载）
boolean enable = TenantHelper.isEnable();
```

### 2. ignore —— 临时忽略租户过滤，查全量数据

适用于"超管后台跨租户统计""定时任务遍历所有租户数据"等场景。
有 `Runnable`（无返回值）和 `Supplier`（有返回值）两种重载：

```java
// 无返回值：在这段逻辑内忽略租户隔离
TenantHelper.ignore(() -> {
    // 这里查到的是所有租户的数据，不会被自动加 tenant_id 过滤
    bizOrderMapper.selectList(null);
});

// 有返回值：返回全量统计结果
Long total = TenantHelper.ignore(() -> bizOrderMapper.selectCount(null));
```

> ignore 是**自动 try-finally 回收**的：lambda 执行完毕后租户上下文自动恢复，
> 不会污染后续请求。**优先用 lambda 形式**，不要手动开关忽略标志位再忘了关。

### 3. dynamic —— 动态切换到指定租户执行

适用于"超管帮某个租户初始化数据""跨租户搬运数据"等场景：

```java
// 切换到租户 "100001" 执行一段逻辑，执行后自动切回原租户
TenantHelper.dynamic("100001", () -> {
    BizOrder order = new BizOrder();
    order.setOrderNo("INIT-001");
    bizOrderMapper.insert(order); // 自动回填 tenant_id = 100001
});

// 有返回值的动态切换
Long count = TenantHelper.dynamic("100001", () -> bizOrderMapper.selectCount(null));
```

底层成对方法（一般用上面的 lambda 封装，不直接手调）：

```java
TenantHelper.setDynamic("100001"); // 设置动态租户
try {
    // ... 在 100001 租户下执行
} finally {
    TenantHelper.clearDynamic();    // 🔴 必须 finally 清理，否则污染线程后续请求
}
```

---

## 四、忽略与切换的区别（别混用）

| 能力 | 方法 | 效果 | 典型场景 |
|------|------|------|---------|
| 忽略隔离 | `TenantHelper.ignore(...)` | 这段逻辑内**不加任何** `tenant_id` 过滤，查所有租户 | 超管跨租户统计、全局清理 |
| 动态切换 | `TenantHelper.dynamic(id, ...)` | 这段逻辑内**强制按指定租户** `id` 过滤 / 回填 | 超管代某租户操作、跨租户搬数据 |
| 默认（不调） | 无 | 按**当前登录用户**所属租户自动过滤 | 普通业务请求 |

记忆法：`ignore` = "看全部"，`dynamic` = "扮演某个租户"，默认 = "只看自己租户"。

---

## 五、租户排除表配置（某些表不隔离）

不是所有表都该隔离——全局字典、租户表自身、超管配置等需要**所有租户共享**。
这类表通过 `application.yml` 的 `tenant.excludes` 排除，插件遇到这些表名时**不追加** `tenant_id` 过滤：

```yaml
# application.yml / application-common.yml
tenant:
  # 是否开启多租户
  enable: true
  # 🔴 租户排除表：这些表不参与租户隔离（所有租户共享 / 由 tenant_id 区分但不自动过滤）
  excludes:
    - sys_tenant           # 租户表自身，必须排除否则无法管理租户
    - sys_tenant_package   # 租户套餐表
    - sys_dict_type        # 全局字典
    - sys_dict_data
    - sys_config           # 全局参数
    - sys_menu             # 菜单（全租户共享一套）
```

> 排除规则有两类：① 表里**根本没有** `tenant_id` 列（插件本就不会处理，可不配但配上更清晰）；
> ② 表里**有** `tenant_id` 列但不希望自动过滤（如 `sys_tenant`），**必须**配进 excludes。
> 改完 excludes 需**重启**应用，插件配置在启动时一次性加载。

### sys_tenant / sys_tenant_package 与 DEFAULT_TENANT_ID

- `sys_tenant`：租户主表，存租户编号、企业名、联系人、过期时间、绑定的套餐 `package_id` 等。
- `sys_tenant_package`：租户套餐表，定义一套**菜单权限集合**（`menu_ids`），新建租户时按套餐初始化菜单。
- `TenantConstants.DEFAULT_TENANT_ID`（值 `"000000"`）：**默认 / 超管租户**，平台超管属于此租户，
  通常拥有跨租户管理能力。判断"是否超管租户"用 `DEFAULT_TENANT_ID.equals(TenantHelper.getTenantId())`，
  **不要硬编码字符串 `"000000"`**。

---

## 六、排查"租户隔离不生效"

按以下顺序自查（从最常见到最少见）：

1. **插件是否进链**（本副本最可能的根因）：打开 `MybatisPlusConfig.mybatisPlusInterceptor()`，
   确认 `interceptor.addInnerInterceptor(tenantLineInnerInterceptor())` **真的在调用链里**。
   本地副本目前只有注释、没进链 = 永远不过滤。
2. **`tenant.enable` 是否为 true**：`TenantHelper.isEnable()` 返回 false 说明配置没开。
3. **表有没有 `tenant_id` 列**：插件只对有该列的表生效，缺列直接不过滤。
4. **实体是否继承 `TenantEntity`**：只继承 `BaseEntity` 不带 `tenantId`，INSERT 不会回填。
5. **表是否被误加进 `excludes`**：在排除表里就不会过滤，检查 yml。
6. **是不是包在 `TenantHelper.ignore(...)` 里**：忽略块内本来就查全量，这是预期行为不是 Bug。
7. **多数据源 / 原生 SQL**：插件解析不了的复杂 SQL（如 `union`、子查询、`exists`）可能漏过滤，
   用 `selectList` + Wrapper 等标准方式，避免大段手写 XML SQL。

排查"查不到别租户数据"反向场景：如果**期望**跨租户却查不到，多半是没用 `ignore`/`dynamic`，
属于隔离正常工作——把跨租户逻辑包进 `TenantHelper.ignore(...)` 即可。

---

## 七、完整代码示例

### 示例 1：标准隔离业务（什么都不用做）

```java
@Service
@RequiredArgsConstructor
public class BizOrderServiceImpl implements IBizOrderService {

    private final BizOrderMapper baseMapper;

    @Override
    public List<BizOrderVo> queryList(BizOrderBo bo) {
        // 普通查询，插件自动加 tenant_id = 当前租户，无需任何额外代码
        LambdaQueryWrapper<BizOrder> lqw = Wrappers.lambdaQuery();
        lqw.eq(StringUtils.isNotBlank(bo.getOrderNo()), BizOrder::getOrderNo, bo.getOrderNo());
        return baseMapper.selectVoList(lqw);
    }
}
```

### 示例 2：超管后台跨租户统计

```java
@Override
public Map<String, Long> countAllTenants() {
    // 忽略租户隔离，统计全平台订单总数
    return TenantHelper.ignore(() -> {
        Long total = baseMapper.selectCount(null);
        Long today = baseMapper.selectCount(
            Wrappers.<BizOrder>lambdaQuery().ge(BizOrder::getCreateTime, LocalDate.now().atStartOfDay()));
        return Map.of("total", total, "today", today);
    });
}
```

### 示例 3：超管代指定租户初始化数据

```java
@Override
public void initDataForTenant(String tenantId) {
    // 动态切换到目标租户，插入的数据 tenant_id 自动 = tenantId
    TenantHelper.dynamic(tenantId, () -> {
        BizOrder demo = new BizOrder();
        demo.setOrderNo("WELCOME-" + tenantId);
        demo.setAmount(BigDecimal.ZERO);
        baseMapper.insert(demo);
    });
}
```

### 示例 4：定时任务遍历所有租户

```java
@Scheduled(cron = "0 0 1 * * ?")
public void dailyJobForEachTenant() {
    // 1) 先 ignore 取出所有租户编号
    List<String> tenantIds = TenantHelper.ignore(() ->
        sysTenantMapper.selectObjs(
            Wrappers.<SysTenant>lambdaQuery().select(SysTenant::getTenantId))
            .stream().map(String::valueOf).toList());
    // 2) 逐个 dynamic 切到该租户跑业务
    for (String tid : tenantIds) {
        TenantHelper.dynamic(tid, () -> doDailyStatistics());
    }
}
```

### 示例 5：判断当前是否超管（默认）租户

```java
public boolean isSuperTenant() {
    // 🔴 用常量比较，不要硬编码 "000000"
    return TenantConstants.DEFAULT_TENANT_ID.equals(TenantHelper.getTenantId());
}
```

---

## 八、常见错误对比

### 错误 1：手动 set tenantId

```java
// ❌ 错误：手动维护 tenant_id，破坏插件自动回填，跨租户写入风险
BizOrder order = new BizOrder();
order.setTenantId("100001");   // 不要这样！
baseMapper.insert(order);

// ✅ 正确：普通插入，插件自动按当前租户回填；要写别的租户用 dynamic
baseMapper.insert(order);                                  // 当前租户
TenantHelper.dynamic("100001", () -> baseMapper.insert(order)); // 指定租户
```

### 错误 2：用 setDynamic 后忘了 clear

```java
// ❌ 错误：没有 finally，异常时租户上下文残留，污染线程池后续请求
TenantHelper.setDynamic("100001");
doSomething();                  // 若抛异常，下面 clear 不执行
TenantHelper.clearDynamic();

// ✅ 正确：直接用 lambda 形式，框架自动 try-finally 回收
TenantHelper.dynamic("100001", () -> doSomething());
```

### 错误 3：硬编码默认租户字符串

```java
// ❌ 错误：魔法值散落各处，将来改默认租户编号要全局搜
if ("000000".equals(TenantHelper.getTenantId())) { ... }

// ✅ 正确：统一用常量
if (TenantConstants.DEFAULT_TENANT_ID.equals(TenantHelper.getTenantId())) { ... }
```

### 错误 4：把该隔离的表加进 excludes

```yaml
# ❌ 错误：业务表被排除，所有租户互相看到对方订单，数据泄露
tenant:
  excludes:
    - biz_order      # 业务表不该排除！

# ✅ 正确：excludes 只放全局共享表（字典 / 菜单 / 租户表自身）
tenant:
  excludes:
    - sys_dict_data
    - sys_tenant
```

---

## 九、最佳实践

1. **隔离与否在建模阶段定**：新表设计时就决定继承 `TenantEntity`（隔离）还是 `BaseEntity`（全局），
   隔离表一律加 `tenant_id varchar(40)` 列，与原版脚本保持一致。
2. **永远用 lambda 形式的 ignore / dynamic**，不手动 set/clear，杜绝上下文泄漏。
3. **跨租户操作集中在超管 / 定时任务**，普通业务接口**禁止**调 `ignore`，防止越权看到别租户数据。
4. **判超管租户用 `TenantConstants.DEFAULT_TENANT_ID`**，不硬编码 `"000000"`。
5. **excludes 最小化**：只排除真正全局共享的表；新增全局表时同步更新 excludes 并重启。
6. **复杂 SQL 警惕漏过滤**：优先标准 Wrapper / `selectVoList`，避免大段手写 XML，
   插件对 union / 嵌套子查询的支持有限，必要时手动加 `tenant_id` 条件兜底。
7. **本副本若要启用多租户**：补回 `ruoyi-common-tenant` 依赖 → 在 `MybatisPlusConfig`
   把 `TenantLineInnerInterceptor` `addInnerInterceptor` 进链（注意顺序：通常在分页插件之前）→
   实体改继承 `TenantEntity` → 配 `tenant.enable=true` 与 `excludes` → 重启验证。
8. **6.x 铁律不变**：包名 `org.dromara.*`；三层无 DAO，租户逻辑落在 Service/Mapper；
   禁用 `plus.ruoyi` / `com.ruoyi` 包名、禁用 `buildQueryWrapper` / `PlusLambdaQuery` /
   `likeCast` 等定制版概念；逻辑删除字段是 `del_flag`（不是 `is_deleted`）。

---

## 十、引用的真实源文件

- `backend/java/ruoyi-common/ruoyi-common-mybatis/src/main/java/org/dromara/common/mybatis/config/MybatisPlusConfig.java`
  —— 拦截器链（确认租户插件当前仅在注释、未进链）
- `backend/java/ruoyi-common/ruoyi-common-mybatis/src/main/java/org/dromara/common/mybatis/core/domain/BaseEntity.java`
  —— BaseEntity 五字段、无 tenantId
- `backend/java/script/sql/ry_workflow.sql` —— 工作流表保留 `tenant_id varchar(40)` 列
- 框架设计（ruoyi-common-tenant 模块）：`TenantHelper`、`TenantEntity`、
  `TenantConstants.DEFAULT_TENANT_ID`、`TenantLineInnerInterceptor`、`sys_tenant` / `sys_tenant_package`
