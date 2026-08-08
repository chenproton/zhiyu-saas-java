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
	"github.com/zhiyu-saas/backend/internal/router"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
	"golang.org/x/crypto/bcrypt"
)

const (
	TestJWTSecret  = "test-secret-key-for-unit-tests"
	TestOperatorID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01"
	TestTenantID   = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02"
)

type TestEnv struct {
	DB            *pgxpool.Pool
	Store         *store.Store
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
		// 安全红线：绝不回退 DATABASE_URL（生产库）。测试会对库执行迁移与 DELETE 种子数据，
		// 误连生产库会造成不可逆数据损失。未显式配置测试库时直接跳过。
		// 明确提示测试被跳过，避免 CI "全绿但零测试"
		fmt.Println("[testhelper] TEST_DATABASE_URL not set — integration tests SKIPPED (CI 请配置测试库)")
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
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

	_ = router.NewHandlers(pool, TestJWTSecret, &handler.FileHandler{UploadDir: ""}, nil)

	st2 := store.New(pool)
	svc2 := service.New(st2)
	authSvc := service.NewAuthService(svc2)
	positionSvc := service.NewPositionService(svc2)
	evaluationSvc := service.NewEvaluationService(svc2)
	scenarioSvc := service.NewScenarioService(svc2)
	lessonContentSvc := service.NewLessonContentService(svc2)

	r := chi.NewRouter()
	r.Route("/api/v1", func(r chi.Router) {
		auth := middleware.JWT(TestJWTSecret)

		authHandler := handler.NewAuthHandler(authSvc, TestJWTSecret)
		r.Post("/auth/login", authHandler.Login)
		r.Post("/auth/portal/login", authHandler.PortalLogin)

		tenantHandler := &handler.TenantHandler{Service: service.NewTenantService(svc2), AdminService: service.NewTenantAdminService(svc2)}
		r.Get("/admin/tenants", tenantHandler.AdminList)
		r.Post("/admin/tenants", tenantHandler.AdminCreate)
		r.Put("/admin/tenants/{id}", tenantHandler.AdminUpdate)
		r.Post("/admin/tenants/{id}/status", tenantHandler.AdminUpdateStatus)
		r.Delete("/admin/tenants/{id}", tenantHandler.AdminDelete)

		r.Get("/admin/tenants/{tenantId}/admins", tenantHandler.AdminListAdmins)
		r.Post("/admin/tenants/{tenantId}/admins", tenantHandler.AdminCreateAdmin)
		r.Put("/admin/tenants/{tenantId}/admins/{id}", tenantHandler.AdminUpdateAdmin)
		r.Delete("/admin/tenants/{tenantId}/admins/{id}", tenantHandler.AdminDeleteAdmin)
		r.Post("/admin/tenants/{tenantId}/admins/{id}/reset-password", tenantHandler.AdminResetPassword)

		r.Group(func(r chi.Router) {
			r.Use(auth)

			r.Get("/auth/me", authHandler.Me)

			statsHandler := &handler.StatsHandler{}
			r.Get("/stats/me", statsHandler.MyStats)

			tenantHandler := &handler.TenantHandler{Service: service.NewTenantService(svc2), AdminService: service.NewTenantAdminService(svc2)}
			r.Get("/tenants", tenantHandler.List)
			r.Get("/tenants/{id}", tenantHandler.Get)
			r.Post("/tenants", tenantHandler.Create)
			r.Put("/tenants/{id}", tenantHandler.Update)
			r.Post("/tenants/{id}/status", tenantHandler.UpdateStatus)

			orgHandler := &handler.OrgHandler{Service: service.NewOrgService(svc2)}
			r.Get("/organizations", orgHandler.List)
			r.Get("/organizations/tree", orgHandler.Tree)
			r.Get("/organizations/{id}", orgHandler.Get)
			r.Post("/organizations", orgHandler.Create)
			r.Put("/organizations/{id}", orgHandler.Update)
			r.Delete("/organizations/{id}", orgHandler.Delete)

			orgTypeHandler := &handler.OrgTypeHandler{Store: st2.OrgTypes()}
			r.Get("/org-types", orgTypeHandler.List)
			r.Get("/org-types/{id}", orgTypeHandler.Get)
			r.Post("/org-types", orgTypeHandler.Create)
			r.Put("/org-types/{id}", orgTypeHandler.Update)
			r.Delete("/org-types/{id}", orgTypeHandler.Delete)

			userManagementHandler := &handler.UserManagementHandler{Service: service.NewUserService(svc2)}
			r.Get("/users", userManagementHandler.List)
			r.Get("/users/{id}", userManagementHandler.Get)
			r.Post("/users", userManagementHandler.Create)
			r.Put("/users/{id}", userManagementHandler.Update)
			r.Delete("/users/{id}", userManagementHandler.Delete)
			r.Post("/users/{id}/status", userManagementHandler.UpdateStatus)
			r.Post("/users/batch", userManagementHandler.BatchCreate)
			r.Put("/portal/workspace/me", userManagementHandler.UpdateMe)
			r.Post("/portal/workspace/me/password", userManagementHandler.ChangeMyPassword)

			communityHandler := &handler.CommunityHandler{Service: service.NewCommunityService(svc2)}
			r.Get("/portal/community/topics", communityHandler.ListTopics)
			r.Post("/portal/community/topics", communityHandler.CreateTopic)
			r.Get("/portal/community/topics/{id}", communityHandler.GetTopic)
			r.Get("/portal/community/topics/{id}/replies", communityHandler.ListReplies)
			r.Post("/portal/community/topics/{id}/replies", communityHandler.CreateReply)

			roleHandler := &handler.RoleHandler{Store: st2.Roles()}
			r.Get("/roles", roleHandler.List)
			r.Get("/roles/{id}", roleHandler.Get)
			r.Post("/roles", roleHandler.Create)
			r.Put("/roles/{id}", roleHandler.Update)
			r.Delete("/roles/{id}", roleHandler.Delete)
			r.Post("/roles/{id}/assign", roleHandler.Assign)

			majorHandler := &handler.MajorHandler{Store: st2.Majors()}
			r.Get("/majors", majorHandler.List)
			r.Get("/majors/{id}", majorHandler.Get)
			r.Post("/majors", majorHandler.Create)
			r.Put("/majors/{id}", majorHandler.Update)
			r.Delete("/majors/{id}", majorHandler.Delete)

			industryHandler := &handler.IndustryHandler{Store: st2.Industries()}
			r.Get("/industries", industryHandler.List)
			r.Get("/industries/{id}", industryHandler.Get)
			r.Post("/industries", industryHandler.Create)
			r.Put("/industries/{id}", industryHandler.Update)
			r.Delete("/industries/{id}", industryHandler.Delete)

			resourceCodeHandler := &handler.ResourceCodeHandler{Service: service.NewPortalService(svc2)}
			r.Get("/resource-codes", resourceCodeHandler.List)
			r.Get("/resource-codes/{id}", resourceCodeHandler.Get)

			logHandler := &handler.LogHandler{Service: service.NewLogService(svc2)}
			r.Get("/logs/login", logHandler.LoginLogs)
			r.Get("/logs/operation", logHandler.OperationLogs)

			subscriptionHandler := &handler.SubscriptionHandler{Service: service.NewPortalService(svc2)}
			r.Get("/subscriptions", subscriptionHandler.Get)
			r.Put("/subscriptions/{id}", subscriptionHandler.Update)

			positionHandler := &handler.PositionHandler{Service: positionSvc}
			positionCloneHandler := &handler.PositionCloneHandler{Service: service.NewPositionCloneService(svc2)}
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
			r.Post("/job/positions/{id}/clone", positionCloneHandler.Clone)
			r.Get("/job/public/positions", positionHandler.PublicList)
			r.Get("/job/public/positions/{id}", positionHandler.PublicGet)
			r.Get("/job/positions/favorites", positionHandler.ListFavorites)
			r.Get("/job/positions/{id}/favorite", positionHandler.GetFavorite)
			r.Post("/job/positions/{id}/favorite", positionHandler.ToggleFavorite)

			favoritesHandler := &handler.FavoritesHandler{Service: service.NewFavoritesService(svc2)}
			r.Get("/favorites", favoritesHandler.List)
			r.Get("/favorites/{targetType}/{id}", favoritesHandler.GetFavorite)
			r.Post("/favorites/{targetType}/{id}", favoritesHandler.ToggleFavorite)

			abilityHandler := &handler.AbilityHandler{Service: positionSvc}
			r.Get("/job/abilities", abilityHandler.List)
			r.Get("/job/abilities/citation-stats", abilityHandler.CitationStats)
			r.Get("/job/abilities/uncited", abilityHandler.UncitedList)
			r.Get("/job/abilities/{id}", abilityHandler.Get)
			r.Post("/job/abilities", abilityHandler.Create)
			r.Put("/job/abilities/{id}", abilityHandler.Update)
			r.Delete("/job/abilities/{id}", abilityHandler.Delete)

			positionAbilityHandler := &handler.PositionAbilityHandler{Service: service.NewPositionConfigService(svc2)}
			r.Get("/job/position-abilities", positionAbilityHandler.ListBindings)
			r.Post("/job/position-abilities", positionAbilityHandler.CreateBinding)
			r.Put("/job/position-abilities/{id}", positionAbilityHandler.UpdateBinding)
			r.Delete("/job/position-abilities/{id}", positionAbilityHandler.DeleteBinding)

			positionResponsibilityHandler := &handler.PositionResponsibilityHandler{Service: service.NewPositionConfigService(svc2)}
			r.Get("/job/position-responsibilities", positionResponsibilityHandler.List)
			r.Get("/job/position-responsibilities/{id}", positionResponsibilityHandler.Get)
			r.Post("/job/position-responsibilities", positionResponsibilityHandler.Create)
			r.Put("/job/position-responsibilities/{id}", positionResponsibilityHandler.Update)
			r.Delete("/job/position-responsibilities/{id}", positionResponsibilityHandler.Delete)

			positionCertificateHandler := &handler.PositionCertificateHandler{Service: service.NewPositionConfigService(svc2)}
			r.Get("/job/position-certificates", positionCertificateHandler.List)
			r.Get("/job/position-certificates/{id}", positionCertificateHandler.Get)
			r.Post("/job/position-certificates", positionCertificateHandler.Create)
			r.Put("/job/position-certificates/{id}", positionCertificateHandler.Update)
			r.Delete("/job/position-certificates/{id}", positionCertificateHandler.Delete)

			resourceLibraryHandler := &handler.ResourceLibraryHandler{Service: service.NewResourceService(svc2)}
			r.Get("/library/resources", resourceLibraryHandler.List)
			r.Get("/library/resources/stats", resourceLibraryHandler.Stats)
			r.Get("/library/resources/citation-stats", resourceLibraryHandler.CitationStats)
			r.Get("/library/resources/uncited", resourceLibraryHandler.UncitedList)
			r.Get("/library/resources/{id}", resourceLibraryHandler.Get)
			r.Post("/library/resources", resourceLibraryHandler.Create)
			r.Put("/library/resources/{id}", resourceLibraryHandler.Update)
			r.Delete("/library/resources/{id}", resourceLibraryHandler.Delete)

			certificateLibraryHandler := &handler.CertificateLibraryHandler{Store: st2.CertificateLibrary()}
			r.Get("/job/certificate-library", certificateLibraryHandler.List)
			r.Get("/job/certificate-library/citation-stats", certificateLibraryHandler.CitationStats)
			r.Get("/job/certificate-library/uncited", certificateLibraryHandler.UncitedList)
			r.Get("/job/certificate-library/{id}", certificateLibraryHandler.Get)
			r.Post("/job/certificate-library", certificateLibraryHandler.Create)
			r.Put("/job/certificate-library/{id}", certificateLibraryHandler.Update)
			r.Delete("/job/certificate-library/{id}", certificateLibraryHandler.Delete)

			abilityDomainHandler := &handler.AbilityDomainHandler{Service: positionSvc}
			r.Get("/job/ability-domains", abilityDomainHandler.List)
			r.Post("/job/ability-domains", abilityDomainHandler.Create)
			r.Put("/job/ability-domains/{id}", abilityDomainHandler.Update)
			r.Delete("/job/ability-domains/{id}", abilityDomainHandler.Delete)

			jobBatchHandler := handler.NewJobBatchHandler(positionSvc)
			r.Get("/job/batches", jobBatchHandler.List)
			r.Get("/job/batches/{id}", jobBatchHandler.Get)
			r.Post("/job/batches", jobBatchHandler.Create)
			r.Put("/job/batches/{id}", jobBatchHandler.Update)
			r.Delete("/job/batches/{id}", jobBatchHandler.Delete)
			r.Post("/job/batches/{id}/status", jobBatchHandler.UpdateStatus)

			recommendHandler := &handler.RecommendHandler{Service: positionSvc}
			r.Get("/job/recommendations", recommendHandler.List)
			r.Post("/job/recommendations", recommendHandler.Create)
			r.Put("/job/recommendations/{id}", recommendHandler.Update)
			r.Delete("/job/recommendations/{id}", recommendHandler.Delete)

			learnRoadHandler := &handler.LearnRoadHandler{Store: st2.LearnRoads()}
			r.Get("/job/learn-roads", learnRoadHandler.List)
			r.Get("/job/learn-roads/{id}", learnRoadHandler.Get)
			r.Post("/job/learn-roads", learnRoadHandler.Create)
			r.Put("/job/learn-roads/{id}", learnRoadHandler.Update)
			r.Delete("/job/learn-roads/{id}", learnRoadHandler.Delete)

			scenarioHandler := &handler.ScenarioHandler{Service: scenarioSvc, DB: st2}
			scenarioCloneHandler := &handler.ScenarioCloneHandler{Service: scenarioSvc}
			r.Get("/scene/scenarios", scenarioHandler.List)
			r.Get("/scene/scenarios/{id}", scenarioHandler.Get)
			r.Post("/scene/scenarios", scenarioHandler.Create)
			r.Put("/scene/scenarios/{id}", scenarioHandler.Update)
			r.Delete("/scene/scenarios/{id}", scenarioHandler.Delete)
			r.Post("/scene/scenarios/{id}/submit", scenarioHandler.Submit)
			r.Post("/scene/scenarios/{id}/review", scenarioHandler.Review)
			r.Post("/scene/scenarios/{id}/publish", scenarioHandler.Publish)
			r.Post("/scene/scenarios/{id}/archive", scenarioHandler.Archive)
			r.Post("/scene/scenarios/{id}/clone", scenarioCloneHandler.Clone)

			scenarioTaskHandler := &handler.ScenarioTaskHandler{Service: scenarioSvc}
			r.Get("/scene/tasks", scenarioTaskHandler.List)
			r.Get("/scene/tasks/{id}", scenarioTaskHandler.Get)
			r.Post("/scene/tasks", scenarioTaskHandler.Create)
			r.Put("/scene/tasks/{id}", scenarioTaskHandler.Update)
			r.Delete("/scene/tasks/{id}", scenarioTaskHandler.Delete)
			r.Post("/scene/tasks/reorder", scenarioTaskHandler.Reorder)

			taskEvaluationHandler := &handler.TaskEvaluationHandler{Service: service.NewTaskEvaluationService(svc2)}
			r.Get("/scene/tasks/{taskId}/evaluation-methods", taskEvaluationHandler.ListMethods)
			r.Put("/scene/tasks/{taskId}/evaluation-methods", taskEvaluationHandler.SaveMethods)
			r.Get("/scene/rubric-templates", taskEvaluationHandler.ListTemplates)
			r.Post("/scene/rubric-templates", taskEvaluationHandler.CreateTemplate)
			r.Get("/scene/rubric-templates/{id}", taskEvaluationHandler.GetTemplate)
			r.Put("/scene/rubric-templates/{id}", taskEvaluationHandler.UpdateTemplate)
			r.Delete("/scene/rubric-templates/{id}", taskEvaluationHandler.DeleteTemplate)

			taskResourceHandler := &handler.TaskResourceHandler{Service: service.NewResourceBindingService(svc2)}
			r.Get("/scene/task-resources", taskResourceHandler.ListResources)
			r.Post("/scene/task-resources", taskResourceHandler.BindResource)
			r.Post("/scene/task-resources/create", taskResourceHandler.Create)
			r.Delete("/scene/task-resources/{id}", taskResourceHandler.UnbindResource)

			taskKnowledgeAbilityHandler := &handler.TaskKnowledgeAbilityHandler{Service: service.NewScenarioConfigService(svc2)}
			r.Post("/scene/task-bindings/knowledge", taskKnowledgeAbilityHandler.BindKnowledge)
			r.Delete("/scene/task-bindings/knowledge/{id}", taskKnowledgeAbilityHandler.UnbindKnowledge)
			r.Post("/scene/task-bindings/ability", taskKnowledgeAbilityHandler.BindAbility)
			r.Delete("/scene/task-bindings/ability/{id}", taskKnowledgeAbilityHandler.UnbindAbility)

			scenarioWeightHandler := &handler.ScenarioWeightHandler{Service: service.NewScenarioConfigService(svc2)}
			r.Get("/scene/weights", scenarioWeightHandler.ListWeights)
			r.Post("/scene/weights", scenarioWeightHandler.UpsertWeight)
			r.Put("/scene/weights/{id}", scenarioWeightHandler.UpsertWeight)

			scenarioGradeHandler := &handler.ScenarioGradeHandler{Service: service.NewScenarioConfigService(svc2)}
			r.Get("/scene/grade-mappings", scenarioGradeHandler.ListGradeMappings)
			r.Post("/scene/grade-mappings", scenarioGradeHandler.UpsertGradeMapping)
			r.Put("/scene/grade-mappings/{id}", scenarioGradeHandler.UpsertGradeMapping)

			courseHandler := &handler.CourseHandler{Service: lessonContentSvc}
			r.Get("/lesson/courses", courseHandler.List)
			r.Get("/lesson/courses/{id}", courseHandler.Get)
			r.Post("/lesson/courses", courseHandler.Create)
			r.Put("/lesson/courses/{id}", courseHandler.Update)
			r.Delete("/lesson/courses/{id}", courseHandler.Delete)
			r.Post("/lesson/courses/{id}/submit", courseHandler.Submit)
			r.Post("/lesson/courses/{id}/review", courseHandler.Review)
			r.Post("/lesson/courses/{id}/publish", courseHandler.Publish)
			r.Post("/lesson/courses/{id}/clone", (&handler.CourseCloneHandler{Service: lessonContentSvc}).Clone)

			knowledgePointHandler := &handler.KnowledgePointHandler{Service: lessonContentSvc}
			r.Get("/lesson/knowledge-points", knowledgePointHandler.List)
			r.Get("/lesson/knowledge-points/citation-stats", knowledgePointHandler.CitationStats)
			r.Get("/lesson/knowledge-points/uncited", knowledgePointHandler.UncitedList)
			r.Get("/lesson/knowledge-points/{id}", knowledgePointHandler.Get)
			r.Post("/lesson/knowledge-points", knowledgePointHandler.Create)
			r.Put("/lesson/knowledge-points/{id}", knowledgePointHandler.Update)
			r.Delete("/lesson/knowledge-points/{id}", knowledgePointHandler.Delete)

			courseNodeHandler := &handler.CourseNodeHandler{Service: lessonContentSvc}
			r.Get("/lesson/nodes", courseNodeHandler.List)
			r.Get("/lesson/nodes/{id}", courseNodeHandler.Get)
			r.Post("/lesson/nodes", courseNodeHandler.Create)
			r.Put("/lesson/nodes/{id}", courseNodeHandler.Update)
			r.Delete("/lesson/nodes/{id}", courseNodeHandler.Delete)
			r.Post("/lesson/nodes/reorder", courseNodeHandler.Reorder)

			nodeQuizHandler := &handler.NodeQuizHandler{Service: lessonContentSvc}
			r.Get("/lesson/quizzes", nodeQuizHandler.ListQuizzes)
			r.Post("/lesson/quizzes", nodeQuizHandler.CreateQuiz)
			r.Get("/lesson/quizzes/{id}", nodeQuizHandler.ListQuestions)
			r.Put("/lesson/quizzes/{id}", nodeQuizHandler.UpdateQuiz)
			r.Delete("/lesson/quizzes/{id}", nodeQuizHandler.DeleteQuiz)
			r.Post("/lesson/quizzes/{id}/questions", nodeQuizHandler.AddQuestion)
			r.Put("/lesson/quizzes/questions/{questionId}", nodeQuizHandler.UpdateQuestion)
			r.Delete("/lesson/quizzes/questions/{questionId}", nodeQuizHandler.DeleteQuestion)

			nodeHomeworkHandler := &handler.NodeHomeworkHandler{Service: lessonContentSvc}
			r.Get("/lesson/homeworks", nodeHomeworkHandler.List)
			r.Get("/lesson/homeworks/{id}", nodeHomeworkHandler.Get)
			r.Post("/lesson/homeworks", nodeHomeworkHandler.Create)
			r.Put("/lesson/homeworks/{id}", nodeHomeworkHandler.Update)
			r.Delete("/lesson/homeworks/{id}", nodeHomeworkHandler.Delete)

			hybridModuleHandler := &handler.HybridModuleHandler{Service: lessonContentSvc}
			r.Get("/lesson/hybrid-modules", hybridModuleHandler.ListModules)
			r.Post("/lesson/hybrid-modules", hybridModuleHandler.UpsertModule)
			r.Put("/lesson/hybrid-modules/{id}", hybridModuleHandler.UpsertModule)
			r.Delete("/lesson/hybrid-modules/{id}", hybridModuleHandler.DeleteModule)

			courseBatchHandler := handler.NewCourseBatchHandler(positionSvc)
			r.Get("/lesson/batches", courseBatchHandler.List)
			r.Get("/lesson/batches/{id}", courseBatchHandler.Get)
			r.Post("/lesson/batches", courseBatchHandler.Create)
			r.Put("/lesson/batches/{id}", courseBatchHandler.Update)
			r.Delete("/lesson/batches/{id}", courseBatchHandler.Delete)
			r.Post("/lesson/batches/{id}/status", courseBatchHandler.UpdateStatus)

			questionBankHandler := &handler.QuestionBankHandler{Service: evaluationSvc}
			r.Get("/evaluation/question-banks", questionBankHandler.List)
			r.Get("/evaluation/question-banks/{id}", questionBankHandler.Get)
			r.Post("/evaluation/question-banks", questionBankHandler.Create)
			r.Put("/evaluation/question-banks/{id}", questionBankHandler.Update)
			r.Delete("/evaluation/question-banks/{id}", questionBankHandler.Delete)

			questionHandler := &handler.QuestionHandler{Service: evaluationSvc}
			r.Get("/evaluation/questions", questionHandler.List)
			r.Get("/evaluation/questions/{id}", questionHandler.Get)
			r.Post("/evaluation/questions", questionHandler.Create)
			r.Put("/evaluation/questions/{id}", questionHandler.Update)
			r.Delete("/evaluation/questions/{id}", questionHandler.Delete)
			r.Post("/evaluation/questions/batch", questionHandler.BatchCreate)

			examHandler := &handler.ExamHandler{Service: evaluationSvc}
			r.Get("/evaluation/exams", examHandler.List)
			r.Get("/evaluation/exams/{id}", examHandler.Get)
			r.Post("/evaluation/exams", examHandler.Create)
			r.Put("/evaluation/exams/{id}", examHandler.Update)
			r.Delete("/evaluation/exams/{id}", examHandler.Delete)
			r.Post("/evaluation/exams/{id}/questions", examHandler.AddQuestion)
			r.Delete("/evaluation/exams/{id}/questions/{questionId}", examHandler.RemoveQuestion)

			examUsageHandler := &handler.ExamUsageHandler{Service: evaluationSvc}
			r.Get("/evaluation/exam-usages", examUsageHandler.List)
			r.Get("/evaluation/exam-usages/{id}", examUsageHandler.Get)
			r.Post("/evaluation/exam-usages", examUsageHandler.Create)
			r.Put("/evaluation/exam-usages/{id}", examUsageHandler.Update)
			r.Delete("/evaluation/exam-usages/{id}", examUsageHandler.Delete)
			r.Post("/evaluation/exam-usages/{id}/publish", examUsageHandler.Publish)
			r.Post("/evaluation/exam-usages/{id}/finish", examUsageHandler.Finish)

			evaluationResultHandler := &handler.EvaluationResultHandler{Service: evaluationSvc}
			r.Get("/evaluation/results", evaluationResultHandler.List)
			r.Post("/evaluation/results", evaluationResultHandler.Submit)
			r.Get("/evaluation/results/{id}", evaluationResultHandler.Get)
			r.Post("/evaluation/results/{id}/grade", evaluationResultHandler.Grade)
			r.Post("/evaluation/results/batch-grade", evaluationResultHandler.BatchGrade)

			certificationHandler := &handler.CertificationHandler{Service: evaluationSvc}
			r.Get("/evaluation/certifications", certificationHandler.ListRules)
			r.Get("/evaluation/certifications/{id}", certificationHandler.GetRule)
			r.Post("/evaluation/certifications", certificationHandler.CreateRule)
			r.Put("/evaluation/certifications/{id}", certificationHandler.UpdateRule)
			r.Delete("/evaluation/certifications/{id}", certificationHandler.DeleteRule)
			r.Get("/evaluation/certifications/{id}/items", certificationHandler.ConfigItems)
			r.Post("/evaluation/certifications/{id}/items", certificationHandler.ConfigItems)
			r.Get("/evaluation/certifications/items/{id}/points", certificationHandler.ConfigPoints)
			r.Post("/evaluation/certifications/items/{id}/points", certificationHandler.ConfigPoints)

			graduationHandler := &handler.GraduationHandler{Service: evaluationSvc}
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

			studentPortraitHandler := handler.NewStudentPortraitHandler(st2)
			r.Get("/evaluation/portraits", studentPortraitHandler.List)
			r.Get("/evaluation/portraits/student-dashboard", studentPortraitHandler.StudentDashboard)
			r.Get("/evaluation/portraits/{id}", studentPortraitHandler.Get)
			r.Post("/evaluation/portraits/generate", studentPortraitHandler.Generate)
			r.Get("/evaluation/portraits/archives", studentPortraitHandler.ListArchives)
			r.Post("/evaluation/portraits/archives", studentPortraitHandler.CreateArchive)

			jobAbilityResultHandler := handler.NewJobAbilityResultHandler(st2)
			r.Get("/evaluation/job-ability/results/summary", jobAbilityResultHandler.Summary)
			r.Get("/evaluation/job-ability/results", jobAbilityResultHandler.List)
			r.Get("/evaluation/job-ability/results/{id}", jobAbilityResultHandler.Get)
			r.Post("/evaluation/job-ability/aggregate", jobAbilityResultHandler.Aggregate)
			r.Get("/evaluation/job-ability/aggregate/status", jobAbilityResultHandler.AggregateStatus)

			studentHonorHandler := handler.NewStudentHonorHandler(st2)
			r.Get("/portal/workspace/honors", studentHonorHandler.List)
			r.Post("/portal/workspace/honors", studentHonorHandler.Create)
			r.Put("/portal/workspace/honors/{id}", studentHonorHandler.Update)
			r.Delete("/portal/workspace/honors/{id}", studentHonorHandler.Delete)

			certificationModelHandler := &handler.CertificationModelHandler{Service: evaluationSvc}
			r.Get("/evaluation/certifications/positions/{positionId}/model", certificationModelHandler.GetModel)
			r.Put("/evaluation/certifications/positions/{positionId}/weights", certificationModelHandler.PutWeights)
			r.Put("/evaluation/certifications/positions/{positionId}/points/{abilityPointId}/levels", certificationModelHandler.PutPointLevels)

			microCertHandler := &handler.MicroCertHandler{Store: st2.MicroCerts()}
			r.Get("/evaluation/certificates/templates", microCertHandler.ListTemplates)
			r.Post("/evaluation/certificates/templates", microCertHandler.CreateTemplate)
			r.Get("/evaluation/certificates/templates/{id}", microCertHandler.ListTemplates)
			r.Put("/evaluation/certificates/templates/{id}", microCertHandler.UpdateTemplate)
			r.Delete("/evaluation/certificates/templates/{id}", microCertHandler.DeleteTemplate)
			r.Post("/evaluation/certificates/issue", microCertHandler.IssueCerts)
			r.Get("/evaluation/certificates/history", microCertHandler.ListHistory)

			evaluationMethodHandler := &handler.EvaluationMethodHandler{Service: evaluationSvc}
			r.Get("/evaluation/methods/categories", evaluationMethodHandler.ListCategories)
			r.Get("/evaluation/methods", evaluationMethodHandler.ListMethods)
			r.Post("/evaluation/methods/{id}/toggle", evaluationMethodHandler.Toggle)

			appealHandler := &handler.AppealHandler{Service: evaluationSvc}
			r.Get("/evaluation/appeals", appealHandler.List)
			r.Get("/evaluation/appeals/{id}", appealHandler.Get)
			r.Post("/evaluation/appeals", appealHandler.Create)
			r.Post("/evaluation/appeals/{id}/process", appealHandler.Process)
		})
	})

	generateTestToken := func(userID, tenantID string, role domain.UserRole) string {
		u := &domain.User{ID: userID, TenantID: &tenantID, Role: role, Username: "test-user"}
		token, _ := middleware.GenerateToken(TestJWTSecret, middleware.TokenInput{User: u, RoleCodes: []string{domain.RolePlatformAdmin}})
		return token
	}

	operatorToken := generateTestToken(TestOperatorID, TestTenantID, domain.UserRoleOperator)

	ensureSeedData(t, pool, operatorToken)

	return &TestEnv{
		DB:            pool,
		Store:         st2,
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
	// 注意：先删引用方（archives/evaluations 的 FK 指向 topics），否则 topics 删除会因 FK 失败
	tables := []string{
		// 引用方优先（FK 依赖），再删主体
		"graduation_project_archives", "graduation_project_evaluations", "graduation_query_results",
		"learn_roads", "graduation_project_topics", "workflows",
		"exam_results", "exam_questions", "exam_usages", "question_banks", "exams",
		"node_knowledge_point_bindings", "node_resource_bindings", "node_homework_submissions", "node_homeworks", "node_quizzes",
		"system_course_nodes", "course_knowledge_bindings", "course_resource_bindings", "course_homework_submissions", "course_homeworks",
		"training_program_courses", "training_programs", "courses",
		"scene_evaluation_results", "course_evaluation_results", "task_evaluation_methods", "scenario_tasks", "scenarios",
		"position_ability_bindings", "position_responsibilities", "position_certificates", "career_position_majors",
		"career_positions", "ability_domains", "ability_points", "knowledge_points", "resource_library", "tags",
		"resource_tag_relations", "user_favorites", "favorite_counters", "view_counters",
		"community_topics", "community_posts", "on_site_question_library",
		"schedule_entries", "teaching_plan_entry_classes", "teaching_plan_entries", "teaching_plans",
		"period_slots", "venues", "terms",
		"staff_titles", "industries", "majors", "org_types", "organizations",
		"lesson_batches", "scene_batches", "evaluation_batches", "affairs_batches",
		"micro_cert_templates", "cert_issuance_records",
		"certification_rules", "certification_ability_items", "certification_ability_points",
		"appeal_records", "user_relations", "hybrid_node_modules", "job_ability_results", "student_honors",
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
	return e.NewTokenWithIdentity(userID, tenantID, role, institutionID, domain.RolePlatformAdmin)
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
