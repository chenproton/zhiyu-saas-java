package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

type TaskKnowledgeAbilityHandler struct {
	Service *service.ScenarioConfigService
}

type BindTaskKnowledgeRequest struct {
	TaskID           string `json:"taskId"`
	KnowledgePointID string `json:"knowledgePointId"`
}

type BindTaskAbilityRequest struct {
	TaskID         string `json:"taskId"`
	AbilityPointID string `json:"abilityPointId"`
}

func (h *TaskKnowledgeAbilityHandler) BindKnowledge(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req BindTaskKnowledgeRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.TaskID == "" || req.KnowledgePointID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	binding, err := h.Service.BindKnowledge(r.Context(), tenantID, req.TaskID, req.KnowledgePointID)
	if err != nil {
		respondServerError(w, r, err, "绑定知识失败")
		return
	}
	respondJSON(w, http.StatusOK, binding)
}

func (h *TaskKnowledgeAbilityHandler) UnbindKnowledge(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	if err := h.Service.UnbindKnowledge(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "解绑知识失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *TaskKnowledgeAbilityHandler) BindAbility(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req BindTaskAbilityRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.TaskID == "" || req.AbilityPointID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	binding, err := h.Service.BindAbility(r.Context(), tenantID, req.TaskID, req.AbilityPointID)
	if err != nil {
		respondServerError(w, r, err, "绑定能力点失败")
		return
	}
	respondJSON(w, http.StatusOK, binding)
}

func (h *TaskKnowledgeAbilityHandler) UnbindAbility(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	if err := h.Service.UnbindAbility(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "解绑能力点失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
