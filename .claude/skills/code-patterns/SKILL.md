---
name: code-patterns
description: |
  全栈编码禁令与规范速查表（base-dev-framework6-java）。后端 org.dromara 三层无 DAO、QueryBuilder + BaseMapperPlus、标准 REST；前端代码生成器 Vue(Element Plus) + React(Ant Design Pro) 双栈；通用 UTF-8/LF、命名、Git 提交、JavaDoc 规范。

  触发场景：
  - 查看 框架禁止事项（后端 / 前端 / 通用），自检代码是否违规
  - 命名规范速查（包名、类名后缀、方法、表/字段、API 命名）
  - Git 提交规范、代码风格（缩进 / 换行 / 编码）速查
  - 不确定某个写法是否符合本项目（框架约定），需要"错误 vs 正确"对照
  - 区分 框架与定制衍生版（plus.ruoyi/DAO/A 组件）的写法差异

  触发词：规范、禁止、命名、Git提交、代码风格、不能用、不允许、约定、红线、禁令、对照表、不规范、写法错了、应该怎么写

  注意：完整 CRUD 开发流程请激活 crud-development，REST 接口设计请激活 api-development，前端组件用法请激活 ui-pc，安全注解请激活 security-guard。本技能只做"禁令 / 规范速查"。
---

# 代码规范速查（base-dev-framework6-java）

> 🔴 **本项目遵循框架约定**，不套用任何定制衍生版。
> 后端包名 `org.dromara`、**三层无 DAO**、`BaseMapperPlus` + `QueryBuilder`、标准 REST 路由。
> 所有禁令与正确写法以本框架真实源码为准。
> 出现 `plus.ruoyi` / DAO 层 / `PlusLambdaQuery` / `A*` 组件 等写法 = **来自定制衍生版的污染，一律禁止**。

---

## 🧭 决策顺序（写代码取样的优先级，冲突时从上往下）

写任何代码前，按下面顺序找"参照物"，**不要凭通用习惯硬写**：

1. **当前业务模块最近似实现** —— 同模块已有的相似 Entity/Service/Controller 是第一参照。
2. **公共能力模块统一约定** —— `ruoyi-common-mybatis` / `ruoyi-common-core` / `ruoyi-common-web` 等的统一封装。
3. **generator 模板** —— `backend/java/ruoyi-modules/ruoyi-gen/src/main/resources/fm/` 下的 `.ftl` 模板（标准单表 CRUD 的黄金骨架）。
4. **通用 Spring / MyBatis-Plus 默认习惯** —— 前三者都没有时才退回这一层。

> **规则冲突时，永远相信当前仓库的真实代码**，而不是本表或通用记忆。
> "新建标准单表 CRUD" → 优先看 generator；"改已有复杂模块（system/workflow）" → 优先看现有模块。

---

## 🚫 全栈禁令总表（一眼定位所有错误写法）

| 端 | ❌ 禁止写法（含定制版污染） | ✅ 框架正确写法 | 原因 |
|----|--------------------------|--------------------|------|
| 后端 | `package plus.ruoyi.*` / `package com.ruoyi.*` | `package org.dromara.*` | 框架包名前缀是 `org.dromara` |
| 后端 | 内联全限定名 `org.dromara.common.core.domain.R<T>` | `import` 后用短类名 `R<T>` | 代码整洁，禁止内联全限定名 |
| 后端 | 四层架构（Controller→Service→**DAO**→Mapper） | **三层**（Controller→Service→Mapper） | 框架无 DAO 层 |
| 后端 | `IXxxDao` / `XxxDaoImpl` / `BaseDaoImpl` | Service 直接用 `XxxMapper extends BaseMapperPlus<Xxx, XxxVo>` | 原版无 DAO，Service 直接持有 Mapper |
| 后端 | DAO 层 `buildQueryWrapper(bo)` 构建查询 | **Service 层** `buildQueryWrapper`/内联 `QueryBuilder.lambda(Entity.class)` | 查询构建在 Service，不在 DAO |
| 后端 | `PlusLambdaQuery.of()` | `QueryBuilder.lambda(Entity.class)` / `QueryBuilder.lambdaJoin("u", Entity.class)` | 原版查询入口是 QueryBuilder |
| 后端 | `like(Long/Date 字段, value)` / `likeCast(...)` | `eqIfText` / `likeIfText` / `eqIfPresent` / `inIfNotEmpty` / `betweenParams` | 原版条件辅助方法命名固定，无 `likeCast` |
| 后端 | `extends ServiceImpl<XxxMapper, Xxx>` | `implements IXxxService`（不继承任何基类） | Service 不继承 ServiceImpl |
| 后端 | `extends TenantEntity`（当默认基类） | `extends BaseEntity`（`org.dromara.common.mybatis.core.domain`） | 默认基类是 BaseEntity；多租户才显式用 TenantEntity |
| 后端 | `BeanUtil.copyProperties()` / `BeanUtils.copyProperties()` | `MapstructUtils.convert(bo, Entity.class)` | 统一用 MapStruct-Plus |
| 后端 | `@AutoMappers` | `@AutoMapper(target = Entity.class)`（BO 加 `reverseConvertGenerate = false`） | 原版注解是单数 `@AutoMapper` |
| 后端 | `Map<String, Object>` 返回业务数据 | 定义 `XxxVo` 类返回 | 类型安全，Controller 不暴露 Map |
| 后端 | Controller 暴露 Entity 入参/出参 | 入参 `XxxBo`，出参 `XxxVo` | Entity 不出 Service 边界 |
| 后端 | 写接口漏 `@SaCheckPermission` / `@Log` | 写接口必带 `@SaCheckPermission` + `@Log` | 权限 + 审计不可缺 |
| 后端 | 跨模块 `import` 另一业务模块实现类 | 走 `ruoyi-api` 接口契约（如 `UserService`） | 模块解耦，不直接依赖实现 |
| 后端 | `AUTO_INCREMENT` 自增主键 | 雪花 ID（`@TableId`，不指定 type） | 全局雪花 ID 策略 |
| 后端 | 手写 entity→vo 重复映射 | 依赖 `BaseMapperPlus#selectVoPage/selectVoList` | 不退回手工映射 |
| 后端 | `@Cacheable` 返回 `List.of()/Set.of()/Map.of()` | `new ArrayList<>(...)` / `new HashSet<>(...)` | 不可变集合反序列化失败 |
| SQL | 逻辑删除字段 `is_deleted` | **`del_flag`**（`@TableLogic`） | 框架逻辑删除字段是 `del_flag` |
| SQL | 手机号字段 `phone` | **`phone_number`**（原版 sys_user） | 原版 sys_user 字段名 |
| API | `/pageXxxs`、`/getXxx/{id}`、`/addXxx`、`/deleteXxxs/{ids}` | 标准 REST：`GET /list`、`GET /{id}`、`POST`、`PUT`、`DELETE /{ids}` | 原版用标准 REST，不带实体名后缀 |
| 前端 | `<AFormInput>`、`<AModal>`、`<ASearchForm>` | `<el-input>`、`<el-dialog>`、Element Plus `el-*` + 新版 hooks | 原版前端用 Element Plus 原生 + 封装 hooks |
| 前端 | `from '@/wd'` / `from 'wot-design-uni'` | 无（6.x 不交付 uniapp / WD UI） | 本框架无移动端 |
| 前端 | API 命名 `pageXxxs/getXxx`（带后缀） | `listXxx/getXxx/addXxx/updateXxx/delXxx` | 对齐标准 REST 路由 |
| Bash | `command > nul` | `command > /dev/null 2>&1` | Windows 会创建名为 nul 的文件 |
| 全栈 | UTF-8 with BOM / GBK / CRLF | UTF-8 无 BOM + LF | 统一编码与换行 |

> 上表是"速查索引"，下面各章节给出可复制的"错误 vs 正确"代码块。

---

## 🚫 后端禁令（框架约定）

### 1. 包名必须是 `org.dromara.*`

```java
// ✅ 正确
package org.dromara.system.service.impl;

// ❌ 错误（定制衍生版 / 旧 RuoYi）
package plus.ruoyi.system.service.impl;
package com.ruoyi.system.service.impl;
```

### 2. 禁止内联全限定类名（先 import 再用短类名）

```java
// ✅ 正确
import org.dromara.common.core.domain.R;
public R<UserVo> getInfo(Long userId) { ... }

// ❌ 错误：直接写全限定名
public org.dromara.common.core.domain.R<UserVo> getInfo(Long userId) { ... }
```

### 3. 三层架构，无 DAO 层

框架标准 CRUD **没有 DAO 层**，Service 直接持有 Mapper。

```
domain/Xxx.java               extends BaseEntity
domain/bo/XxxBo.java          implements Serializable, @AutoMapper(target=Xxx.class, reverseConvertGenerate=false)
domain/vo/XxxVo.java          implements Serializable, @AutoMapper(target=Xxx.class)
mapper/XxxMapper.java         extends BaseMapperPlus<Xxx, XxxVo>
service/IXxxService.java      接口
service/impl/XxxServiceImpl   @RequiredArgsConstructor @Service，注入 XxxMapper
controller/XxxController      extends BaseController
```

```java
// ✅ 正确：Service 直接注入 Mapper（无 DAO）
@RequiredArgsConstructor
@Service
public class SysPostServiceImpl implements ISysPostService {
    private final SysPostMapper baseMapper;   // 直接持有 Mapper
}

// ❌ 错误：定制衍生版的 DAO 层（原版没有）
@Service
public class SysPostServiceImpl implements ISysPostService {
    private final ISysPostDao postDao;        // 禁止：原版无 DAO
}
```

### 4. Service 不继承 ServiceImpl

```java
// ✅ 正确：只实现接口，不继承基类
@RequiredArgsConstructor
@Service
public class SysPostServiceImpl implements ISysPostService {
    private final SysPostMapper baseMapper;
}

// ❌ 错误
public class SysPostServiceImpl extends ServiceImpl<SysPostMapper, SysPost>
        implements ISysPostService { }
```

### 5. Entity 默认继承 `BaseEntity`，不是 `TenantEntity`

```java
// ✅ 正确：默认基类 BaseEntity
import org.dromara.common.mybatis.core.domain.BaseEntity;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_post")
public class SysPost extends BaseEntity {
    @TableId(value = "post_id")
    private Long postId;

    @TableLogic
    private String delFlag;   // 逻辑删除字段是 del_flag
}

// ❌ 错误：把 TenantEntity 当默认基类（那是多租户专用）
public class SysPost extends TenantEntity { }   // 仅多租户业务才显式用
```

> 只有"该业务确实需要租户隔离"时才显式继承 `TenantEntity`；普通业务一律 `BaseEntity`。

### 6. 查询用 `QueryBuilder.lambda` + `eqIfText/likeIfText`，禁 `likeCast`

```java
// ✅ 正确：QueryBuilder + IfText/IfPresent 条件辅助
private LambdaQueryWrapper<SysPost> buildQueryWrapper(SysPostBo bo) {
    Map<String, Object> params = bo.getParams();
    return QueryBuilder.lambda(SysPost.class)
        .likeIfText(SysPost::getPostName, bo.getPostName())
        .eqIfText(SysPost::getStatus, bo.getStatus())
        .eqIfPresent(SysPost::getDeptId, bo.getDeptId())
        .betweenParams(SysPost::getCreateTime, params, "beginTime", "endTime")
        .build();
}

// ❌ 错误：定制衍生版 PlusLambdaQuery + likeCast（原版无）
PlusLambdaQuery<SysPost> lqw = PlusLambdaQuery.of();   // 禁止
lqw.likeCast(SysPost::getPostId, bo.getKeyword());     // 禁止：原版无 likeCast
```

固定的条件辅助方法命名（只用这些，不要自造）：
`eqIfPresent` / `eqIfText` / `neIfPresent` / `likeIfText` / `betweenIfPresent` / `betweenParams` / `inIfNotEmpty` / `findInSetIfPresent`。

### 7. 对象转换统一 `MapstructUtils.convert`，禁 `BeanUtil`

```java
// ✅ 正确
SysPost post = MapstructUtils.convert(bo, SysPost.class);
List<SysPostVo> voList = MapstructUtils.convert(list, SysPostVo.class);

// ❌ 错误
BeanUtil.copyProperties(bo, post);      // 禁止
BeanUtils.copyProperties(bo, post);     // 禁止
```

### 8. BO/VO 映射注解是 `@AutoMapper`（单数），禁 `@AutoMappers`

```java
// ✅ 正确
@AutoMapper(target = SysPost.class, reverseConvertGenerate = false)   // BO
public class SysPostBo implements Serializable { }

@AutoMapper(target = SysPost.class)                                   // VO
public class SysPostVo implements Serializable { }

// ❌ 错误：定制衍生版的复数注解
@AutoMappers(...)   // 禁止：原版是单数 @AutoMapper
```

### 9. 分页：`selectVoPage` + `PageResult.build`

```java
// ✅ 正确
@Override
public PageResult<SysPostVo> queryPageList(SysPostBo bo, PageQuery pageQuery) {
    LambdaQueryWrapper<SysPost> lqw = buildQueryWrapper(bo);
    Page<SysPostVo> page = baseMapper.selectVoPage(pageQuery.build(), lqw);
    return PageResult.build(page.getRecords(), page.getTotal());
}

// 自定义分页 / 服务内部分页可用 PageResult：
Page<SysPostVo> result = baseMapper.selectVoPage(pageQuery.build(), lqw);
return PageResult.build(result.getRecords(), result.getTotal());

// ❌ 错误：手写 entity→vo 循环映射 / 自造分页 DTO
```

> 统一用 `PageQuery` + `PageResult`，不要无故引入新分页 DTO。

### 10. Controller 标准 REST 路由 + 必带权限/日志

```java
// ✅ 正确：标准 REST，写接口带 @SaCheckPermission + @Log
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/system/post")
public class SysPostController extends BaseController {

    private final ISysPostService postService;

    @SaCheckPermission("system:post:list")
    @GetMapping("/list")
    public R<PageResult<SysPostVo>> list(SysPostBo bo, PageQuery pageQuery) {
        return R.ok(postService.queryPageList(bo, pageQuery));
    }

    @SaCheckPermission("system:post:query")
    @GetMapping("/{postId}")
    public R<SysPostVo> getInfo(@PathVariable Long postId) {
        return R.ok(postService.queryById(postId));
    }

    @SaCheckPermission("system:post:add")
    @Log(title = "岗位管理", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public R<Void> add(@Validated(AddGroup.class) @RequestBody SysPostBo bo) {
        return toAjax(postService.insertByBo(bo));
    }

    @SaCheckPermission("system:post:edit")
    @Log(title = "岗位管理", businessType = BusinessType.UPDATE)
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody SysPostBo bo) {
        return toAjax(postService.updateByBo(bo));
    }

    @SaCheckPermission("system:post:remove")
    @Log(title = "岗位管理", businessType = BusinessType.DELETE)
    @DeleteMapping("/{postIds}")
    public R<Void> remove(@PathVariable Long[] postIds) {
        return toAjax(postService.deleteWithValidByIds(List.of(postIds), true));
    }
}

// ❌ 错误：定制衍生版的带实体名路由
@GetMapping("/pagePosts")          // 禁止
@GetMapping("/getPost/{id}")       // 禁止
@PostMapping("/addPost")           // 禁止
@DeleteMapping("/deletePosts/{ids}") // 禁止
```

权限标识格式固定为 `${module}:${business}:${action}`（如 `system:post:add`）。

### 11. 跨模块走 `ruoyi-api` 契约，不直接 import 实现

```java
// ✅ 正确：跨模块调用走 ruoyi-api 暴露的接口（DubboReference / 接口契约）
import org.dromara.system.api.RemoteUserService;   // 来自 ruoyi-api

// ❌ 错误：直接 import 另一个业务模块的实现类
import org.dromara.system.service.impl.SysUserServiceImpl;   // 禁止跨模块依赖实现
```

新增对外接口时，先在 `ruoyi-api` 定接口 + DTO/Model/Event，再由业务模块实现。

### 12. 写操作事务 + 显式业务失败用 `ServiceException`

```java
// ✅ 正确
@Transactional(rollbackFor = Exception.class)
public int deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
    if (isValid) {
        // 删除前校验，违规直接抛 ServiceException
        if (checkPostExistUser(ids)) {
            throw new ServiceException("岗位已分配，不能删除");
        }
    }
    return baseMapper.deleteByIds(ids);
}

// ❌ 错误：多表写入不加事务 / 用 return false 吞掉业务失败
```

### 13. Bash 禁止 `> nul`

```bash
# ✅ 正确
command > /dev/null 2>&1

# ❌ 错误（Windows 会创建名为 nul 的文件）
command > nul
command 2> nul
```

### 14. `@Cacheable` 禁返回不可变集合

```java
// ❌ 错误：List.of()/Set.of()/Map.of() 反序列化失败
@Cacheable(cacheNames = CacheNames.SYS_DICT)
public List<SysDictData> selectByType(String type) {
    return List.of(...);   // 禁止
}

// ✅ 正确：可变集合包装
@Cacheable(cacheNames = CacheNames.SYS_DICT)
public List<SysDictData> selectByType(String type) {
    return new ArrayList<>(List.of(...));   // ✅
}
```

> 写操作改数据后，已有缓存的模块要同步处理 `@CacheEvict`/`CacheUtils.evict`（如字典同时维护 `SYS_DICT` 与 `SYS_DICT_TYPE`），不要只改库不清缓存。

### 15. 生成器默认方法集合（新建 CRUD 优先对齐）

从零新增标准单表 CRUD，方法名优先对齐 generator：

| 方法 | 职责 |
|------|------|
| `queryById(id)` | 查询单条返回 Vo |
| `queryPageList(bo, pageQuery)` | 分页查询 |
| `queryList(bo)` | 列表查询 |
| `insertByBo(bo)` | 新增 |
| `updateByBo(bo)` | 修改 |
| `deleteWithValidByIds(ids, isValid)` | 删除（含删除前校验） |

再叠加模块增强：唯一性校验、`@DataPermission` 数据权限、MPJ 联表、缓存注解、Excel 导入导出监听器、关联表维护。

---

## 🚫 前端禁令（代码生成器产物 · Vue + React 双栈）

> 6.x 前端是**代码生成器模板**产出（`ruoyi-gen/.../fm/<frontendType>/`）：`vue` → Element Plus，`react` → Ant Design Pro。
> 本框架**不交付 uniapp / 移动端 / WD UI**，因此不存在 `@/wd`、`wd-*`、`AFormInput` 等写法。

### Vue（Element Plus）

```vue
<!-- ✅ 正确：Element Plus 原生 el-* + 新版生成器 hooks -->
<script setup lang="ts">
import { listPost, getPost, addPost, updatePost, delPost } from '@/api/system/post';
import type { PostVO, PostForm, PostQuery } from '@/api/system/post/types';

const { loading, setLoading } = useLoading();
const { dialog, openDialog, closeDialog } = useFormDialog();
const { dateRange, ... } = useDateRangeQuery();
const { sys_normal_disable } = toRefs<any>(useDict('sys_normal_disable'));
</script>

<template>
  <el-form :inline="true" v-show="showSearch">
    <el-form-item label="岗位名称" prop="postName">
      <el-input v-model="queryParams.postName" />
    </el-form-item>
  </el-form>
  <el-button v-hasPermi="['system:post:add']" @click="handleAdd">新增</el-button>
  <el-dialog v-model="dialog.visible" :title="dialog.title"> ... </el-dialog>
</template>
```

```vue
<!-- ❌ 错误：定制衍生版 A* 封装组件（原版没有） -->
<AFormInput v-model="form.postName" />     <!-- 禁止 -->
<AModal v-model="visible" />               <!-- 禁止 -->
<ASearchForm />                            <!-- 禁止 -->
```

要点：`<script setup lang="ts">`；状态放 `reactive<PageData<Form, Query>>({...})` + `toRefs`；
弹窗用 `useFormDialog`（`dialog/openDialog/showDialog/closeDialog`）；
日期范围用 `useDateRangeQuery`；字典 `toRefs<any>(useDict(...))`；
保留 `v-hasPermi="['module:business:add']"`；复用 `right-toolbar/pagination/dict-tag/image-preview/image-upload/file-upload/editor`。

### React（Ant Design Pro）

```tsx
// ✅ 正确：antd + @ant-design/pro-components
import { ProTable, ModalForm, ProFormText } from '@ant-design/pro-components';
import { listPost, getPost, addPost, updatePost, delPost } from '@/api/system/post';

// 列表用 ProTable，新增/编辑弹窗用 ModalForm / ProForm*
```

> React 栈的 API 函数名 / 路由段与 Vue 栈完全一致（同后端路由），不要各写一套。

### API 文件命名（对齐标准 REST 路由）

```typescript
// ✅ 正确：listXxx/getXxx/addXxx/updateXxx/delXxx 对应标准 REST
import request from '@/utils/request';
import { AxiosPromise } from '@/utils/api-types';
import { PageResult } from '@/api/types';
import { PostVO, PostForm, PostQuery } from '@/api/system/post/types';

// listXxx -> GET /<module>/<business>/list
export function listPost(query: PostQuery): AxiosPromise<PageResult<PostVO>> {
  return request({ url: '/system/post/list', method: 'get', params: query });
}
// getXxx -> GET /<module>/<business>/{id}
export function getPost(postId: string | number): AxiosPromise<PostVO> {
  return request({ url: '/system/post/' + postId, method: 'get' });
}
// addXxx -> POST，updateXxx -> PUT，delXxx -> DELETE /{ids}
export function addPost(data: PostForm) { return request({ url: '/system/post', method: 'post', data }); }
export function updatePost(data: PostForm) { return request({ url: '/system/post', method: 'put', data }); }
export function delPost(postId: string | number | Array<string | number>) {
  return request({ url: '/system/post/' + postId, method: 'delete' });
}

// ❌ 错误：定制衍生版带实体名后缀命名（路由也错）
export function pagePosts() { return request({ url: '/system/post/pagePosts', ... }); }   // 禁止
```

### 类型文件（VO / Form / Query）

```typescript
// ✅ 正确
export interface PostVO {
  postId: string | number;
  postName: string;
  status: string;
  createTime: string;
}
export interface PostForm extends BaseEntity {   // Form 继承 BaseEntity
  postId?: string | number;
  postName?: string;
}
export interface PostQuery extends PageQuery {    // 非树表 Query 继承 PageQuery
  postName?: string;
  status?: string;
  params?: any;                                   // 有日期范围保留 params
}
```

类型映射：ID 用 `string | number`；Java 数值 → `number`；Boolean → `boolean`；其余默认 `string`；存在日期范围保留 `params?: any`。

### 前端避免事项

- 生成器风格页面不要突然换成完全不同的状态管理方式（除非该前端目录本身已这么做）。
- 模块已使用字典时，不要把选项文案硬编码进页面。
- API 函数名和路由段不要偏离后端约定。
- 后端 BO/service 依赖 `begin/end` 参数时，不要从查询对象删掉 `params` 和日期范围处理。

---

## 🌐 通用编码与风格规范

### 编码与换行（全局强制）

| 项 | 规范 |
|----|------|
| 文件编码 | **UTF-8 无 BOM**（禁 UTF-8 with BOM / GBK / GB2312 / ANSI / ISO-8859-1） |
| 换行符 | **LF**（遵循 `.editorconfig`，不混用 CRLF） |
| Java 缩进 | **4 个空格**（不用 Tab） |
| JSON / YAML 缩进 | **2 个空格** |
| 中文内容 | 注释 / 日志 / 文档中文必须可读，不允许乱码（如"鍥藉"） |
| `import`/注解顺序 | 以邻近代码为准，**不要顺手重排整文件** |

> 批量改 Java 文件后抽查文件头字节，确认无 `EF BB BF`（BOM）。`java: 非法字符: '﻿'` 优先判定为 BOM 问题。

### 命名规范

**后端命名**

| 类型 | 规范 | 示例 |
|------|------|------|
| 包名 | 小写点分，前缀 `org.dromara` | `org.dromara.system.service` |
| 类名 | 大驼峰 | `SysPostServiceImpl` |
| 方法名 | 小驼峰 | `queryPageList`、`insertByBo` |
| 变量名 | 小驼峰 | `postName`、`createTime` |
| 常量 | 全大写下划线 | `MAX_PAGE_SIZE` |
| 表名 | 小写下划线 | `sys_post`、`sys_user` |
| 字段名 | 小写下划线 | `post_name`、`create_time`、`del_flag` |

**类命名后缀**

| 类型 | 后缀 | 示例 |
|------|------|------|
| 实体类 | 无 | `SysPost` |
| 业务对象 | `Bo` | `SysPostBo` |
| 视图对象 | `Vo` | `SysPostVo` |
| 服务接口 | `IXxxService` | `ISysPostService` |
| 服务实现 | `XxxServiceImpl` | `SysPostServiceImpl` |
| Mapper | `XxxMapper` | `SysPostMapper` |
| 控制器 | `XxxController` | `SysPostController` |

> ⚠️ 框架**无 DAO 层**，因此没有 `IXxxDao` / `XxxDaoImpl` 这类命名。

**Service Mapper 注入命名**：去掉清晰的模块/系统前缀后用 lowerCamel + `Mapper`，如 `SysRoleMapper` → `roleMapper`、`SysDictDataMapper` → `dictDataMapper`；去前缀会产生歧义/冲突时保留前缀。代码生成器模板常直接命名 `baseMapper`。

**前端命名（TypeScript）**

| 类型 | 规范 | 示例 |
|------|------|------|
| API 文件 | 模块/业务目录下的 `index.ts` | `@/api/system/post/index.ts` |
| 类型文件 | 业务目录下的 `types.ts` | `@/api/system/post/types.ts` |
| API 函数 | `listXxx/getXxx/addXxx/updateXxx/delXxx` | `listPost`、`addPost` |
| 类型接口 | `VO/Form/Query` | `PostVO`、`PostForm`、`PostQuery` |

### JavaDoc 规范

- 公共 API、接口、`VO/BO/Entity` 字段、Mapper 默认方法、Service/Controller 方法应有**简洁** JavaDoc。
- 注释描述"做什么"和关键参数语义，不复述显而易见的实现细节。
- `void` 方法不写 `@return`；返回布尔值时说明 `true/false` 含义。
- 私有方法只有在业务规则 / 算法 / 映射关系不直观时才补注释。
- 框架覆写方法若只是标准回调，可不重复注释；但当前文件已有统一注释风格时保持一致。
- **只改注释时**：不重排 import、不格式化全文件、不修改代码行为。

```java
/**
 * 根据岗位 ID 查询岗位信息
 *
 * @param postId 岗位 ID
 * @return 岗位视图对象，不存在时返回 null
 */
SysPostVo queryById(Long postId);
```

### 避免过度工程

1. 不创建只有一处使用的抽象（三处以上相同代码才考虑抽取）。
2. 只实现当前需求，不"以防万一"加功能。
3. 优先简单直接方案，复杂方案需明确理由。
4. 不给显而易见的代码加注释。
5. 删除废弃代码而非注释保留（Git 有历史）。
6. 不要把 `BaseMapperPlus`/`PageQuery`/`PageResult`/`R`/`MapstructUtils` 等统一封装替换成临时自造方案。

### Git 提交规范

格式：`<type>(<scope>): <description>`

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响逻辑） |
| `refactor` | 重构（非新功能或修复） |
| `perf` | 性能优化 |
| `test` | 测试 |
| `chore` | 构建 / 工具 |

```bash
feat(system): 新增岗位批量导出接口
fix(workflow): 修复流程实例分页数据权限失效
docs(readme): 更新 Java 21 启动说明
refactor(common-mybatis): 抽取 QueryBuilder 条件辅助方法
perf(gen): 优化代码生成器模板渲染性能
```

---

## ✅ 交付前自检清单

提交代码前至少核对：

- [ ] 包名 `org.dromara.*`，无 `plus.ruoyi` / `com.ruoyi`，无内联全限定名。
- [ ] 三层结构（无 DAO），Service 直接用 `BaseMapperPlus`，未继承 `ServiceImpl`。
- [ ] Entity 默认 `extends BaseEntity`（多租户才显式 `TenantEntity`）；逻辑删除字段 `del_flag` + `@TableLogic`。
- [ ] 查询用 `QueryBuilder.lambda` + `eqIfText/likeIfText/betweenParams`，无 `PlusLambdaQuery`/`likeCast`。
- [ ] 对象转换 `MapstructUtils.convert`，注解 `@AutoMapper`（非 `@AutoMappers`），无 `BeanUtil`。
- [ ] Controller 标准 REST（`/list`、`/{id}`、`POST`、`PUT`、`DELETE /{ids}`），无 `/pageXxxs` 式路由。
- [ ] 写接口都带 `@SaCheckPermission`（`module:business:action`）+ `@Log`，多表写入有 `@Transactional`。
- [ ] 分页 `selectVoPage` + `PageResult.build`，未手写映射循环。
- [ ] 跨模块走 `ruoyi-api` 契约，未 import 别的业务模块实现类。
- [ ] 前端 API 命名 `listXxx/getXxx/...` 对齐路由；类型 `VO/Form/Query`；无 `A*`/`@/wd`。
- [ ] 文件 UTF-8 无 BOM + LF；Java 4 空格 / JSON·YAML 2 空格；中文无乱码；只改注释未重排全文件。
- [ ] Git 提交信息符合 `type(scope): description`。

---

## 🔗 相关 Skill

| 需要了解 | 激活 Skill |
|---------|-----------|
| 完整 CRUD 全栈开发流程 | `crud-development` |
| REST 接口设计 / `R<T>` 响应规范 | `api-development` |
| Sa-Token 权限 / 数据脱敏 / 加解密 | `security-guard` |
| 行级数据权限 `@DataPermission` | `data-permission` |
| 前端 Element Plus 组件 / hooks 用法 | `ui-pc` |
| 数据库表设计 / `del_flag` / 雪花 ID | `database-ops` |
| 异常处理机制 / `ServiceException` | `error-handler` |
| 工具类选择（DateUtils/StreamUtils 等） | `utils-toolkit` |
