package router

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/store"
)

type Handlers struct {
	authHandler                   *handler.AuthHandler
	fileHandler                   *handler.FileHandler
	institutionHandler            *handler.InstitutionHandler
	resourceHandler               *handler.ResourceHandler
	orderHandler                  *handler.OrderHandler
	bannerHandler                 *handler.BannerHandler
	withdrawalHandler             *handler.WithdrawalHandler
	statsHandler                  *handler.StatsHandler
	portalHandler                 *handler.PortalHandler
	importExportHandler           *handler.ImportExportHandler
	positionImportHandler         *handler.PositionImportHandler
	scenarioImportHandler         *handler.ScenarioImportHandler
	questionBankImportHandler     *handler.QuestionBankImportHandler
	questionImportHandler         *handler.QuestionImportHandler
	examImportHandler             *handler.ExamImportHandler
	resourceImportHandler         *handler.ResourceImportHandler
	resourceExportHandler         *handler.ResourceExportHandler
	courseImportHandler           *handler.CourseImportHandler
	granularCourseImportHandler   *handler.GranularCourseImportHandler
	templateHandler               *handler.TemplateHandler
	scenarioExportHandler         *handler.ScenarioExportHandler
	positionExportHandler         *handler.PositionExportHandler
	tenantHandler                 *handler.TenantHandler
	orgHandler                    *handler.OrgHandler
	orgTypeHandler                *handler.OrgTypeHandler
	userManagementHandler         *handler.UserManagementHandler
	roleHandler                   *handler.RoleHandler
	majorHandler                  *handler.MajorHandler
	industryHandler               *handler.IndustryHandler
	resourceCodeHandler           *handler.ResourceCodeHandler
	logHandler                    *handler.LogHandler
	subscriptionHandler           *handler.SubscriptionHandler
	platformLinkHandler           *handler.PlatformLinkHandler
	appModuleHandler              *handler.AppModuleHandler
	staffTitleHandler             *handler.StaffTitleHandler
	userExtensionFieldHandler     *handler.UserExtensionFieldHandler
	userRelationHandler           *handler.UserRelationHandler
	workflowHandler               *handler.WorkflowHandler
	approvalHandler               *handler.ApprovalHandler
	positionHandler               *handler.PositionHandler
	positionCloneHandler          *handler.PositionCloneHandler
	abilityHandler                *handler.AbilityHandler
	positionAbilityHandler        *handler.PositionAbilityHandler
	positionResponsibilityHandler *handler.PositionResponsibilityHandler
	positionCertificateHandler    *handler.PositionCertificateHandler
	certificateLibraryHandler     *handler.CertificateLibraryHandler
	abilityDomainHandler          *handler.AbilityDomainHandler
	jobBatchHandler               *handler.JobBatchHandler
	recommendHandler              *handler.RecommendHandler
	learnRoadHandler              *handler.LearnRoadHandler
	jobBannerHandler              *handler.JobBannerHandler
	scenarioHandler               *handler.ScenarioHandler
	scenarioCloneHandler          *handler.ScenarioCloneHandler
	scenarioTaskHandler           *handler.ScenarioTaskHandler
	taskEvaluationHandler         *handler.TaskEvaluationHandler
	taskResourceHandler           *handler.TaskResourceHandler
	taskKnowledgeAbilityHandler   *handler.TaskKnowledgeAbilityHandler
	scenarioWeightHandler         *handler.ScenarioWeightHandler
	scenarioGradeHandler          *handler.ScenarioGradeHandler
	sceneBatchHandler             *handler.SceneBatchHandler
	courseHandler                 *handler.CourseHandler
	knowledgePointHandler         *handler.KnowledgePointHandler
	courseNodeHandler             *handler.CourseNodeHandler
	courseResourceHandler         *handler.CourseResourceHandler
	nodeQuizHandler               *handler.NodeQuizHandler
	nodeHomeworkHandler           *handler.NodeHomeworkHandler
	nodeResourceHandler           *handler.NodeResourceHandler
	hybridModuleHandler           *handler.HybridModuleHandler
	courseBatchHandler            *handler.CourseBatchHandler
	lessonBehaviorHandler         *handler.LessonBehaviorHandler
	questionBankHandler           *handler.QuestionBankHandler
	questionHandler               *handler.QuestionHandler
	examHandler                   *handler.ExamHandler
	examUsageHandler              *handler.ExamUsageHandler
	examResultHandler             *handler.ExamResultHandler
	evaluationResultHandler       *handler.EvaluationResultHandler
	certificationHandler          *handler.CertificationHandler
	graduationHandler             *handler.GraduationHandler
	studentPortraitHandler        *handler.StudentPortraitHandler
	microCertHandler              *handler.MicroCertHandler
	appealHandler                 *handler.AppealHandler
	evaluationMethodHandler       *handler.EvaluationMethodHandler
	evaluationBatchHandler        *handler.EvaluationBatchHandler
	randomDrawQuestionHandler     *handler.RandomDrawQuestionHandler
	landingHandler                *handler.LandingHandler
	certGradeHandler              *handler.CertGradeHandler
	resourceLibraryHandler        *handler.ResourceLibraryHandler
	onSiteQuestionLibraryHandler  *handler.OnSiteQuestionLibraryHandler
	jobAbilityResultHandler       *handler.JobAbilityResultHandler
}

func NewHandlers(db *pgxpool.Pool, jwtSecret string, fileHandler *handler.FileHandler) *Handlers {
	return &Handlers{
		authHandler:                   handler.NewAuthHandler(db, jwtSecret),
		fileHandler:                   fileHandler,
		institutionHandler:            &handler.InstitutionHandler{DB: db},
		resourceHandler:               &handler.ResourceHandler{DB: db},
		orderHandler:                  &handler.OrderHandler{DB: db},
		bannerHandler:                 &handler.BannerHandler{DB: db},
		withdrawalHandler:             &handler.WithdrawalHandler{DB: db},
		statsHandler:                  &handler.StatsHandler{DB: db},
		portalHandler:                 &handler.PortalHandler{DB: db},
		importExportHandler:           &handler.ImportExportHandler{DB: db},
		positionImportHandler:         &handler.PositionImportHandler{DB: db},
		scenarioImportHandler:         &handler.ScenarioImportHandler{DB: db},
		questionBankImportHandler:     &handler.QuestionBankImportHandler{DB: db},
		questionImportHandler:         &handler.QuestionImportHandler{DB: db},
		examImportHandler:             &handler.ExamImportHandler{DB: db},
		resourceImportHandler:         &handler.ResourceImportHandler{DB: db},
		resourceExportHandler:         &handler.ResourceExportHandler{DB: db},
		courseImportHandler:           &handler.CourseImportHandler{DB: db},
		granularCourseImportHandler:   &handler.GranularCourseImportHandler{DB: db},
		templateHandler:               &handler.TemplateHandler{DB: db},
		scenarioExportHandler:         &handler.ScenarioExportHandler{DB: db},
		positionExportHandler:         &handler.PositionExportHandler{DB: db},
		tenantHandler:                 &handler.TenantHandler{DB: db},
		orgHandler:                    &handler.OrgHandler{DB: db},
		orgTypeHandler:                &handler.OrgTypeHandler{DB: db, Store: store.NewOrgTypesStore(db)},
		userManagementHandler:         &handler.UserManagementHandler{DB: db},
		roleHandler:                   &handler.RoleHandler{DB: db, Store: store.NewRolesStore(db)},
		majorHandler:                  &handler.MajorHandler{DB: db, Store: store.NewMajorsStore(db)},
		industryHandler:               &handler.IndustryHandler{DB: db, Store: store.NewIndustriesStore(db)},
		resourceCodeHandler:           &handler.ResourceCodeHandler{DB: db},
		logHandler:                    &handler.LogHandler{DB: db},
		subscriptionHandler:           &handler.SubscriptionHandler{DB: db},
		platformLinkHandler:           &handler.PlatformLinkHandler{DB: db, Store: store.NewPlatformLinksStore(db)},
		appModuleHandler:              &handler.AppModuleHandler{DB: db},
		staffTitleHandler:             &handler.StaffTitleHandler{DB: db, Store: store.NewStaffTitlesStore(db)},
		userExtensionFieldHandler:     &handler.UserExtensionFieldHandler{DB: db},
		userRelationHandler:           &handler.UserRelationHandler{DB: db},
		workflowHandler:               &handler.WorkflowHandler{DB: db},
		approvalHandler:               &handler.ApprovalHandler{DB: db},
		positionHandler:               &handler.PositionHandler{DB: db},
		positionCloneHandler:          &handler.PositionCloneHandler{DB: db},
		abilityHandler:                &handler.AbilityHandler{DB: db},
		positionAbilityHandler:        &handler.PositionAbilityHandler{DB: db},
		positionResponsibilityHandler: &handler.PositionResponsibilityHandler{DB: db},
		positionCertificateHandler:    &handler.PositionCertificateHandler{DB: db},
		certificateLibraryHandler:     &handler.CertificateLibraryHandler{DB: db, Store: store.NewCertificateLibraryStore(db)},
		abilityDomainHandler:          &handler.AbilityDomainHandler{DB: db},
		jobBatchHandler:               handler.NewJobBatchHandler(db),
		recommendHandler:              &handler.RecommendHandler{DB: db},
		learnRoadHandler:              &handler.LearnRoadHandler{DB: db, Store: store.NewLearnRoadsStore(db)},
		jobBannerHandler:              &handler.JobBannerHandler{DB: db},
		scenarioHandler:               &handler.ScenarioHandler{DB: db},
		scenarioCloneHandler:          &handler.ScenarioCloneHandler{DB: db},
		scenarioTaskHandler:           &handler.ScenarioTaskHandler{DB: db},
		taskEvaluationHandler:         &handler.TaskEvaluationHandler{DB: db},
		taskResourceHandler:           &handler.TaskResourceHandler{DB: db},
		taskKnowledgeAbilityHandler:   &handler.TaskKnowledgeAbilityHandler{DB: db},
		scenarioWeightHandler:         &handler.ScenarioWeightHandler{DB: db},
		scenarioGradeHandler:          &handler.ScenarioGradeHandler{DB: db},
		sceneBatchHandler:             handler.NewSceneBatchHandler(db),
		courseHandler:                 &handler.CourseHandler{DB: db},
		knowledgePointHandler:         &handler.KnowledgePointHandler{DB: db},
		courseNodeHandler:             &handler.CourseNodeHandler{DB: db},
		courseResourceHandler:         &handler.CourseResourceHandler{DB: db},
		nodeQuizHandler:               &handler.NodeQuizHandler{DB: db},
		nodeHomeworkHandler:           &handler.NodeHomeworkHandler{DB: db},
		nodeResourceHandler:           &handler.NodeResourceHandler{DB: db},
		hybridModuleHandler:           &handler.HybridModuleHandler{DB: db},
		courseBatchHandler:            handler.NewCourseBatchHandler(db),
		lessonBehaviorHandler:         &handler.LessonBehaviorHandler{DB: db},
		questionBankHandler:           &handler.QuestionBankHandler{DB: db},
		questionHandler:               &handler.QuestionHandler{DB: db},
		examHandler:                   &handler.ExamHandler{DB: db},
		examUsageHandler:              &handler.ExamUsageHandler{DB: db},
		examResultHandler:             &handler.ExamResultHandler{DB: db},
		evaluationResultHandler:       &handler.EvaluationResultHandler{DB: db},
		certificationHandler:          &handler.CertificationHandler{DB: db},
		graduationHandler:             &handler.GraduationHandler{DB: db},
		studentPortraitHandler:        handler.NewStudentPortraitHandler(db),
		microCertHandler:              &handler.MicroCertHandler{DB: db, Store: store.NewMicroCertStore(db)},
		appealHandler:                 &handler.AppealHandler{DB: db},
		evaluationMethodHandler:       &handler.EvaluationMethodHandler{DB: db},
		evaluationBatchHandler:        handler.NewEvaluationBatchHandler(db),
		randomDrawQuestionHandler:     &handler.RandomDrawQuestionHandler{DB: db},
		landingHandler:                &handler.LandingHandler{DB: db},
		certGradeHandler:              &handler.CertGradeHandler{DB: db},
		resourceLibraryHandler:        &handler.ResourceLibraryHandler{DB: db},
		onSiteQuestionLibraryHandler:  &handler.OnSiteQuestionLibraryHandler{DB: db, Store: store.NewOnSiteQuestionLibraryStore(db)},
		jobAbilityResultHandler:       handler.NewJobAbilityResultHandler(db),
	}
}
