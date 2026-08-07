# backend/migrations 全量审查 + seed 审查

> 审查日期：2026-08-07
> 范围：backend/migrations/ 下 108 个 SQL 文件（001 baseline up/down + 091-138 共 54 组增量 up/down）+ seed 程序 backend/cmd/seed/main.go
> 说明：backend/seed 为编译产物（Go 二进制），种子数据源码在 backend/cmd/seed/main.go，另有两份种子 SQL（108/131）
> 迁移执行器：backend/cmd/migrate/main.go（deploy.sh 中 baseline 用 psql 应用、增量用 migrate 工具）

## backend/migrations/001_baseline.up.sql
- [P2][迁移健壮性] 001_baseline.up.sql:1-2181 — 全部 CREATE TABLE/ALTER 无 IF NOT EXISTS，且 runner 对多语句文件按 ";\n" 切分逐条执行（cmd/migrate/main.go:211-241），非事务；中途失败后重跑会因"对象已存在"直接报错，无法续跑。最佳实践：语句包在单事务中执行，或建表统一加 IF NOT EXISTS；psql 兜底路径（deploy.sh:218）也存在同样问题。
- [P3][命名] 001_baseline.up.sql:1617 — users 表主键命名为 users_pkey1（应为 users_pkey），其余表均为 *_pkey，命名不一致。最佳实践：统一为 users_pkey。
- [P3][衔接] 001_baseline.up.sql:1-2 — 注释声称"覆盖 migrations 001-091"，但当前首个增量从 091 起且 baseline 不含 091+ 的任何表/列（certification_weights、terms、courses.eval_data 等均不在 baseline），衔接实际正确；建议注释改为"001-090"避免误导。
- [P3][类型] 001_baseline.up.sql:910-916 — resource_tags.id 为 varchar(50) 而非 uuid（历史遗留，137 新建 tags 用 uuid），风格不统一，暂无实际影响。
- [P3][约束] 001_baseline.up.sql:443-453 — graduation_project_archives 无 (topic_id, user_id) 唯一约束（111 才补），baseline 阶段即存在重复插入窗口；已在 111 修复，仅提示。

## backend/migrations/001_baseline.down.sql
- [P0][运行时必错] 001_baseline.down.sql:1-9 — DO $$ ... $$ 块会被迁移执行器 cmd/migrate/main.go:211-241 的 isMultiStatement/execMultiSQL 按 ";\n" 切碎：块内 `DECLARE r RECORD;`、`EXECUTE ... CASCADE;`、`END LOOP;` 等 6 处分号都带换行，被拆成 4 段独立语句逐个执行，每段都是语法错误（`DO $$ DECLARE r RECORD`、孤立的 `BEGIN`/`END LOOP`），导致 baseline 无法通过 migrate 工具回滚。最佳实践：将 DO 块改写为逐条 `DROP TABLE IF EXISTS`/`DROP TYPE IF EXISTS` 语句（执行器逐条执行），或在执行器中用 psql -f / 单事务方式执行整文件。

## backend/migrations/091_certification_weights.up.sql
- [P2][外键缺失] 091_certification_weights.up.sql:9 — tenant_id 无 REFERENCES tenants 外键（后续 115/116 的租户级联清理也未覆盖此表），租户删除时产生孤儿数据。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [P3][外键缺失] 091_certification_weights.up.sql:6-7 — rule_id/ability_point_id 无外键（引用 certification_rules/ability_points），逻辑外键无约束兜底。最佳实践：补 FK 或至少加 CHECK/注释说明。
- [P3][唯一约束] 091_certification_weights.up.sql:15-16 — 表达式唯一索引用 COALESCE 零 UUID 表示"任务权重行"，若业务上确会生成 id 全零的 task 行会误判唯一；实际概率极低，可接受。

## backend/migrations/091_certification_weights.down.sql
无问题（DROP TABLE 与 up 对称，索引随表删除）。

## backend/migrations/092_affairs.up.sql
- [P2][多租户隔离] 092_affairs.up.sql:70-89 — teaching_plan_entries 无 tenant_id 列（同批次 092 的 terms/training_programs/teaching_plans/venues/period_slots/schedule_entries 均有），仅经 plan_id→teaching_plans 间接归属租户，查询/过滤需多表 JOIN，跨租户数据隔离依赖应用层。最佳实践：补 tenant_id 列并加索引。
- [P2][多租户隔离] 092_affairs.up.sql:37-51 — training_program_courses 同样无 tenant_id 列（间接经 program_id），问题同上。
- [P3][唯一约束] 092_affairs.up.sql:12 — terms.is_current 无部分唯一约束（如 `UNIQUE (tenant_id) WHERE is_current`），同租户可能同时存在多个"当前学期"；若代码层有防重则仅为防御缺口。最佳实践：`CREATE UNIQUE INDEX ... ON terms(tenant_id) WHERE is_current`。
- [P3][外键缺失] 092_affairs.up.sql:7,21,24 — teaching_plan_entries.teacher_id、training_program_courses 等引用 users/scenarios 无 ON DELETE 动作（115/116 已补，提示一致性依赖 115/116）。

## backend/migrations/092_affairs.down.sql
无问题（按依赖逆序 9 表齐全，与 up 对称）。

## backend/migrations/093_course_eval_data.up.sql
无问题（ADD COLUMN + IF NOT EXISTS，默认值 '{}' NOT NULL 用 PG11+ fast default，安全）。

## backend/migrations/093_course_eval_data.down.sql
无问题。

## backend/migrations/094_course_assessments.up.sql
- [P2][数据正确性] 094_course_assessments.up.sql:12-19 — 回填 UPDATE 仅按 `c.code = se.course_code` 匹配 courses，未加 tenant 维度过滤；courses.code 仅租户内唯一（uq_courses_tenant_code），跨租户同 code 时可能把其他租户课程的 course_id 错误写入本租户排课。最佳实践：加 `AND c.tenant_id = se.tenant_id`。
- [P3][命名] 094_course_assessments.up.sql:6-7 — 与 092 同文件组，无 public 前缀（092 亦无），与 baseline 风格不一致，纯风格问题。

## backend/migrations/094_course_assessments.down.sql
无问题（先删表后删列，与 up 对称；course_homeworks 的 FK 随 DROP TABLE 自动清理）。

## backend/migrations/095_course_ability_aggregation.up.sql
- [P3][类型] 095_course_ability_aggregation.up.sql:7 — courses.ability_point_ids 为可空 `UUID[] DEFAULT '{}'::uuid[]`，而 baseline courses.knowledge_point_ids 为 `NOT NULL DEFAULT '{}'`，风格不一致（可空导致代码需额外判空）。最佳实践：与 knowledge_point_ids 一致加 NOT NULL。

## backend/migrations/095_course_ability_aggregation.down.sql
无问题（索引逐条删除 + 表 + 列，完全对称）。

## backend/migrations/096_course_homework_submissions.up.sql
无问题（表 + 4 索引 + 1 唯一索引，down 对称）。

## backend/migrations/096_course_homework_submissions.down.sql
无问题。

## backend/migrations/097_knowledge_point_source.up.sql
无问题（ADD COLUMN + IF NOT EXISTS，down 对称）。注意：本文件与 097_node_eval_and_affairs_course 编号重复（见下条汇总）。

## backend/migrations/097_knowledge_point_source.down.sql
无问题。

## backend/migrations/097_node_eval_and_affairs_course.up.sql
- [P2][编号重复] 097_node_eval_and_affairs_course.up.sql:1 — 与 097_knowledge_point_source 同号（097）。runner（cmd/migrate/main.go:85-93,144-148）按"数字前缀 + 文件名"排序、以完整文件名作版本号，up/down 顺序确定且对称，当前两个 097 无互相依赖，可正确执行；但编号约定被破坏，后续若两迁移产生依赖将导致隐性顺序错误。最佳实践：拆号为 097/098 并顺延后续编号，或在文件名中显式子序号（097a/097b）并保证 down 依赖。
- [P3][唯一约束] 097_node_eval_and_affairs_course.up.sql:26 — 内联 UNIQUE 约束名由系统生成（node_evaluation_results_tenant_id_node_id_evaluatee_id_method_key_key），与 095 的手写唯一索引风格不一致，纯命名问题。

## backend/migrations/097_node_eval_and_affairs_course.down.sql
无问题（索引/表/列回滚顺序正确，与 up 对称）。

## backend/migrations/098_node_homework_submissions.up.sql
无问题（补齐 4 列 + 新表 + 4 索引，列均有默认值/可空，存量行安全）。

## backend/migrations/098_node_homework_submissions.down.sql
无问题（与 up 完全对称）。

## backend/migrations/099_certificate_library_updated_at.up.sql
无问题。

## backend/migrations/099_certificate_library_updated_at.down.sql
无问题。

## backend/migrations/100_scene_eval_unique_tenant.up.sql
- [P3][幂等性] 100_scene_eval_unique_tenant.up.sql:2 — ADD CONSTRAINT 无 IF NOT EXISTS（DROP 有 IF EXISTS），runner 中断重跑会因约束已存在失败。最佳实践：ADD CONSTRAINT 前判断或包事务。
- [P3][迁移健壮性] 100_scene_eval_unique_tenant.up.sql:2 — 未处理存量重复：旧约束 (task_id, evaluatee_id, method_key) 已保证三者唯一，新约束只是加入 tenant_id 列（约束放宽而非收紧），实际不会因存量数据失败，可接受。

## backend/migrations/100_scene_eval_unique_tenant.down.sql
无问题（名称回滚精确，与 up 对称）。

## backend/migrations/101_alliance_brand.up.sql
- [P2][外键缺失] 101_alliance_brand.up.sql:4,23,58,75,96,112,137,167,185,201,214,236 — 12 张联盟表（alliance_school_info/enterprises/enterprise_agreements/projects/milestones/achievements/experts/agreements/permissions/dictionaries/brands/brand_topics）tenant_id 均 NOT NULL 但无 REFERENCES tenants 外键，115/116 也未补：租户删除不级联清理，产生孤儿数据（联盟模块数据量随合作企业/项目增长后不可忽略）。最佳实践：统一加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [P3][外键缺失] 101_alliance_brand.up.sql:156,189-190 — alliance_experts.enterprise_id、alliance_permissions.enterprise_id/expert_id 已有 FK 但 alliance_permissions.enterprise_id 与 expert_id 无 CHECK（同一账号同时绑企业与专家），纯约束风格问题。

## backend/migrations/101_alliance_brand.down.sql
无问题（12 表逆序 DROP 齐全，与 up 对称；CASCADE 冗余但无害）。

## backend/migrations/101_teaching_plan_entry_classes.up.sql
- [P2][多租户隔离] 101_teaching_plan_entry_classes.up.sql:2-6 — 关联表无 tenant_id 列（同号 101 的另一迁移 alliance_brand 全部带 tenant_id，092 教务表也带），且 PK 仅 (entry_id, class_node_id)；虽然 entry_id 经 teaching_plan_entries 间接归属租户，但跨租户组织节点 id 若碰撞会造成跨租户班级串入。最佳实践：加 tenant_id 列并纳入 PK/复合索引。
- [P2][编号重复] 101_teaching_plan_entry_classes.up.sql:1 — 与 101_alliance_brand 同号（runner 按文件名排序可正确执行，两个 101 无依赖；风险同上 097）。
- [P3][数据迁移] 101_teaching_plan_entry_classes.up.sql:9-11 — INSERT...SELECT 无事务包裹（multi-statement 逐条执行），且无 WHERE tenant_id 过滤（表无该列，间接安全）。

## backend/migrations/101_teaching_plan_entry_classes.down.sql
无问题（DROP TABLE 与 up 对称）。

## backend/migrations/102_program_course_position.up.sql
- [P2][数据破坏] 102_program_course_position.up.sql:2 — `DELETE FROM training_program_courses` 无条件清空业务数据，down 不恢复（见 102 down 记录）；若线上已有人培方案课程数据，该迁移直接丢数据。最佳实践：数据清理类操作应从部署流程分离执行并人工确认，或至少将 DELETE 限制为目标 schema 并记录执行前备份。
- [P3][迁移健壮性] 102_program_course_position.up.sql:4-5 — DROP COLUMN 自动删除其 FK（scenario_id 引用 scenarios），ADD position_id 无 IF NOT EXISTS 之外的问题；整体可执行。

## backend/migrations/102_program_course_position.down.sql
- [P2][回滚不对称] 102_program_course_position.down.sql:1-2 — down 仅重建 scenario_id 列，up 中 DELETE 清空的数据无法恢复，且 down 无任何"数据不可恢复"提示；回滚后表结构对称但数据永久丢失。最佳实践：up 中 DELETE 前做备份表（如 INSERT INTO ..._backup SELECT ...）或在 down 提供还原脚本。

## backend/migrations/103_alliance_enrich.up.sql
无问题（3 表 14 列 + 7 索引，down 对称；DROP COLUMN 自动删索引）。

## backend/migrations/103_alliance_enrich.down.sql
无问题（未显式删索引，DROP COLUMN 自动处理，与 up 对称）。

## backend/migrations/104_program_content_mgmt.up.sql
- [P3][索引缺失] 104_program_content_mgmt.up.sql:2 — training_programs.batch_id 外键列无索引（行数少可容忍）。最佳实践：`CREATE INDEX idx_training_programs_batch ON training_programs(batch_id)`。

## backend/migrations/104_program_content_mgmt.down.sql
无问题。

## backend/migrations/104_tenant_school_fields.up.sql
无问题（8 列 ADD + IF NOT EXISTS，down 对称）。注意：本文件与 104_program_content_mgmt 编号重复（runner 可正确执行，无依赖）。

## backend/migrations/104_tenant_school_fields.down.sql
无问题。

## backend/migrations/105_tenant_education_fields.up.sql
无问题（澄清：105 仅有 tenant_education_fields 一组 up/down，无编号重复；用户疑点中 105 实际未重复）。

## backend/migrations/105_tenant_education_fields.down.sql
无问题。

## backend/migrations/106_affairs_batches.up.sql
- [P3][外键缺失] 106_affairs_batches.up.sql:7 — workflow_id 无 REFERENCES workflows 外键（baseline batches 表同样如此，风格一致但无约束兜底）。最佳实践：补 FK 或与 batches 保持一致并在代码层校验。

## backend/migrations/106_affairs_batches.down.sql
无问题。

## backend/migrations/107_alliance_relations.up.sql
无问题（5 表加 created_by 可空列，down 对称）。注意：本文件与 107_schedule_multi_class 编号重复（runner 可正确执行，无依赖）。

## backend/migrations/107_alliance_relations.down.sql
无问题。

## backend/migrations/107_schedule_multi_class.up.sql
无问题（列带 NOT NULL DEFAULT '{}' fast default，回填语句安全）。

## backend/migrations/107_schedule_multi_class.down.sql
无问题。

## backend/migrations/108_alliance_dict_seed.up.sql
- [P1][种子时序失效] 108_alliance_dict_seed.up.sql:47 — `CROSS JOIN tenants` 在 deploy.sh:940-951 流程中于 seed 程序创建运营方租户之前执行：全新安装时 tenants 表为空，CROSS JOIN 产生 0 行，联盟字典种子对运营方租户（及后续所有新租户）实际从未插入；与 industries 不同（tenants.go:16-17 industryDictSeedSQL 在新建租户时代码回填），alliance_dictionaries 无任何代码级回填，联盟字典页数据缺失。最佳实践：将种子插入迁移到 seed 程序/租户创建逻辑中（与 industries 对齐），或让迁移对"未来租户"也生效（租户创建时回填）。
- [P3][数据一致性] 108_alliance_dict_seed.up.sql:6,23-29 — cooperation_type 与 agreement_type 的 code 使用中文显示名（'人才培养'、'战略合作协议' 等），与后续 122 英文化映射配合；一旦 108 未生效，122/122 down 均为空操作（与 P1 连锁）。
- [P3][回滚过宽] 108_alliance_dict_seed.down.sql:2-4 — down 按 dict_type 删除全部租户的种子类型记录（含用户后续改名的同类型字典），保留条件过宽。最佳实践：down 按 (dict_type, code, name) 精确匹配删除（同 131 down 的写法）。

## backend/migrations/108_alliance_dict_seed.down.sql
见上（P3 回滚过宽）；结构上与 up 对称（同类型，编号唯一）。

## backend/migrations/109_alliance_agreement_project_ids.up.sql
无问题。

## backend/migrations/109_alliance_agreement_project_ids.down.sql
无问题。

## backend/migrations/110_remove_platform_links.up.sql
无问题（DROP TABLE IF EXISTS，两表无入边 FK，安全）。

## backend/migrations/110_remove_platform_links.down.sql
无问题（重建表 + 主键 + 唯一约束 + 索引 + 外键，与 baseline 定义逐项一致，与 up 对称）。

## backend/migrations/111_graduation_archive_unique.up.sql
- [P2][迁移健壮性] 111_graduation_archive_unique.up.sql:1-2 — ADD UNIQUE 约束前未清理存量重复（对照 112/114 均先 DELETE 去重再建约束）；若线上 graduation_project_archives 已存在 (topic_id, user_id) 重复记录，本迁移直接失败阻断部署。最佳实践：建约束前按 114 模式先 DELETE 保留最早一条。

## backend/migrations/111_graduation_archive_unique.down.sql
无问题（DROP CONSTRAINT IF EXISTS 与 up 对称）。

## backend/migrations/112_approval_pending_unique.up.sql
无问题（先清理后建部分唯一索引，模式正确）。

## backend/migrations/112_approval_pending_unique.down.sql
无问题。

## backend/migrations/113_exam_questions_unique.up.sql
- [P2][迁移健壮性] 113_exam_questions_unique.up.sql:1-2 — 同 111：ADD UNIQUE (exam_id, question_id) 前无存量重复清理，线上重复则迁移失败。最佳实践：先 DELETE 去重再 ADD CONSTRAINT。

## backend/migrations/113_exam_questions_unique.down.sql
无问题。

## backend/migrations/114_cert_issuance_unique.up.sql
- [P3][数据清理] 114_cert_issuance_unique.up.sql:4-9 — 去重按 id 大小保留"最小 id"而非"最早发放"，语义近似可接受；IS NOT DISTINCT FROM 对 tenant_id 处理正确。

## backend/migrations/114_cert_issuance_unique.down.sql
无问题。

## backend/migrations/115_tenant_delete_fk.up.sql
- [P3][约束名依赖] 115_tenant_delete_fk.up.sql:8-86 — 24 组 DROP/ADD 依赖 Postgres 自动生成的约束名；若线上约束名与默认命名不一致（历史手工命名），DROP IF EXISTS 静默跳过而 ADD 无 IF NOT EXISTS 会以"约束已存在/重名"失败。最佳实践：ADD CONSTRAINT 前用 pg_constraint 校验或统一约束命名规范。
- [P3][覆盖范围] 115_tenant_delete_fk.up.sql:1-86 — 仅覆盖 092-098 新增表的 FK；本迁移之后新增的表（127 community、129 student_honors、136 tenant_settings、137 tags 等）tenant_id 仍无 FK，见各文件条目。

## backend/migrations/115_tenant_delete_fk.down.sql
无问题（26 项与 up 逐项对称还原，顺序逆序正确）。

## backend/migrations/116_tenant_internal_fk.up.sql
- [P3][语义变化] 116_tenant_internal_fk.up.sql:75-76 — fk_organizations_type 由 ON DELETE RESTRICT 改为 CASCADE，down 还原为无动作（NO ACTION，非 RESTRICT）；RESTRICT 与 NO ACTION 仅延迟检查上有区别，实际等价，但语义上组织类型被删除时将级联删除组织（原为拒绝），属有意变更应确认。
- [P3][约束名依赖] 116_tenant_internal_fk.up.sql:5-91 — 同 115，依赖默认约束名。

## backend/migrations/116_tenant_internal_fk.down.sql
无问题（28 项与 up 对称还原）。

## backend/migrations/117_question_banks_permissions.up.sql
无问题（jsonb_set 幂等，down 用 #- 对称）。

## backend/migrations/117_question_banks_permissions.down.sql
无问题。

## backend/migrations/118_workspace_indexes.up.sql
无问题（4 索引，列均存在于前序迁移：class_node_ids 来自 107，teacher_id/class_node_id/term_id 来自 092，approval_records.status 来自 baseline）。

## backend/migrations/118_workspace_indexes.down.sql
无问题。

## backend/migrations/119_evaluation_config_indexes.up.sql
无问题（3 索引：target_ids/基线列，config_id/基线列，均存在）。

## backend/migrations/119_evaluation_config_indexes.down.sql
无问题。

## backend/migrations/120_ability_point_codes.up.sql
- [P3][唯一性] 120_ability_point_codes.up.sql:4 — 编码取 md5 前 8 位，约 43 亿分之一的碰撞概率且无唯一约束校验；ability_points.code 无唯一索引，碰撞仅造成显示歧义，可接受。

## backend/migrations/120_ability_point_codes.down.sql
无问题（仅清 NL- 前缀，与 up 对称度可接受）。

## backend/migrations/121_task_eval_exam_to_homework.up.sql
- [P3][数据迁移] 121_task_eval_exam_to_homework.up.sql:5-16 — 数据修复顺序正确（先删并保留 homework 行，再 rename 剩余 exam）；两条语句非事务执行，中断会留下"既有 exam 又有部分 task 被改名"的中间态，可接受。

## backend/migrations/121_task_eval_exam_to_homework.down.sql
- [P1][回滚缺失] 121_task_eval_exam_to_homework.down.sql:1-2 — down 仅为注释，无任何 SQL 操作，up 对 task_evaluation_methods.method_key 的批量改写不可回滚（method_key='exam' 的约束值已全部消失）。最佳实践：down 至少按 122 模式提供保守反向 UPDATE（无法精确区分时把"无 homework 行"作为近似反向），或明确声明不可逆并阻塞回滚。

## backend/migrations/122_alliance_dict_english_codes.up.sql
无问题（映射表完整：cooperation_type 6 条、agreement_type 7 条、project_type 8 条与 108 种子一一对应；NOT EXISTS 防冲突）。

## backend/migrations/122_alliance_dict_english_codes.down.sql
无问题（与 up 完全对称）。

## backend/migrations/123_eval_standard_copy.up.sql
- [P2][外键缺失] 123_eval_standard_copy.up.sql:11 — task_eval_score_rules.tenant_id 无 REFERENCES tenants 外键（115/116 未覆盖），租户删除不级联。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [P3][迁移健壮性] 123_eval_standard_copy.up.sql:32 — `(item->>'weight')::numeric` 强转：rubric_templates.data 中 weight 若为非数字字符串则迁移直接失败。最佳实践：`COALESCE(NULLIF(item->>'weight',''), '0')::numeric`。
- [P3][回滚不对称] 123_eval_standard_copy.down.sql:1-8 — down 删除 task_eval_score_rules 并保留 standard_name/standard_mode 置空逻辑，不恢复 rubric_template_id 引用（有注释说明，数据层面可接受）；表/列结构与 up 对称。

## backend/migrations/123_eval_standard_copy.down.sql
见上（P3 回滚不对称，已文档化）。

## backend/migrations/124_certification_point_levels.up.sql
- [P2][外键缺失] 124_certification_point_levels.up.sql:4-6 — tenant_id/career_position_id/ability_point_id 均无外键（引用 tenants/career_positions/ability_points），租户删除产生孤儿数据。最佳实践：tenant_id 加 `REFERENCES tenants(id) ON DELETE CASCADE`，其余两列加逻辑外键。

## backend/migrations/124_certification_point_levels.down.sql
无问题。

## backend/migrations/125_job_ability_indicators.up.sql
无问题（2 列可空新增，down 对称）。

## backend/migrations/125_job_ability_indicators.down.sql
无问题。

## backend/migrations/126_job_ability_competency_v2.up.sql
无问题（与 125 列名 position_competency 不冲突，语义区分明确）。

## backend/migrations/126_job_ability_competency_v2.down.sql
无问题。

## backend/migrations/127_community.up.sql
- [P2][外键缺失] 127_community.up.sql:4 — community_topics.tenant_id 无 REFERENCES tenants 外键（115/116 之后新增，未被覆盖），租户删除不级联，帖子孤儿数据。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [P3][租户隔离] 127_community.up.sql:15-22 — community_replies 无 tenant_id 列（经 topic_id 间接隔离，可接受）；tenant_id 上已有 (tenant_id, created_at)/(tenant_id, author_id) 复合索引，查询路径有索引覆盖。

## backend/migrations/127_community.down.sql
无问题（逆序 DROP，与 up 对称）。

## backend/migrations/128_knowledge_ability_point_codes.up.sql
- [P3][冗余] 128_knowledge_ability_point_codes.up.sql:7-9 — 对 ability_points 的回填与 120 完全重复（120 已回填全部 NULL/空 code），仅 knowledge_points 部分是增量；重复执行无害，属冗余语句。

## backend/migrations/128_knowledge_ability_point_codes.down.sql
- [P1][回滚缺失] 128_knowledge_ability_point_codes.down.sql:1 — down 仅为注释无任何操作（知识点的 KP- 编码回填不可逆）。最佳实践：至少按 120 down 模式回清 `WHERE code LIKE 'KP-%'`（ability_points 的 NL- 部分与 120 down 重叠，可一并清空）。

## backend/migrations/129_student_honors.up.sql
- [P2][外键缺失] 129_student_honors.up.sql:4 — tenant_id 无 REFERENCES tenants 外键（115/116 未覆盖），租户删除不级联，荣誉记录孤儿数据。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [P3][类型] 129_student_honors.up.sql:8 — honor_date 用 varchar(32) 而非 date（非标准日期数据），与 092 系列 date 类型风格不一致；若前端仅作展示可接受。

## backend/migrations/129_student_honors.down.sql
无问题。

## backend/migrations/129_user_favorites.up.sql
- [P3][外键缺失] 129_user_favorites.up.sql:3 — user_id 无 REFERENCES users 外键、表无 tenant_id（收藏跨租户场景按 user 隔离）；user_id 有索引与 (user_id, target_type, target_id) 唯一约束，功能正确，仅约束兜底缺失。
- [P2][编号重复] 129_user_favorites.up.sql:1 — 与 129_student_honors 同号（runner 按文件名排序可正确执行，无依赖；风险同上 097）。

## backend/migrations/129_user_favorites.down.sql
无问题。

## backend/migrations/130_drop_ability_category.up.sql
无问题（3 步 UPDATE 去重写入 + DROP INDEX + DROP COLUMN，顺序正确；down 近似恢复可接受）。

## backend/migrations/130_drop_ability_category.down.sql
无问题（恢复 category 列 + 近似映射 + NOT NULL + 索引；"知识/技能/素质同时存在时取知识"为近似语义，已注释说明，可接受）。

## backend/migrations/131_industry_dict_seed.up.sql
- [P2][种子时序失效] 131_industry_dict_seed.up.sql:104 — 同 108：CROSS JOIN tenants 在 seed 程序创建运营方租户之前执行，全新安装时 tenants 为空 → 种子 0 行；但与 108 不同，新建租户时 store/tenants.go:372 有 industryDictSeedSQL 代码回填，功能得以兜底，代价是"迁移种子 + 代码种子"双份维护（本次审查发现 131 与 industryDictSeedSQL 内容 97 条完全一致，未来改一处忘另一处即漂移）。最佳实践：迁移种子仅服务存量库升级，新库依赖代码回填；建议抽公共 SQL 常量或注释交叉引用。

## backend/migrations/131_industry_dict_seed.down.sql
无问题（按 (code, name) 精确匹配删除，保留用户自建/改名行业，回滚安全；97 条与 up 一一对应）。

## backend/migrations/132_daily_exam_grading.up.sql
无问题（5 列，2 列带 NOT NULL DEFAULT fast default，down 对称）。

## backend/migrations/132_daily_exam_grading.down.sql
无问题。

## backend/migrations/133_exam_activation_mode.up.sql
- [P3][迁移健壮性] 133_exam_activation_mode.up.sql:18-21 — `(NULLIF(tem.resource_config->>'paperId',''))::uuid` 强转：若线上 resource_config.paperId/examId 为非法 uuid 文本，CAST 抛错导致整个迁移失败。最佳实践：`NULLIF(...,'')::uuid` 前先 `~ '^[0-9a-f-]{36}$'` 校验或包在子查询用 TRY 语义（PG 无 TRY，可用 regex 过滤）。
- [P3][数据不可逆] 133_exam_activation_mode.down.sql:1-3 — down 仅删列，status 的 in_progress→published 归一化不可逆；数据层面可接受（published 状态语义兼容）。

## backend/migrations/133_exam_activation_mode.down.sql
见上（P3 数据不可逆，已接受）。

## backend/migrations/134_period_slot_type.up.sql
无问题（fast default + 两段回填与注释约定 0-3/4-7/8+ 一致）。

## backend/migrations/134_period_slot_type.down.sql
无问题。

## backend/migrations/135_platform_settings.up.sql
无问题（平台级键值表，无租户概念，设计合理）。

## backend/migrations/135_platform_settings.down.sql
无问题。

## backend/migrations/136_tenant_settings.up.sql
- [P2][外键缺失] 136_tenant_settings.up.sql:3 — tenant_id 无 REFERENCES tenants 外键，租户删除残留配置孤儿行（settings 无 created_by 亦无 FK 其他列）。最佳实践：加 `REFERENCES tenants(id) ON DELETE CASCADE`。

## backend/migrations/136_tenant_settings.down.sql
无问题。

## backend/migrations/137_resource_tags.up.sql
- [P2][外键缺失] 137_resource_tags.up.sql:4,13 — tags.tenant_id 与 resource_tag_relations.tenant_id 均无 REFERENCES tenants 外键（115/116 未覆盖），租户删除不级联。最佳实践：两表 tenant_id 均加 `REFERENCES tenants(id) ON DELETE CASCADE`。
- [P3][命名] 137_resource_tags.up.sql:1-23 — 新建表 tags/resource_tag_relations 与 baseline 遗留的 resource_tags 表（id varchar(50)，未参与本设计）语义重叠，命名易混淆；建议 baseline resource_tags 迁移说明或重命名。

## backend/migrations/137_resource_tags.down.sql
无问题（逆序 DROP，与 up 对称）。

## backend/migrations/138_teaching_plan_content_mgmt.up.sql
无问题（4 列：batch_id 引用 106 的 affairs_batches ✓ 编号顺序正确；collaborators/updated_at 带 fast default；down 对称）。

## backend/migrations/138_teaching_plan_content_mgmt.down.sql
无问题。

## backend/cmd/seed/main.go（backend/seed 二进制源码）
- [P3][唯一冲突] backend/cmd/seed/main.go:85-89 — roles INSERT 仅 ON CONFLICT (id)；roles 另有唯一索引 idx_roles_tenant_code (tenant_id, code)，若库中已存在同租户同 code（platform_admin）但不同 id 的角色行，INSERT 报 23505 使种子失败（admin 用户缺失路径下才触发，概率低）。最佳实践：ON CONFLICT (tenant_id, code) DO NOTHING。
- [P3][唯一冲突] backend/cmd/seed/main.go:95-99 — users INSERT 仅 ON CONFLICT (id)；users 另有 uq_users_tenant_platform_login (tenant_id, platform, login_name) 与 users_tenant_platform_username 唯一约束，若存在同租户 admin 登录名不同 id 的用户，INSERT 报 23505。最佳实践：插入前按 login_name+platform 探测，与 48-49 行存在性判断合并。
- [P3][事务覆盖] backend/cmd/seed/main.go:73-83 — tenant 插入在 tx 内但 admin 已存在早退路径（51-59）不涉及事务，OK；roles/user/user_roles 三条 ON CONFLICT (id) 均依赖固定 UUID 常量，逻辑自洽，无 schema 不匹配。
- [P3][一致性] backend/cmd/seed/main.go:31-33 — 三个固定 UUID（租户 000...001、角色 000...002、用户 000...003）散落为字符串常量，与 domain.OperatorTenantID 常量只对齐一处；建议统一收口到 domain 常量，防止漂移。

## backend/cmd/migrate/main.go（迁移执行器，审查关联发现）
- [P0][执行器] backend/cmd/migrate/main.go:211-241 — isMultiStatement 以 ";\n" 计数切分，任何包含 DO $$ 块或语句内分号换行的 SQL 都会被错误切碎（001_baseline.down.sql 即命中，见该文件 P0）；且 multi-statement 路径非事务、逐条执行，中途失败留下部分状态且版本不记录，重跑不可续。最佳实践：用 pgx 的 Batch/多语句单 Exec（pgx 原生支持多语句一次提交）替代手工 Split，或 DO 块迁移执行器改为 psql -f。
- [P3][执行器] backend/cmd/migrate/main.go:85-93 — 同号迁移按文件名排序执行，与 down 的 version DESC 排序对称，当前 5 组同号迁移（097/101/104/107/129）均无相互依赖，可正确执行；但该排序依赖与"数字前缀+字母序"耦合，新增同号迁移时易被忽略（见各文件 P2 编号重复条目）。

## 汇总统计
- 审查文件数：109（108 个 SQL migration 文件 + 1 个 seed 源码）
- 问题总数：67（P0×2、P1×3、P2×21、P3×41）
- 重复编号：097（knowledge_point_source / node_eval_and_affairs_course）、101（alliance_brand / teaching_plan_entry_classes）、104（program_content_mgmt / tenant_school_fields）、107（alliance_relations / schedule_multi_class）、129（student_honors / user_favorites）；105 无重复
- 重点核查结论：001 baseline 与 091-138 衔接正确（baseline 不含任何增量表/列，增量无前向引用）；down 全部成对存在，仅 121/128 为纯注释空操作
