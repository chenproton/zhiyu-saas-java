package handler

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// TagHandler 标签管理 HTTP 适配：标签 CRUD + 资源绑定维护。
type TagHandler struct {
	Service *service.TagService
}

var hexColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// 允许绑定的资源类型（白名单，与各列表页资源一一对应）。
var tagResourceTypes = map[string]string{
	"knowledge_point":      domain.TagResourceTypeKnowledgePoint,
	"resource_library":     domain.TagResourceTypeResourceLibrary,
	"ability_point":        domain.TagResourceTypeAbilityPoint,
	"certificate_library":  domain.TagResourceTypeCertificate,
	"random_draw_question": domain.TagResourceTypeRandomDrawQ,
}

type CreateTagRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type UpdateTagRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type SetResourceTagsRequest struct {
	ResourceType string   `json:"resourceType"`
	ResourceID   string   `json:"resourceId"`
	TagIDs       []string `json:"tagIds"`
}

type QueryBindingsRequest struct {
	ResourceType string   `json:"resourceType"`
	ResourceIDs  []string `json:"resourceIds"`
}

func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	items, err := h.Service.List(r.Context(), tenantID)
	if err != nil {
		respondServerError(w, r, err, "查询标签失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *TagHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req CreateTagRequest
	if !decodeBody(w, r, &req) {
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		respondError(w, http.StatusBadRequest, "标签名称不能为空")
		return
	}
	if len(name) > 64 {
		respondError(w, http.StatusBadRequest, "标签名称不能超过 64 个字符")
		return
	}
	color := strings.TrimSpace(req.Color)
	if color == "" {
		color = "#6366f1"
	}
	if !hexColorPattern.MatchString(color) {
		respondError(w, http.StatusBadRequest, "标签颜色格式不正确（示例：#6366f1）")
		return
	}
	item, err := h.Service.Create(r.Context(), tenantID, name, color)
	if err != nil {
		if errors.Is(err, store.ErrDuplicateTagName) {
			respondError(w, http.StatusConflict, "标签名称已存在")
			return
		}
		respondServerError(w, r, err, "创建标签失败")
		return
	}
	respondJSON(w, http.StatusCreated, item)
}

func (h *TagHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req UpdateTagRequest
	if !decodeBody(w, r, &req) {
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		respondError(w, http.StatusBadRequest, "标签名称不能为空")
		return
	}
	if len(name) > 64 {
		respondError(w, http.StatusBadRequest, "标签名称不能超过 64 个字符")
		return
	}
	color := strings.TrimSpace(req.Color)
	if !hexColorPattern.MatchString(color) {
		respondError(w, http.StatusBadRequest, "标签颜色格式不正确（示例：#6366f1）")
		return
	}
	id := chi.URLParam(r, "id")
	item, err := h.Service.Update(r.Context(), tenantID, id, name, color)
	if err != nil {
		if errors.Is(err, store.ErrDuplicateTagName) {
			respondError(w, http.StatusConflict, "标签名称已存在")
			return
		}
		respondServerError(w, r, err, "更新标签失败")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *TagHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Service.Delete(r.Context(), tenantID, id); err != nil {
		respondServerError(w, r, err, "删除标签失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// SetBindings 全量替换某资源的标签绑定。
func (h *TagHandler) SetBindings(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req SetResourceTagsRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if _, allowed := tagResourceTypes[req.ResourceType]; !allowed {
		respondError(w, http.StatusBadRequest, "不支持的资源类型")
		return
	}
	if req.ResourceID == "" {
		respondError(w, http.StatusBadRequest, "缺少资源 ID")
		return
	}
	if err := h.Service.SetResourceTags(r.Context(), tenantID, req.ResourceType, req.ResourceID, req.TagIDs); err != nil {
		respondServerError(w, r, err, "保存标签绑定失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// QueryBindings 批量查询资源的标签绑定（列表页标签展示用）。
func (h *TagHandler) QueryBindings(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req QueryBindingsRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if _, allowed := tagResourceTypes[req.ResourceType]; !allowed {
		respondError(w, http.StatusBadRequest, "不支持的资源类型")
		return
	}
	if len(req.ResourceIDs) > 200 {
		respondError(w, http.StatusBadRequest, "单次查询资源数量过多")
		return
	}
	items, err := h.Service.QueryBindings(r.Context(), tenantID, req.ResourceType, req.ResourceIDs)
	if err != nil {
		respondServerError(w, r, err, "查询标签绑定失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{"items": items})
}
