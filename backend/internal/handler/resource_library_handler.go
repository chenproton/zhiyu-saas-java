package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type ResourceLibraryHandler struct {
	Service *service.ResourceService
}
type CreateResourceLibraryRequest struct {
	Name         string              `json:"name"`
	ResourceType domain.ResourceType `json:"resourceType"`
	URL          *string             `json:"url"`
	Description  *string             `json:"description"`
	Thumbnail    *string             `json:"thumbnail"`
	FileSize     *int64              `json:"fileSize"`
	Metadata     domain.JSONMap      `json:"metadata"`
}

type UpdateResourceLibraryRequest struct {
	Name         *string              `json:"name"`
	ResourceType *domain.ResourceType `json:"resourceType"`
	URL          *string              `json:"url"`
	Description  *string              `json:"description"`
	Thumbnail    *string              `json:"thumbnail"`
	FileSize     *int64               `json:"fileSize"`
	Metadata     domain.JSONMap       `json:"metadata"`
}

// PreviewImportRequest 批量导入重名校验请求。
type PreviewImportRequest struct {
	Names        []string            `json:"names"`
	ResourceType domain.ResourceType `json:"resourceType"`
}

// PreviewImport 批量导入前按名称校验重名，返回已存在的资源列表。
func (h *ResourceLibraryHandler) PreviewImport(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req PreviewImportRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Names) == 0 || req.ResourceType == "" {
		respondError(w, http.StatusBadRequest, "缺少名称或资源类型")
		return
	}

	items, err := h.Service.FindByNames(r.Context(), tenantID, string(req.ResourceType), req.Names)
	if err != nil {
		respondServerError(w, r, err, "查询重名资源失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ResourceLibraryItem]{Items: items, Total: len(items)})
}

func (h *ResourceLibraryHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	limit := 50
	if v, err := parsePageLimit(r.URL.Query().Get("limit"), 50); err == nil && v > 0 {
		limit = v
	}
	offset := 0
	if v, err := parseInt(r.URL.Query().Get("offset"), 0); err == nil && v >= 0 {
		offset = v
	}

	filter := store.ResourceFilter{
		Search:       r.URL.Query().Get("search"),
		ResourceType: r.URL.Query().Get("resourceType"),
		OrgName:      r.URL.Query().Get("orgName"),
		MajorName:    r.URL.Query().Get("majorName"),
		UploadedBy:   r.URL.Query().Get("uploadedBy"),
		TagIDs:       store.SplitTagIDs(r.URL.Query().Get("tagIds")),
		Limit:        limit,
		Offset:       offset,
	}

	items, total, err := h.Service.List(r.Context(), tenantID, filter)
	if err != nil {
		respondServerError(w, r, err, "查询资源失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ResourceLibraryItem]{Items: items, Total: total})
}

// Stats 返回资源按类型统计（列表总览统计卡片用）。
func (h *ResourceLibraryHandler) Stats(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	counts, err := h.Service.CountByType(r.Context(), tenantID, r.URL.Query().Get("search"))
	if err != nil {
		respondServerError(w, r, err, "查询资源统计失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": counts})
}

// CitationStats 资源引用次数分布（顶部指标卡片用；可选 resourceType 过滤）。
func (h *ResourceLibraryHandler) CitationStats(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	stats, err := h.Service.CitationStats(r.Context(), tenantID, r.URL.Query().Get("resourceType"))
	if err != nil {
		respondServerError(w, r, err, "查询资源引用统计失败")
		return
	}
	respondJSON(w, http.StatusOK, stats)
}

// UncitedList 零引用资源列表（弹窗：上传时段筛选 + 分页；可选 resourceType 过滤）。
func (h *ResourceLibraryHandler) UncitedList(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	from, to, ok := parseDateRange(w, r)
	if !ok {
		return
	}
	limit, err := parsePageLimit(r.URL.Query().Get("limit"), 20)
	if err != nil {
		limit = 20
	}
	offset := 0
	if v, err := parseInt(r.URL.Query().Get("offset"), 0); err == nil && v >= 0 {
		offset = v
	}
	items, total, err := h.Service.ListUncitedResources(r.Context(), tenantID, r.URL.Query().Get("resourceType"), from, to, limit, offset)
	if err != nil {
		respondServerError(w, r, err, "查询零引用资源失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[store.UncitedItem]{Items: items, Total: total})
}

func (h *ResourceLibraryHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源不存在")
		return
	}

	if !verifyTenantOwnership(w, r, item.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *ResourceLibraryHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req CreateResourceLibraryRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.Name == "" || req.ResourceType == "" {
		respondError(w, http.StatusBadRequest, "缺少名称或资源类型")
		return
	}

	claims := middleware.CurrentUser(r)
	item, err := h.Service.Create(r.Context(), tenantID, &store.ResourceCreateParams{
		Name:         req.Name,
		ResourceType: req.ResourceType,
		URL:          req.URL,
		Description:  req.Description,
		Thumbnail:    req.Thumbnail,
		FileSize:     req.FileSize,
		Metadata:     req.Metadata,
		UploadedBy:   claims.UserID,
	})
	if err != nil {
		respondServerError(w, r, err, "创建资源失败")
		return
	}
	respondJSON(w, http.StatusCreated, item)
}

func (h *ResourceLibraryHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源不存在")
		return
	}

	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	var req UpdateResourceLibraryRequest
	if !decodeBody(w, r, &req) {
		return
	}

	params := &store.ResourceUpdateParams{
		Name:         existing.Name,
		ResourceType: existing.ResourceType,
		URL:          existing.URL,
		Description:  existing.Description,
		Thumbnail:    existing.Thumbnail,
		FileSize:     existing.FileSize,
		Metadata:     existing.Metadata,
	}
	if req.Name != nil {
		params.Name = *req.Name
	}
	if req.ResourceType != nil {
		params.ResourceType = *req.ResourceType
	}
	if req.URL != nil {
		params.URL = req.URL
	}
	if req.Description != nil {
		params.Description = req.Description
	}
	if req.Thumbnail != nil {
		params.Thumbnail = req.Thumbnail
	}
	if req.FileSize != nil {
		params.FileSize = req.FileSize
	}
	if req.Metadata != nil {
		params.Metadata = req.Metadata
	}

	item, err := h.Service.Update(r.Context(), id, params)
	if err != nil {
		respondServerError(w, r, err, "更新资源失败")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *ResourceLibraryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "资源不存在")
		return
	}

	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	if err := h.Service.Delete(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除资源失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
