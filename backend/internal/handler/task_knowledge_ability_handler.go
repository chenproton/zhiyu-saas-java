package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
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
	taskID, err := h.Service.TaskBindingTaskID(r.Context(), "task_knowledge_bindings", id)
	if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
		respondJSON(w, http.StatusOK, map[string]string{"id": id})
		return
	}
	if err != nil {
		respondServerError(w, r, err, "查询绑定失败")
		return
	}
	if !h.verifyTaskTenant(w, r, taskID) {
		return
	}
	if err := h.Service.UnbindKnowledge(r.Context(), id); err != nil {
		respondServerError(w, r, err, "解绑知识失败")
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
	taskID, err := h.Service.TaskBindingTaskID(r.Context(), "task_ability_bindings", id)
	if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
		respondJSON(w, http.StatusOK, map[string]string{"id": id})
		return
	}
	if err != nil {
		respondServerError(w, r, err, "查询绑定失败")
		return
	}
	if !h.verifyTaskTenant(w, r, taskID) {
		return
	}
	if err := h.Service.UnbindAbility(r.Context(), id); err != nil {
		respondServerError(w, r, err, "解绑能力点失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// verifyTaskTenant 校验任务所属场景的租户归属（task→scenario→tenant 链路）。
func (h *TaskKnowledgeAbilityHandler) verifyTaskTenant(w http.ResponseWriter, r *http.Request, taskID string) bool {
	scenarioID, err := h.Service.TaskScenarioID(r.Context(), taskID)
	if err != nil {
		respondError(w, http.StatusNotFound, "任务不存在")
		return false
	}
	scenarioTenantID, err := h.Service.ScenarioTenantID(r.Context(), scenarioID)
	if err != nil {
		respondError(w, http.StatusNotFound, "场景不存在")
		return false
	}
	if scenarioTenantID != nil && !verifyTenantOwnership(w, r, *scenarioTenantID) {
		return false
	}
	return true
}
