---
name: scheduled-jobs
description: |
  base-dev-framework6-java定时任务与分布式调度开发指南。框架以 SnailJob 2.0.0
  （com.aizuda，阿里开源，取代早期 PowerJob / XXL-Job 路线）为分布式调度核心：业务侧是
  client（ruoyi-common-job + ruoyi-job），调度侧是独立 server（ruoyi-extend/ruoyi-snailjob-server），
  任务执行器用 @JobExecutor / AbstractJobExecutor 编写，支持失败重试、可视化管理、广播、
  静态分片、Map / MapReduce 动态分片、DAG 工作流编排。简单进程内周期任务用 Spring 内置
  @Scheduled（@EnableScheduling 已在 SnailJobConfig 开启）；毫秒级延时 / 事件驱动用
  ruoyi-common-redis 的 QueueUtils（Redisson 阻塞队列 + subscribeOnElements 订阅，注意官方
  延迟队列已废弃）。所有约定均来自 org.dromara.job / org.dromara.common.job /
  org.dromara.common.redis 真实源码与 application-*.yml 的 snail-job: 段，类名注解一律真实不编造。

  触发场景：
  - 需要写一个由调度中心统一管理、可视化配置 cron、失败自动重试的分布式定时任务（账单、对账、批量加密、数据归档）。
  - 需要把一个大任务拆成多个分片并行跑（静态分片 / Map / MapReduce），或用 DAG 工作流把多个任务串成有向依赖。
  - 需要做"下单 N 分钟未支付自动取消""定时清理临时文件"这类延时 / 周期触发，要在 SnailJob、@Scheduled、Redisson 队列三者间选型。

  触发词：定时任务、SnailJob、延迟队列、@Scheduled、任务调度、重试机制、工作流编排、分布式任务、@JobExecutor、Redisson延迟队列、订单超时、周期任务、定时、分片任务、MapReduce、广播任务、DAG、QueueUtils、ExecuteResult、任务分片
---

# scheduled-jobs - 定时任务与分布式调度（base-dev-framework6-java）

> 6.x 铁律：包名 `org.dromara`；三层架构无 DAO；禁止 `plus.ruoyi` / `com.ruoyi` 包名，
> 禁止 `PlusLambdaQuery` / `likeCast`，禁止默认继承 `TenantEntity`，逻辑删除字段不是 `is_deleted`。
> 本技能所有类名、注解、方法名均来自真实源码核对，不得替换为其它若依分支的写法。

## 一、概述

本框架的"定时 / 调度"能力由三套机制构成，**互补而非替代**，选型取决于"调度复杂度 + 是否需要可视化 + 延时精度"：

| 机制 | 模块 / 类 | 调度位置 | 适用 |
|------|-----------|----------|------|
| **SnailJob 2.0.0** | `ruoyi-common-job`（client）+ `ruoyi-extend/ruoyi-snailjob-server`（server） | 独立调度中心，可视化配置 | 分布式、需重试、需分片 / 工作流、跨实例统一管理的"重"任务 |
| **@Scheduled** | Spring 内置，`@EnableScheduling`（在 `SnailJobConfig` 已开启） | 当前 JVM 进程内 | 单机、固定周期、逻辑简单、不需要可视化的"轻"任务 |
| **Redisson 队列** | `ruoyi-common-redis` 的 `QueueUtils`（`org.dromara.common.redis.utils`） | Redis，事件驱动订阅 | 阻塞队列 / 优先队列 + `subscribeOnElements` 订阅式消费 |

真实模块依赖（`ruoyi-common-job/pom.xml`）：`snail-job-client-starter` + `snail-job-client-job-core`；
根 `pom.xml` 中 `<snailjob.version>2.0.0</snailjob.version>`，并提供 `snail-job-client-retry-core`（重试核心）。

启用开关（`SnailJobConfig`，包 `org.dromara.common.job.config`）：

```java
@AutoConfiguration
@ConditionalOnProperty(prefix = "snail-job", name = "enabled", havingValue = "true")
@EnableScheduling            // ← Spring @Scheduled 由此开启
@EnableSnailJob              // ← com.aizuda.snailjob.client.starter.EnableSnailJob
public class SnailJobConfig {
    // 客户端启动时挂载远程日志 appender（SnailLogbackAppender），
    // 让 SnailJobLog.REMOTE 输出能回传调度中心
    @EventListener(SnailClientStartingEvent.class)
    public void onStarting(SnailClientStartingEvent event) { /* ... */ }
}
```

> 关键事实：`snail-job.enabled` 默认 `false`（见 `application-dev.yml`）。**不开这个开关，SnailJob client 不启动，但 `@Scheduled` 也连带不生效**（因为 `@EnableScheduling` 写在同一个被 `@ConditionalOnProperty` 守护的配置类上）。要用任意一种机制，先把 `snail-job.enabled: true`。

## 二、三方案选型对比（必读）

| 维度 | SnailJob 2.0.0 | @Scheduled | Redisson QueueUtils |
|------|----------------|------------|---------------------|
| **典型场景** | 分布式复杂任务（对账、批量、分片、工作流） | 简单周期任务（每分钟刷缓存、心跳） | 事件驱动延时 / 解耦（订单超时、异步削峰） |
| **触发方式** | 调度中心按 cron / 固定频率 / 工作流下发 | 进程内 cron / fixedRate / fixedDelay | 业务投递元素 → 订阅回调消费 |
| **可视化管理** | ✅ 有控制台（snailjob-server，端口 17888） | ❌ 改代码重启 | ❌ 无 |
| **失败重试** | ✅ 内置，重试策略可视化配置 | ❌ 自己 try-catch | ❌ 自己保证幂等 |
| **分片 / 并行** | ✅ 静态分片 / Map / MapReduce | ❌ | ❌ |
| **工作流编排** | ✅ DAG（节点上下文传递） | ❌ | ❌ |
| **跨实例** | ✅ 调度中心统一分派，不会重复跑 | ⚠️ 多实例会各跑一份（需自己加分布式锁） | ✅ Redis 天然共享 |
| **延时精度** | 秒级（cron 最小到秒） | 秒级 | 毫秒级（队列即时） |
| **额外部署** | 需独立部署 server + 建库表 | 无 | 需 Redis（项目已有） |

**决策口诀**：
- 要可视化 / 要重试 / 要分片 / 要工作流 / 多实例不能重复跑 → **SnailJob**。
- 单机、逻辑简单、改代码无所谓 → **@Scheduled**。
- "投递一个事件，过会儿或立刻异步处理" / 削峰解耦 → **Redisson QueueUtils**。

> ⚠️ "订单超时取消"这类延时业务：**首选用 SnailJob 配一个秒级 cron 扫描"超时未支付"订单**（可视化、可重试、集群安全），不要指望 Redisson 的延迟队列——见第五节，框架内 Redisson 延迟队列已被官方废弃。

## 三、SnailJob 2.0.0 用法

### 3.1 架构与配置

- **Client（业务端）**：`ruoyi-common-job`（启动配置） + `ruoyi-job`（任务执行器示例，包 `org.dromara.job.snailjob`）。
- **Server（调度中心）**：`ruoyi-extend/ruoyi-snailjob-server`，引入 `snail-job-server-starter`，独立 Spring Boot 应用，控制台端口 `17888`。

client 配置（`application-dev.yml` 的 `snail-job:` 段，真实字段）：

```yaml
snail-job:
  enabled: false                              # 总开关，要用改 true
  group: "ruoyi_group"                        # 必须先在 SnailJob 后台「组管理」建同名组
  token: "SJ_cKqBTPzCsWA3VyuCfFoccmuIEGXjr5KT" # 接入令牌，见 sj_group_config 表
  server:
    host: 127.0.0.1
    port: 17888                               # 调度中心地址
  namespace: ${spring.profiles.active}        # 命名空间，见 sj_namespace 表 unique_id
  port: 2${server.port}                        # 客户端端口随主应用端口漂移
  host:                                        # 客户端 IP，可不填自动获取
```

> 落库脚本：`script/sql/ry_job.sql`（含 `sj_group_config`、`sj_namespace` 等表）。

### 3.2 任务执行器的两种写法（真实注解 com.aizuda.snailjob.*）

**写法 A：注解式 @JobExecutor**（推荐，最常用）—— 任意被 `@Component` 管理的类，方法名默认 `jobExecute`：

```java
package org.dromara.job.snailjob;

import com.aizuda.snailjob.client.job.core.annotation.JobExecutor;
import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.common.log.SnailJobLog;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import org.springframework.stereotype.Component;

@Component
@JobExecutor(name = "testJobExecutor")   // name 必须与控制台「执行器名称」一致
public class TestAnnoJobExecutor {

    public ExecuteResult jobExecute(JobArgs jobArgs) {
        // LOCAL=本地日志；REMOTE=回传调度中心，可视化查看
        SnailJobLog.LOCAL.info("本地日志");
        SnailJobLog.REMOTE.info("远程日志 args:{}", jobArgs.getJobParams());
        return ExecuteResult.success("测试成功");   // 失败用 ExecuteResult.failure("原因")
    }
}
```

**写法 B：继承 AbstractJobExecutor**（重写 `doJobExecute`，模板方法风格）：

```java
package org.dromara.job.snailjob;

import com.aizuda.snailjob.client.job.core.dto.JobArgs;
import com.aizuda.snailjob.client.job.core.executor.AbstractJobExecutor;
import com.aizuda.snailjob.model.dto.ExecuteResult;
import org.springframework.stereotype.Component;

@Component
public class TestClassJobExecutor extends AbstractJobExecutor {
    @Override
    protected ExecuteResult doJobExecute(JobArgs jobArgs) {
        return ExecuteResult.success("TestJobExecutor测试成功");
    }
}
```

> 返回值固定是 `com.aizuda.snailjob.model.dto.ExecuteResult`：`success(Object)` / `failure(Object)`。
> 返回 `failure` 或抛异常 → 触发调度中心配置的重试策略。

### 3.3 失败重试

- 框架已引入 `snail-job-client-retry-core`（根 pom，2.0.0），重试逻辑由 **调度中心可视化配置**：重试次数、重试间隔（等差 / 等比 / cron）、触发条件。
- 执行器只要 **抛异常或返回 `ExecuteResult.failure(...)`** 即视为失败，由 server 接管重试，无需在代码里手写循环重试。
- 广播任务示例 `TestBroadcastJob` 用 `throw new RuntimeException(...)` 主动制造失败，验证重试链路。

### 3.4 广播任务（每个 client 节点都跑一遍）

```java
@Slf4j
@Component
@JobExecutor(name = "testBroadcastJob")
public class TestBroadcastJob {
    @Value("${snail-job.port}")
    private int clientPort;

    public ExecuteResult jobExecute(JobArgs jobArgs) {
        SnailJobLog.REMOTE.info("客户端端口:{}", clientPort);
        // 集群下每个节点都会收到并执行，常用于"全节点清本地缓存""刷新本地配置"
        return ExecuteResult.success("ok");
    }
}
```

### 3.5 静态分片（按服务端任务参数切分）

```java
@Component
@JobExecutor(name = "testStaticShardingJob")
public class TestStaticShardingJob {
    public ExecuteResult jobExecute(JobArgs jobArgs) {
        // 控制台任务参数形如 "1,1000"，服务端把不同分片下发给不同节点
        String jobParams = Convert.toStr(jobArgs.getJobParams());
        String[] split = jobParams.split(",");
        Long fromId = Long.parseLong(split[0]);
        Long toId = Long.parseLong(split[1]);
        SnailJobLog.REMOTE.info("处理 id 范围:{}-{}", fromId, toId);
        // ... 对该 id 段做批量加密 / 归档
        return ExecuteResult.success("分片完成");
    }
}
```

### 3.6 Map / MapReduce 动态分片（核对真实注解 @MapExecutor / @ReduceExecutor）

`MapArgs` / `MapHandler` / `ReduceArgs` 均来自 `com.aizuda.snailjob.client.job.core.*`：

```java
@SuppressWarnings({"unchecked", "rawtypes"})
@Component
@JobExecutor(name = "testMapReduceAnnotation1")
public class TestMapReduceAnnotation1 {

    // 1) 根 Map：把数据切片，doMap 下发子任务名 "doCalc"
    @MapExecutor
    public ExecuteResult rootMapExecute(MapArgs mapArgs, MapHandler mapHandler) {
        List<Integer> sourceList = IntStream.rangeClosed(1, 200).boxed().toList();
        List<List<Integer>> partition = StreamUtils.groupByKey(sourceList, i -> (i - 1) / 50)
            .values().stream().toList();
        return mapHandler.doMap(partition, "doCalc");
    }

    // 2) 子任务：处理单个分片（taskName 对应 doMap 第二参）
    @MapExecutor(taskName = "doCalc")
    public ExecuteResult doCalc(MapArgs mapArgs) {
        List<Integer> sourceList = (List<Integer>) mapArgs.getMapResult();
        int partitionTotal = sourceList.stream().mapToInt(i -> i).sum();
        return ExecuteResult.success(partitionTotal);
    }

    // 3) Reduce：汇总所有分片结果（MapReduce 比纯 Map 多这一步）
    @ReduceExecutor
    public ExecuteResult reduceExecute(ReduceArgs reduceArgs) {
        int reduceTotal = reduceArgs.getMapResult().stream()
            .mapToInt(i -> Integer.parseInt((String) i)).sum();
        return ExecuteResult.success(reduceTotal);
    }
}
```

> 纯 Map 任务（只分片不汇总）= 去掉 `@ReduceExecutor`，见 `TestMapJobAnnotation`。

### 3.7 DAG 工作流编排（节点间上下文传递）

工作流把多个 `@JobExecutor` 节点按有向依赖串起来，节点间用 `JobArgs.getWfContext()` / `appendContext()` 传数据（真实方法）：

```java
@Component
@JobExecutor(name = "alipayBillTask")        // 工作流上游节点
public class AlipayBillTask {
    public ExecuteResult jobExecute(JobArgs jobArgs) throws InterruptedException {
        String settlementDate = (String) jobArgs.getWfContext().get("settlementDate");
        if (StringUtils.equals(settlementDate, "sysdate")) {
            settlementDate = DateUtils.now();
        }
        BillDTO billDTO = new BillDTO(23456789L, "alipay", settlementDate, new BigDecimal("2345.67"));
        jobArgs.appendContext("alipay", JsonUtils.toJsonString(billDTO));  // 写入上下文供下游读
        return ExecuteResult.success(billDTO);
    }
}

@Component
@JobExecutor(name = "summaryBillTask")       // 工作流下游汇总节点
public class SummaryBillTask {
    public ExecuteResult jobExecute(JobArgs jobArgs) throws InterruptedException {
        String alipay = (String) jobArgs.getWfContext("alipay");   // 读上游写入的上下文
        BigDecimal alipayAmount = StringUtils.isNotBlank(alipay)
            ? JsonUtils.parseObject(alipay, BillDTO.class).billAmount() : BigDecimal.ZERO;
        // 同理读 wechat 节点上下文，汇总
        return ExecuteResult.success(alipayAmount);
    }
}
```

> `BillDTO` 是 `record`（`org.dromara.job.entity.BillDTO`）：`billId / billChannel / billDate / billAmount`。
> 工作流的"节点依赖关系（DAG）"在控制台可视化拖拽，代码侧只管单节点逻辑 + 上下文读写。

## 四、@Scheduled（Spring 内置简单周期任务）

`@EnableScheduling` 已由 `SnailJobConfig` 开启（前提 `snail-job.enabled: true`）。写法：

```java
package org.dromara.system.task;   // 放在对应业务模块，包名 org.dromara.*

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class CacheRefreshTask {

    // cron：每天 02:00 执行（秒 分 时 日 月 周）
    @Scheduled(cron = "0 0 2 * * ?")
    public void refreshDailyCache() {
        log.info("每日缓存刷新");
    }

    // 固定频率：上次开始后 60s 再触发（不等上次结束）
    @Scheduled(fixedRate = 60000)
    public void heartbeat() {
        log.info("心跳");
    }

    // 固定延迟：上次结束后再隔 30s（适合任务耗时不定）
    @Scheduled(fixedDelay = 30000)
    public void cleanTemp() {
        log.info("清理临时文件");
    }
}
```

> ⚠️ **多实例陷阱**：`@Scheduled` 在每个 JVM 各跑一份。生产多副本部署时，同一任务会被并发执行多次。
> 要么改用 SnailJob（调度中心保证只分派一次），要么在方法内用 `ruoyi-common-redis` 的 `RedisUtils` 分布式锁（`RLock`）抢锁后再执行。本框架默认不给 `@Scheduled` 自动加锁。

## 五、Redisson 队列（事件驱动 / 延时，QueueUtils）

`org.dromara.common.redis.utils.QueueUtils`（要求 Redis 5.x 以上）。**核对真实源码：项目内 Redisson 官方延迟队列已被废弃**——
`subscribeBlockingQueue` 源码注释明确写着"延迟队列已经被 redisson 官方废弃不建议使用"，`getDelayedQueue` 调用被注释掉了。
因此 `QueueUtils` 实际只提供：普通阻塞队列、优先阻塞队列、订阅式消费。

真实 API（全部 `static`）：

| 方法 | 作用 |
|------|------|
| `addQueueObject(name, data)` | 投递普通队列元素 |
| `getQueueObject(name)` | 取一个（无则 null，**不支持延迟**） |
| `addPriorityQueueObject(name, data)` | 投递优先队列元素 |
| `getPriorityQueueObject(name)` | 取优先队列元素 |
| `subscribeBlockingQueue(name, consumer)` | 订阅式消费（元素入队即回调，事件驱动） |
| `destroyQueue / destroyPriorityQueue(name)` | 销毁队列 |

```java
// 投递端：业务产生事件就投队列
QueueUtils.addQueueObject("order:notify", orderId);

// 消费端（一次性订阅，元素到达即回调，无需轮询）：
QueueUtils.subscribeBlockingQueue("order:notify", (Long orderId) -> {
    // 处理逻辑（注意：subscribeOnElements 回调，保证幂等）
    return CompletableFuture.completedFuture(null);
});
```

> **"订单超时取消"正确姿势**：不要用废弃的 Redisson 延迟队列。推荐
> ① 用 **SnailJob 配秒级 cron** 扫 `status=待支付 AND create_time < now()-30min` 的订单批量取消（集群安全、可重试、可视化）；
> ② 或下单时 `QueueUtils.addPriorityQueueObject` 投入带"到期时间戳"的优先队列 + 一个定时消费器轮询队首是否到期。
> 不要在文档/代码里假装框架有 `RDelayedQueue.offer(obj, delay, TimeUnit)` ——本框架已删除该能力。

## 六、常见错误对比（≥3）

| # | 错误写法 | 正确写法 | 原因 |
|---|----------|----------|------|
| 1 | `@JobExecutor` 任务返回 `void` 或抛异常被自己 catch 吞掉 | 返回 `ExecuteResult.success(...)` / `failure(...)`，失败让它抛出 | 返回类型必须是 `ExecuteResult`；自己吞异常会让调度中心以为成功，重试链路失效 |
| 2 | 用 `QueueUtils.getDelayedQueue(...)` / `RDelayedQueue` 做订单延时取消 | 用 SnailJob 秒级 cron 扫描，或优先队列 + 到期判断 | 框架内 Redisson 延迟队列已被官方废弃并删除，无此 API，编造会编译失败 |
| 3 | 生产多副本直接用 `@Scheduled` 跑对账，结果对账跑了 N 次 | 改用 SnailJob（中心只分派一次），或方法内加 `RLock` 分布式锁 | `@Scheduled` 每个 JVM 各执行一份，无去重 |
| 4 | `snail-job.enabled: false` 还指望 `@Scheduled` 生效 | 要用任一调度先置 `snail-job.enabled: true` | `@EnableScheduling` 与 `@EnableSnailJob` 同在被 `@ConditionalOnProperty` 守护的 `SnailJobConfig` 上，开关关了两者都不启动 |
| 5 | `@JobExecutor(name="xxx")` 的 name 与控制台执行器名不一致 | name 必须与 SnailJob 控制台「执行器名称」严格相同 | 名称对不上，调度中心找不到执行器，任务"无可用客户端" |
| 6 | 把 `@JobExecutor` 类放到 `com.ruoyi.*` / `plus.ruoyi.*` 包 | 一律放 `org.dromara.*`（如 `org.dromara.job.snailjob`） | 6.x 包名铁律，错包名扫描不到 Bean |

## 七、最佳实践

1. **选型先行**：按第二节口诀定方案。需要可视化 / 重试 / 分片 / 工作流 / 集群去重 → SnailJob；单机简单周期 → @Scheduled；事件解耦 → QueueUtils。
2. **执行器命名**：`@JobExecutor(name=...)` 用小驼峰，且与控制台执行器名 1:1 对应，建议同名类放 `org.dromara.{module}.snailjob` 包统一管理。
3. **日志双写**：本地排查用 `SnailJobLog.LOCAL`，要在控制台可视化看执行日志用 `SnailJobLog.REMOTE`（远程 appender 已在 `SnailJobConfig` 挂载）。
4. **失败交给中心**：执行器内不要手写重试循环；失败就抛异常 / 返回 `failure`，重试策略在控制台配，便于统一调参。
5. **分片选型**：固定可预知范围用静态分片（参数 `"from,to"`）；数据量动态、要并行用 Map；要汇总结果用 MapReduce（加 `@ReduceExecutor`）。
6. **工作流上下文**：DAG 节点间只通过 `appendContext / getWfContext` 传值，且统一用 `JsonUtils`（`org.dromara.common.json.utils.JsonUtils`）序列化 DTO，避免类型不一致。
7. **@Scheduled 防重**：多实例环境一律配 `RLock` 抢锁或迁移到 SnailJob，杜绝重复执行。
8. **延时业务不碰废弃 API**：订单超时、定时清理优先 SnailJob cron；坚持用队列则用优先队列 + 到期判断，绝不引用已删除的 Redisson 延迟队列。
9. **环境隔离**：`namespace` 用 `${spring.profiles.active}` 区分 dev/prod，`group` 必须在控制台预先创建，`token` 与 `sj_group_config` 表一致。
10. **server 单独部署**：`ruoyi-snailjob-server` 是独立应用（含 Dockerfile），生产单独部署 + 建 `ry_job.sql` 库表，client 通过 `server.host:17888` 接入。

## 八、本仓库定时任务能力完整度

- **SnailJob client（业务侧）**：完整。`ruoyi-common-job` 提供启动配置，`ruoyi-job` 提供 8 个真实示例执行器，覆盖：注解式、继承式、广播、静态分片、Map、MapReduce、DAG 工作流（支付宝 / 微信 / 汇总账单）。
- **SnailJob server（调度侧）**：完整。`ruoyi-extend/ruoyi-snailjob-server` 是可独立部署的调度中心（含 Dockerfile、多 profile 配置）。
- **@Scheduled**：能力具备（`@EnableScheduling` 已开），但**框架未内置任何 @Scheduled 示例任务**——属可用未用，业务自行编写。
- **Redisson 队列**：具备阻塞 / 优先队列 + 订阅消费（`QueueUtils`），`ruoyi-demo` 有 `PriorityQueueController` 示例；**延迟队列能力已被官方废弃并从工具类移除**，这是本仓库唯一的"残缺点"，延时业务需用 SnailJob cron 替代。

引用真实源文件：
- `ruoyi-common/ruoyi-common-job/src/main/java/org/dromara/common/job/config/SnailJobConfig.java`
- `ruoyi-common/ruoyi-common-job/pom.xml`、`.../resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- `ruoyi-modules/ruoyi-job/src/main/java/org/dromara/job/snailjob/`：`TestAnnoJobExecutor`、`TestClassJobExecutor`、`TestBroadcastJob`、`TestStaticShardingJob`、`TestMapJobAnnotation`、`TestMapReduceAnnotation1`、`AlipayBillTask`、`SummaryBillTask`、`WechatBillTask`
- `ruoyi-modules/ruoyi-job/src/main/java/org/dromara/job/entity/BillDTO.java`
- `ruoyi-common/ruoyi-common-redis/src/main/java/org/dromara/common/redis/utils/QueueUtils.java`
- `ruoyi-extend/ruoyi-snailjob-server/`（pom.xml、Dockerfile、application-*.yml）
- 根 `pom.xml`（`snailjob.version=2.0.0`，snail-job-client-starter / job-core / retry-core）
- `ruoyi-admin/src/main/resources/application-dev.yml`（`snail-job:` 配置段）
