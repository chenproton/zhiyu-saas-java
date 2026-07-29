package router

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/cache"
	authmw "github.com/zhiyu-saas/backend/internal/middleware"
)

func RegisterAPIRoutes(r chi.Router, jwtSecret string, db *pgxpool.Pool, h *Handlers, redisClient *redis.Client, oplogBuffer *authmw.OpLogBuffer) {
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(middleware.Timeout(30 * time.Second))

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
	r.Post("/auth/debug/token", h.authHandler.DebugToken)
	r.Group(func(r chi.Router) {
		r.Use(cache.Cached(redisClient, 10*time.Minute, cache.StaticKey(cache.KeyPlatformLinks)))
		r.Get("/platform-links", h.platformLinkHandler.List)
	})
	r.Group(func(r chi.Router) {
		r.Use(cache.Cached(redisClient, 10*time.Minute, cache.StaticKey(cache.KeyAppModules)))
		r.Get("/app-modules", h.appModuleHandler.List)
	})
}

func RegisterAuthenticatedRoutes(r chi.Router, jwtSecret string, db *pgxpool.Pool, h *Handlers, redisClient *redis.Client, oplogBuffer *authmw.OpLogBuffer) {
	auth := authmw.JWT(jwtSecret)
	platformAdmin := authmw.RequireRole("platform_admin")
	systemAdmin := authmw.RequireSystemPermission()
	portalWorkspace := authmw.RequireRole("teacher", "student", "school_admin")
	businessUser := authmw.RequireRole("teacher", "school_admin", "enterprise_mentor", "platform_admin")
	jobViewer := authmw.RequireRole("teacher", "student", "school_admin", "enterprise_mentor", "platform_admin")

	cachedLandingExams := cache.Cached(redisClient, 2*time.Minute, cache.LandingExamsKey())
	cachedDropdown := cache.Cached(redisClient, 5*time.Minute, cache.DropdownKey())
	cachedPublicPositions := cache.Cached(redisClient, 2*time.Minute, cache.PublicPositionsKey())
	cachedDashboard := cache.Cached(redisClient, 1*time.Minute, cache.DashboardKey())

	r.Group(func(r chi.Router) {
		r.Use(auth)
		r.Use(authmw.OperationLog(db, oplogBuffer))

		registerAuthRoutes(r, h)
		registerImportExportRoutes(r, h)
		registerLandingRoutes(r, h, cachedLandingExams)

		r.Group(func(r chi.Router) {
			r.Use(platformAdmin)
			registerSuperAdminRoutes(r, h)
		})

		r.Group(func(r chi.Router) {
			r.Use(jobViewer)
			r.With(cachedPublicPositions).Get("/job/public/positions", h.positionHandler.PublicList)
			r.Get("/job/public/positions/{id}", h.positionHandler.PublicGet)
		})

		r.Group(func(r chi.Router) {
			r.Use(portalWorkspace)
			r.With(cachedDashboard).Get("/portal/workspace/dashboard", h.portalHandler.WorkspaceDashboard)
		})

		// 学生画像查询对全部业务角色开放（含学生本人），generate/archives 仍限业务用户
		r.Group(func(r chi.Router) {
			r.Use(jobViewer)
			r.Get("/evaluation/portraits", h.studentPortraitHandler.List)
			r.Get("/evaluation/portraits/{id}", h.studentPortraitHandler.Get)
		})

		r.Group(func(r chi.Router) {
			r.Use(systemAdmin)
			registerPortalRoutes(r, h, cachedDropdown)
		})

		registerWorkflowRoutes(r, h)

		r.Group(func(r chi.Router) {
			r.Use(businessUser)
			registerJobRoutes(r, h)
			registerSceneRoutes(r, h)
			registerLessonRoutes(r, h)
			registerEvaluationRoutes(r, h)
			registerLibraryRoutes(r, h)
		})
	})
}

func registerAuthRoutes(r chi.Router, h *Handlers) {
	r.Get("/auth/me", h.authHandler.SaasMe)
	r.Get("/auth/saas/me", h.authHandler.SaasMe)
	r.Get("/auth/portal/me", h.authHandler.PortalMe)
	r.Get("/stats/me", h.statsHandler.MyStats)
	r.Get("/subscriptions", h.subscriptionHandler.Get)
	r.Get("/uploads/{filename}", h.fileHandler.Serve)
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
		r.Use(authmw.RequireRole("school_admin", "teacher"))

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
	r.Post("/export/scenarios/excel", h.scenarioExportHandler.ExportExcel)
	r.Post("/export/positions/excel", h.positionExportHandler.ExportExcel)
	r.Post("/export/organizations/excel", h.resourceExportHandler.ExportOrganizations)
	r.Post("/export/students/excel", h.resourceExportHandler.ExportStudents)
	r.Post("/export/teachers/excel", h.resourceExportHandler.ExportTeachers)
}

func registerLandingRoutes(r chi.Router, h *Handlers, cachedLandingExams func(http.Handler) http.Handler) {
	r.With(cachedLandingExams).Get("/evaluation/landing/exams", h.landingHandler.ListExams)
	r.Get("/evaluation/landing/certifications/{id}/grades", h.certGradeHandler.ListGrades)
}

func registerPortalRoutes(r chi.Router, h *Handlers, cachedDropdown func(http.Handler) http.Handler) {
	r.Get("/tenants", h.tenantHandler.List)
	r.Get("/tenants/{id}", h.tenantHandler.Get)
	r.Put("/tenants/{id}", h.tenantHandler.Update)

	r.Get("/admins", h.tenantHandler.ListSchoolAdmins)
	r.Post("/admins", h.tenantHandler.CreateSchoolAdmin)
	r.Put("/admins/{id}", h.tenantHandler.UpdateSchoolAdmin)
	r.Delete("/admins/{id}", h.tenantHandler.DeleteSchoolAdmin)
	r.Post("/admins/{id}/reset-password", h.tenantHandler.ResetSchoolAdminPassword)
	r.Post("/admins/{id}/preview-password", h.tenantHandler.PreviewSchoolAdminPassword)

	r.Get("/organizations", h.orgHandler.List)
	r.Get("/organizations/tree", h.orgHandler.Tree)
	r.Get("/organizations/{id}", h.orgHandler.Get)
	r.Post("/organizations", h.orgHandler.Create)
	r.Put("/organizations/{id}", h.orgHandler.Update)
	r.Delete("/organizations/{id}", h.orgHandler.Delete)

	r.With(cachedDropdown).Get("/org-types", h.orgTypeHandler.List)
	r.Get("/org-types/{id}", h.orgTypeHandler.Get)
	r.Post("/org-types", h.orgTypeHandler.Create)
	r.Put("/org-types/{id}", h.orgTypeHandler.Update)
	r.Delete("/org-types/{id}", h.orgTypeHandler.Delete)

	r.Get("/users", h.userManagementHandler.List)
	r.Get("/users/{id}", h.userManagementHandler.Get)
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
		r.With(cachedDropdown).Get("/", h.staffTitleHandler.List)
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

	r.With(cachedDropdown).Get("/roles", h.roleHandler.List)
	r.Get("/roles/{id}", h.roleHandler.Get)
	r.Post("/roles", h.roleHandler.Create)
	r.Put("/roles/{id}", h.roleHandler.Update)
	r.Delete("/roles/{id}", h.roleHandler.Delete)
	r.Post("/roles/{id}/assign", h.roleHandler.Assign)

	r.With(cachedDropdown).Get("/majors", h.majorHandler.List)
	r.Get("/majors/{id}", h.majorHandler.Get)
	r.Post("/majors", h.majorHandler.Create)
	r.Put("/majors/{id}", h.majorHandler.Update)
	r.Delete("/majors/{id}", h.majorHandler.Delete)

	r.With(cachedDropdown).Get("/industries", h.industryHandler.List)
	r.Get("/industries/{id}", h.industryHandler.Get)
	r.Post("/industries", h.industryHandler.Create)
	r.Put("/industries/{id}", h.industryHandler.Update)
	r.Delete("/industries/{id}", h.industryHandler.Delete)

	r.With(cachedDropdown).Get("/resource-codes", h.resourceCodeHandler.List)
	r.Get("/resource-codes/{id}", h.resourceCodeHandler.Get)
	r.Post("/resource-codes", h.resourceCodeHandler.Create)
	r.Put("/resource-codes/{id}", h.resourceCodeHandler.Update)
	r.Delete("/resource-codes/{id}", h.resourceCodeHandler.Delete)

	r.Get("/logs/login", h.logHandler.LoginLogs)
	r.Get("/logs/operation", h.logHandler.OperationLogs)

	r.Get("/platform-links/{id}", h.platformLinkHandler.Get)
	r.Get("/app-modules/{id}", h.appModuleHandler.Get)
}
