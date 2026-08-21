---
name: elasticsearch-search
description: |
  base-dev-framework6-java Elasticsearch 全文检索开发指南。基于 Easy-Es（easy-es.cn）实现类 MyBatis-Plus 的 ORM 风格检索，通过 EsMapper 操作索引，无需手写裸 RestHighLevelClient DSL。

  触发场景：
  - 需要为业务模块接入 Elasticsearch 全文检索 / 搜索引擎
  - 需要定义 ES 索引实体（@IndexName / @IndexField）并编写 EsMapper
  - 需要实现 ES 的增删改查、match/term 检索、分页、高亮
  - 需要让 MySQL（MyBatis-Plus）与 ES 双写/同步
  - 排查 EsMapper 未被扫描、easy-es.enable 开关、索引未自动创建等问题

  触发词：Elasticsearch、ES、Easy-Es、easy-es、全文检索、搜索引擎、EsMapper、@IndexName、@IndexField、索引、esmapper、全文搜索、elasticsearch-search
---

# Elasticsearch 全文检索（Easy-Es）

> 适用框架：**base-dev-framework6-java** · 包名根 `org.dromara` · L4 框架专属技能
>
> 真实源码模块：`ruoyi-common/ruoyi-common-elasticsearch`
> 演示样例：`ruoyi-modules/ruoyi-demo`（`domain/Document.java` + `esmapper/DocumentMapper.java` + `controller/EsCrudController.java`）

---

## 一、概述

本框架的 ES 检索能力**完全基于 Easy-Es**（`org.dromara.easy-es`，官网 https://www.easy-es.cn/），
而**不是**裸用 `RestHighLevelClient` / `elasticsearch-java` 手写 DSL。

Easy-Es 是开源的 ES ORM 框架，使用体验与 **MyBatis-Plus 高度对齐**：

| MyBatis-Plus | Easy-Es | 说明 |
|--------------|---------|------|
| `BaseMapper<T>` | `BaseEsMapper<T>` | Mapper 基接口，开箱即用 CRUD |
| `LambdaQueryWrapper<T>` | `LambdaEsQueryWrapper<T>` | Lambda 条件构造器 |
| `LambdaUpdateWrapper<T>` | `LambdaEsUpdateWrapper<T>` | Lambda 更新构造器 |
| `@TableName` | `@IndexName` | 表名 → 索引名 |
| `@TableField` | `@IndexField` | 字段映射（类型/分词器/是否高亮等） |
| `@MapperScan` | `@EsMapperScan` | 扫描 Mapper 接口 |

**版本（来自根 `pom.xml`）**：
- Easy-Es：`easy-es.version = 3.0.2`（artifact `org.dromara.easy-es:easy-es-boot-starter`）
- ES Java 客户端：`elasticsearch-client.version = 7.17.28`（`co.elastic.clients:elasticsearch-java` + `org.elasticsearch.client:elasticsearch-rest-client`）

### 模块构成（真实源码）

`ruoyi-common-elasticsearch` 模块极简，只有两个类 + 自动装配声明：

```
ruoyi-common/ruoyi-common-elasticsearch/
├── pom.xml                                    # 仅引 easy-es-boot-starter
└── src/main/
    ├── java/org/dromara/common/elasticsearch/config/
    │   ├── EasyEsConfiguration.java           # @EsMapperScan + enable 开关
    │   └── ActuatorEnvironmentPostProcessor.java  # 按开关同步 ES 健康检查
    └── resources/META-INF/
        ├── spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports  # 注册 EasyEsConfiguration
        └── spring.factories                   # 注册 ActuatorEnvironmentPostProcessor
```

### 核心配置类（一字不差，来自源码）

```java
package org.dromara.common.elasticsearch.config;

import org.dromara.easyes.spring.annotation.EsMapperScan;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/**
 * easy-es 配置
 *
 * @author Lion Li
 */
@AutoConfiguration
@ConditionalOnProperty(value = "easy-es.enable", havingValue = "true")
@EsMapperScan("org.dromara.**.esmapper")
public class EasyEsConfiguration {

}
```

> 🔴 **两条铁律（务必先记住）**：
> 1. **`easy-es.enable` 默认 `false`**——整套 ES 自动装配（含 `EsCrudController`）都挂在 `@ConditionalOnProperty(value="easy-es.enable", havingValue="true")` 上。不开这个开关，EsMapper 一个都不会注入。
> 2. **ES Mapper 必须放在 `esmapper` 包下**——`@EsMapperScan("org.dromara.**.esmapper")` 只扫描 `org.dromara.**.esmapper` 路径。放错包 = 不被扫描 = 启动注入失败。

### 健康检查联动（ActuatorEnvironmentPostProcessor，源码）

框架用一个 `EnvironmentPostProcessor` 把 ES 的 actuator 健康检查开关和 `easy-es.enable` 绑定，避免「没开 ES 却报 ES 健康检查失败」：

```java
public class ActuatorEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {
    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String enable = environment.getProperty("easy-es.enable", "false");
        System.setProperty("management.health.elasticsearch.enabled", enable);
    }
    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }
}
```

---

## 二、配置（application.yml 的 `easy-es:` 段）

以下为 `ruoyi-admin/src/main/resources/application.yml` 中的**真实配置**（已含原注释）：

```yaml
# 文档地址: https://www.easy-es.cn/
# 更改包名需要去 EasyEsConfiguration 修改包扫描(后续版本支持配置文件读取)
easy-es:
  # 是否开启EE自动配置
  enable: false
  # 兼容模式
  compatible: true
  # es连接地址+端口 格式必须为ip:port,如果是集群则可用逗号隔开
  address: localhost:9200
  # 默认为http
  schema: http
  # 注意ES建议使用账号认证 不使用会报警告日志
  # 如果无账号密码则可不配置此行
  # username:
  # 如果无账号密码则可不配置此行
  # password:
  # 心跳策略时间 单位:ms
  keep-alive-millis: 18000
  # 连接超时时间 单位:ms
  connectTimeout: 5000
  # 通信超时时间 单位:ms
  socketTimeout: 5000
  # 连接请求超时时间 单位:ms
  connectionRequestTimeout: 5000
  # 最大连接数 单位:个
  maxConnTotal: 100
  # 最大连接路由数 单位:个
  maxConnPerRoute: 100
  global-config:
    # 开启控制台打印通过本框架生成的DSL语句,默认为开启,测试稳定后的生产环境建议关闭,以提升少量性能
    print-dsl: true
    # 异步处理索引是否阻塞主线程 默认阻塞 数据量过大时调整为非阻塞异步进行 项目启动更快
    asyncProcessIndexBlocking: true
    db-config:
      # 是否开启下划线转驼峰 默认为false
      map-underscore-to-camel-case: true
      # id生成策略 customize为自定义,id值由用户生成,比如取MySQL中的数据id,如缺省此项配置,则id默认策略为es自动生成
      id-type: customize
      # 字段更新策略 默认为not_null
      field-strategy: not_null
      # 默认开启,查询若指定了size超过1w条时也会自动开启,开启后查询所有匹配数据,若不开启,会导致无法获取数据总条数,其它功能不受影响.
      enable-track-total-hits: true
      # 数据刷新策略,默认为不刷新
      refresh-policy: immediate
```

### 关键配置项解读

| 配置 | 默认值 | 说明与建议 |
|------|--------|-----------|
| `enable` | `false` | **总开关**。用到 ES 才打开，否则全模块不装配 |
| `address` | `localhost:9200` | 仅 `ip:port`，**不带** `http://`；集群用逗号隔开 |
| `schema` | `http` | https 集群改为 `https`，并配 `username`/`password` |
| `global-config.print-dsl` | `true` | 开发期打开看生成的 DSL；**生产建议关闭**省性能 |
| `db-config.id-type` | `customize` | 由用户提供 id（常取 MySQL 主键，实现双写对齐）；缺省则 ES 自动生成 |
| `db-config.map-underscore-to-camel-case` | `true` | 下划线转驼峰 |
| `db-config.field-strategy` | `not_null` | 更新时只更新非 null 字段（与 MyBatis-Plus 一致） |
| `db-config.refresh-policy` | `immediate` | 写后立即可查；高吞吐场景可调为默认不刷新以提性能 |
| `db-config.enable-track-total-hits` | `true` | 关闭会导致拿不到总条数，分页慎关 |

---

## 三、索引实体 + EsMapper

### 1. 索引实体（两种写法）

#### 写法 A：演示样例的极简写法（来自 `ruoyi-demo/domain/Document.java`，真实源码）

Easy-Es 支持「零注解约定优先」：类名转下划线即索引名，字段名即 ES 字段名（配合 `map-underscore-to-camel-case`）。

```java
package org.dromara.demo.domain;

import lombok.Data;

/**
 * 文档实体
 */
@Data
public class Document {

    /** es中的唯一id */
    private String id;

    /** 文档标题 */
    private String title;

    /** 文档内容 */
    private String content;

}
```

#### 写法 B：显式注解写法（推荐用于真实业务，可精确控制索引名/分词器/高亮）

当需要指定索引名、分词器、是否高亮、字段类型时，使用 `@IndexName` + `@IndexField`：

```java
package org.dromara.system.domain;

import lombok.Data;
import org.dromara.easyes.annotation.IndexId;
import org.dromara.easyes.annotation.IndexName;
import org.dromara.easyes.annotation.IndexField;
import org.dromara.easyes.annotation.HighLight;
import org.dromara.easyes.annotation.rely.Analyzer;
import org.dromara.easyes.annotation.rely.FieldType;
import org.dromara.easyes.annotation.rely.IdType;

/**
 * 文章索引实体
 *
 * @author your-name
 */
@Data
@IndexName("article")            // 显式指定索引名；缺省则取类名下划线形式
public class ArticleDoc {

    /** 主键。customize 策略下由业务赋值（常取 MySQL 主键，便于双写对齐） */
    @IndexId(type = IdType.CUSTOMIZE)
    private String id;

    /**
     * 标题：text 类型，存入时用 ik_max_word 细粒度分词，
     * 查询时用 ik_smart 粗粒度分词；并参与高亮
     */
    @HighLight(preTag = "<em>", postTag = "</em>")
    @IndexField(fieldType = FieldType.TEXT,
                analyzer = Analyzer.IK_MAX_WORD,
                searchAnalyzer = Analyzer.IK_SMART)
    private String title;

    /** 正文：text 全文检索 */
    @IndexField(fieldType = FieldType.TEXT, analyzer = Analyzer.IK_MAX_WORD)
    private String content;

    /** 分类：keyword 精确匹配（用于 term 过滤、聚合） */
    @IndexField(fieldType = FieldType.KEYWORD)
    private String category;

    /** 浏览量：integer，用于排序/范围 */
    @IndexField(fieldType = FieldType.INTEGER)
    private Integer views;

    /** 创建时间：date，指定格式 */
    @IndexField(fieldType = FieldType.DATE, dateFormat = "yyyy-MM-dd HH:mm:ss")
    private String createTime;
}
```

> ⚠️ `@HighLight` 注解里配的 `preTag/postTag` 决定高亮包裹标签；查询时还需在 Wrapper 上调 `.highLight(...)` 才会真正返回高亮片段（见检索示例 4）。

### 2. EsMapper（来自 `ruoyi-demo/esmapper/DocumentMapper.java`，真实源码）

🔴 **必须放在 `esmapper` 包下**（被 `@EsMapperScan("org.dromara.**.esmapper")` 扫描），继承 Easy-Es 的 `BaseEsMapper<T>`：

```java
package org.dromara.demo.esmapper;   // ← 关键：包名末段必须是 esmapper

import org.dromara.demo.domain.Document;
import org.dromara.easyes.core.kernel.BaseEsMapper;

/**
 * Easy-Es 文档 Mapper。
 *
 * @author Lion Li
 */
public interface DocumentMapper extends BaseEsMapper<Document> {
}
```

> 业务模块示例：`org.dromara.system.esmapper.ArticleMapper`、`org.dromara.demo.esmapper.DocumentMapper`，
> **都必须**位于各自模块的 `...esmapper` 包内。

---

## 四、检索代码示例（≥5）

以下示例以 `DocumentMapper` / `ArticleMapper` 为例，条件构造器为 `LambdaEsQueryWrapper`（来自 `EsCrudController.java` 真实用法 + Easy-Es 标准 API）。

### 示例 1：精确单条查询（eq + selectOne）—— 真实源码

```java
@GetMapping("/select")
public Document select(String title) {
    LambdaEsQueryWrapper<Document> wrapper = new LambdaEsQueryWrapper<>();
    wrapper.eq(Document::getTitle, title);   // term 级精确匹配
    return documentMapper.selectOne(wrapper);
}
```

### 示例 2：模糊全文检索（like / match）—— 真实源码

```java
@GetMapping("/search")
public List<Document> search(String key) {
    LambdaEsQueryWrapper<Document> wrapper = new LambdaEsQueryWrapper<>();
    wrapper.like(Document::getTitle, key);   // 走分词匹配（match）
    return documentMapper.selectList(wrapper);
}
```

> `eq` ≈ term（精确，不分词，适合 keyword）；`like`/`match` ≈ match（分词，适合 text 全文）。
> 这是 ES 检索最容易踩的语义区别，对 text 字段用 `eq` 往往查不到结果。

### 示例 3：多条件组合 + 分页（match + and + 分页）

```java
public EsPageInfo<ArticleDoc> page(String keyword, String category, Integer pageNum, Integer pageSize) {
    LambdaEsQueryWrapper<ArticleDoc> wrapper = new LambdaEsQueryWrapper<>();
    wrapper.match(ArticleDoc::getTitle, keyword)        // 标题全文匹配
           .or().match(ArticleDoc::getContent, keyword) // 或正文匹配
           .eq(ArticleDoc::getCategory, category)       // 且分类精确过滤(keyword)
           .orderByDesc(ArticleDoc::getViews);          // 按浏览量倒序
    // Easy-Es 分页：返回 EsPageInfo，含 list/total/pageNum/pageSize
    return articleMapper.pageQuery(wrapper, pageNum, pageSize);
}
```

> Easy-Es 的分页方法是 `pageQuery(wrapper, pageNum, pageSize)`，返回 `EsPageInfo<T>`（类比 MyBatis-Plus 的 `Page`）。

### 示例 4：高亮检索（highLight）

```java
public List<ArticleDoc> searchWithHighlight(String keyword) {
    LambdaEsQueryWrapper<ArticleDoc> wrapper = new LambdaEsQueryWrapper<>();
    wrapper.match(ArticleDoc::getTitle, keyword)
           .highLight(ArticleDoc::getTitle);   // 触发高亮，标签取实体 @HighLight 配置
    // 命中片段会回填到实体里被 @HighLight 标注的同名字段
    return articleMapper.selectList(wrapper);
}
```

> 高亮三要素：实体字段加 `@HighLight` → Wrapper 上 `.highLight(字段)` → 结果实体对应字段被替换为带 `<em>...</em>` 的片段。三者缺一不高亮。

### 示例 5：范围 + 排序 + 限量（ge/le + orderBy + limit）

```java
public List<ArticleDoc> hotArticles(Integer minViews) {
    LambdaEsQueryWrapper<ArticleDoc> wrapper = new LambdaEsQueryWrapper<>();
    wrapper.ge(ArticleDoc::getViews, minViews)        // views >= minViews
           .orderByDesc(ArticleDoc::getViews)         // 浏览量倒序
           .limit(10);                                // 取前 10 条
    return articleMapper.selectList(wrapper);
}
```

### 示例 6：增 / 改 / 删（insert / updateById / deleteById）—— 真实源码

```java
// 插入：返回成功条数
@PostMapping("/insert")
public Integer insert(@RequestBody Document document) {
    return documentMapper.insert(document);
}

// 更新：已知 id 用 updateById；id 未知用 update(entity, wrapper)
@PutMapping("/update")
public R<Void> update(@RequestBody Document document) {
    documentMapper.updateById(document);
    // 按条件更新示例：
    // LambdaEsUpdateWrapper<Document> w = new LambdaEsUpdateWrapper<>();
    // w.like(Document::getTitle, document.getTitle());
    // documentMapper.update(newEntity, w);
    return R.ok();
}

// 删除：根据 id 删（也可 delete(wrapper) 按条件删）
@DeleteMapping("/delete/{id}")
public R<Integer> delete(@PathVariable String id) {
    return R.ok(documentMapper.deleteById(id));
}
```

---

## 五、与 MySQL（MyBatis-Plus）协同：双写 / 同步思路

ES 是检索副本，**业务主数据仍在 MySQL**。常见三种同步策略：

### 策略 A：应用层双写（最简单，适合中小数据量）

在 Service 写 MySQL 后，同一事务边界外同步写 ES（ES 写失败不回滚业务，记日志补偿）：

```java
@Service
@RequiredArgsConstructor
public class ArticleServiceImpl implements IArticleService {

    private final ArticleMapper esMapper;            // Easy-Es Mapper（esmapper 包）
    private final ArticleMyBatisMapper mybatisMapper; // MyBatis-Plus Mapper

    @Transactional(rollbackFor = Exception.class)
    public void saveArticle(ArticleBo bo) {
        Article entity = MapstructUtils.convert(bo, Article.class);
        mybatisMapper.insert(entity);                // 1. 写 MySQL（主数据）
        // 2. 写 ES：id 取 MySQL 主键（配合 id-type=customize 保证两边 id 一致）
        ArticleDoc doc = MapstructUtils.convert(entity, ArticleDoc.class);
        doc.setId(String.valueOf(entity.getId()));
        esMapper.insert(doc);
    }
}
```

> 🔑 关键：`easy-es.global-config.db-config.id-type = customize`，**ES 主键直接用 MySQL 主键**，保证删除/更新能精准对齐，避免出现两套 id。

### 策略 B：事件/MQ 异步同步（解耦，适合高并发）

业务写 MySQL 后发领域事件（或 MQ 消息），由独立消费者补写 ES，失败可重试。适合写多读多、对实时性要求略低的场景。

### 策略 C：Canal / Logstash 监听 binlog（零侵入，适合大数据量）

通过 Canal 订阅 MySQL binlog 自动同步到 ES，业务代码完全不感知。适合存量大、改动不想动业务代码的项目。

> 选型建议：起步用 **A**（双写）；并发上来后改 **B**（MQ）；数据量巨大或要兼容遗留系统用 **C**（binlog）。

---

## 六、常见错误对比（≥3）

### 错误 1：EsMapper 没放在 `esmapper` 包 → 启动注入失败 🔴 最高频

```
错误现象：
  Field documentMapper required a bean of type 'XxxMapper' that could not be found.
  或：No qualifying bean of type 'org.dromara.xxx.mapper.XxxMapper'

错误根因：
  @EsMapperScan("org.dromara.**.esmapper") 只扫描 esmapper 包，
  Mapper 放到了 mapper/dao 等其它包，没被扫到。

❌ 错误：org.dromara.demo.mapper.DocumentMapper
✅ 正确：org.dromara.demo.esmapper.DocumentMapper
```

| 对比项 | ❌ 错误做法 | ✅ 正确做法 |
|--------|-----------|-----------|
| 包路径 | `org.dromara.demo.mapper` | `org.dromara.demo.esmapper` |
| 后果 | 不被 `@EsMapperScan` 扫描，启动报缺 bean | 被扫描，正常注入 |
| 改包名时 | — | 同步改 `EasyEsConfiguration` 的 `@EsMapperScan`（当前**不支持**配置文件读包名，见 yml 注释） |

> ⚠️ 若必须自定义 ES Mapper 包名，**唯一**办法是改 `EasyEsConfiguration.java` 的 `@EsMapperScan` 值——配置文件里改不了（application.yml 原注释明确写了「后续版本支持配置文件读取」）。

### 错误 2：忘开 `easy-es.enable` → 整套 ES 功能静默失效

```
错误现象：
  EsMapper 注入失败 / EsCrudController 接口 404 / ES 相关 bean 全部缺失。

错误根因：
  EasyEsConfiguration 和 EsCrudController 都挂了
  @ConditionalOnProperty(value="easy-es.enable", havingValue="true")。
  enable 默认 false，整条自动装配链路被跳过。
```

| 对比项 | ❌ 错误 | ✅ 正确 |
|--------|--------|--------|
| 配置 | `easy-es.enable: false`（或未配） | `easy-es.enable: true` |
| 现象 | Mapper/Controller 全部不生效，且不报错（静默） | 正常装配 |
| 排查 | 先查 yml 这一行，再查 ES 是否启动、`address` 是否可达 | — |

### 错误 3：text 字段用 `eq`（term）查不到 / keyword 字段用 `match` 语义错

```
错误现象：
  明明有数据，eq 精确查询却返回空；或对 keyword 字段做 match 结果不符预期。

错误根因：
  eq → term 查询（不分词，要求整字段精确相等），不适合已分词的 text 字段；
  match/like → 分词匹配，适合 text，但对 keyword 字段无意义。
```

| 字段类型 | ✅ 应该用 | ❌ 不要用 | 原因 |
|---------|----------|----------|------|
| `text`（标题/正文，已分词） | `match` / `like` | `eq`（term） | term 要整字段相等，分词后命中不到 |
| `keyword`（分类/状态/标签） | `eq` / `in`（term） | `match` | keyword 不分词，match 无意义 |

### 错误 4：print-dsl / refresh-policy 生产配置不当

| 对比项 | ❌ 不当 | ✅ 推荐 | 原因 |
|--------|--------|--------|------|
| `print-dsl` | 生产仍 `true` | 生产 `false`，开发 `true` | 控制台打印 DSL 拖慢性能 |
| `refresh-policy` | 高吞吐写入仍 `immediate` | 批量写场景用默认（不刷新）+ 必要时手动 refresh | `immediate` 每写都刷新，吞吐低 |
| `address` | 写成 `http://localhost:9200` | 写成 `localhost:9200`（schema 单独配） | 格式必须 `ip:port` |

---

## 七、最佳实践

1. **开关先行**：用 ES 必须 `easy-es.enable: true`；不用就保持 `false`，避免无谓装配与健康检查告警（`ActuatorEnvironmentPostProcessor` 已把健康检查与该开关联动）。
2. **包名铁律**：所有 ES Mapper 一律放各模块 `...esmapper` 包下，命名建议 `XxxMapper extends BaseEsMapper<XxxDoc>`。改包名记得同步改 `EasyEsConfiguration.@EsMapperScan`。
3. **id 对齐 MySQL**：`id-type = customize`，ES 文档 id 直接复用 MySQL 主键，保证双写删改精准对齐，杜绝双 id 漂移。
4. **字段类型分明**：全文检索字段（标题/正文）用 `text` + 分词器；过滤/聚合字段（分类/状态/标签）用 `keyword`。混用会导致查询语义错乱。
5. **查询语义对齐**：`eq/in` 当 term 用（精确、keyword），`match/like` 当全文用（分词、text），别混。
6. **高亮三件套**：实体 `@HighLight` + Wrapper `.highLight(...)` + 取结果实体回填字段，缺一不亮。
7. **分页用 `pageQuery`**：返回 `EsPageInfo<T>`，并保持 `enable-track-total-hits: true` 才能拿到总数。
8. **生产关 DSL 打印**：`print-dsl` 开发期开、生产期关；`refresh-policy` 按写入吞吐权衡（实时可查 vs 性能）。
9. **ES 为副本，MySQL 为主**：主数据写 MySQL，ES 仅做检索；同步按数据量选「应用双写 / MQ 异步 / Canal binlog」。ES 写失败不应回滚业务，需有补偿与重试。
10. **对象转换走 MapstructUtils**：实体 ↔ Doc ↔ BO/VO 的转换统一用 `MapstructUtils.convert(...)`（6.x 规范），不手写 BeanUtils。

---

## 八、6.x 规范红线（务必遵守）

| 项 | ✅ 框架约定 | ❌ 禁止（属于别的框架/旧版） |
|----|---------------------|----------------------------|
| 包名根 | `org.dromara` | `plus.ruoyi`、`com.ruoyi` |
| ES Mapper | `esmapper` 包 + `BaseEsMapper<T>` | DAO 层、自定义裸 RestHighLevelClient |
| 条件构造 | `LambdaEsQueryWrapper` | `PlusLambdaQuery`、`likeCast` |
| ES 实体 | 普通 POJO + `@IndexName`/`@IndexField` | 默认继承 `TenantEntity` |
| 逻辑删除 | ES 走 `deleteById`/条件删 | `is_deleted` 字段（ES 无此约定） |

> ⚠️ ES 索引实体**不要**默认继承 `TenantEntity`、也不要套 `is_deleted` 逻辑删除——那是 MySQL/MyBatis-Plus 侧的约定，ES 侧不适用。多租户隔离若需要，应在索引字段层显式加 `tenantId` 并在 Wrapper 上手动过滤。

---

## 引用的真实源文件

- `ruoyi-common/ruoyi-common-elasticsearch/pom.xml`
- `ruoyi-common/ruoyi-common-elasticsearch/src/main/java/org/dromara/common/elasticsearch/config/EasyEsConfiguration.java`
- `ruoyi-common/ruoyi-common-elasticsearch/src/main/java/org/dromara/common/elasticsearch/config/ActuatorEnvironmentPostProcessor.java`
- `ruoyi-common/ruoyi-common-elasticsearch/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`
- `ruoyi-common/ruoyi-common-elasticsearch/src/main/resources/META-INF/spring.factories`
- `ruoyi-admin/src/main/resources/application.yml`（`easy-es:` 段，289-333 行）
- `pom.xml`（`easy-es.version=3.0.2`、`elasticsearch-client.version=7.17.28` 及依赖声明）
- `ruoyi-modules/ruoyi-demo/src/main/java/org/dromara/demo/domain/Document.java`
- `ruoyi-modules/ruoyi-demo/src/main/java/org/dromara/demo/esmapper/DocumentMapper.java`
- `ruoyi-modules/ruoyi-demo/src/main/java/org/dromara/demo/controller/EsCrudController.java`
