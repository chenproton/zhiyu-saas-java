package handler

import (
	"context"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type CourseResourceHandler struct {
	Service *service.ResourceBindingService
}

type CreateCourseResourceRequest struct {
	CourseID    string  `json:"courseId"`
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	URL         *string `json:"url"`
	Description *string `json:"description"`
	Size        *int    `json:"size"`
}

type BindCourseResourceRequest struct {
	CourseID   string `json:"courseId"`
	ResourceID string `json:"resourceId"`
}

func (h *CourseResourceHandler) ListResources(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}
	tenantID, ok := tenantFilter(middleware.CurrentUser(r))
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}

	limit, offset := parseLimitOffset(r, 200)

	items, total, err := h.Service.ListCourseResources(r.Context(), tenantID, r.URL.Query().Get("courseId"), r.URL.Query().Get("search"), limit, offset)
	if err != nil {
		respondServerError(w, r, err, "查询课程资源失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.NodeResource]{Items: items, Total: total})
}

func (h *CourseResourceHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req CreateCourseResourceRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CourseID == "" || req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	// 校验课程归属当前租户，防跨租户写入课程资源绑定
	courseTenantID, err := h.Service.CourseTenantID(r.Context(), req.CourseID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "课程不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if !verifyTenantOwnership(w, r, courseTenantID) {
		return
	}

	var fileSize *int64
	if req.Size != nil {
		s := int64(*req.Size)
		fileSize = &s
	}
	uploadedBy := claims.UserID

	row, err := h.Service.Create(r.Context(), tenantID, "course_resource_bindings", "course_id", req.CourseID, &store.ResourceCreateSimpleParams{
		Name:        req.Name,
		Type:        req.Type,
		URL:         req.URL,
		Description: req.Description,
		FileSize:    fileSize,
		UploadedBy:  &uploadedBy,
	}, func(ctx context.Context, q store.Queryer, courseID, resourceID string) error {
		return service.SyncCourseResourceBindingWithQ(ctx, q, courseID, resourceID)
	})
	if err != nil {
		respondServerError(w, r, err, "创建课程资源失败")
		return
	}
	var res domain.NodeResource
	res.ID = row.ID
	res.NodeID = req.CourseID
	res.Name = row.Name
	res.Type = row.Type
	res.URL = row.URL
	if row.Size != "" {
		if n, err := parseInt(row.Size, 0); err == nil {
			res.Size = &n
		}
	}
	res.UploadedBy = row.UploadedBy
	res.UploadedAt = row.UploadedAt
	respondJSON(w, http.StatusCreated, res)
}

func (h *CourseResourceHandler) BindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req BindCourseResourceRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CourseID == "" || req.ResourceID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	courseTenantID, err := h.Service.CourseTenantID(r.Context(), req.CourseID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "课程不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if !verifyTenantOwnership(w, r, courseTenantID) {
		return
	}

	id, err := h.Service.Bind(r.Context(), tenantID, "course_resource_bindings", "course_id", req.CourseID, req.ResourceID, func(ctx context.Context, q store.Queryer, courseID, resourceID string) error {
		return service.SyncCourseResourceBindingWithQ(ctx, q, courseID, resourceID)
	})
	if err != nil {
		respondServerError(w, r, err, "绑定课程资源失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CourseResourceHandler) UnbindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	courseID, err := h.Service.BindTargetID(r.Context(), "course_resource_bindings", id)
	if err != nil {
		respondJSON(w, http.StatusOK, map[string]string{"id": id})
		return
	}
	courseTenantID, err := h.Service.CourseTenantID(r.Context(), courseID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) || errors.Is(err, pgx.ErrNoRows) {
			respondError(w, http.StatusNotFound, "课程不存在")
			return
		}
		respondServerError(w, r, err, "查询失败")
		return
	}
	if !verifyTenantOwnership(w, r, courseTenantID) {
		return
	}
	if err := h.Service.Unbind(r.Context(), "course_resource_bindings", id, func(ctx context.Context, q store.Queryer, courseID, resourceID string) error {
		return store.CourseSyncUnbind(ctx, q, courseID, resourceID)
	}); err != nil {
		respondServerError(w, r, err, "解绑课程资源失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
