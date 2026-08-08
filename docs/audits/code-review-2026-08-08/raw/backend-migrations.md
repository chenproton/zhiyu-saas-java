# 后端迁移与种子复查（2026-08-08）

范围：backend/migrations/ 全部 112 个文件（001_baseline + 091–140 共 55 个编号、含 097/101/104/107/129 同号 pair）+ backend/cmd/seed/main.go + backend/cmd/migrate/main.go（执行器，配合检查）+ deploy.sh 迁移/种子时序（配合检查）。

关键背景：migrate 工具按"完整文件名"（如 `097_knowledge_point_source`）记录版本，同号 pair 按文件名稳定排序（up 正序、down 逆序，对称）；多语句文件按 `;\n` 切碎且跳过 `$$...$$` 字面量。deploy.sh 全新部署时序为：001_baseline → migrate up（091…140）→ seed（创建运营方租户 0000…0001）。

---

## backend/migrations/001_baseline.up.sql
- [P3][风格] 001_baseline.up.sql:1352-1627 — baseline 与增量迁移重复维护同名约束/索引（001 之后 091 起全部为增量，001 内含 001-091 全量快照），后续增删列易出现 baseline 与增量不一致；最佳实践：baseline 仅作首次安装快照，后续一律增量，文档中已约定。

## backend/migrations/001_baseline.down.sql
- [P3][风格] 001_baseline.down.sql:1-9 — DO 块 DROP 全部表/枚举类型；依赖 splitSQLStatements 的 `$$` 跳过逻辑（migrate/main.go:230-254），实测该逻辑正确处理，无回归。

## backend/migrations/091_certification_weights.up.sql
- 无问题（COALESCE 表达式唯一索引写法合理，task_id 可空语义正确）

## backend/migrations/091_certification_weights.down.sql
- 无问题

## backend/migrations/092_affairs.up.sql
- 无问题（inline REFERENCES 默认约束名与 115/116 的 DROP 名称一致，校验通过）

## backend/migrations/092_affairs.down.sql
- 无问题（逆依赖序正确）

## backend/migrations/093_course_eval_data.up.sql / down.sql
- 无问题

## backend/migrations/094_course_assessments.up.sql
- 无问题

## backend/migrations/094_course_assessments.down.sql
- 无问题

## backend/migrations/095_course_ability_aggregation.up.sql
- 无问题

## backend/migrations/095_course_ability_aggregation.down.sql
- 无问题

## backend/migrations/096_course_homework_submissions.up.sql
- 无问题

## backend/migrations/096_course_homework_submissions.down.sql
- 无问题

## backend/migrations/097_knowledge_point_source.up.sql / down.sql
- 无问题

## backend/migrations/097_node_eval_and_affairs_course.up.sql
- 无问题

## backend/migrations/097_node_eval_and_affairs_course.down.sql
- 无问题

## backend/migrations/098_node_homework_submissions.up.sql
- 无问题（node_homeworks 补列与 116 的 creator_id 约束名吻合）

## backend/migrations/098_node_homework_submissions.down.sql
- 无问题

## backend/migrations/099_certificate_library_updated_at.up.sql / down.sql
- 无问题

## backend/migrations/100_scene_eval_unique_tenant.up.sql
- [P3][幂等] 100_scene_eval_unique_tenant.up.sql:2 — ADD CONSTRAINT 无 IF NOT EXISTS 保护；单次执行无碍，migrate 工具失败后 deploy.sh 兜底重跑会失败（见 deploy.sh 问题）。

## backend/migrations/100_scene_eval_unique_tenant.down.sql
- 无问题（可逆且对称）

## backend/migrations/101_alliance_brand.up.sql
- 无问题（9 张表结构自洽；tenant_id 均为 NOT NULL 无 FK，由 140 补齐）

## backend/migrations/101_alliance_brand.down.sql
- [P3][风格] 101_alliance_brand.down.sql:1-12 — 全部 DROP TABLE CASCADE；本轮可接受（回滚顺序 140 down 先于本文件，无悬挂引用），但 CASCADE 掩盖了真实依赖，若未来新增跨表引用需复核。

## backend/migrations/101_teaching_plan_entry_classes.up.sql
- 无问题（旧数据迁移 ON CONFLICT DO NOTHING 安全）

## backend/migrations/101_teaching_plan_entry_classes.down.sql
- 无问题

## backend/migrations/102_program_course_position.up.sql
- [P3][破坏性] 102_program_course_position.up.sql:2 — DELETE FROM training_program_courses 清空整表（注释已声明意图）；最佳实践：数据量增长后该全清操作成本上升，且无备份提示，建议迁移前 pg_dump（deploy.sh 已有迁移前备份，可接受）。

## backend/migrations/102_program_course_position.down.sql
- [P3][不对称] 102_program_course_position.down.sql:1-2 — down 仅还原列，不回滚 up 清空的数据（不可逆未注明）；最佳实践：与 121 down 一致加"不可逆"说明。

## backend/migrations/103_alliance_enrich.up.sql
- 无问题

## backend/migrations/103_alliance_enrich.down.sql
- 无问题（DROP COLUMN 连带删除 FK，对称）

## backend/migrations/104_program_content_mgmt.up.sql / down.sql
- 无问题

## backend/migrations/104_tenant_school_fields.up.sql / down.sql
- 无问题

## backend/migrations/105_tenant_education_fields.up.sql / down.sql
- 无问题

## backend/migrations/106_affairs_batches.up.sql
- 无问题（tenant_id 含 inline REFERENCES，115 已接管为 CASCADE）

## backend/migrations/106_affairs_batches.down.sql
- 无问题

## backend/migrations/107_alliance_relations.up.sql / down.sql
- 无问题

## backend/migrations/107_schedule_multi_class.up.sql
- [P3][风格] 107_schedule_multi_class.up.sql:2 — class_node_ids 无 GIN 索引，但 118 已补 idx_schedule_entries_class_node_ids_gin，覆盖完整。

## backend/migrations/107_schedule_multi_class.down.sql
- 无问题

## backend/migrations/108_alliance_dict_seed.up.sql
- [P1][时序] 108_alliance_dict_seed.up.sql:49-54 — 为尚未创建的运营方租户（固定 ID 0000…0001）预插字典行是本迁移的既定设计（注释 2-4 行明确依赖"migration 先于 seed 执行"）；但 140 的孤儿清理会删除这些行（见 140 条目），导致全新部署后平台租户字典缺失。修复后本文件恢复无问题。
- [P3][幂等] 108_alliance_dict_seed.up.sql:5-55 — CROSS JOIN 含平台租户常量 + 现存租户，ON CONFLICT DO NOTHING 幂等，写法正确。

## backend/migrations/108_alliance_dict_seed.down.sql
- [P3][误删] 108_alliance_dict_seed.down.sql:2-4 — 按 dict_type IN(8 种) 删除，会连带删除用户自建的同类字典行（如用户新增 cooperation_type 自定义码）；最佳实践：down 应与 up 种子集合精确匹配（参照 131 down 的 (code,name) 精确匹配）。

## backend/migrations/109_alliance_agreement_project_ids.up.sql / down.sql
- 无问题

## backend/migrations/110_remove_platform_links.up.sql
- 无问题（DROP TABLE 含 IF EXISTS）

## backend/migrations/110_remove_platform_links.down.sql
- 无问题（重建结构与 baseline 一致，含 FK）

## backend/migrations/111_graduation_archive_unique.up.sql
- 无问题（若无重复数据则 ALTER 成功；重复可能性由业务保证，可接受）

## backend/migrations/111_graduation_archive_unique.down.sql
- 无问题

## backend/migrations/112_approval_pending_unique.up.sql
- 无问题（先清重后建部分唯一索引，写法正确）

## backend/migrations/112_approval_pending_unique.down.sql
- 无问题

## backend/migrations/113_exam_questions_unique.up.sql
- [P2][数据] 113_exam_questions_unique.up.sql:1-2 — 直接 ADD UNIQUE(exam_id, question_id)，未先清理存量重复行（对比 114 先 DELETE 再建约束）；若存在重复（同一试卷重复添加同一题目）则 ALTER 失败阻断部署。最佳实践：参照 114_cert_issuance_unique.up.sql:4-9 先清重。

## backend/migrations/113_exam_questions_unique.down.sql
- 无问题

## backend/migrations/114_cert_issuance_unique.up.sql
- 无问题（先清重后建约束，tenant_id 用 IS NOT DISTINCT FROM 处理 NULL，正确）

## backend/migrations/114_cert_issuance_unique.down.sql
- 无问题

## backend/migrations/115_tenant_delete_fk.up.sql
- 无问题（DROP+ADD 同名单语句配对；自动生成约束名与 inline REFERENCES 命名约定一致，全量核对通过；116 之前执行，无顺序依赖）

## backend/migrations/115_tenant_delete_fk.down.sql
- 无问题（与 up 完全对称还原）

## backend/migrations/116_tenant_internal_fk.up.sql
- [P3][语义] 116_tenant_internal_fk.up.sql:75-76 — organizations.type_id 改为 ON DELETE CASCADE：删除 org_types（字典表）行会级联删除全部该类组织；字典表被业务引用时 RESTRICT/SET NULL 更安全，建议确认系统中无删除 org_type 的路径（有则此为隐患）。

## backend/migrations/116_tenant_internal_fk.down.sql
- 无问题

## backend/migrations/117_question_banks_permissions.up.sql
- 无问题（jsonb_set 幂等）

## backend/migrations/117_question_banks_permissions.down.sql
- 无问题（#- 对称）

## backend/migrations/118_workspace_indexes.up.sql
- 无问题

## backend/migrations/118_workspace_indexes.down.sql
- 无问题

## backend/migrations/119_evaluation_config_indexes.up.sql
- 无问题（GIN target_ids 反查正确）

## backend/migrations/119_evaluation_config_indexes.down.sql
- 无问题

## backend/migrations/120_ability_point_codes.up.sql
- 无问题（md5(id) 编码随 id 稳定唯一）

## backend/migrations/120_ability_point_codes.down.sql
- 无问题（LIKE 'NL-%' 精确回退）

## backend/migrations/121_task_eval_exam_to_homework.up.sql
- 无问题（先删后改顺序正确，避免唯一冲突）

## backend/migrations/121_task_eval_exam_to_homework.down.sql
- 无问题（不可逆已注释说明，上轮修复到位；comment-only 文件走单语句路径，pgx 可正常执行）

## backend/migrations/122_alliance_dict_english_codes.up.sql
- 无问题（NOT EXISTS 防冲突，正确）

## backend/migrations/122_alliance_dict_english_codes.down.sql
- 无问题（对称）

## backend/migrations/123_eval_standard_copy.up.sql
- 无问题（复制+置空+悬空清理三步正确；`(item->>'weight')::numeric` 对存量脏数据有 cast 风险但为 old 数据回填、可接受）

## backend/migrations/123_eval_standard_copy.down.sql
- 无问题（不可逆行为已注释说明）

## backend/migrations/124_certification_point_levels.up.sql
- 无问题（唯一索引先建，无重复风险；140 已补 tenant FK）

## backend/migrations/124_certification_point_levels.down.sql
- 无问题

## backend/migrations/125_job_ability_indicators.up.sql / down.sql
- 无问题

## backend/migrations/126_job_ability_competency_v2.up.sql / down.sql
- 无问题

## backend/migrations/127_community.up.sql
- 无问题（作者/父回复/主题 FK 齐全；tenant FK 由 140 补）

## backend/migrations/127_community.down.sql
- 无问题

## backend/migrations/128_knowledge_ability_point_codes.up.sql
- 无问题

## backend/migrations/128_knowledge_ability_point_codes.down.sql
- 无问题（KP- 精确回退，NL- 交由 120 处理，注释说明正确；上轮修复到位）

## backend/migrations/129_student_honors.up.sql
- 无问题

## backend/migrations/129_student_honors.down.sql
- 无问题

## backend/migrations/129_user_favorites.up.sql
- 无问题（唯一约束 + 双侧索引齐全）

## backend/migrations/129_user_favorites.down.sql
- 无问题

## backend/migrations/130_drop_ability_category.up.sql
- 无问题（先迁移后删列，顺序正确）

## backend/migrations/130_drop_ability_category.down.sql
- [P3][不可逆] 130_drop_ability_category.down.sql:7 — 无标签行一律兜底置 'skill'，无法精确还原（注释已说明，可接受）。

## backend/migrations/131_industry_dict_seed.up.sql
- [P3][预存] 131_industry_dict_seed.up.sql:104 — CROSS JOIN tenants 仅覆盖迁移时已存在的租户；全新部署时 tenants 为空 → 平台租户（seed 后建）无行业种子，且无后续补种机制（预存问题，非本轮引入，记录备查）。

## backend/migrations/131_industry_dict_seed.down.sql
- 无问题（(code,name) 精确匹配删除，正确）

## backend/migrations/132_daily_exam_grading.up.sql
- [P3][缺索引] 132_daily_exam_grading.up.sql:3 — 新增 grading_status 列（批改待办按状态过滤场景），未配 (tenant_id, grading_status) 复合索引；现有 idx_examresults_tenant 可前缀过滤，数据量小时可接受，随量评估。

## backend/migrations/132_daily_exam_grading.down.sql
- 无问题

## backend/migrations/133_exam_activation_mode.up.sql
- [P2][运行时] 133_exam_activation_mode.up.sql:18-21 — `COALESCE(NULLIF(paperId,''), NULLIF(examId,''))::uuid` 无条件 uuid 强转；若存量 task_evaluation_methods.resource_config 中 paperId/examId 是非 uuid 文本（历史脏数据），`::uuid` 抛错导致整个迁移失败、阻断部署。最佳实践：加 `~ '^[0-9a-f]{8}-[0-9a-f]{4}-...'` 格式过滤或 CASE WHEN 校验后再强转。空串场景已由 NULLIF 兜住（NULL::uuid 安全），风险限于非法格式文本。

## backend/migrations/133_exam_activation_mode.down.sql
- [P3][不对称] 133_exam_activation_mode.down.sql:1-3 — down 仅 DROP COLUMN，不回滚 up 的 status 'in_progress'→'published' 归一化（且未注明不可逆，对比 121/123 down 有说明）；建议补注释。

## backend/migrations/134_period_slot_type.up.sql
- 无问题（回填规则与网格约定一致）

## backend/migrations/134_period_slot_type.down.sql
- 无问题

## backend/migrations/135_platform_settings.up.sql / down.sql
- 无问题

## backend/migrations/136_tenant_settings.up.sql
- 无问题（140 已补 tenant FK）

## backend/migrations/136_tenant_settings.down.sql
- 无问题

## backend/migrations/137_resource_tags.up.sql
- 无问题（唯一约束 + 双向索引齐全；140 已补 tenant FK）

## backend/migrations/137_resource_tags.down.sql
- 无问题

## backend/migrations/138_teaching_plan_content_mgmt.up.sql
- 无问题（affairs_batches 在 106 创建，顺序正确）

## backend/migrations/138_teaching_plan_content_mgmt.down.sql
- 无问题

## backend/migrations/139_perf_reference_indexes.up.sql
- 无问题。8 个索引与引用统计/零引用查询逐一对应（store/abilities.go:132-146 4 个 ability 表、store/lesson_content.go:36-37+68-69 2 个 knowledge 表、store/resource_library.go:154-155+190-191 2 个 resource 表），全部命中反向引用子查询列；无冗余（各表现有索引均以关联主键列开头，ability_point_id/knowledge_point_id/resource_id 单独反查无法命中，补索引合理）。名称与 baseline 及 091-138 无冲突。

## backend/migrations/139_perf_reference_indexes.down.sql
- 无问题（与 up 一一对称）

## backend/migrations/140_tenant_fk_cascade.up.sql
- [P1][时序回归] 140_tenant_fk_cascade.up.sql:6-70 — 孤儿清理会删除 108_alliance_dict_seed 为运营方租户（0000…0001，seed 尚未创建）预插的字典行：全新部署时序为 baseline → migrate(108→140) → seed，108 的预插行在 140 执行时 tenant 尚不存在，被 `NOT EXISTS` 清理判定为孤儿删除，seed 建租户后平台租户 alliance_dictionaries 为空（108 注释 2-4 行明确依赖该预插可用）。上轮修复的 108 种子时序被本迁移回归。最佳实践：140 清理语句统一加 `AND tenant_id <> '00000000-0000-0000-0000-000000000001'` 豁免平台租户常量（与 108 一致），或 108 改为依赖 seed 先建租户再补种。
- [P3][幂等] 140_tenant_fk_cascade.up.sql:7 等 — ADD CONSTRAINT 无 IF NOT EXISTS（PG 无此语法），单次执行无碍；migrate 工具失败后的 deploy.sh 兜底重跑场景会因约束已存在而失败（见 deploy.sh 条目）。
- [P3][性能] 140_tenant_fk_cascade.up.sql:46-47 — task_eval_score_rules 无 tenant_id 索引（123 仅建 config_id 索引），孤儿清理 DELETE 对该表全表扫描 + 相关子查询；一次性迁移可接受，随量评估。
- 其余核对通过：20 个表全部存在且含 tenant_id 列；约束命名与 091/101/115/116/123/124/127/129/136/137 现有约束零冲突；115/116 已覆盖的表（terms/schedule_entries/affairs_batches/course_homeworks/course_evaluation_results/course_homework_submissions/node_*）未重复添加；先清孤儿后加约束的顺序正确；up/down 20 条一一对称。

## backend/migrations/140_tenant_fk_cascade.down.sql
- 无问题（DROP CONSTRAINT IF EXISTS 逆序排列，与 up 对称）

## backend/cmd/seed/main.go
- [P3][边界] backend/cmd/seed/main.go:74-78 — 平台租户插入仅 `ON CONFLICT (id) DO NOTHING`；若库中已存在 code='platform' 但 id 不同的租户行（code 唯一约束），插入会因 code 冲突失败并退出（错误信息含糊）；最佳实践：先按 code 查询/更新。
- [P3][边界] backend/cmd/seed/main.go:85-89 — roles 插入仅 ON CONFLICT (id)；若同租户已存在 code='platform_admin' 但 id 不同的角色（idx_roles_tenant_code 唯一），同样冲突失败；建议 ON CONFLICT (tenant_id, code) DO UPDATE。
- 其余核对通过：插入列与 baseline users/roles/tenants/user_roles 列完全匹配；users.tenant_id 依赖 tenants FK 时同一事务内先建租户，顺序正确；password 重置分支与 adminExists 判断自洽。

## backend/cmd/migrate/main.go
- 无问题。同号 pair 按 (数字, 文件名) 稳定排序、down 按 (数字降序, 版本降序) 与 up 严格对称；多语句切碎对 `$$` 字面量跳过正确；statement_timeout=0 保障大 DDL。

## deploy.sh（配合检查）
- [P3][工具] deploy.sh:219-227 — migrate 工具失败后的 psql 兜底路径用 `sed 's/_.*//'` 取数字前缀作为版本号，与 migrate 工具记录的全文件名版本（如 `097_knowledge_point_source`）不一致：同号 pair（097/101/104/107/129）在兜底路径会出现"记录 097 后第二个文件被跳过"或"重跑已应用迁移（140 等 ADD CONSTRAINT 非幂等会失败）"；且兜底对 001 的 `grep -qx "001"` 与 `001_baseline` 不匹配。该路径仅在 migrate 工具失败时触发，属低频风险；最佳实践：兜底版本号统一按全文件名比对，并跳过 001。

---

# 汇总

- 审查文件数：112 个迁移文件 + seed/main.go + migrate/main.go + deploy.sh（配合检查）= 115
- 问题总数：17（P1×1、P2×2、P3×14）
  - P1：140 孤儿清理回归 108 平台租户字典预插（全新部署数据丢失）
  - P2：133 `::uuid` 强转脏数据阻断部署；113 建唯一约束前未清重
  - P3：140/100 非幂等、133 down 不对称、102 down 不可逆未注明、108 down 误删用户字典、116 org_type CASCADE 语义、131 平台租户无行业种子（预存）、132 缺状态索引、seed 两处 ON CONFLICT 边界、deploy.sh 兜底版本号不一致等
- 上轮修复复查：DO 块切碎（001 down）无回归；121 down 已注释不可逆、128 down 有回滚、108 含平台租户常量——均已到位，但 **108 的时序修复被 140 新引入回归（见 P1）**。
- 139/140 本身结构正确：139 索引与引用统计查询完全对应且无冗余、up/down 对称；140 覆盖完整（20 表核对无遗漏无重复）、约束名零冲突、先清孤儿后加约束顺序正确。
