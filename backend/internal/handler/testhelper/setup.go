package testhelper

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"golang.org/x/crypto/bcrypt"
)

const (
	TestJWTSecret  = "test-secret-key-for-unit-tests"
	TestOperatorID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01"
	TestTenantID   = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02"
)

type TestEnv struct {
	DB            *pgxpool.Pool
	Router        chi.Router
	OperatorToken string
	Cleanup       func()
}

func SetupTestEnv(t *testing.T) *TestEnv {
	t.Helper()

	_ = godotenv.Load("../../../.env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL or DATABASE_URL not set, skipping integration test")
	}

	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		t.Fatalf("parse db url: %v", err)
	}
	config.MinConns = 1
	config.MaxConns = 5

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		t.Fatalf("create pool: %v", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		t.Fatalf("ping db: %v", err)
	}

	runTestMigrations(t, pool)

	r := chi.NewRouter()
	r.Route("/api/v1", func(r chi.Router) {
		auth := middleware.JWT(TestJWTSecret)

		authHandler := &handler.AuthHandler{DB: pool, JWTSecret: TestJWTSecret}
		r.Post("/auth/login", authHandler.Login)

		bannerHandler := &handler.BannerHandler{DB: pool}
		r.Get("/banners", bannerHandler.List)

		resourceHandler := &handler.ResourceHandler{DB: pool}
		r.Get("/resources", resourceHandler.List)
		r.Get("/resources/{id}", resourceHandler.Get)

		tenantHandler := &handler.TenantHandler{DB: pool}
		r.Get("/admin/tenants", tenantHandler.AdminList)
		r.Post("/admin/tenants", tenantHandler.AdminCreate)
		r.Put("/admin/tenants/{id}", tenantHandler.AdminUpdate)
		r.Post("/admin/tenants/{id}/status", tenantHandler.AdminUpdateStatus)
		r.Delete("/admin/tenants/{id}", tenantHandler.AdminDelete)

		r.Group(func(r chi.Router) {
			r.Use(auth)

			r.Get("/auth/me", authHandler.Me)

			statsHandler := &handler.StatsHandler{DB: pool}
			r.Get("/stats/dashboard", statsHandler.Dashboard)
			r.Get("/stats/me", statsHandler.MyStats)

			institutionHandler := &handler.InstitutionHandler{DB: pool}
			r.Get("/institutions", institutionHandler.List)
			r.Get("/institutions/{id}", institutionHandler.Get)
			r.Post("/institutions", institutionHandler.Create)
			r.Put("/institutions/{id}", institutionHandler.Update)

			r.Post("/resources", resourceHandler.Create)
			r.Put("/resources/{id}", resourceHandler.Update)
			r.Delete("/resources/{id}", resourceHandler.Delete)
			r.Post("/resources/{id}/submit", resourceHandler.SubmitForReview)
			r.Post("/resources/{id}/review", resourceHandler.Review)
			r.Post("/resources/{id}/publish", resourceHandler.Publish)

			orderHandler := &handler.OrderHandler{DB: pool}
			r.Get("/orders", orderHandler.List)
			r.Get("/orders/{id}", orderHandler.Get)
			r.Post("/orders", orderHandler.Create)

			withdrawalHandler := &handler.WithdrawalHandler{DB: pool}
			r.Get("/withdrawals", withdrawalHandler.List)
			r.Post("/withdrawals", withdrawalHandler.Create)

			r.Post("/banners", bannerHandler.Create)
			r.Put("/banners/{id}", bannerHandler.Update)
			r.Delete("/banners/{id}", bannerHandler.Delete)

			tenantHandler := &handler.TenantHandler{DB: pool}
			r.Get("/tenants", tenantHandler.List)
			r.Get("/tenants/{id}", tenantHandler.Get)
			r.Post("/tenants", tenantHandler.Create)
			r.Put("/tenants/{id}", tenantHandler.Update)
			r.Post("/tenants/{id}/status", tenantHandler.UpdateStatus)

			orgHandler := &handler.OrgHandler{DB: pool}
			r.Get("/organizations", orgHandler.List)
			r.Get("/organizations/tree", orgHandler.Tree)
			r.Get("/organizations/{id}", orgHandler.Get)
			r.Post("/organizations", orgHandler.Create)
			r.Put("/organizations/{id}", orgHandler.Update)
			r.Delete("/organizations/{id}", orgHandler.Delete)

			orgTypeHandler := &handler.OrgTypeHandler{DB: pool}
			r.Get("/org-types", orgTypeHandler.List)
			r.Get("/org-types/{id}", orgTypeHandler.Get)
			r.Post("/org-types", orgTypeHandler.Create)
			r.Put("/org-types/{id}", orgTypeHandler.Update)
			r.Delete("/org-types/{id}", orgTypeHandler.Delete)

			userManagementHandler := &handler.UserManagementHandler{DB: pool}
			r.Get("/users", userManagementHandler.List)
			r.Get("/users/{id}", userManagementHandler.Get)
			r.Post("/users", userManagementHandler.Create)
			r.Put("/users/{id}", userManagementHandler.Update)
			r.Delete("/users/{id}", userManagementHandler.Delete)
			r.Post("/users/{id}/status", userManagementHandler.UpdateStatus)
			r.Post("/users/batch", userManagementHandler.BatchCreate)

			roleHandler := &handler.RoleHandler{DB: pool}
			r.Get("/roles", roleHandler.List)
			r.Get("/roles/{id}", roleHandler.Get)
			r.Post("/roles", roleHandler.Create)
			r.Put("/roles/{id}", roleHandler.Update)
			r.Delete("/roles/{id}", roleHandler.Delete)
			r.Post("/roles/{id}/assign", roleHandler.Assign)

			majorHandler := &handler.MajorHandler{DB: pool}
			r.Get("/majors", majorHandler.List)
			r.Get("/majors/{id}", majorHandler.Get)
			r.Post("/majors", majorHandler.Create)
			r.Put("/majors/{id}", majorHandler.Update)
			r.Delete("/majors/{id}", majorHandler.Delete)

			industryHandler := &handler.IndustryHandler{DB: pool}
			r.Get("/industries", industryHandler.List)
			r.Get("/industries/{id}", industryHandler.Get)
			r.Post("/industries", industryHandler.Create)
			r.Put("/industries/{id}", industryHandler.Update)
			r.Delete("/industries/{id}", industryHandler.Delete)

			resourceCodeHandler := &handler.ResourceCodeHandler{DB: pool}
			r.Get("/resource-codes", resourceCodeHandler.List)
			r.Get("/resource-codes/{id}", resourceCodeHandler.Get)

			logHandler := &handler.LogHandler{DB: pool}
			r.Get("/logs/login", logHandler.LoginLogs)
			r.Get("/logs/operation", logHandler.OperationLogs)

			subscriptionHandler := &handler.SubscriptionHandler{DB: pool}
			r.Get("/subscriptions", subscriptionHandler.Get)
			r.Put("/subscriptions/{id}", subscriptionHandler.Update)

			platformLinkHandler := &handler.PlatformLinkHandler{DB: pool}
			r.Get("/platform-links", platformLinkHandler.List)
			r.Get("/platform-links/{id}", platformLinkHandler.Get)
			r.Post("/platform-links", platformLinkHandler.Create)
			r.Put("/platform-links/{id}", platformLinkHandler.Update)
			r.Delete("/platform-links/{id}", platformLinkHandler.Delete)

			appModuleHandler := &handler.AppModuleHandler{DB: pool}
			r.Get("/app-modules", appModuleHandler.List)
			r.Get("/app-modules/{id}", appModuleHandler.Get)
			r.Post("/app-modules", appModuleHandler.Create)
			r.Put("/app-modules/{id}", appModuleHandler.Update)
			r.Delete("/app-modules/{id}", appModuleHandler.Delete)

			positionHandler := &handler.PositionHandler{DB: pool}
			r.Get("/job/positions", positionHandler.List)
			r.Get("/job/positions/{id}", positionHandler.Get)
			r.Post("/job/positions", positionHandler.Create)
			r.Put("/job/positions/{id}", positionHandler.Update)
			r.Delete("/job/positions/{id}", positionHandler.Delete)
			r.Put("/job/positions/{id}/save-full", positionHandler.SaveFull)
			r.Post("/job/positions/{id}/submit", positionHandler.Submit)
			r.Post("/job/positions/{id}/review", positionHandler.Review)
			r.Post("/job/positions/{id}/publish", positionHandler.Publish)
			r.Post("/job/positions/{id}/archive", positionHandler.Archive)

			abilityHandler := &handler.AbilityHandler{DB: pool}
			r.Get("/job/abilities", abilityHandler.List)
			r.Get("/job/abilities/{id}", abilityHandler.Get)
			r.Post("/job/abilities", abilityHandler.Create)
			r.Put("/job/abilities/{id}", abilityHandler.Update)
			r.Delete("/job/abilities/{id}", abilityHandler.Delete)

			positionAbilityHandler := &handler.PositionAbilityHandler{DB: pool}
			r.Get("/job/position-abilities", positionAbilityHandler.ListBindings)
			r.Post("/job/position-abilities", positionAbilityHandler.CreateBinding)
			r.Put("/job/position-abilities/{id}", positionAbilityHandler.UpdateBinding)
			r.Delete("/job/position-abilities/{id}", positionAbilityHandler.DeleteBinding)

			positionResponsibilityHandler := &handler.PositionResponsibilityHandler{DB: pool}
			r.Get("/job/position-responsibilities", positionResponsibilityHandler.List)
			r.Get("/job/position-responsibilities/{id}", positionResponsibilityHandler.Get)
			r.Post("/job/position-responsibilities", positionResponsibilityHandler.Create)
			r.Put("/job/position-responsibilities/{id}", positionResponsibilityHandler.Update)
			r.Delete("/job/position-responsibilities/{id}", positionResponsibilityHandler.Delete)

			positionCertificateHandler := &handler.PositionCertificateHandler{DB: pool}
			r.Get("/job/position-certificates", positionCertificateHandler.List)
			r.Get("/job/position-certificates/{id}", positionCertificateHandler.Get)
			r.Post("/job/position-certificates", positionCertificateHandler.Create)
			r.Put("/job/position-certificates/{id}", positionCertificateHandler.Update)
			r.Delete("/job/position-certificates/{id}", positionCertificateHandler.Delete)

			abilityDomainHandler := &handler.AbilityDomainHandler{DB: pool}
			r.Get("/job/ability-domains", abilityDomainHandler.List)
			r.Post("/job/ability-domains", abilityDomainHandler.Create)
			r.Put("/job/ability-domains/{id}", abilityDomainHandler.Update)
			r.Delete("/job/ability-domains/{id}", abilityDomainHandler.Delete)

			jobBatchHandler := handler.NewJobBatchHandler(pool)
			r.Get("/job/batches", jobBatchHandler.List)
			r.Get("/job/batches/{id}", jobBatchHandler.Get)
			r.Post("/job/batches", jobBatchHandler.Create)
			r.Put("/job/batches/{id}", jobBatchHandler.Update)
			r.Delete("/job/batches/{id}", jobBatchHandler.Delete)
			r.Post("/job/batches/{id}/status", jobBatchHandler.UpdateStatus)

			recommendHandler := &handler.RecommendHandler{DB: pool}
			r.Get("/job/recommendations", recommendHandler.List)
			r.Post("/job/recommendations", recommendHandler.Create)
			r.Put("/job/recommendations/{id}", recommendHandler.Update)
			r.Delete("/job/recommendations/{id}", recommendHandler.Delete)

			learnRoadHandler := &handler.LearnRoadHandler{DB: pool}
			r.Get("/job/learn-roads", learnRoadHandler.List)
			r.Get("/job/learn-roads/{id}", learnRoadHandler.Get)
			r.Post("/job/learn-roads", learnRoadHandler.Create)
			r.Put("/job/learn-roads/{id}", learnRoadHandler.Update)
			r.Delete("/job/learn-roads/{id}", learnRoadHandler.Delete)

			scenarioHandler := &handler.ScenarioHandler{DB: pool}
			r.Get("/scene/scenarios", scenarioHandler.List)
			r.Get("/scene/scenarios/{id}", scenarioHandler.Get)
			r.Post("/scene/scenarios", scenarioHandler.Create)
			r.Put("/scene/scenarios/{id}", scenarioHandler.Update)
			r.Delete("/scene/scenarios/{id}", scenarioHandler.Delete)
			r.Post("/scene/scenarios/{id}/submit", scenarioHandler.Submit)
			r.Post("/scene/scenarios/{id}/review", scenarioHandler.Review)
			r.Post("/scene/scenarios/{id}/publish", scenarioHandler.Publish)
			r.Post("/scene/scenarios/{id}/archive", scenarioHandler.Archive)

			scenarioTaskHandler := &handler.ScenarioTaskHandler{DB: pool}
			r.Get("/scene/tasks", scenarioTaskHandler.List)
			r.Get("/scene/tasks/{id}", scenarioTaskHandler.Get)
			r.Post("/scene/tasks", scenarioTaskHandler.Create)
			r.Put("/scene/tasks/{id}", scenarioTaskHandler.Update)
			r.Delete("/scene/tasks/{id}", scenarioTaskHandler.Delete)
			r.Post("/scene/tasks/reorder", scenarioTaskHandler.Reorder)

			taskEvaluationHandler := &handler.TaskEvaluationHandler{DB: pool}
			r.Get("/scene/evaluation", taskEvaluationHandler.ListConfigs)
			r.Post("/scene/evaluation", taskEvaluationHandler.UpsertConfig)
			r.Delete("/scene/evaluation/{id}", taskEvaluationHandler.DeleteConfig)
			r.Get("/scene/evaluation/{id}/points", taskEvaluationHandler.ListEvalPoints)
			r.Post("/scene/evaluation/{id}/points", taskEvaluationHandler.UpsertEvalPoint)
			r.Put("/scene/evaluation/points/{id}", taskEvaluationHandler.UpsertEvalPoint)
			r.Delete("/scene/evaluation/points/{id}", taskEvaluationHandler.DeleteEvalPoint)
			r.Get("/scene/evaluation/{id}/steps", taskEvaluationHandler.ListReviewSteps)
			r.Post("/scene/evaluation/{id}/steps", taskEvaluationHandler.UpsertReviewStep)
			r.Put("/scene/evaluation/steps/{id}", taskEvaluationHandler.UpsertReviewStep)

			taskResourceHandler := &handler.TaskResourceHandler{DB: pool}
			r.Get("/scene/task-resources", taskResourceHandler.ListResources)
			r.Post("/scene/task-resources", taskResourceHandler.BindResource)
				r.Post("/scene/task-resources/create", taskResourceHandler.Create)
			r.Delete("/scene/task-resources/{id}", taskResourceHandler.UnbindResource)

			taskKnowledgeAbilityHandler := &handler.TaskKnowledgeAbilityHandler{DB: pool}
			r.Post("/scene/task-bindings/knowledge", taskKnowledgeAbilityHandler.BindKnowledge)
			r.Delete("/scene/task-bindings/knowledge/{id}", taskKnowledgeAbilityHandler.UnbindKnowledge)
			r.Post("/scene/task-bindings/ability", taskKnowledgeAbilityHandler.BindAbility)
			r.Delete("/scene/task-bindings/ability/{id}", taskKnowledgeAbilityHandler.UnbindAbility)

			scenarioWeightHandler := &handler.ScenarioWeightHandler{DB: pool}
			r.Get("/scene/weights", scenarioWeightHandler.ListWeights)
			r.Post("/scene/weights", scenarioWeightHandler.UpsertWeight)
			r.Put("/scene/weights/{id}", scenarioWeightHandler.UpsertWeight)

			scenarioGradeHandler := &handler.ScenarioGradeHandler{DB: pool}
			r.Get("/scene/grade-mappings", scenarioGradeHandler.ListGradeMappings)
			r.Post("/scene/grade-mappings", scenarioGradeHandler.UpsertGradeMapping)
			r.Put("/scene/grade-mappings/{id}", scenarioGradeHandler.UpsertGradeMapping)

			courseHandler := &handler.CourseHandler{DB: pool}
			r.Get("/lesson/courses", courseHandler.List)
			r.Get("/lesson/courses/{id}", courseHandler.Get)
			r.Post("/lesson/courses", courseHandler.Create)
			r.Put("/lesson/courses/{id}", courseHandler.Update)
			r.Delete("/lesson/courses/{id}", courseHandler.Delete)
			r.Post("/lesson/courses/{id}/submit", courseHandler.Submit)
			r.Post("/lesson/courses/{id}/review", courseHandler.Review)
			r.Post("/lesson/courses/{id}/publish", courseHandler.Publish)

			knowledgePointHandler := &handler.KnowledgePointHandler{DB: pool}
			r.Get("/lesson/knowledge-points", knowledgePointHandler.List)
			r.Get("/lesson/knowledge-points/{id}", knowledgePointHandler.Get)
			r.Post("/lesson/knowledge-points", knowledgePointHandler.Create)
			r.Put("/lesson/knowledge-points/{id}", knowledgePointHandler.Update)
			r.Delete("/lesson/knowledge-points/{id}", knowledgePointHandler.Delete)

			courseNodeHandler := &handler.CourseNodeHandler{DB: pool}
			r.Get("/lesson/nodes", courseNodeHandler.List)
			r.Get("/lesson/nodes/{id}", courseNodeHandler.Get)
			r.Post("/lesson/nodes", courseNodeHandler.Create)
			r.Put("/lesson/nodes/{id}", courseNodeHandler.Update)
			r.Delete("/lesson/nodes/{id}", courseNodeHandler.Delete)
			r.Post("/lesson/nodes/reorder", courseNodeHandler.Reorder)

			nodeQuizHandler := &handler.NodeQuizHandler{DB: pool}
			r.Get("/lesson/quizzes", nodeQuizHandler.ListQuizzes)
			r.Post("/lesson/quizzes", nodeQuizHandler.CreateQuiz)
			r.Get("/lesson/quizzes/{id}", nodeQuizHandler.ListQuestions)
			r.Put("/lesson/quizzes/{id}", nodeQuizHandler.UpdateQuiz)
			r.Delete("/lesson/quizzes/{id}", nodeQuizHandler.DeleteQuiz)
			r.Post("/lesson/quizzes/{id}/questions", nodeQuizHandler.AddQuestion)
			r.Put("/lesson/quizzes/questions/{questionId}", nodeQuizHandler.UpdateQuestion)
			r.Delete("/lesson/quizzes/questions/{questionId}", nodeQuizHandler.DeleteQuestion)

			nodeHomeworkHandler := &handler.NodeHomeworkHandler{DB: pool}
			r.Get("/lesson/homeworks", nodeHomeworkHandler.List)
			r.Get("/lesson/homeworks/{id}", nodeHomeworkHandler.Get)
			r.Post("/lesson/homeworks", nodeHomeworkHandler.Create)
			r.Put("/lesson/homeworks/{id}", nodeHomeworkHandler.Update)
			r.Delete("/lesson/homeworks/{id}", nodeHomeworkHandler.Delete)

			hybridModuleHandler := &handler.HybridModuleHandler{DB: pool}
			r.Get("/lesson/hybrid-modules", hybridModuleHandler.ListModules)
			r.Post("/lesson/hybrid-modules", hybridModuleHandler.UpsertModule)
			r.Put("/lesson/hybrid-modules/{id}", hybridModuleHandler.UpsertModule)
			r.Delete("/lesson/hybrid-modules/{id}", hybridModuleHandler.DeleteModule)

			courseBatchHandler := handler.NewCourseBatchHandler(pool)
			r.Get("/lesson/batches", courseBatchHandler.List)
			r.Get("/lesson/batches/{id}", courseBatchHandler.Get)
			r.Post("/lesson/batches", courseBatchHandler.Create)
			r.Put("/lesson/batches/{id}", courseBatchHandler.Update)
			r.Delete("/lesson/batches/{id}", courseBatchHandler.Delete)
			r.Post("/lesson/batches/{id}/status", courseBatchHandler.UpdateStatus)

			questionBankHandler := &handler.QuestionBankHandler{DB: pool}
			r.Get("/evaluation/question-banks", questionBankHandler.List)
			r.Get("/evaluation/question-banks/{id}", questionBankHandler.Get)
			r.Post("/evaluation/question-banks", questionBankHandler.Create)
			r.Put("/evaluation/question-banks/{id}", questionBankHandler.Update)
			r.Delete("/evaluation/question-banks/{id}", questionBankHandler.Delete)

			questionHandler := &handler.QuestionHandler{DB: pool}
			r.Get("/evaluation/questions", questionHandler.List)
			r.Get("/evaluation/questions/{id}", questionHandler.Get)
			r.Post("/evaluation/questions", questionHandler.Create)
			r.Put("/evaluation/questions/{id}", questionHandler.Update)
			r.Delete("/evaluation/questions/{id}", questionHandler.Delete)
			r.Post("/evaluation/questions/batch", questionHandler.BatchCreate)

			examHandler := &handler.ExamHandler{DB: pool}
			r.Get("/evaluation/exams", examHandler.List)
			r.Get("/evaluation/exams/{id}", examHandler.Get)
			r.Post("/evaluation/exams", examHandler.Create)
			r.Put("/evaluation/exams/{id}", examHandler.Update)
			r.Delete("/evaluation/exams/{id}", examHandler.Delete)
			r.Post("/evaluation/exams/{id}/questions", examHandler.AddQuestion)
			r.Delete("/evaluation/exams/{id}/questions/{questionId}", examHandler.RemoveQuestion)

			examUsageHandler := &handler.ExamUsageHandler{DB: pool}
			r.Get("/evaluation/exam-usages", examUsageHandler.List)
			r.Get("/evaluation/exam-usages/{id}", examUsageHandler.Get)
			r.Post("/evaluation/exam-usages", examUsageHandler.Create)
			r.Put("/evaluation/exam-usages/{id}", examUsageHandler.Update)
			r.Delete("/evaluation/exam-usages/{id}", examUsageHandler.Delete)
			r.Post("/evaluation/exam-usages/{id}/start", examUsageHandler.Start)
			r.Post("/evaluation/exam-usages/{id}/finish", examUsageHandler.Finish)

			evaluationResultHandler := &handler.EvaluationResultHandler{DB: pool}
			r.Get("/evaluation/results", evaluationResultHandler.List)
			r.Get("/evaluation/results/{id}", evaluationResultHandler.Get)
			r.Post("/evaluation/results/{id}/grade", evaluationResultHandler.Grade)
			r.Post("/evaluation/results/batch-grade", evaluationResultHandler.BatchGrade)

			certificationHandler := &handler.CertificationHandler{DB: pool}
			r.Get("/evaluation/certifications", certificationHandler.ListRules)
			r.Get("/evaluation/certifications/{id}", certificationHandler.GetRule)
			r.Post("/evaluation/certifications", certificationHandler.CreateRule)
			r.Put("/evaluation/certifications/{id}", certificationHandler.UpdateRule)
			r.Delete("/evaluation/certifications/{id}", certificationHandler.DeleteRule)
			r.Get("/evaluation/certifications/{ruleId}/items", certificationHandler.ConfigItems)
			r.Post("/evaluation/certifications/{ruleId}/items", certificationHandler.ConfigItems)
			r.Get("/evaluation/certifications/items/{itemId}/points", certificationHandler.ConfigPoints)
			r.Post("/evaluation/certifications/items/{itemId}/points", certificationHandler.ConfigPoints)

			graduationHandler := &handler.GraduationHandler{DB: pool}
			r.Get("/evaluation/graduation/topics", graduationHandler.ListTopics)
			r.Get("/evaluation/graduation/topics/{id}", graduationHandler.GetTopic)
			r.Post("/evaluation/graduation/topics", graduationHandler.CreateTopic)
			r.Put("/evaluation/graduation/topics/{id}", graduationHandler.UpdateTopic)
			r.Delete("/evaluation/graduation/topics/{id}", graduationHandler.DeleteTopic)
			r.Post("/evaluation/graduation/topics/{id}/apply", graduationHandler.ApplyTopic)
			r.Get("/evaluation/graduation/archives", graduationHandler.ArchivesCRUD)
			r.Post("/evaluation/graduation/archives", graduationHandler.ArchivesCRUD)
			r.Get("/evaluation/graduation/evaluations", graduationHandler.EvaluationsCRUD)
			r.Post("/evaluation/graduation/evaluations", graduationHandler.EvaluationsCRUD)
			r.Get("/evaluation/graduation/query", graduationHandler.QueryResults)

			studentPortraitHandler := &handler.StudentPortraitHandler{DB: pool}
			r.Get("/evaluation/portraits", studentPortraitHandler.List)
			r.Get("/evaluation/portraits/{id}", studentPortraitHandler.Get)
			r.Post("/evaluation/portraits/generate", studentPortraitHandler.Generate)
			r.Get("/evaluation/portraits/archives", studentPortraitHandler.ListArchives)
			r.Post("/evaluation/portraits/archives", studentPortraitHandler.CreateArchive)

			microCertHandler := &handler.MicroCertHandler{DB: pool}
			r.Get("/evaluation/certificates/templates", microCertHandler.ListTemplates)
			r.Post("/evaluation/certificates/templates", microCertHandler.CreateTemplate)
			r.Get("/evaluation/certificates/templates/{id}", microCertHandler.ListTemplates)
			r.Put("/evaluation/certificates/templates/{id}", microCertHandler.UpdateTemplate)
			r.Delete("/evaluation/certificates/templates/{id}", microCertHandler.DeleteTemplate)
			r.Post("/evaluation/certificates/issue", microCertHandler.IssueCerts)
			r.Get("/evaluation/certificates/history", microCertHandler.ListHistory)

			evaluationMethodHandler := &handler.EvaluationMethodHandler{DB: pool}
			r.Get("/evaluation/methods/categories", evaluationMethodHandler.ListCategories)
			r.Get("/evaluation/methods", evaluationMethodHandler.ListMethods)
			r.Post("/evaluation/methods/{id}/toggle", evaluationMethodHandler.Toggle)

			appealHandler := &handler.AppealHandler{DB: pool}
			r.Get("/evaluation/appeals", appealHandler.List)
			r.Get("/evaluation/appeals/{id}", appealHandler.Get)
			r.Post("/evaluation/appeals", appealHandler.Create)
			r.Post("/evaluation/appeals/{id}/process", appealHandler.Process)
		})
	})

	generateTestToken := func(userID, tenantID string, role domain.UserRole) string {
		u := &domain.User{ID: userID, TenantID: &tenantID, Role: role, Username: "test-user"}
		token, _ := middleware.GenerateToken(TestJWTSecret, middleware.TokenInput{User: u, RoleCodes: []string{"platform_admin"}})
		return token
	}

	operatorToken := generateTestToken(TestOperatorID, TestTenantID, domain.UserRoleOperator)

	ensureSeedData(t, pool, operatorToken)

	return &TestEnv{
		DB:            pool,
		Router:        r,
		OperatorToken: operatorToken,
		Cleanup: func() {
			pool.Close()
		},
	}
}

func ensureSeedData(t *testing.T, db *pgxpool.Pool, token string) {
	t.Helper()
	ctx := context.Background()

	// 清理旧测试数据，避免 UNIQUE 约束冲突
	tables := []string{
		"learn_roads", "graduation_project_topics", "workflows",
		"career_positions", "ability_points", "knowledge_points",
		"exams", "question_banks", "scenarios", "courses",
		"staff_titles", "industries", "majors", "org_types",
	}
	for _, tbl := range tables {
		db.Exec(ctx, "DELETE FROM "+tbl+" WHERE tenant_id = $1", TestTenantID)
	}

	db.Exec(ctx, `INSERT INTO tenants (id, name, code, status) VALUES ($1, 'Test Tenant', 'test', 'active') ON CONFLICT (id) DO NOTHING`, TestTenantID)

	pw, _ := bcrypt.GenerateFromPassword([]byte("test123"), bcrypt.DefaultCost)
	db.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'operator', 'saas', 'seedtestuser', 'seedtestuser', $3, 'Test Operator', 'active', '{}')
		ON CONFLICT (id) DO UPDATE SET
			username = EXCLUDED.username,
			login_name = EXCLUDED.login_name,
			platform = EXCLUDED.platform,
			password_hash = EXCLUDED.password_hash,
			updated_at = NOW()
	`, TestOperatorID, TestTenantID, string(pw))

	db.Exec(ctx, `INSERT INTO platform_configs (key, value) VALUES ('platform_fee_rate', '0.15') ON CONFLICT (key) DO NOTHING`)
	db.Exec(ctx, `INSERT INTO platform_configs (key, value) VALUES ('min_withdrawal_amount', '100') ON CONFLICT (key) DO NOTHING`)
}

func runTestMigrations(t *testing.T, db *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()

	conn, err := db.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire connection for migrations: %v", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())`); err != nil {
		t.Fatalf("create schema_migrations table: %v", err)
	}

	migrationsDir := "migrations"
	candidates := []string{
		filepath.Join("..", "..", "migrations"),
		filepath.Join("..", "..", "..", "migrations"),
	}
	for _, d := range candidates {
		if info, err := os.Stat(d); err == nil && info.IsDir() {
			migrationsDir = d
			break
		}
	}

	files, err := os.ReadDir(migrationsDir)
	if err != nil {
		t.Fatalf("read migrations directory %s: %v", migrationsDir, err)
	}

	var migrations []string
	for _, f := range files {
		if strings.HasSuffix(f.Name(), ".up.sql") {
			migrations = append(migrations, f.Name())
		}
	}
	sort.Strings(migrations)

	for _, name := range migrations {
		version := strings.TrimSuffix(name, ".up.sql")
		var exists bool
		if err := conn.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, version).Scan(&exists); err != nil {
			t.Fatalf("check migration %s: %v", version, err)
		}
		if exists {
			continue
		}
		sql, err := os.ReadFile(filepath.Join(migrationsDir, name))
		if err != nil {
			t.Fatalf("read migration %s: %v", name, err)
		}
		if _, err := conn.Exec(ctx, string(sql)); err != nil {
			t.Fatalf("apply migration %s: %v", name, err)
		}
		if _, err := conn.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			t.Fatalf("record migration %s: %v", name, err)
		}
	}
}

func (e *TestEnv) Do(method, path string, body interface{}) *httptest.ResponseRecorder {
	return e.DoWithToken(method, path, body, e.OperatorToken)
}

func (e *TestEnv) DoNoAuth(method, path string, body interface{}) *httptest.ResponseRecorder {
	return e.DoWithToken(method, path, body, "")
}

func (e *TestEnv) NewUserToken(userID, tenantID string, role domain.UserRole, institutionID *string) string {
	return e.NewTokenWithIdentity(userID, tenantID, role, institutionID, "platform_admin")
}

func (e *TestEnv) NewTokenWithIdentity(userID, tenantID string, role domain.UserRole, institutionID *string, roleCode string) string {
	u := &domain.User{ID: userID, TenantID: &tenantID, Role: role, Username: "aux-user", InstitutionID: institutionID}
	token, _ := middleware.GenerateToken(TestJWTSecret, middleware.TokenInput{User: u, RoleCodes: []string{roleCode}})
	return token
}

func (e *TestEnv) DoWithToken(method, path string, body interface{}, token string) *httptest.ResponseRecorder {
	var reqBody *bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(b)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}

	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	w := httptest.NewRecorder()
	e.Router.ServeHTTP(w, req)
	return w
}

func Unmarshal[T any](w *httptest.ResponseRecorder) (T, error) {
	var v T
	if err := json.NewDecoder(w.Body).Decode(&v); err != nil {
		return v, fmt.Errorf("decode body: %w (status=%d body=%s)", err, w.Code, w.Body.String())
	}
	return v, nil
}

func UnmarshalList[T any](w *httptest.ResponseRecorder) ([]T, int, error) {
	type listResp struct {
		Items []T `json:"items"`
		Total int `json:"total"`
	}
	var v listResp
	if err := json.NewDecoder(w.Body).Decode(&v); err != nil {
		return nil, 0, err
	}
	return v.Items, v.Total, nil
}

func ErrMsg(w *httptest.ResponseRecorder) string {
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	return resp["error"]
}
