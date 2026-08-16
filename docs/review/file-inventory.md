# 知与 SaaS 全量文件清单（代码审查基线）

> 本清单覆盖前后端全部自有源代码（排除 node_modules/.next/dist/vendor/image-editor/tsbuildinfo）。
> 用于逐文件审查进度勾选：每组经子代理完整读完后勾选。审查完成后状态汇总见 `issues-report.md`。
>
> ✅ **审查已完成**：2026-08-16 由 24 个并行子代理逐文件逐行完整读完全部 1106 个文件（覆盖校验 0 缺失），发现的问题与处置见 [`issues-report.md`](issues-report.md)。

## 统计

- 后端分组：40 组 / 489 文件
- 前端分组：41 组 / 617 文件
- 合计：1106 文件 / 272,339 行

## 后端分组

### B01 [ ] — 1 文件
- [ ] `backend/cmd/backfill-geo/main.go`

### B02 [ ] — 1 文件
- [ ] `backend/cmd/migrate/main.go`

### B03 [ ] — 1 文件
- [ ] `backend/cmd/seed/main.go`

### B04 [ ] — 1 文件
- [ ] `backend/cmd/server/main.go`

### B05 [ ] — 4 文件
- [ ] `backend/internal/ai/client_test.go`
- [ ] `backend/internal/ai/client.go`
- [ ] `backend/internal/ai/stream_test.go`
- [ ] `backend/internal/ai/stream.go`

### B06 [ ] — 4 文件
- [ ] `backend/internal/cache/cache.go`
- [ ] `backend/internal/cache/key.go`
- [ ] `backend/internal/cache/middleware_test.go`
- [ ] `backend/internal/cache/middleware.go`

### B07 [ ] — 1 文件
- [ ] `backend/internal/config/config.go`

### B08 [ ] — 2 文件
- [ ] `backend/internal/crypto/aes_test.go`
- [ ] `backend/internal/crypto/aes.go`

### B09 [ ] — 1 文件
- [ ] `backend/internal/db/db.go`

### B10 [ ] — 19 文件
- [ ] `backend/internal/domain/affairs_batch.go`
- [ ] `backend/internal/domain/affairs.go`
- [ ] `backend/internal/domain/ai_center.go`
- [ ] `backend/internal/domain/ai.go`
- [ ] `backend/internal/domain/alliance_employment.go`
- [ ] `backend/internal/domain/alliance.go`
- [ ] `backend/internal/domain/certification_model.go`
- [ ] `backend/internal/domain/community.go`
- [ ] `backend/internal/domain/evaluation.go`
- [ ] `backend/internal/domain/job.go`
- [ ] `backend/internal/domain/lesson.go`
- [ ] `backend/internal/domain/library.go`
- [ ] `backend/internal/domain/models.go`
- [ ] `backend/internal/domain/partner_cobuild.go`
- [ ] `backend/internal/domain/portal.go`
- [ ] `backend/internal/domain/scene.go`
- [ ] `backend/internal/domain/status.go`
- [ ] `backend/internal/domain/tag.go`
- [ ] `backend/internal/domain/unified.go`

### B11 [ ] — 2 文件
- [ ] `backend/internal/geo/geo_test.go`
- [ ] `backend/internal/geo/geo.go`

### B12 [ ] — 17 文件
- [ ] `backend/internal/handler/ability_code_test.go`
- [ ] `backend/internal/handler/ability_domain_handler.go`
- [ ] `backend/internal/handler/ability_handler.go`
- [ ] `backend/internal/handler/affairs_config_import_handler.go`
- [ ] `backend/internal/handler/affairs_config_import_test.go`
- [ ] `backend/internal/handler/affairs_term_handler_test.go`
- [ ] `backend/internal/handler/affairs_term_handler.go`
- [ ] `backend/internal/handler/ai_center_admin_handler.go`
- [ ] `backend/internal/handler/ai_center_flow_test.go`
- [ ] `backend/internal/handler/ai_center_handler.go`
- [ ] `backend/internal/handler/ai_handler.go`
- [ ] `backend/internal/handler/alliance_crud_handler.go`
- [ ] `backend/internal/handler/alliance_employment_handler_test.go`
- [ ] `backend/internal/handler/alliance_employment_handler.go`
- [ ] `backend/internal/handler/alliance_expert_display_test.go`
- [ ] `backend/internal/handler/alliance_grant_options_test.go`
- [ ] `backend/internal/handler/alliance_handler_test.go`

### B13 [ ] — 16 文件
- [ ] `backend/internal/handler/alliance_handler.go`
- [ ] `backend/internal/handler/alliance_import_test.go`
- [ ] `backend/internal/handler/alliance_mentor_handler_test.go`
- [ ] `backend/internal/handler/alliance_mentor_handler.go`
- [ ] `backend/internal/handler/alliance_public_achievement_links_test.go`
- [ ] `backend/internal/handler/alliance_public_agreements_test.go`
- [ ] `backend/internal/handler/alliance_public_brands_display_test.go`
- [ ] `backend/internal/handler/alliance_public_display_test.go`
- [ ] `backend/internal/handler/alliance_public_milestones_test.go`
- [ ] `backend/internal/handler/appeal_handler.go`
- [ ] `backend/internal/handler/approval_handler.go`
- [ ] `backend/internal/handler/auth_handler_test.go`
- [ ] `backend/internal/handler/auth_handler.go`
- [ ] `backend/internal/handler/batch_configs.go`
- [ ] `backend/internal/handler/batch_handler.go`
- [ ] `backend/internal/handler/brand_import_test.go`

### B14 [ ] — 19 文件
- [ ] `backend/internal/handler/captcha_handler_test.go`
- [ ] `backend/internal/handler/captcha_handler.go`
- [ ] `backend/internal/handler/certificate_library_handler_test.go`
- [ ] `backend/internal/handler/certificate_library_handler.go`
- [ ] `backend/internal/handler/certification_handler.go`
- [ ] `backend/internal/handler/certification_model_handler.go`
- [ ] `backend/internal/handler/citation_stats_ability_cert_test.go`
- [ ] `backend/internal/handler/citation_stats_test.go`
- [ ] `backend/internal/handler/common.go`
- [ ] `backend/internal/handler/community_handler_test.go`
- [ ] `backend/internal/handler/community_handler.go`
- [ ] `backend/internal/handler/content_actions.go`
- [ ] `backend/internal/handler/course_clone_handler.go`
- [ ] `backend/internal/handler/course_export_handler.go`
- [ ] `backend/internal/handler/course_handler.go`
- [ ] `backend/internal/handler/course_import_handler.go`
- [ ] `backend/internal/handler/course_import_test.go`
- [ ] `backend/internal/handler/course_knowledge_names_test.go`
- [ ] `backend/internal/handler/course_node_handler.go`

### B15 [ ] — 19 文件
- [ ] `backend/internal/handler/course_node_usage_window_test.go`
- [ ] `backend/internal/handler/course_resource_handler.go`
- [ ] `backend/internal/handler/crud.go`
- [ ] `backend/internal/handler/edge_case_test.go`
- [ ] `backend/internal/handler/error_codes_test.go`
- [ ] `backend/internal/handler/error_codes.go`
- [ ] `backend/internal/handler/error_log_test.go`
- [ ] `backend/internal/handler/evaluation_handler_test.go`
- [ ] `backend/internal/handler/evaluation_import_test.go`
- [ ] `backend/internal/handler/evaluation_result_handler.go`
- [ ] `backend/internal/handler/exam_export_handler.go`
- [ ] `backend/internal/handler/exam_handler.go`
- [ ] `backend/internal/handler/exam_import_handler.go`
- [ ] `backend/internal/handler/exam_result_handler.go`
- [ ] `backend/internal/handler/exam_retake_policy_test.go`
- [ ] `backend/internal/handler/exam_usage_flow_test.go`
- [ ] `backend/internal/handler/exam_usage_handler.go`
- [ ] `backend/internal/handler/exam_usage_visibility_test.go`
- [ ] `backend/internal/handler/expert_grant_flow_test.go`

### B16 [ ] — 18 文件
- [ ] `backend/internal/handler/favorites_handler_test.go`
- [ ] `backend/internal/handler/favorites_handler.go`
- [ ] `backend/internal/handler/file_handler_test.go`
- [ ] `backend/internal/handler/file_handler.go`
- [ ] `backend/internal/handler/granular_course_export_handler.go`
- [ ] `backend/internal/handler/granular_course_import_handler.go`
- [ ] `backend/internal/handler/hybrid_grading_writeback_test.go`
- [ ] `backend/internal/handler/hybrid_module_handler.go`
- [ ] `backend/internal/handler/import_common_test.go`
- [ ] `backend/internal/handler/import_common.go`
- [ ] `backend/internal/handler/import_export_handler.go`
- [ ] `backend/internal/handler/import_rename_test.go`
- [ ] `backend/internal/handler/industry_handler.go`
- [ ] `backend/internal/handler/job_ability_result_handler_test.go`
- [ ] `backend/internal/handler/job_ability_result_handler.go`
- [ ] `backend/internal/handler/job_advanced_test.go`
- [ ] `backend/internal/handler/job_banner_handler.go`
- [ ] `backend/internal/handler/job_handler_test.go`

### B17 [ ] — 18 文件
- [ ] `backend/internal/handler/knowledge_point_handler.go`
- [ ] `backend/internal/handler/landing_handler_test.go`
- [ ] `backend/internal/handler/landing_handler.go`
- [ ] `backend/internal/handler/learn_road_handler.go`
- [ ] `backend/internal/handler/lesson_batch_test.go`
- [ ] `backend/internal/handler/lesson_behavior_handler.go`
- [ ] `backend/internal/handler/lesson_handler_test.go`
- [ ] `backend/internal/handler/log_handler.go`
- [ ] `backend/internal/handler/major_handler.go`
- [ ] `backend/internal/handler/node_evaluation_result_handler.go`
- [ ] `backend/internal/handler/node_quiz_handler.go`
- [ ] `backend/internal/handler/node_resource_handler.go`
- [ ] `backend/internal/handler/on_site_question_library_handler_test.go`
- [ ] `backend/internal/handler/on_site_question_library_handler.go`
- [ ] `backend/internal/handler/org_handler_test.go`
- [ ] `backend/internal/handler/org_handler.go`
- [ ] `backend/internal/handler/org_type_handler.go`
- [ ] `backend/internal/handler/partner_cobuild_handler_test.go`

### B18 [ ] — 11 文件
- [ ] `backend/internal/handler/partner_cobuild_handler.go`
- [ ] `backend/internal/handler/partner_employment_handler.go`
- [ ] `backend/internal/handler/partner_handler_test.go`
- [ ] `backend/internal/handler/partner_handler.go`
- [ ] `backend/internal/handler/period_slot_replace_test.go`
- [ ] `backend/internal/handler/point_levels_handler_test.go`
- [ ] `backend/internal/handler/portal_handler.go`
- [ ] `backend/internal/handler/portal_handlers_test.go`
- [ ] `backend/internal/handler/portal_learning_test.go`
- [ ] `backend/internal/handler/portal_workspace_test.go`
- [ ] `backend/internal/handler/portrait_dashboard_test.go`

### B19 [ ] — 27 文件
- [ ] `backend/internal/handler/position_ability_handler.go`
- [ ] `backend/internal/handler/position_certificate_handler.go`
- [ ] `backend/internal/handler/position_clone_handler.go`
- [ ] `backend/internal/handler/position_delete_cleanup_test.go`
- [ ] `backend/internal/handler/position_export_handler.go`
- [ ] `backend/internal/handler/position_handler.go`
- [ ] `backend/internal/handler/position_import_handler.go`
- [ ] `backend/internal/handler/position_import_test.go`
- [ ] `backend/internal/handler/position_responsibility_handler.go`
- [ ] `backend/internal/handler/position_stats_test.go`
- [ ] `backend/internal/handler/position_tenant_isolation_test.go`
- [ ] `backend/internal/handler/program_course_import_handler.go`
- [ ] `backend/internal/handler/question_bank_export_handler.go`
- [ ] `backend/internal/handler/question_bank_handler.go`
- [ ] `backend/internal/handler/question_bank_import_handler.go`
- [ ] `backend/internal/handler/question_export_handler.go`
- [ ] `backend/internal/handler/question_handler.go`
- [ ] `backend/internal/handler/question_import_handler.go`
- [ ] `backend/internal/handler/random_draw_question_handler.go`
- [ ] `backend/internal/handler/recommend_handler.go`
- [ ] `backend/internal/handler/resource_code_handler.go`
- [ ] `backend/internal/handler/resource_export_handler.go`
- [ ] `backend/internal/handler/resource_import_handler.go`
- [ ] `backend/internal/handler/resource_library_handler_test.go`
- [ ] `backend/internal/handler/resource_library_handler.go`
- [ ] `backend/internal/handler/role_handler_test.go`
- [ ] `backend/internal/handler/role_handler.go`

### B20 [ ] — 19 文件
- [ ] `backend/internal/handler/role_isolation_test.go`
- [ ] `backend/internal/handler/scenario_clone_handler.go`
- [ ] `backend/internal/handler/scenario_export_handler.go`
- [ ] `backend/internal/handler/scenario_grade_handler.go`
- [ ] `backend/internal/handler/scenario_handler.go`
- [ ] `backend/internal/handler/scenario_import_eval_method_test.go`
- [ ] `backend/internal/handler/scenario_import_eval_weight_test.go`
- [ ] `backend/internal/handler/scenario_import_handler.go`
- [ ] `backend/internal/handler/scenario_import_resource_type_test.go`
- [ ] `backend/internal/handler/scenario_task_handler.go`
- [ ] `backend/internal/handler/scenario_weight_handler.go`
- [ ] `backend/internal/handler/scene_handler_test.go`
- [ ] `backend/internal/handler/scene_task_ability_names_test.go`
- [ ] `backend/internal/handler/scene_task_knowledge_names_test.go`
- [ ] `backend/internal/handler/schedule_import_handler.go`
- [ ] `backend/internal/handler/scheduling_handler.go`
- [ ] `backend/internal/handler/settings_handler_test.go`
- [ ] `backend/internal/handler/settings_handler.go`
- [ ] `backend/internal/handler/snapshot_handler_test.go`

### B21 [ ] — 22 文件
- [ ] `backend/internal/handler/snapshot_handler.go`
- [ ] `backend/internal/handler/staff_title_handler_test.go`
- [ ] `backend/internal/handler/staff_title_handler.go`
- [ ] `backend/internal/handler/stats_handler.go`
- [ ] `backend/internal/handler/student_honor_handler.go`
- [ ] `backend/internal/handler/student_honor_test.go`
- [ ] `backend/internal/handler/student_portrait_handler.go`
- [ ] `backend/internal/handler/subscription_admin_ai_test.go`
- [ ] `backend/internal/handler/subscription_handler.go`
- [ ] `backend/internal/handler/tag_filter_regression_test.go`
- [ ] `backend/internal/handler/tag_handler_test.go`
- [ ] `backend/internal/handler/tag_handler.go`
- [ ] `backend/internal/handler/task_auto_exam_naming_test.go`
- [ ] `backend/internal/handler/task_evaluation_handler.go`
- [ ] `backend/internal/handler/task_knowledge_ability_handler.go`
- [ ] `backend/internal/handler/task_resource_handler.go`
- [ ] `backend/internal/handler/teaching_plan_export_handler_test.go`
- [ ] `backend/internal/handler/teaching_plan_export_handler.go`
- [ ] `backend/internal/handler/teaching_plan_generate_classes_test.go`
- [ ] `backend/internal/handler/teaching_plan_handler_test.go`
- [ ] `backend/internal/handler/teaching_plan_handler.go`
- [ ] `backend/internal/handler/template_handler.go`

### B22 [ ] — 11 文件
- [ ] `backend/internal/handler/tenant_handler_test.go`
- [ ] `backend/internal/handler/tenant_handler.go`
- [ ] `backend/internal/handler/tenant_validity_test.go`
- [ ] `backend/internal/handler/testhelper/setup.go`
- [ ] `backend/internal/handler/training_program_handler.go`
- [ ] `backend/internal/handler/user_extension_field_handler.go`
- [ ] `backend/internal/handler/user_management_handler_test.go`
- [ ] `backend/internal/handler/user_management_handler.go`
- [ ] `backend/internal/handler/user_relation_handler.go`
- [ ] `backend/internal/handler/workflow_handler_test.go`
- [ ] `backend/internal/handler/workflow_handler.go`

### B23 [ ] — 2 文件
- [ ] `backend/internal/mask/mask_test.go`
- [ ] `backend/internal/mask/mask.go`

### B24 [ ] — 1 文件
- [ ] `backend/internal/metrics/metrics.go`

### B25 [ ] — 12 文件
- [ ] `backend/internal/middleware/auth_test.go`
- [ ] `backend/internal/middleware/auth.go`
- [ ] `backend/internal/middleware/oplog_buffer.go`
- [ ] `backend/internal/middleware/oplog_test.go`
- [ ] `backend/internal/middleware/oplog.go`
- [ ] `backend/internal/middleware/platform_test.go`
- [ ] `backend/internal/middleware/platform.go`
- [ ] `backend/internal/middleware/rbac_alliance_test.go`
- [ ] `backend/internal/middleware/rbac_permissions_test.go`
- [ ] `backend/internal/middleware/rbac.go`
- [ ] `backend/internal/middleware/session_test.go`
- [ ] `backend/internal/middleware/tenant.go`

### B26 [ ] — 14 文件
- [ ] `backend/internal/router/handlers.go`
- [ ] `backend/internal/router/router_audit_test.go`
- [ ] `backend/internal/router/router_dup_test.go`
- [ ] `backend/internal/router/router.go`
- [ ] `backend/internal/router/routes_affairs_test.go`
- [ ] `backend/internal/router/routes_affairs.go`
- [ ] `backend/internal/router/routes_ai_center.go`
- [ ] `backend/internal/router/routes_evaluation.go`
- [ ] `backend/internal/router/routes_job.go`
- [ ] `backend/internal/router/routes_lesson.go`
- [ ] `backend/internal/router/routes_library.go`
- [ ] `backend/internal/router/routes_partner.go`
- [ ] `backend/internal/router/routes_scene.go`
- [ ] `backend/internal/router/routes.go`

### B27 [ ] — 1 文件
- [ ] `backend/internal/scheduler/scheduler.go`

### B28 [ ] — 18 文件
- [ ] `backend/internal/service/ability.go`
- [ ] `backend/internal/service/affairs_config_import.go`
- [ ] `backend/internal/service/affairs_plan.go`
- [ ] `backend/internal/service/affairs.go`
- [ ] `backend/internal/service/ai_center_admin.go`
- [ ] `backend/internal/service/ai_center_agent.go`
- [ ] `backend/internal/service/ai_center_doc.go`
- [ ] `backend/internal/service/ai_center_kb.go`
- [ ] `backend/internal/service/ai_center_retrieval.go`
- [ ] `backend/internal/service/ai_center_test.go`
- [ ] `backend/internal/service/ai_center_v22.go`
- [ ] `backend/internal/service/ai_guard_test.go`
- [ ] `backend/internal/service/ai_position_test.go`
- [ ] `backend/internal/service/ai_position.go`
- [ ] `backend/internal/service/ai_scenario_test.go`
- [ ] `backend/internal/service/ai_scenario.go`
- [ ] `backend/internal/service/ai_stream.go`
- [ ] `backend/internal/service/ai_test.go`

### B29 [ ] — 31 文件
- [ ] `backend/internal/service/ai.go`
- [ ] `backend/internal/service/alliance_mentor.go`
- [ ] `backend/internal/service/approval_service.go`
- [ ] `backend/internal/service/approval.go`
- [ ] `backend/internal/service/auth.go`
- [ ] `backend/internal/service/banner.go`
- [ ] `backend/internal/service/batch_shared.go`
- [ ] `backend/internal/service/batch.go`
- [ ] `backend/internal/service/captcha_test.go`
- [ ] `backend/internal/service/captcha.go`
- [ ] `backend/internal/service/community.go`
- [ ] `backend/internal/service/course_export.go`
- [ ] `backend/internal/service/course_import.go`
- [ ] `backend/internal/service/csv_import.go`
- [ ] `backend/internal/service/evaluation_ability_result.go`
- [ ] `backend/internal/service/evaluation_appeal.go`
- [ ] `backend/internal/service/evaluation_cert.go`
- [ ] `backend/internal/service/evaluation_common.go`
- [ ] `backend/internal/service/evaluation_exam.go`
- [ ] `backend/internal/service/evaluation_portrait.go`
- [ ] `backend/internal/service/evaluation_question.go`
- [ ] `backend/internal/service/evaluation_result.go`
- [ ] `backend/internal/service/evaluation.go`
- [ ] `backend/internal/service/exam_import.go`
- [ ] `backend/internal/service/export_helpers.go`
- [ ] `backend/internal/service/favorites.go`
- [ ] `backend/internal/service/granular_course_import.go`
- [ ] `backend/internal/service/hybrid_module.go`
- [ ] `backend/internal/service/import_helpers_test.go`
- [ ] `backend/internal/service/import_helpers.go`
- [ ] `backend/internal/service/job_ability_aggregator.go`

### B30 [ ] — 21 文件
- [ ] `backend/internal/service/job_ability_levels_test.go`
- [ ] `backend/internal/service/landing.go`
- [ ] `backend/internal/service/lesson_behavior_aggregate.go`
- [ ] `backend/internal/service/lesson_behavior.go`
- [ ] `backend/internal/service/lesson_content.go`
- [ ] `backend/internal/service/log.go`
- [ ] `backend/internal/service/node_evaluation_result.go`
- [ ] `backend/internal/service/org.go`
- [ ] `backend/internal/service/partner_cobuild.go`
- [ ] `backend/internal/service/partner.go`
- [ ] `backend/internal/service/portal.go`
- [ ] `backend/internal/service/position_clone.go`
- [ ] `backend/internal/service/position_config.go`
- [ ] `backend/internal/service/position_export.go`
- [ ] `backend/internal/service/position_import.go`
- [ ] `backend/internal/service/position.go`
- [ ] `backend/internal/service/program_course_import.go`
- [ ] `backend/internal/service/question_bank_export.go`
- [ ] `backend/internal/service/question_bank_import.go`
- [ ] `backend/internal/service/question_export.go`
- [ ] `backend/internal/service/question_import.go`

### B31 [ ] — 24 文件
- [ ] `backend/internal/service/recommend.go`
- [ ] `backend/internal/service/resource_binding.go`
- [ ] `backend/internal/service/resource_code.go`
- [ ] `backend/internal/service/resource_export.go`
- [ ] `backend/internal/service/resource_import.go`
- [ ] `backend/internal/service/resource.go`
- [ ] `backend/internal/service/scenario_config.go`
- [ ] `backend/internal/service/scenario_export.go`
- [ ] `backend/internal/service/scenario_import.go`
- [ ] `backend/internal/service/scenario.go`
- [ ] `backend/internal/service/schedule_import_test.go`
- [ ] `backend/internal/service/schedule_import.go`
- [ ] `backend/internal/service/service.go`
- [ ] `backend/internal/service/snapshot.go`
- [ ] `backend/internal/service/subscription.go`
- [ ] `backend/internal/service/tag_service.go`
- [ ] `backend/internal/service/task_evaluation.go`
- [ ] `backend/internal/service/teaching_plan.go`
- [ ] `backend/internal/service/tenant_admin.go`
- [ ] `backend/internal/service/tenant.go`
- [ ] `backend/internal/service/term.go`
- [ ] `backend/internal/service/training_program.go`
- [ ] `backend/internal/service/user_extension_field.go`
- [ ] `backend/internal/service/user_relation.go`

### B32 [ ] — 3 文件
- [ ] `backend/internal/service/user.go`
- [ ] `backend/internal/service/workflow.go`
- [ ] `backend/internal/service/workspace_stats.go`

### B33 [ ] — 16 文件
- [ ] `backend/internal/store/abilities.go`
- [ ] `backend/internal/store/ability_domains.go`
- [ ] `backend/internal/store/ai_center.go`
- [ ] `backend/internal/store/ai_config.go`
- [ ] `backend/internal/store/ai_usage.go`
- [ ] `backend/internal/store/alliance_achievement_store.go`
- [ ] `backend/internal/store/alliance_agreement_store.go`
- [ ] `backend/internal/store/alliance_brand_import.go`
- [ ] `backend/internal/store/alliance_brand_store.go`
- [ ] `backend/internal/store/alliance_dictionary_store.go`
- [ ] `backend/internal/store/alliance_employment_store_test.go`
- [ ] `backend/internal/store/alliance_employment_store.go`
- [ ] `backend/internal/store/alliance_enterprise_link_store_test.go`
- [ ] `backend/internal/store/alliance_enterprise_link_store.go`
- [ ] `backend/internal/store/alliance_enterprise_store_test.go`
- [ ] `backend/internal/store/alliance_enterprise_store.go`

### B34 [ ] — 20 文件
- [ ] `backend/internal/store/alliance_expert_store.go`
- [ ] `backend/internal/store/alliance_grant_store_test.go`
- [ ] `backend/internal/store/alliance_grant_store.go`
- [ ] `backend/internal/store/alliance_job_brand_store_test.go`
- [ ] `backend/internal/store/alliance_permission_store.go`
- [ ] `backend/internal/store/alliance_project_store.go`
- [ ] `backend/internal/store/alliance_source_edit_store.go`
- [ ] `backend/internal/store/alliance_store.go`
- [ ] `backend/internal/store/alliance_talent_rank_store_test.go`
- [ ] `backend/internal/store/alliance_talent_rank_store.go`
- [ ] `backend/internal/store/appeal.go`
- [ ] `backend/internal/store/approvals_test.go`
- [ ] `backend/internal/store/approvals.go`
- [ ] `backend/internal/store/auth.go`
- [ ] `backend/internal/store/banners.go`
- [ ] `backend/internal/store/batch_configs.go`
- [ ] `backend/internal/store/batches.go`
- [ ] `backend/internal/store/certificate_library.go`
- [ ] `backend/internal/store/certifications_test.go`
- [ ] `backend/internal/store/certifications.go`

### B35 [ ] — 17 文件
- [ ] `backend/internal/store/citation_stats.go`
- [ ] `backend/internal/store/community.go`
- [ ] `backend/internal/store/content_actions_test.go`
- [ ] `backend/internal/store/content_actions.go`
- [ ] `backend/internal/store/course_assessments.go`
- [ ] `backend/internal/store/course_clone.go`
- [ ] `backend/internal/store/course_import_export.go`
- [ ] `backend/internal/store/course_nodes.go`
- [ ] `backend/internal/store/courses.go`
- [ ] `backend/internal/store/dict_store.go`
- [ ] `backend/internal/store/entity_code_test.go`
- [ ] `backend/internal/store/entity_code.go`
- [ ] `backend/internal/store/evaluation_results_ownonly_test.go`
- [ ] `backend/internal/store/evaluation_results.go`
- [ ] `backend/internal/store/exam_granular_import_export.go`
- [ ] `backend/internal/store/exam_questions.go`
- [ ] `backend/internal/store/exam_results.go`

### B36 [ ] — 23 文件
- [ ] `backend/internal/store/exam_usage_config.go`
- [ ] `backend/internal/store/exam_usages.go`
- [ ] `backend/internal/store/exams.go`
- [ ] `backend/internal/store/favorites.go`
- [ ] `backend/internal/store/honors.go`
- [ ] `backend/internal/store/hybrid_modules.go`
- [ ] `backend/internal/store/imports_test.go`
- [ ] `backend/internal/store/imports.go`
- [ ] `backend/internal/store/industries.go`
- [ ] `backend/internal/store/job_ability_results.go`
- [ ] `backend/internal/store/landing.go`
- [ ] `backend/internal/store/learn_roads.go`
- [ ] `backend/internal/store/lesson_behaviors.go`
- [ ] `backend/internal/store/lesson_content.go`
- [ ] `backend/internal/store/logs.go`
- [ ] `backend/internal/store/majors.go`
- [ ] `backend/internal/store/node_evaluation_results.go`
- [ ] `backend/internal/store/node_quizzes.go`
- [ ] `backend/internal/store/on_site_question_library.go`
- [ ] `backend/internal/store/org_types.go`
- [ ] `backend/internal/store/organizations.go`
- [ ] `backend/internal/store/partner_cooperation_detail_test.go`
- [ ] `backend/internal/store/partner_store.go`

### B37 [ ] — 13 文件
- [ ] `backend/internal/store/platform_settings_store.go`
- [ ] `backend/internal/store/portal.go`
- [ ] `backend/internal/store/position_bindings.go`
- [ ] `backend/internal/store/position_certificates.go`
- [ ] `backend/internal/store/position_clone.go`
- [ ] `backend/internal/store/position_import_export.go`
- [ ] `backend/internal/store/positions.go`
- [ ] `backend/internal/store/query_normal_test.go`
- [ ] `backend/internal/store/query_test.go`
- [ ] `backend/internal/store/query.go`
- [ ] `backend/internal/store/question_banks.go`
- [ ] `backend/internal/store/question_import_export.go`
- [ ] `backend/internal/store/questions.go`

### B38 [ ] — 14 文件
- [ ] `backend/internal/store/random_draw_questions.go`
- [ ] `backend/internal/store/recommends.go`
- [ ] `backend/internal/store/resource_bindings.go`
- [ ] `backend/internal/store/resource_codes.go`
- [ ] `backend/internal/store/resource_import_export.go`
- [ ] `backend/internal/store/resource_library.go`
- [ ] `backend/internal/store/roles.go`
- [ ] `backend/internal/store/scenario_clone.go`
- [ ] `backend/internal/store/scenario_configs.go`
- [ ] `backend/internal/store/scenario_import_export.go`
- [ ] `backend/internal/store/scenario_tasks.go`
- [ ] `backend/internal/store/scenarios.go`
- [ ] `backend/internal/store/scheduling_test.go`
- [ ] `backend/internal/store/scheduling.go`

### B39 [ ] — 13 文件
- [ ] `backend/internal/store/snapshot_builders.go`
- [ ] `backend/internal/store/snapshot_grading_test.go`
- [ ] `backend/internal/store/snapshot_stamping_test.go`
- [ ] `backend/internal/store/snapshots_test.go`
- [ ] `backend/internal/store/snapshots.go`
- [ ] `backend/internal/store/staff_titles.go`
- [ ] `backend/internal/store/store_tx_test.go`
- [ ] `backend/internal/store/store.go`
- [ ] `backend/internal/store/student_portraits.go`
- [ ] `backend/internal/store/subscriptions_test.go`
- [ ] `backend/internal/store/subscriptions.go`
- [ ] `backend/internal/store/tags.go`
- [ ] `backend/internal/store/task_evaluation.go`

### B40 [ ] — 12 文件
- [ ] `backend/internal/store/teaching_plans.go`
- [ ] `backend/internal/store/template_data.go`
- [ ] `backend/internal/store/tenant_admins.go`
- [ ] `backend/internal/store/tenants.go`
- [ ] `backend/internal/store/terms.go`
- [ ] `backend/internal/store/training_programs.go`
- [ ] `backend/internal/store/user_extension_fields.go`
- [ ] `backend/internal/store/user_relations.go`
- [ ] `backend/internal/store/users.go`
- [ ] `backend/internal/store/whitelist_consistency_test.go`
- [ ] `backend/internal/store/workflows_list_test.go`
- [ ] `backend/internal/store/workflows.go`

## 前端分组

### F01 [ ] — 21 文件
- [ ] `apps/edu/app/affairs/approvals/page.tsx`
- [ ] `apps/edu/app/affairs/batches/page.tsx`
- [ ] `apps/edu/app/affairs/config/page.tsx`
- [ ] `apps/edu/app/affairs/layout.tsx`
- [ ] `apps/edu/app/affairs/majors/page.tsx`
- [ ] `apps/edu/app/affairs/org-structure/page.tsx`
- [ ] `apps/edu/app/affairs/positions/page.tsx`
- [ ] `apps/edu/app/affairs/programs/[id]/_components/courses-tab.tsx`
- [ ] `apps/edu/app/affairs/programs/[id]/_components/program-course-import-dialog.tsx`
- [ ] `apps/edu/app/affairs/programs/[id]/page.tsx`
- [ ] `apps/edu/app/affairs/programs/page.tsx`
- [ ] `apps/edu/app/affairs/relations/page.tsx`
- [ ] `apps/edu/app/affairs/scheduling/_components/affairs-config-import-dialog.tsx`
- [ ] `apps/edu/app/affairs/scheduling/_components/date-range-picker.tsx`
- [ ] `apps/edu/app/affairs/scheduling/_components/schedule-edit-dialog.tsx`
- [ ] `apps/edu/app/affairs/scheduling/_components/schedule-grid-tab.tsx`
- [ ] `apps/edu/app/affairs/scheduling/_components/schedule-import-bar.tsx`
- [ ] `apps/edu/app/affairs/scheduling/_components/timetable-view-tab.tsx`
- [ ] `apps/edu/app/affairs/scheduling/_components/venue-period-config-tab.tsx`
- [ ] `apps/edu/app/affairs/scheduling/page.tsx`
- [ ] `apps/edu/app/affairs/student-portraits/page.tsx`

### F02 [ ] — 19 文件
- [ ] `apps/edu/app/affairs/students/page.tsx`
- [ ] `apps/edu/app/affairs/teachers/page.tsx`
- [ ] `apps/edu/app/affairs/teaching-plans/_components/generate-plan-dialog.tsx`
- [ ] `apps/edu/app/affairs/teaching-plans/[id]/_components/entry-type-badge.tsx`
- [ ] `apps/edu/app/affairs/teaching-plans/[id]/page.tsx`
- [ ] `apps/edu/app/affairs/teaching-plans/page.tsx`
- [ ] `apps/edu/app/affairs/workflows/page.tsx`
- [ ] `apps/edu/app/changelog/page.tsx`
- [ ] `apps/edu/app/error.tsx`
- [ ] `apps/edu/app/evaluation/approvals/page.tsx`
- [ ] `apps/edu/app/evaluation/batches/page.tsx`
- [ ] `apps/edu/app/evaluation/exam-usage/page.tsx`
- [ ] `apps/edu/app/evaluation/exam-usage/results/page.tsx`
- [ ] `apps/edu/app/evaluation/exams/[id]/page.tsx`
- [ ] `apps/edu/app/evaluation/exams/page.tsx`
- [ ] `apps/edu/app/evaluation/job-ability/config/[id]/_components/combined-config-dialog.tsx`
- [ ] `apps/edu/app/evaluation/job-ability/config/[id]/_components/level-config-dialog.tsx`
- [ ] `apps/edu/app/evaluation/job-ability/config/[id]/_components/position-weight-config.tsx`
- [ ] `apps/edu/app/evaluation/job-ability/config/[id]/_components/weight-config-dialog.tsx`

### F03 [ ] — 13 文件
- [ ] `apps/edu/app/evaluation/job-ability/config/[id]/page.tsx`
- [ ] `apps/edu/app/evaluation/job-ability/page.tsx`
- [ ] `apps/edu/app/evaluation/job-ability/results/page.tsx`
- [ ] `apps/edu/app/evaluation/landing/banks/[id]/page.tsx`
- [ ] `apps/edu/app/evaluation/landing/exam-center/page.tsx`
- [ ] `apps/edu/app/evaluation/landing/exams/[id]/page.tsx`
- [ ] `apps/edu/app/evaluation/landing/exams/page.tsx`
- [ ] `apps/edu/app/evaluation/landing/layout.tsx`
- [ ] `apps/edu/app/evaluation/landing/page.tsx`
- [ ] `apps/edu/app/evaluation/layout.tsx`
- [ ] `apps/edu/app/evaluation/lesson-results/[id]/page.tsx`
- [ ] `apps/edu/app/evaluation/lesson-results/daily-exams/[resultId]/page.tsx`
- [ ] `apps/edu/app/evaluation/lesson-results/daily-exams/page.tsx`

### F04 [ ] — 12 文件
- [ ] `apps/edu/app/evaluation/lesson-results/page.tsx`
- [ ] `apps/edu/app/evaluation/question-banks/[id]/page.tsx`
- [ ] `apps/edu/app/evaluation/question-banks/page.tsx`
- [ ] `apps/edu/app/evaluation/scene-results/[id]/page.tsx`
- [ ] `apps/edu/app/evaluation/scene-results/page.tsx`
- [ ] `apps/edu/app/evaluation/workflows/page.tsx`
- [ ] `apps/edu/app/global-error.tsx`
- [ ] `apps/edu/app/job/approvals/page.tsx`
- [ ] `apps/edu/app/job/archive/page.tsx`
- [ ] `apps/edu/app/job/batches/page.tsx`
- [ ] `apps/edu/app/job/landing/[id]/learn/page.tsx`
- [ ] `apps/edu/app/job/landing/[id]/page.tsx`

### F05 [ ] — 22 文件
- [ ] `apps/edu/app/job/landing/layout.tsx`
- [ ] `apps/edu/app/job/landing/page.tsx`
- [ ] `apps/edu/app/job/layout.tsx`
- [ ] `apps/edu/app/job/learn-roads/page.tsx`
- [ ] `apps/edu/app/job/positions/[id]/edit/page.tsx`
- [ ] `apps/edu/app/job/positions/page.tsx`
- [ ] `apps/edu/app/job/recommend/page.tsx`
- [ ] `apps/edu/app/job/workflows/page.tsx`
- [ ] `apps/edu/app/layout.tsx`
- [ ] `apps/edu/app/lesson/admin/_components/ability/ability-point-selector.tsx`
- [ ] `apps/edu/app/lesson/admin/_components/assessment/evaluation-method-selector.tsx`
- [ ] `apps/edu/app/lesson/admin/_components/common/rich-text-editor.tsx`
- [ ] `apps/edu/app/lesson/admin/_components/courses/course-admin-page.tsx`
- [ ] `apps/edu/app/lesson/admin/_components/courses/course-list.tsx`
- [ ] `apps/edu/app/lesson/admin/_components/knowledge/knowledge-selector.tsx`
- [ ] `apps/edu/app/lesson/admin/_components/resources/resource-selector.tsx`
- [ ] `apps/edu/app/lesson/admin/approvals/page.tsx`
- [ ] `apps/edu/app/lesson/admin/archive/page.tsx`
- [ ] `apps/edu/app/lesson/admin/batches/page.tsx`
- [ ] `apps/edu/app/lesson/admin/granular/add/page.tsx`
- [ ] `apps/edu/app/lesson/admin/granular/page.tsx`
- [ ] `apps/edu/app/lesson/admin/hybrid/add/_components/atomic-modules.tsx`

### F06 [ ] — 11 文件
- [ ] `apps/edu/app/lesson/admin/hybrid/add/_components/module-preview.tsx`
- [ ] `apps/edu/app/lesson/admin/hybrid/add/_components/module-serialize.test.ts`
- [ ] `apps/edu/app/lesson/admin/hybrid/add/_components/module-serialize.ts`
- [ ] `apps/edu/app/lesson/admin/hybrid/add/page.tsx`
- [ ] `apps/edu/app/lesson/admin/hybrid/page.tsx`
- [ ] `apps/edu/app/lesson/admin/layout.tsx`
- [ ] `apps/edu/app/lesson/admin/system/add/_components/CourseNodeTree.tsx`
- [ ] `apps/edu/app/lesson/admin/system/add/_components/lesson-save-roundtrip.test.ts`
- [ ] `apps/edu/app/lesson/admin/system/add/_components/lesson-save-utils.ts`
- [ ] `apps/edu/app/lesson/admin/system/add/_components/PublishCheckPanel.tsx`
- [ ] `apps/edu/app/lesson/admin/system/add/page.tsx`

### F07 [ ] — 19 文件
- [ ] `apps/edu/app/lesson/admin/system/page.tsx`
- [ ] `apps/edu/app/lesson/admin/workflows/page.tsx`
- [ ] `apps/edu/app/lesson/landing/[id]/learn/page.tsx`
- [ ] `apps/edu/app/lesson/landing/[id]/page.tsx`
- [ ] `apps/edu/app/lesson/landing/layout.tsx`
- [ ] `apps/edu/app/lesson/landing/page.tsx`
- [ ] `apps/edu/app/lesson/layout.tsx`
- [ ] `apps/edu/app/library/_components/library-page-shell.tsx`
- [ ] `apps/edu/app/library/_components/use-library-crud.ts`
- [ ] `apps/edu/app/library/ability/page.tsx`
- [ ] `apps/edu/app/library/certificates/page.tsx`
- [ ] `apps/edu/app/library/knowledge/_components/granular-lesson-select-dialog.tsx`
- [ ] `apps/edu/app/library/knowledge/_components/knowledge-point-form-dialog.tsx`
- [ ] `apps/edu/app/library/knowledge/page.tsx`
- [ ] `apps/edu/app/library/landing/layout.tsx`
- [ ] `apps/edu/app/library/landing/page.tsx`
- [ ] `apps/edu/app/library/layout.tsx`
- [ ] `apps/edu/app/library/my-resources/page.tsx`
- [ ] `apps/edu/app/library/questions/page.tsx`

### F08 [ ] — 11 文件
- [ ] `apps/edu/app/library/resources/_components/resource-batch-import-dialog.tsx`
- [ ] `apps/edu/app/library/resources/_components/resource-upload-zone.tsx`
- [ ] `apps/edu/app/library/resources/_components/resources-page.tsx`
- [ ] `apps/edu/app/library/resources/_components/use-resource-crud.ts`
- [ ] `apps/edu/app/library/resources/[type]/page.tsx`
- [ ] `apps/edu/app/library/tags/page.tsx`
- [ ] `apps/edu/app/not-found.tsx`
- [ ] `apps/edu/app/partner/co-build/positions/[id]/edit/page.tsx`
- [ ] `apps/edu/app/partner/co-build/positions/page.tsx`
- [ ] `apps/edu/app/partner/co-build/scenes/[id]/edit/page.tsx`
- [ ] `apps/edu/app/partner/co-build/scenes/[id]/edit/tasks/page.tsx`

### F09 [ ] — 22 文件
- [ ] `apps/edu/app/partner/co-build/scenes/page.tsx`
- [ ] `apps/edu/app/partner/cooperation/page.tsx`
- [ ] `apps/edu/app/partner/employment-jobs/_components/employment-job-form.tsx`
- [ ] `apps/edu/app/partner/employment-jobs/[id]/edit/page.tsx`
- [ ] `apps/edu/app/partner/employment-jobs/[id]/page.tsx`
- [ ] `apps/edu/app/partner/employment-jobs/new/page.tsx`
- [ ] `apps/edu/app/partner/employment-jobs/page.tsx`
- [ ] `apps/edu/app/partner/employment-projects/[id]/page.tsx`
- [ ] `apps/edu/app/partner/employment-projects/page.tsx`
- [ ] `apps/edu/app/partner/enterprise/page.tsx`
- [ ] `apps/edu/app/partner/experts/_components/expert-form.tsx`
- [ ] `apps/edu/app/partner/experts/[id]/edit/page.tsx`
- [ ] `apps/edu/app/partner/experts/[id]/page.tsx`
- [ ] `apps/edu/app/partner/experts/new/page.tsx`
- [ ] `apps/edu/app/partner/experts/page.tsx`
- [ ] `apps/edu/app/partner/layout.tsx`
- [ ] `apps/edu/app/partner/login/page.tsx`
- [ ] `apps/edu/app/partner/page.tsx`
- [ ] `apps/edu/app/partner/schools/page.tsx`
- [ ] `apps/edu/app/partner/settings/page.tsx`
- [ ] `apps/edu/app/partner/tasks/page.tsx`
- [ ] `apps/edu/app/partner/workspace/page.tsx`

### F10 [ ] — 15 文件
- [ ] `apps/edu/app/portal/alliance/achievements/[id]/page.tsx`
- [ ] `apps/edu/app/portal/alliance/achievements/page.tsx`
- [ ] `apps/edu/app/portal/alliance/brands/[id]/page.tsx`
- [ ] `apps/edu/app/portal/alliance/brands/page.tsx`
- [ ] `apps/edu/app/portal/alliance/employment/[id]/page.tsx`
- [ ] `apps/edu/app/portal/alliance/employment/job/[id]/page.tsx`
- [ ] `apps/edu/app/portal/alliance/employment/mine/page.tsx`
- [ ] `apps/edu/app/portal/alliance/employment/page.tsx`
- [ ] `apps/edu/app/portal/alliance/enterprises/[id]/page.tsx`
- [ ] `apps/edu/app/portal/alliance/enterprises/page.tsx`
- [ ] `apps/edu/app/portal/alliance/experts/[id]/page.tsx`
- [ ] `apps/edu/app/portal/alliance/experts/page.tsx`
- [ ] `apps/edu/app/portal/alliance/landing/page.tsx`
- [ ] `apps/edu/app/portal/alliance/layout.tsx`
- [ ] `apps/edu/app/portal/alliance/projects/[id]/page.tsx`

### F11 [ ] — 20 文件
- [ ] `apps/edu/app/portal/alliance/projects/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/_components/favorite-button.tsx`
- [ ] `apps/edu/app/portal/apps/ai/_components/hall-cards.tsx`
- [ ] `apps/edu/app/portal/apps/ai/_components/hall-shell.tsx`
- [ ] `apps/edu/app/portal/apps/ai/_components/source-list.tsx`
- [ ] `apps/edu/app/portal/apps/ai/_components/studio-section.tsx`
- [ ] `apps/edu/app/portal/apps/ai/admin/integrations/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/admin/reviews/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/agents/[id]/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/chat/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/hall/agents/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/hall/kbs/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/kb/[id]/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/landing/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/layout.tsx`
- [ ] `apps/edu/app/portal/apps/ai/square/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/studio/agents/[id]/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/studio/agents/new/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/studio/components/agent-form.tsx`
- [ ] `apps/edu/app/portal/apps/ai/studio/components/agent-preview.tsx`

### F12 [ ] — 20 文件
- [ ] `apps/edu/app/portal/apps/ai/studio/components/ai-status-badge.tsx`
- [ ] `apps/edu/app/portal/apps/ai/studio/kb/[id]/page.tsx`
- [ ] `apps/edu/app/portal/apps/ai/studio/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/achievements/[id]/edit/_components/tag-input.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/achievements/[id]/edit/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/achievements/[id]/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/achievements/new/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/achievements/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/agreements/[id]/edit/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/agreements/[id]/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/agreements/new/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/agreements/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/brands/[id]/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/brands/culture/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/brands/employer/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/brands/job/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/brands/major/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/brands/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/brands/talent/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/brands/teacher/page.tsx`

### F13 [ ] — 12 文件
- [ ] `apps/edu/app/portal/apps/alliance/dictionaries/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/employmentjob/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/employmentproject/[id]/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/employmentproject/new/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/employmentproject/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/enterprises/[id]/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/enterprises/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/experts/[id]/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/experts/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/layout.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/permissions/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/projects/[id]/edit/page.tsx`

### F14 [ ] — 13 文件
- [ ] `apps/edu/app/portal/apps/alliance/projects/[id]/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/projects/new/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/projects/page.tsx`
- [ ] `apps/edu/app/portal/apps/alliance/school/page.tsx`
- [ ] `apps/edu/app/portal/apps/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/layout.tsx`
- [ ] `apps/edu/app/portal/apps/system/logs/login/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/logs/operation/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/org-user/accounts/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/org-user/fields/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/org-user/graduates/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/org-user/org-structure/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/org-user/org-types/page.tsx`

### F15 [ ] — 12 文件
- [ ] `apps/edu/app/portal/apps/system/org-user/positions/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/org-user/relations/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/org-user/roles/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/org-user/students/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/org-user/teachers/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/resource/codes/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/resource/industries/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/resource/majors/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/resource/package/page.tsx`
- [ ] `apps/edu/app/portal/apps/system/tenant/_components/school-admin-manager.tsx`
- [ ] `apps/edu/app/portal/apps/system/tenant/page.tsx`

### F16 [ ] — 16 文件
- [ ] `apps/edu/app/portal/layout.tsx`
- [ ] `apps/edu/app/portal/login/page.tsx`
- [ ] `apps/edu/app/portal/page.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/account-info-form.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/assessment-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/career-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/change-password-form.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/community-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/dashboard-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/grading-iframe-dialog.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/hybrid-grading-dialog.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/learning-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/my-schedule-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/portrait-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/prep-associate-dialog.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/profile-tab.tsx`

### F17 [ ] — 14 文件
- [ ] `apps/edu/app/portal/workspace/_components/school-admin-approvals-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/school-admin-overview-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/school-admin-personnel-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/school-admin-resources-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/section-card.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/stat-card.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/teacher-courses-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/teacher-dashboard-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/teacher-portraits-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/teacher-profile-tab.tsx`
- [ ] `apps/edu/app/portal/workspace/_components/workspace-schedule-grid.tsx`
- [ ] `apps/edu/app/portal/workspace/_data/workspace-student-types.ts`
- [ ] `apps/edu/app/portal/workspace/_data/workspace-teacher-types.ts`
- [ ] `apps/edu/app/portal/workspace/page.tsx`

### F18 [ ] — 17 文件
- [ ] `apps/edu/app/scene/approvals/page.tsx`
- [ ] `apps/edu/app/scene/archive/page.tsx`
- [ ] `apps/edu/app/scene/batches/page.tsx`
- [ ] `apps/edu/app/scene/landing/[id]/learn/page.tsx`
- [ ] `apps/edu/app/scene/landing/[id]/page.tsx`
- [ ] `apps/edu/app/scene/landing/layout.tsx`
- [ ] `apps/edu/app/scene/landing/page.tsx`
- [ ] `apps/edu/app/scene/layout.tsx`
- [ ] `apps/edu/app/scene/page.tsx`
- [ ] `apps/edu/app/scene/scenarios/[id]/edit/page.tsx`
- [ ] `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/ai-task-chain-suggestion.tsx`
- [ ] `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/hooks/use-task-datasets.ts`
- [ ] `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/repro.test.ts`
- [ ] `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-description-card.tsx`
- [ ] `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-info-card.tsx`
- [ ] `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/task-weight-card.tsx`
- [ ] `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/tasks-logic.test.ts`

### F19 [ ] — 6 文件
- [ ] `apps/edu/app/scene/scenarios/[id]/edit/tasks/_components/tasks-logic.tsx`
- [ ] `apps/edu/app/scene/scenarios/[id]/edit/tasks/page.tsx`
- [ ] `apps/edu/app/scene/workflows/page.tsx`
- [ ] `apps/edu/app/superadmin/_components/theme-color-picker.tsx`
- [ ] `apps/edu/app/superadmin/layout.tsx`
- [ ] `apps/edu/app/superadmin/page.tsx`

### F20 [ ] — 12 文件
- [ ] `apps/edu/components/alliance/alliance-detail-shell.tsx`
- [ ] `apps/edu/components/alliance/employer-brand-detail.tsx`
- [ ] `apps/edu/components/alliance/enterprise-detail-view.tsx`
- [ ] `apps/edu/components/alliance/enterprise-profile-form.tsx`
- [ ] `apps/edu/components/alliance/independent-enterprise-form.tsx`
- [ ] `apps/edu/components/alliance/job-brand-dialogs.tsx`
- [ ] `apps/edu/components/alliance/major-brand-detail.tsx`
- [ ] `apps/edu/components/alliance/public-cards.tsx`
- [ ] `apps/edu/components/alliance/public-list-shell.tsx`
- [ ] `apps/edu/components/alliance/related-object-card.tsx`
- [ ] `apps/edu/components/alliance/talent-ranking-panel.tsx`
- [ ] `apps/edu/components/auth-provider.tsx`

### F21 [ ] — 4 文件
- [ ] `apps/edu/components/chunk-error-handler.tsx`
- [ ] `apps/edu/components/evaluation-rules/bank-question-selector-panel.tsx`
- [ ] `apps/edu/components/evaluation-rules/constants.tsx`
- [ ] `apps/edu/components/evaluation-rules/evaluation-rules-editor.tsx`

### F22 [ ] — 18 文件
- [ ] `apps/edu/components/evaluation-rules/exam-activation-config.tsx`
- [ ] `apps/edu/components/evaluation-rules/index.ts`
- [ ] `apps/edu/components/evaluation-rules/shared-defs.ts`
- [ ] `apps/edu/components/evaluation-rules/types.ts`
- [ ] `apps/edu/components/evaluation-rules/utils.ts`
- [ ] `apps/edu/components/evaluation/bank-form-dialog.tsx`
- [ ] `apps/edu/components/evaluation/evaluation-list-table.tsx`
- [ ] `apps/edu/components/evaluation/exam-center-card.tsx`
- [ ] `apps/edu/components/evaluation/exam-form-dialog.tsx`
- [ ] `apps/edu/components/evaluation/manual-question-dialog.tsx`
- [ ] `apps/edu/components/evaluation/question-form-dialog.tsx`
- [ ] `apps/edu/components/evaluation/question-preview.tsx`
- [ ] `apps/edu/components/evaluation/random-question-dialog.tsx`
- [ ] `apps/edu/components/evaluation/score-config-dialog.tsx`
- [ ] `apps/edu/components/global-api-error-handler.tsx`
- [ ] `apps/edu/components/job/position-builder/ai-assist-progress-dialog.tsx`
- [ ] `apps/edu/components/job/position-builder/ai-assisted-2/step3-result-table.tsx`
- [ ] `apps/edu/components/job/position-builder/step-ability-modeling.tsx`

### F23 [ ] — 14 文件
- [ ] `apps/edu/components/job/position-builder/step-basic-info.tsx`
- [ ] `apps/edu/components/job/positions/position-list.tsx`
- [ ] `apps/edu/components/job/student/ability-point-card.tsx`
- [ ] `apps/edu/components/job/student/ability-tree.tsx`
- [ ] `apps/edu/components/job/student/cert-cards.tsx`
- [ ] `apps/edu/components/job/student/competency-standards.tsx`
- [ ] `apps/edu/components/job/student/duty-table.tsx`
- [ ] `apps/edu/components/job/student/job-card.tsx`
- [ ] `apps/edu/components/job/student/job-home.tsx`
- [ ] `apps/edu/components/job/student/knowledge-graph.tsx`
- [ ] `apps/edu/components/job/student/learning-path.tsx`
- [ ] `apps/edu/components/job/student/overview-tab.tsx`
- [ ] `apps/edu/components/job/student/position-header.tsx`
- [ ] `apps/edu/components/job/student/ranking-list.tsx`

### F24 [ ] — 20 文件
- [ ] `apps/edu/components/job/student/scene-list.tsx`
- [ ] `apps/edu/components/job/student/stats-box.tsx`
- [ ] `apps/edu/components/knowledge-graph/graph-data-context.tsx`
- [ ] `apps/edu/components/knowledge-graph/graph-node-detail.tsx`
- [ ] `apps/edu/components/knowledge-graph/knowledge-graph-d3-view.tsx`
- [ ] `apps/edu/components/knowledge-graph/knowledge-graph-shell.tsx`
- [ ] `apps/edu/components/knowledge-graph/knowledge-graph-view.tsx`
- [ ] `apps/edu/components/knowledge-graph/types.ts`
- [ ] `apps/edu/components/lesson/course-evaluation-rules-dialog.tsx`
- [ ] `apps/edu/components/lesson/student/hybrid-modules-view.tsx`
- [ ] `apps/edu/components/lesson/student/knowledge-graph.tsx`
- [ ] `apps/edu/components/partner-auth-provider.tsx`
- [ ] `apps/edu/components/platform-shell/index.ts`
- [ ] `apps/edu/components/platform-shell/PlatformShell.tsx`
- [ ] `apps/edu/components/portal/footer.tsx`
- [ ] `apps/edu/components/portal/mobile-access-dialog.tsx`
- [ ] `apps/edu/components/portal/mobile-access-url.test.ts`
- [ ] `apps/edu/components/portal/mobile-access-url.ts`
- [ ] `apps/edu/components/portal/top-nav.tsx`
- [ ] `apps/edu/components/portal/yi-know-assistant.tsx`

### F25 [ ] — 20 文件
- [ ] `apps/edu/components/providers/data-provider.tsx`
- [ ] `apps/edu/components/scene/scenarios/scenario-list.tsx`
- [ ] `apps/edu/components/scene/student/knowledge-graph.tsx`
- [ ] `apps/edu/components/scene/student/scene-card.tsx`
- [ ] `apps/edu/components/shared/_components/approval-dialogs.tsx`
- [ ] `apps/edu/components/shared/_components/org-filter-tree.tsx`
- [ ] `apps/edu/components/shared/_components/workflow-editor.tsx`
- [ ] `apps/edu/components/shared/ai-not-configured-dialog.tsx`
- [ ] `apps/edu/components/shared/alliance-detail-shell.tsx`
- [ ] `apps/edu/components/shared/approval-list-page.tsx`
- [ ] `apps/edu/components/shared/archive-list-page.tsx`
- [ ] `apps/edu/components/shared/batch-group-page.tsx`
- [ ] `apps/edu/components/shared/batch-selector.tsx`
- [ ] `apps/edu/components/shared/brand-relation-select.tsx`
- [ ] `apps/edu/components/shared/captcha-input.tsx`
- [ ] `apps/edu/components/shared/citation-stats-panel.tsx`
- [ ] `apps/edu/components/shared/co-build-collaborator-picker.tsx`
- [ ] `apps/edu/components/shared/combobox-select.tsx`
- [ ] `apps/edu/components/shared/confirm-dialog.tsx`
- [ ] `apps/edu/components/shared/content-list-page.tsx`

### F26 [ ] — 24 文件
- [ ] `apps/edu/components/shared/cover-image-upload.tsx`
- [ ] `apps/edu/components/shared/date-input.tsx`
- [ ] `apps/edu/components/shared/detail-page-header.tsx`
- [ ] `apps/edu/components/shared/editor-shell.tsx`
- [ ] `apps/edu/components/shared/error-state.tsx`
- [ ] `apps/edu/components/shared/eval-method-card.tsx`
- [ ] `apps/edu/components/shared/eval-method-config-module.tsx`
- [ ] `apps/edu/components/shared/eval-method-selector.tsx`
- [ ] `apps/edu/components/shared/exam-grading/question-grading-card.tsx`
- [ ] `apps/edu/components/shared/favorite-button.tsx`
- [ ] `apps/edu/components/shared/file-viewer-preview.test.ts`
- [ ] `apps/edu/components/shared/file-viewer-preview.tsx`
- [ ] `apps/edu/components/shared/form-field-row.tsx`
- [ ] `apps/edu/components/shared/form-page-shell.tsx`
- [ ] `apps/edu/components/shared/hover-action-bar.tsx`
- [ ] `apps/edu/components/shared/image-list-upload.tsx`
- [ ] `apps/edu/components/shared/image-upload-utils.ts`
- [ ] `apps/edu/components/shared/import-confirm-dialog.tsx`
- [ ] `apps/edu/components/shared/import-wizard-dialog.tsx`
- [ ] `apps/edu/components/shared/knowledge-selector.tsx`
- [ ] `apps/edu/components/shared/landing-filter-row.tsx`
- [ ] `apps/edu/components/shared/landing-pagination.tsx`
- [ ] `apps/edu/components/shared/landing-shell.tsx`
- [ ] `apps/edu/components/shared/learn-page.tsx`

### F27 [ ] — 21 文件
- [ ] `apps/edu/components/shared/log-table-shell.tsx`
- [ ] `apps/edu/components/shared/major-select.tsx`
- [ ] `apps/edu/components/shared/mobile-tab-dropdown.tsx`
- [ ] `apps/edu/components/shared/multi-org-node-picker.tsx`
- [ ] `apps/edu/components/shared/org-node-picker.tsx`
- [ ] `apps/edu/components/shared/page-header-card.tsx`
- [ ] `apps/edu/components/shared/pagination-bar.tsx`
- [ ] `apps/edu/components/shared/permission-guard.tsx`
- [ ] `apps/edu/components/shared/platform-layout.tsx`
- [ ] `apps/edu/components/shared/portal-crud-page.tsx`
- [ ] `apps/edu/components/shared/portal-sidebar-crud-page.tsx`
- [ ] `apps/edu/components/shared/reset-password-dialog.tsx`
- [ ] `apps/edu/components/shared/resource-preview-modal.tsx`
- [ ] `apps/edu/components/shared/resource-selector.tsx`
- [ ] `apps/edu/components/shared/schedule-grid.tsx`
- [ ] `apps/edu/components/shared/search-input.tsx`
- [ ] `apps/edu/components/shared/status-action-bar.tsx`
- [ ] `apps/edu/components/shared/status-badge.tsx`
- [ ] `apps/edu/components/shared/table-row-actions.tsx`
- [ ] `apps/edu/components/shared/tag-badge.tsx`
- [ ] `apps/edu/components/shared/tag-filter-bar.tsx`

### F28 [ ] — 8 文件
- [ ] `apps/edu/components/shared/tag-picker.tsx`
- [ ] `apps/edu/components/shared/uncited-resources-dialog.tsx`
- [ ] `apps/edu/components/shared/use-tag-bindings.ts`
- [ ] `apps/edu/components/shared/use-tags.ts`
- [ ] `apps/edu/components/shared/user-selector.tsx`
- [ ] `apps/edu/components/shared/workflow-config-page.tsx`
- [ ] `apps/edu/components/theme-brand-sync.tsx`
- [ ] `apps/edu/components/theme-provider.tsx`

### F29 [ ] — 1 文件
- [ ] `apps/edu/contexts/portal-auth-context.tsx`

### F30 [ ] — 9 文件
- [ ] `apps/edu/hooks/use-approvals.ts`
- [ ] `apps/edu/hooks/use-font-scale.ts`
- [ ] `apps/edu/hooks/use-import-flow.ts`
- [ ] `apps/edu/hooks/use-org-tree.ts`
- [ ] `apps/edu/hooks/use-paged-list.ts`
- [ ] `apps/edu/hooks/use-portal-users.ts`
- [ ] `apps/edu/hooks/use-secondary-colleges.ts`
- [ ] `apps/edu/hooks/use-submitter-names.ts`
- [ ] `apps/edu/hooks/use-subscription-modules.ts`

### F31 [ ] — 31 文件
- [ ] `apps/edu/lib/active-role.ts`
- [ ] `apps/edu/lib/ai/use-ai-assist.ts`
- [ ] `apps/edu/lib/alliance-dicts.ts`
- [ ] `apps/edu/lib/alliance-links.ts`
- [ ] `apps/edu/lib/changelog-content.ts`
- [ ] `apps/edu/lib/converters/job-converters.test.ts`
- [ ] `apps/edu/lib/converters/job-converters.ts`
- [ ] `apps/edu/lib/cover-gradients.ts`
- [ ] `apps/edu/lib/error-handling.ts`
- [ ] `apps/edu/lib/evaluation-rule-store.test.ts`
- [ ] `apps/edu/lib/evaluation-rule-store.ts`
- [ ] `apps/edu/lib/exam-snapshot.ts`
- [ ] `apps/edu/lib/external-links.ts`
- [ ] `apps/edu/lib/font-size-scale.test.ts`
- [ ] `apps/edu/lib/font-size-scale.ts`
- [ ] `apps/edu/lib/format-salary.ts`
- [ ] `apps/edu/lib/format-utils.test.ts`
- [ ] `apps/edu/lib/format-utils.ts`
- [ ] `apps/edu/lib/frequent-services.test.ts`
- [ ] `apps/edu/lib/frequent-services.ts`
- [ ] `apps/edu/lib/fs-stub.ts`
- [ ] `apps/edu/lib/hybrid-eval.test.ts`
- [ ] `apps/edu/lib/hybrid-eval.ts`
- [ ] `apps/edu/lib/i18n/locale-provider.tsx`
- [ ] `apps/edu/lib/i18n/translate.test.ts`
- [ ] `apps/edu/lib/learn-links.ts`
- [ ] `apps/edu/lib/load-error.ts`
- [ ] `apps/edu/lib/menu-permissions.test.ts`
- [ ] `apps/edu/lib/menu-permissions.ts`
- [ ] `apps/edu/lib/navigation-config.ts`
- [ ] `apps/edu/lib/org-type-icons.ts`

### F32 [ ] — 8 文件
- [ ] `apps/edu/lib/partner-enterprise-completeness.ts`
- [ ] `apps/edu/lib/public-routes.ts`
- [ ] `apps/edu/lib/resource-type-constants.test.ts`
- [ ] `apps/edu/lib/resource-type-constants.tsx`
- [ ] `apps/edu/lib/schedule-utils.ts`
- [ ] `apps/edu/lib/snapshot-converters.ts`
- [ ] `apps/edu/lib/theme-brand.ts`
- [ ] `apps/edu/lib/use-resource-maps.ts`

### F33 [ ] — 1 文件
- [ ] `apps/edu/vitest.config.ts`

### F34 [ ] — 40 文件
- [ ] `packages/api-client/src/api-factory.ts`
- [ ] `packages/api-client/src/api-helpers.test.ts`
- [ ] `packages/api-client/src/api-helpers.ts`
- [ ] `packages/api-client/src/api.ts`
- [ ] `packages/api-client/src/api/affairs.ts`
- [ ] `packages/api-client/src/api/ai-center.ts`
- [ ] `packages/api-client/src/api/ai.ts`
- [ ] `packages/api-client/src/api/alliance-employment.ts`
- [ ] `packages/api-client/src/api/alliance.ts`
- [ ] `packages/api-client/src/api/auth.ts`
- [ ] `packages/api-client/src/api/evaluation.ts`
- [ ] `packages/api-client/src/api/favorites.ts`
- [ ] `packages/api-client/src/api/honors.ts`
- [ ] `packages/api-client/src/api/import-export.ts`
- [ ] `packages/api-client/src/api/job.ts`
- [ ] `packages/api-client/src/api/lesson.ts`
- [ ] `packages/api-client/src/api/library.ts`
- [ ] `packages/api-client/src/api/partner-cobuild.ts`
- [ ] `packages/api-client/src/api/partner.ts`
- [ ] `packages/api-client/src/api/portal.ts`
- [ ] `packages/api-client/src/api/scene.ts`
- [ ] `packages/api-client/src/api/system.ts`
- [ ] `packages/api-client/src/device.ts`
- [ ] `packages/api-client/src/fetch-all.ts`
- [ ] `packages/api-client/src/index.ts`
- [ ] `packages/api-client/src/types/affairs.ts`
- [ ] `packages/api-client/src/types/ai.ts`
- [ ] `packages/api-client/src/types/alliance.ts`
- [ ] `packages/api-client/src/types/backend.ts`
- [ ] `packages/api-client/src/types/citation.ts`
- [ ] `packages/api-client/src/types/evaluation.ts`
- [ ] `packages/api-client/src/types/index.ts`
- [ ] `packages/api-client/src/types/job.ts`
- [ ] `packages/api-client/src/types/lesson-source.ts`
- [ ] `packages/api-client/src/types/lesson.ts`
- [ ] `packages/api-client/src/types/library.ts`
- [ ] `packages/api-client/src/types/partner.ts`
- [ ] `packages/api-client/src/types/portal.ts`
- [ ] `packages/api-client/src/types/scene.ts`
- [ ] `packages/api-client/src/types/snapshot.ts`

### F35 [ ] — 1 文件
- [ ] `packages/api-client/vitest.config.ts`

### F36 [ ] — 22 文件
- [ ] `packages/shared-types/src/affairs.ts`
- [ ] `packages/shared-types/src/ai.ts`
- [ ] `packages/shared-types/src/alliance.ts`
- [ ] `packages/shared-types/src/approval.ts`
- [ ] `packages/shared-types/src/backend.ts`
- [ ] `packages/shared-types/src/certification.ts`
- [ ] `packages/shared-types/src/content-status.ts`
- [ ] `packages/shared-types/src/evaluation-exam.ts`
- [ ] `packages/shared-types/src/evaluation-rules.ts`
- [ ] `packages/shared-types/src/evaluation-scene.ts`
- [ ] `packages/shared-types/src/evaluation.ts`
- [ ] `packages/shared-types/src/index.ts`
- [ ] `packages/shared-types/src/job-source.ts`
- [ ] `packages/shared-types/src/job.ts`
- [ ] `packages/shared-types/src/lesson-source.ts`
- [ ] `packages/shared-types/src/lesson.ts`
- [ ] `packages/shared-types/src/library.ts`
- [ ] `packages/shared-types/src/online-classroom.ts`
- [ ] `packages/shared-types/src/portal.ts`
- [ ] `packages/shared-types/src/portrait.ts`
- [ ] `packages/shared-types/src/scene-mock.ts`
- [ ] `packages/shared-types/src/scene.ts`

### F37 [ ] — 4 文件
- [ ] `packages/shared-types/src/shared-models.ts`
- [ ] `packages/shared-types/src/snapshot.ts`
- [ ] `packages/shared-types/src/status.test.ts`
- [ ] `packages/shared-types/src/status.ts`

### F38 [ ] — 1 文件
- [ ] `packages/shared-types/vitest.config.ts`

### F39 [ ] — 51 文件
- [ ] `packages/ui/src/components/platform-shell/config.ts`
- [ ] `packages/ui/src/components/platform-shell/icons.ts`
- [ ] `packages/ui/src/components/platform-shell/index.ts`
- [ ] `packages/ui/src/components/platform-shell/PlatformSideNav.tsx`
- [ ] `packages/ui/src/components/platform-shell/utils.ts`
- [ ] `packages/ui/src/components/shared/combobox-select.tsx`
- [ ] `packages/ui/src/components/shared/confirm-dialog.tsx`
- [ ] `packages/ui/src/components/shared/empty-state.tsx`
- [ ] `packages/ui/src/components/shared/error-state.tsx`
- [ ] `packages/ui/src/components/shared/form-dialog-footer.tsx`
- [ ] `packages/ui/src/components/shared/hover-action-bar.tsx`
- [ ] `packages/ui/src/components/shared/import-confirm-dialog.tsx`
- [ ] `packages/ui/src/components/shared/import-wizard-dialog.tsx`
- [ ] `packages/ui/src/components/shared/mixed-tag-editor.tsx`
- [ ] `packages/ui/src/components/shared/search-input.tsx`
- [ ] `packages/ui/src/components/shared/status-badge.tsx`
- [ ] `packages/ui/src/components/shared/table-row-actions.tsx`
- [ ] `packages/ui/src/components/shared/underline-tabs.tsx`
- [ ] `packages/ui/src/components/ui/alert-dialog.tsx`
- [ ] `packages/ui/src/components/ui/alert.tsx`
- [ ] `packages/ui/src/components/ui/avatar.tsx`
- [ ] `packages/ui/src/components/ui/badge.tsx`
- [ ] `packages/ui/src/components/ui/button.tsx`
- [ ] `packages/ui/src/components/ui/card.tsx`
- [ ] `packages/ui/src/components/ui/chart.tsx`
- [ ] `packages/ui/src/components/ui/checkbox.tsx`
- [ ] `packages/ui/src/components/ui/collapsible.tsx`
- [ ] `packages/ui/src/components/ui/command.tsx`
- [ ] `packages/ui/src/components/ui/dialog.tsx`
- [ ] `packages/ui/src/components/ui/dropdown-menu.tsx`
- [ ] `packages/ui/src/components/ui/empty.tsx`
- [ ] `packages/ui/src/components/ui/field.tsx`
- [ ] `packages/ui/src/components/ui/input.tsx`
- [ ] `packages/ui/src/components/ui/label.tsx`
- [ ] `packages/ui/src/components/ui/popover.tsx`
- [ ] `packages/ui/src/components/ui/progress.tsx`
- [ ] `packages/ui/src/components/ui/radio-group.tsx`
- [ ] `packages/ui/src/components/ui/scroll-area.tsx`
- [ ] `packages/ui/src/components/ui/select.tsx`
- [ ] `packages/ui/src/components/ui/separator.tsx`
- [ ] `packages/ui/src/components/ui/sheet.tsx`
- [ ] `packages/ui/src/components/ui/skeleton.tsx`
- [ ] `packages/ui/src/components/ui/slider.tsx`
- [ ] `packages/ui/src/components/ui/spinner.tsx`
- [ ] `packages/ui/src/components/ui/switch.tsx`
- [ ] `packages/ui/src/components/ui/table.tsx`
- [ ] `packages/ui/src/components/ui/tabs.tsx`
- [ ] `packages/ui/src/components/ui/textarea.tsx`
- [ ] `packages/ui/src/components/ui/toast.tsx`
- [ ] `packages/ui/src/components/ui/toaster.tsx`
- [ ] `packages/ui/src/components/ui/toggle-group.tsx`

### F40 [ ] — 11 文件
- [ ] `packages/ui/src/components/ui/toggle.tsx`
- [ ] `packages/ui/src/components/ui/tooltip.tsx`
- [ ] `packages/ui/src/hooks/use-async.ts`
- [ ] `packages/ui/src/hooks/use-click-outside.ts`
- [ ] `packages/ui/src/hooks/use-debounced-value.ts`
- [ ] `packages/ui/src/hooks/use-import-flow.ts`
- [ ] `packages/ui/src/hooks/use-toast.ts`
- [ ] `packages/ui/src/index.ts`
- [ ] `packages/ui/src/lib/dom-utils.ts`
- [ ] `packages/ui/src/lib/utils.ts`
- [ ] `packages/ui/src/utils.test.ts`

### F41 [ ] — 1 文件
- [ ] `packages/ui/vitest.config.ts`
