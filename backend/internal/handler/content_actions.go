package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
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
	st         *store.Store
	table      string
	entityName string
	targetType string
	inviteCol  string
	fetch      func(ctx context.Context, id string) (interface{}, error)
}

// tableFor returns the sanitized table name for contentActions queries.
func (c contentActions) tableFor(w http.ResponseWriter) (string, bool) {
	for _, a := range store.AllowedContentTables {
		if c.table == a {
			return c.table, true
		}
	}
	respondError(w, http.StatusInternalServerError, "表配置无效")
	return "", false
}

// inviteColFor returns the sanitized invite column name for invite().
func (c contentActions) inviteColFor(w http.ResponseWriter) (string, bool) {
	for _, a := range store.AllowedInviteColumns {
		if c.inviteCol == a {
			return c.inviteCol, true
		}
	}
	respondError(w, http.StatusInternalServerError, "邀请列配置无效")
	return "", false
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
	tenantID, err := c.st.ContentActions().GetTenantID(r.Context(), table, id)
	if errors.Is(err, store.ErrNotFound) {
		respondError(w, http.StatusNotFound, c.entityName+"不存在")
		return false
	}
	if err != nil {
		respondServerError(w, r, err, "验证"+c.entityName+"所有权失败")
		return false
	}
	return verifyTenantOwnership(w, r, tenantID)
}

func (c contentActions) saveDraft(w http.ResponseWriter, r *http.Request) {
	c.transition(w, r, domain.StatusDraft)
}

func (c contentActions) transition(w http.ResponseWriter, r *http.Request, status domain.ContentStatus) {
	c.transitionWithHook(w, r, status, nil)
}

// transitionWithHook 与 transition 相同，但在事务提交前调用 hook。
// hook 可用于在状态流转的同时创建/更新关联资源，保持原子性。
func (c contentActions) transitionWithHook(w http.ResponseWriter, r *http.Request, status domain.ContentStatus, hook func(txStore *store.Store, id string) error) {
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

	if err := c.st.ContentActions().Transition(r.Context(), table, id, status, c.targetType, hook); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, c.entityName+"不存在")
			return
		}
		if _, isTransition := err.(interface{ Transition() }); isTransition || strings.HasPrefix(err.Error(), "invalid transition") {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondServerError(w, r, err, "状态流转失败")
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
	if !decodeBody(w, r, &req) {
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

	if err := c.st.ContentActions().Review(r.Context(), table, id, status); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusBadRequest, c.entityName+"不存在或不在待处理状态")
			return
		}
		respondServerError(w, r, err, "审核"+c.entityName+"失败")
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
	if err := c.st.ContentActions().Invite(r.Context(), table, id, inviteCol, req.UserID); err != nil {
		respondServerError(w, r, err, "邀请协作者失败")
		return
	}
	entity, err := c.fetch(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, c.entityName+"不存在")
		return
	}
	respondJSON(w, http.StatusOK, entity)
}
