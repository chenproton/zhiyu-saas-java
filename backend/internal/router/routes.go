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

func RegisterAPIRoutes(r chi.Router, jwtSecret, jwtSecretPrevious string, db *pgxpool.Pool, h *Handlers, redisClient *redis.Client, oplogBuffer *authmw.OpLogBuffer) {
	r.Route("/api/v1", func(r chi.Router) {
		// 导入/导出/模板生成涉及大文件解析与批量写入，使用长超时（10 分钟），
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
		RegisterAuthenticatedRoutes(r, jwtSecret, jwtSecretPrevious, db, h, redisClient, oplogBuffer)
	})
}

func RegisterPublicRoutes(r chi.Router, h *Handlers, redisClient *redis.Client) {
	loginLimiter := cache.RateLimit(redisClient, "login", 30, time.Minute)
	// 验证码生成有图片合成开销，按 IP 收紧限流防刷爆 CPU
	captchaLimiter := cache.RateLimit(redisClient, "captcha", 10, time.Minute)
	// 主题读取：公开端点返回租户主题色，按 IP 限流防扫描（纵深防御，成本极低）
	themeLimiter := cache.RateLimit(redisClient, "theme", 120, time.Minute)
	r.With(captchaLimiter).Get("/auth/captcha", h.captchaHandler.Get)
	r.With(loginLimiter).Post("/auth/login", h.authHandler.Login)
	r.With(loginLimiter).Post("/auth/saas/login", h.authHandler.SaasLogin)
	r.With(loginLimiter).Post("/auth/portal/login", h.authHandler.PortalLogin)
	r.With(loginLimiter).Post("/auth/partner/login", h.authHandler.PartnerLogin)
	r.With(loginLimiter).Post("/auth/partner/register", h.authHandler.PartnerRegister)
	// select-tenant 会签发正式 token，公开接口补限流防爆破
	r.With(loginLimiter).Post("/auth/select-tenant", h.authHandler.SelectTenant)
	r.With(themeLimiter).Get("/settings/theme", h.settingsHandler.GetTheme)
}

func RegisterAuthenticatedRoutes(r chi.Router, jwtSecret, jwtSecretPrevious string, db *pgxpool.Pool, h *Handlers, redisClient *redis.Client, oplogBuffer *authmw.OpLogBuffer) {
	auth := authmw.JWT(jwtSecret, jwtSecretPrevious)
	platformAdmin := authmw.RequireRole(domain.RolePlatformAdmin)
	systemAdmin := authmw.RequireSystemPermission()
	portalWorkspace := authmw.RequireRoleOrMenu(domain.RoleTeacher, domain.RoleStudent, domain.RoleSchoolAdmin)

	cachedPublicPositions := cache.Cached(redisClient, 2*time.Minute, cache.PublicPositionsKey())
	cachedPublicScenarios := cache.Cached(redisClient, 2*time.Minute, cache.PublicScenariosKey())
	cachedDashboard := cache.Cached(redisClient, 30*time.Second, cache.DashboardKey())

	// 导入/导出/上传涉及大文件与批量写入，按用户限流防资源耗尽
	importExportLimiter := cache.RateLimitByUser(redisClient, "import-export", 10, time.Minute)
	uploadLimiter := cache.RateLimitByUser(redisClient, "upload", 20, time.Minute)
	// AI 对话/生成按用户限流：LLM 调用按 token 计费，防单用户/单会话打爆租户额度
	aiLimiter := cache.RateLimitByUser(redisClient, "ai", 20, time.Minute)
	// 密码写操作（改密/重置）按用户限流，防暴力试旧密码/批量重置
	passwordLimiter := cache.RateLimitByUser(redisClient, "password", 10, time.Minute)
	// 公开只读接口按 IP 限流防爬（登录公开的联盟前台等）
	publicReadLimiter := cache.RateLimit(redisClient, "public-read", 120, time.Minute)

	r.Group(func(r chi.Router) {
		r.Use(auth)
		r.Use(authmw.RequireActiveUser(db))
		r.Use(authmw.OperationLog(db, oplogBuffer))

		// 文件上传/预览/签名 URL：单点注册 + 多平台白名单（portal/partner）。
		// 注意：不得在 portal/partner 平台组内重复注册——chi 同 method+path
		// 静默覆盖，后注册组会顶替先注册组（曾导致 sign-url 被 partner 组顶替）
		r.Group(func(r chi.Router) {
			r.Use(authmw.RequireAnyPlatform(domain.UserPlatformPortal, domain.UserPlatformPartner))
			r.With(uploadLimiter).Post("/files/upload", h.fileHandler.Upload)
			r.Get("/files/preview", h.fileHandler.Preview)
			r.Get("/files/sign-url", h.fileHandler.SignURL)
		})

		// ========== Portal 教育端（强制 portal 平台 token）==========
		r.Group(func(r chi.Router) {
			r.Use(authmw.RequirePlatform(domain.UserPlatformPortal))
			// 菜单驱动 RBAC（ADR-0008）：装载用户菜单授权（查库 + Redis 60s 缓存）
			// 到 context，供 RequireMenu 及各业务组判定；角色差异仅保留
			// 服务台（portalWorkspace）与关键写白名单（RequireSystemPermission）。
			r.Use(authmw.MenuContext(db, redisClient))

			r.Get("/auth/portal/me", h.authHandler.PortalMe)
			r.Get("/subscriptions", h.subscriptionHandler.Get)

			registerLandingRoutes(r, h)

			// AI 对话：租户内任意登录用户可用（handler 内校验 TenantID 与未配置 412）
			r.With(aiLimiter).Post("/ai/chat", h.aiHandler.Chat)
			// 岗位 AI 辅助编写（生成内容由前端直接写入表单字段、可恢复上版；服务端不落库，权限同 /ai/chat）
			r.With(aiLimiter).Post("/ai/position-assist", h.aiHandler.PositionAssist)
			r.With(aiLimiter).Post("/ai/scenario-assist", h.aiHandler.ScenarioAssist)

			// AI 智能服务中心（知识库/智能体/广场/审核上架/第三方挂接，spec ai-service-center.md §5）
			registerAICenterRoutes(r, h, aiLimiter, uploadLimiter)

			// 联盟公开前台：登录公开（限流 120/min/IP），不受菜单限制（spec 02 §1.9）
			registerAlliancePublicRoutes(r.With(publicReadLimiter), h)

			// 导入/导出涉及批量数据读写，需任一业务管理菜单（学生不可访问）
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(importExportMenus()...))
				registerImportExportRoutes(r.With(importExportLimiter), h)
			})

			// 门户级工作流/审批（spec 02 §1.8）：对应各模块 workflows/approvals 菜单
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(workflowMenus...))
				registerWorkflowRoutes(r, h)
			})

			// 服务台（角色特色保留：workspace 按角色聚合，PRD P-1）
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
				r.With(passwordLimiter).Post("/portal/workspace/me/password", h.userManagementHandler.ChangeMyPassword)
				// 学习社区：发帖/回复/阅读数（学生/教师/学校管理员）
				r.Get("/portal/community/topics", h.communityHandler.ListTopics)
				r.Post("/portal/community/topics", h.communityHandler.CreateTopic)
				r.Get("/portal/community/topics/{id}", h.communityHandler.GetTopic)
				r.Get("/portal/community/topics/{id}/replies", h.communityHandler.ListReplies)
				r.Post("/portal/community/topics/{id}/replies", h.communityHandler.CreateReply)
			})

			// 收藏（跨模块本人数据）：任一业务管理/落地页菜单
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(append(allManageMenus(),
					"/job/landing", "/lesson/landing", "/scene/landing",
					"/evaluation/landing", "/library/landing")...))
				r.Get("/job/positions/{id}/favorite", h.positionHandler.GetFavorite)
				r.Post("/job/positions/{id}/favorite", h.positionHandler.ToggleFavorite)
				r.Get("/job/positions/favorites", h.positionHandler.ListFavorites)
				r.Get("/favorites", h.favoritesHandler.List)
				r.Get("/favorites/{targetType}/{id}", h.favoritesHandler.GetFavorite)
				r.Post("/favorites/{targetType}/{id}", h.favoritesHandler.ToggleFavorite)
			})

			// 跨模块只读引用（课程/知识点列表）：岗位/场景详情页知识图谱等前台页面
			// 引用 lesson 模块数据做图谱节点，属 jobViewer 只读语义（ADR-0008：
			// 落地页菜单隐含映射其只读 API 面）。任一业务管理/落地页菜单即可读；
			// 写操作仍在 lesson 管理面，不在此组。
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(append(allManageMenus(),
					"/job/landing", "/lesson/landing", "/scene/landing",
					"/evaluation/landing", "/library/landing")...))
				r.Get("/lesson/courses", h.courseHandler.List)
				r.Get("/lesson/knowledge-points", h.knowledgePointHandler.List)
			})

			// 系统管理（关键写白名单 + 系统菜单）：school_admin/platform_admin 角色兜底
			r.Group(func(r chi.Router) {
				r.Use(systemAdmin)
				registerPortalRoutes(r, h, passwordLimiter)
			})

			// 用户列表/详情读取：业务角色或系统权限（写操作仍限系统管理员）
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireUserRead())
				r.Get("/users", h.userManagementHandler.List)
				r.Get("/users/{id}", h.userManagementHandler.Get)
			})

			// ===== 业务管理面（原 businessUser 大组按模块拆分，菜单驱动）=====
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(jobManageMenus...))
				registerJobRoutes(r, h)
			})
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(sceneManageMenus...))
				registerSceneRoutes(r, db, h)
			})
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(lessonManageMenus...))
				registerLessonRoutes(r, db, h)
			})
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(evaluationManageMenus...))
				registerEvaluationRoutes(r, db, h)
			})
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(libraryManageMenus...))
				registerLibraryRoutes(r, h)
			})
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(affairsManageMenus...))
				registerAffairsRoutes(r, h, importExportLimiter)
			})
			// 产教融合管理面（教师/学校管理员/企业导师按菜单配置，B13 默认不勾联盟菜单）。
			// 写授权面仅联盟**管理**菜单：仅勾前台落地页（/portal/alliance/landing）的角色
			// 是前台只读角色，不授予联盟 CRUD 写权限（spec 02 §1.9）。
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(allianceManageMenus...))
				registerAllianceRoutes(r, h)
			})

			// 参考数据只读（专业/行业/组织/组织类型）：任一业务或系统管理菜单
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(allManageMenus()...))
				r.Get("/majors", h.majorHandler.List)
				r.Get("/majors/{id}", h.majorHandler.Get)
				r.Get("/industries", h.industryHandler.List)
				r.Get("/industries/{id}", h.industryHandler.Get)
				r.Get("/organizations", h.orgHandler.List)
				r.Get("/organizations/tree", h.orgHandler.Tree)
				r.Get("/organizations/{id}", h.orgHandler.Get)
				r.Get("/org-types", h.orgTypeHandler.List)
				r.Get("/org-types/{id}", h.orgTypeHandler.Get)
			})

			// ===== 学生/业务用户共用只读面（原 jobViewer 组按模块拆分，菜单驱动）=====
			// 只读 API 授权面 = 模块管理菜单 ∪ 落地页菜单（学生勾落地页即可用；
			// 教师勾管理菜单同样可读，如岗位编辑页引用的能力点/知识点等）

			// job 只读面（落地页/学习页 + 岗位详情引用数据）
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(append(append([]string{}, jobManageMenus...), "/job/landing")...))
				r.With(cachedPublicPositions).Get("/job/public/positions", h.positionHandler.PublicList)
				r.Get("/job/public/positions/{id}", h.positionHandler.PublicGet)
				r.Get("/job/abilities", h.abilityHandler.List)
				r.Get("/job/abilities/citation-stats", h.abilityHandler.CitationStats)
				r.Get("/job/abilities/uncited", h.abilityHandler.UncitedList)
				r.Get("/job/abilities/{id}", h.abilityHandler.Get)
				r.Get("/job/position-responsibilities", h.positionResponsibilityHandler.List)
				r.Get("/job/position-responsibilities/{id}", h.positionResponsibilityHandler.Get)
				r.Get("/job/position-abilities", h.positionAbilityHandler.ListBindings)
				r.Get("/job/ability-domains", h.abilityDomainHandler.List)
				r.Get("/job/ability-domains/{id}", h.abilityDomainHandler.Get)
				r.Get("/job/position-certificates", h.positionCertificateHandler.List)
				r.Get("/job/position-certificates/{id}", h.positionCertificateHandler.Get)
				r.Get("/job/positions/{id}/snapshot", h.snapshotHandler.GetPositionSnapshot)
			})

			// scene 只读面（场景学习链路 + 快照）
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(append(append([]string{}, sceneManageMenus...), "/scene/landing")...))
				// 场景列表为重查询（3 个 LATERAL 聚合），挂租户级 2min 缓存（键含查询参数）
				r.With(cachedPublicScenarios).Get("/scene/scenarios", h.scenarioHandler.List)
				r.Get("/scene/scenarios/{id}", h.scenarioHandler.Get)
				// 快照 bundle 只读（学生角色在 handler 内剥离答案字段，文档 5.2）
				r.Get("/scene/scenarios/{id}/snapshot", h.snapshotHandler.GetScenarioSnapshot)
				r.Get("/scene/tasks", h.scenarioTaskHandler.List)
				r.Get("/scene/tasks/{id}", h.scenarioTaskHandler.Get)
				r.Get("/scene/tasks/{taskId}/evaluation-methods", h.taskEvaluationHandler.ListMethods)
			})

			// lesson 只读面（体系课学习页）
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(append(append([]string{}, lessonManageMenus...), "/lesson/landing")...))
				r.Get("/lesson/knowledge-points/citation-stats", h.knowledgePointHandler.CitationStats)
				r.Get("/lesson/knowledge-points/uncited", h.knowledgePointHandler.UncitedList)
				r.Get("/lesson/knowledge-points/{id}", h.knowledgePointHandler.Get)
				r.Get("/lesson/nodes", h.courseNodeHandler.List)
				r.Get("/lesson/nodes/{id}", h.courseNodeHandler.Get)
				r.Get("/lesson/node-evaluation-results", h.nodeEvaluationResultHandler.List)
				r.Post("/lesson/node-evaluation-results", h.nodeEvaluationResultHandler.Submit)
				r.Get("/lesson/courses/{id}", h.courseHandler.Get)
				r.Get("/lesson/courses/{id}/snapshot", h.snapshotHandler.GetCourseSnapshot)
			})

			// evaluation 只读面（测评/考试/画像，学生提交本人结果）
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(append(append([]string{}, evaluationManageMenus...), "/evaluation/landing")...))
				r.Get("/evaluation/results", h.evaluationResultHandler.List)
				r.Post("/evaluation/results", h.evaluationResultHandler.Submit)
				r.Get("/evaluation/job-ability/results", h.jobAbilityResultHandler.List)
				r.Get("/evaluation/job-ability/course-scores", h.jobAbilityResultHandler.CourseScores)
				registerContentReadRoutes(r, "/evaluation/exams", h.examHandler)
				r.Get("/evaluation/exams/{id}/snapshot", h.snapshotHandler.GetExamSnapshot)
				r.Get("/evaluation/question-banks/{id}/snapshot", h.snapshotHandler.GetQuestionBankSnapshot)
				r.Get("/evaluation/exam-usages", h.examUsageHandler.List)
				r.Get("/evaluation/exam-usages/{id}", h.examUsageHandler.Get)
				r.Get("/evaluation/exam-center", h.examUsageHandler.ExamCenter)
				r.Post("/evaluation/exam-results", h.examResultHandler.Create)
				r.Get("/evaluation/portraits", h.studentPortraitHandler.List)
				r.Get("/evaluation/portraits/{id}", h.studentPortraitHandler.Get)
				r.Get("/evaluation/portraits/student-dashboard", h.studentPortraitHandler.StudentDashboard)
			})

			// library 只读面（资源库浏览）
			r.Group(func(r chi.Router) {
				r.Use(authmw.RequireMenu(append(append([]string{}, libraryManageMenus...), "/library/landing")...))
				// 资源标签批量查询为库浏览必需（列表页标签展示）
				r.Post("/library/resource-tags/query", h.tagHandler.QueryBindings)
				r.Get("/library/resources", h.resourceLibraryHandler.List)
				r.Get("/library/resources/stats", h.resourceLibraryHandler.Stats)
				r.Get("/library/resources/{id}", h.resourceLibraryHandler.Get)
				r.Get("/library/on-site-questions", h.onSiteQuestionLibraryHandler.List)
				r.Get("/library/on-site-questions/{id}", h.onSiteQuestionLibraryHandler.Get)
			})

			// 节次定义（工作台课表渲染，学生/教师均需）：登录公开只读
			// （数据为租户级节次定义，低敏感；原 jobViewer 组即覆盖全部业务角色）
			r.Get("/affairs/period-slots", h.schedulingHandler.ListPeriodSlots)

			// 本租户详情只读（联盟前台 hero 学校卡/学校信息页）：任何登录用户可读本租户
			// （handler 强制本租户归属，跨租户 403）。注册于 systemAdmin 组之后以覆盖其
			// GET；PUT/POST/DELETE 仍限 systemAdmin（同 /organizations 只读覆盖模式）。
			r.Get("/tenants/{id}", h.tenantHandler.Get)
		})

		// ========== SaaS 运营端（强制 saas 平台 token）==========
		r.Group(func(r chi.Router) {
			r.Use(authmw.RequirePlatform(domain.UserPlatformSaas))

			r.Get("/auth/me", h.authHandler.SaasMe)
			r.Get("/auth/saas/me", h.authHandler.SaasMe)

			r.Group(func(r chi.Router) {
				r.Use(platformAdmin)
				// 运营端写操作已由外层 OperationLog（第 80 行）统一审计，此处不再重复挂载
				registerSuperAdminRoutes(r, h, passwordLimiter)
			})
		})

		// ========== Partner 企业端（强制 partner 平台 token）==========
		r.Group(func(r chi.Router) {
			r.Use(authmw.RequirePlatform(domain.UserPlatformPartner))
			registerPartnerRoutes(r, h, passwordLimiter)
		})
	})
}

func registerSuperAdminRoutes(r chi.Router, h *Handlers, passwordLimiter func(http.Handler) http.Handler) {
	r.Get("/admin/tenants", h.tenantHandler.AdminList)
	r.Post("/admin/tenants", h.tenantHandler.AdminCreate)
	r.Put("/admin/tenants/{id}", h.tenantHandler.AdminUpdate)
	r.Post("/admin/tenants/{id}/status", h.tenantHandler.AdminUpdateStatus)
	r.Delete("/admin/tenants/{id}", h.tenantHandler.AdminDelete)
	r.Get("/admin/tenants/{id}/enterprise", h.tenantHandler.AdminGetEnterprise)
	r.Put("/admin/tenants/{id}/enterprise", h.tenantHandler.AdminUpdateEnterprise)

	r.Get("/admin/tenants/{tenantId}/admins", h.tenantHandler.AdminListAdmins)
	r.Post("/admin/tenants/{tenantId}/admins", h.tenantHandler.AdminCreateAdmin)
	r.Put("/admin/tenants/{tenantId}/admins/{id}", h.tenantHandler.AdminUpdateAdmin)
	r.Delete("/admin/tenants/{tenantId}/admins/{id}", h.tenantHandler.AdminDeleteAdmin)
	r.With(passwordLimiter).Post("/admin/tenants/{tenantId}/admins/{id}/reset-password", h.tenantHandler.AdminResetPassword)
	r.Get("/admin/tenants/{tenantId}/enterprise-admins", h.tenantHandler.AdminListEnterpriseAdmins)
	r.Post("/admin/tenants/{tenantId}/enterprise-admins", h.tenantHandler.AdminCreateEnterpriseAdmin)
	r.Put("/admin/tenants/{tenantId}/enterprise-admins/{id}", h.tenantHandler.AdminUpdateEnterpriseAdmin)
	r.Delete("/admin/tenants/{tenantId}/enterprise-admins/{id}", h.tenantHandler.AdminDeleteEnterpriseAdmin)
	r.With(passwordLimiter).Post("/admin/tenants/{tenantId}/enterprise-admins/{id}/reset-password", h.tenantHandler.AdminResetEnterpriseAdminPassword)

	r.Get("/admin/tenants/{tenantId}/subscription", h.subscriptionHandler.AdminGet)
	r.Put("/admin/tenants/{tenantId}/subscription", h.subscriptionHandler.AdminUpdate)

	// 超管代租户维护 AI 服务配置（与租户自身配置同表 tenant_ai_configs）
	r.Get("/admin/tenants/{tenantId}/ai/config", h.aiHandler.AdminGetConfig)
	r.Put("/admin/tenants/{tenantId}/ai/config", h.aiHandler.AdminSaveConfig)
	r.Delete("/admin/tenants/{tenantId}/ai/config", h.aiHandler.AdminDeleteConfig)

	r.Get("/admin/settings/theme", h.settingsHandler.GetTheme)
	r.Put("/admin/settings/theme", h.settingsHandler.UpdateTheme)

	r.Put("/admin/tenants/{tenantId}/settings/theme", h.settingsHandler.UpdateTenantTheme)
	r.Delete("/admin/tenants/{tenantId}/settings/theme", h.settingsHandler.DeleteTenantTheme)

}

func registerWorkflowRoutes(r chi.Router, h *Handlers) {
	// 授权在调用处挂 RequireMenu(workflowMenus...)（菜单驱动 RBAC，ADR-0008）
	r.Get("/workflows", h.workflowHandler.List)
	r.Post("/workflows", h.workflowHandler.Create)
	r.Get("/workflows/{id}", h.workflowHandler.Get)
	r.Put("/workflows/{id}", h.workflowHandler.Update)
	r.Delete("/workflows/{id}", h.workflowHandler.Delete)

	r.Get("/approvals", h.approvalHandler.List)
	r.Post("/approvals", h.approvalHandler.Create)
	r.Get("/approvals/{id}", h.approvalHandler.Get)
	r.Post("/approvals/{id}/review", h.approvalHandler.Review)
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
	r.Post("/import/alliance-projects/excel", h.resourceImportHandler.ImportProjects)
	r.Post("/import/alliance-projects/preview", h.resourceImportHandler.PreviewProjects)
	r.Post("/import/alliance-achievements/excel", h.resourceImportHandler.ImportAchievements)
	r.Post("/import/alliance-achievements/preview", h.resourceImportHandler.PreviewAchievements)
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
	r.Get("/templates/alliance-projects", h.templateHandler.ServeProjectTemplate)
	r.Get("/templates/alliance-achievements", h.templateHandler.ServeAchievementTemplate)
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

func registerLandingRoutes(r chi.Router, h *Handlers) {
	r.Get("/job/landing/target-positions", h.landingHandler.ListTargetPositions)
}

func registerAllianceRoutes(r chi.Router, h *Handlers) {
	r.Route("/alliance", func(r chi.Router) {
		r.Get("/school-info", h.allianceHandler.GetSchoolInfo)
		r.Get("/enterprises", h.allianceHandler.ListEnterprises)
		r.Get("/enterprises/search", h.allianceHandler.SearchEnterprises)
		r.Get("/enterprises/{id}", h.allianceHandler.GetEnterprise)
		r.Get("/grants", h.allianceHandler.ListGrants)
		r.Get("/grants/resource-options", h.allianceHandler.ListGrantResourceOptions)
		r.Get("/projects", h.allianceHandler.ListProjects)
		r.Get("/employment-projects", h.allianceEmploymentHandler.ListEmploymentProjects)
		r.Get("/employment-projects/{id}", h.allianceEmploymentHandler.GetEmploymentProject)
		r.Get("/employment-jobs", h.allianceEmploymentHandler.ListEmploymentJobs)
		r.Get("/employment-applications", h.allianceEmploymentHandler.ListEmploymentApplications)
		r.Get("/projects/{id}", h.allianceHandler.GetProject)
		r.Get("/projects/{pid}/milestones", h.allianceHandler.ListMilestones)
		r.Get("/achievements", h.allianceHandler.ListAchievements)
		r.Get("/achievements/{id}", h.allianceHandler.GetAchievement)
		r.Get("/experts", h.allianceHandler.ListExperts)
		r.Get("/experts/mentor-options", h.allianceMentorHandler.ListMentorOptions)
		r.Get("/experts/{id}", h.allianceHandler.GetExpert)
		r.Get("/agreements", h.allianceHandler.ListAgreements)
		r.Get("/agreements/{id}", h.allianceHandler.GetAgreement)
		r.Get("/permissions", h.allianceHandler.ListPermissions)
		r.Get("/permissions/{id}", h.allianceHandler.GetPermission)
		r.Get("/dictionaries/{dictType}", h.allianceHandler.ListDictionaryItems)
		r.Get("/brands", h.allianceHandler.ListBrands)
		r.Get("/brands/talent-ranking", h.allianceHandler.ListTalentRanking)
		r.Get("/brands/rank-configs", h.allianceHandler.ListBrandMajorRankConfigs)
		r.Get("/brands/{id}", h.allianceHandler.GetBrand)

		// 写操作：授权由调用处 RequireMenu(allianceManageMenus) 控制（菜单驱动 RBAC，
		// ADR-0008；仅勾前台落地页菜单的角色不获联盟写权限，B13 企业导师默认不勾
		// 联盟管理菜单即无权限）；handler 层 canManageAlliance 保留作纵深防御。
		r.Group(func(r chi.Router) {
			r.Put("/school-info", h.allianceHandler.UpdateSchoolInfo)
			r.Post("/enterprises/register", h.allianceHandler.RegisterEnterprise)
			r.Put("/enterprises/{id}", h.allianceHandler.UpdateEnterprise)
			r.Post("/enterprises/{id}/link", h.allianceHandler.LinkEnterprise)
			r.Delete("/enterprises/{id}/link", h.allianceHandler.UnlinkEnterprise)
			// DELETE /enterprises/{id} 语义为「解除引入（unlink）」：企业主体归 partner 端所有，
			// 学校侧无删除企业主体的能力（与 /link 共用 UnlinkEnterprise）
			r.Delete("/enterprises/{id}", h.allianceHandler.UnlinkEnterprise)
			r.Put("/grants", h.allianceHandler.SaveGrants)
			r.Post("/employment-projects", h.allianceEmploymentHandler.CreateEmploymentProject)
			r.Put("/employment-projects/{id}", h.allianceEmploymentHandler.UpdateEmploymentProject)
			r.Delete("/employment-projects/{id}", h.allianceEmploymentHandler.DeleteEmploymentProject)
			r.Put("/employment-jobs/{id}/status", h.allianceEmploymentHandler.AdminSetEmploymentJobStatus)
			r.Post("/projects", h.allianceHandler.CreateProject)
			r.Put("/projects/{id}", h.allianceHandler.UpdateProject)
			r.Delete("/projects/{id}", h.allianceHandler.DeleteProject)
			r.Post("/projects/{pid}/milestones", h.allianceHandler.CreateMilestone)
			r.Put("/projects/{pid}/milestones/{id}", h.allianceHandler.UpdateMilestone)
			r.Delete("/projects/{pid}/milestones/{id}", h.allianceHandler.DeleteMilestone)
			r.Post("/achievements", h.allianceHandler.CreateAchievement)
			r.Put("/achievements/{id}", h.allianceHandler.UpdateAchievement)
			r.Delete("/achievements/{id}", h.allianceHandler.DeleteAchievement)
			r.Put("/experts/{id}/display", h.allianceHandler.ToggleExpertDisplay)
			r.Post("/experts", h.allianceHandler.CreateSchoolExpert)
			r.Put("/experts/{id}", h.allianceHandler.UpdateSchoolExpert)
			r.Delete("/experts/{id}", h.allianceHandler.DeleteSchoolExpert)
			r.Post("/agreements", h.allianceHandler.CreateAgreement)
			r.Put("/agreements/{id}", h.allianceHandler.UpdateAgreement)
			r.Delete("/agreements/{id}", h.allianceHandler.DeleteAgreement)
			r.Post("/permissions", h.allianceHandler.CreatePermission)
			r.Put("/permissions/{id}", h.allianceHandler.UpdatePermission)
			r.Delete("/permissions/{id}", h.allianceHandler.DeletePermission)
			r.Post("/dictionaries/{dictType}", h.allianceHandler.CreateDictionaryItem)
			r.Put("/dictionaries/{dictType}/{id}", h.allianceHandler.UpdateDictionaryItem)
			r.Delete("/dictionaries/{dictType}/{id}", h.allianceHandler.DeleteDictionaryItem)
			r.Post("/brands", h.allianceHandler.CreateBrand)
			r.Put("/brands/{id}", h.allianceHandler.UpdateBrand)
			r.Delete("/brands/{id}", h.allianceHandler.DeleteBrand)
			r.Put("/brands/rank-configs", h.allianceHandler.SaveBrandMajorRankConfigs)
		})
	})
}
func registerAlliancePublicRoutes(r chi.Router, h *Handlers) {
	r.Route("/alliance/public", func(r chi.Router) {
		r.Get("/school-info", h.allianceHandler.GetPublicSchoolInfo)
		r.Get("/enterprises", h.allianceHandler.ListPublicEnterprises)
		r.Get("/enterprises/{id}", h.allianceHandler.GetPublicEnterprise)
		r.Get("/projects", h.allianceHandler.ListPublicProjects)
		r.Get("/projects/{id}", h.allianceHandler.GetPublicProject)
		r.Get("/projects/{pid}/milestones", h.allianceHandler.ListPublicMilestones)
		r.Get("/achievements", h.allianceHandler.ListPublicAchievements)
		r.Get("/achievements/{id}", h.allianceHandler.GetPublicAchievement)
		r.Get("/agreements", h.allianceHandler.ListPublicAgreements)
		r.Get("/experts", h.allianceHandler.ListPublicExperts)
		r.Get("/experts/{id}", h.allianceHandler.GetPublicExpert)
		r.Get("/brands", h.allianceHandler.ListPublicBrands)
		r.Get("/brands/talent-ranking", h.allianceHandler.ListPublicTalentRanking)
		r.Get("/brands/{id}", h.allianceHandler.GetPublicBrand)
		r.Get("/stats", h.allianceHandler.GetPublicStats)
		// 人才与岗位供需服务大厅（学生按 target_groups 可见性过滤；投递仅学生）
		r.Get("/employment-projects", h.allianceEmploymentHandler.ListPublicEmploymentProjects)
		r.Get("/employment-projects/{id}", h.allianceEmploymentHandler.GetPublicEmploymentProject)
		r.Get("/employment-projects/{id}/jobs", h.allianceEmploymentHandler.ListPublicEmploymentJobsByProject)
		r.Get("/employment-jobs/{id}", h.allianceEmploymentHandler.GetPublicEmploymentJob)
		r.Post("/employment-jobs/{id}/apply", h.allianceEmploymentHandler.ApplyPublicEmploymentJob)
		r.Get("/employment-applications/mine", h.allianceEmploymentHandler.ListMyEmploymentApplications)
	})
}

func registerPortalRoutes(r chi.Router, h *Handlers, passwordLimiter func(http.Handler) http.Handler) {
	r.Get("/tenants", h.tenantHandler.List)
	r.Get("/tenants/{id}", h.tenantHandler.Get)
	r.Put("/tenants/{id}", h.tenantHandler.Update)

	// 租户 AI 服务配置与用量统计（管理端；对话入口 /ai/chat 在 portal 平台组单独注册）
	r.Get("/ai/config", h.aiHandler.GetConfig)
	r.Put("/ai/config", h.aiHandler.SaveConfig)
	r.Delete("/ai/config", h.aiHandler.DeleteConfig)
	r.Get("/ai/usage", h.aiHandler.GetUsage)

	r.Get("/admins", h.tenantHandler.ListSchoolAdmins)
	r.Post("/admins", h.tenantHandler.CreateSchoolAdmin)
	r.Put("/admins/{id}", h.tenantHandler.UpdateSchoolAdmin)
	r.Delete("/admins/{id}", h.tenantHandler.DeleteSchoolAdmin)
	r.With(passwordLimiter).Post("/admins/{id}/reset-password", h.tenantHandler.ResetSchoolAdminPassword)

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
	r.With(passwordLimiter).Post("/users/{id}/reset-password", h.userManagementHandler.ResetPassword)
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
