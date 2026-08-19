# 品牌 Excel 导入深链迁移（Go → Java）

> 任务：把 `ImportExportServiceImpl.importBrands` 从「仅 name/type 落库」改为「按 brandType 深链落库」，
> 对齐 Go `resource_import.go` 的 `DoImportBrandsTyped` + `store/alliance_brand_import.go`。
> 分支 feat/agent-align-remaining，工作区含他人并发未提交改动（已避让）。

## 改动文件

- `service/impl/importexport/ImportExportServiceImpl.java`：重写 `importBrands` 为 dispatch + 通用路径 + 6 类型深链路径；新增解析/落库/JSON/字典辅助方法与 3 个内部数据类。
- `mapper/importexport/ImportExportMapper.java`：修正 `selectEnterpriseIdByName` 表名（alliance_enterprises → partner_enterprises，对齐迁移 142），新增 7 个品牌深链查询。
- `mapper/alliance/AllianceBrandMapper.java`：新增 `selectBrandByName(tenantId, brandType, name)`。
- `mapper/job/JobPositionImportMapper.java`：新增 `insertPositionResponsibilityFull`（职责名 + 描述 + 排序）。

## 实现要点（对齐 Go）

1. `importBrands` 增加 `userId` 参数，dispatch 传入 `overwrite/rename`。
2. 6 种 brandType 深链（列名/列位对齐 Java brandTemplate）：
   - **talent**：关联学生名称 → `selectUserIdByNameWithRole(name,'student')`；关联专业名称 → `major_id`。
   - **employer**：「合作企业」→ partner_enterprises 查 `enterprise_id`；「独立雇主」→ `buildEnterpriseInfo` 组装 `{"enterpriseInfo":...}` 存 data(jsonb)。
   - **job**：「教学岗位」→ career_positions(position_type='teaching') 查 position_id；「企业岗位」→ `insertImportPosition` 建草稿岗位（enterprise 类型，薪资/行业/简介/任职要求/职业发展路径/面向专业/职责）回填 position_id，复用 `generatePositionCode`；职责每条「名|描述」换行分隔。
   - **major**：按名称查 major_id；就业方向/合作企业/成果/特色课程按名称匹配 ID 组装进 data（能查到才加）。
   - **teacher**：「校本师资」→ `selectUserIdByNameWithRole(name,'teacher')` + `selectByUserId→insertExpert/updateExpert` 查/建专家，回填 teacher_id/expert_id，data=`{"teacherExpertId":...}`；「企业专家」→ `selectExpertIdByName`。
   - **culture**：name + 描述 + 关联专业 major_id + data。
3. 查重 `selectBrandByName`：命中 overwrite→update（回填深链字段）、rename→`uniqueSuffixed` 新名、否则 skip；preview 只统计不落库（企业岗位/校本师资档案仅执行阶段落库）。
4. 品牌主表写改用 `AllianceBrand` 实体 `insertBrand/updateBrand`（含 student/enterprise/position/major/teacher/expert/data 字段）。

## 编译结果

`cd backend/java && ./mvnw -o -q -pl ruoyi-modules/ruoyi-zhiyu -am compile` → **exit 0**（通过）。
（中途曾因他人并发修改 `JobApprovalServiceImpl.java` 短暂编译失败，其完成后复跑通过；本任务未触碰该文件。）

## 已知简化点 / 与 Go 的差异

1. **状态覆盖语义**：Go `updateBrandFromImport` 里 `if rw.status != ""` 恒真（status 默认 "draft"），覆盖导入空状态单元格会静默把已发布品牌打回草稿；Java 按注释意图仅 `statusFilled` 时覆盖，空单元格保留原值（防静默下架）。
2. **企业岗位草稿 name**：Go `parseJobBrandRow` 未给 `ImportEnterprisePositionParams.Name` 赋值（疑似缺陷，会以空名建岗位）；Java 以「岗位名称」（品牌 name）作为岗位名。
3. **企业岗位覆盖复用已有岗位**：Java 用 `updatePositionImportFields` 更新内容（该 SQL 会把 batch_id 置空）+ 先清后插 majors/职责/能力绑定/能力域；Go 用 `SaveFull`。职责/能力点重关联完整性略逊于 SaveFull。
4. **校本师资 expert_type**：Go upsert 不写 expert_type（null）；Java 设 "teacher"（对齐本仓库 `createExpert` 约定）。
5. **通用模板（brandType 为空）路径保持浅落库**（仅 name/type/描述/草稿），未对齐 Go `DoImportBrandsGeneric` 的关联 ID 查寻（向后兼容，非本次 6 类型范围）。
6. **字典映射**：企业类型/岗位类型/师资类型按 Go 原样对齐（中文别名 + 英文原值）；发布状态复用现有 `mapPublishStatus`（草稿/已发布/已归档）。
7. **多值列拆分** `splitMulti` 对齐 Go（;；,， 四分隔符）。
8. `parseBoolDefault` 复用现有实现（是/否/1/0/true/false），与 Go 的「启用/禁用/关闭」词条略有差异（品牌列用「是否公开/是否推荐」是/否，不受影响）。
9. 旧 `ImportExportMapper.insertAllianceBrand` 现为死代码（保留未删，避免扩大 diff）。
