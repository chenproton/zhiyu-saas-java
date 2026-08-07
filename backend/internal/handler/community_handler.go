package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// CommunityHandler 学习社区接口（发帖/回复/阅读数）。
type CommunityHandler struct {
	Service *service.CommunityService
}

// CreateTopicRequest 发帖请求体。
type CreateTopicRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
	Tag     string `json:"tag"`
}

// CreateReplyRequest 回复请求体（parentId 非空表示回复某条评论）。
type CreateReplyRequest struct {
	Content  string  `json:"content"`
	ParentID *string `json:"parentId"`
}

// ListTopics 帖子列表（sort=hot 按阅读数、latest 按时间流、mine 我的提问）。
func (h *CommunityHandler) ListTopics(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	sort := store.TopicSort(r.URL.Query().Get("sort"))
	switch sort {
	case "", store.TopicSortLatest, store.TopicSortHot, store.TopicSortMine:
	default:
		sort = store.TopicSortLatest
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	items, total, err := h.Service.ListTopics(r.Context(), tenantID, claims.UserID, sort, limit, offset)
	if err != nil {
		respondServerError(w, r, err, "查询话题失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.CommunityTopic]{Items: items, Total: total})
}

// CreateTopic 发帖。
func (h *CommunityHandler) CreateTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req CreateTopicRequest
	if !decodeBody(w, r, &req) {
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Content = strings.TrimSpace(req.Content)
	if req.Title == "" {
		respondError(w, http.StatusBadRequest, "标题不能为空")
		return
	}
	if len([]rune(req.Title)) > 128 {
		respondError(w, http.StatusBadRequest, "标题不能超过 128 字")
		return
	}
	if req.Content == "" {
		respondError(w, http.StatusBadRequest, "内容不能为空")
		return
	}
	req.Tag = strings.TrimSpace(req.Tag)
	if len([]rune(req.Tag)) > 32 {
		respondError(w, http.StatusBadRequest, "标签不能超过 32 字")
		return
	}

	id, err := h.Service.CreateTopic(r.Context(), tenantID, claims.UserID, req.Title, req.Content, req.Tag)
	if err != nil {
		respondServerError(w, r, err, "发帖失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// GetTopic 帖子详情（同时累加阅读数）。
func (h *CommunityHandler) GetTopic(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	topicID := chi.URLParam(r, "id")
	if topicID == "" {
		respondError(w, http.StatusBadRequest, "缺少话题 ID")
		return
	}
	topic, err := h.Service.GetTopic(r.Context(), tenantID, claims.UserID, topicID)
	if err != nil {
		if err == store.ErrNotFound {
			respondError(w, http.StatusNotFound, "话题不存在")
			return
		}
		respondServerError(w, r, err, "查询话题失败")
		return
	}
	respondJSON(w, http.StatusOK, topic)
}

// ListReplies 帖子回复列表。
func (h *CommunityHandler) ListReplies(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	topicID := chi.URLParam(r, "id")
	if topicID == "" {
		respondError(w, http.StatusBadRequest, "缺少话题 ID")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	items, err := h.Service.ListReplies(r.Context(), claims.UserID, tenantID, topicID)
	if err != nil {
		respondServerError(w, r, err, "查询回复失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.CommunityReply]{Items: items, Total: len(items)})
}

// CreateReply 回复帖子/回复评论。
func (h *CommunityHandler) CreateReply(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	topicID := chi.URLParam(r, "id")
	if topicID == "" {
		respondError(w, http.StatusBadRequest, "缺少话题 ID")
		return
	}
	var req CreateReplyRequest
	if !decodeBody(w, r, &req) {
		return
	}
	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" {
		respondError(w, http.StatusBadRequest, "回复内容不能为空")
		return
	}
	if len([]rune(req.Content)) > 2000 {
		respondError(w, http.StatusBadRequest, "回复内容不能超过 2000 字")
		return
	}

	id, err := h.Service.CreateReply(r.Context(), tenantID, claims.UserID, topicID, req.ParentID, req.Content)
	if err != nil {
		if err == store.ErrNotFound {
			respondError(w, http.StatusNotFound, "话题不存在")
			return
		}
		respondServerError(w, r, err, "回复失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
