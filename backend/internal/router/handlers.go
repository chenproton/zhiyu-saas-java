package router

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type Handlers struct {
	authHandler                   *handler.AuthHandler
	fileHandler                   *handler.FileHandler
	resourceHandler               *handler.ResourceHandler
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
	courseExportHandler           *handler.CourseExportHandler
	granularCourseExportHandler   *handler.GranularCourseExportHandler
	questionBankExportHandler     *handler.QuestionBankExportHandler
	questionExportHandler         *handler.QuestionExportHandler
	examExportHandler             *handler.ExamExportHandler
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
	staffTitleHandler             *handler.StaffTitleHandler
	userExtensionFieldHandler     *handler.UserExtensionFieldHandler
	userRelationHandler           *handler.UserRelationHandler
	workflowHandler               *handler.WorkflowHandler
	approvalHandler               *handler.ApprovalHandler
	allianceHandler               *handler.AllianceHandler
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
	courseCloneHandler            *handler.CourseCloneHandler
	knowledgePointHandler         *handler.KnowledgePointHandler
	courseNodeHandler             *handler.CourseNodeHandler
	nodeEvaluationResultHandler   *handler.NodeEvaluationResultHandler
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
	certificationModelHandler     *handler.CertificationModelHandler
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
	affairsTermHandler            *handler.AffairsTermHandler
	trainingProgramHandler        *handler.TrainingProgramHandler
	teachingPlanHandler           *handler.TeachingPlanHandler
	schedulingHandler             *handler.SchedulingHandler
	scheduleImportHandler         *handler.ScheduleImportHandler
	programCourseImportHandler    *handler.ProgramCourseImportHandler
	affairsConfigImportHandler    *handler.AffairsConfigImportHandler
	affairsBatchHandler           *handler.AffairsBatchHandler
}

func NewHandlers(db *pgxpool.Pool, jwtSecret string, fileHandler *handler.FileHandler, redisClient *redis.Client) *Handlers {
	st := store.New(db)
	svc := service.New(st)
	return &Handlers{
		authHandler:                   handler.NewAuthHandler(db, jwtSecret),
		fileHandler:                   fileHandler,
		resourceHandler:               &handler.ResourceHandler{DB: db},
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
		courseExportHandler:           &handler.CourseExportHandler{DB: db},
		granularCourseExportHandler:   &handler.GranularCourseExportHandler{DB: db},
		questionBankExportHandler:     &handler.QuestionBankExportHandler{DB: db},
		questionExportHandler:         &handler.QuestionExportHandler{DB: db},
		examExportHandler:             &handler.ExamExportHandler{DB: db},
		tenantHandler:                 &handler.TenantHandler{Service: service.NewTenantService(svc), AdminService: service.NewTenantAdminService(svc)},
		orgHandler:                    &handler.OrgHandler{Service: service.NewOrgService(svc)},
		orgTypeHandler:                &handler.OrgTypeHandler{DB: db, Store: store.NewOrgTypesStore(db)},
		userManagementHandler:         &handler.UserManagementHandler{Service: service.NewUserService(svc)},
		roleHandler:                   &handler.RoleHandler{DB: db, Store: store.NewRolesStore(db)},
		majorHandler:                  &handler.MajorHandler{DB: db, Store: store.NewMajorsStore(db)},
		industryHandler:               &handler.IndustryHandler{DB: db, Store: store.NewIndustriesStore(db)},
		resourceCodeHandler:           &handler.ResourceCodeHandler{DB: db},
		logHandler:                    &handler.LogHandler{DB: db},
		subscriptionHandler:           &handler.SubscriptionHandler{DB: db},
		staffTitleHandler:             &handler.StaffTitleHandler{DB: db, Store: store.NewStaffTitlesStore(db)},
		userExtensionFieldHandler:     &handler.UserExtensionFieldHandler{Service: service.NewUserExtensionFieldService(svc)},
		userRelationHandler:           &handler.UserRelationHandler{Service: service.NewUserRelationService(svc)},
		workflowHandler:               &handler.WorkflowHandler{DB: db},
		approvalHandler:               &handler.ApprovalHandler{DB: db},
		allianceHandler:               &handler.AllianceHandler{Store: store.NewAllianceStore(db)},
		positionHandler:               &handler.PositionHandler{Service: service.NewPositionService(svc), RedisClient: redisClient},
		positionCloneHandler:          &handler.PositionCloneHandler{Service: service.NewPositionCloneService(svc)},
		abilityHandler:                &handler.AbilityHandler{DB: db},
		positionAbilityHandler:        &handler.PositionAbilityHandler{Service: service.NewPositionConfigService(svc)},
		positionResponsibilityHandler: &handler.PositionResponsibilityHandler{Service: service.NewPositionConfigService(svc)},
		positionCertificateHandler:    &handler.PositionCertificateHandler{Service: service.NewPositionConfigService(svc)},
		certificateLibraryHandler:     &handler.CertificateLibraryHandler{DB: db, Store: store.NewCertificateLibraryStore(db)},
		abilityDomainHandler:          &handler.AbilityDomainHandler{DB: db},
		jobBatchHandler:               handler.NewJobBatchHandler(db),
		recommendHandler:              &handler.RecommendHandler{DB: db},
		learnRoadHandler:              &handler.LearnRoadHandler{DB: db, Store: store.NewLearnRoadsStore(db)},
		jobBannerHandler:              &handler.JobBannerHandler{DB: db},
		scenarioHandler:               &handler.ScenarioHandler{Service: service.NewScenarioService(svc), DB: st},
		scenarioCloneHandler:          &handler.ScenarioCloneHandler{Service: service.NewScenarioService(svc)},
		scenarioTaskHandler:           &handler.ScenarioTaskHandler{Service: service.NewScenarioService(svc)},
		taskEvaluationHandler:         &handler.TaskEvaluationHandler{Service: service.NewTaskEvaluationService(svc)},
		taskResourceHandler:           &handler.TaskResourceHandler{Service: service.NewResourceBindingService(svc)},
		taskKnowledgeAbilityHandler:   &handler.TaskKnowledgeAbilityHandler{Service: service.NewScenarioConfigService(svc)},
		scenarioWeightHandler:         &handler.ScenarioWeightHandler{Service: service.NewScenarioConfigService(svc)},
		scenarioGradeHandler:          &handler.ScenarioGradeHandler{Service: service.NewScenarioConfigService(svc)},
		sceneBatchHandler:             handler.NewSceneBatchHandler(db),
		courseHandler:                 &handler.CourseHandler{Service: service.NewLessonContentService(svc), DB: db},
		courseCloneHandler:            &handler.CourseCloneHandler{Service: service.NewLessonContentService(svc)},
		knowledgePointHandler:         &handler.KnowledgePointHandler{Service: service.NewLessonContentService(svc)},
		courseNodeHandler:             &handler.CourseNodeHandler{Service: service.NewLessonContentService(svc)},
		nodeEvaluationResultHandler:   &handler.NodeEvaluationResultHandler{DB: db},
		courseResourceHandler:         &handler.CourseResourceHandler{Service: service.NewResourceBindingService(svc)},
		nodeQuizHandler:               &handler.NodeQuizHandler{Service: service.NewLessonContentService(svc)},
		nodeHomeworkHandler:           &handler.NodeHomeworkHandler{Service: service.NewLessonContentService(svc)},
		nodeResourceHandler:           &handler.NodeResourceHandler{Service: service.NewResourceBindingService(svc)},
		hybridModuleHandler:           &handler.HybridModuleHandler{DB: db},
		courseBatchHandler:            handler.NewCourseBatchHandler(db),
		lessonBehaviorHandler:         &handler.LessonBehaviorHandler{DB: db},
		questionBankHandler:           &handler.QuestionBankHandler{Service: service.NewEvaluationService(svc)},
		questionHandler:               &handler.QuestionHandler{Service: service.NewEvaluationService(svc)},
		examHandler:                   &handler.ExamHandler{DB: db, RedisClient: redisClient},
		examUsageHandler:              &handler.ExamUsageHandler{DB: db},
		examResultHandler:             &handler.ExamResultHandler{DB: db},
		evaluationResultHandler:       &handler.EvaluationResultHandler{DB: db},
		certificationHandler:          &handler.CertificationHandler{DB: db},
		certificationModelHandler:     &handler.CertificationModelHandler{DB: db},
		graduationHandler:             &handler.GraduationHandler{DB: db},
		studentPortraitHandler:        handler.NewStudentPortraitHandler(db),
		microCertHandler:              &handler.MicroCertHandler{DB: db, Store: store.NewMicroCertStore(db)},
		appealHandler:                 &handler.AppealHandler{DB: db},
		evaluationMethodHandler:       &handler.EvaluationMethodHandler{DB: db},
		evaluationBatchHandler:        handler.NewEvaluationBatchHandler(db),
		randomDrawQuestionHandler:     &handler.RandomDrawQuestionHandler{DB: db},
		landingHandler:                &handler.LandingHandler{DB: db},
		certGradeHandler:              &handler.CertGradeHandler{DB: db},
		resourceLibraryHandler:        &handler.ResourceLibraryHandler{Service: service.NewResourceService(svc)},
		onSiteQuestionLibraryHandler:  &handler.OnSiteQuestionLibraryHandler{DB: db, Store: store.NewOnSiteQuestionLibraryStore(db)},
		jobAbilityResultHandler:       handler.NewJobAbilityResultHandler(db),
		affairsTermHandler:            &handler.AffairsTermHandler{DB: db},
		trainingProgramHandler:        &handler.TrainingProgramHandler{DB: db},
		teachingPlanHandler:           &handler.TeachingPlanHandler{DB: db},
		schedulingHandler:             &handler.SchedulingHandler{DB: db},
		scheduleImportHandler:         &handler.ScheduleImportHandler{DB: db},
		programCourseImportHandler:    &handler.ProgramCourseImportHandler{DB: db},
		affairsConfigImportHandler:    &handler.AffairsConfigImportHandler{DB: db},
		affairsBatchHandler:           handler.NewAffairsBatchHandler(db),
	}
}
