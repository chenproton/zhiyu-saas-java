---
name: crud
description: |
  /crud - 快速 CRUD（基于已有表）

  触发词：/crud、快速CRUD、代码生成、基于表生成、增删改查
---

# /crud - 快速 CRUD（基于已有表）

基于已存在的数据库表，快速生成一套标准 CRUD（base-dev-framework6-java）。

## 输入

表名（或表结构），目标模块，前端栈（vue / react）。

## 执行流程

1. **激活** `crud-development`（必）+ 按需 `database-ops`。
2. **读表结构**：确认主键（雪花 BIGINT）、`del_flag`(@TableLogic)、审计字段、`tenant_id`（多租户表）、是否树表。
3. **优先用代码生成器约定**（`ruoyi-modules/ruoyi-gen`，FreeMarker `fm/`）：
   - 后端七件套：`domain/Entity`、`domain/bo/EntityBo`、`domain/vo/EntityVo`、`mapper/EntityMapper`、`service/IEntityService`、`service/impl/EntityServiceImpl`、`controller/EntityController`
   - 模板对应：`fm/java/{domain,bo,vo,mapper,service,serviceImpl,controller}.java.ftl`
   - 前端：`fm/<frontend_type>/{api.ts,types.ts,index.*}.ftl`（vue=Element Plus / react=Ant Design Pro）
4. **生成后叠加现有模块增强**：唯一性校验（`validEntityBeforeSave`）、数据权限（`@DataPermission`+`@DataColumn`）、MPJ 联表、缓存注解、Excel 导入导出。
5. **裸生成器产物不是终点**：复杂模块（如 system）要对齐其已有的数据权限/联表/校验，不要削平成单表 CRUD。

## 关键约定

- 包 `org.dromara`，三层无 DAO，`BaseMapperPlus<Entity,Vo>`，`QueryBuilder.lambda`，`MapstructUtils.convert`，`R<T>` + 标准 REST。
- 树表：list 不分页返回 `R<List<Vo>>`。
- 模板语法是 **FreeMarker**（`<#if>`/`<#list>`/`${}`），不是 Velocity。

详见 `crud-development` 技能。
