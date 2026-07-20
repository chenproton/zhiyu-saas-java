package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
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
	targetType string
	inviteCol  string
	fetch      func(ctx context.Context, id string) (interface{}, error)
}

// allowedStatusTransitions 定义内容实体允许的状态流转。
// key 为当前状态，value 为可进入的目标状态集合。
var allowedStatusTransitions = map[domain.ContentStatus][]domain.ContentStatus{
	domain.StatusDraft:     {domain.StatusPending, domain.StatusArchived},
	domain.StatusRejected:  {domain.StatusDraft, domain.StatusPending, domain.StatusArchived},
	domain.StatusPending:   {domain.StatusDraft, domain.StatusApproved, domain.StatusRejected},
	domain.StatusApproved:  {domain.StatusDraft, domain.StatusPublished, domain.StatusArchived},
	domain.StatusPublished: {domain.StatusDraft, domain.StatusArchived},
	domain.StatusArchived:  {domain.StatusDraft},
}

func (c contentActions) canTransition(from, to domain.ContentStatus) bool {
	for _, s := range allowedStatusTransitions[from] {
		if s == to {
			return true
		}
	}
	return false
}

func (c contentActions) saveDraft(w http.ResponseWriter, r *http.Request) {
	c.transition(w, r, domain.StatusDraft)
}

func (c contentActions) transition(w http.ResponseWriter, r *http.Request, status domain.ContentStatus) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	id := chi.URLParam(r, "id")

	var current domain.ContentStatus
	err := c.db.QueryRow(r.Context(), `SELECT status FROM `+c.table+` WHERE id = $1`, id).Scan(&current)
	if err == pgx.ErrNoRows {
		respondError(w, http.StatusNotFound, c.entityName+" not found")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch current status")
		return
	}

	if !c.canTransition(current, status) {
		respondError(w, http.StatusBadRequest, fmt.Sprintf("invalid status transition from %s to %s", current, status))
		return
	}

	tx, err := c.db.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	if _, err := tx.Exec(r.Context(), `UPDATE `+c.table+` SET status = $1, updated_at = NOW() WHERE id = $2`, status, id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update status")
		return
	}

	// 从审批中撤回时，同步删除审批中心对应的待审批记录
	if current == domain.StatusPending && status == domain.StatusDraft && c.targetType != "" {
		if _, err := tx.Exec(r.Context(), `
			DELETE FROM approval_records
			WHERE target_type = $1 AND target_id = $2 AND status = $3
		`, c.targetType, id, string(domain.ApprovalStatusPending)); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to delete approval record")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit transaction")
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

	var current domain.ContentStatus
	if err := c.db.QueryRow(r.Context(), `SELECT status FROM `+c.table+` WHERE id = $1`, id).Scan(&current); err != nil {
		if err == pgx.ErrNoRows {
			respondError(w, http.StatusNotFound, c.entityName+" not found")
		} else {
			respondError(w, http.StatusInternalServerError, "failed to fetch current status")
		}
		return
	}
	if current != domain.StatusPending {
		respondError(w, http.StatusBadRequest, "can only review pending "+c.entityName)
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
