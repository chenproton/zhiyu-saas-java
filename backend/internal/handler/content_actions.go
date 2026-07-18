package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

// InviteRequest 内容型实体邀请协作者的公共请求体。
type InviteRequest struct {
	UserID string `json:"userId"`
}

// ContentReviewRequest 内容型实体审核的公共请求体。
type ContentReviewRequest struct {
	Status  string  `json:"status"`
	Comment *string `json:"comment"`
}

// contentActions 封装内容型实体（岗位/场景/课程/题库/试卷）共享的
// 状态流转、审核、协作邀请逻辑，消除各 handler 的复制粘贴实现。
type contentActions struct {
	db         *pgxpool.Pool
	table      string
	entityName string
	inviteCol  string
	fetch      func(ctx context.Context, id string) (interface{}, error)
}

func (c contentActions) transition(w http.ResponseWriter, r *http.Request, status domain.ContentStatus) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := c.db.Exec(r.Context(), `UPDATE `+c.table+` SET status = $1, updated_at = NOW() WHERE id = $2`, status, id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update status")
		return
	}
	entity, err := c.fetch(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, c.entityName+" not found")
		return
	}
	respondJSON(w, http.StatusOK, entity)
}

func (c contentActions) review(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	id := chi.URLParam(r, "id")
	var req ContentReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var status domain.ContentStatus
	switch req.Status {
	case "approved":
		status = domain.StatusApproved
	case "rejected":
		status = domain.StatusRejected
	default:
		respondError(w, http.StatusBadRequest, "invalid review status")
		return
	}

	if _, err := c.db.Exec(r.Context(), `UPDATE `+c.table+` SET status = $1, updated_at = NOW() WHERE id = $2`, status, id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to review "+c.entityName)
		return
	}

	entity, _ := c.fetch(r.Context(), id)
	respondJSON(w, http.StatusOK, entity)
}

func (c contentActions) invite(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	id := chi.URLParam(r, "id")
	var req InviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		respondError(w, http.StatusBadRequest, "userId is required")
		return
	}
	if _, err := c.db.Exec(r.Context(), `
		UPDATE `+c.table+` SET `+c.inviteCol+` = array_append(`+c.inviteCol+`, $1), updated_at = NOW()
		WHERE id = $2 AND NOT (`+c.inviteCol+` @> ARRAY[$1]::uuid[])
	`, req.UserID, id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to invite collaborator")
		return
	}
	entity, err := c.fetch(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, c.entityName+" not found")
		return
	}
	respondJSON(w, http.StatusOK, entity)
}
