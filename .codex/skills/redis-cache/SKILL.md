---
name: redis-cache
description: |
  当需要使用 Redis 缓存、分布式锁、限流、发布订阅等功能时自动使用此 Skill。基于 base-dev-framework6-java的 ruoyi-common-redis 模块，涵盖 RedisUtils 工具类、CacheUtils + Spring Cache 注解、CacheNames 缓存组、Redisson 分布式锁、Lock4j 注解锁、@RateLimiter 限流、序列化机制等真实实现。

  触发场景：
  - 用 Redis 缓存数据（对象/List/Set/Map/原子值）或读取缓存
  - 配置 Spring Cache 注解（@Cacheable/@CachePut/@CacheEvict/@Caching）与 CacheNames
  - 实现分布式锁（Redisson RLock 或 Lock4j @Lock4j）
  - 实现接口限流（@RateLimiter）、Redis 发布订阅
  - 排查缓存穿透/雪崩/击穿、设计缓存 key 命名与过期策略

  触发词：Redis、缓存、Cache、@Cacheable、@CacheEvict、@CachePut、RedisUtils、CacheUtils、分布式锁、RLock、Lock4j、限流、@RateLimiter、发布订阅、缓存穿透、缓存雪崩、缓存击穿、缓存key、Redisson、Fory

  核心警告（6.x 铁律）：
  - 包名 org.dromara，禁用 plus.ruoyi / com.ruoyi
  - @Cacheable 返回值禁止使用不可变集合（List.of/Set.of/Map.of），必须用 new ArrayList/HashMap
  - 分布式锁必须在 finally 中释放
  - RedisUtils.keys() / deleteKeys() 全局匹配，忽略租户隔离
---

# base-dev-framework6-java · Redis 缓存 / 分布式锁 / 限流

## 一、概述

本技能对应模块 `ruoyi-common/ruoyi-common-redis`，所有能力底层基于 **Redisson（spring-boot-starter + spring-cache）**。
关键版本（来自根 `pom.xml`，已逐项核对源码）：

| 组件 | 版本 | 用途 |
|------|------|------|
| `redisson-spring-boot-starter` | **4.6.1** | Redis 客户端 + 分布式数据结构 + Spring Cache 整合 |
| `lock4j-redisson-spring-boot-starter` | **2.2.7** | 注解式分布式锁（底层走 Redisson） |
| `fory-core`（org.apache.fory） | **1.2.0** | 高性能二进制序列化（依赖已引入，见下方序列化章节说明） |

包名一律 `org.dromara.*`。本模块四大入口：

1. `org.dromara.common.redis.utils.RedisUtils` —— 直接操作 Redis 的静态工具类（基于 RedissonClient）。
2. `org.dromara.common.redis.utils.CacheUtils` —— 操作 Spring Cache 的工具类（手动 get/put/evict/clear）。
3. `org.dromara.common.core.constant.CacheNames` —— 缓存组名常量（注意此类在 `ruoyi-common-core`，不在 redis 模块）。
4. 注解：`@RateLimiter`（限流）、`@RepeatSubmit`（防重复提交）、第三方 `@Lock4j`（分布式锁）。

> 🔴 6.x 与旧版（plus.ruoyi / com.ruoyi）的区别：包名 `org.dromara`；无 DAO 强制层；查询用 `QueryBuilder.lambda()` 而非 `PlusLambdaQuery`；不依赖 `likeCast`；实体默认不强制 `TenantEntity`。本技能示例全部从 6.x 真实源码提取。

---

## 二、RedisUtils 工具类（直接操作 Redis）

`RedisUtils` 内部持有 `RedissonClient CLIENT = SpringUtils.getBean(RedissonClient.class)`，全部为静态方法，按真实源码分组：

### 1. 基本对象（String / Integer / 实体类）

```java
// 写入（不带过期）
RedisUtils.setCacheObject("user:1", userVo);
// 写入并指定过期时间
RedisUtils.setCacheObject("user:1", userVo, Duration.ofMinutes(30));
// 写入并保留原 TTL（Redis 6.X 以上用 setAndKeepTTL 兼容 5.X）
RedisUtils.setCacheObject("user:1", userVo, true);
// 不存在才写（分布式幂等常用，返回 true 表示抢到）
boolean ok = RedisUtils.setObjectIfAbsent("lock:flag", "1", Duration.ofSeconds(10));
// 读取
UserVo vo = RedisUtils.getCacheObject("user:1");
// 删除 / 批量删除（批量走 RBatch 异步）
RedisUtils.deleteObject("user:1");
RedisUtils.deleteObject(List.of("user:1", "user:2"));
// 是否存在 / 剩余 TTL（毫秒）
boolean exists = RedisUtils.isExistsObject("user:1");
long ttl = RedisUtils.getTimeToLive("user:1");
// 设置过期
RedisUtils.expire("user:1", 60L);                    // 秒
RedisUtils.expire("user:1", Duration.ofMinutes(5));  // Duration
```

### 2. List / Set / Map

```java
// List（底层 RList）
RedisUtils.setCacheList("ids", List.of(1L, 2L, 3L));   // addAll
RedisUtils.addCacheList("ids", 4L);                    // 追加单个
List<Long> ids = RedisUtils.getCacheList("ids");       // readAll
List<Long> range = RedisUtils.getCacheListRange("ids", 0, 1); // 范围

// Set（底层 RSet）
RedisUtils.setCacheSet("tags", Set.of("a", "b"));
RedisUtils.addCacheSet("tags", "c");
Set<String> tags = RedisUtils.getCacheSet("tags");

// Map / Hash（底层 RMap）
RedisUtils.setCacheMap("cfg", Map.of("k1", "v1"));     // putAll
RedisUtils.setCacheMapValue("cfg", "k2", "v2");        // 单个 hKey
String v = RedisUtils.getCacheMapValue("cfg", "k2");
Map<String, String> all = RedisUtils.getCacheMap("cfg");
RedisUtils.delCacheMapValue("cfg", "k2");
```

### 3. 原子值

```java
RedisUtils.setAtomicValue("seq:order", 1000L);
long cur  = RedisUtils.getAtomicValue("seq:order");
long next = RedisUtils.incrAtomicValue("seq:order"); // +1
long prev = RedisUtils.decrAtomicValue("seq:order"); // -1
```

### 4. 🔴 keys / deleteKeys —— 忽略租户隔离

源码注释明确写道：「**全局匹配忽略租户 自行拼接租户id**」。即这两个方法**不会**自动追加 Redisson 的 keyPrefix/租户前缀，按通配模式全库扫描/删除：

```java
// 扫描，默认 chunkSize=1000，limit=0 查全部
Collection<String> keys = RedisUtils.keys("login_tokens:*");
// 按模式批量删除（deleteByPattern，危险操作，慎用通配）
RedisUtils.deleteKeys("login_tokens:*");
boolean has = RedisUtils.hasKey("user:1");  // countExists > 0
```

> ⚠️ 多租户场景下，若想只删当前租户的 key，必须自己把租户 id 拼进 pattern（如 `"tenant:" + tenantId + ":xxx:*"`），否则会跨租户误删。

---

## 三、Spring Cache 缓存注解 + CacheUtils + CacheNames

### 1. CacheNames 缓存组常量（约定即配置）

`CacheNames` 的注释定义了 key 格式：`cacheNames#ttl#maxIdleTime#maxSize#local`：

- `ttl` 过期时间（0 不过期，默认 0）
- `maxIdleTime` 最大空闲时间，LRU 清理（0 不检测）
- `maxSize` 组最大长度，LRU 清理溢出（0 无限）
- `local` 本地一级缓存开关（1 开，0 关，默认 1）

真实常量片段：

```java
String SYS_CONFIG    = "sys_config";
String SYS_DICT      = "sys_dict";
String SYS_DICT_TYPE = "sys_dict_type";
String SYS_CLIENT    = "sys_client#30d";          // 30 天过期
String SYS_USER_NAME = "sys_user_name#30d";
String DEMO_CACHE    = "demo:cache#60s#10m#20";   // 60s ttl，10m 空闲，最多 20 条
```

> `PlusSpringCacheManager` 会把 `#` 后的参数解析为 Redisson `CacheConfig`，并叠加 Caffeine 本地缓存（`local=1` 时）。

### 2. 注解式缓存（推荐）

```java
// 查询：命中缓存直接返回，未命中执行方法并写入。key 用 SpEL
@Cacheable(cacheNames = CacheNames.SYS_DICT, key = "#dictType")
public List<SysDictDataVo> selectDictDataByType(String dictType) {
    List<SysDictDataVo> dictDatas = dictDataMapper.selectDictDataByType(dictType);
    // 🔴 返回 Collections.emptyList() 防止缓存穿透（也可 new ArrayList<>()）
    return CollUtil.isNotEmpty(dictDatas) ? dictDatas : Collections.emptyList();
}

// 新增/修改：执行方法后把返回值写入缓存
@CachePut(cacheNames = CacheNames.SYS_DICT, key = "#bo.dictType")
public List<SysDictDataVo> insertDictType(SysDictTypeBo bo) {
    SysDictType dict = MapstructUtils.convert(bo, SysDictType.class);
    int row = dictTypeMapper.insert(dict);
    if (row > 0) {
        // 🔴 新增后无数据，返回 new ArrayList<>() —— 不可变集合反序列化会出错
        return new ArrayList<>();
    }
    throw new ServiceException("操作失败");
}

// 删除缓存
@CacheEvict(cacheNames = CacheNames.SYS_DICT_TYPE, key = "#dictType")
public void removeOne(String dictType) { ... }

// 组合多个缓存操作
@Caching(evict = {
    @CacheEvict(cacheNames = CacheNames.SYS_DICT, key = "#dictType"),
    @CacheEvict(cacheNames = CacheNames.SYS_DICT_TYPE, key = "#dictType")
})
public void clearDict(String dictType) { ... }
```

### 3. CacheUtils 手动操作（无法用注解时）

`CacheUtils` 通过 Spring `CacheManager` 操作，与注解共用同一套 CacheNames：

```java
// 手动 get / put / evict / clear
SysDictTypeVo vo = CacheUtils.get(CacheNames.SYS_DICT_TYPE, dictType);
CacheUtils.put(CacheNames.SYS_DICT_TYPE, dictType, vo);
CacheUtils.evict(CacheNames.SYS_DICT, oldDict.getDictType());  // 删单个 key
CacheUtils.clear(CacheNames.SYS_DICT);                         // 清空整组
```

真实用法（`SysDictTypeServiceImpl`）：删除/更新字典时手动 `evict` 两组缓存，重置时 `clear`：

```java
CacheUtils.evict(CacheNames.SYS_DICT, x.getDictType());
CacheUtils.evict(CacheNames.SYS_DICT_TYPE, x.getDictType());
// 重置全部字典缓存
CacheUtils.clear(CacheNames.SYS_DICT);
CacheUtils.clear(CacheNames.SYS_DICT_TYPE);
```

> ⚠️ `CacheUtils` 若传入未定义的 cacheNames（getCache 返回 null）会抛 `IllegalArgumentException("Cache 'xxx' does not exist.")`，但 dynamic 模式下首次访问会自动创建，一般不会触发。

---

## 四、分布式锁

6.x 提供两种方式，README 明确：「分布式锁采用 **Lock4j 底层基于 Redisson**」。

### 方式 A：Lock4j 注解（推荐，最简单，自动续期）

`@Lock4j` 来自 `com.baomidou.lock.annotation.Lock4j`，全局配置在 `application.yml`：

```yaml
--- # 分布式锁 lock4j 全局配置
lock4j:
  acquire-timeout: 3000   # 获取锁超时（ms），默认 3000
  expire: 30000           # 锁超时（ms），默认 30s
```

```java
// 默认锁（用全部参数生成 key）
@Lock4j
public LoginVo login(LoginBody body) { ... }

// 指定 key（SpEL）+ 自定义超时
@Lock4j(keys = {"#dataName"}, acquireTimeout = 10000)
public void download(String dataName) { ... }

// 多 key 拼接
@Lock4j(keys = {"#startProcessBo.flowCode + #startProcessBo.businessId"})
public void startWorkFlow(StartProcessBo startProcessBo) { ... }
```

获取锁失败时由 `RedisExceptionHandler` 统一处理（记录「获取锁失败...发生Lock4j异常」并返回友好提示）。

### 方式 B：LockTemplate 编程式（需要 🔴 finally 释放）

```java
@Autowired
private LockTemplate lockTemplate;

public R<String> handle(String key, String value) {
    // 参数：key、expire(ms)、acquireTimeout(ms)、执行器
    final LockInfo lockInfo = lockTemplate.lock(key, 30000L, 5000L, RedissonLockExecutor.class);
    if (null == lockInfo) {
        throw new RuntimeException("业务处理中,请稍后再试");
    }
    try {
        // 获取锁成功，处理业务
        return R.data(value);
    } finally {
        // 🔴 必须在 finally 释放锁，否则死锁
        lockTemplate.releaseLock(lockInfo);
    }
}
```

### 方式 C：Redisson 原生 RLock（最底层，最灵活）

通过 `RedisUtils.getClient()` 拿到 `RedissonClient` 再取锁：

```java
RLock lock = RedisUtils.getClient().getLock("coupon:receive:" + templateId);
try {
    // tryLock(等待时间, 锁租期, 单位)；锁租期建议设置避免业务异常长期占锁
    if (lock.tryLock(3, 10, TimeUnit.SECONDS)) {
        // 业务逻辑
    } else {
        throw new ServiceException("操作太频繁,请稍后再试");
    }
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
    throw new ServiceException("获取锁被中断");
} finally {
    // 🔴 必须判断当前线程持有再释放，避免释放别人的锁
    if (lock.isHeldByCurrentThread()) {
        lock.unlock();
    }
}
```

> 选型建议：优先 `@Lock4j`（声明式、自动续期、无需手动释放）；需要在方法内部精细控制加解锁范围时用 `LockTemplate`；需要读写锁/公平锁/联锁等高级语义时用原生 `RLock`。

---

## 五、限流 @RateLimiter

注解 `org.dromara.common.redis.annotation.RateLimiter`，由 `RateLimiterAspect`（`@Before`）拦截，底层调用 `RedisUtils.rateLimiter()`（Redisson `RRateLimiter` 令牌桶）。

注解参数（真实定义）：

| 参数 | 默认 | 说明 |
|------|------|------|
| `key` | `""` | 限流 key，支持 SpEL（如 `#phoneNumber`、`#{#code}`） |
| `time` | `60` | 限流时间窗口（秒） |
| `count` | `100` | 窗口内允许次数 |
| `limitType` | `DEFAULT` | 限流类型：`DEFAULT`(全局) / `IP`(按请求IP) / `CLUSTER`(集群实例) |
| `message` | `{rate.limiter.message}` | 提示消息，支持国际化（`{code}` 会经 MessageUtils 解析） |
| `timeout` | `86400` | 限流策略存活时间（秒，默认一天） |

真实用法（`CaptchaController` / demo）：

```java
// 同一手机号 60 秒只能发 1 次验证码
@RateLimiter(key = "#phoneNumber", time = 60, count = 1)
@GetMapping("/resource/sms/code")
public R<Void> smsCode(String phoneNumber) { ... }

// 按 IP 限流：60 秒最多 10 次
@RateLimiter(time = 60, count = 10, limitType = LimitType.IP)
public CaptchaVo getCodeImpl() { ... }

// 全局限流：10 秒最多 2 次
@RateLimiter(count = 2, time = 10)
@GetMapping("/test")
public R<String> test(String value) { ... }
```

限流命中（`number == -1`）时抛 `ServiceException`，并按 message 国际化。
`limitType=IP` 时 aspect 会拼接 `ServletUtils.getClientIP()`，`CLUSTER` 时拼接客户端实例 id（`RateType.PER_CLIENT`）。

> 防重复提交用 `@RepeatSubmit(interval = 5000, timeUnit = TimeUnit.MILLISECONDS)`，机制类似，按表单内容在间隔内拦截重复请求。

---

## 六、发布订阅（RTopic）

```java
// 发布消息
RedisUtils.publish("sys:msg", payload);
// 发布并附带本地回调
RedisUtils.publish("sys:msg", payload, msg -> log.info("已发布:{}", msg));

// 订阅（返回监听器 id，可用于取消）
int listenerId = RedisUtils.subscribeAndGetListenerId("sys:msg", String.class, msg -> {
    log.info("收到消息:{}", msg);
});
// 取消订阅
RedisUtils.unsubscribe("sys:msg", listenerId);
```

> 典型场景：集群下多实例间广播缓存失效通知、WebSocket/SSE 跨节点消息分发。

---

## 七、序列化机制（🔴 务必核对真实配置）

序列化在 `RedisConfig.redissonCustomizer()` 中配置。**本 6.x 快照的实际激活配置**：

```java
// key 用 String，value 用 Jackson3（TypedJsonJackson3Codec）的组合编解码
TypedJsonJackson3Codec jsonCodec = new TypedJsonJackson3Codec(Object.class, jsonMapper);
CompositeCodec codec = new CompositeCodec(StringCodec.INSTANCE, jsonCodec, jsonCodec);
config.setCodec(codec);
```

关键点（按源码逐条核对）：

1. **当前激活的是 JSON 序列化（Jackson 3.X / `tools.jackson` 包）**，不是 Fory。源码中 Fory 的 `ForyCodec` 代码是**注释掉的**：
   ```java
   // ForyCodec foryCodec = new ForyCodec();
   // CompositeCodec codec = new CompositeCodec(StringCodec.INSTANCE, foryCodec, foryCodec);
   ```
   `pom.xml` 已引入 `org.apache.fory:fory-core:1.2.0` 依赖（替代 JSON 做高性能二进制序列化是官方方向），但**此快照尚未启用**，是预留切换项。生产若要启用 Fory，需自行实现/打开 `ForyCodec` 并替换 CompositeCodec。
2. JSON 序列化开启了 `activateDefaultTyping(NON_FINAL)`，会把对象**全类名**一起写入（用于反序列化还原具体类型）。因安全策略，Jackson 3.X 禁用了 `LaissezFaireSubTypeValidator`，改用 `BasicPolymorphicTypeValidator`（默认放行所有类型，注释建议生产改为包名白名单 `allowIfBaseType("org.dromara")`）。
3. `LocalDateTime` 用自定义 `yyyy-MM-dd HH:mm:ss` 格式序列化/反序列化。
4. Redisson 还设置了 `keyPrefix`（`redisson.keyPrefix`，dev/prod 默认空）与 `KeyPrefixHandler`，统一管理 key 命名空间。

> 因为开启了 NON_FINAL 类型写入，**反序列化要求类型可还原**——这正是「@Cacheable 不能返回不可变集合」的根因（见下方常见错误）。

---

## 八、缓存三大问题与防护

| 问题 | 含义 | 6.x 推荐做法 |
|------|------|-------------|
| **缓存穿透** | 查不存在的数据，每次都打到 DB | 查不到也缓存空值（`new ArrayList<>()` / `Collections.emptyList()`，源码字典就这么做）；或布隆过滤器 |
| **缓存雪崩** | 大量 key 同一时刻过期 | TTL 加随机偏移（如 `30d` 基础 + 随机几分钟）；CacheNames 用不同 ttl 错峰；Caffeine 本地一级缓存兜底 |
| **缓存击穿** | 热点 key 过期瞬间高并发打 DB | 用分布式锁（`@Lock4j` / `RLock`）只放一个线程重建缓存；或热点 key 不过期 + 异步刷新 |

---

## 九、缓存 key 命名规范

- **业务前缀 + 冒号分层**：`模块:实体:标识`，如 `sys_dict`、`online_tokens:`、`pwd_err_cnt:`（均取自 CacheNames）。
- **Spring Cache 组**：用 `CacheNames.*` 常量，禁止散落魔法字符串；过期/容量写进 `#ttl#maxIdle#maxSize#local`。
- **手写 RedisUtils key**：从 `GlobalConstants`（如 `CAPTCHA_CODE_KEY`、`RATE_LIMIT_KEY`）取统一前缀，避免拼写漂移。
- **多租户**：`keys()/deleteKeys()` 不带租户隔离，跨租户操作必须手动拼租户 id。

---

## 十、常见错误对比（🔴 必看）

### 错误 1：@Cacheable 返回不可变集合

```java
// ❌ 错误：List.of() 是不可变集合，反序列化时无法还原 → 报错或运行异常
@Cacheable(cacheNames = CacheNames.SYS_DICT, key = "#dictType")
public List<SysDictDataVo> bad(String dictType) {
    return List.of();          // 错！Set.of()/Map.of() 同理
}

// ✅ 正确：用可变集合
@Cacheable(cacheNames = CacheNames.SYS_DICT, key = "#dictType")
public List<SysDictDataVo> good(String dictType) {
    return new ArrayList<>();   // 或 Collections.emptyList()（源码字典即这么写）
}
```
原因：Redisson JSON codec 开启了 `DefaultTyping(NON_FINAL)`，需把具体类型写入并还原；`List.of()` 返回的 `ImmutableCollections` 无可用构造，反序列化失败。

### 错误 2：分布式锁不在 finally 释放

```java
// ❌ 错误：业务抛异常时锁永不释放 → 死锁，直到 expire 超时
RLock lock = RedisUtils.getClient().getLock("k");
lock.lock();
doBiz();          // 抛异常这里就 return 了
lock.unlock();    // 永远走不到

// ✅ 正确：finally 释放 + 持有判断
RLock lock = RedisUtils.getClient().getLock("k");
lock.lock();
try {
    doBiz();
} finally {
    if (lock.isHeldByCurrentThread()) lock.unlock();
}
// 或直接用 @Lock4j 注解，框架自动释放
```

### 错误 3：用 keys()/deleteKeys() 时忽略租户隔离

```java
// ❌ 错误：以为只删当前租户，实际全库匹配，跨租户误删
RedisUtils.deleteKeys("user:cache:*");

// ✅ 正确：手动拼租户 id（keys/deleteKeys 不做租户隔离）
String tenantId = LoginHelper.getTenantId();
RedisUtils.deleteKeys("user:cache:" + tenantId + ":*");
```

### 错误 4（附加）：包名/查询写成旧版

```java
// ❌ 旧版（5.x 之前 / 其它衍生版）：com.ruoyi / plus.ruoyi、PlusLambdaQuery、likeCast
// ✅ 6.x：org.dromara，查询用 QueryBuilder.lambda()，对象转换用 MapstructUtils.convert()
```

---

## 十一、最佳实践清单

1. **能用注解就用注解**：`@Cacheable/@CachePut/@CacheEvict` 优先于手写 RedisUtils，缓存逻辑与业务解耦。
2. **缓存组集中定义**：所有 cacheNames 写进 `CacheNames`，TTL/容量随常量声明，禁止散落。
3. **返回值必须可变**：缓存方法返回集合一律 `new ArrayList<>()`/`new HashMap<>()`，杜绝 `xxx.of()`。
4. **锁优先 @Lock4j**：声明式、自动续期、异常安全；编程式锁务必 finally 释放并判断持有。
5. **限流就近声明**：`@RateLimiter` 放在 Controller 方法上，验证码/短信等敏感接口必加。
6. **防穿透缓存空值**：查不到也缓存空集合，配合合理 TTL。
7. **防雪崩错峰过期**：批量 key 的 TTL 加随机量；用 Caffeine 本地缓存兜底（`local=1`）。
8. **租户场景手动拼前缀**：`keys()/deleteKeys()` 不隔离租户，跨租户操作前先想清楚作用域。
9. **序列化按需切换**：当前用 Jackson3 JSON（可读、跨语言友好）；性能敏感且 value 量大时再评估启用 Fory（依赖已就绪）。
10. **生产收紧类型白名单**：将 `BasicPolymorphicTypeValidator` 改为 `allowIfBaseType("org.dromara")`，防反序列化漏洞。

---

## 参考源码（均为本仓库真实路径）

- `ruoyi-common/ruoyi-common-redis/src/main/java/org/dromara/common/redis/utils/RedisUtils.java`
- `ruoyi-common/ruoyi-common-redis/src/main/java/org/dromara/common/redis/utils/CacheUtils.java`
- `ruoyi-common/ruoyi-common-redis/src/main/java/org/dromara/common/redis/config/RedisConfig.java`（序列化 codec）
- `ruoyi-common/ruoyi-common-redis/src/main/java/org/dromara/common/redis/config/CacheConfig.java`（Caffeine + CacheManager）
- `ruoyi-common/ruoyi-common-redis/src/main/java/org/dromara/common/redis/manager/PlusSpringCacheManager.java`
- `ruoyi-common/ruoyi-common-redis/src/main/java/org/dromara/common/redis/annotation/RateLimiter.java` + `aspectj/RateLimiterAspect.java` + `enums/LimitType.java`
- `ruoyi-common/ruoyi-common-core/src/main/java/org/dromara/common/core/constant/CacheNames.java`
- `ruoyi-modules/ruoyi-system/.../service/impl/SysDictTypeServiceImpl.java`（@Cacheable/@CachePut/CacheUtils 真实用法）
- `ruoyi-modules/ruoyi-demo/.../controller/RedisLockController.java`（@Lock4j + LockTemplate）
- `ruoyi-admin/.../web/controller/CaptchaController.java`（@RateLimiter 真实用法）
- `ruoyi-admin/src/main/resources/application.yml`（lock4j 全局配置）
- 根 `pom.xml`（redisson 4.6.1 / lock4j 2.2.7 / fory 1.2.0）
