---
name: test-development
description: |
  base-dev-framework6-java测试开发技能。基于 JUnit5 + Mockito + AssertJ
  编写单元测试、Service 单测、Controller 测试、集成测试、工具类测试与参数化测试。
  贴合本仓库真实基座：仅引入 spring-boot-starter-test，无 ruoyi-common-test 统一基类，
  示例测试位于 backend/java/ruoyi-admin/src/test/java/org/dromara/test/。

  触发场景：
  - 编写单元测试（工具类、Service、Controller）与参数化测试
  - 用 Mockito Mock Mapper / RedisUtils / OssClient 等外部依赖做隔离单测
  - 编写 @SpringBootTest 集成测试（Spring 容器 + 测试库）或 MockMvc Web 层测试
  - 构造测试数据、提升测试覆盖率、按 @Tag 配合 profile 筛选执行

  触发词：测试、单元测试、集成测试、@Test、JUnit5、Mockito、Mock、断言、AssertJ、
  @SpringBootTest、@Mock、@InjectMocks、MockMvc、测试用例、测试覆盖率、参数化测试、
  @ParameterizedTest、@BeforeEach、@AfterEach、@MockBean、@WebMvcTest、@Tag、测试数据
---

# 测试开发（base-dev-framework6-java）

## 一、概述

本技能指导在 **base-dev-framework6-java** 中编写自动化测试。技术栈为 **Java 21 + Spring Boot 4.1.0**，统一包前缀 `org.dromara`，三层架构（Controller → Service → Mapper，**无 DAO 层**），构造器注入用 Lombok `@RequiredArgsConstructor`，查询用 MyBatis-Plus 的 `LambdaQueryWrapper` / `Wrappers.lambdaQuery()`。

### 本仓库测试基座完整度（如实说明）

经核对真实源码，本仓库**测试代码很少**，且**没有 `ruoyi-common-test` 统一测试基类模块**（`ruoyi-common` 下不存在 `ruoyi-common-test` 子模块）。当前真实情况：

- 测试依赖**仅一处**：`backend/java/ruoyi-admin/pom.xml` 声明了 `spring-boot-starter-test`（`scope=test`）。
  该 starter 由 Spring Boot 4 传递性带入 **JUnit5（Jupiter）+ Mockito + AssertJ + Hamcrest + JSONassert + Spring Test / MockMvc** 全套测试库，**无需额外声明 mockito/assertj 依赖**。
- 现有测试**仅 4 个纯 JUnit5 示例**，位于 `backend/java/ruoyi-admin/src/test/java/org/dromara/test/`：
  - `DemoUnitTest`：演示 `@BeforeAll/@AfterAll/@BeforeEach/@AfterEach/@Test/@DisplayName/@Disabled/@Timeout/@RepeatedTest` 与 `assertAll` 组合断言。
  - `AssertUnitTest`：演示 `assertEquals/assertNotEquals/assertSame/assertNotSame/assertTrue/assertFalse/assertNull/assertNotNull`。
  - `ParamUnitTest`：演示参数化 `@ParameterizedTest` + `@ValueSource/@NullSource/@EnumSource/@MethodSource`。
  - `TagUnitTest`：演示 `@Tag("dev"/"prod"/"local"/"exclude")` 配合构建 profile 筛选执行。
- 这 4 个示例**全部是纯 JUnit5 单测**：**没有** `@SpringBootTest`、**没有** Mockito（`@Mock/@InjectMocks`）、**没有** AssertJ（`assertThat`）、**没有** `MockMvc/@WebMvcTest` 的实战用例。
- 根 `pom.xml` 的 `maven-surefire-plugin`（3.5.5）配置了 `<groups>${profiles.active}</groups>` 与 `<excludedGroups>exclude</excludedGroups>` —— 这正是 `TagUnitTest` 用 `@Tag` 的原因：**打哪个环境的包就只跑带对应标签的测试，永远排除 `exclude` 标签**。

> **结论**：本技能给出的 Service 单测（Mock Mapper）、Controller 测试（MockMvc）、集成测试（`@SpringBootTest`）写法，属于"**基于 JUnit5/Mockito/AssertJ 的通用规范 + 本框架可用基座（spring-boot-starter-test 全套已就绪）**"。这些是**推荐补强写法**，仓库当前并无对应实例，也**不存在**任何统一测试基类可继承——下文绝不编造不存在的基类名（如 `BaseTest`、`RuoYiTest` 等本仓库都没有）。如需统一基类，请自行在测试目录新建一个抽象类，不要假装它已存在。

---

## 二、测试技术栈

| 能力 | 库 | 来源 | 常用注解 / API |
|------|-----|------|---------------|
| 测试框架 | JUnit5（Jupiter） | spring-boot-starter-test 传递 | `@Test` `@BeforeEach` `@AfterEach` `@BeforeAll` `@AfterAll` `@DisplayName` `@Disabled` `@Tag` `@Timeout` `@RepeatedTest` |
| 参数化 | JUnit5 Params | 同上 | `@ParameterizedTest` `@ValueSource` `@NullSource` `@EnumSource` `@MethodSource` `@CsvSource` |
| Mock | Mockito | 同上 | `@Mock` `@InjectMocks` `@ExtendWith(MockitoExtension.class)` `when().thenReturn()` `verify()` `any()` |
| 断言（旧式） | JUnit5 Assertions | 同上 | `assertEquals` `assertTrue` `assertNull` `assertThrows` `assertAll` |
| 断言（推荐） | AssertJ | 同上 | `assertThat(x).isEqualTo()` `.isNotNull()` `.hasSize()` `.extracting()` |
| Web 层测试 | Spring Test | 同上 | `MockMvc` `@WebMvcTest` `@SpringBootTest` `@MockBean` `MockMvcRequestBuilders` |

**版本注意点（Java 21 + Spring Boot 4）**：

- Spring Boot 4 起，`@MockBean`/`@SpyBean` 已**废弃迁移**为 `org.springframework.test.context.bean.override.mockito.@MockitoBean` / `@MockitoSpyBean`。新写集成测试时**优先用 `@MockitoBean`**；若沿用旧 `@MockBean` 也能跑，但建议统一到新注解。
- Mockito 在 JDK 21 下需 `mockito-core` 配套版本（由 starter 统一管理），**纯单测优先用 `@ExtendWith(MockitoExtension.class)`** 而非启动 Spring 容器，速度快、隔离干净。
- 不要使用 JUnit4（`org.junit.Test`、`@RunWith`）。本仓库统一 JUnit5（`org.junit.jupiter.api.*`）。

---

## 三、Service 单测（Mock Mapper，纯单测不启容器）

6.x 三层无 DAO，Service 直接依赖 **Mapper**（MyBatis-Plus）。Service 单测的核心是 **Mock 掉 Mapper**，只验证 Service 的业务编排逻辑，不连真实数据库。被测对象用 `@InjectMocks`，依赖用 `@Mock`。

要点：
- Service 用 `@RequiredArgsConstructor` 构造器注入（`private final TestDemoMapper demoMapper;`），Mockito 的 `@InjectMocks` 能自动把 `@Mock` 注入构造器。
- 凡是 Service 调用 Mapper 的方法（`selectVoById` / `insert` / `updateById` / `selectByIds` / `deleteByIds` 等）都要用 `when(...).thenReturn(...)` 打桩。
- 断言推荐用 **AssertJ** `assertThat(...)`；验证依赖调用用 `verify(...)`。

```java
package org.dromara.demo.service.impl;

import org.dromara.common.core.exception.ServiceException;
import org.dromara.demo.domain.TestDemo;
import org.dromara.demo.domain.vo.TestDemoVo;
import org.dromara.demo.mapper.TestDemoMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * TestDemoServiceImpl 纯单元测试：Mock 掉 Mapper，不启动 Spring 容器。
 */
@DisplayName("TestDemo Service 单元测试")
@ExtendWith(MockitoExtension.class)
class TestDemoServiceImplTest {

    /** 被 Mock 的依赖（6.x 无 DAO 层，Service 直接依赖 Mapper） */
    @Mock
    private TestDemoMapper demoMapper;

    /** 被测对象：Mockito 自动把上面的 @Mock 注入到 @RequiredArgsConstructor 构造器 */
    @InjectMocks
    private TestDemoServiceImpl testDemoService;

    @Test
    @DisplayName("queryById 命中数据时应返回对应 VO")
    void testQueryByIdHit() {
        TestDemoVo vo = new TestDemoVo();
        vo.setId(1L);
        vo.setTestKey("hello");
        // 打桩：Mapper 返回构造好的 VO
        when(demoMapper.selectVoById(1L)).thenReturn(vo);

        TestDemoVo result = testDemoService.queryById(1L);

        // AssertJ 断言
        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getTestKey()).isEqualTo("hello");
        // 验证 Mapper 被恰好调用一次
        verify(demoMapper, times(1)).selectVoById(1L);
    }

    @Test
    @DisplayName("insertByBo 插入成功时应回填主键并返回 true")
    void testInsertByBoSuccess() {
        // insert 返回 1 行表示成功；Service 内部会把生成的 id 回填到 bo
        when(demoMapper.insert(any(TestDemo.class))).thenReturn(1);

        // 此处省略 bo 构造，详见"测试数据构造"章节
        // Boolean ok = testDemoService.insertByBo(bo);
        // assertThat(ok).isTrue();
    }

    @Test
    @DisplayName("deleteWithValidByIds 数量不匹配时应抛 ServiceException")
    void testDeleteWithValidByIdsThrow() {
        List<Long> ids = List.of(1L, 2L, 3L);
        // 校验开启时，Mapper 只查到 2 条 -> 数量不匹配 -> 抛业务异常
        when(demoMapper.selectByIds(ids)).thenReturn(List.of(new TestDemo(), new TestDemo()));

        assertThatThrownBy(() -> testDemoService.deleteWithValidByIds(ids, true))
            .isInstanceOf(ServiceException.class)
            .hasMessageContaining("删除权限");

        // 因为前置校验已抛异常，真正的 deleteByIds 不应被调用
        verify(demoMapper, never()).deleteByIds(anyLong());
    }
}
```

> 关键：`when(demoMapper.xxx()).thenReturn(...)` 是 Mock 的灵魂——把数据库交互替换成可控返回值，使单测**不依赖任何外部环境**。

---

## 四、Controller 测试（MockMvc）

Controller 测试验证「请求路由 + 参数绑定 + 响应结构」。两种方式：

### 方式 A：`@WebMvcTest` 切片测试（只加载 Web 层，最轻量）

只实例化指定 Controller 与 MVC 基础设施，Service 用 `@MockitoBean`（Spring Boot 4 推荐；旧版 `@MockBean` 已废弃）替身注入。

```java
package org.dromara.demo.controller;

import org.dromara.demo.service.ITestDemoService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller 切片测试：只加载 Web 层，Service 用 MockitoBean 替身。
 * 注意：本项目接口受 Sa-Token 鉴权保护，切片测试一般需放开/Mock 鉴权拦截。
 */
@DisplayName("TestDemo Controller 切片测试")
@WebMvcTest(TestDemoController.class)
class TestDemoControllerWebMvcTest {

    @Autowired
    private MockMvc mockMvc;

    // Spring Boot 4：用 @MockitoBean 替代已废弃的 @MockBean
    @MockitoBean
    private ITestDemoService testDemoService;

    @Test
    @DisplayName("GET 详情接口应返回 code=200")
    void testGetInfo() throws Exception {
        when(testDemoService.queryById(any())).thenReturn(null);

        mockMvc.perform(get("/demo/demo/1"))
            .andExpect(status().isOk())
            // 本项目统一响应体 R<T>：{ code, msg, data }
            .andExpect(jsonPath("$.code").value(200));
    }
}
```

### 方式 B：`@SpringBootTest + @AutoConfigureMockMvc` 全量装配

需要走完整真实 Bean 链路（含拦截器、全局异常处理）时使用，启动开销大，归类为集成测试。

```java
@SpringBootTest
@AutoConfigureMockMvc
class TestDemoControllerIT {
    @Autowired MockMvc mockMvc;
    // ... perform / andExpect 同上
}
```

> 选型建议：**验证 Controller 自身逻辑（参数校验、路由、响应包装）用 `@WebMvcTest`；验证整条链路用 `@SpringBootTest`**。本项目接口普遍带 `@SaCheckPermission`/登录态，Web 切片测试时记得 Mock 或放行鉴权，否则会被拦在 401/403。

---

## 五、集成测试（@SpringBootTest，Spring 容器 + 测试库）

集成测试启动**真实 Spring 容器**，验证 Service ↔ Mapper ↔ 数据库的真实链路。要点：

- 用 `@SpringBootTest` 加载完整上下文，`@Autowired` 注入真实 Service。
- **务必隔离数据**：用 `@Transactional`（Spring Test 下测试方法默认**测试后回滚**），避免污染数据库；或连接专用测试库 / 内存库。
- 跨环境筛选：可加 `@Tag("local")` 等标签，配合 surefire 的 `<groups>${profiles.active}</groups>` 只在对应 profile 下执行。

```java
package org.dromara.demo.service;

import org.dromara.demo.domain.bo.TestDemoBo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Service 集成测试：启动真实容器 + 测试库，方法结束自动回滚。
 */
@DisplayName("TestDemo Service 集成测试")
@SpringBootTest
@Tag("local")           // 配合 surefire profile 标签筛选，仅本地执行
class TestDemoServiceIT {

    @Autowired
    private ITestDemoService testDemoService;

    @Test
    @Transactional          // 测试结束后回滚，保证数据库干净
    @DisplayName("新增后能按主键查回")
    void testInsertThenQuery() {
        TestDemoBo bo = new TestDemoBo();
        bo.setTestKey("it-key");
        bo.setValue("it-value");

        Boolean ok = testDemoService.insertByBo(bo);
        assertThat(ok).isTrue();
        assertThat(bo.getId()).isNotNull();   // 主键已回填

        assertThat(testDemoService.queryById(bo.getId()))
            .isNotNull()
            .extracting("testKey")
            .isEqualTo("it-key");
    }
}
```

---

## 六、Mock 外部依赖（RedisUtils / OssClient 等）

本项目把许多基础设施封装成**静态工具类**（如 `org.dromara.common.redis.utils.RedisUtils`）或注入式客户端（如 `org.dromara.common.oss.client.OssClient`）。单测中必须把它们隔离掉：

- **静态工具类（`RedisUtils` 的 `setCacheObject` / `getCacheObject` 等静态方法）**：用 Mockito 的 `mockStatic` 在 try-with-resources 作用域内打桩，作用域结束自动还原，避免污染其它测试。
- **注入式客户端（`OssClient`、`MailUtils` 包装的 Bean 等）**：作为 `@Mock` 注入到被测 Service，用 `when().thenReturn()` 打桩其上传/下载方法。

```java
import org.dromara.common.redis.utils.RedisUtils;
import org.mockito.MockedStatic;

import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThat;

@Test
@DisplayName("Mock 静态 RedisUtils：命中缓存直接返回，不查 Mapper")
void testCacheHit() {
    // mockStatic 必须放在 try-with-resources，作用域结束后自动还原静态行为
    try (MockedStatic<RedisUtils> redisMock = mockStatic(RedisUtils.class)) {
        redisMock.when(() -> RedisUtils.getCacheObject("demo:1")).thenReturn("cached-value");

        Object cached = RedisUtils.getCacheObject("demo:1");

        assertThat(cached).isEqualTo("cached-value");
        // 验证缓存命中后，Mapper 不应再被调用（按你的 Service 实际逻辑断言）
        // verify(demoMapper, never()).selectVoById(1L);
    }
    // 出了 try 块，RedisUtils 恢复为真实静态方法
}
```

> OssClient 类似：`@Mock OssClient ossClient;`，再 `when(ossClient.upload(any(), anyString())).thenReturn(uploadResult);`，让单测完全不碰真实对象存储。

---

## 七、测试数据构造

构造测试数据有三档，由轻到重：

1. **手工 new + setter**（最常用，单测首选）：直接 `new TestDemoBo()` 后逐个 set，简单可控、无外部依赖。
2. **工厂/构建方法**（数据复用度高时）：在测试类里写 `private static TestDemoBo buildBo(...)` 集中构造，减少重复。
3. **集成测试用 SQL 脚本**：`@Sql("classpath:sql/demo-init.sql")` 在方法前导入基础数据（仅 `@SpringBootTest` 场景）。

```java
/** 单测内构造 BO 的工厂方法，集中管理测试样例，避免每个用例重复 set */
private static TestDemoBo buildBo(String key, String value) {
    TestDemoBo bo = new TestDemoBo();
    bo.setTestKey(key);
    bo.setValue(value);
    bo.setOrderNum(1);
    return bo;
}

// 参数化结合工厂：一次跑多组数据（仿本仓库 ParamUnitTest 的 @MethodSource 写法）
static Stream<TestDemoBo> boProvider() {
    return Stream.of(buildBo("k1", "v1"), buildBo("k2", "v2"), buildBo("k3", "v3"));
}

@ParameterizedTest
@MethodSource("boProvider")
@DisplayName("参数化：多组 BO 插入均应成功")
void testInsertParams(TestDemoBo bo) {
    when(demoMapper.insert(any(TestDemo.class))).thenReturn(1);
    assertThat(testDemoService.insertByBo(bo)).isTrue();
}
```

> 构造数据要**贴合 6.x 实体**：主键是雪花 ID（`Long`，由 MyBatis-Plus 生成，单测里 Mock insert 后由 Service 回填，**不要手动写死自增 id**）；逻辑删除字段是 `del_flag`（**不是** `is_deleted`），通常由框架处理，单测一般不直接构造。

---

## 八、常见错误对比（必看）

### 错误 1：误用源框架的包名 / 概念

```java
// ❌ 错误：本项目不是 com.ruoyi / plus.ruoyi，也没有 DAO 层
import com.ruoyi.demo.dao.TestDemoDao;
@Mock private TestDemoDao testDemoDao;          // 6.x 根本没有 DAO 层

// ✅ 正确：包名 org.dromara，三层无 DAO，Service 直接依赖 Mapper
import org.dromara.demo.mapper.TestDemoMapper;
@Mock private TestDemoMapper demoMapper;
```

### 错误 2：假装存在统一测试基类去继承

```java
// ❌ 错误：本仓库没有 ruoyi-common-test，也没有任何 BaseTest/RuoYiTest 基类
class TestDemoServiceTest extends BaseTest { }   // 基类不存在，编译失败

// ✅ 正确：纯单测用 @ExtendWith(MockitoExtension.class)，不继承任何基类
@ExtendWith(MockitoExtension.class)
class TestDemoServiceTest { }
// 若确需统一基类，自己在测试目录新建抽象类，别假设它已存在
```

### 错误 3：纯单测却启动整个 Spring 容器

```java
// ❌ 错误：只想测一个方法的业务逻辑，却 @SpringBootTest 拉起全容器 + 连库，慢且脆
@SpringBootTest
class TestDemoServiceTest {
    @Autowired ITestDemoService service;   // 还要连真实数据库
}

// ✅ 正确：纯单测 Mock Mapper，毫秒级、无外部依赖
@ExtendWith(MockitoExtension.class)
class TestDemoServiceTest {
    @Mock TestDemoMapper demoMapper;
    @InjectMocks TestDemoServiceImpl service;
}
```

### 错误 4：用 JUnit4 注解 / 用已废弃的 @MockBean（Spring Boot 4）

```java
// ❌ 错误：JUnit4 残留
import org.junit.Test;            // 旧包
import org.junit.runner.RunWith;
@RunWith(SpringRunner.class)

// ❌ 错误：Spring Boot 4 中 @MockBean 已废弃
@MockBean private ITestDemoService service;

// ✅ 正确：统一 JUnit5 + Spring Boot 4 新注解
import org.junit.jupiter.api.Test;     // jupiter 包
import org.springframework.test.context.bean.override.mockito.MockitoBean;
@MockitoBean private ITestDemoService service;
```

---

## 九、最佳实践

1. **分层选对粒度**：业务逻辑 → Mockito 纯单测（Mock Mapper）；Web 层路由/参数 → `@WebMvcTest` + MockMvc；真实链路 → `@SpringBootTest` + `@Transactional` 回滚。能不起容器就不起容器。
2. **断言优先 AssertJ**：`assertThat(x).isEqualTo(...)` 链式可读性远胜 `assertEquals`；现有 `AssertUnitTest` 是 JUnit5 原生断言示例，新测试推荐升级到 AssertJ。
3. **每个测试加 `@DisplayName`**：与仓库现有 4 个示例风格一致，用中文描述意图，报告可读。
4. **善用 `@Tag` 配合 profile**：`<groups>${profiles.active}</groups>` 已就绪，给慢测/环境相关测试打 `@Tag("local")`，给永不参与构建的占位测试打 `@Tag("exclude")`（surefire 已全局排除）。
5. **集成测试必做数据隔离**：`@Transactional` 自动回滚，或用独立测试库，**禁止**让测试污染开发/生产数据。
6. **静态工具类用 `mockStatic` + try-with-resources**：`RedisUtils`、`SpringUtils` 等静态方法只能这样 Mock，且必须在作用域内还原，避免串测。
7. **测试只放在 `src/test/java`**：本项目示例位于 `backend/java/ruoyi-admin/src/test/java/org/dromara/test/`，业务模块测试放各自模块 `src/test/java` 下，包名仍以 `org.dromara` 开头。
8. **覆盖率关注分支而非行数**：优先覆盖 `if/异常分支`（如 `deleteWithValidByIds` 的数量不匹配抛异常分支），比堆 getter/setter 覆盖率更有价值。

---

## 十、6.x 测试铁律（务必遵守）

- ✅ 包名统一 `org.dromara`；测试类放 `src/test/java`，断言用 JUnit5（`org.junit.jupiter.api.*`）/ AssertJ。
- ✅ 三层无 DAO：单测 **Mock Mapper**（`TestDemoMapper`），**绝不**出现 DAO 层（本项目没有）。
- ✅ 集成测试用 `@SpringBootTest` + `@Transactional` 回滚；Web 层用 `@WebMvcTest` + `MockMvc`。
- ✅ Spring Boot 4 用 `@MockitoBean`/`@MockitoSpyBean`，不用已废弃的 `@MockBean`/`@SpyBean`。
- ❌ 禁止 `plus.ruoyi` / `com.ruoyi` 包名，禁止 DAO 层，禁止 `PlusLambdaQuery` / `likeCast`（用 MyBatis-Plus `LambdaQueryWrapper` / `Wrappers.lambdaQuery()`）。
- ❌ 禁止默认 `TenantEntity`（6.x 默认非多租户）、禁止逻辑删除字段写 `is_deleted`（本项目为 `del_flag`）。
- ❌ 禁止假装存在 `ruoyi-common-test` 模块或任何统一测试基类——它们在本仓库**不存在**。
