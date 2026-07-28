package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
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

// allowedContentTables lists the tables that may be used by contentActions.
var allowedContentTables = []string{"career_positions", "courses", "exams", "question_banks", "scenarios"}

// allowedInviteColumns lists the columns that may be updated by invite().
var allowedInviteColumns = []string{"collaborator_ids", "co_builder_ids", "co_creator_ids", "collaborators"}

// tableFor returns the sanitized table name for contentActions queries.
func (c contentActions) tableFor(w http.ResponseWriter) (string, bool) {
	table, err := sanitizeIdentifier(c.table, allowedContentTables)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "表配置无效")
		return "", false
	}
	return table, true
}

// inviteColFor returns the sanitized invite column name for invite().
func (c contentActions) inviteColFor(w http.ResponseWriter) (string, bool) {
	col, err := sanitizeIdentifier(c.inviteCol, allowedInviteColumns)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "邀请列配置无效")
		return "", false
	}
	return col, true
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

func (c contentActions) checkTenantAccess(w http.ResponseWriter, r *http.Request, id string) bool {
	if _, err := uuid.Parse(id); err != nil {
		respondError(w, http.StatusNotFound, c.entityName+"不存在")
		return false
	}
	table, ok := c.tableFor(w)
	if !ok {
		return false
	}
	var entityTenantID string
	err := c.db.QueryRow(r.Context(), `SELECT tenant_id FROM `+table+` WHERE id = $1`, id).Scan(&entityTenantID)
	if err == pgx.ErrNoRows {
		respondError(w, http.StatusNotFound, c.entityName+"不存在")
		return false
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "验证"+c.entityName+"所有权失败")
		return false
	}
	return verifyTenantOwnership(w, r, entityTenantID)
}

func (c contentActions) saveDraft(w http.ResponseWriter, r *http.Request) {
	c.transition(w, r, domain.StatusDraft)
}

func (c contentActions) transition(w http.ResponseWriter, r *http.Request, status domain.ContentStatus) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if !c.checkTenantAccess(w, r, id) {
		return
	}
	table, ok := c.tableFor(w)
	if !ok {
		return
	}

	var current domain.ContentStatus
	err := c.db.QueryRow(r.Context(), `SELECT status FROM `+table+` WHERE id = $1`, id).Scan(&current)
	if err == pgx.ErrNoRows {
		respondError(w, http.StatusNotFound, c.entityName+"不存在")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "获取当前状态失败")
		return
	}

	if !c.canTransition(current, status) {
		respondError(w, http.StatusBadRequest, fmt.Sprintf("无效的状态流转：%s -> %s", current, status))
		return
	}

	tx, err := c.db.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "开启事务失败")
		return
	}
	defer tx.Rollback(r.Context())

	if _, err := tx.Exec(r.Context(), `UPDATE `+table+` SET status = $1, updated_at = NOW() WHERE id = $2`, status, id); err != nil {
		respondError(w, http.StatusInternalServerError, "更新status失败")
		return
	}

	// 从审批中撤回时，同步删除审批中心对应的待审批记录
	if current == domain.StatusPending && status == domain.StatusDraft && c.targetType != "" {
		if _, err := tx.Exec(r.Context(), `
			DELETE FROM approval_records
			WHERE target_type = $1 AND target_id = $2 AND status = $3
		`, c.targetType, id, string(domain.ApprovalStatusPending)); err != nil {
			respondError(w, http.StatusInternalServerError, "删除审批记录失败")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "提交事务失败")
		return
	}

	entity, err := c.fetch(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, c.entityName+"不存在")
		return
	}
	respondJSON(w, http.StatusOK, entity)
}

func (c contentActions) review(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")

	var req ContentReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	var status domain.ContentStatus
	switch req.Status {
	case "approved":
		status = domain.StatusApproved
	case "rejected":
		status = domain.StatusRejected
	default:
		respondError(w, http.StatusBadRequest, "无效的审核状态")
		return
	}

	if !c.checkTenantAccess(w, r, id) {
		return
	}
	table, ok := c.tableFor(w)
	if !ok {
		return
	}

	tag, err := c.db.Exec(r.Context(), `UPDATE `+table+` SET status = $1, updated_at = NOW() WHERE id = $2 AND status = $3`, status, id, domain.StatusPending)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "审核"+c.entityName+"失败")
		return
	}
	if tag.RowsAffected() == 0 {
		respondError(w, http.StatusBadRequest, c.entityName+"不存在或不在待处理状态")
		return
	}

	entity, _ := c.fetch(r.Context(), id)
	respondJSON(w, http.StatusOK, entity)
}

func (c contentActions) invite(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if !c.checkTenantAccess(w, r, id) {
		return
	}
	table, ok := c.tableFor(w)
	if !ok {
		return
	}
	inviteCol, ok := c.inviteColFor(w)
	if !ok {
		return
	}
	var req InviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" {
		respondError(w, http.StatusBadRequest, "缺少用户ID")
		return
	}
	if _, err := c.db.Exec(r.Context(), `
		UPDATE `+table+` SET `+inviteCol+` = array_append(`+inviteCol+`, $1), updated_at = NOW()
		WHERE id = $2 AND NOT (`+inviteCol+` @> ARRAY[$1]::uuid[])
	`, req.UserID, id); err != nil {
		respondError(w, http.StatusInternalServerError, "邀请协作者失败")
		return
	}
	entity, err := c.fetch(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, c.entityName+"不存在")
		return
	}
	respondJSON(w, http.StatusOK, entity)
}
