package router

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	authmw "github.com/zhiyu-saas/backend/internal/middleware"
)

// registerAICenterRoutes AI 智能服务中心路由（docs/spec/ai-service-center.md §5）。
// 用户端挂 portal 平台组（任意登录角色可用，可见性在 service 层判定）；
// 管理端挂 school_admin 角色组。限流：对话/问答走 aiLimiter，上传走 uploadLimiter。
func registerAICenterRoutes(r chi.Router, h *Handlers, aiLimiter, uploadLimiter func(http.Handler) http.Handler) {
	// ---- 知识库 ----
	r.Get("/ai/kb", h.aiCenterHandler.ListKBs)
	r.Post("/ai/kb", h.aiCenterHandler.CreateKB)
	r.Get("/ai/kb/{id}", h.aiCenterHandler.GetKB)
	r.Put("/ai/kb/{id}", h.aiCenterHandler.UpdateKB)
	r.Delete("/ai/kb/{id}", h.aiCenterHandler.DeleteKB)
	r.Post("/ai/kb/{id}/submit", h.aiCenterHandler.SubmitKB)
	r.Post("/ai/kb/{id}/unpublish", h.aiCenterHandler.UnpublishKB)
	r.Get("/ai/kb/{id}/documents", h.aiCenterHandler.ListDocuments)
	r.With(uploadLimiter).Post("/ai/kb/{id}/documents", h.aiCenterHandler.UploadDocument)
	r.Get("/ai/kb/{id}/documents/{docId}", h.aiCenterHandler.GetDocument)
	r.Delete("/ai/kb/{id}/documents/{docId}", h.aiCenterHandler.DeleteDocument)
	r.Get("/ai/kb/{id}/collaborators", h.aiCenterHandler.ListCollaborators)
	r.Post("/ai/kb/{id}/collaborators", h.aiCenterHandler.AddCollaborator)
	r.Put("/ai/kb/{id}/collaborators/{userId}", h.aiCenterHandler.AddCollaborator) // service upsert 语义
	r.Delete("/ai/kb/{id}/collaborators/{userId}", h.aiCenterHandler.RemoveCollaborator)
	r.With(aiLimiter).Post("/ai/kb/{id}/ask", h.aiCenterHandler.KBAsk)

	// ---- 智能体与会话 ----
	r.Get("/ai/agents", h.aiCenterHandler.ListAgents)
	r.Post("/ai/agents", h.aiCenterHandler.CreateAgent)
	r.Get("/ai/agents/{id}", h.aiCenterHandler.GetAgent)
	r.Put("/ai/agents/{id}", h.aiCenterHandler.UpdateAgent)
	r.Delete("/ai/agents/{id}", h.aiCenterHandler.DeleteAgent)
	r.Post("/ai/agents/{id}/submit", h.aiCenterHandler.SubmitAgent)
	r.Post("/ai/agents/{id}/unpublish", h.aiCenterHandler.UnpublishAgent)
	r.With(aiLimiter).Post("/ai/agents/{id}/chat", h.aiCenterHandler.AgentChat)
	r.Get("/ai/agents/{id}/conversations", h.aiCenterHandler.ListConversations)
	r.Get("/ai/conversations/{id}", h.aiCenterHandler.GetConversation)
	r.Delete("/ai/conversations/{id}", h.aiCenterHandler.DeleteConversation)

	// ---- v2.2：KB 问答记录 / YIKnow 通用会话 / 智能体预览 ----
	r.Get("/ai/kb/{id}/asks", h.aiCenterHandler.ListMyKBAsks)
	r.Get("/ai/yiknow/conversations", h.aiCenterHandler.ListGeneralConversations)
	r.With(aiLimiter).Post("/ai/yiknow/chat", h.aiCenterHandler.YIKnowChat)
	r.With(aiLimiter).Post("/ai/agents/{id}/preview", h.aiCenterHandler.PreviewAgent)

	// ---- 广场与第三方挂接展示 ----
	r.Get("/ai/square/kbs", h.aiCenterHandler.SquareKBs)
	r.Get("/ai/square/agents", h.aiCenterHandler.SquareAgents)
	r.Get("/ai/integrations", h.aiCenterHandler.ListIntegrations)

	// ---- 管理端（school_admin）：审核 + 挂接维护 ----
	r.Group(func(r chi.Router) {
		r.Use(authmw.RequireRole(domain.RoleSchoolAdmin))
		r.Get("/ai/admin/reviews", h.aiCenterAdminHandler.ListReviews)
		r.Post("/ai/admin/reviews/{type}/{id}/{action}", h.aiCenterAdminHandler.ReviewAction)
		r.Get("/ai/admin/overview", h.aiCenterAdminHandler.Overview)
		r.Get("/ai/admin/integrations", h.aiCenterAdminHandler.ListIntegrations)
		r.Post("/ai/admin/integrations", h.aiCenterAdminHandler.CreateIntegration)
		r.Put("/ai/admin/integrations/{id}", h.aiCenterAdminHandler.UpdateIntegration)
		r.Post("/ai/admin/integrations/{id}/toggle", h.aiCenterAdminHandler.ToggleIntegration)
		r.Delete("/ai/admin/integrations/{id}", h.aiCenterAdminHandler.DeleteIntegration)
	})
}
