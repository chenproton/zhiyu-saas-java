# /dev - 开发新功能（全栈）

为 base-dev-framework6-java开发一个完整功能。按下面流程走，**先激活相关技能再动手**。

## 输入

用户描述要开发的功能，例如："开发一个公告管理模块，需要分页、导出、按标题和时间范围查询"。

## 执行流程

1. **理清需求**：模块名、业务名、表名/字段、是否要分页/导出/数据权限/字典/翻译/联表；参考哪个现有模块。信息不足先问，别瞎猜。
2. **激活技能**（按需逐个 Skill 调用）：
   - 设计不清晰 → `brainstorm`
   - 多步骤/跨会话 → `task-tracker` + `writing-plans`
   - 建表/字典 → `database-ops`
   - 后端全栈 → `crud-development`
   - 接口规范 → `api-development`
3. **后端实现**（框架约定铁律）：
   - 包 `org.dromara.{module}`；三层无 DAO：Controller → Service(`IXxxService`+impl，不继承 ServiceImpl) → Mapper(`BaseMapperPlus<Entity,Vo>`)
   - Entity `extends BaseEntity`；BO/VO 用 `@AutoMapper`；转换 `MapstructUtils.convert`
   - 查询在 Service：`QueryBuilder.lambda(Entity.class)` + `eqIfText/likeIfText/betweenParams`
   - 分页 `selectVoPage(pageQuery.build(), lqw)` → `PageResult.build(...)`
   - Controller `extends BaseController`，返回 `R<T>`，标准 REST（`/list`、`/{id}`、`POST`、`PUT`、`DELETE /{ids}`、`POST /export`）
   - 写接口带 `@SaCheckPermission("${module}:${business}:${action}")` + `@Log` + 必要的 `@RepeatSubmit`
   - 默认方法集合：`queryById/queryPageList/queryList/insertByBo/updateByBo/deleteWithValidByIds`，再叠加唯一校验/数据权限/缓存/导入导出
4. **前端骨架**（代码生成器）：按 `frontend_type` 选 `fm/vue`(Element Plus) 或 `fm/react`(Ant Design Pro)，产出 api.ts/types/index 页面，命名 `listXxx/getXxx/addXxx/updateXxx/delXxx` 与后端路由一致，前端骨架放入仓库内 plus-ui/ 对应目录（src/api、src/views）。
5. **验证**：`mvn -pl ruoyi-modules/ruoyi-{module} -am -DskipTests compile`（Java 21）。

## 禁止

`plus.ruoyi`/`com.ruoyi`、DAO 层、`PlusLambdaQuery`/`likeCast`、`TenantEntity`(当默认)、`is_deleted`、`/pageXxxs` 路径、Controller 暴露 Entity、漏权限注解。详见 `code-patterns` 技能。
