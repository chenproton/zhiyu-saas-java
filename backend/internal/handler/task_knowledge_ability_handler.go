package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type TaskKnowledgeAbilityHandler struct {
	DB *pgxpool.Pool
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

	var id string
	err := h.DB.QueryRow(r.Context(), `
		INSERT INTO task_knowledge_bindings (tenant_id, task_id, knowledge_point_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (task_id, knowledge_point_id) DO UPDATE SET task_id = EXCLUDED.task_id
		RETURNING id
	`, tenantID, req.TaskID, req.KnowledgePointID).Scan(&id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "绑定知识失败")
		return
	}

	var binding domain.TaskKnowledgeBinding
	_ = h.DB.QueryRow(r.Context(), `SELECT id, task_id, knowledge_point_id FROM task_knowledge_bindings WHERE id = $1`, id).Scan(
		&binding.ID, &binding.TaskID, &binding.KnowledgePointID,
	)
	respondJSON(w, http.StatusOK, binding)
}

func (h *TaskKnowledgeAbilityHandler) UnbindKnowledge(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	_, err := h.DB.Exec(r.Context(), `DELETE FROM task_knowledge_bindings WHERE id = $1`, id)
	if err != nil {
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

	var id string
	err := h.DB.QueryRow(r.Context(), `
		INSERT INTO task_ability_bindings (tenant_id, task_id, ability_point_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (task_id, ability_point_id) DO UPDATE SET task_id = EXCLUDED.task_id
		RETURNING id
	`, tenantID, req.TaskID, req.AbilityPointID).Scan(&id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "绑定能力点失败")
		return
	}

	var binding domain.TaskAbilityBinding
	_ = h.DB.QueryRow(r.Context(), `SELECT id, task_id, ability_point_id FROM task_ability_bindings WHERE id = $1`, id).Scan(
		&binding.ID, &binding.TaskID, &binding.AbilityPointID,
	)
	respondJSON(w, http.StatusOK, binding)
}

func (h *TaskKnowledgeAbilityHandler) UnbindAbility(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	_, err := h.DB.Exec(r.Context(), `DELETE FROM task_ability_bindings WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "解绑能力点失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
