---
name: check
description: |
  /check - 代码规范检查（框架）

  触发词：/check、代码检查、规范检查、code review、检查代码
---

# /check - 代码规范检查（框架约定）

对当前改动或指定文件做 base-dev-framework6-java规范检查。先激活 `code-patterns`。

## 检查清单（后端）

- [ ] 包名 `org.dromara.*`（无 `plus.ruoyi`/`com.ruoyi`）
- [ ] 三层无 DAO：Controller → Service(接口+impl，**不继承 ServiceImpl**) → Mapper(`BaseMapperPlus<Entity,Vo>`)；无 `buildQueryWrapper`/`IXxxDao`/`PlusLambdaQuery`
- [ ] Entity `extends BaseEntity`（多租户表加 `tenant_id`，非默认 `TenantEntity`）
- [ ] 查询在 Service：`QueryBuilder.lambda` + `eqIfText/likeIfText/eqIfPresent/inIfNotEmpty/betweenParams`（无 `likeCast`）
- [ ] 逻辑删除 `del_flag`(@TableLogic)（非 `is_deleted`）；雪花 ID（非 AUTO_INCREMENT）
- [ ] 对象转换 `MapstructUtils.convert` + `@AutoMapper`（非 `BeanUtil.copyProperties`/`@AutoMappers`）
- [ ] 分页 `selectVoPage`+`PageResult.build`；返回 `R<T>`/`PageResult<Vo>`
- [ ] API 标准 REST：`/list`、`/{id}`、`POST`、`PUT`、`DELETE /{ids}`、`POST /export`（无 `/pageXxxs`）
- [ ] 写接口带 `@SaCheckPermission("${m}:${b}:${a}")` + `@Log`；防重 `@RepeatSubmit`
- [ ] Controller 不暴露 Entity（BO 入参、VO 出参）
- [ ] 跨模块走 `ruoyi-api` 契约，不直接 import 另一业务模块实现
- [ ] 接口文档用 JavaDoc（SpringDoc + therapi），不堆 `@Schema`

## 检查清单（前端 / 代码生成器产物）

- [ ] Vue 用 Element Plus `el-*` + 新版 hooks（useLoading/useFormDialog/useDateRangeQuery）；React 用 Ant Design Pro
- [ ] API 命名 `listXxx/getXxx/addXxx/updateXxx/delXxx` 与后端路由一致；保留日期范围 `params`

## 通用

- [ ] UTF-8 无 BOM、LF；Java 4 空格 / JSON·YAML 2 空格
- [ ] Bash 无 `> nul`（用 `> /dev/null 2>&1`）

发现违规 → 指出文件:行 + 正确写法（参考 `code-patterns`）。
