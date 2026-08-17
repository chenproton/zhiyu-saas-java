---
name: performance-doctor
description: |
  性能问题诊断与优化（base-dev-framework6-java）。涵盖完整 SQL 日志排查（SqlLogInterceptor）、SQL 优化、N+1 消除、分页与深分页优化、缓存策略、HikariCP 连接池、内存与慢接口定位。

  触发场景：
  - 接口/页面响应慢，需要先抓到真实执行的 SQL 与耗时
  - 列表查询慢、列表数据量大、深分页越翻越慢
  - 发现循环里反复查库（N+1 查询），需要改批量/联表
  - 怀疑索引缺失，需要 EXPLAIN 分析执行计划
  - 连接池打满、获取连接超时、内存占用持续上涨

  触发词：性能优化、慢查询、SQL优化、索引、EXPLAIN、N+1、分页优化、缓存、SqlLogInterceptor、SQL日志、响应慢、加载慢、深分页、HikariCP

  注意：如果是排查功能性 Bug（代码报错、逻辑结果错误、空指针、事务回滚等），请使用 bug-detective；本技能只解决"能跑但慢"的性能问题。
---

# performance-doctor — 性能诊断优化（base-dev-framework6-java）

## 一、概述

本技能针对 **base-dev-framework6-java** 解决"功能正常但响应慢"的性能问题。区别于 `bug-detective`（排查报错/逻辑错误），本技能专注三类慢：**SQL 慢、查询次数多（N+1）、数据量大（分页/流式）**，并辅以缓存、连接池、内存定位。

性能诊断的第一步永远是"**看到真实的 SQL 和耗时**"。6.x 内置了一个非常强的工具——`SqlLogInterceptor` 完整 SQL 日志拦截器，能把带 `?` 占位符的预编译 SQL 回填成**可直接复制执行的真实 SQL**，并附带耗时和 Mapper ID。先用它定位到具体的慢 SQL / 慢 Mapper，再做针对性优化，是本技能的核心方法论。

### 6.x 铁律（必须遵守）

- 包名根是 **`org.dromara`**，禁止 `plus.ruoyi`、`com.ruoyi`。
- 三层架构（Controller / Service / Mapper），**无独立 DAO 层**；查询条件用 `QueryBuilder.lambda()` 或 `Wrappers.lambdaQuery()` 在 Service 里构建。
- 禁止旧版概念：`buildQueryWrapper`（独立 DAO 层写法）、`PlusLambdaQuery`、`likeCast`、默认继承 `TenantEntity`、逻辑删除字段写死 `is_deleted`。
- 分页查询统一走 `baseMapper.selectVoPage(pageQuery.build(), lqw)`，返回 `PageResult.build(...)`。

> 性能 ≠ Bug：接口报 500、结果算错、事务没回滚 → 走 `bug-detective`；接口能返回正确结果但慢 → 走本技能。

---

## 二、完整 SQL 日志排查（SqlLogInterceptor）

这是 6.x 慢查询排查的**第一利器**。源码位置：

- 拦截器：`ruoyi-common/ruoyi-common-mybatis/src/main/java/org/dromara/common/mybatis/interceptor/SqlLogInterceptor.java`
- 配置类：`ruoyi-common/ruoyi-common-mybatis/.../config/properties/SqlLogProperties.java`
- 注册处：`ruoyi-common/ruoyi-common-mybatis/.../config/MybatisPlusConfig.java`

### 2.1 它做了什么（核对源码）

1. **回填真实参数**：拦截 `StatementHandler` 的 `query / update / batch / queryCursor` 四个方法，取出 `BoundSql`，遍历 `ParameterMapping`，把 SQL 里的 `?` 逐个替换成真实值——所以日志里的 SQL **可以直接复制到数据库客户端执行**，无需手动拼参数。
2. **类型安全格式化**：`Number` / `Boolean` 直接输出；`Date` / `LocalDateTime` / `LocalDate` / `LocalTime` 按标准格式（`yyyy-MM-dd HH:mm:ss` 等）输出并加引号；字符串做单引号转义（`'` → `''`），避免日志 SQL 拼坏。
3. **输出耗时 + Mapper ID**：每条日志格式为 `Consume Time：{耗时} ms {时间} Mapper ID：{全限定 Mapper 方法} Execute SQL：{完整SQL}`，执行异常时追加 `Execute Error：...`。耗时是慢查询排查的关键指标，Mapper ID 直接告诉你是哪个方法发的 SQL。
4. **超长分片**：单条日志超过 `CHUNK_SIZE = 8000` 字符时，按 8000 一片切分，带 `sqlLogId`（UUID）和 `part=i/total` 输出，避免日志链路截断超长 IN/批量 SQL。
5. **控制台输出加锁**：`output=console` 时走 `System.err.println` 并用 `ReentrantLock` 加锁，避免多线程 SQL 日志互相穿插（注意：console 模式走 `System.err`，不是 `System.out`）。

### 2.2 如何开启（核对 application-dev.yml）

配置前缀 `mybatis-plus.sql-log`（`SqlLogProperties` 默认 `enabled=false`、`output=console`）。`ruoyi-admin/src/main/resources/application-dev.yml` 实测配置：

```yaml
--- # MyBatis Plus 配置
mybatis-plus:
  sql-log:
    # 完整 SQL 输出开关
    enabled: true
    # 输出方式，可选 console、log
    output: console
```

- `enabled: true` → 拦截器才会被注册（`MybatisPlusConfig` 上有 `@ConditionalOnProperty(prefix="mybatis-plus.sql-log", name="enabled", havingValue="true")`，关闭时 Bean 根本不创建，**零性能损耗**）。
- `output: console` → 走 `System.err`，开发期肉眼看最直观；`output: log` → 走 `@Slf4j(topic = "SQL_FULL")` 的 `log.info`，可被 logback 收集、可配合 `logback-plus.xml` 单独输出到文件、便于 grep 耗时。
- **生产环境强烈建议关闭**（`enabled: false`）：回填参数 + 字符串拼接对每条 SQL 都有开销，生产打开会拖慢整体吞吐；生产仅在临时排障时短暂开 `output: log` 并尽快关回。

### 2.3 排障工作流（推荐套路）

1. 开发环境 `enabled: true`，复现慢接口，观察 `Consume Time` 找出耗时最高的那条 SQL（如 `Consume Time：1843 ms`）。
2. 复制日志里回填好的完整 SQL，到数据库客户端跑 `EXPLAIN` 看执行计划（见第三节）。
3. 看 `Mapper ID` 定位是哪个 Mapper 方法 / 哪段 Wrapper 构建发的 SQL，回到 Service 改写。
4. 若同一个接口刷出**几十上百条结构相同、只有 ID 不同**的 SQL → 典型 N+1（见第四节）。
5. 改完再复现，对比 `Consume Time` 验证优化效果，最后关闭日志开关。

---

## 三、SQL 优化

### 3.1 用 EXPLAIN 读执行计划

把 SQL 日志里回填好的真实 SQL 直接 `EXPLAIN`：

```sql
EXPLAIN SELECT id, user_name, dept_id, create_time
FROM sys_user
WHERE dept_id = 103 AND status = '0'
ORDER BY create_time DESC
LIMIT 10;
```

重点看：

| 字段 | 健康值 | 危险信号 |
|------|--------|---------|
| `type` | `const` / `eq_ref` / `ref` / `range` | `ALL`（全表扫描）、`index`（全索引扫描） |
| `key` | 命中预期索引 | `NULL`（没走索引） |
| `rows` | 越小越好 | 远大于结果集（扫了太多行才过滤） |
| `Extra` | `Using index`（覆盖索引） | `Using filesort`、`Using temporary` |

### 3.2 索引设计要点

- WHERE / ORDER BY / JOIN 关联列上建索引；高频组合条件建**复合索引**并遵守**最左前缀**。
- 避免索引列上做函数/运算（`WHERE DATE(create_time)=...`、`WHERE status+0=...` 会使索引失效）→ 改为范围条件（`create_time >= ... AND create_time < ...`）。
- 避免隐式类型转换：字段是 `varchar` 却传数字、或反之，会导致索引失效。
- 区分度低的列（性别、是否删除）单独建索引收益小，应作为复合索引的次要列。

### 3.3 避免 `SELECT *`

6.x 的 VO 查询（`selectVoList` / `selectVoPage`）通常只取需要的列，应保持这一习惯：用 BO/VO 精确映射列，不要为图省事拉全表所有字段（大字段如 `text` / `blob` 列尤其昂贵），列越少越容易命中**覆盖索引**。

### 3.4 大数据量流式查询（避免一次性 OOM）

导出/批处理几十万行时，**禁止** `selectList` 一次性全捞进内存。`SqlLogInterceptor` 拦截了 `queryCursor`，正说明 6.x 支持游标流式读取。在 Mapper 上用 MyBatis 游标（`Cursor<T>` + `@Options(fetchSize=...)`）逐行处理，配合 `try-with-resources` 边读边写，内存恒定。

```java
// Mapper：流式游标查询（fetchSize 配合 MySQL 流式，Integer.MIN_VALUE 触发逐行拉取）
@Options(fetchSize = Integer.MIN_VALUE)
@Select("SELECT id, order_no, amount FROM biz_order WHERE status = #{status}")
Cursor<BizOrderVo> streamByStatus(@Param("status") String status);

// Service：边读边处理，内存恒定，不会因数据量爆而 OOM
try (Cursor<BizOrderVo> cursor = baseMapper.streamByStatus("0")) {
    for (BizOrderVo vo : cursor) {
        // 逐行写入导出流 / 逐批落库，切忌再 add 到一个大 List
        handleOne(vo);
    }
}
```

---

## 四、N+1 查询问题

**症状**：一次列表请求，SQL 日志里刷出 1 条主查询 + N 条"按单个 ID 查关联"的子查询（结构相同、只有参数不同）。这是性能杀手，列表越长越慢。

### 4.1 反例（N+1）

```java
// ❌ 反例：查 N 个用户，再循环逐个查部门 → 1 + N 条 SQL
List<SysUserVo> users = baseMapper.selectVoList(lqw);
for (SysUserVo u : users) {
    // 循环里查库：列表 100 行就发 100 条额外 SQL
    SysDeptVo dept = deptMapper.selectVoById(u.getDeptId());
    u.setDeptName(dept.getDeptName());
}
```

### 4.2 解法 A：批量查 + 内存映射（1 + 1 条）

```java
// ✅ 收集所有 deptId，一次 IN 查询，再用 Map 内存回填
List<SysUserVo> users = baseMapper.selectVoList(lqw);
Set<Long> deptIds = StreamUtils.toSet(users, SysUserVo::getDeptId);
if (CollUtil.isNotEmpty(deptIds)) {
    Map<Long, String> deptNameMap = StreamUtils.toMap(
        deptMapper.selectVoList(Wrappers.<SysDept>lambdaQuery().in(SysDept::getDeptId, deptIds)),
        SysDeptVo::getDeptId, SysDeptVo::getDeptName);
    users.forEach(u -> u.setDeptName(deptNameMap.get(u.getDeptId())));
}
```

### 4.3 解法 B：联表查询（MPJ / 自定义 SQL，1 条）

需要关联展示字段时，用 **MyBatis-Plus-Join（MPJ）联表** 或自定义 Mapper SQL 一次查回，避免回表循环：

```java
// ✅ MPJ：一条 LEFT JOIN 直接把 dept_name 查出来（无 N+1）
MPJLambdaWrapper<SysUser> mpj = JoinWrappers.lambda(SysUser.class)
    .selectAll(SysUser.class)
    .selectAs(SysDept::getDeptName, SysUserVo::getDeptName)
    .leftJoin(SysDept.class, SysDept::getDeptId, SysUser::getDeptId)
    .eq(bo.getStatus() != null, SysUser::getStatus, bo.getStatus());
Page<SysUserVo> page = baseMapper.selectVoPage(pageQuery.build(), mpj, SysUserVo.class);
```

> 选择：展示字段少且关联表小 → 解法 A（批量 + Map）最稳；需要关联表条件过滤/排序 → 解法 B（联表）。**两者都比循环查库快一个数量级。**

---

## 五、分页优化

### 5.1 标准分页（6.x 正确写法）

分页插件在 `MybatisPlusConfig.paginationInnerInterceptor()` 注册，并设了 `setOverflow(true)`（分页合理化：页码越界自动回到首页/末页，避免空结果）。Service 标准写法（核对 `TestDemoServiceImpl`）：

```java
@Override
public PageResult<TestDemoVo> queryPageList(TestDemoBo bo, PageQuery pageQuery) {
    // 用 Wrappers/QueryBuilder 构建条件，禁止旧版 buildQueryWrapper（那是独立 DAO 层概念）
    LambdaQueryWrapper<TestDemo> lqw = Wrappers.<TestDemo>lambdaQuery()
        .like(StringUtils.isNotBlank(bo.getTestKey()), TestDemo::getTestKey, bo.getTestKey())
        .eq(bo.getStatus() != null, TestDemo::getStatus, bo.getStatus());
    // selectVoPage：分页 + VO 映射一步到位，只查 VO 需要的列
    Page<TestDemoVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
    return PageResult.build(result.getRecords(), result.getTotal());
}
```

### 5.2 深分页优化（LIMIT 越大越慢）

`LIMIT 1000000, 10` 会扫描并丢弃前一百万行，极慢。优化思路：

- **延迟关联（覆盖索引子查询）**：先用覆盖索引快速定位主键，再回表取数据。

```sql
-- ❌ 深分页：扫描 100 万行再丢弃
SELECT * FROM biz_order ORDER BY id LIMIT 1000000, 10;

-- ✅ 延迟关联：子查询只在索引上跑，回表只取 10 行
SELECT t.* FROM biz_order t
INNER JOIN (SELECT id FROM biz_order ORDER BY id LIMIT 1000000, 10) tmp
ON t.id = tmp.id;
```

- **游标分页（基于上一页最大值）**：列表按主键/时间有序时，用 `WHERE id > {上一页最后一条id} LIMIT 10` 代替 `OFFSET`，性能与翻到第几页无关，是 App 无限滚动、大数据导出的首选。
- 业务上限制最大可翻页数（如最多翻到 100 页），引导用户用筛选条件缩小范围。

---

## 六、缓存策略

热点数据、低频变更字典、配置项应走缓存，避免每次打库。本框架的缓存能力（`RedisUtils`、`CacheUtils`、`@Cacheable` / `@CacheEvict` 等 Spring Cache 注解、分布式锁、缓存穿透/雪崩/击穿处理）请激活 **redis-cache** 技能，本技能不重复展开，只给性能视角的取舍：

- 读多写少 + 容忍短暂不一致 → 缓存（设合理过期，避免缓存与库长期不一致）。
- `@Cacheable` 返回值**禁止**用不可变集合（`List.of()` / `Map.of()`），否则反序列化报错（详见 redis-cache）。
- 缓存只解决"重复查同样的数据"；单条 SQL 本身慢，应先按第三节把 SQL 调快，缓存是叠加手段而非遮羞布。

---

## 七、HikariCP 连接池

6.x 数据源用 HikariCP（`spring.datasource.type: com.zaxxer.hikari.HikariDataSource`），配置在 `application-dev.yml` / `application-prod.yml` 的 `spring.datasource.dynamic.hikari`（核对 dev 实测值）：

```yaml
hikari:
  maxPoolSize: 20            # 最大连接池数量
  minIdle: 10               # 最小空闲连接
  connectionTimeout: 30000  # 获取连接等待超时(ms)
  validationTimeout: 5000   # 校验超时(ms)
  idleTimeout: 600000       # 空闲连接存活最大时间(10分钟)
  maxLifetime: 1800000      # 连接最长生命周期(30分钟)
  keepaliveTime: 30000      # 连接活性检查间隔
```

排查要点：

- 日志频繁出现 `Connection is not available, request timed out after 30000ms` → 连接池被打满。先查是不是慢 SQL 长时间占用连接（回到第二节看耗时），**而不是无脑调大 `maxPoolSize`**——连接数过大反而拖垮数据库。
- 经验公式：`maxPoolSize ≈ (核心数 * 2) + 有效磁盘数`，多数中小服务 10~20 足够；瓶颈通常在慢 SQL 不在连接数。
- `maxLifetime` 应略小于数据库/中间件的连接空闲回收时间（如 MySQL `wait_timeout`），避免用到已被服务端关闭的死连接。

---

## 八、内存与慢接口定位

- **慢接口定位**：先开 `SqlLogInterceptor` 看是不是 SQL 慢；SQL 都快但接口仍慢 → 排查应用层（循环远程调用、序列化大对象、同步阻塞 IO）。可结合 `@Log` 操作日志的耗时、网关/Nginx access log 的响应时间交叉定位。
- **内存定位**：内存持续上涨/频繁 Full GC → 启动加 `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=...`，OOM 时 dump 后用 MAT 分析；运行期用 `jmap -histo:live <pid>` 看大对象 Top N、`jstat -gcutil <pid> 1000` 看 GC 频率。
- **常见内存坑**：一次性 `selectList` 捞大表（改流式，见 3.4）、把大结果集塞进 List/Map 缓存、ThreadLocal 用完不清理、循环里不断 new 大对象。

---

## 九、常见错误对比（≥3）

| # | ❌ 错误做法 | ✅ 正确做法 | 原因 |
|---|-----------|-----------|------|
| 1 | 循环里逐个 `selectById` 查关联（N+1） | 批量 `IN` 查 + Map 回填，或 MPJ 联表 | 1+N 条 SQL 退化为 1+1 / 1 条，列表越长收益越大（第四节） |
| 2 | 深分页 `LIMIT 1000000,10` 直接查 | 延迟关联子查询 或 `WHERE id>{上页最大id}` 游标分页 | OFFSET 会扫描并丢弃前面所有行，越翻越慢（5.2） |
| 3 | 生产环境常开 `sql-log.enabled=true` | 仅开发/临时排障开，排查完关回 `false` | 参数回填+字符串拼接对每条 SQL 有开销，拖累生产吞吐（2.2） |
| 4 | 导出几十万行用 `selectList` 全捞 | `Cursor<T>` 流式游标边读边写 | 一次性进内存会 OOM，流式内存恒定（3.4） |
| 5 | 连接超时就无脑调大 `maxPoolSize` | 先查慢 SQL 是否长占连接，再谨慎调参 | 连接数过大反压垮数据库，瓶颈多在慢 SQL（第七节） |
| 6 | 索引列上写 `DATE(create_time)=...` | 改范围条件 `create_time>=... AND <...` | 索引列套函数导致索引失效，退化全表扫描（3.2） |

---

## 十、最佳实践

1. **先量化，再优化**：任何优化前先用 `SqlLogInterceptor` 拿到 `Consume Time` 基线，改完再对比，杜绝凭感觉调优。
2. **SQL 日志是入口**：开 `enabled=true` → 找最慢的 `Consume Time` → 复制真实 SQL `EXPLAIN` → 看 `type/key/rows/Extra`。这套流程能覆盖 80% 的慢查询。
3. **N+1 优先消除**：列表接口务必检查 SQL 日志里有无重复结构子查询，用批量/联表替代循环查库。
4. **分页与深分页分开对待**：普通分页用 `selectVoPage` 标准写法；深分页用延迟关联/游标分页。
5. **大数据量用流式**：导出/批处理走 `Cursor<T>`，绝不一次性进内存。
6. **缓存是叠加项不是遮羞布**：先把 SQL 本身调快，再用 redis-cache 技能加缓存。
7. **生产关日志、连接池按需调**：`sql-log` 生产关闭；连接池先查慢 SQL 再调参数。
8. **守住 6.x 铁律**：包名 `org.dromara`、三层无 DAO、`QueryBuilder.lambda()` 构建条件、禁用 `buildQueryWrapper/PlusLambdaQuery/likeCast`。
9. **分清职责**：能跑但慢 → 本技能；报错/结果错 → `bug-detective`；缓存细节 → `redis-cache`；数据库表/索引 DDL → `database-ops`。
