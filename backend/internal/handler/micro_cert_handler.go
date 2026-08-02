package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type MicroCertHandler struct {
	Store *store.MicroCertStore
}

type CreateMicroCertTemplateRequest struct {
	Title        string  `json:"title"`
	CertTypeID   string  `json:"certTypeId"`
	CertTypeName string  `json:"certTypeName"`
	Content      string  `json:"content"`
	CoverImage   *string `json:"coverImage"`
}

type IssueCertsRequest struct {
	TemplateID string   `json:"templateId"`
	UserIDs    []string `json:"userIds"`
}

func (h *MicroCertHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Store.ListTemplateConfig()
	items, total, err := executeListQuery[domain.MicroCertTemplate](r.Context(), h.Store.Q(), r, cfg)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询微证书模板列表失败", "error", err)
		respondServerError(w, r, err, "查询微证书模板列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.MicroCertTemplate]{Items: items, Total: total})
}

func (h *MicroCertHandler) ListHistory(w http.ResponseWriter, r *http.Request) {
	cfg := h.Store.ListIssuanceConfig()
	items, total, err := executeListQuery[domain.CertIssuanceRecord](r.Context(), h.Store.Q(), r, cfg)
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询证书发放记录列表失败", "error", err)
		respondServerError(w, r, err, "查询证书发放记录列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.CertIssuanceRecord]{Items: items, Total: total})
}

func normalizeCertTypeID(id string) string {
	if id == "" {
		return ""
	}
	if u, err := uuid.Parse(id); err == nil {
		return u.String()
	}
	return uuid.NewSHA1(uuid.NameSpaceDNS, []byte(id)).String()
}

func (h *MicroCertHandler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	template, err := h.Store.GetTemplate(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "微证书模板不存在")
		return
	}
	respondJSON(w, http.StatusOK, template)
}

func (h *MicroCertHandler) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req CreateMicroCertTemplateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Title == "" || req.CertTypeName == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	id, err := h.Store.CreateTemplate(r.Context(), store.MicroCertTemplateCreateParams{
		TenantID:     tenantID,
		Title:        req.Title,
		CertTypeID:   normalizeCertTypeID(req.CertTypeID),
		CertTypeName: req.CertTypeName,
		Content:      req.Content,
		CoverImage:   req.CoverImage,
	})
	if err != nil {
		respondServerError(w, r, err, "创建微证书模板失败")
		return
	}

	template, _ := h.Store.GetTemplate(r.Context(), id)
	respondJSON(w, http.StatusCreated, template)
}

func (h *MicroCertHandler) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetTemplate(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "微证书模板不存在")
		return
	}

	var req CreateMicroCertTemplateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Title == "" || req.CertTypeName == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if err := h.Store.UpdateTemplate(r.Context(), id, store.MicroCertTemplateUpdateParams{
		Title:        req.Title,
		CertTypeID:   normalizeCertTypeID(req.CertTypeID),
		CertTypeName: req.CertTypeName,
		Content:      req.Content,
		CoverImage:   req.CoverImage,
	}); err != nil {
		respondServerError(w, r, err, "更新微证书模板失败")
		return
	}

	template, _ := h.Store.GetTemplate(r.Context(), id)
	respondJSON(w, http.StatusOK, template)
}

func (h *MicroCertHandler) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Store.GetTemplate(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "微证书模板不存在")
		return
	}

	if err := h.Store.DeleteTemplate(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除微证书模板失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *MicroCertHandler) IssueCerts(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req IssueCertsRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.TemplateID == "" || len(req.UserIDs) == 0 {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	count, err := h.Store.IssueCerts(r.Context(), tenantID, req.TemplateID, req.UserIDs)
	if err != nil {
		respondServerError(w, r, err, "颁发证书失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]int{"count": count})
}
