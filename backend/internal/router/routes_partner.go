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
		r.Put("/partner/enterprise/profile", h.partnerHandler.UpdateProfile)
		r.Get("/partner/experts", h.partnerHandler.ListExperts)
		r.Get("/partner/experts/{id}", h.partnerHandler.GetExpert)
		r.Get("/partner/workspace/dashboard", h.partnerHandler.Dashboard)
		r.Get("/partner/schools", h.partnerHandler.ListSchools)
		r.Put("/partner/me/password", h.partnerHandler.ChangeMyPassword)
	})

	// 仅企业管理员（专家写 + 成员管理）
	r.Group(func(r chi.Router) {
		r.Use(adminOnly)
		r.Post("/partner/experts", h.partnerHandler.CreateExpert)
		r.Put("/partner/experts/{id}", h.partnerHandler.UpdateExpert)
		r.Delete("/partner/experts/{id}", h.partnerHandler.DeleteExpert)
		r.Get("/partner/members", h.partnerHandler.ListMembers)
		r.Post("/partner/members", h.partnerHandler.CreateMember)
		r.Put("/partner/members/{id}", h.partnerHandler.UpdateMember)
		r.Delete("/partner/members/{id}", h.partnerHandler.DeleteMember)
	})
}
