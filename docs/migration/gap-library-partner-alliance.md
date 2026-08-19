# library / partner / alliance 对比差距报告

> 对比基准：Go（backend/go，线上运行，Source of Truth） vs Java（backend/java/ruoyi-modules/ruoyi-zhiyu，org.dromara 三层架构复制版）。
> 域范围：library（resource/tag/on_site_question/citation）、partner（partner/cobuild/employment）、alliance（brand/enterprise/project/agreement/achievement/expert/permission/dictionary/employment/mentor/talent_rank）。
> 结论概述：接口面（HTTP 端点）三个域几乎完全对齐、无缺失端点；差异集中在「品牌 Excel 导入深度」与「共建审批通过后合并回源资源」两处业务逻辑，以及少量鉴权/权限注解的框架性差异。

## 1. 接口/路由差距

对齐方式：Go 侧前缀在 router 层（/api/v1，见 backend/go/internal/router/router.go 的 RegisterAPIRoutes）；Java 侧前缀在 Controller 的 @RequestMapping("/api/v1/...")。

### Java 缺失（Go 有、Java 无）

无缺失端点。三个域的所有 Go 路由（含管理面、公开面、partner 企业面、跨模块只读引用面）均能在 Java controller 找到对应。

需要特别说明的「间接覆盖」（表面看像缺失，实为通用机制覆盖）：

- Go 的联盟导入/模板专用路由（routes.go:436-462）：POST /import/alliance-{projects,achievements,agreements,permissions,brands}/excel、/preview、GET /templates/alliance-*，在 Java 用通用 ImportExportController（/api/v1/import/{entity}/excel、/import/{entity}/preview、/templates/{entity}，entity 含 alliance-projects/achievements/agreements/permissions/brands，见 ImportExportServiceImpl 第 61-69、138-142、637-641 行）。路径形态不同但语义覆盖。
- Go 的 GET /alliance/dictionaries/{dictType} 注册在「跨模块只读引用组」（routes.go:187，任意登录用户可读）；Java 将其放在管理面 AllianceController（@GetMapping("/dictionaries/{dictType}")），见 §3 鉴权差异。
- Go 的 GET /auth/partner/me、POST /auth/partner/login、POST /auth/partner/register（routes_partner.go:31 + routes.go:55-56）属 auth 域，不在本次三域范围；Java 对应在 ZhiyuAuthController（未在本域范围逐一核对）。

### Java 多出（Java 有、Go 无）

无实质多出端点。抽查的 LibraryResource/LibraryTag/LibraryOnSiteQuestion、Partner/PartnerCoBuild/PartnerEmployment、Alliance/AlliancePublic/AllianceEmployment/AlliancePublicEmployment 等 10 个 Controller 的方法逐一映射到 Go handler，无 Go 未暴露的额外业务端点。唯一「多出」是 Java 通用 /import/{entity}、/templates/{entity} 的 entity 取值比 Go 三个域的专用路由更广（覆盖其它域，属框架通用化，非本域多出）。

## 2. 文件/实体覆盖差距

### Java 缺失的 store 对应物

| Go store 文件 | 应有 Java mapper/domain | 现状 |
|---|---|---|
| store/alliance_brand_import.go（ImportSaveEnterprisePosition / UpsertTeacherExpertProfile / Lookup* 系列） | 应在 ImportExportServiceImpl.importBrands 内实现岗位/专家/企业深链 + 查重 | 部分缺失：Java importBrands 仅插入 name/type/description，studentId/enterpriseId/positionId/majorId/teacherId/expertId 全传 null，无 job→建岗位、teacher→写专家、employer→链企业、查重/覆盖/改名（详见 §3、§4） |
| store/alliance_source_edit_store.go 的 MergePositionDraftToSource / MergeScenarioDraftToSource | 应在审批通过回调中调用（对齐 service/approval.go:64） | 缺失：Java 有 draft 拷贝（PartnerPositionMapper.selectDraftIdBySource + copyPositionChildren），但无「审批通过→合并回源资源」步骤（详见 §3、§4） |

其余 store 文件均有 Java mapper + domain 对应，映射如下（已逐个核对）：

library：
- resource_library.go → LibraryResourceMapper + domain/LibraryResource ✅
- tags.go → LibraryTagMapper + LibraryResourceTagRelationMapper + domain/LibraryTag、LibraryResourceTagRelation ✅
- on_site_question_library.go → LibraryOnSiteQuestionMapper + domain/LibraryOnSiteQuestion ✅
- citation_stats.go（仅 struct + scan 辅助，SQL 在 resource_library.go:134 CitationStats）→ Java 内联在 LibraryResourceMapper.citationBuckets（156-171 行），分桶 SQL 与 Go 一致 ✅
- resource_codes.go → SystemResourceCodeMapper（Java 归 system 域，跨域已覆盖）✅
- resource_bindings.go（跨模块 course/node/task 资源绑定）→ 由 lesson/scene 域 binding mapper 覆盖（跨域）✅
- resource_import_export.go → Go 本身也无独立 excel 导入端点（仅 POST /library/resources/import/preview），Java 对齐 ✅

partner：
- partner_store.go（主体/专家/合作内容/工作台/测评任务/共建人）→ 拆分为 PartnerEnterpriseMapper + PartnerExpertMapper + PartnerCooperationMapper + PartnerSchoolSourceMapper + PartnerApprovalMapper ✅
- partner_cooperation_detail_test.go（测试）→ 不涉及

alliance：
- alliance_store.go → AllianceSchoolInfoMapper + AllianceProjectMilestoneMapper + AlliancePermissionMapper + AllianceDictionaryMapper ✅
- alliance_brand_store.go → AllianceBrandMapper（含雇主/岗位/公开品牌 JOIN 视图）✅
- alliance_enterprise_store.go → AllianceEnterpriseMapper + AllianceStatsMapper（GetPublicStats 拆出）✅
- alliance_project_store.go → AllianceProjectMapper + AllianceProjectMilestoneMapper ✅
- alliance_agreement_store.go → AllianceAgreementMapper ✅
- alliance_achievement_store.go → AllianceAchievementMapper ✅
- alliance_expert_store.go → AllianceExpertMapper ✅
- alliance_permission_store.go → AlliancePermissionMapper ✅
- alliance_dictionary_store.go → AllianceDictionaryMapper ✅
- alliance_employment_store.go → EmploymentProjectMapper + EmploymentJobMapper + EmploymentApplicationMapper ✅
- alliance_talent_rank_store.go → BrandMajorRankConfigMapper（listConfigs/saveConfig/listRankStudents/listRankPositions 完整）✅
- alliance_grant_store.go → AllianceResourceGrantMapper（学校侧）+ PartnerResourceGrantMapper（企业侧，selectGrantTenantId 用于共建编辑授权校验）✅
- alliance_enterprise_link_store.go → AllianceEnterpriseLinkMapper + PartnerEnterpriseLinkMapper ✅

## 3. 字段/方法级差距（抽查）

抽查 AllianceBrand、AllianceExpert、EmploymentJob 三个 Java domain 实体，字段与 Go domain struct（domain/alliance.go、domain/alliance_employment.go）一一对应（jsonb 字段以 String 存储、@TableField(exist=false) 标注 JOIN/聚合字段），无明显字段缺失。

发现两处方法级（业务逻辑）差距：

1. 【P0/P1】共建审批通过后不合并回源资源（MergeSourceEditDraft 缺失）
   - Go 依据：service/approval.go:64（ReviewStep 在 newStatus == approved 时调用 txStore.MergeSourceEditDraft）；store/store.go:618-664（MergeSourceEditDraft）；store/alliance_source_edit_store.go:61/154（MergePositionDraftToSource / MergeScenarioDraftToSource，用 draft 覆盖原资源并删除 draft）。
   - Java 现状：PartnerCoBuildServiceImpl 已实现 draft 拷贝（editSourcePosition→copyPositionChildren、editSourceScenario→copyScenarioChildren，source_resource_id 列已维护），submitPosition/submitScenario 也会 approvalMapper.insertPendingApproval 发起审批；但 JobApprovalServiceImpl 的审批通过分支只做状态机推进（approved/pending/rejected，见其 146/184/266-286 行），全库 grep 无 MergeSourceEditDraft 等价实现。后果：企业共建的岗位/场景编辑审批通过后源资源不会被更新、draft 也不删除/回收，编辑内容丢失。
2. 【P1】品牌 Excel 导入为浅实现（缺按类型的深链处理）
   - Go 依据：service/resource_import.go:1339 DoImportBrandsTyped（按 talent/employer/job/major/teacher/culture 分型解析）；store/alliance_brand_import.go（ImportSaveEnterprisePosition：job 品牌→建岗位+SaveFull；UpsertTeacherExpertProfile：teacher 品牌→按 user_id 查/建专家；GetBrandByName / LookupJobBrandIDByName / LookupTeachingPositionIDByName 等查重/覆盖/改名）。
   - Java 现状：ImportExportServiceImpl.importBrands（1037-1071 行）只 insertAllianceBrand(name, type, draft, ...)，学生/企业/岗位/专业/教师/专家 ID 全不解析，无查重/overwrite/rename/skip，无岗位/专家联动，仅 name/type 落库。
3. 【P2】GET /alliance/dictionaries/{dictType} 鉴权面收窄（需确认）
   - Go：该 GET 挂在「跨模块只读引用组」（routes.go:185-187，任意登录用户可读，写操作才限联盟管理菜单）。
   - Java：与写操作同放在管理面 AllianceController。若 Java 对该 controller 无区分 GET/POST 的细粒度授权，可能把 Go 的「登录公开只读字典」收窄为「管理菜单才可读」。需对照 Java 安全配置确认。
4. 【P2】Controller 缺 @SaCheckPermission / @Log（框架契约观察项）
   - 抽查的本域 10 个 Controller 均未见 @SaCheckPermission 与写操作 @Log 注解；Go 侧靠 router 层 RequireMenu/RequireRole 做菜单驱动 RBAC（menu_grants.go）。Java 若依赖全局拦截器/路径配置需确认是否与 Go 的「联盟管理菜单 ∪ 落地页菜单」授权面一致，否则有越权/漏审计风险。属跨域系统性问题，建议单独立项核对。

## 4. 建议迁移项（按优先级）

### P0 阻断
1. 补共建审批通过→合并回源资源。Go 依据 store/store.go:618 MergeSourceEditDraft + store/alliance_source_edit_store.go:61/154 + service/approval.go:64。Java 需在 JobApprovalServiceImpl 最终通过（approved）分支，对 targetType ∈ {career_position, scenario} 且目标带 source_resource_id 时：用 draft 主表字段覆盖源资源、子表行改挂源资源（保留子表 id）、删除 draft 行（对齐 Go 的 MergePositionDraftToSource/MergeScenarioDraftToSource 语义，含事务）。

### P1 重要
2. 补品牌 Excel 导入的按类型深链。Go 依据 service/resource_import.go:1339 DoImportBrandsTyped + store/alliance_brand_import.go。Java 需在 ImportExportServiceImpl.importBrands 按 brandType 实现：job→建岗位+SaveFull 并回填 position_id；teacher→按 user_id 查/建专家并回填 expert_id/teacher_id；employer→解析并关联 enterprise_id；talent/student→解析 student_id；major→解析 major_id；以及基于 GetBrandByName 的 overwrite/rename/skip 去重。
3. 核对其它 4 个联盟导入（projects/achievements/agreements/permissions）深度。确认 Java importProjects/importAchievements/importAgreements/importPermissions（ImportExportServiceImpl 637-640 行）与 Go resource_import.go 对应方法是否一致（是否缺 enterprise/expert 关联、去重、overwrite/rename）。本报告重点核实了 brand，其余 4 个建议一并核对。

### P2 次要
4. 字典 GET 鉴权面对齐：将 GET /alliance/dictionaries/{dictType} 读权限对齐 Go 的「登录用户只读」面（或确认 Java 安全配置已如此）。
5. 补 Controller 鉴权/审计注解：为本域写操作补 @SaCheckPermission + @Log，与 Go 的菜单驱动 RBAC 授权面逐一对齐（尤其联盟管理菜单 vs 落地页只读的区分）。
