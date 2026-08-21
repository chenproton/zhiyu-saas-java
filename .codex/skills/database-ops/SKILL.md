---
name: database-ops
description: |
  base-dev-framework6-java数据库操作指南：建表规范、字段约定、MyBatis-Plus CRUD、字典/菜单管理、多数据源切换、完整 SQL 日志排查。当需要进行数据库相关操作时自动使用此 Skill。

  触发场景：
  - 设计新表 / 修改表结构 / 编写 DDL（建表、加字段、加索引）
  - 编写 MyBatis-Plus 查询（selectVoList / selectVoPage / QueryBuilder.lambda）或决定何时补 XML 联表
  - 管理字典（sys_dict_type / sys_dict_data）、查菜单（sys_menu）、查最大 ID
  - 多数据源 @DS 切换、跨库（MySQL / Oracle / PostgreSQL / SQL Server）方言适配
  - 开启完整 SQL 日志排查线上问题（mybatis-plus.sql-log.enabled）

  触发词：数据库、MySQL、SQL、表、字段、索引、字典、建表、DDL、del_flag、雪花ID、dynamic-datasource、多数据源、Oracle、PostgreSQL、SQL Server、SHOW、DESC、selectVoPage、QueryBuilder、@DS、sys_dict、sys_menu、SqlLogInterceptor
---

# 数据库操作（base-dev-framework6-java）

> 本技能面向 **base-dev-framework6-java**（包名 `org.dromara`，Spring Boot 4 / Java 21 / MyBatis-Plus 3.5.16）。
> 决策顺序（冲突时）：① 当前模块最近似实现 → ② `ruoyi-common-mybatis` 统一约定 → ③ 代码生成器 SQL/Java 模板 → ④ 通用 MyBatis-Plus 习惯。
> 真实建表 SQL 见 `script/sql/ry_vue.sql`，方言模板见 `ruoyi-modules/ruoyi-gen/src/main/resources/fm/sql/*.sql.ftl`。

## 一、概述

| 维度 | 框架做法 |
|------|------|
| 主键策略 | **雪花 ID（BIGINT）**，业务层显式赋值或由框架生成；**禁止 AUTO_INCREMENT** |
| 主键注解 | `@TableId`（默认 `IdType.ASSIGN_ID` 雪花算法） |
| 审计字段 | `create_dept` / `create_by` / `create_time` / `update_by` / `update_time`（由 `BaseEntity` + 自动填充统一管理） |
| 逻辑删除 | **`del_flag`**（char(1)，`'0'` 正常 / `'1'` 删除）→ Entity 上 `@TableLogic` |
| 乐观锁 | `version`（int，默认 0）→ Entity 上 `@Version` |
| 多租户 | `tenant_id`（开启租户插件时各业务表带，原版默认未开） |
| ORM | MyBatis-Plus 3.5.16 + MPJ（yulichang）1.5.7 |
| 查询入口 | `BaseMapperPlus<Entity, Vo>` 的 `selectVoList / selectVoPage`，条件用 `QueryBuilder.lambda(Entity.class)` |
| 对象转换 | MapStruct-Plus：`MapstructUtils.convert(bo, Entity.class)`（不用 BeanUtils） |
| 多数据库 | MySQL（主）/ Oracle / PostgreSQL / SQL Server，`DataBaseHelper.getDataBaseType()` 选方言 |
| 多数据源 | dynamic-datasource 4.5.0，`@DS("库名")` 切换 |
| 完整 SQL 日志 | `SqlLogInterceptor`（`mybatis-plus.sql-log.enabled=true`，输出可直接执行的回填 SQL） |

> ⚠️ **本项目不是早期 ruoyi-vue / 也不是 ruoyi-plus-uniapp**：逻辑删除字段是 **`del_flag`** 不是 `is_deleted`；用户手机号列是 **`phone_number`** 不是 `phone`；包名是 `org.dromara` 不是 `plus.ruoyi`；查询条件不用 `PlusLambdaQuery`，用 `QueryBuilder.lambda`。

## 二、标准建表模板 SQL（MySQL）

以下模板对齐 `script/sql/ry_vue.sql` 中 `sys_*` 表与代码生成器约定，新业务表照此写：

```sql
-- ----------------------------
-- 业务表：客户信息表
-- ----------------------------
create table biz_customer
(
    customer_id   bigint(20)      not null                   comment '客户ID',
    dept_id       bigint(20)      default null               comment '部门ID（数据权限用）',
    customer_name varchar(50)     not null                   comment '客户名称',
    phone_number  varchar(11)     default ''                 comment '联系电话',
    status        char(1)         default '0'                comment '状态（0正常 1停用）',
    -- 乐观锁（按需，参考 test_demo / test_tree）
    version       int(4)          default 0                  comment '版本号',
    -- 审计字段（顺序与 BaseEntity 对齐，禁改名）
    create_dept   bigint(20)      default null               comment '创建部门',
    create_by     bigint(20)      default null               comment '创建者',
    create_time   datetime                                   comment '创建时间',
    update_by     bigint(20)      default null               comment '更新者',
    update_time   datetime                                   comment '更新时间',
    -- 逻辑删除（原版固定 del_flag，char(1) '0'/'1'）
    del_flag      char(1)         default '0'                comment '删除标志（0代表存在 1代表删除）',
    remark        varchar(500)    default null               comment '备注',
    primary key (customer_id),
    key idx_biz_customer_dept_id (dept_id),
    key idx_biz_customer_name    (customer_name)
) engine=innodb comment = '客户信息表';
```

要点：
- **主键 BIGINT、不带 `auto_increment`**：原版主键是雪花 ID，由后端写入。生成器/初始化数据里 ID 形如 `1761000000000000100`。
- **审计 5 字段一律照抄**：`create_dept / create_by / create_time / update_by / update_time`，类型与注释与 `sys_*` 表保持一致；`create_by / update_by` 是 `bigint`（存用户 ID），不是用户名字符串。
- **逻辑删除列名固定 `del_flag`**，`char(1)`，`default '0'`。`test_demo` 里出现 `del_flag int` 是历史写法，新表统一用 `char(1)`。
- **索引命名**：`idx_{表名}_{列}`，外键列（如 `dept_id`、`parent_id`）建普通索引，参考 `idx_sys_user_dept_id`。
- **每列必有中文 `comment`**，表必有 `comment`；编码用 InnoDB（不在列上写字符集，库级统一 utf8mb4）。

### 多租户表（仅在开启租户插件时）

开启 MyBatis-Plus 租户插件后，业务表需加 `tenant_id`（放在最前或审计字段前），框架自动注入租户条件：

```sql
    tenant_id     varchar(20)     default '000000'           comment '租户编号',
```

> 原版默认 **未开启**多租户。是否加 `tenant_id` 以仓库当前是否启用租户插件为准，不要无脑加。

## 三、字段规范表

| 字段语义 | 列名 | 类型 | 默认值 | Entity 注解 | 说明 |
|---------|------|------|--------|------------|------|
| 主键 | `xxx_id` / `id` | bigint(20) | — | `@TableId` | 雪花 ID，**禁 AUTO_INCREMENT** |
| 创建部门 | `create_dept` | bigint(20) | null | `@TableField(fill = INSERT)` | BaseEntity 自动填充 |
| 创建者 | `create_by` | bigint(20) | null | `@TableField(fill = INSERT)` | 存用户 ID |
| 创建时间 | `create_time` | datetime | — | `@TableField(fill = INSERT)` | `LocalDateTime` |
| 更新者 | `update_by` | bigint(20) | null | `@TableField(fill = INSERT_UPDATE)` | 存用户 ID |
| 更新时间 | `update_time` | datetime | — | `@TableField(fill = INSERT_UPDATE)` | `LocalDateTime` |
| 逻辑删除 | `del_flag` | char(1) | '0' | `@TableLogic` | '0'正常 '1'删除 |
| 乐观锁 | `version` | int(4) | 0 | `@Version` | 按需 |
| 多租户 | `tenant_id` | varchar(20) | '000000' | （插件自动） | 开启租户时 |
| 状态 | `status` | char(1) | '0' | — | 配字典 `sys_normal_disable` |
| 部门（权限） | `dept_id` | bigint(20) | null | — | `@DataPermission` 用 |
| 联系电话 | `phone_number` | varchar(11) | '' | — | 原版 sys_user 用此列名（**非 `phone`**） |

对应 Entity（节选，继承 `BaseEntity` 后审计 5 字段无需重复声明）：

```java
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("biz_customer")
public class Customer extends BaseEntity {

    /** 客户ID */
    @TableId(value = "customer_id")
    private Long customerId;

    /** 部门ID */
    private Long deptId;

    /** 客户名称 */
    private String customerName;

    /** 状态（0正常 1停用） */
    private String status;

    /** 版本号（乐观锁） */
    @Version
    private Integer version;

    /** 删除标志（0代表存在 1代表删除） */
    @TableLogic
    private String delFlag;
}
```

> `BaseEntity`（`org.dromara.common.mybatis.core.domain.BaseEntity`）已声明 `createDept/createBy/createTime/updateBy/updateTime` 并标注自动填充，业务 Entity **不要再重复定义**这 5 个字段。

## 四、MyBatis-Plus CRUD 示例

Mapper 默认形态 `extends BaseMapperPlus<Entity, Vo>`，直接拿到 `selectVoList / selectVoPage / selectVoById / selectVoOne` 等"查实体、返 VO"的能力，无需手写 entity→vo 映射：

```java
public interface CustomerMapper extends BaseMapperPlus<Customer, CustomerVo> {
}
```

### 4.1 列表查询（返回 VO 列表）

```java
@Override
public List<CustomerVo> queryList(CustomerBo bo) {
    return customerMapper.selectVoList(buildQueryWrapper(bo));
}

/** 构建查询条件：新代码统一用 QueryBuilder.lambda + IfText/IfPresent 系列 */
private LambdaQueryWrapper<Customer> buildQueryWrapper(CustomerBo bo) {
    Map<String, Object> params = bo.getParams();
    return QueryBuilder.lambda(Customer.class)
        .likeIfText(Customer::getCustomerName, bo.getCustomerName())
        .eqIfText(Customer::getStatus, bo.getStatus())
        .eqIfPresent(Customer::getDeptId, bo.getDeptId())
        // 日期范围统一从 bo.getParams() 取 beginTime/endTime
        .betweenParams(Customer::getCreateTime, params, "beginTime", "endTime")
        .orderByDesc(Customer::getCreateTime)
        .build();
}
```

条件辅助方法命名固定，**不要退回手写 `if (StringUtils.isNotBlank(...))` 套壳**：
`eqIfText` / `likeIfText` / `eqIfPresent` / `neIfPresent` / `betweenIfPresent` / `betweenParams` / `inIfNotEmpty` / `findInSetIfPresent`。

### 4.2 分页查询（返回 PageResult<Vo>）

```java
@Override
public PageResult<CustomerVo> queryPageList(CustomerBo bo, PageQuery pageQuery) {
    LambdaQueryWrapper<Customer> lqw = buildQueryWrapper(bo);
    Page<CustomerVo> result = customerMapper.selectVoPage(pageQuery.build(), lqw);
    return PageResult.build(result.getRecords(), result.getTotal());
}
```

> 分页统一走 `PageQuery` → `pageQuery.build()` 传入 `selectVoPage`，再用 `PageResult.build(records, total)` 包装。不要自造分页 DTO。

### 4.3 单条 / 新增 / 修改 / 删除

```java
// 查单条（返回 VO）
public CustomerVo queryById(Long customerId) {
    return customerMapper.selectVoById(customerId);
}

// 新增：BO → Entity 用 MapstructUtils.convert（不要 BeanUtils）
public Boolean insertByBo(CustomerBo bo) {
    Customer add = MapstructUtils.convert(bo, Customer.class);
    validEntityBeforeSave(add);          // 保留保存前校验扩展点
    boolean flag = customerMapper.insert(add) > 0;
    if (flag) {
        bo.setCustomerId(add.getCustomerId());  // 雪花 ID 回填
    }
    return flag;
}

// 修改
public Boolean updateByBo(CustomerBo bo) {
    Customer update = MapstructUtils.convert(bo, Customer.class);
    validEntityBeforeSave(update);
    return customerMapper.updateById(update) > 0;
}

// 删除（@TableLogic 存在时为逻辑删除，自动写 del_flag='1'）
public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
    if (isValid) {
        // 删除前业务校验，失败抛 ServiceException
    }
    return customerMapper.deleteByIds(ids) > 0;
}
```

### 4.4 何时补 XML / MPJ 联表

- **`BaseMapperPlus + wrapper` 够用时，不要补 XML。**
- 复杂联表优先 MPJ（yulichang）：Mapper 同时 `extends MPJBaseMapper<Customer>`，查询用 `QueryBuilder.lambdaJoin("c", Customer.class).leftJoin(SysDept.class, "d", SysDept::getDeptId, Customer::getDeptId)`，别名对齐 `@DataColumn` 列名。
- 仅当：① 联表 SQL 无法用 wrapper 清晰表达；② 需手写查询列与 resultMap；③ 当前模块已大量用 XML —— 才在 `resources/mapper/**/XxxMapper.xml` 写 XML，并在 Mapper 接口声明对应方法。

## 五、字典 / 菜单常见操作

### 5.1 字典表结构（来自 ry_vue.sql）

| 表 | 主键 | 关键列 | 说明 |
|----|------|--------|------|
| `sys_dict_type` | `dict_id` | `dict_name`、`dict_type`(unique) | 字典类型（如 `sys_normal_disable`） |
| `sys_dict_data` | `dict_code` | `dict_sort`、`dict_label`、`dict_value`、`dict_type`、`list_class`、`is_default` | 字典明细，按 `dict_type` 关联 |

新增一组字典（雪花 ID 自取，不能 auto_increment）：

```sql
-- 1) 字典类型
insert into sys_dict_type
  (dict_id, dict_name, dict_type, create_dept, create_by, create_time, remark)
values
  (1762000000000000001, '客户状态', 'biz_customer_status', 1761000000000000103, 1761100000000000001, sysdate(), '客户状态列表');

-- 2) 字典数据（list_class 控制前端 tag 颜色：primary/success/warning/danger/info）
insert into sys_dict_data
  (dict_code, dict_sort, dict_label, dict_value, dict_type, list_class, is_default, create_dept, create_by, create_time, remark)
values
  (1762000000000000010, 1, '正常', '0', 'biz_customer_status', 'primary', 'Y', 1761000000000000103, 1761100000000000001, sysdate(), '正常'),
  (1762000000000000011, 2, '停用', '1', 'biz_customer_status', 'danger',  'N', 1761000000000000103, 1761100000000000001, sysdate(), '停用');
```

> 字典改库后必须同步失效缓存（`CacheNames.SYS_DICT` 与 `CacheNames.SYS_DICT_TYPE`），不能只改 DB。代码侧走 `DictService` / `@CacheEvict`，不要直接 SQL 改了就不管缓存。

### 5.2 菜单表 sys_menu 与常见查询

`sys_menu` 主键 `menu_id`（雪花），`menu_type`：`M`目录 / `C`菜单 / `F`按钮；`perms` 是权限标识（如 `system:user:list`）；`parent_id` 构成树。

代码生成器产出的菜单/按钮 SQL（见 `fm/sql/mysql.sql.ftl`）一菜单 + 6 按钮（list/query/add/edit/remove/export），权限前缀 `${module}:${business}:${action}`。手工建菜单照此结构。

常见查询：

```sql
-- 查某模块菜单及其按钮（树）
select menu_id, menu_name, parent_id, menu_type, perms
from sys_menu where parent_id = 1761400000000000001 or menu_id = 1761400000000000001
order by order_num;

-- 查某权限标识对应的菜单（排查"403 无权限"）
select menu_id, menu_name, perms from sys_menu where perms = 'system:user:add';

-- 取当前最大菜单 ID（手工插菜单时，在其基础上递增，避免与雪花初始化 ID 冲突）
select max(menu_id) from sys_menu;
```

> 原版菜单初始化 ID 是雪花值（如 `1761400000000000100`）。手工插入菜单可用 `max(menu_id)+1` 之类临时值，但更推荐用接口（菜单管理页）让框架生成雪花 ID，避免人工拼 ID 出错。

## 六、多数据源切换（dynamic-datasource 4.5）

数据源在 `application-{dev,prod}.yml` 的 `spring.datasource.dynamic.datasource.*` 下声明，`primary: master` 为默认库，`strict: true` 匹配不到即报错。原版默认只配 `master`（MySQL），`slave/oracle/postgres/sqlserver` 在 yml 中以注释示例给出，按需放开。

```yaml
spring:
  datasource:
    dynamic:
      primary: master
      strict: true
      datasource:
        master:
          driverClassName: com.mysql.cj.jdbc.Driver
          url: jdbc:mysql://localhost:3306/ry-vue?...&rewriteBatchedStatements=true&...
        # slave / oracle / postgres / sqlserver 按需放开
```

用 `@DS` 切库（方法或类上，方法级优先）：

```java
@DS("slave")   // 切到从库读
public List<CustomerVo> queryFromSlave(CustomerBo bo) {
    return customerMapper.selectVoList(buildQueryWrapper(bo));
}

@DS("oracle")  // 切到 Oracle 数据源
public List<XxxVo> queryFromOracle() { ... }
```

跨数据库方言由 `DataBaseHelper.getDataBaseType()` 自动判定（基于连接元数据，缓存到数据源名），常见用法是 `find_in_set`：原版按库切换 `find_in_set`(MySQL) / `instr`(Oracle) / `strpos`(PostgreSQL) / `charindex`(SQL Server)。写库内 SQL 时优先用框架封装的 `findInSetIfPresent` 等条件，不要硬编码某一种方言函数。

> SQL 文件位置：MySQL 主库 `script/sql/ry_vue.sql`、`ry_job.sql`、`ry_workflow.sql`、`ry_ai.sql`；其他库 `script/sql/oracle/*.sql`、`script/sql/postgres/*.sql`、`script/sql/sqlserver/*.sql`。换库部署时跑对应目录脚本。

## 七、完整 SQL 日志排查（SqlLogInterceptor）

线上排查"参数到底传了什么 / SQL 实际怎么执行"，开启完整 SQL 日志（已配在 `application-dev.yml`）：

```yaml
mybatis-plus:
  sql-log:
    enabled: true       # 完整 SQL 输出开关（dev 默认 true，prod 建议 false）
    output: console      # console（控制台）或 log（日志文件）
```

`SqlLogInterceptor`（`@Slf4j(topic = "SQL_FULL")`）拦截 `query/update/batch/queryCursor`，把占位符 `?` 用实参回填，输出**可直接复制到数据库客户端执行**的完整 SQL（含耗时），便于：
- 核对查询条件是否如预期（如 `del_flag` 是否参与、租户条件是否注入）；
- 把慢 SQL 直接贴到客户端 `EXPLAIN`；
- 复现某次写入的真实 SQL。

排查流程：
1. dev 确认 `sql-log.enabled=true`；prod 临时排查时短期打开，查完关闭（完整 SQL 有性能/安全开销）。
2. 复现操作，从控制台/日志按 `SQL_FULL` topic 捞出回填后的 SQL。
3. 复制 SQL 到客户端执行 / `EXPLAIN`，定位条件缺失、索引未命中、逻辑删除未生效等问题。
4. 改完回到第 4 节用 wrapper 条件修正，**不要**直接写裸 SQL 绕过框架。

## 八、常见错误对比（≥3 组）

**错误 1：逻辑删除字段名搞错**

```sql
-- ❌ 错：照搬 ruoyi-plus-uniapp / 通用模板，用了 is_deleted
is_deleted    tinyint(1)  default 0   comment '是否删除';

-- ✅ 对：框架固定 del_flag，char(1)，'0'正常 '1'删除
del_flag      char(1)     default '0' comment '删除标志（0代表存在 1代表删除）';
```
Entity 上对应 `@TableLogic` 注解逐实体声明逻辑删除（本仓库未在 `application.yml` 配全局 `logic-delete-field`，依赖 `@TableLogic`）。

**错误 2：主键用了自增**

```sql
-- ❌ 错：原版不用 MySQL 自增，雪花 ID 会被自增覆盖/冲突
customer_id   bigint(20)  not null auto_increment comment '客户ID';

-- ✅ 对：纯 bigint，主键由雪花算法（@TableId 默认 ASSIGN_ID）生成
customer_id   bigint(20)  not null comment '客户ID';
```

**错误 3：用户手机号列名写成 phone**

```sql
-- ❌ 错：原版 sys_user 没有 phone 列，写关联/查询会报 Unknown column
select user_id, phone from sys_user where phone = '15888888888';

-- ✅ 对：列名是 phone_number
select user_id, phone_number from sys_user where phone_number = '15888888888';
```

**错误 4：审计字段当字符串存名字 / 自己手填**

```java
// ❌ 错：create_by/update_by 是 bigint 用户ID，且由自动填充负责，不要手填用户名
entity.setCreateBy("admin");

// ✅ 对：审计字段交给 BaseEntity 自动填充（INSERT / INSERT_UPDATE），业务代码不碰
//   仅在确需指定时按 Long 用户ID 赋值
```

**错误 5：查询退回手写 SQL / 自造 wrapper**

```java
// ❌ 错：项目已有 BaseMapperPlus + QueryBuilder，仍手写 XML/拼 SQL
@Select("select * from biz_customer where status = #{status} and del_flag = '0'")
List<Customer> selectByStatus(String status);

// ✅ 对：用 QueryBuilder.lambda + selectVoList，del_flag 由 @TableLogic 自动加
customerMapper.selectVoList(QueryBuilder.lambda(Customer.class).eqIfText(Customer::getStatus, status).build());
```

## 九、最佳实践

1. **建表先抄 `sys_*` 范式**：主键 bigint 不自增、审计 5 字段顺序/类型照抄、`del_flag char(1) '0'`、每列中文 comment、外键列建 `idx_*` 索引。
2. **逻辑删除/乐观锁靠注解，不靠手写条件**：`@TableLogic` 自动追加 `del_flag` 条件与删除写值；`@Version` 自动并发控制。查询里不要手写 `del_flag = '0'`。
3. **查询走三类入口**：`QueryBuilder.lambda(...)` / `QueryBuilder.lambdaJoin(...)` / `BaseMapperPlus#lambda()`，条件用 `IfText/IfPresent/IfNotEmpty` 系列，日期范围走 `bo.getParams()` + `betweenParams`。
4. **读返 VO、写用 BO**：`selectVoXxx` 直接出 VO；写入 `MapstructUtils.convert(bo, Entity.class)`，雪花 ID 在 insert 后回填到 BO。
5. **分页只用 `PageQuery` + `PageResult`**，禁止自造分页结构。
6. **字典/缓存联动**：改 `sys_dict_*` 必须同步失效 `CacheNames.SYS_DICT` / `SYS_DICT_TYPE`，走 service / `@CacheEvict`，别只改库。
7. **多库优先框架方言封装**：跨 MySQL/Oracle/PG/SQLServer 时用 `DataBaseHelper` / `findInSetIfPresent`，避免硬编码单库函数；换库部署跑 `script/sql/{库}/` 对应脚本。
8. **多数据源用 `@DS` 就近声明**：方法级优先于类级；`strict: true` 下数据源名必须在 yml 已注册。
9. **排查 SQL 开 `sql-log`**：拿回填后的可执行 SQL 去客户端 `EXPLAIN`，定位条件/索引/逻辑删除问题；prod 查完即关。
10. **复杂逻辑放 service、事务用 `@Transactional(rollbackFor = Exception.class)`**：多表写入、关联表维护、删除前校验都在 service，显式业务失败抛 `ServiceException`。
