package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type UserRelationHandler struct {
	Service *service.UserRelationService
}
type CreateUserRelationRequest struct {
	InitiatorID  string `json:"initiatorId"`
	TargetID     string `json:"targetId"`
	RelationType string `json:"relationType"`
	Description  string `json:"description,omitempty"`
}

func (h *UserRelationHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	effectiveTenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	limit, offset := parseLimitOffset(r, 50)

	items, total, err := h.Service.List(r.Context(), effectiveTenantID, r.URL.Query().Get("search"), limit, offset)
	if err != nil {
		respondServerError(w, r, err, "查询用户关系失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[store.UserRelationItem]{Items: items, Total: total})
}

func (h *UserRelationHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	effectiveTenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	var req CreateUserRelationRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.InitiatorID == "" || req.TargetID == "" || req.RelationType == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.InitiatorID == req.TargetID {
		respondError(w, http.StatusBadRequest, "发起者和目标不能是同一用户")
		return
	}
	// 仅允许以本人为发起者，防止代他人创建关系
	if req.InitiatorID != claims.UserID {
		respondError(w, http.StatusForbidden, "仅可发起与本人的用户关系")
		return
	}

	var description *string
	if req.Description != "" {
		description = &req.Description
	}

	id, err := h.Service.Create(r.Context(), effectiveTenantID, &service.UserRelationCreateParams{
		InitiatorID:  req.InitiatorID,
		TargetID:     req.TargetID,
		RelationType: req.RelationType,
		Description:  description,
	})
	if err != nil {
		respondError(w, http.StatusBadRequest, "发起者或目标不在租户中")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (h *UserRelationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	effectiveTenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	id := chi.URLParam(r, "id")
	// 删除前校验归属：仅关系双方（发起者或目标）可删除，防止租户内任意用户删他人关系
	initiatorID, targetID, err := h.Service.Get(r.Context(), id, effectiveTenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "用户关系不存在")
		return
	}
	if claims.UserID != initiatorID && claims.UserID != targetID {
		respondError(w, http.StatusForbidden, "仅关系双方可删除该关系")
		return
	}
	deleted, err := h.Service.Delete(r.Context(), id, effectiveTenantID)
	if err != nil {
		respondServerError(w, r, err, "删除用户关系失败")
		return
	}
	if !deleted {
		respondError(w, http.StatusNotFound, "用户关系不存在")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
