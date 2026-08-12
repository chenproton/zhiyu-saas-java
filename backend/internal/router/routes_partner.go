package router

import (
	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	authmw "github.com/zhiyu-saas/backend/internal/middleware"
)

// registerPartnerRoutes Partner 企业端路由（外层已强制 platform=partner）。
// 读操作对 enterprise_admin/enterprise_member 开放；写操作仅 enterprise_admin。
func registerPartnerRoutes(r chi.Router, h *Handlers) {
	partnerUser := authmw.RequireRole(domain.RoleEnterpriseAdmin, domain.RoleEnterpriseMember)
	adminOnly := authmw.RequireRole(domain.RoleEnterpriseAdmin)

	r.Get("/auth/partner/me", h.authHandler.PartnerMe)

	// 企业成员/管理员共用（读 + 个人操作）
	r.Group(func(r chi.Router) {
		r.Use(partnerUser)
		r.Get("/partner/enterprise/profile", h.partnerHandler.GetProfile)
		// 专家档案列表/详情仅管理员；专家本人档案走 /me（member 无列表权限）
		r.Get("/partner/experts/{id}", h.partnerHandler.GetExpert)
		r.Get("/partner/experts/me", h.partnerHandler.GetMyExpert)
		r.Put("/partner/experts/me", h.partnerHandler.UpdateMyExpert)
		r.Get("/partner/workspace/dashboard", h.partnerHandler.Dashboard)
		r.Get("/partner/schools", h.partnerHandler.ListSchools)
		r.Get("/partner/cooperation", h.partnerHandler.ListCooperation)
		r.Get("/partner/cooperation/projects/{id}", h.partnerHandler.GetCooperationProject)
		r.Get("/partner/cooperation/achievements/{id}", h.partnerHandler.GetCooperationAchievement)
		r.Get("/partner/cooperation/agreements/{id}", h.partnerHandler.GetCooperationAgreement)
		r.Get("/partner/mentor-tasks", h.partnerHandler.ListMentorTasks)
		r.Put("/partner/me/password", h.partnerHandler.ChangeMyPassword)

		// 资源共建（岗位/场景，admin+member 均可操作）
		r.Get("/partner/co-build/positions", h.partnerCoBuildHandler.ListPositions)
		r.Post("/partner/co-build/positions", h.partnerCoBuildHandler.CreatePosition)
		r.Get("/partner/co-build/positions/{id}", h.partnerCoBuildHandler.GetPosition)
		r.Post("/partner/co-build/positions/{id}/edit", h.partnerCoBuildHandler.EditSourcePosition)
		r.Put("/partner/co-build/positions/{id}", h.partnerCoBuildHandler.UpdatePosition)
		r.Delete("/partner/co-build/positions/{id}", h.partnerCoBuildHandler.DeletePosition)
		r.Post("/partner/co-build/positions/{id}/submit", h.partnerCoBuildHandler.SubmitPosition)
		r.Post("/partner/co-build/positions/{id}/withdraw", h.partnerCoBuildHandler.WithdrawPosition)
		r.Post("/partner/co-build/positions/{id}/save-full", h.partnerCoBuildHandler.SaveFullPosition)
		r.Get("/partner/co-build/positions/{id}/responsibilities", h.partnerCoBuildHandler.ListPositionResponsibilities)
		r.Get("/partner/co-build/positions/{id}/certificates", h.partnerCoBuildHandler.ListPositionCertificates)
		r.Get("/partner/co-build/positions/{id}/ability-bindings", h.partnerCoBuildHandler.ListPositionAbilityBindings)
		r.Get("/partner/co-build/positions/{id}/ability-domains", h.partnerCoBuildHandler.ListPositionAbilityDomains)
		r.Get("/partner/co-build/scenes", h.partnerCoBuildHandler.ListScenarios)
		r.Post("/partner/co-build/scenes", h.partnerCoBuildHandler.CreateScenario)
		r.Get("/partner/co-build/scenes/{id}", h.partnerCoBuildHandler.GetScenario)
		r.Post("/partner/co-build/scenes/{id}/edit", h.partnerCoBuildHandler.EditSourceScenario)
		r.Put("/partner/co-build/scenes/{id}", h.partnerCoBuildHandler.UpdateScenario)
		r.Delete("/partner/co-build/scenes/{id}", h.partnerCoBuildHandler.DeleteScenario)
		r.Post("/partner/co-build/scenes/{id}/submit", h.partnerCoBuildHandler.SubmitScenario)
		r.Post("/partner/co-build/scenes/{id}/withdraw", h.partnerCoBuildHandler.WithdrawScenario)
		r.Get("/partner/co-build/scenes/{id}/tasks", h.partnerCoBuildHandler.ListTasks)
		r.Post("/partner/co-build/scenes/{id}/tasks", h.partnerCoBuildHandler.CreateTask)
		r.Post("/partner/co-build/scenes/{id}/tasks/reorder", h.partnerCoBuildHandler.ReorderTasks)
		r.Put("/partner/co-build/tasks/{taskId}", h.partnerCoBuildHandler.UpdateTask)
		r.Delete("/partner/co-build/tasks/{taskId}", h.partnerCoBuildHandler.DeleteTask)
		r.Get("/partner/co-build/tasks/{taskId}/evaluation-methods", h.partnerCoBuildHandler.GetTaskEvaluationMethods)
		r.Put("/partner/co-build/tasks/{taskId}/evaluation-methods", h.partnerCoBuildHandler.PutTaskEvaluationMethods)
		r.Get("/partner/co-build/schools/{tenantId}/abilities", h.partnerCoBuildHandler.ListSchoolAbilities)
		r.Get("/partner/co-build/schools/{tenantId}/evaluation-methods", h.partnerCoBuildHandler.ListSchoolEvaluationMethods)
		r.Get("/partner/co-build/schools/{tenantId}/co-builders", h.partnerCoBuildHandler.ListSchoolCoBuilders)
	})

	// 仅企业管理员（企业资料写 + 合作状态确认 + 专家库写）
	r.Group(func(r chi.Router) {
		r.Use(adminOnly)
		r.Put("/partner/enterprise/profile", h.partnerHandler.UpdateProfile)
		r.Put("/partner/schools/{tenantId}/status", h.partnerHandler.UpdateSchoolStatus)
		r.Get("/partner/experts", h.partnerHandler.ListExperts)
		r.Post("/partner/experts", h.partnerHandler.CreateExpert)
		r.Put("/partner/experts/{id}", h.partnerHandler.UpdateExpert)
		r.Delete("/partner/experts/{id}", h.partnerHandler.DeleteExpert)
	})
}
