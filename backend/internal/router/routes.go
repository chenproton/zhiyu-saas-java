package router

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/cache"
	"github.com/zhiyu-saas/backend/internal/domain"
	authmw "github.com/zhiyu-saas/backend/internal/middleware"
)

func RegisterAPIRoutes(r chi.Router, jwtSecret string, db *pgxpool.Pool, h *Handlers, redisClient *redis.Client, oplogBuffer *authmw.OpLogBuffer) {
	r.Route("/api/v1", func(r chi.Router) {
		// 导入/导出/模板生成涉及大文件解析与批量写入，豁免 30s 短超时，
		// 其余接口仍受 30s 保护（statement_timeout=15s 为单语句级别，逐行导入不受影响）
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				d := 30 * time.Second
				if strings.HasPrefix(r.URL.Path, "/api/v1/import/") ||
					strings.HasPrefix(r.URL.Path, "/api/v1/export/") ||
					strings.HasPrefix(r.URL.Path, "/api/v1/templates/") {
					d = 10 * time.Minute
				}
				middleware.Timeout(d)(next).ServeHTTP(w, r)
			})
		})

		RegisterPublicRoutes(r, h, redisClient)
		RegisterAuthenticatedRoutes(r, jwtSecret, db, h, redisClient, oplogBuffer)
	})
}

func RegisterPublicRoutes(r chi.Router, h *Handlers, redisClient *redis.Client) {
	loginLimiter := cache.RateLimit(redisClient, 30, time.Minute)
	r.With(loginLimiter).Post("/auth/login", h.authHandler.Login)
	r.With(loginLimiter).Post("/auth/saas/login", h.authHandler.SaasLogin)
	r.With(loginLimiter).Post("/auth/portal/login", h.authHandler.PortalLogin)
	r.Post("/auth/select-tenant", h.authHandler.SelectTenant)
}

func RegisterAuthenticatedRoutes(r chi.Router, jwtSecret string, db *pgxpool.Pool, h *Handlers, redisClient *redis.Client, oplogBuffer *authmw.OpLogBuffer) {
	auth := authmw.JWT(jwtSecret)
	platformAdmin := authmw.RequireRole(domain.RolePlatformAdmin)
	systemAdmin := authmw.RequireSystemPermission()
	portalWorkspace := authmw.RequireRoleOrMenu(domain.RoleTeacher, domain.RoleStudent, domain.RoleSchoolAdmin)
	businessUser := authmw.RequireRoleOrMenu(domain.RoleTeacher, domain.RoleSchoolAdmin, domain.RoleEnterpriseMentor, domain.RolePlatformAdmin)
	jobViewer := authmw.RequireRoleOrMenu(domain.RoleTeacher, domain.RoleStudent, domain.RoleSchoolAdmin, domain.RoleEnterpriseMentor, domain.RolePlatformAdmin)

	cachedLandingExams := cache.Cached(redisClient, 2*time.Minute, cache.LandingExamsKey())
	cachedPublicPositions := cache.Cached(redisClient, 2*time.Minute, cache.PublicPositionsKey())
	cachedPublicScenarios := cache.Cached(redisClient, 2*time.Minute, cache.PublicScenariosKey())
	cachedDashboard := cache.Cached(redisClient, 30*time.Second, cache.DashboardKey())

	r.Group(func(r chi.Router) {
		r.Use(auth)
		r.Use(authmw.OperationLog(db, oplogBuffer))

		// ========== Portal 教育端（强制 portal 平台 token）==========
		r.Group(func(r chi.Router) {
			r.Use(authmw.RequirePlatform(domain.UserPlatformPortal))

			r.Get("/auth/portal/me", h.authHandler.PortalMe)
			r.Get("/subscriptions", h.subscriptionHandler.Get)

			registerLandingRoutes(r, h, cachedLandingExams)

			// 导入/导出涉及批量数据读写，统一限制为业务角色，学生不可访问
			r.Group(func(r chi.Router) {
				r.Use(businessUser)
				registerImportExportRoutes(r, h)
			})

			r.Group(func(r chi.Router) {
				r.Use(jobViewer)

				registerAlliancePublicRoutes(r, h)

				r.With(cachedPublicPositions).Get("/job/public/positions", h.positionHandler.PublicList)
				r.Get("/job/public/positions/{id}", h.positionHandler.PublicGet)

				// 学生场景学习链路只读接口（写操作仍在 businessUser 组）：
				// 学生从工作台课表进入场景大厅学习并提交测评，需要读取场景/任务/能力点/知识点
				// 场景列表为重查询（3 个 LATERAL 聚合），挂租户级 2min 缓存（键含查询参数）
				r.With(cachedPublicScenarios).Get("/scene/scenarios", h.scenarioHandler.List)
				r.Get("/scene/scenarios/{id}", h.scenarioHandler.Get)
				r.Get("/scene/tasks", h.scenarioTaskHandler.List)
				r.Get("/scene/tasks/{id}", h.scenarioTaskHandler.Get)
				r.Get("/scene/tasks/{taskId}/evaluation-methods", h.taskEvaluationHandler.ListMethods)
				r.Get("/job/abilities", h.abilityHandler.List)
				r.Get("/job/abilities/{id}", h.abilityHandler.Get)
				r.Get("/lesson/knowledge-points", h.knowledgePointHandler.List)
				r.Get("/lesson/knowledge-points/{id}", h.knowledgePointHandler.Get)

				// 学生体系课学习页只读接口（写操作仍限 businessUser）
				r.Get("/lesson/nodes", h.courseNodeHandler.List)
				r.Get("/lesson/nodes/{id}", h.courseNodeHandler.Get)
				r.Get("/lesson/node-evaluation-results", h.nodeEvaluationResultHandler.List)
				r.Post("/lesson/node-evaluation-results", h.nodeEvaluationResultHandler.Submit)
				r.Post("/lesson/nodes/{nodeId}/homeworks/{homeworkId}/submit", h.courseHandler.SubmitNodeHomework)

				// 学生提交/查看本人的场景测评结果；评分仍限 businessUser
				r.Get("/evaluation/results", h.evaluationResultHandler.List)
				r.Post("/evaluation/results", h.evaluationResultHandler.Submit)

				// 学生查看本人的岗位能力汇聚结果
				r.Get("/evaluation/job-ability/results", h.jobAbilityResultHandler.List)
				r.Get("/evaluation/job-ability/course-scores", h.jobAbilityResultHandler.CourseScores)

				// 学生场景任务中查看/作答试卷（仅读）；写操作仍在 businessUser
				registerContentReadRoutes(r, "/evaluation/exams", h.examHandler)
				// 考试安排：学生查询 + 开始考试
				r.Get("/evaluation/exam-usages", h.examUsageHandler.List)
				r.Get("/evaluation/exam-usages/{id}", h.examUsageHandler.Get)
				r.Post("/evaluation/exam-usages/{id}/start", h.examUsageHandler.Start)
				// 学生提交考试结果
				r.Post("/evaluation/exam-results", h.examResultHandler.Create)

				// 学生/教师工作台课表渲染需要节次定义
				r.Get("/affairs/period-slots", h.schedulingHandler.ListPeriodSlots)

			})

			r.Group(func(r chi.Router) {
				r.Use(portalWorkspace)
				// dashboard 内容按 userID 查询，缓存键含 userID（30s TTL），跨用户不串数据
				r.With(cachedDashboard).Get("/portal/workspace/dashboard", h.portalHandler.WorkspaceDashboard)
				r.Get("/portal/workspace/my-schedule", h.schedulingHandler.MySchedule)
				// 学生荣誉（个人中心配置/画像页展示）：学生本人 CRUD，业务用户可读
				r.Get("/portal/workspace/honors", h.studentHonorHandler.List)
				r.Post("/portal/workspace/honors", h.studentHonorHandler.Create)
				r.Put("/portal/workspace/honors/{id}", h.studentHonorHandler.Update)
				r.Delete("/portal/workspace/honors/{id}", h.studentHonorHandler.Delete)
				// 个人中心自助接口：修改本人姓名/密码（学生/教师/学校管理员）
				r.Put("/portal/workspace/me", h.userManagementHandler.UpdateMe)
				r.Post("/portal/workspace/me/password", h.userManagementHandler.ChangeMyPassword)
				// 学习社区：发帖/回复/阅读数（学生/教师/学校管理员）
				r.Get("/portal/community/topics", h.communityHandler.ListTopics)
				r.Post("/portal/community/topics", h.communityHandler.CreateTopic)
				r.Get("/portal/community/topics/{id}", h.communityHandler.GetTopic)
				r.Get("/portal/community/topics/{id}/replies", h.communityHandler.ListReplies)
				r.Post("/portal/community/topics/{id}/replies", h.communityHandler.CreateReply)
			})

			// 学生画像查询对全部业务角色开放（含学生本人），generate/archives 仍限业务用户
			r.Group(func(r chi.Router) {
				r.Use(jobViewer)
				r.Get("/evaluation/portraits", h.studentPortraitHandler.List)
				r.Get("/evaluation/portraits/{id}", h.studentPortraitHandler.Get)
				// 画像页聚合数据（实践场景/推荐岗位/课程成绩）对学生本人开放，handler 内强制本人
				r.Get("/evaluation/portraits/student-dashboard", h.studentPortraitHandler.StudentDashboard)
			})

			r.Group(func(r chi.Router) {
				r.Use(systemAdmin)
				registerPortalRoutes(r, h)
			})

			registerWorkflowRoutes(r, h)

			// 用户列表/详情对业务用户开放读取，写操作仍限系统管理员
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireUserRead())
				r.Get("/users", h.userManagementHandler.List)
				r.Get("/users/{id}", h.userManagementHandler.Get)
			})

			r.Group(func(r chi.Router) {
				r.Use(businessUser)
				registerJobRoutes(r, h)
				registerSceneRoutes(r, h)
				registerLessonRoutes(r, h)
				registerEvaluationRoutes(r, h)
				registerLibraryRoutes(r, h)
				registerAffairsRoutes(r, h)

				// 专业/行业参考数据为各业务模块共用，对业务用户开放只读
				r.Get("/majors", h.majorHandler.List)
				r.Get("/majors/{id}", h.majorHandler.Get)
				r.Get("/industries", h.industryHandler.List)
				r.Get("/industries/{id}", h.industryHandler.Get)

				// 组织架构/组织类型为业务模块共用参考数据（审批流配置选择审批人等），
				// 对业务用户开放只读；写操作仍在 systemAdmin 组内（本组注册在后，
				// 同 method+path 只读路由会覆盖系统管理员组的 GET，POST/PUT/DELETE 不受影响）
				r.Get("/organizations", h.orgHandler.List)
				r.Get("/organizations/tree", h.orgHandler.Tree)
				r.Get("/organizations/{id}", h.orgHandler.Get)
				r.Get("/org-types", h.orgTypeHandler.List)
				r.Get("/org-types/{id}", h.orgTypeHandler.Get)

				// 产教融合（alliance）模块面向业务角色开放（教师/学校管理员/企业导师/
				// 平台管理员，教师菜单含 alliance 全部页面）；原挂 systemAdmin 组，
				// 移入本组后教师可正常执行全部读写与导入操作
				registerAllianceRoutes(r, h)
			})

			// 学生/企业导师等业务角色共用只读接口：在 businessUser 组之后注册，
			// 避免 chi 同 method+path 静默覆盖导致学生只读接口被 businessUser 门禁顶替
			r.Group(func(r chi.Router) {
				r.Use(jobViewer)

				// 课程前台落地页只读接口
				registerContentReadRoutes(r, "/lesson/courses", h.courseHandler)

				// 资源库前台落地页只读接口
				r.Get("/library/resources", h.resourceLibraryHandler.List)
				r.Get("/library/resources/{id}", h.resourceLibraryHandler.Get)
				r.Get("/library/on-site-questions", h.onSiteQuestionLibraryHandler.List)
				r.Get("/library/on-site-questions/{id}", h.onSiteQuestionLibraryHandler.Get)

				// 岗位详情前台只读接口（岗位职责、能力绑定、能力域、证书）
				r.Get("/job/position-responsibilities", h.positionResponsibilityHandler.List)
				r.Get("/job/position-responsibilities/{id}", h.positionResponsibilityHandler.Get)
				r.Get("/job/position-abilities", h.positionAbilityHandler.ListBindings)
				r.Get("/job/ability-domains", h.abilityDomainHandler.List)
				r.Get("/job/ability-domains/{id}", h.abilityDomainHandler.Get)
				r.Get("/job/position-certificates", h.positionCertificateHandler.List)
				r.Get("/job/position-certificates/{id}", h.positionCertificateHandler.Get)

				// 岗位收藏前台接口
				r.Get("/job/positions/{id}/favorite", h.positionHandler.GetFavorite)
				r.Post("/job/positions/{id}/favorite", h.positionHandler.ToggleFavorite)
				r.Get("/job/positions/favorites", h.positionHandler.ListFavorites)

				// 通用收藏前台接口（场景/课程/题库/试卷）
				r.Get("/favorites", h.favoritesHandler.List)
				r.Get("/favorites/{targetType}/{id}", h.favoritesHandler.GetFavorite)
				r.Post("/favorites/{targetType}/{id}", h.favoritesHandler.ToggleFavorite)
			})
		})

		// ========== SaaS 运营端（强制 saas 平台 token）==========
		r.Group(func(r chi.Router) {
			r.Use(authmw.RequirePlatform(domain.UserPlatformSaas))

			r.Get("/auth/me", h.authHandler.SaasMe)
			r.Get("/auth/saas/me", h.authHandler.SaasMe)
			r.Get("/stats/me", h.statsHandler.MyStats)

			r.Group(func(r chi.Router) {
				r.Use(platformAdmin)
				registerSuperAdminRoutes(r, h)
			})
		})
	})
}

func registerSuperAdminRoutes(r chi.Router, h *Handlers) {
	r.Get("/admin/tenants", h.tenantHandler.AdminList)
	r.Post("/admin/tenants", h.tenantHandler.AdminCreate)
	r.Put("/admin/tenants/{id}", h.tenantHandler.AdminUpdate)
	r.Post("/admin/tenants/{id}/status", h.tenantHandler.AdminUpdateStatus)
	r.Delete("/admin/tenants/{id}", h.tenantHandler.AdminDelete)

	r.Get("/admin/tenants/{tenantId}/admins", h.tenantHandler.AdminListAdmins)
	r.Post("/admin/tenants/{tenantId}/admins", h.tenantHandler.AdminCreateAdmin)
	r.Put("/admin/tenants/{tenantId}/admins/{id}", h.tenantHandler.AdminUpdateAdmin)
	r.Delete("/admin/tenants/{tenantId}/admins/{id}", h.tenantHandler.AdminDeleteAdmin)
	r.Post("/admin/tenants/{tenantId}/admins/{id}/reset-password", h.tenantHandler.AdminResetPassword)

	r.Get("/admin/tenants/{tenantId}/subscription", h.subscriptionHandler.AdminGet)
	r.Put("/admin/tenants/{tenantId}/subscription", h.subscriptionHandler.AdminUpdate)

}

func registerWorkflowRoutes(r chi.Router, h *Handlers) {
	r.Group(func(r chi.Router) {
		r.Use(authmw.RequireRoleOrMenu(domain.RoleSchoolAdmin, domain.RoleTeacher))

		r.Get("/workflows", h.workflowHandler.List)
		r.Post("/workflows", h.workflowHandler.Create)
		r.Get("/workflows/{id}", h.workflowHandler.Get)
		r.Put("/workflows/{id}", h.workflowHandler.Update)
		r.Delete("/workflows/{id}", h.workflowHandler.Delete)

		r.Get("/approvals", h.approvalHandler.List)
		r.Post("/approvals", h.approvalHandler.Create)
		r.Get("/approvals/{id}", h.approvalHandler.Get)
		r.Post("/approvals/{id}/review", h.approvalHandler.Review)
	})
}

func registerImportExportRoutes(r chi.Router, h *Handlers) {
	r.Get("/export/{entity}", h.importExportHandler.Export)
	r.Post("/import/{entity}", h.importExportHandler.Import)
	r.Post("/import/{entity}/preview", h.importExportHandler.Preview)
	r.Post("/import/positions/excel", h.positionImportHandler.ImportExcel)
	r.Post("/import/positions/preview", h.positionImportHandler.PreviewExcel)
	r.Post("/import/scenarios/excel", h.scenarioImportHandler.ImportExcel)
	r.Post("/import/scenarios/preview", h.scenarioImportHandler.PreviewExcel)
	r.Post("/import/question-banks/excel", h.questionBankImportHandler.ImportExcel)
	r.Post("/import/question-banks/preview", h.questionBankImportHandler.PreviewExcel)
	r.Post("/import/question-banks/{bankId}/questions/excel", h.questionImportHandler.ImportExcel)
	r.Post("/import/question-banks/{bankId}/questions/preview", h.questionImportHandler.PreviewExcel)
	r.Post("/import/exams/excel", h.examImportHandler.ImportExcel)
	r.Post("/import/exams/preview", h.examImportHandler.PreviewExcel)
	r.Post("/import/courses/excel", h.courseImportHandler.ImportExcel)
	r.Post("/import/courses/preview", h.courseImportHandler.PreviewExcel)
	r.Post("/import/granular-courses/excel", h.granularCourseImportHandler.ImportExcel)
	r.Post("/import/granular-courses/preview", h.granularCourseImportHandler.PreviewExcel)
	r.Post("/import/industries/excel", h.resourceImportHandler.ImportIndustries)
	r.Post("/import/industries/preview", h.resourceImportHandler.PreviewIndustries)
	r.Post("/import/majors/excel", h.resourceImportHandler.ImportMajors)
	r.Post("/import/majors/preview", h.resourceImportHandler.PreviewMajors)
	r.Post("/import/organizations/excel", h.resourceImportHandler.ImportOrganizations)
	r.Post("/import/organizations/preview", h.resourceImportHandler.PreviewOrganizations)
	r.Post("/import/students/excel", h.resourceImportHandler.ImportStudents)
	r.Post("/import/students/preview", h.resourceImportHandler.PreviewStudents)
	r.Post("/import/teachers/excel", h.resourceImportHandler.ImportTeachers)
	r.Post("/import/teachers/preview", h.resourceImportHandler.PreviewTeachers)
	r.Post("/import/alliance-enterprises/excel", h.resourceImportHandler.ImportEnterprises)
	r.Post("/import/alliance-enterprises/preview", h.resourceImportHandler.PreviewEnterprises)
	r.Post("/import/alliance-projects/excel", h.resourceImportHandler.ImportProjects)
	r.Post("/import/alliance-projects/preview", h.resourceImportHandler.PreviewProjects)
	r.Post("/import/alliance-achievements/excel", h.resourceImportHandler.ImportAchievements)
	r.Post("/import/alliance-achievements/preview", h.resourceImportHandler.PreviewAchievements)
	r.Post("/import/alliance-experts/excel", h.resourceImportHandler.ImportExperts)
	r.Post("/import/alliance-experts/preview", h.resourceImportHandler.PreviewExperts)
	r.Post("/import/alliance-agreements/excel", h.resourceImportHandler.ImportAgreements)
	r.Post("/import/alliance-agreements/preview", h.resourceImportHandler.PreviewAgreements)
	r.Post("/import/alliance-permissions/excel", h.resourceImportHandler.ImportPermissions)
	r.Post("/import/alliance-permissions/preview", h.resourceImportHandler.PreviewPermissions)
	r.Post("/import/alliance-brands/excel", h.resourceImportHandler.ImportBrands)
	r.Post("/import/alliance-brands/preview", h.resourceImportHandler.PreviewBrands)
	r.Get("/templates/positions", h.templateHandler.ServePositionTemplate)
	r.Get("/templates/scenarios", h.templateHandler.ServeScenarioTemplate)
	r.Get("/templates/courses", h.templateHandler.ServeSystemCourseTemplate)
	r.Get("/templates/granular-courses", h.templateHandler.ServeGranularCourseTemplate)
	r.Get("/templates/question-banks", h.templateHandler.ServeQuestionBankTemplate)
	r.Get("/templates/question-banks/{bankId}/questions", h.templateHandler.ServeQuestionTemplate)
	r.Get("/templates/exams", h.templateHandler.ServeExamTemplate)
	r.Get("/templates/industries", h.templateHandler.ServeIndustryTemplate)
	r.Get("/templates/majors", h.templateHandler.ServeMajorTemplate)
	r.Get("/templates/organizations", h.templateHandler.ServeOrganizationTemplate)
	r.Get("/templates/students", h.templateHandler.ServeStudentTemplate)
	r.Get("/templates/teachers", h.templateHandler.ServeTeacherTemplate)
	r.Get("/templates/alliance-enterprises", h.templateHandler.ServeEnterpriseTemplate)
	r.Get("/templates/alliance-projects", h.templateHandler.ServeProjectTemplate)
	r.Get("/templates/alliance-achievements", h.templateHandler.ServeAchievementTemplate)
	r.Get("/templates/alliance-experts", h.templateHandler.ServeExpertTemplate)
	r.Get("/templates/alliance-agreements", h.templateHandler.ServeAgreementTemplate)
	r.Get("/templates/alliance-permissions", h.templateHandler.ServePermissionTemplate)
	r.Get("/templates/alliance-brands", h.templateHandler.ServeBrandTemplate)
	r.Post("/export/scenarios/excel", h.scenarioExportHandler.ExportExcel)
	r.Post("/export/positions/excel", h.positionExportHandler.ExportExcel)
	r.Post("/export/courses/excel", h.courseExportHandler.ExportExcel)
	r.Post("/export/granular-courses/excel", h.granularCourseExportHandler.ExportExcel)
	r.Post("/export/question-banks/excel", h.questionBankExportHandler.ExportExcel)
	r.Post("/export/question-banks/{bankId}/questions/excel", h.questionExportHandler.ExportExcel)
	r.Post("/export/exams/excel", h.examExportHandler.ExportExcel)
	r.Post("/export/organizations/excel", h.resourceExportHandler.ExportOrganizations)
	r.Post("/export/students/excel", h.resourceExportHandler.ExportStudents)
	r.Post("/export/teachers/excel", h.resourceExportHandler.ExportTeachers)
}

func registerLandingRoutes(r chi.Router, h *Handlers, cachedLandingExams func(http.Handler) http.Handler) {
	r.With(cachedLandingExams).Get("/evaluation/landing/exams", h.landingHandler.ListExams)
	r.Get("/evaluation/landing/certifications/{id}/grades", h.certGradeHandler.ListGrades)
}

func registerAllianceRoutes(r chi.Router, h *Handlers) {
	r.Route("/alliance", func(r chi.Router) {
		r.Get("/school-info", h.allianceHandler.GetSchoolInfo)
		r.Put("/school-info", h.allianceHandler.UpdateSchoolInfo)

		r.Get("/enterprises", h.allianceHandler.ListEnterprises)
		r.Post("/enterprises", h.allianceHandler.CreateEnterprise)
		r.Get("/enterprises/{id}", h.allianceHandler.GetEnterprise)
		r.Put("/enterprises/{id}", h.allianceHandler.UpdateEnterprise)
		r.Delete("/enterprises/{id}", h.allianceHandler.DeleteEnterprise)

		r.Get("/enterprises/{eid}/agreements", h.allianceHandler.ListEnterpriseAgreements)
		r.Post("/enterprises/{eid}/agreements", h.allianceHandler.CreateEnterpriseAgreement)
		r.Put("/enterprises/{eid}/agreements/{id}", h.allianceHandler.UpdateEnterpriseAgreement)
		r.Delete("/enterprises/{eid}/agreements/{id}", h.allianceHandler.DeleteEnterpriseAgreement)

		r.Get("/projects", h.allianceHandler.ListProjects)
		r.Post("/projects", h.allianceHandler.CreateProject)
		r.Get("/projects/{id}", h.allianceHandler.GetProject)
		r.Put("/projects/{id}", h.allianceHandler.UpdateProject)
		r.Delete("/projects/{id}", h.allianceHandler.DeleteProject)

		r.Get("/projects/{pid}/milestones", h.allianceHandler.ListMilestones)
		r.Post("/projects/{pid}/milestones", h.allianceHandler.CreateMilestone)
		r.Put("/projects/{pid}/milestones/{id}", h.allianceHandler.UpdateMilestone)
		r.Delete("/projects/{pid}/milestones/{id}", h.allianceHandler.DeleteMilestone)

		r.Get("/achievements", h.allianceHandler.ListAchievements)
		r.Post("/achievements", h.allianceHandler.CreateAchievement)
		r.Get("/achievements/{id}", h.allianceHandler.GetAchievement)
		r.Put("/achievements/{id}", h.allianceHandler.UpdateAchievement)
		r.Delete("/achievements/{id}", h.allianceHandler.DeleteAchievement)

		r.Get("/experts", h.allianceHandler.ListExperts)
		r.Post("/experts", h.allianceHandler.CreateExpert)
		r.Get("/experts/{id}", h.allianceHandler.GetExpert)
		r.Put("/experts/{id}", h.allianceHandler.UpdateExpert)
		r.Delete("/experts/{id}", h.allianceHandler.DeleteExpert)

		r.Get("/agreements", h.allianceHandler.ListAgreements)
		r.Post("/agreements", h.allianceHandler.CreateAgreement)
		r.Get("/agreements/{id}", h.allianceHandler.GetAgreement)
		r.Put("/agreements/{id}", h.allianceHandler.UpdateAgreement)
		r.Delete("/agreements/{id}", h.allianceHandler.DeleteAgreement)

		r.Get("/permissions", h.allianceHandler.ListPermissions)
		r.Post("/permissions", h.allianceHandler.CreatePermission)
		r.Get("/permissions/{id}", h.allianceHandler.GetPermission)
		r.Put("/permissions/{id}", h.allianceHandler.UpdatePermission)
		r.Delete("/permissions/{id}", h.allianceHandler.DeletePermission)

		r.Get("/dictionaries/{dictType}", h.allianceHandler.ListDictionaryItems)
		r.Post("/dictionaries/{dictType}", h.allianceHandler.CreateDictionaryItem)
		r.Put("/dictionaries/{dictType}/{id}", h.allianceHandler.UpdateDictionaryItem)
		r.Delete("/dictionaries/{dictType}/{id}", h.allianceHandler.DeleteDictionaryItem)

		r.Get("/brands", h.allianceHandler.ListBrands)
		r.Post("/brands", h.allianceHandler.CreateBrand)
		r.Get("/brands/{id}", h.allianceHandler.GetBrand)
		r.Put("/brands/{id}", h.allianceHandler.UpdateBrand)
		r.Delete("/brands/{id}", h.allianceHandler.DeleteBrand)
	})
}

func registerAlliancePublicRoutes(r chi.Router, h *Handlers) {
	r.Route("/alliance/public", func(r chi.Router) {
		r.Get("/school-info", h.allianceHandler.GetPublicSchoolInfo)
		r.Get("/enterprises", h.allianceHandler.ListPublicEnterprises)
		r.Get("/enterprises/{id}", h.allianceHandler.GetPublicEnterprise)
		r.Get("/projects", h.allianceHandler.ListPublicProjects)
		r.Get("/projects/{id}", h.allianceHandler.GetPublicProject)
		r.Get("/achievements", h.allianceHandler.ListPublicAchievements)
		r.Get("/achievements/{id}", h.allianceHandler.GetPublicAchievement)
		r.Get("/experts", h.allianceHandler.ListPublicExperts)
		r.Get("/experts/{id}", h.allianceHandler.GetPublicExpert)
		r.Get("/brands", h.allianceHandler.ListPublicBrands)
		r.Get("/brands/{id}", h.allianceHandler.GetPublicBrand)
		r.Get("/stats", h.allianceHandler.GetPublicStats)
	})
}

func registerPortalRoutes(r chi.Router, h *Handlers) {
	r.Get("/tenants", h.tenantHandler.List)
	r.Get("/tenants/{id}", h.tenantHandler.Get)
	r.Put("/tenants/{id}", h.tenantHandler.Update)

	r.Get("/admins", h.tenantHandler.ListSchoolAdmins)
	r.Post("/admins", h.tenantHandler.CreateSchoolAdmin)
	r.Put("/admins/{id}", h.tenantHandler.UpdateSchoolAdmin)
	r.Delete("/admins/{id}", h.tenantHandler.DeleteSchoolAdmin)
	r.Post("/admins/{id}/reset-password", h.tenantHandler.ResetSchoolAdminPassword)

	r.Get("/organizations", h.orgHandler.List)
	r.Get("/organizations/tree", h.orgHandler.Tree)
	r.Get("/organizations/{id}", h.orgHandler.Get)
	r.Post("/organizations", h.orgHandler.Create)
	r.Put("/organizations/{id}", h.orgHandler.Update)
	r.Delete("/organizations/{id}", h.orgHandler.Delete)

	r.Get("/org-types", h.orgTypeHandler.List)
	r.Get("/org-types/{id}", h.orgTypeHandler.Get)
	r.Post("/org-types", h.orgTypeHandler.Create)
	r.Put("/org-types/{id}", h.orgTypeHandler.Update)
	r.Delete("/org-types/{id}", h.orgTypeHandler.Delete)

	r.Post("/users", h.userManagementHandler.Create)
	r.Put("/users/{id}", h.userManagementHandler.Update)
	r.Delete("/users/{id}", h.userManagementHandler.Delete)
	r.Post("/users/{id}/status", h.userManagementHandler.UpdateStatus)
	r.Post("/users/{id}/reset-password", h.userManagementHandler.ResetPassword)
	r.Post("/users/{id}/roles", h.userManagementHandler.BindRoles)
	r.Post("/users/batch", h.userManagementHandler.BatchCreate)
	r.Post("/users/batch-graduate", h.userManagementHandler.BatchGraduate)
	r.Post("/users/batch-delete", h.userManagementHandler.BatchDelete)
	r.Post("/users/batch-org-node", h.userManagementHandler.BatchUpdateOrgNode)

	r.Route("/staff-titles", func(r chi.Router) {
		r.Get("/", h.staffTitleHandler.List)
		r.Post("/", h.staffTitleHandler.Create)
		r.Get("/{id}", h.staffTitleHandler.Get)
		r.Put("/{id}", h.staffTitleHandler.Update)
		r.Delete("/{id}", h.staffTitleHandler.Delete)
		r.Post("/{id}/status", h.staffTitleHandler.ToggleStatus)
	})

	r.Route("/user-extension-fields", func(r chi.Router) {
		r.Get("/", h.userExtensionFieldHandler.List)
		r.Put("/{id}", h.userExtensionFieldHandler.Update)
	})

	r.Route("/user-relations", func(r chi.Router) {
		r.Get("/", h.userRelationHandler.List)
		r.Post("/", h.userRelationHandler.Create)
		r.Delete("/{id}", h.userRelationHandler.Delete)
	})

	r.Get("/roles", h.roleHandler.List)
	r.Get("/roles/{id}", h.roleHandler.Get)
	r.Post("/roles", h.roleHandler.Create)
	r.Put("/roles/{id}", h.roleHandler.Update)
	r.Delete("/roles/{id}", h.roleHandler.Delete)
	r.Post("/roles/{id}/assign", h.roleHandler.Assign)

	r.Post("/majors", h.majorHandler.Create)
	r.Put("/majors/{id}", h.majorHandler.Update)
	r.Delete("/majors/{id}", h.majorHandler.Delete)

	r.Post("/industries", h.industryHandler.Create)
	r.Put("/industries/{id}", h.industryHandler.Update)
	r.Delete("/industries/{id}", h.industryHandler.Delete)

	r.Get("/resource-codes", h.resourceCodeHandler.List)
	r.Get("/resource-codes/{id}", h.resourceCodeHandler.Get)
	r.Post("/resource-codes", h.resourceCodeHandler.Create)
	r.Put("/resource-codes/{id}", h.resourceCodeHandler.Update)
	r.Delete("/resource-codes/{id}", h.resourceCodeHandler.Delete)

	r.Get("/logs/login", h.logHandler.LoginLogs)
	r.Get("/logs/operation", h.logHandler.OperationLogs)
}
