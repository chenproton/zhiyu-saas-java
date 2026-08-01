package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type PositionCertificateHandler struct {
	Service *service.PositionConfigService
}

type PositionCertificateListResponse struct {
	Items []domain.PositionCertificate `json:"items"`
	Total int                          `json:"total"`
}

type CreatePositionCertificateRequest struct {
	CareerPositionID string  `json:"careerPositionId"`
	Name             string  `json:"name"`
	URL              *string `json:"url"`
	Description      *string `json:"description"`
	ImageURL         *string `json:"imageUrl"`
}

type UpdatePositionCertificateRequest struct {
	CareerPositionID string  `json:"careerPositionId"`
	Name             string  `json:"name"`
	URL              *string `json:"url"`
	Description      *string `json:"description"`
	ImageURL         *string `json:"imageUrl"`
}

func (h *PositionCertificateHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
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

	items, total, err := h.Service.ListCertificates(r.Context(), r.URL.Query().Get("careerPositionId"), limit, offset)
	if err != nil {
		respondServerError(w, r, err, "查询证书失败")
		return
	}
	respondJSON(w, http.StatusOK, PositionCertificateListResponse{Items: items, Total: total})
}

func (h *PositionCertificateHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.Service.GetCertificate(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "证书不存在")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *PositionCertificateHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreatePositionCertificateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	claims := middleware.CurrentUser(r)
	tenantID := ""
	if claims != nil && claims.TenantID != nil {
		tenantID = *claims.TenantID
	}

	item, err := h.Service.CreateCertificate(r.Context(), tenantID, &store.PositionCertificateParams{
		CareerPositionID: req.CareerPositionID,
		Name:             req.Name,
		URL:              req.URL,
		Description:      req.Description,
		ImageURL:         req.ImageURL,
	})
	if err != nil {
		respondServerError(w, r, err, "创建证书失败")
		return
	}
	respondJSON(w, http.StatusCreated, item)
}

func (h *PositionCertificateHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetCertificate(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "证书不存在")
		return
	}

	var req UpdatePositionCertificateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	claims := middleware.CurrentUser(r)
	tenantID := ""
	if claims != nil && claims.TenantID != nil {
		tenantID = *claims.TenantID
	}

	item, err := h.Service.UpdateCertificate(r.Context(), tenantID, &store.PositionCertificateUpdateParams{
		ID:               id,
		CareerPositionID: req.CareerPositionID,
		Name:             req.Name,
		URL:              req.URL,
		Description:      req.Description,
		ImageURL:         req.ImageURL,
	})
	if err != nil {
		respondServerError(w, r, err, "更新证书失败")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *PositionCertificateHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetCertificate(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "证书不存在")
		return
	}
	if err := h.Service.DeleteCertificate(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除证书失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
