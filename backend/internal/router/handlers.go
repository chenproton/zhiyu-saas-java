package router

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/ai"
	"github.com/zhiyu-saas/backend/internal/geo"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type Handlers struct {
	authHandler                   *handler.AuthHandler
	captchaHandler                *handler.CaptchaHandler
	fileHandler                   *handler.FileHandler
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
	aiHandler                     *handler.AIHandler
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
	allianceMentorHandler         *handler.AllianceMentorHandler
	partnerHandler                *handler.PartnerHandler
	partnerCoBuildHandler         *handler.PartnerCoBuildHandler
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
	studentPortraitHandler        *handler.StudentPortraitHandler
	studentHonorHandler           *handler.StudentHonorHandler
	appealHandler                 *handler.AppealHandler
	evaluationBatchHandler        *handler.EvaluationBatchHandler
	randomDrawQuestionHandler     *handler.RandomDrawQuestionHandler
	landingHandler                *handler.LandingHandler
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
	communityHandler              *handler.CommunityHandler
	snapshotHandler               *handler.SnapshotHandler
	settingsHandler               *handler.SettingsHandler
	favoritesHandler              *handler.FavoritesHandler
	tagHandler                    *handler.TagHandler
	captchaSvc                    *service.CaptchaService
}

// AuthHandler 暴露登录处理器：测试环境可关闭/替换验证码挂载（生产调用方无感）。
func (h *Handlers) AuthHandler() *handler.AuthHandler {
	return h.authHandler
}

// CaptchaService 暴露验证码服务：供测试预信任设备、校验验证码行为。
func (h *Handlers) CaptchaService() *service.CaptchaService {
	return h.captchaSvc
}

func NewHandlers(db *pgxpool.Pool, jwtSecret string, fileHandler *handler.FileHandler, redisClient *redis.Client, geo *geo.Searcher, aiSecret, aiSecretPrevious string) *Handlers {
	st := store.New(db)
	svc := service.New(st)
	authSvc := service.NewAuthService(svc)
	authSvc.Geo = geo
	captchaSvc := service.NewCaptchaService(redisClient)
	positionSvc := service.NewPositionService(svc)
	affairsPlanSvc := service.NewAffairsPlanService(svc)
	portalSvc := service.NewPortalService(svc)
	approvalSvc := service.NewApprovalService(svc)
	evaluationSvc := service.NewEvaluationService(svc)
	scenarioSvc := service.NewScenarioService(svc)
	lessonContentSvc := service.NewLessonContentService(svc)
	favoritesSvc := service.NewFavoritesService(svc)
	partnerSvc := service.NewPartnerService(svc)
	authH := handler.NewAuthHandler(authSvc, jwtSecret)
	authH.PartnerService = partnerSvc
	authH.Captcha = captchaSvc
	tenantH := &handler.TenantHandler{Service: service.NewTenantService(svc), AdminService: service.NewTenantAdminService(svc)}
	tenantH.PartnerService = partnerSvc
	allianceH := &handler.AllianceHandler{Store: st.Alliance(), Links: st.AllianceEnterpriseLinks(), Grants: st.AllianceGrants()}
	allianceH.PartnerService = partnerSvc
	return &Handlers{
		authHandler:                   authH,
		captchaHandler:                &handler.CaptchaHandler{Service: captchaSvc},
		captchaSvc:                    captchaSvc,
		fileHandler:                   fileHandler,
		statsHandler:                  &handler.StatsHandler{},
		portalHandler:                 &handler.PortalHandler{Service: positionSvc},
		importExportHandler:           &handler.ImportExportHandler{Store: st, Svc: service.NewCsvImportService(svc)},
		positionImportHandler:         &handler.PositionImportHandler{Svc: service.NewPositionImportService(svc)},
		scenarioImportHandler:         &handler.ScenarioImportHandler{Store: st, RedisClient: redisClient, Svc: service.NewScenarioImportService(svc)},
		questionBankImportHandler:     &handler.QuestionBankImportHandler{Store: st, Svc: service.NewQuestionBankImportService(svc)},
		questionImportHandler:         &handler.QuestionImportHandler{Store: st, Svc: service.NewQuestionImportService(svc)},
		examImportHandler:             &handler.ExamImportHandler{Svc: service.NewExamImportService(svc)},
		resourceImportHandler:         &handler.ResourceImportHandler{Svc: service.NewResourceImportService(svc)},
		resourceExportHandler:         &handler.ResourceExportHandler{Store: st, Svc: service.NewResourceExportService(svc)},
		courseImportHandler:           &handler.CourseImportHandler{Svc: service.NewCourseImportService(svc)},
		granularCourseImportHandler:   &handler.GranularCourseImportHandler{Store: st, Svc: service.NewGranularCourseImportService(svc)},
		templateHandler:               &handler.TemplateHandler{Store: st},
		scenarioExportHandler:         &handler.ScenarioExportHandler{Store: st, Svc: service.NewScenarioExportService(svc)},
		positionExportHandler:         &handler.PositionExportHandler{Store: st, Svc: service.NewPositionExportService(svc)},
		courseExportHandler:           &handler.CourseExportHandler{Store: st, Svc: service.NewCourseExportService(svc)},
		granularCourseExportHandler:   &handler.GranularCourseExportHandler{Store: st},
		questionBankExportHandler:     &handler.QuestionBankExportHandler{Store: st, Svc: service.NewQuestionBankExportService(svc)},
		questionExportHandler:         &handler.QuestionExportHandler{Store: st, Svc: service.NewQuestionExportService(svc)},
		examExportHandler:             &handler.ExamExportHandler{Store: st},
		tenantHandler:                 tenantH,
		aiHandler:                     &handler.AIHandler{Service: service.NewAIService(svc, redisClient, ai.NewClient(), aiSecret, aiSecretPrevious)},
		orgHandler:                    &handler.OrgHandler{Service: service.NewOrgService(svc)},
		orgTypeHandler:                &handler.OrgTypeHandler{Store: st.OrgTypes()},
		userManagementHandler:         &handler.UserManagementHandler{Service: service.NewUserService(svc)},
		roleHandler:                   &handler.RoleHandler{Store: st.Roles()},
		majorHandler:                  &handler.MajorHandler{Store: st.Majors()},
		industryHandler:               &handler.IndustryHandler{Store: st.Industries()},
		resourceCodeHandler:           &handler.ResourceCodeHandler{Service: portalSvc},
		logHandler:                    &handler.LogHandler{Service: service.NewLogService(svc)},
		subscriptionHandler:           &handler.SubscriptionHandler{Service: portalSvc},
		staffTitleHandler:             &handler.StaffTitleHandler{Store: st.StaffTitles()},
		userExtensionFieldHandler:     &handler.UserExtensionFieldHandler{Service: service.NewUserExtensionFieldService(svc)},
		userRelationHandler:           &handler.UserRelationHandler{Service: service.NewUserRelationService(svc)},
		workflowHandler:               &handler.WorkflowHandler{Service: approvalSvc},
		approvalHandler:               &handler.ApprovalHandler{Service: approvalSvc, RedisClient: redisClient},
		allianceHandler:               allianceH,
		allianceMentorHandler:         &handler.AllianceMentorHandler{Service: service.NewAllianceMentorService(svc)},
		partnerHandler:                &handler.PartnerHandler{Service: partnerSvc},
		partnerCoBuildHandler:         &handler.PartnerCoBuildHandler{Service: service.NewPartnerCoBuildService(svc)},
		positionHandler:               &handler.PositionHandler{Service: positionSvc, RedisClient: redisClient},
		positionCloneHandler:          &handler.PositionCloneHandler{Service: service.NewPositionCloneService(svc), RedisClient: redisClient},
		abilityHandler:                &handler.AbilityHandler{Service: positionSvc},
		positionAbilityHandler:        &handler.PositionAbilityHandler{Service: service.NewPositionConfigService(svc)},
		positionResponsibilityHandler: &handler.PositionResponsibilityHandler{Service: service.NewPositionConfigService(svc)},
		positionCertificateHandler:    &handler.PositionCertificateHandler{Service: service.NewPositionConfigService(svc)},
		certificateLibraryHandler:     &handler.CertificateLibraryHandler{Store: st.CertificateLibrary()},
		abilityDomainHandler:          &handler.AbilityDomainHandler{Service: positionSvc},
		jobBatchHandler:               handler.NewJobBatchHandler(positionSvc),
		recommendHandler:              &handler.RecommendHandler{Service: positionSvc},
		learnRoadHandler:              &handler.LearnRoadHandler{Store: st.LearnRoads()},
		jobBannerHandler:              &handler.JobBannerHandler{Service: positionSvc},
		scenarioHandler:               &handler.ScenarioHandler{Service: scenarioSvc, DB: st, RedisClient: redisClient},
		scenarioCloneHandler:          &handler.ScenarioCloneHandler{Service: scenarioSvc, RedisClient: redisClient},
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
		nodeResourceHandler:           &handler.NodeResourceHandler{Service: service.NewResourceBindingService(svc)},
		hybridModuleHandler:           &handler.HybridModuleHandler{Service: lessonContentSvc},
		courseBatchHandler:            handler.NewCourseBatchHandler(positionSvc),
		lessonBehaviorHandler:         &handler.LessonBehaviorHandler{Service: lessonContentSvc, Svc: service.NewLessonBehaviorService(svc)},
		questionBankHandler:           &handler.QuestionBankHandler{Service: evaluationSvc},
		questionHandler:               &handler.QuestionHandler{Service: evaluationSvc},
		examHandler:                   &handler.ExamHandler{Service: evaluationSvc, RedisClient: redisClient},
		examUsageHandler:              &handler.ExamUsageHandler{Service: evaluationSvc},
		examResultHandler:             &handler.ExamResultHandler{Service: evaluationSvc},
		evaluationResultHandler:       &handler.EvaluationResultHandler{Service: evaluationSvc},
		certificationHandler:          &handler.CertificationHandler{Service: evaluationSvc},
		certificationModelHandler:     &handler.CertificationModelHandler{Service: evaluationSvc},
		studentPortraitHandler:        handler.NewStudentPortraitHandler(st),
		studentHonorHandler:           handler.NewStudentHonorHandler(st),
		appealHandler:                 &handler.AppealHandler{Service: evaluationSvc},
		evaluationBatchHandler:        handler.NewEvaluationBatchHandler(evaluationSvc),
		randomDrawQuestionHandler:     &handler.RandomDrawQuestionHandler{Service: evaluationSvc},
		landingHandler:                &handler.LandingHandler{Service: positionSvc},
		resourceLibraryHandler:        &handler.ResourceLibraryHandler{Service: service.NewResourceService(svc)},
		onSiteQuestionLibraryHandler:  &handler.OnSiteQuestionLibraryHandler{Store: st.OnSiteQuestions()},
		jobAbilityResultHandler:       handler.NewJobAbilityResultHandler(st),
		affairsTermHandler:            &handler.AffairsTermHandler{Service: affairsPlanSvc},
		trainingProgramHandler:        &handler.TrainingProgramHandler{Service: affairsPlanSvc},
		teachingPlanHandler:           &handler.TeachingPlanHandler{Service: affairsPlanSvc},
		schedulingHandler:             &handler.SchedulingHandler{Service: service.NewAffairsService(svc)},
		scheduleImportHandler:         &handler.ScheduleImportHandler{Svc: service.NewScheduleImportService(svc)},
		programCourseImportHandler:    &handler.ProgramCourseImportHandler{Store: st, Svc: service.NewProgramCourseImportService(svc)},
		affairsConfigImportHandler:    &handler.AffairsConfigImportHandler{Store: st, Svc: service.NewAffairsConfigImportService(svc)},
		affairsBatchHandler:           handler.NewAffairsBatchHandler(positionSvc),
		communityHandler:              &handler.CommunityHandler{Service: service.NewCommunityService(svc)},
		snapshotHandler:               &handler.SnapshotHandler{Service: service.NewSnapshotService(svc)},
		settingsHandler:               &handler.SettingsHandler{Store: st.PlatformSettings()},
		favoritesHandler:              &handler.FavoritesHandler{Service: favoritesSvc},
		tagHandler:                    &handler.TagHandler{Service: service.NewTagService(svc)},
	}
}
