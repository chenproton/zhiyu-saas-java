---
name: api-development
description: |
  API 接口设计规范、RESTful 设计、前后端对接约定（base-dev-framework6-java。专注于"接口设计规范"——URL/HTTP 方法、R<T> 统一响应、权限/日志/防重注解、前后端命名联动。完整业务模块开发（Entity/BO/VO/Service/Mapper）请用 crud-development。

  触发场景：
  - 设计新的 API 接口路径与 HTTP 方法（list/export/详情/新增/修改/删除）
  - 定义 RESTful 规范、确认权限标识与日志注解
  - 前后端接口对接约定（前端 listXxx/getXxx/addXxx 与后端路由对齐）
  - 接口命名规范、端点设计、统一响应 R<T> 设计
  - 纠正非标准接口路径（如把 /pageXxxs、/getXxx/{id}、/addXxx 改回标准 REST）

  触发词：API设计、接口规范、RESTful、URL设计、接口路径、R<T>、统一响应、接口命名、端点设计、接口对接、前后端联动、export导出、批量删除
---

# API 接口设计规范（base-dev-framework6-java）

## 一、概述

base-dev-framework6-java的 API 遵循**标准 REST 风格**，由代码生成器（`ruoyi-gen` FreeMarker 模板）统一约定、各业务模块（`ruoyi-system`、`ruoyi-demo`、`ruoyi-workflow`）实际落地。本技能聚焦"接口契约层"，确保：

- 路径、HTTP 方法、权限标识、响应包装在全项目一致；
- 后端 Controller 路由与前端 API 函数命名严格对齐，前端目录结构与后端模块路径同构；
- 不暴露 Entity，入参用 BO，出参用 VO；
- 接口文档走 **SpringDoc OpenAPI + therapi**（运行时读 JavaDoc），写规范注释即生成文档，不堆砌 `@Schema`。

> **决策顺序**（冲突时）：① 当前模块最近似接口 → ② 公共能力模块统一约定（common-web / common-mybatis） → ③ generator 模板 → ④ 通用 Spring 习惯。冲突时优先相信仓库真实代码。

> **包名/路径基线**：原版包名为 `org.dromara.*`，公共能力在 `org.dromara.common.*`，与定制衍生版的 `plus.ruoyi` **不同**，编写示例时务必使用 `org.dromara` 前缀。

---

## 二、URL / HTTP 方法规范表

标准单表 CRUD 接口集合（以 `${module}/${business}` 为路径前缀，如 `/system/dict/type`、`/demo/demo`）：

| 业务动作 | HTTP 方法 | 路径 | 返回类型 | 权限标识 (action) | 说明 |
|---------|----------|------|----------|------------------|------|
| 分页列表 | `GET` | `/{module}/{business}/list` | `R<PageResult<Vo>>` | `list` | 普通分页列表 |
| 导出 | `POST` | `/{module}/{business}/export` | `void`（写流到 response） | `export` | 新版生成器统一 `POST` |
| 导入 | `POST` | `/{module}/{business}/importData` | `R<Void>` | `import` | `consumes=MULTIPART_FORM_DATA_VALUE` |
| 详情 | `GET` | `/{module}/{business}/{id}` | `R<Vo>` | `query` | 路径变量传主键 |
| 新增 | `POST` | `/{module}/{business}` | `R<Void>` | `add` | body 传 BO，`@Validated(AddGroup.class)` |
| 修改 | `PUT` | `/{module}/{business}` | `R<Void>` | `edit` | body 传 BO，`@Validated(EditGroup.class)` |
| 删除（批量） | `DELETE` | `/{module}/{business}/{ids}` | `R<Void>` | `remove` | 路径变量传 `Long[] ids` |
| 下拉选项 | `GET` | `/{module}/{business}/optionselect` | `R<List<Vo>>` | （常免鉴权或 `query`） | 表单下拉数据源 |

**树表特殊点**：树表的 `list` **不分页**，返回 `R<List<Vo>>`（不是 `PageResult`）；导出路由以目标模块/generator 模板为准——旧 demo 树表用 `GET /export`，新版生成器统一 `POST /export`。

**HTTP 方法语义约定**：

| 语义 | 方法 | 备注 |
|------|------|------|
| 查询/读取 | `GET` | 列表、详情、下拉、统计 |
| 新增/创建 | `POST` | 也用于"动作型"接口（导出、导入、刷新缓存等无法用纯 REST 表达的） |
| 全量更新 | `PUT` | 修改实体 |
| 删除 | `DELETE` | 批量删除路径传 `{ids}` |

> 项目里 `optionselect`、`changeStatus`、`refreshCache` 等"动作型"接口允许偏离纯 REST，但**必须复用模块内已有命名**，不要自创风格。

---

## 三、Controller 完整示例（取自原版真实代码）

### 示例 1：标准单表 Controller（`/demo/demo`，含导入/导出）

来源：`ruoyi-demo/.../controller/TestDemoController.java`。这是最权威的"标准七段式" CRUD 骨架。

```java
package org.dromara.demo.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import org.dromara.common.core.validate.QueryGroup;
import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.redis.annotation.RepeatSubmit;
import org.dromara.common.web.core.BaseController;
import org.dromara.demo.domain.bo.TestDemoBo;
import org.dromara.demo.domain.vo.TestDemoVo;
import org.dromara.demo.service.ITestDemoService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;

/**
 * 测试单表Controller
 *
 * @author Lion Li
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/demo/demo")
public class TestDemoController extends BaseController {

    private final ITestDemoService testDemoService;

    /** 1. 查询测试单表列表（分页） */
    @SaCheckPermission("demo:demo:list")
    @GetMapping("/list")
    public R<PageResult<TestDemoVo>> list(@Validated(QueryGroup.class) TestDemoBo bo, PageQuery pageQuery) {
        return R.ok(testDemoService.queryPageList(bo, pageQuery));
    }

    /** 2. 导出测试单表列表（POST /export） */
    @SaCheckPermission("demo:demo:export")
    @Log(title = "测试单表", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(@Validated TestDemoBo bo, HttpServletResponse response) {
        List<TestDemoVo> list = testDemoService.queryList(bo);
        ExcelBuilder.of(list, TestDemoVo.class).sheetName("测试单表").toResponse(response);
    }

    /** 3. 获取详情（GET /{id}） */
    @SaCheckPermission("demo:demo:query")
    @GetMapping("/{id}")
    public R<TestDemoVo> getInfo(@NotNull(message = "主键不能为空")
                                 @PathVariable("id") Long id) {
        return R.ok(testDemoService.queryById(id));
    }

    /** 4. 新增（POST，分组校验 AddGroup + 防重） */
    @SaCheckPermission("demo:demo:add")
    @Log(title = "测试单表", businessType = BusinessType.INSERT)
    @RepeatSubmit
    @PostMapping()
    public R<Void> add(@Validated(AddGroup.class) @RequestBody TestDemoBo bo) {
        return toAjax(testDemoService.insertByBo(bo));
    }

    /** 5. 修改（PUT，分组校验 EditGroup + 防重） */
    @SaCheckPermission("demo:demo:edit")
    @Log(title = "测试单表", businessType = BusinessType.UPDATE)
    @RepeatSubmit
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody TestDemoBo bo) {
        return toAjax(testDemoService.updateByBo(bo));
    }

    /** 6. 批量删除（DELETE /{ids}） */
    @SaCheckPermission("demo:demo:remove")
    @Log(title = "测试单表", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空")
                          @PathVariable Long[] ids) {
        return toAjax(testDemoService.deleteWithValidByIds(Arrays.asList(ids), true));
    }
}
```

**要点拆解**：

- 类上四件套：`@Validated` + `@RestController` + `@RequiredArgsConstructor` + `@RequestMapping`，并 `extends BaseController`。
- service 用 `private final` 字段 + `@RequiredArgsConstructor` 构造注入，**不要** `@Autowired`。
- 返回值统一 `R<T>` / `R<Void>`；`toAjax(int)` 把"影响行数"转成 `R<Void>`。
- 每个写接口都带 `@SaCheckPermission` + `@Log`，写接口再加 `@RepeatSubmit` 防重。
- 路径变量批量删除收 `Long[] ids`，service 用 `Arrays.asList(ids)` 转 List。

### 示例 2：导入接口（multipart 上传）

```java
/** 导入数据（POST，multipart 上传，返回解析报告） */
@Log(title = "测试单表", businessType = BusinessType.IMPORT)
@SaCheckPermission("demo:demo:import")
@PostMapping(value = "/importData", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
public R<Void> importData(@RequestPart("file") MultipartFile file) throws Exception {
    ExcelResult<TestDemoImportVo> excelResult = ExcelBuilder.read(file.getInputStream(), TestDemoImportVo.class)
        .validate(true)
        .doRead();
    List<TestDemo> list = MapstructUtils.convert(excelResult.getList(), TestDemo.class);
    testDemoService.saveBatch(list);
    return R.ok(excelResult.getAnalysis());
}
```

- 文件参数用 `@RequestPart("file") MultipartFile`，方法上 `consumes = MediaType.MULTIPART_FORM_DATA_VALUE`。
- Excel 导入走 `ExcelBuilder.read(...)`，返回 `ExcelResult`，业务类型转换统一用 `MapstructUtils.convert`。

### 示例 3：树表 Controller（list 不分页）

来源：`ruoyi-demo/.../controller/TestTreeController.java`。

```java
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/demo/tree")
public class TestTreeController extends BaseController {

    private final ITestTreeService testTreeService;

    /** 查询树表列表（★ 不分页，返回 R<List<Vo>>） */
    @SaCheckPermission("demo:tree:list")
    @GetMapping("/list")
    public R<List<TestTreeVo>> list(@Validated(QueryGroup.class) TestTreeBo bo) {
        List<TestTreeVo> list = testTreeService.queryList(bo);
        return R.ok(list);
    }

    /** 导出树表（旧 demo 用 GET /export；新版生成器统一 POST /export） */
    @SaCheckPermission("demo:tree:export")
    @Log(title = "测试树表", businessType = BusinessType.EXPORT)
    @GetMapping("/export")
    public void export(@Validated TestTreeBo bo, HttpServletResponse response) {
        List<TestTreeVo> list = testTreeService.queryList(bo);
        ExcelBuilder.of(list, TestTreeVo.class).sheetName("测试树表").toResponse(response);
    }

    // 详情 / 新增 / 修改 / 删除 与标准单表一致，list 是唯一差异点
}
```

- **核心差异**：树表 `list` 返回 `R<List<Vo>>` 且**不接收 `PageQuery`**，前端不分页一次性渲染整棵树。

### 示例 4：系统模块真实接口（含唯一性校验 + 动作型接口）

来源：`ruoyi-system/.../controller/system/SysDictTypeController.java`。展示"前置唯一性校验留在 Controller"与"动作型接口（刷新缓存/下拉选项）"的合规写法。

```java
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/system/dict/type")
public class SysDictTypeController extends BaseController {

    private final ISysDictTypeService dictTypeService;

    /** 新增字典类型（前置唯一性校验，失败直接 R.fail） */
    @SaCheckPermission("system:dict:add")
    @Log(title = "字典类型", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping
    public R<Void> add(@Validated @RequestBody SysDictTypeBo dict) {
        if (!dictTypeService.checkDictTypeUnique(dict)) {
            return R.fail("新增字典'" + dict.getDictName() + "'失败，字典类型已存在");
        }
        dictTypeService.insertDictType(dict);
        return R.ok();
    }

    /** 动作型：刷新字典缓存（DELETE /refreshCache，加 Lock4j 防并发） */
    @SaCheckPermission("system:dict:remove")
    @Log(title = "字典类型", businessType = BusinessType.CLEAN)
    @Lock4j
    @DeleteMapping("/refreshCache")
    public R<Void> refreshCache() {
        dictTypeService.resetDictCache();
        return R.ok();
    }

    /** 动作型：下拉选项（GET /optionselect，通常免业务鉴权） */
    @GetMapping("/optionselect")
    public R<List<SysDictTypeVo>> optionselect() {
        return R.ok(dictTypeService.selectDictTypeAll());
    }
}
```

- 显式业务失败（唯一性/越权/删除前校验）允许留在 Controller，前提是**同模块已有这种习惯**；其余重逻辑仍放 service。
- 动作型接口（`refreshCache`、`optionselect`、`changeStatus`）路径用动词，复用模块既有命名，不强套 REST。

---

## 四、R<T> 统一响应规范

全项目响应包装统一为 `org.dromara.common.core.domain.R<T>`，分页用 `PageResult<Vo>`。

### 4.1 返回类型选择

| 场景 | 返回类型 | 示例 |
|------|----------|------|
| 普通列表分页 | `R<PageResult<Vo>>` | `return R.ok(service.queryPageList(bo, pageQuery));` |
| 树表/不分页列表 | `R<List<Vo>>` | `return R.ok(service.queryList(bo));` |
| 单条详情 | `R<Vo>` | `return R.ok(service.queryById(id));` |
| 写操作无返回体 | `R<Void>` | `return toAjax(service.insertByBo(bo));` 或 `return R.ok();` |
| 导出/下载 | `void` | 直接写 `HttpServletResponse`，不包 `R` |

### 4.2 构造与判定

```java
R.ok();                 // 成功，无数据，code=200
R.ok(data);             // 成功，带数据
R.ok("自定义提示", data); // 成功，带提示文案
R.fail();               // 失败，code=500
R.fail("错误提示");      // 失败，带文案
R.fail(code, msg);      // 失败，自定义业务码

// BaseController 提供的语义化封装：
toAjax(boolean);        // true→R.ok() / false→R.fail()
toAjax(int rows);       // rows>0→成功 / 否则失败（影响行数）
```

### 4.3 JSON 结构（前端约定）

```jsonc
// 成功（带分页）
{ "code": 200, "msg": "操作成功",
  "rows": [ { "id": 1, "name": "xxx" } ], "total": 35 }   // PageResult 场景

// 成功（单对象 / 列表）
{ "code": 200, "msg": "操作成功", "data": { "id": 1 } }

// 失败
{ "code": 500, "msg": "字典类型已存在", "data": null }
```

> **铁律**：不要为统一响应自造 `Result` / `AjaxResult` / `ResponseEntity` 包装，全项目只用 `R<T>` + `PageResult`。分页 DTO 不要自创，统一用 `PageQuery`（入参）/ `PageResult`（出参）。

---

## 五、前后端 API 对接示例

前端 API 函数命名与后端路由**一一对应**，文件落在 `@/api/{module}/{business}/` 目录，与后端模块路径同构。

### 5.1 后端路由 → 前端命名映射

| 前端函数 | HTTP | 后端路由 | 返回类型 |
|---------|------|----------|----------|
| `listXxx(query)` | GET | `/{module}/{business}/list` | `AxiosPromise<PageResult<VO>>` |
| `getXxx(id)` | GET | `/{module}/{business}/{id}` | `AxiosPromise<VO>` |
| `addXxx(data)` | POST | `/{module}/{business}` | — |
| `updateXxx(data)` | PUT | `/{module}/{business}` | — |
| `delXxx(id\|ids)` | DELETE | `/{module}/{business}/{id 或 ids}` | — |

### 5.2 前端 API 文件（取自 gen `fm/vue/api.ts.ftl`）

```typescript
import type { DemoForm, DemoQuery, DemoVO } from '@/api/demo/demo/types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/** 查询测试单表列表 */
export const listDemo = (query?: DemoQuery): AxiosPromise<PageResult<DemoVO>> => {
  return request({ url: '/demo/demo/list', method: 'get', params: query });
};

/** 查询测试单表详细 */
export const getDemo = (id: string | number): AxiosPromise<DemoVO> => {
  return request({ url: '/demo/demo/' + id, method: 'get' });
};

/** 新增测试单表 */
export const addDemo = (data: DemoForm) => {
  return request({ url: '/demo/demo', method: 'post', data: data });
};

/** 修改测试单表 */
export const updateDemo = (data: DemoForm) => {
  return request({ url: '/demo/demo', method: 'put', data: data });
};

/** 删除测试单表（支持单个或数组批量） */
export const delDemo = (id: string | number | Array<string | number>) => {
  return request({ url: '/demo/demo/' + id, method: 'delete' });
};
```

### 5.3 类型文件约定（`types.ts`）

```typescript
import type { BaseEntity, PageQuery } from '@/api/types';

export interface DemoVO {
  id: string | number;        // ID 字段统一 string | number
  name: string;
  status: number;             // Java 数值 → number
  // ...其他生成字段默认 string
}
export interface DemoForm extends BaseEntity { /* 表单字段，继承 BaseEntity */ }
export interface DemoQuery extends PageQuery {  // 非树表 Query 继承 PageQuery
  name?: string;
  params?: any;               // 有日期范围查询时保留 params
}
```

### 5.4 导出对接

后端 `POST /export` 写流，前端用 `@/utils/request` 导出的 `download` 方法：

```typescript
import { download } from '@/utils/request';

const handleExport = () => {
  download('/demo/demo/export', { ...queryParams.value }, `测试单表_${new Date().getTime()}.xlsx`);
};
```

> **联动铁律**：后端若改了 BO 的 `params`（日期范围）结构，前端 `addDateRange` / `useDateRangeQuery` 必须同步，否则 BETWEEN 查询失效。API 函数名与路由段不可偏离后端约定。

---

## 六、常见错误对比（重点纠正非标准路径）

### 错误 1：套用定制衍生版的非标准路径 ❌

```java
// ❌ 错误：这是定制衍生版（plus.ruoyi）的路径风格，框架约定不用！
@GetMapping("/pageDemos")      // 复数 + page 前缀 —— 衍生版风格
public R<PageResult<DemoVo>> pageDemos(...) { ... }

@GetMapping("/getDemo/{id}")   // getXxx 动词前缀 —— 衍生版风格
public R<DemoVo> getDemo(@PathVariable Long id) { ... }

@PostMapping("/addDemo")       // addXxx 动词前缀 —— 衍生版风格
public R<Void> addDemo(@RequestBody DemoBo bo) { ... }
```

```java
// ✅ 正确：原版标准 REST
@GetMapping("/list")           // 列表统一 /list，不加复数/page 前缀
public R<PageResult<DemoVo>> list(...) { ... }

@GetMapping("/{id}")           // 详情用路径变量，不加 getXxx 前缀
public R<DemoVo> getInfo(@PathVariable Long id) { ... }

@PostMapping()                 // 新增映射到资源根路径，不加 addXxx
public R<Void> add(@RequestBody DemoBo bo) { ... }
```

> **记忆点**：URL 段是名词资源（`/list`、`/{id}`、根路径、`/{ids}`），动作由 HTTP 方法（GET/POST/PUT/DELETE）表达。`/pageXxxs`、`/getXxx/{id}`、`/addXxx` 是定制衍生版才有的写法，原版**绝对禁止**。

### 错误 2：用错包名 / 引入错误工具栈 ❌

```java
// ❌ 错误
import plus.ruoyi.common.core.domain.R;     // plus.ruoyi 是衍生版包名
import io.swagger.annotations.Api;          // Knife4j / Swagger2 旧注解
@Api(tags = "演示")                          // 原版不用 Knife4j 注解堆砌
public class DemoController { }
```

```java
// ✅ 正确
import org.dromara.common.core.domain.R;     // 原版包名 org.dromara
import org.dromara.common.web.core.BaseController;
// 接口文档走 SpringDoc + therapi，写规范 JavaDoc 即生成文档，无需 @Api/@ApiOperation
/**
 * 演示管理
 *
 * @author xxx
 */
public class DemoController extends BaseController { }
```

### 错误 3：树表 list 强行分页 ❌

```java
// ❌ 错误：树表不应分页
@GetMapping("/list")
public R<PageResult<DeptVo>> list(DeptBo bo, PageQuery pageQuery) {
    return R.ok(service.queryPageList(bo, pageQuery));   // 树被截断，前端无法构建完整层级
}
```

```java
// ✅ 正确：树表 list 不分页，返回完整列表
@GetMapping("/list")
public R<List<DeptVo>> list(DeptBo bo) {
    return R.ok(service.queryList(bo));   // 一次性返回整棵树
}
```

### 错误 4：响应包装混乱 / 暴露 Entity ❌

```java
// ❌ 错误
@GetMapping("/{id}")
public ResponseEntity<TestDemo> getInfo(@PathVariable Long id) {  // 自造包装 + 直接暴露 Entity
    return ResponseEntity.ok(testDemoService.getById(id));
}
```

```java
// ✅ 正确：统一 R<T>，出参用 VO
@GetMapping("/{id}")
public R<TestDemoVo> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long id) {
    return R.ok(testDemoService.queryById(id));
}
```

### 错误 5：写接口漏权限/日志/防重 ❌

```java
// ❌ 错误：管理写接口裸奔
@PostMapping()
public R<Void> add(@RequestBody DemoBo bo) {
    return toAjax(service.insertByBo(bo));
}
```

```java
// ✅ 正确：权限 + 日志 + 防重 + 分组校验四件套
@SaCheckPermission("demo:demo:add")
@Log(title = "测试单表", businessType = BusinessType.INSERT)
@RepeatSubmit
@PostMapping()
public R<Void> add(@Validated(AddGroup.class) @RequestBody DemoBo bo) {
    return toAjax(service.insertByBo(bo));
}
```

---

## 七、最佳实践清单

1. **路径只用名词资源**：`/list`、`/{id}`、资源根路径、`/{ids}`、`/export`、`/importData`、`/optionselect`；动作交给 HTTP 方法。绝不出现 `/pageXxxs`、`/getXxx/{id}`、`/addXxx`。
2. **权限标识三段式**：`@SaCheckPermission("${module}:${business}:${action}")`，action 取 `list/query/add/edit/remove/export/import`，与菜单按钮权限一致。
3. **写接口必带三件套**：`@SaCheckPermission` + `@Log(title, businessType=BusinessType.X)` + `@RepeatSubmit`；新增/修改再叠加分组校验 `@Validated(AddGroup.class)` / `@Validated(EditGroup.class)`。
4. **BusinessType 对齐动作**：新增 `INSERT`、修改 `UPDATE`、删除 `DELETE`、导出 `EXPORT`、导入 `IMPORT`、清缓存 `CLEAN`。
5. **入参 BO 出参 VO**：Controller 永不直接收发 Entity；查询条件（含日期范围 `params`）放 BO，展示派生字段放 VO。
6. **统一响应**：只用 `R<T>` / `R<Void>` + `PageResult<Vo>`，绝不自造 `Result`/`AjaxResult`/裸 `ResponseEntity`；导出接口返回 `void` 写 response。
7. **树表特例**：`list` 不分页返回 `R<List<Vo>>`，前端整树渲染。
8. **批量删除**：`DELETE /{ids}` 收 `Long[] ids`，service 端 `Arrays.asList(ids)` 转 List，便于前端传逗号串或数组。
9. **Controller 边界**：只接参/校验/权限/日志/转换；前置唯一性校验、显式业务失败提示（`R.fail(...)` / `ServiceException`）可留 Controller（前提同模块已有此习惯），重业务编排放 service。
10. **接口文档**：SpringDoc OpenAPI + therapi 运行时读 JavaDoc，写规范 JavaDoc（说"做什么"+ 参数语义，`void` 不写 `@return`）即生成文档；**不要**堆砌 `@Schema` / `@Operation`，更不用 Knife4j 旧注解。
11. **前后端命名同步**：前端 `listXxx/getXxx/addXxx/updateXxx/delXxx` 严格对齐后端路由；类型 `VO/Form/Query`（Form 继承 `BaseEntity`，非树表 Query 继承 `PageQuery`，ID 用 `string|number`，有日期范围保留 `params?: any`）。
12. **包名基线**：示例与生成代码统一 `org.dromara.*` 前缀，公共能力 `org.dromara.common.*`，绝不写成 `plus.ruoyi` / `com.ruoyi`。

---

## 八、相关技能

| 需求 | 用哪个技能 |
|------|-----------|
| 开发完整 CRUD 业务模块（Entity/BO/VO/Service/Mapper/Controller 全链路） | `crud-development` |
| 数据库表设计、SQL、字典 | `database-ops` |
| 认证授权、Sa-Token、`@SaCheckPermission` 细节 | `security-guard` |
| 行级数据权限 `@DataPermission` | `data-permission` |
| 异常处理机制、错误码、`ServiceException` 设计 | `error-handler` |
| 操作日志 `@Log`、审计 | `log-audit` |
| 接口报错排查 | `bug-detective` |
