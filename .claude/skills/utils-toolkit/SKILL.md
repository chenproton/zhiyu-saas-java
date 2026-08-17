---
name: utils-toolkit
description: |
  本项目 后端工具类速查 - 帮你在写 Java 代码时选对工具类、用对方法，避免重复造轮子。

  触发场景：
  - 需要做对象/集合转换（Entity ↔ BO ↔ VO），不知道用哪个工具
  - 需要处理日期时间（格式化、计算时间差、校验日期范围、友好时间）
  - 需要做字符串处理、集合流式操作、构建树形结构、参数校验
  - 需要从 Spring 容器拿 Bean、读 HTTP 请求/响应、操作 Redis 缓存
  - 拿不准"项目工具类 / Hutool / 自己实现"该用哪一层

  触发词：工具类、日期、时间、DateUtils、字符串、StringUtils、集合、StreamUtils、对象转换、MapstructUtils、树结构、TreeBuildUtils、校验、ValidatorUtils、SpringUtils、RedisUtils、Hutool、utils
---

# base-dev-framework6-java 后端工具类速查（utils-toolkit）

> 本技能只讲**后端 Java 工具类**。前端工具类不在本技能范围内（前端日期用 `dayjs`、请求用项目封装的 http，请查阅前端相关技能，本处不展开）。
>
> 所有工具类均位于 `ruoyi-common` 模块下，包名前缀 **`org.dromara.common.*`**（6.x 已彻底切到 dromara 命名空间）。

## 0. 6.x 铁律（写代码前先记住）

- 包名一律 **`org.dromara`** 开头，**禁止** `plus.ruoyi` / `com.ruoyi` / `com.dromara`。
- **没有 DAO 层**，**没有 `PlusLambdaQuery`**，**没有 `likeCast`**：查询直接用 MyBatis-Plus 的 `LambdaQueryWrapper` / `QueryWrapper`，不要套用旧封装。
- 实体基类默认用 `BaseEntity`，**不要默认套 `TenantEntity`**（多租户是可选特性，未开启时强加会出错）。
- 逻辑删除字段是 `del_flag`，**不是** `is_deleted`。
- 业务异常统一抛 `org.dromara.common.core.exception.ServiceException`，**不要** `throw new RuntimeException(...)` 当业务异常用。

## 1. 工具优先级（铁律）

选工具类时，**永远按这个顺序**，绝不跳级：

```
① 项目工具类（org.dromara.common.*.utils.*）   ← 最优先，封装了项目约定
② Hutool 5.8.46（cn.hutool.*）                  ← 项目没封装时用
③ 自己实现                                       ← 前两者都没有，且确实必要时
```

- **为什么项目工具类优先**：很多项目工具类继承自 Hutool 并补充了项目专属逻辑。例如 `DateUtils extends DateUtil`、`StringUtils extends org.apache.commons.lang3.StringUtils`、`TreeBuildUtils extends TreeUtil`、`ReflectUtils extends ReflectUtil`。用项目工具类，等于"项目封装 + 底层库"全都拿到。
- **不要凭记忆硬编**：写之前先确认方法名真实存在（本技能列出的方法均来自 6.x 真实源码）。
- **对象转换没有商量**：实体之间转换**必须** `MapstructUtils.convert`，禁止 `BeanUtils.copyProperties` / 手写 `new VO(); vo.setXxx(...)` 一字段一字段抄（见第 4 节）。

## 2. 工具类速查表（场景 → 用哪个 → 方法）

| 场景 | 用哪个工具类 | 核心方法 | 所在包 |
|------|------------|---------|--------|
| **对象转换**（Entity↔BO↔VO、List 批量、Map→Bean） | **`MapstructUtils`（必用）** | `convert(source, Class)` / `convert(List, Class)` / `convert(source, descObj)` | `org.dromara.common.core.utils` |
| 日期时间（格式化、时间差、范围校验、友好时间） | `DateUtils`（继承 Hutool `DateUtil`） | `formatTimeBetween` / `validateDateRange` / `getTodayHour` / `formatFriendlyTime` + Hutool 全部 | `org.dromara.common.core.utils` |
| 字符串处理 | `StringUtils`（继承 commons-lang3） | `isNotEmpty` / `format` / `splitList` / `splitTo` / `joinComma` / `toUnderScoreCase` | `org.dromara.common.core.utils` |
| 集合流式操作（filter/map/分组/转 Map） | `StreamUtils` | `filter` / `toList` / `toMap` / `groupByKey` / `join` / `findFirst` | `org.dromara.common.core.utils` |
| 构建树形结构（菜单、部门、分类） | `TreeBuildUtils`（继承 Hutool `TreeUtil`） | `build(list, nodeParser)` / `build(list, parentId, nodeParser)` / `buildMultiRoot` | `org.dromara.common.core.utils` |
| 手动参数校验（非 Controller 入参） | `ValidatorUtils` | `validate(object, groups...)` | `org.dromara.common.core.utils` |
| 从 Spring 容器取 Bean / 读环境 | `SpringUtils`（继承 Hutool `SpringUtil`） | `getBean` / `context` / `getProperty` / `isVirtual` | `org.dromara.common.core.utils` |
| 读 HTTP 请求/响应、客户端 IP、渲染 JSON | `ServletUtils` | `getRequest` / `getResponse` / `getClientIP` / `getParameter` / `renderString` | `org.dromara.common.core.utils` |
| 反射调用 getter/setter | `ReflectUtils`（继承 Hutool `ReflectUtil`） | `invokeGetter` / `invokeSetter` | `org.dromara.common.core.utils.reflect` |
| 空值安全取值 | `ObjectUtils` | `notNull` / `notNullGetter` | `org.dromara.common.core.utils` |
| Redis 缓存 / 限流 / 发布订阅 | `RedisUtils` | `setCacheObject` / `getCacheObject` / `deleteObject` / `rateLimiter` / `publish` | `org.dromara.common.redis.utils` |
| 业务异常抛出 | `ServiceException` | `new ServiceException("提示")` | `org.dromara.common.core.exception` |

> 表里没有的通用能力（如 `CollUtil`、`StrUtil`、`NumberUtil`、`SecureUtil`、`IdUtil`、`DesensitizedUtil`），直接用 **Hutool 5.8.46**（`cn.hutool.*`），它已是项目依赖，无需额外引入。

## 3. 各工具用法详解

### 3.1 MapstructUtils（对象转换，必用）

`org.dromara.common.core.utils.MapstructUtils`，底层是 mapstruct-plus 的 `Converter`，编译期生成转换代码，性能远高于反射拷贝。

四个重载（均来自源码）：

```java
// 1) 单对象 → 目标类型（最常用）
SysUserVo vo = MapstructUtils.convert(user, SysUserVo.class);

// 2) List 批量转换（返回可变 List，源为 null 返回 null，空集合返回空 List）
List<SysUserVo> voList = MapstructUtils.convert(userList, SysUserVo.class);

// 3) 把 source 的值映射到已有的 desc 对象上（按映射规则赋值）
SysUser entity = MapstructUtils.convert(bo, new SysUser());

// 4) Map<String,Object> → Bean
SysUser user = MapstructUtils.convert(map, SysUser.class);
```

要点：
- `source` 为 `null` 时返回 `null`，不会 NPE，可直接用于可空对象。
- 转换前提：目标类用 `@AutoMapper(target = XxxEntity.class)` 之类注解声明映射关系（BO/VO 上已标注）。

### 3.2 DateUtils（6.x 重构，见第 5 节专章）

略，详见第 5 节。

### 3.3 StringUtils（字符串）

`org.dromara.common.core.utils.StringUtils extends org.apache.commons.lang3.StringUtils`，所以 commons-lang3 的全部方法都可直接用，外加项目封装：

```java
StringUtils.isNotEmpty(str);                       // 非空判断
StringUtils.format("用户{}登录失败{}次", name, n);   // 占位符格式化（{} 风格）
List<String> ids = StringUtils.splitList("1,2,3");  // 逗号分割成 List
List<Long> longs = StringUtils.splitTo("1,2,3", Convert::toLong); // 分割并转类型
String csv = StringUtils.joinComma(idList);         // 用逗号拼接 Iterable/数组
String underline = StringUtils.toUnderScoreCase("userName"); // 转下划线 user_name
boolean ok = StringUtils.inStringIgnoreCase(type, "A", "B"); // 忽略大小写包含
```

> 注意 `StringUtils.SEPARATOR` 常量是 `","`，`SLASH` 是 `"/"`，`COLON` 是 `":"`。

### 3.4 StreamUtils（集合流式操作）

`org.dromara.common.core.utils.StreamUtils`，把常用 Stream 操作做了空集合保护，且**返回可变集合**（源码刻意不用 `.toList()`，避免序列化时不可变 List 报错）：

```java
// 过滤
List<User> actived = StreamUtils.filter(users, u -> u.getStatus() == 1);

// 转换为另一种类型的 List（相当于 map().toList()）
List<Long> ids = StreamUtils.toList(users, User::getId);

// 转 Set
Set<Long> idSet = StreamUtils.toSet(users, User::getId);

// 转 Map：id -> User
Map<Long, User> idMap = StreamUtils.toIdentityMap(users, User::getId);

// 转 Map：id -> name
Map<Long, String> nameMap = StreamUtils.toMap(users, User::getId, User::getName);

// 按字段分组：deptId -> List<User>
Map<Long, List<User>> byDept = StreamUtils.groupByKey(users, User::getDeptId);

// 拼接：把每个元素映射成字符串后用逗号连接
String names = StreamUtils.join(users, User::getName);

// 找第一个满足条件的（返回 Optional）
Optional<User> admin = StreamUtils.findFirst(users, u -> u.isAdmin());
```

> 这些方法对 `null` 集合 / 空集合都安全返回空容器，业务代码可省掉前置空判断。

### 3.5 TreeBuildUtils（树形结构）

`org.dromara.common.core.utils.TreeBuildUtils extends TreeUtil`，默认配置把名称字段 key 设为 `"label"`（前端约定）：

```java
// 最常用：自动取列表第一个节点的 parentId 作为根
List<Tree<Long>> tree = TreeBuildUtils.build(deptList, (dept, treeNode) -> {
    treeNode.setId(dept.getDeptId());
    treeNode.setParentId(dept.getParentId());
    treeNode.setName(dept.getDeptName());
    treeNode.setWeight(dept.getOrderNum());
    treeNode.putExtra("disabled", dept.getStatus().equals("1"));
});

// 指定根节点 parentId
List<Tree<Long>> menu = TreeBuildUtils.build(menuList, 0L, (m, node) -> {
    node.setId(m.getMenuId());
    node.setParentId(m.getParentId());
    node.setName(m.getMenuName());
});

// 多根节点（数据里有多个顶级节点时）
List<Tree<Long>> multi = TreeBuildUtils.buildMultiRoot(
    list, Category::getId, Category::getParentId, (c, node) -> {
        node.setId(c.getId());
        node.setParentId(c.getParentId());
        node.setName(c.getName());
    });
```

### 3.6 ValidatorUtils（手动参数校验）

`org.dromara.common.core.utils.ValidatorUtils`，用于 Controller 之外（如导入数据逐条校验、Service 内部）触发 JSR-380 校验：

```java
// 对象为 null 抛 RuntimeException；校验不通过抛 ConstraintViolationException
ValidatorUtils.validate(importBo);
// 指定校验分组
ValidatorUtils.validate(bo, AddGroup.class);
```

> Controller 入参校验请直接用 `@Validated` + `@NotNull`/`@NotBlank` 注解，无需手动调用本工具。

### 3.7 SpringUtils（Spring 容器）

`org.dromara.common.core.utils.SpringUtils extends SpringUtil`：

```java
UserService svc = SpringUtils.getBean(UserService.class);
String env = SpringUtils.getProperty("spring.profiles.active");
boolean virtual = SpringUtils.isVirtual();   // 当前是否启用虚拟线程
ApplicationContext ctx = SpringUtils.context();
```

### 3.8 ServletUtils（HTTP 请求/响应）

`org.dromara.common.core.utils.ServletUtils`：

```java
HttpServletRequest req = ServletUtils.getRequest();
HttpServletResponse resp = ServletUtils.getResponse();
String ip = ServletUtils.getClientIP();               // 自动穿透代理头取真实 IP
String page = ServletUtils.getParameter("pageNum");
ServletUtils.renderString(resp, JsonUtils.toJsonString(R.fail("无权限"))); // 直接写 JSON
```

### 3.9 RedisUtils（缓存 / 限流 / 发布订阅）

`org.dromara.common.redis.utils.RedisUtils`（在 `ruoyi-common-redis` 模块，底层 Redisson）：

```java
// 缓存读写
RedisUtils.setCacheObject("user:1", user);
RedisUtils.setCacheObject("captcha:" + uuid, code, Duration.ofMinutes(5)); // 带过期
User u = RedisUtils.getCacheObject("user:1");
RedisUtils.deleteObject("user:1");
boolean exists = RedisUtils.isExistsObject("user:1");

// 限流（返回剩余可用次数，<0 表示被限流）
long left = RedisUtils.rateLimiter("api:login:" + ip, RateType.OVERALL, 5, 60);

// 发布订阅
RedisUtils.publish("channel:notice", message);
```

### 3.10 ObjectUtils / ReflectUtils（空值安全 & 反射）

```java
// 空值安全取值
String name = ObjectUtils.notNull(user, defaultUser).getName();
String dept = ObjectUtils.notNullGetter(user, User::getDeptName, "未知部门");

// 反射调 getter/setter（支持多级 a.b.c）
Long pid = ReflectUtils.invokeGetter(node, "parentId");
ReflectUtils.invokeSetter(node, "status", 1);
```

## 4. DateUtils（6.x 重构专章）

`org.dromara.common.core.utils.DateUtils extends cn.hutool.core.date.DateUtil`。**因为继承了 Hutool `DateUtil`**，所以 Hutool 的 `format` / `parse` / `now` / `beginOfDay` / `offsetDay` / `between` 等几十个方法**全部可直接用** `DateUtils.xxx()` 调用，无需再 import Hutool。

6.x 在此基础上**新增了 4 个项目专属方法**（入参刻意用 `Object`，同时兼容 `Date` 和 `LocalDateTime`，内部用 `Convert.toDate` 统一转换）：

```java
// 1) 计算时间差并格式化（时分秒），入参兼容 Date / LocalDateTime
String diff = DateUtils.formatTimeBetween(start, end, BetweenFormatter.Level.SECOND);
String sec  = DateUtils.formatBetweenBySecond(start, end); // 上一行的精确到秒快捷版

// 2) 校验日期范围 + 最大跨度（超范围抛 ServiceException）
DateUtils.validateDateRange(start, end, 90, TimeUnit.DAYS); // 跨度不能超 90 天

// 3) 取时间段中文描述（凌晨/上午/中午/下午/晚上）
String period = DateUtils.getTodayHour(new Date()); // 如 "下午"

// 4) 仿微信友好时间：刚刚 / X分钟前 / 昨天 HH:mm / 周三 HH:mm / MM-dd HH:mm
String friendly = DateUtils.formatFriendlyTime(date);
```

要点：
- `formatTimeBetween` / `validateDateRange` 入参为 `Object`，传 `Date` 或 `LocalDateTime` 都可以，但**不要传 `String`**（内部 `Convert.toDate` 对非时间字符串会解析失败并抛断言异常）。
- `validateDateRange` 内部用 `ServiceException` 抛错，会被全局异常处理器捕获并返回友好提示——很适合做查询接口的时间范围限制。
- 普通格式化（`yyyy-MM-dd HH:mm:ss`）直接用继承来的 `DateUtils.formatDateTime(date)` / `DateUtils.now()`，**不用**自己 `new SimpleDateFormat`（线程不安全）。

## 5. 代码示例（真实场景，≥5）

### 示例 1：Service 查询 → VO 列表（对象转换 + 集合）

```java
@Override
public List<SysUserVo> listActiveUsers(Long deptId) {
    List<SysUser> users = baseMapper.selectList(
        new LambdaQueryWrapper<SysUser>()
            .eq(SysUser::getDeptId, deptId)
            .eq(SysUser::getStatus, "0"));
    // 必用 MapstructUtils，禁止 BeanUtils 逐字段抄
    return MapstructUtils.convert(users, SysUserVo.class);
}
```

### 示例 2：把列表按部门分组并统计姓名

```java
Map<Long, List<SysUser>> byDept = StreamUtils.groupByKey(users, SysUser::getDeptId);
String names = StreamUtils.join(users, SysUser::getNickName); // "张三,李四,王五"
Map<Long, String> idNameMap = StreamUtils.toMap(users, SysUser::getUserId, SysUser::getNickName);
```

### 示例 3：构建部门树返回前端

```java
@Override
public List<Tree<Long>> buildDeptTree() {
    List<SysDept> depts = baseMapper.selectList(null);
    return TreeBuildUtils.build(depts, (dept, node) -> {
        node.setId(dept.getDeptId());
        node.setParentId(dept.getParentId());
        node.setName(dept.getDeptName());
        node.setWeight(dept.getOrderNum());
    });
}
```

### 示例 4：查询接口限制时间跨度 + 抛业务异常

```java
public PageResult<OrderVo> pageOrder(OrderBo bo) {
    // 时间跨度不能超过 90 天，否则抛 ServiceException（全局异常处理器会接住）
    DateUtils.validateDateRange(bo.getBeginTime(), bo.getEndTime(), 90, TimeUnit.DAYS);
    if (bo.getEndTime() == null) {
        throw new ServiceException("结束时间不能为空");
    }
    // ... MyBatis-Plus 查询
}
```

### 示例 5：登录接口限流 + 友好时间展示

```java
// 同一 IP 每分钟最多登录 5 次
long left = RedisUtils.rateLimiter("login:" + ServletUtils.getClientIP(),
        RateType.OVERALL, 5, 60);
if (left < 0) {
    throw new ServiceException("登录过于频繁，请稍后再试");
}
// 展示最近登录时间为友好格式
loginVo.setLoginTimeText(DateUtils.formatFriendlyTime(user.getLoginDate()));
```

### 示例 6：导入数据逐条手动校验

```java
for (UserImportBo row : importList) {
    try {
        ValidatorUtils.validate(row, AddGroup.class); // 触发 @NotBlank 等注解
        userService.insert(MapstructUtils.convert(row, SysUser.class));
    } catch (ConstraintViolationException e) {
        failMsg.add(StringUtils.format("第{}行校验失败：{}", row.getRowNum(), e.getMessage()));
    }
}
```

## 6. 常见错误对比（≥3）

### 错误 1：对象转换用 BeanUtils / 手写赋值

```java
// ❌ 反射拷贝，字段多时性能差，且字段名不一致会静默丢值
SysUserVo vo = new SysUserVo();
BeanUtils.copyProperties(user, vo);

// ❌ 逐字段手抄，冗长易漏
SysUserVo vo = new SysUserVo();
vo.setUserId(user.getUserId());
vo.setUserName(user.getUserName());

// ✅ 必用 MapstructUtils（编译期生成，性能高，映射规则集中可控）
SysUserVo vo = MapstructUtils.convert(user, SysUserVo.class);
```

### 错误 2：日期格式化 new SimpleDateFormat

```java
// ❌ SimpleDateFormat 非线程安全，并发下会出错乱
String s = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);

// ✅ 用继承自 Hutool 的方法，线程安全
String s = DateUtils.formatDateTime(date);
```

### 错误 3：StreamUtils 结果当不可变 List 再处理 / 自己写 stream 漏空判断

```java
// ❌ 自己写 stream，未判空，users 为 null 时 NPE
List<Long> ids = users.stream().map(User::getId).collect(Collectors.toList());

// ❌ 用 JDK16+ 的 .toList()，返回不可变 List，后续 add 或序列化可能报错
List<Long> ids = users.stream().map(User::getId).toList();

// ✅ StreamUtils 自带空集合保护，返回可变 List
List<Long> ids = StreamUtils.toList(users, User::getId);
```

### 错误 4：业务异常抛 RuntimeException

```java
// ❌ 全局异常处理器不会按业务异常处理，前端拿到的是 500 而非友好提示
throw new RuntimeException("用户不存在");

// ✅ 用 ServiceException，会被全局处理器转成 R.fail(msg)
throw new ServiceException("用户不存在");
```

### 错误 5：用了旧框架的概念（6.x 已废弃）

```java
// ❌ 6.x 没有 PlusLambdaQuery、没有 DAO 层、没有 likeCast
PlusLambdaQuery<User> q = ...;   // 不存在
userDao.buildQueryWrapper(bo);   // 没有 DAO 层

// ✅ 直接用 MyBatis-Plus 的 LambdaQueryWrapper
new LambdaQueryWrapper<User>().like(StringUtils.isNotBlank(bo.getName()), User::getName, bo.getName());
```

## 7. 最佳实践清单

1. **对象转换无脑用 `MapstructUtils.convert`**，是项目的硬约定，code review 会卡 `BeanUtils`。
2. **先查项目工具类，再查 Hutool，最后才自己写**——很多项目工具类已继承 Hutool，用项目类等于全都有。
3. **集合操作优先 `StreamUtils`**：自带空保护、返回可变集合、避免序列化坑；复杂场景再退回原生 Stream。
4. **日期统一走 `DateUtils`**，禁止 `SimpleDateFormat`；时间范围校验直接用 `validateDateRange`。
5. **树形结构统一 `TreeBuildUtils.build`**，name key 默认是前端约定的 `label`，不要自己拼。
6. **业务报错一律 `ServiceException`**，让全局异常处理器统一转 `R.fail`。
7. **缓存走 `RedisUtils`**，不要直接注入 `RedisTemplate` 裸操作；限流用 `RedisUtils.rateLimiter`。
8. **方法名拿不准就翻源码确认**：`ruoyi-common-core/.../utils/` 与 `ruoyi-common-redis/.../utils/RedisUtils.java`，本技能所列方法均与 6.x 真实源码一致。
9. **始终用 `org.dromara` 包**，凡是脑子里冒出 `com.ruoyi` / `plus.ruoyi` / `PlusLambdaQuery` / `is_deleted` 的，都是旧版残留，立即纠正。
