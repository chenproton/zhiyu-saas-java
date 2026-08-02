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
	authSvc := service.NewAuthService(svc)
	positionSvc := service.NewPositionService(svc)
	evaluationSvc := service.NewEvaluationService(svc)
	scenarioSvc := service.NewScenarioService(svc)
	lessonContentSvc := service.NewLessonContentService(svc)
	return &Handlers{
		authHandler:                   handler.NewAuthHandler(authSvc, jwtSecret),
		fileHandler:                   fileHandler,
		resourceHandler:               &handler.ResourceHandler{},
		statsHandler:                  &handler.StatsHandler{},
		portalHandler:                 &handler.PortalHandler{Service: positionSvc},
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
		orgTypeHandler:                &handler.OrgTypeHandler{Service: service.NewOrgTypeService(svc), Store: st.OrgTypes()},
		userManagementHandler:         &handler.UserManagementHandler{Service: service.NewUserService(svc)},
		roleHandler:                   &handler.RoleHandler{Service: service.NewRoleService(svc), Store: st.Roles()},
		majorHandler:                  &handler.MajorHandler{Service: service.NewMajorService(svc), Store: st.Majors()},
		industryHandler:               &handler.IndustryHandler{Service: service.NewIndustryService(svc), Store: st.Industries()},
		resourceCodeHandler:           &handler.ResourceCodeHandler{Service: positionSvc},
		logHandler:                    &handler.LogHandler{Service: service.NewLogService(svc)},
		subscriptionHandler:           &handler.SubscriptionHandler{Service: positionSvc},
		staffTitleHandler:             &handler.StaffTitleHandler{Service: service.NewStaffTitleService(svc), Store: st.StaffTitles()},
		userExtensionFieldHandler:     &handler.UserExtensionFieldHandler{Service: service.NewUserExtensionFieldService(svc)},
		userRelationHandler:           &handler.UserRelationHandler{Service: service.NewUserRelationService(svc)},
		workflowHandler:               &handler.WorkflowHandler{Service: positionSvc},
		approvalHandler:               &handler.ApprovalHandler{Service: positionSvc},
		allianceHandler:               &handler.AllianceHandler{Store: st.Alliance()},
		positionHandler:               &handler.PositionHandler{Service: positionSvc, RedisClient: redisClient},
		positionCloneHandler:          &handler.PositionCloneHandler{Service: service.NewPositionCloneService(svc)},
		abilityHandler:                &handler.AbilityHandler{Service: positionSvc},
		positionAbilityHandler:        &handler.PositionAbilityHandler{Service: service.NewPositionConfigService(svc)},
		positionResponsibilityHandler: &handler.PositionResponsibilityHandler{Service: service.NewPositionConfigService(svc)},
		positionCertificateHandler:    &handler.PositionCertificateHandler{Service: service.NewPositionConfigService(svc)},
		certificateLibraryHandler:     &handler.CertificateLibraryHandler{Service: service.NewCertificateLibraryService(svc), Store: st.CertificateLibrary()},
		abilityDomainHandler:          &handler.AbilityDomainHandler{Service: positionSvc},
		jobBatchHandler:               handler.NewJobBatchHandler(positionSvc),
		recommendHandler:              &handler.RecommendHandler{Service: positionSvc},
		learnRoadHandler:              &handler.LearnRoadHandler{Service: service.NewLearnRoadService(svc), Store: st.LearnRoads()},
		jobBannerHandler:              &handler.JobBannerHandler{Service: positionSvc},
		scenarioHandler:               &handler.ScenarioHandler{Service: scenarioSvc, DB: st},
		scenarioCloneHandler:          &handler.ScenarioCloneHandler{Service: scenarioSvc},
		scenarioTaskHandler:           &handler.ScenarioTaskHandler{Service: scenarioSvc},
		taskEvaluationHandler:         &handler.TaskEvaluationHandler{Service: service.NewTaskEvaluationService(svc)},
		taskResourceHandler:           &handler.TaskResourceHandler{Service: service.NewResourceBindingService(svc)},
		taskKnowledgeAbilityHandler:   &handler.TaskKnowledgeAbilityHandler{Service: service.NewScenarioConfigService(svc)},
		scenarioWeightHandler:         &handler.ScenarioWeightHandler{Service: service.NewScenarioConfigService(svc)},
		scenarioGradeHandler:          &handler.ScenarioGradeHandler{Service: service.NewScenarioConfigService(svc)},
		sceneBatchHandler:             handler.NewSceneBatchHandler(scenarioSvc),
		courseHandler:                 &handler.CourseHandler{Service: lessonContentSvc},
		courseCloneHandler:            &handler.CourseCloneHandler{Service: lessonContentSvc},
		knowledgePointHandler:         &handler.KnowledgePointHandler{Service: lessonContentSvc},
		courseNodeHandler:             &handler.CourseNodeHandler{Service: lessonContentSvc},
		nodeEvaluationResultHandler:   &handler.NodeEvaluationResultHandler{Service: service.NewNodeEvaluationResultService(svc)},
		courseResourceHandler:         &handler.CourseResourceHandler{Service: service.NewResourceBindingService(svc)},
		nodeQuizHandler:               &handler.NodeQuizHandler{Service: lessonContentSvc},
		nodeHomeworkHandler:           &handler.NodeHomeworkHandler{Service: lessonContentSvc},
		nodeResourceHandler:           &handler.NodeResourceHandler{Service: service.NewResourceBindingService(svc)},
		hybridModuleHandler:           &handler.HybridModuleHandler{Service: positionSvc},
		courseBatchHandler:            handler.NewCourseBatchHandler(positionSvc),
		lessonBehaviorHandler:         &handler.LessonBehaviorHandler{Service: positionSvc},
		questionBankHandler:           &handler.QuestionBankHandler{Service: evaluationSvc},
		questionHandler:               &handler.QuestionHandler{Service: evaluationSvc},
		examHandler:                   &handler.ExamHandler{Service: evaluationSvc, RedisClient: redisClient},
		examUsageHandler:              &handler.ExamUsageHandler{Service: evaluationSvc},
		examResultHandler:             &handler.ExamResultHandler{Service: evaluationSvc},
		evaluationResultHandler:       &handler.EvaluationResultHandler{Service: evaluationSvc},
		certificationHandler:          &handler.CertificationHandler{Service: evaluationSvc},
		certificationModelHandler:     &handler.CertificationModelHandler{Service: evaluationSvc},
		graduationHandler:             &handler.GraduationHandler{Service: evaluationSvc},
		studentPortraitHandler:        handler.NewStudentPortraitHandler(st),
		microCertHandler:              &handler.MicroCertHandler{Service: service.NewMicroCertService(svc), Store: st.MicroCerts()},
		appealHandler:                 &handler.AppealHandler{Service: evaluationSvc},
		evaluationMethodHandler:       &handler.EvaluationMethodHandler{Service: evaluationSvc},
		evaluationBatchHandler:        handler.NewEvaluationBatchHandler(evaluationSvc),
		randomDrawQuestionHandler:     &handler.RandomDrawQuestionHandler{Service: evaluationSvc},
		landingHandler:                &handler.LandingHandler{Service: positionSvc},
		certGradeHandler:              &handler.CertGradeHandler{Service: evaluationSvc},
		resourceLibraryHandler:        &handler.ResourceLibraryHandler{Service: service.NewResourceService(svc)},
		onSiteQuestionLibraryHandler:  &handler.OnSiteQuestionLibraryHandler{Service: service.NewOnSiteQuestionLibraryService(svc), Store: st.OnSiteQuestions()},
		jobAbilityResultHandler:       handler.NewJobAbilityResultHandler(st),
		affairsTermHandler:            &handler.AffairsTermHandler{Service: positionSvc},
		trainingProgramHandler:        &handler.TrainingProgramHandler{Service: positionSvc},
		teachingPlanHandler:           &handler.TeachingPlanHandler{Service: positionSvc},
		schedulingHandler:             &handler.SchedulingHandler{Service: service.NewAffairsService(svc)},
		scheduleImportHandler:         &handler.ScheduleImportHandler{DB: db},
		programCourseImportHandler:    &handler.ProgramCourseImportHandler{DB: db},
		affairsConfigImportHandler:    &handler.AffairsConfigImportHandler{DB: db},
		affairsBatchHandler:           handler.NewAffairsBatchHandler(positionSvc),
	}
}
