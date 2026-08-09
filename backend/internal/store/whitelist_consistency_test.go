package store

import (
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
)

// TestListQueryConfigsMatchWhitelists 防回归测试：
// 逐一实例化所有返回 ListQueryConfig 的 store 配置，校验其 Table/CountTable/
// SelectColumns/OrderBy/TenantColumn/SearchColumns 均在 query.go 白名单内。
// 历史教训：白名单手工维护，曾与 exams/question_banks/positions/scenarios
// 实际查询漂移导致线上 500（invalid identifier），此测试确保新增或修改
// 查询配置时必须同步白名单。
func TestListQueryConfigsMatchWhitelists(t *testing.T) {
	var q Queryer // nil 足够：构造函数仅保存引用
	var b txBeginner

	checkConfig(t, "abilities", NewAbilityStore(q).ListConfig())
	checkConfig(t, "ability_domains", NewAbilityDomainStore(q).ListConfig())
	checkConfig(t, "alliance_achievements", NewAllianceStore(q).ListAchievementsConfig())
	checkConfig(t, "alliance_agreements", NewAllianceStore(q).ListAgreementsConfig())
	checkConfig(t, "alliance_brands", NewAllianceStore(q).ListBrandsConfig())
	checkConfig(t, "alliance_experts", NewAllianceStore(q).ListExpertsConfig())
	checkConfig(t, "alliance_permissions", NewAllianceStore(q).ListPermissionsConfig())
	checkConfig(t, "alliance_projects", NewAllianceStore(q).ListProjectsConfig())
	checkConfig(t, "approvals", NewApprovalStore(q).ListConfig())
	checkConfig(t, "banners", NewBannerStore(q).ListConfig())
	checkConfig(t, "certification_rules", NewCertificationStore(q, b).ListRulesConfig())
	checkConfig(t, "course_nodes", NewCourseNodeStore(q).ListConfig())
	checkConfig(t, "courses", NewCourseStore(q, b).ListConfig())
	checkConfig(t, "evaluation_methods", NewEvaluationMethodStore(q).ListConfig())
	checkConfig(t, "appeals", NewAppealStore(q).ListConfig())
	checkConfig(t, "evaluation_results", NewEvaluationResultStore(q).ListConfig())
	checkConfig(t, "exam_results", NewExamResultStore(q).ListConfig())
	checkConfig(t, "exams", NewExamStore(q).ListConfig())
	checkConfig(t, "exam_usages", NewExamUsageStore(q).ListConfig())
	checkConfig(t, "hybrid_modules", NewHybridModuleStore(q).ListConfig())
	checkConfig(t, "knowledge_points", NewKnowledgePointStore(q).ListConfig())
	checkConfig(t, "node_homeworks", NewNodeHomeworkStore(q).ListConfig())
	checkConfig(t, "node_evaluation_results", NewNodeEvaluationResultStore(q).ListConfig())
	checkConfig(t, "node_quizzes", NewNodeQuizStore(q).ListConfig())
	checkConfig(t, "organizations", NewOrganizationStore(q).ListConfig())
	checkConfig(t, "position_ability_bindings", NewPositionAbilityStore(q).ListConfig())
	checkConfig(t, "position_responsibilities", NewPositionResponsibilityStore(q).ListConfig())
	checkConfig(t, "positions_admin", NewPositionStore(q, b).AdminListConfig())
	checkConfig(t, "positions_public", NewPositionStore(q, b).PublicListConfig())
	checkConfig(t, "question_banks", NewQuestionBankStore(q).ListConfig())
	checkConfig(t, "questions", NewQuestionStore(q).ListConfig())
	checkConfig(t, "random_draw_questions", NewRandomDrawQuestionStore(q, b).ListConfig())
	checkConfig(t, "position_recommendations", NewRecommendStore(q).ListConfig())
	checkConfig(t, "resource_codes", NewResourceCodeStore(q).ListConfig())
	checkConfig(t, "scenario_weights", NewScenarioWeightStore(q).ListConfig())
	checkConfig(t, "scenario_grades", NewScenarioGradeStore(q).ListConfig())
	checkConfig(t, "scenarios", NewScenarioStore(q, b).ListConfig())
	checkConfig(t, "scenario_tasks", NewScenarioTaskStore(q).ListConfig())
	checkConfig(t, "schedule_entries", NewSchedulingStore(q).ListSchedulesConfig())
	checkConfig(t, "venues", NewSchedulingStore(q).ListVenuesConfig())
	checkConfig(t, "period_slots", NewSchedulingStore(q).ListPeriodSlotsConfig())
	checkConfig(t, "student_ability_portraits", NewStudentPortraitStore(q).ListConfig())
	checkConfig(t, "student_ability_archives", NewStudentPortraitStore(q).ArchivesListConfig())
	checkConfig(t, "rubric_templates", NewTaskEvaluationStore(q).ListConfig())
	checkConfig(t, "teaching_plans", NewTeachingPlanStore(q, b).ListConfig())
	checkConfig(t, "tenants", NewTenantStore(q).ListConfig())
	checkConfig(t, "tenants_admin", NewTenantStore(q).AdminListConfig())
	checkConfig(t, "terms", NewTermStore(q).ListConfig())
	checkConfig(t, "training_programs", NewTrainingProgramStore(q).ListConfig())
	checkConfig(t, "users", NewUserStore(q, b).ListConfig())
	checkConfig(t, "workflows", NewWorkflowStore(q).ListConfig())

	// 字典类 store（嵌入 DictStore）
	checkConfig(t, "majors", NewMajorsStore(q).ListConfig())
	checkConfig(t, "industries", NewIndustriesStore(q).ListConfig())
	checkConfig(t, "org_types", NewOrgTypesStore(q).ListConfig())
	checkConfig(t, "staff_titles", NewStaffTitlesStore(q).ListConfig())
	checkConfig(t, "learn_roads", NewLearnRoadsStore(q).ListConfig())
	checkConfig(t, "certificate_library", NewCertificateLibraryStore(q).ListConfig())
	checkConfig(t, "on_site_question_library", NewOnSiteQuestionLibraryStore(q).ListConfig())
	checkConfig(t, "roles", NewRolesStore(q, b).ListConfig())

	// 日志类配置（独立函数）
	checkConfig(t, "login_logs", LoginLogsListConfig())
	checkConfig(t, "operation_logs", OperationLogsListConfig())
}

func checkConfig[T any](t *testing.T, name string, cfg ListQueryConfig[T]) {
	t.Helper()
	t.Run(name, func(t *testing.T) {
		if err := cfg.ValidateIdentifiers(); err != nil {
			t.Fatalf("查询配置与白名单不一致（新增/修改查询时须同步 query.go 白名单）: %v", err)
		}
	})
}

var _ = domain.Course{} // 确保 domain 引用保持
