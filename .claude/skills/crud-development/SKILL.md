---
name: crud-development
description: |
  base-dev-framework6-java CRUD 业务模块全栈开发指南。覆盖后端四件套
  （domain / bo / vo / mapper / service / serviceImpl / controller）+ 前端 Vue(Element Plus)
  与 React(Ant Design Pro) 双栈的 api.ts / types.ts 数据通道。所有约定均来自代码生成器
  FreeMarker 模板（fm/java、fm/vue、fm/react）与 ruoyi-demo / ruoyi-system 真实模块。

  触发场景：
  - 创建一个新的业务模块（如「客户档案」「优惠券」「设备台账」），需要从零搭出整套增删改查骨架。
  - 编写后端代码：Entity、BO、VO、Mapper、IXxxService、XxxServiceImpl、XxxController。
  - 编写前端数据通道：xxxApi.ts、xxxTypes.ts（Vue / React 任一栈），与后端路由对齐。
  - 已有表结构、只需补齐标准 REST 接口（list / export / {id} / 新增 / 修改 / 删除）。
  - 把代码生成器裸产物再叠加唯一校验、数据权限、Excel 导入导出等模块增强。

  触发词：CRUD、增删改查、新建模块、业务模块、Entity、实体、BO、VO、Mapper、Service、
  ServiceImpl、Controller、后端代码、Java 代码、selectVoPage、PageQuery、PageResult、
  QueryBuilder、MapstructUtils、BaseMapperPlus、xxxApi.ts、xxxTypes.ts、代码生成器、generator

  本项目 base-dev-framework6-java 遵循框架约定！包名 org.dromara.*；三层无 DAO；
  查询条件在 Service 层用 QueryBuilder/LambdaQueryWrapper 构建；Service 不继承 ServiceImpl。
---

# CRUD 业务模块开发（base-dev-framework6-java）

## 一、概述

本技能指导在 **base-dev-framework6-java** 中开发一个完整 CRUD 业务模块。
一切以 **代码生成器 FreeMarker 模板** 为权威骨架，再对照 **真实模块（ruoyi-demo / ruoyi-system）**
叠加增强。决策顺序（冲突时）：① 当前模块最近似实现 → ② 公共能力模块统一约定
（`ruoyi-common-mybatis` / `core` / `web`）→ ③ generator 模板 → ④ 通用 Spring / MyBatis-Plus 习惯。

### 这是「公司基础框架」，遵循 框架约定，不是任何衍生定制版

| 维度 | 框架约定（本项目） | ❌ 不要套用的衍生版约定 |
|------|------------------|----------------------|
| 包名 | `org.dromara.*` | `plus.ruoyi.*` / `com.ruoyi.*` |
| 分层 | Controller → Service → **Mapper（无 DAO 层）** | 带独立 DAO 层 |
| 查询条件构建位置 | **Service 层**（`buildQueryWrapper(bo)` 私有方法） | DAO 里的 `buildQueryWrapper()` |
| Mapper 基类 | `extends BaseMapperPlus<Entity, Vo>` | `IXxxDao` / 手写 mapper |
| 查询入口 | `QueryBuilder.lambda(Entity.class)` / `Wrappers.lambdaQuery()` | `PlusLambdaQuery` / `likeCast` |
| Entity 基类 | `extends BaseEntity` | `TenantEntity` |
| 逻辑删除字段 | `del_flag`（`@TableLogic`） | `is_deleted` |
| 前端模板引擎 | **FreeMarker（`.ftl`）** | Velocity（`.vm`） |
| 前端栈 | `fm/vue`（Element Plus）/ `fm/react`（Ant Design Pro） | `@/wd` / wot-design 移动端组件 |

### 后端分层结构（标准 CRUD 七件套）

```
domain/Xxx.java                 extends BaseEntity，@TableName，@TableId 雪花
domain/bo/XxxBo.java            implements Serializable，@AutoMapper(target=Xxx.class, reverseConvertGenerate=false)
domain/vo/XxxVo.java            implements Serializable，@AutoMapper(target=Xxx.class)，@ExcelIgnoreUnannotated
mapper/XxxMapper.java           extends BaseMapperPlus<Xxx, XxxVo>
service/IXxxService.java        接口（方法集合见下）
service/impl/XxxServiceImpl.java implements IXxxService（★不继承 ServiceImpl★），@RequiredArgsConstructor @Service
controller/XxxController.java   extends BaseController，返回 R<T>
```

### 生成器默认方法集合（必须先对齐，再叠加增强）

```
queryById / queryPageList / queryList / insertByBo / updateByBo / deleteWithValidByIds
```

再按模块需要叠加：唯一性校验（`checkUnique`）、数据权限（`@DataPermission`）、
状态/排序更新（`updateStatus` / `updateSort`）、MPJ 联表、缓存注解、Excel 导入导出监听器、关联表维护。

---

## 二、后端四件套真实代码示例

> 下列示例以「客户档案」`Customer`（表 `biz_customer`，模块 `biz`，业务 `customer`，
> 权限前缀 `biz:customer`）为例，结构 1:1 取自 `fm/java/*.ftl` 模板与 `ruoyi-demo` 的 `TestDemo` 真实模块。

### 2.1 Entity（`domain/Customer.java`）

```java
package org.dromara.biz.domain;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;

import java.io.Serial;

/**
 * 客户档案对象 biz_customer
 *
 * @author ruoyi
 * @date 2026-06-20
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("biz_customer")
public class Customer extends BaseEntity {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @TableId(value = "id")
    private Long id;

    /** 客户名称 */
    private String customerName;

    /** 状态（0正常 1停用） */
    private String status;

    /** 版本（乐观锁） */
    @Version
    private Long version;

    /** 删除标志 */
    @TableLogic
    private Long delFlag;
}
```

要点：继承 `BaseEntity`（自带 `createBy/createTime/updateBy/updateTime`）；`@TableId` 主键走雪花 ID；
逻辑删除字段固定为 **`del_flag`** + `@TableLogic`；有乐观锁列保留 `@Version`；
展示型派生字段（如 `xxxName`）放 **VO**，不放 Entity。普通列默认不写 `@TableField`，
只有列名需特殊映射时才补 `@TableField(value = "...")`（参见 `domain.java.ftl` 第 40-42 行）。

### 2.2 BO（`domain/bo/CustomerBo.java`）

```java
package org.dromara.biz.domain.bo;

import io.github.linpeilie.annotations.AutoMapper;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import org.dromara.biz.domain.Customer;

import java.io.Serial;
import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;

/**
 * 客户档案业务对象 biz_customer
 *
 * @author ruoyi
 * @date 2026-06-20
 */
@Data
@AutoMapper(target = Customer.class, reverseConvertGenerate = false)
public class CustomerBo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @NotNull(message = "主键不能为空", groups = {EditGroup.class})
    private Long id;

    /** 客户名称 */
    @NotBlank(message = "客户名称不能为空", groups = {AddGroup.class, EditGroup.class})
    private String customerName;

    /** 状态 */
    private String status;

    /** 查询参数（日期范围 begin/end 从这里取） */
    private Map<String, Object> params = new HashMap<>();
}
```

要点：`implements Serializable`；`@AutoMapper(target=Customer.class, reverseConvertGenerate=false)`；
分组校验用 `AddGroup` / `EditGroup`（查询场景可用 `QueryGroup`），`@NotBlank`(String) / `@NotNull`(其它)
按真实业务语义加，**不要一股脑全套上**；存在日期范围查询时保留 `params = new HashMap<>()`
（对应前端 `addDateRange`，删了前端日期范围就对接不上）。

### 2.3 VO（`domain/vo/CustomerVo.java`）

```java
package org.dromara.biz.domain.vo;

import io.github.linpeilie.annotations.AutoMapper;
import lombok.Data;
import org.apache.fesod.sheet.annotation.ExcelIgnoreUnannotated;
import org.apache.fesod.sheet.annotation.ExcelProperty;
import org.dromara.common.translation.annotation.Translation;
import org.dromara.common.translation.constant.TransConstant;
import org.dromara.biz.domain.Customer;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 客户档案视图对象 biz_customer
 *
 * @author ruoyi
 * @date 2026-06-20
 */
@Data
@ExcelIgnoreUnannotated
@AutoMapper(target = Customer.class)
public class CustomerVo implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键 */
    @ExcelProperty(value = "主键")
    private Long id;

    /** 客户名称 */
    @ExcelProperty(value = "客户名称")
    private String customerName;

    /** 创建人 */
    private Long createBy;

    /** 创建人账号（ID→名称展示，由翻译组件填充） */
    @Translation(type = TransConstant.USER_ID_TO_NAME, mapper = "createBy")
    private String createByName;

    /** 创建时间 */
    private LocalDateTime createTime;
}
```

要点：`implements Serializable` + `@AutoMapper(target=Customer.class)`；导出对象带 `@ExcelIgnoreUnannotated`，
`@ExcelProperty` / `@ExcelDictFormat` 仅在导入导出列上用；ID→名称的展示字段用
`@Translation(type=TransConstant.USER_ID_TO_NAME, mapper="createBy")`（图片 OSS 用 `OSS_ID_TO_URL`，
见 `vo.java.ftl` 第 53-58 行）。

### 2.4 Mapper（`mapper/CustomerMapper.java`）

```java
package org.dromara.biz.mapper;

import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.biz.domain.Customer;
import org.dromara.biz.domain.vo.CustomerVo;

/**
 * 客户档案Mapper接口
 *
 * @author ruoyi
 * @date 2026-06-20
 */
public interface CustomerMapper extends BaseMapperPlus<Customer, CustomerVo> {

}
```

要点：默认形式就一行 `extends BaseMapperPlus<Customer, CustomerVo>`，
天生具备 `selectVoById` / `selectVoList` / `selectVoPage` / `insert` / `updateById` / `deleteByIds` 等。
**不要手写 entity→vo 映射**，也不要补 XML，除非 `BaseMapperPlus + wrapper` 表达不了复杂联表。
需要数据权限时，在 Mapper 上 `default` 重写 `selectVoPage`/`selectVoList` 并叠加 `@DataPermission`
（真实示例见 `ruoyi-demo` 的 `TestDemoMapper`：`@DataColumn(key="deptName", value="dept_id")`）。
复杂联表模块可同时 `extends MPJBaseMapper<Customer>` 并用 `QueryBuilder.lambdaJoin("c", Customer.class)`。

### 2.5 Service 接口（`service/ICustomerService.java`）

```java
package org.dromara.biz.service;

import org.dromara.common.core.domain.PageResult;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.biz.domain.bo.CustomerBo;
import org.dromara.biz.domain.vo.CustomerVo;

import java.util.Collection;
import java.util.List;

/**
 * 客户档案Service接口
 *
 * @author ruoyi
 * @date 2026-06-20
 */
public interface ICustomerService {

    /** 查询客户档案 */
    CustomerVo queryById(Long id);

    /** 分页查询客户档案列表 */
    PageResult<CustomerVo> queryPageList(CustomerBo bo, PageQuery pageQuery);

    /** 查询符合条件的客户档案列表 */
    List<CustomerVo> queryList(CustomerBo bo);

    /** 新增客户档案 */
    Boolean insertByBo(CustomerBo bo);

    /** 修改客户档案 */
    Boolean updateByBo(CustomerBo bo);

    /** 校验并批量删除客户档案信息 */
    Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid);
}
```

要点：接口名是 **`ICustomerService`**（前缀 `I`）；方法签名严格对齐生成器默认集合；
读操作统一返回 `Vo` / `List<Vo>` / `PageResult<Vo>`；分页参数固定用 `PageQuery`，结果固定用 `PageResult`。

### 2.6 ServiceImpl（`service/impl/CustomerServiceImpl.java`）— 查询条件就在这里构建

```java
package org.dromara.biz.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.core.utils.MapstructUtils;
import org.dromara.common.core.utils.StringUtils;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.biz.domain.Customer;
import org.dromara.biz.domain.bo.CustomerBo;
import org.dromara.biz.domain.vo.CustomerVo;
import org.dromara.biz.mapper.CustomerMapper;
import org.dromara.biz.service.ICustomerService;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * 客户档案Service业务层处理
 *
 * @author ruoyi
 * @date 2026-06-20
 */
@RequiredArgsConstructor
@Service
public class CustomerServiceImpl implements ICustomerService {

    private final CustomerMapper customerMapper;

    @Override
    public CustomerVo queryById(Long id) {
        return customerMapper.selectVoById(id);
    }

    @Override
    public PageResult<CustomerVo> queryPageList(CustomerBo bo, PageQuery pageQuery) {
        LambdaQueryWrapper<Customer> lqw = buildQueryWrapper(bo);
        Page<CustomerVo> result = customerMapper.selectVoPage(pageQuery.build(), lqw);
        return PageResult.build(result.getRecords(), result.getTotal());
    }

    @Override
    public List<CustomerVo> queryList(CustomerBo bo) {
        return customerMapper.selectVoList(buildQueryWrapper(bo));
    }

    /** 构建动态查询条件（★查询逻辑在 Service 层，不在 DAO★） */
    private LambdaQueryWrapper<Customer> buildQueryWrapper(CustomerBo bo) {
        Map<String, Object> params = bo.getParams();
        return QueryBuilder.lambda(Customer.class)
            .likeIfText(Customer::getCustomerName, bo.getCustomerName())
            .eqIfText(Customer::getStatus, bo.getStatus())
            .betweenParams(Customer::getCreateTime, params, "beginCreateTime", "endCreateTime")
            .orderByAsc(Customer::getId)
            .build();
    }

    @Override
    public Boolean insertByBo(CustomerBo bo) {
        Customer add = MapstructUtils.convert(bo, Customer.class);
        validEntityBeforeSave(add);
        boolean flag = customerMapper.insert(add) > 0;
        if (flag) {
            bo.setId(add.getId());
        }
        return flag;
    }

    @Override
    public Boolean updateByBo(CustomerBo bo) {
        Customer update = MapstructUtils.convert(bo, Customer.class);
        validEntityBeforeSave(update);
        return customerMapper.updateById(update) > 0;
    }

    /** 保存前的数据校验（唯一约束等在此扩展） */
    private void validEntityBeforeSave(Customer entity) {
        // 例：if (...) { throw new ServiceException("客户名称已存在"); }
    }

    @Override
    public Boolean deleteWithValidByIds(Collection<Long> ids, Boolean isValid) {
        if (isValid) {
            // 删除前业务校验：越权 / 关联引用 / 数据完整性
            List<Customer> list = customerMapper.selectByIds(ids);
            if (list.size() != ids.size()) {
                throw new ServiceException("您没有删除权限!");
            }
        }
        return customerMapper.deleteByIds(ids) > 0;
    }
}
```

要点（最关键）：
- 类 `implements ICustomerService`，**绝不 `extends ServiceImpl`**；`@RequiredArgsConstructor @Service` + `final` 字段构造注入。
- mapper 注入名按「去模块前缀 lowerCamel + Mapper」命名（`SysRoleMapper`→`roleMapper`），歧义时保留前缀。
- 查询条件在私有 `buildQueryWrapper(bo)` 里构建——**这是 Service 层职责，不是 DAO**。
- 新写法首选 `QueryBuilder.lambda(Customer.class)`，条件辅助方法固定用
  `eqIfText` / `likeIfText` / `eqIfPresent` / `neIfPresent` / `inIfNotEmpty` / `betweenParams`；
  老模块已有 `Wrappers.lambdaQuery()` + `StringUtils.isNotBlank(...)` 风格时可增量保持。
- 分页三连：`mapper.selectVoPage(pageQuery.build(), lqw)` → `PageResult.build(records, total)`。
- BO→Entity 一律 `MapstructUtils.convert(bo, Customer.class)`，不要手写 `BeanUtils.copyProperties`。
- 多表写操作加 `@Transactional(rollbackFor = Exception.class)`；显式业务失败抛 `ServiceException`。
- 保留 `validEntityBeforeSave` 扩展点；不要绕过模块已有的数据权限 / 删除前校验。

### 2.7 Controller（`controller/CustomerController.java`）

```java
package org.dromara.biz.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.domain.PageResult;
import org.dromara.common.core.domain.R;
import org.dromara.common.core.validate.AddGroup;
import org.dromara.common.core.validate.EditGroup;
import org.dromara.common.excel.utils.ExcelBuilder;
import org.dromara.common.log.annotation.Log;
import org.dromara.common.log.enums.BusinessType;
import org.dromara.common.mybatis.core.page.PageQuery;
import org.dromara.common.redis.annotation.RepeatSubmit;
import org.dromara.common.web.core.BaseController;
import org.dromara.biz.domain.bo.CustomerBo;
import org.dromara.biz.domain.vo.CustomerVo;
import org.dromara.biz.service.ICustomerService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 客户档案
 *
 * @author ruoyi
 * @date 2026-06-20
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/biz/customer")
public class CustomerController extends BaseController {

    private final ICustomerService customerService;

    /** 查询客户档案列表 */
    @SaCheckPermission("biz:customer:list")
    @GetMapping("/list")
    public R<PageResult<CustomerVo>> list(CustomerBo bo, PageQuery pageQuery) {
        return R.ok(customerService.queryPageList(bo, pageQuery));
    }

    /** 导出客户档案列表 */
    @SaCheckPermission("biz:customer:export")
    @Log(title = "客户档案", businessType = BusinessType.EXPORT)
    @PostMapping("/export")
    public void export(CustomerBo bo, HttpServletResponse response) {
        List<CustomerVo> list = customerService.queryList(bo);
        ExcelBuilder.of(list, CustomerVo.class).sheetName("客户档案").toResponse(response);
    }

    /** 获取客户档案详细信息 */
    @SaCheckPermission("biz:customer:query")
    @GetMapping("/{id}")
    public R<CustomerVo> getInfo(@NotNull(message = "主键不能为空") @PathVariable Long id) {
        return R.ok(customerService.queryById(id));
    }

    /** 新增客户档案 */
    @SaCheckPermission("biz:customer:add")
    @Log(title = "客户档案", businessType = BusinessType.INSERT)
    @RepeatSubmit()
    @PostMapping()
    public R<Void> add(@Validated(AddGroup.class) @RequestBody CustomerBo bo) {
        return toAjax(customerService.insertByBo(bo));
    }

    /** 修改客户档案 */
    @SaCheckPermission("biz:customer:edit")
    @Log(title = "客户档案", businessType = BusinessType.UPDATE)
    @RepeatSubmit()
    @PutMapping()
    public R<Void> edit(@Validated(EditGroup.class) @RequestBody CustomerBo bo) {
        return toAjax(customerService.updateByBo(bo));
    }

    /** 删除客户档案 */
    @SaCheckPermission("biz:customer:remove")
    @Log(title = "客户档案", businessType = BusinessType.DELETE)
    @DeleteMapping("/{ids}")
    public R<Void> remove(@NotEmpty(message = "主键不能为空") @PathVariable Long[] ids) {
        return toAjax(customerService.deleteWithValidByIds(List.of(ids), true));
    }
}
```

要点：
- `extends BaseController`；类上 `@Validated @RestController @RequiredArgsConstructor @RequestMapping("/${module}/${business}")`。
- 返回值统一 `R<T>` / `R<Void>`，写操作用 `toAjax(...)` 包 Boolean。
- 标准 REST 五件套：`GET /list`、`POST /export`、`GET /{id}`、`POST`（新增）、`PUT`（修改）、`DELETE /{ids}`（批量删，传逗号串/数组）。
- 权限 `@SaCheckPermission("${module}:${business}:${action}")`，action ∈ `list/export/query/add/edit/remove`。
- 写操作加 `@Log(title, businessType=BusinessType.X)` + `@RepeatSubmit()` 防重。
- 分组校验：新增 `@Validated(AddGroup.class)`、修改 `@Validated(EditGroup.class)`。
- 树表 `list` 返回 `R<List<Vo>>` 且不分页；普通表 `list` 返回 `R<PageResult<Vo>>`。
- controller 只接参 / 校验 / 权限 / 日志 / 返回值转换，重业务逻辑放 Service。

---

## 三、前端数据通道（Vue + React 双栈）

前端代码同样由生成器产出，模板引擎是 **FreeMarker（`.ftl`）**。
`gen_table.frontend_type` 字段（字符串）直接对应 `fm/<type>/` 目录：`vue` = Element Plus，`react` = Ant Design Pro。
新增前端栈只需加一个 `fm/<type>/` 目录与对应 FTL，**不要在 Java 代码里加枚举或硬编码分支**。
本技能聚焦「数据通道」（api.ts + types.ts），页面 UI 见 `ui-pc` 等技能。

### 3.1 Vue（Element Plus）— `api/biz/customer/index.ts`

```ts
import type { CustomerForm, CustomerQuery, CustomerVO } from '@/api/biz/customer/types';
import type { PageResult } from '@/api/types';
import type { AxiosPromise } from '@/utils/api-types';
import request from '@/utils/request';

/** 查询客户档案列表 */
export const listCustomer = (query?: CustomerQuery): AxiosPromise<PageResult<CustomerVO>> => {
  return request({ url: '/biz/customer/list', method: 'get', params: query });
};

/** 查询客户档案详细 */
export const getCustomer = (id: string | number): AxiosPromise<CustomerVO> => {
  return request({ url: '/biz/customer/' + id, method: 'get' });
};

/** 新增客户档案 */
export const addCustomer = (data: CustomerForm) => {
  return request({ url: '/biz/customer', method: 'post', data });
};

/** 修改客户档案 */
export const updateCustomer = (data: CustomerForm) => {
  return request({ url: '/biz/customer', method: 'put', data });
};

/** 删除客户档案 */
export const delCustomer = (id: string | number | Array<string | number>) => {
  return request({ url: '/biz/customer/' + id, method: 'delete' });
};
```

### 3.2 Vue 类型文件 — `api/biz/customer/types.ts`

```ts
import type { BaseEntity, PageQuery } from '@/api/types';

export interface CustomerVO {
  /** 主键 */
  id: string | number;
  /** 客户名称 */
  customerName: string;
}

export interface CustomerForm extends BaseEntity {
  id?: string | number;
  customerName?: string;
  status?: string;
}

export interface CustomerQuery extends PageQuery {
  customerName?: string;
  status?: string;
  /** 日期范围参数 */
  params?: any;
}
```

### 3.3 React（Ant Design Pro）— `api/biz/customer/index.ts`

```ts
import type { PageResult, R } from '@/api/types';
import request from '@/api/request';
import type { CustomerForm, CustomerQuery, CustomerVO } from './types';

/** 查询客户档案列表 */
export function listCustomer(query?: CustomerQuery) {
  return request<R<PageResult<CustomerVO>>>({ url: '/biz/customer/list', method: 'get', params: query });
}

/** 查询客户档案详细 */
export function getCustomer(id: string | number) {
  return request<R<CustomerVO>>({ url: '/biz/customer/' + id, method: 'get' });
}

/** 新增客户档案 */
export function addCustomer(data: CustomerForm) {
  return request<R>({ url: '/biz/customer', method: 'post', data });
}

/** 修改客户档案 */
export function updateCustomer(data: CustomerForm) {
  return request<R>({ url: '/biz/customer', method: 'put', data });
}

/** 删除客户档案 */
export function delCustomer(id: string | number | Array<string | number>) {
  return request<R>({ url: '/biz/customer/' + id, method: 'delete' });
}
```

> React 与 Vue 的差异：Vue 用 `request` from `@/utils/request` + `AxiosPromise<...>` 返回类型；
> React 用 `request` from `@/api/request` + 泛型 `request<R<...>>(...)`。两栈的 **路由段与命名完全一致**
> （`listXxx`→`GET /list`、`getXxx`→`GET /{id}`、`addXxx`→`POST`、`updateXxx`→`PUT`、`delXxx`→`DELETE /{ids}`），
> 都对齐同一套后端约定。React 的 types.ts 中 `Query.params` 类型为 `Record<string, unknown>`，Vue 为 `any`。

### 类型文件通用规则

- 定义 `VO` / `Form` / `Query` 三个接口；`Form extends BaseEntity`；非树表 `Query extends PageQuery`。
- 各类 ID 字段用 `string | number`（防雪花 ID 精度丢失）；Java 数值→`number`，Boolean→`boolean`，其余默认 `string`。
- 存在日期范围查询时保留 `params`（Vue：`params?: any`；React：`params?: Record<string, unknown>`）。

---

## 四、常见错误对比（重点纠正「误当衍生版」）

### 错误 1：把它当成带 DAO 层的版本，在 DAO 里 buildQueryWrapper

```java
// ❌ 错误：本项目没有 DAO 层，更没有 IXxxDao
public interface ICustomerDao { LambdaQueryWrapper<Customer> buildQueryWrapper(CustomerBo bo); }

// ✅ 正确：三层无 DAO，查询条件就在 ServiceImpl 的私有 buildQueryWrapper(bo) 里构建，
//         数据访问直接走 mapper（extends BaseMapperPlus）
private LambdaQueryWrapper<Customer> buildQueryWrapper(CustomerBo bo) {
    return QueryBuilder.lambda(Customer.class)
        .likeIfText(Customer::getCustomerName, bo.getCustomerName())
        .build();
}
```

### 错误 2：包名 / 基类用了衍生版约定

```java
// ❌ 错误
package plus.ruoyi.biz.domain;          // 或 com.ruoyi.*
public class Customer extends TenantEntity { ... }   // 衍生版多租户基类

// ✅ 正确（原版）
package org.dromara.biz.domain;
public class Customer extends BaseEntity { ... }      // org.dromara.common.mybatis.core.domain.BaseEntity
```

### 错误 3：Service 继承 ServiceImpl / 用错查询 API

```java
// ❌ 错误：继承 MyBatis-Plus 的 ServiceImpl，或用衍生版自造 API
public class CustomerServiceImpl extends ServiceImpl<CustomerMapper, Customer> implements ICustomerService { ... }
PlusLambdaQuery.create(Customer.class).likeCast(...);   // 衍生版 API，原版没有

// ✅ 正确：implements 接口、不继承基类；用 QueryBuilder + IfText/IfPresent 条件辅助
@RequiredArgsConstructor
@Service
public class CustomerServiceImpl implements ICustomerService {
    private final CustomerMapper customerMapper;
    // ... QueryBuilder.lambda(Customer.class).likeIfText(...).build()
}
```

### 错误 4：BO→Entity 手写拷贝 / 逻辑删除字段写错

```java
// ❌ 错误
Customer add = new Customer();
BeanUtils.copyProperties(bo, add);     // 不走 MapStruct-Plus
@TableLogic private Long isDeleted;    // 字段名错（衍生版才叫 is_deleted）

// ✅ 正确
Customer add = MapstructUtils.convert(bo, Customer.class);
@TableLogic private Long delFlag;      // 原版逻辑删除列固定 del_flag
```

### 错误 5：前端路由 / 模板引擎认知错误

```text
❌ 误以为前端模板是 Velocity（.vm）、路由风格 /pageCustomers、用 @/wd 移动端组件
✅ 前端模板是 FreeMarker（.ftl），路由 /biz/customer/list，
   Vue=Element Plus（fm/vue），React=Ant Design Pro（fm/react），与后端 ${module}/${business} 对齐
```

---

## 五、最佳实践

1. **先对齐生成器默认六方法，再叠加增强**：`queryById/queryPageList/queryList/insertByBo/updateByBo/deleteWithValidByIds`
   是骨架；唯一校验、数据权限、状态/排序更新、Excel 导入导出、关联表维护是按需叠加项。
2. **取样优先级**：先看同模块最近似实现 → 再看 `ruoyi-common-mybatis` 统一约定 → 再看 generator 模板 →
   最后才回退通用习惯。规则冲突时**优先相信当前仓库真实代码**。
3. **不要把 `ruoyi-system` 这类复杂逻辑（数据权限 + MPJ + 角色岗位关系）强行简化成单表 CRUD**；
   反之新建简单单表也不要硬塞用不到的 MPJ。
4. **链式查询不要退回手写 SQL**：能用 `QueryBuilder.lambda` / `QueryBuilder.lambdaJoin` / `BaseMapperPlus#lambda()`
   表达的就别补 XML；条件辅助方法名固定（`eqIfText/likeIfText/eqIfPresent/inIfNotEmpty/betweenParams`），不要自造。
5. **前后端联动**：后端路由、权限前缀按 generator 约定（`${module}:${business}:${action}`），前端 API 函数名
   与路由段不要偏离；新增日期范围时后端保留 `bo.params`、前端保留 `Query.params`，否则 `addDateRange` 对不上。
6. **跨模块调用走 `ruoyi-api`**：不直接 import 另一个业务模块的实现类，6.x 用 `ruoyi-api` 暴露契约接口解耦。
7. **JavaDoc 简洁**：公共 API / 接口 / VO-BO-Entity 字段 / Service-Controller 方法配简短注释，说「做什么」+ 关键参数语义；
   `void` 不写 `@return`，框架覆写回调可不重复注释；只改注释时不重排 import、不格式化全文件。
8. **编码**：所有文件 UTF-8（无 BOM）、LF；Java 4 空格缩进。

---

## 六、交付前自检清单

- [ ] 包名为 `org.dromara.*`，**没有** `plus.ruoyi` / `com.ruoyi`。
- [ ] 三层无 DAO：Controller → Service（`IXxxService` + `XxxServiceImpl`，**不继承 ServiceImpl**）→ Mapper（`extends BaseMapperPlus<Entity, Vo>`）。
- [ ] 查询条件在 ServiceImpl 的私有 `buildQueryWrapper(bo)` 中，用 `QueryBuilder.lambda(Entity.class)` + `IfText/IfPresent` 系列构建。
- [ ] Entity `extends BaseEntity`；`@TableId` 雪花；逻辑删除列为 **`del_flag`** + `@TableLogic`；有乐观锁列保留 `@Version`。
- [ ] BO `@AutoMapper(target=Entity.class, reverseConvertGenerate=false)` + `implements Serializable`；VO `@AutoMapper(target=Entity.class)` + `@ExcelIgnoreUnannotated`。
- [ ] BO→Entity 全部走 `MapstructUtils.convert(bo, Entity.class)`，没有 `BeanUtils.copyProperties`。
- [ ] 分页：`mapper.selectVoPage(pageQuery.build(), lqw)` → `PageResult.build(records, total)`；用 `PageQuery` / `PageResult`。
- [ ] Controller `extends BaseController`，返回 `R<T>`；REST 五件套 `GET /list`、`POST /export`、`GET /{id}`、`POST`、`PUT`、`DELETE /{ids}` 齐全。
- [ ] 权限 `@SaCheckPermission("${module}:${business}:${action}")`；写操作有 `@Log` + `@RepeatSubmit`；新增/修改用 `@Validated(AddGroup/EditGroup.class)`。
- [ ] 显式业务失败用 `ServiceException`；多表写操作加 `@Transactional(rollbackFor = Exception.class)`。
- [ ] 前端 api.ts / types.ts 路由与命名对齐后端（`listXxx/getXxx/addXxx/updateXxx/delXxx`）；Vue=Element Plus、React=Ant Design Pro，模板引擎为 FreeMarker。
- [ ] 有日期范围查询时，后端 `bo.params` 与前端 `Query.params` 都保留。
- [ ] 不是 generator 裸产物——已按同模块习惯补齐唯一校验 / 数据权限 / 缓存 / 导入导出等增强（如该模块需要）。
