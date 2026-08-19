# affairs + system + auth 对比差距报告

> Go（Source of Truth）: `backend/go/internal/{handler,service,store,router,domain}`
> Java（复制版）: `backend/java/ruoyi-modules/ruoyi-zhiyu/src/main/java/org/dromara/zhiyu/{controller,service,service/impl,mapper,domain}`
> 对齐口径：Go handler+router 暴露的端点 = Java controller 端点；Go store 文件 = Java mapper + domain 实体；Go service 方法 = Java service/impl 方法。
> 覆盖域：affairs（batch/term/scheduling/teaching_plan/training_program）、org/org_type/major/industry、role、user_management/user_relation/user_extension_field/staff_title、tenant/tenant_admin、settings/subscription、auth、log、resource_code、template、import_export。

---

## 1. 接口/路由差距

**结论：端点面已基本对齐（Go `/api/v1` 前缀在 router 层统一挂载，Java 各 controller 直接写死 `/api/v1` 前缀，两者一致）。逐条核对 Go `routes.go`（RegisterPublicRoutes/RegisterAuthenticatedRoutes/registerPortalRoutes/registerSuperAdminRoutes/registerImportExportRoutes）、`routes_affairs.go`（terms/programs/batches/workflows/teaching-plans/venues/period-slots/schedules/导入导出）以及 `registerContentRoutes`（13 条内容 CRUD+状态端点）、`registerBatchRoutes`（6 条）展开后的全部端点，Go 侧每个方法+路径在 Java controller 均有对应。**

### Java 缺失（Go 有、Java 无）

**无功能性缺失端点。** 逐域核对结果：

- **auth**：`/auth/captcha`、`/auth/login`、`/auth/saas/login`、`/auth/portal/login`、`/auth/partner/login`、`/auth/partner/register`、`/auth/select-tenant`、`/auth/me`、`/auth/saas/me`、`/auth/portal/me`、`/auth/partner/me` → 全部在 `ZhiyuAuthController` 对齐。
- **tenant / tenant_admin（含超管）**：`/tenants`、`/tenants/{id}`、`/admins`、`/admins/{id}`、`/admins/{id}/reset-password`、`/admin/tenants*`（列表/创建/更新/状态/删除/enterprise）、`/admin/tenants/{tenantId}/admins*`（+enterprise-admins*）、`/admin/tenants/{tenantId}/subscription` → 全部对齐（`TenantController`/`TenantAdminController`/`SuperAdminController`）。Go `/admin/tenants/{tenantId}/ai/config` 三端点未落在 `SuperAdminController`，但已由 `controller/ai/AiTenantConfigController`（`/api/v1/admin/tenants`）承载，非缺失。
- **org/org_type/major/industry/role/resource_code/log**：读组（GET List/Get/Tree）+ systemAdmin 写组（POST/PUT/DELETE）+ `roles/{id}/assign` + `logs/login|operation` → 全部对齐。
- **user_management**：`/users` CRUD + `/status` + `/reset-password` + `/roles` + `/batch` + `/batch-graduate` + `/batch-delete` + `/batch-org-node` → 全部对齐 `UserController`。
- **user_relation / user_extension_field / staff_title / subscription / settings**：全部对齐。
- **affairs**：terms、programs（content 13 端点 + courses + clone）、batches（6 端点）、teaching-plans（content 13 端点 + entries + confirm + export）、venues、period-slots（+replace）、schedules（+auto-schedule/publish/timetable/export）、workflows → 全部对齐。
- **import_export / template**：Go 显式 `/import/{entity}/excel`、`/import/{entity}/preview`、`/export/{entity}/excel`、`/templates/{entity}` 与 Java 泛化 `{entity}` 路径**逐路径等价**；通用 CSV 5 实体（question_banks/exams/courses/career_positions/scenarios）、Excel 19 实体、模板 20 实体清单经比对**完全一致**（含 affairs 专属 `schedules`/`program-courses`/`affairs-config`）。

### Java 多出（Java 有、Go 无）

- `GET /api/v1/affairs/terms/{id}`（`AffairsTermController`；Go `routes_affairs.go` 的 terms 只有 List/Create/Update/Delete，无单条 Get）
- `GET /api/v1/affairs/venues/{id}`（`AffairsVenueController`；Go venues 无单条 Get）
- `GET /api/v1/affairs/period-slots/{id}`（`AffairsPeriodSlotController`；Go period-slots 无单条 Get）

> 三者均为「多余暴露的单查端点」（Go store 层有 Get 方法但 router 未暴露），功能无害，属一致性问题，见 §4 P2。

---

## 2. 文件/实体覆盖差距

### Java 缺失的 store 对应物

| Go store 文件 | 对应表/职责 | Java 现状 | 状态 |
|---|---|---|---|
| `store/terms.go` | `terms` 表 | 无 `domain/affairs/Term` + `mapper/affairs/TermMapper`；复用 `domain/portal/PortalTerm` + `mapper/portal/PortalTermMapper` | ⚠ 放错包（affairs 域实体落在 portal 包） |
| `store/scheduling.go`（venues） | `venues` 表 | 复用 `domain/portal/PortalVenue` + `mapper/portal/PortalVenueMapper` | ⚠ 放错包 |
| `store/scheduling.go`（period_slots） | `period_slots` 表 | 复用 `domain/portal/PortalPeriodSlot` + `mapper/portal/PortalPeriodSlotMapper` | ⚠ 放错包 |
| `store/scheduling.go`（schedule_entries） | `schedule_entries` 表 | `mapper/affairs/AffairsScheduleMapper` 存在，但实体复用 `domain/portal/PortalScheduleEntry` | ⚠ 实体放错包 |
| `store/batch_configs.go` | 5 类批次统一模板（非表） | 无统一抽象；Java 按模块拆分 `AffairsBatch`/`JobBatch`/`SceneBatch`/`PortalLessonBatch`/`EvaluationBatch` | ⚠ 组织不一致，功能存在 |
| `store/entity_code.go` | 实体编码生成工具（GW-XXXX） | 无独立对应，逻辑散落各 service | ⚠ 工具缺失 |
| `store/template_data.go` | 模板参考字典查询 | 由 `mapper/importexport/ImportExportMapper` 的 `listIndustries/listMajors/...` 承载 | ✅ 已覆盖 |

**其余全部对齐（功能存在）**：`teaching_plans.go`→`TeachingPlanMapper(+EntryMapper)`+`TeachingPlan(+Entry)`、`training_programs.go`→`TrainingProgramMapper(+CourseMapper)`+`TrainingProgram(+Course)`、`batches.go`→`AffairsBatchMapper`+`AffairsBatch`、`organizations.go`→`SystemOrganizationMapper`+`SystemOrganization`、`org_types.go`→`SystemOrgTypeMapper`+`SystemOrgType`、`majors.go`→`SystemMajorMapper`+`SystemMajor`、`industries.go`→`SystemIndustryMapper`+`SystemIndustry`、`roles.go`→`SystemRoleMapper`+`SystemRole`、`users.go`→`SystemUserMapper(+ZhiyuUserMapper)`+`ZhiyuUser`、`user_relations.go`→`SystemUserRelationMapper`+`SystemUserRelation`、`user_extension_fields.go`→`SystemUserExtensionFieldMapper`+`SystemUserExtensionField`、`staff_titles.go`→`SystemStaffTitleMapper`+`SystemStaffTitle`、`tenants.go`→`SystemTenantMapper`+`ZhiyuTenant`、`tenant_admins.go`→`SystemTenantAdminMapper`、`platform_settings_store.go`→`SystemSettingsMapper`、`subscriptions.go`→`SystemSubscriptionMapper`+`SystemSubscriptionPackage`、`logs.go`→`SystemLoginLogMapper`+`SystemOperationLogMapper`+`SystemLoginLog`+`SystemOperationLog`、`resource_codes.go`→`SystemResourceCodeMapper`+`SystemResourceCode`。

---

## 3. 字段/方法级差距（抽查）

### 字段对齐（良好）

抽查关键实体，Go domain 结构 vs Java Entity 字段：

1. **User / ZhiyuUser**：字段完全对齐（`tenantId/institutionId/orgNodeId/majorId/role/platform/loginName/username/passwordHash/name/email/phone/avatarUrl/studentNo/workId/idCard/titleIds(uuid[])/oauth(jsonb)/status/graduateYear/lastLoginAt` + 关联 `roleIds/roleCodes/roleNames`）；Java 额外 `passwordChangedAt`（会话失效判定，Go 行为存在但未在 domain 列明），非缺口。
2. **Tenant / ZhiyuTenant**：字段完全对齐（含 `scaleData`/`secondaryColleges` jsonb、`adminIds` uuid[]、`validFrom/validUntil`）。
3. **SubscriptionPackage / SystemSubscriptionPackage**：对齐（`modules` jsonb、`aiTokenQuota`）。
4. **Role / SystemRole**：对齐（`permissions` jsonb、`userCount`）。
5. **affairs 5 实体**：`TrainingProgram`/`TeachingPlan`/`TeachingPlanEntry`/`TrainingProgramCourse`/`AffairsBatch` 字段与 Go `domain/affairs.go`/`affairs_batch.go` 对齐；`TrainingProgramCourse` 额外 `theoryHours/practiceHours`（Go domain 未列，表列可能已有，非缺口）。

### 方法级（确认两处空实现）

1. **教务 Excel 导入（3 类）= 空实现**：`ImportExportServiceImpl.importExcel` 对 `schedules`/`program-courses` 分支调 `parseCount()`，对 `affairs-config` 分支调 `affairsConfigImport()`——两者均只读 Sheet、逐行计数、返回「成功 N 条」，**不写库**（`parseCount` 见源码 1152 行，`affairsConfigImport` 见 1176 行）。Go 对应为完整持久化：`service/schedule_import.go`（排课落库）、`service/program_course_import.go`（方案课程落库）、`service/affairs_config_import.go`（学期/场地/节次落库）。**Java 静默丢数据。**
2. **资源导入（5 类）= 真实落库（已对齐）**：`industries/majors/organizations/students/teachers` 走 `importIndustries/importMajors/importOrganizations/importUsers` 真实写库（含 bcrypt 加密、组织父级解析）。差异点：`importOrganizations` 未实现 Go 的 `rename` 去重策略（仅 overwrite/skip）。

### 业务逻辑（已实现，无缺失）

`SchedulingServiceImpl`（1137 行）完整实现排课发布（advisory 事务锁 + 版本 stamp + `publishFromDraft` 快照固化）、冲突检测（409）、自动排课、课表导出；`SystemSuperAdminServiceImpl`（538 行）完整实现超管全部租户/管理员/订阅端点；`SystemUserServiceImpl`（453 行）实现批量建号/毕业/删除/调班；`TeachingPlanServiceImpl`/`TrainingProgramServiceImpl`/`AffairsBatchServiceImpl` 均为真实实现（非 stub）。

---

## 4. 建议迁移项（按优先级）

### P0（阻断：接口存在但静默丢数据）

1. **教务 Excel 导入落库**：Go 依据 `backend/go/internal/service/schedule_import.go`、`program_course_import.go`、`affairs_config_import.go`。Java 需把 `ImportExportServiceImpl.importExcel` 的 `schedules`/`program-courses` 分支从 `parseCount` 改为真实导入（排课/方案课程落库），把 `affairs-config` 分支从「计数」改为真实写 terms/venues/period_slots 三 Sheet。当前行为是**前端收到成功但数据未落库**，属阻断级。

### P1（重要：跨域/包结构不一致）

2. **affairs 域实体归位**：将 `PortalTerm/PortalVenue/PortalPeriodSlot/PortalScheduleEntry`（现位于 `domain/portal`）迁为 `domain/affairs` 下对应实体 + `mapper/affairs` 下对应 Mapper（Term/Venue/PeriodSlot/ScheduleEntry），使 `AffairsTermController/AffairsScheduleController/AffairsVenueController/AffairsPeriodSlotController` 的 controller/service/entity/mapper 全部落在 affairs 域，消除「controller 在 affairs、entity/mapper 在 portal」的跨域耦合。Go 依据 `store/terms.go` + `store/scheduling.go`。
3. **组织导入 rename 策略对齐**：Go `resource_import.go` 支持 overwrite/rename 两策略；Java `importOrganizations` 未实现 rename（重复时仅 overwrite/skip）。补 rename 分支。

### P2（次要：一致性与工具）

4. **多出端点收敛**：`GET /affairs/terms/{id}`、`/affairs/venues/{id}`、`/affairs/period-slots/{id}` 为 Java 多出（Go 未暴露）。确认是前端已用（保留并在 Go 侧补齐）还是删除对齐。
5. **批次统一抽象**：Go `store/batch_configs.go` 以 `BatchTableConfig` 统一 5 类批次；Java 拆为 5 个独立实体。评估是否抽取统一 Batch 基类/服务，或记录「按模块拆分」为既定设计。
6. **实体编码工具**：Go `store/entity_code.go`（GW-XXXX 编码生成 + 表白名单）在 Java 无集中实现，散落各 service；建议抽 `EntityCodeGenerator` 统一。

---

*本报告由代码对比审计子代理生成；端点/字段覆盖为静态对比结论，教务导入空实现已读源码确认（`parseCount`/`affairsConfigImport` 仅计数不落库）。*
