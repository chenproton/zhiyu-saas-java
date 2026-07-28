package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type MicroCertHandler struct {
	DB    *pgxpool.Pool
	Store *store.MicroCertStore
}

type MicroCertTemplateListResponse struct {
	Items []domain.MicroCertTemplate `json:"items"`
	Total int                        `json:"total"`
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

type CertIssuanceListResponse struct {
	Items []domain.CertIssuanceRecord `json:"items"`
	Total int                         `json:"total"`
}

func (h *MicroCertHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	items, total, err := executeListQuery[domain.MicroCertTemplate](r.Context(), h.DB, r, listQueryConfig[domain.MicroCertTemplate]{
		Table:         "micro_cert_templates",
		SelectColumns: "id, title, cert_type_id, cert_type_name, content, cover_image, created_at, updated_at",
		TenantScoped:  true,
		SearchColumns: []string{"title"},
		ScanRows:      h.Store.ScanTemplateRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询微证书模板列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询微证书模板列表失败")
		return
	}
	respondJSON(w, http.StatusOK, MicroCertTemplateListResponse{Items: items, Total: total})
}

func (h *MicroCertHandler) ListHistory(w http.ResponseWriter, r *http.Request) {
	items, total, err := executeListQuery[domain.CertIssuanceRecord](r.Context(), h.DB, r, listQueryConfig[domain.CertIssuanceRecord]{
		Table:         "cert_issuance_records",
		SelectColumns: "id, template_id, user_id, cert_number, issue_date, expire_date, status, revoked_at, revoke_reason",
		TenantScoped:  true,
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if templateID := r.URL.Query().Get("templateId"); templateID != "" {
				qb.addCondition("template_id = " + qb.nextArg(templateID))
			}
		},
		ScanRows: h.Store.ScanIssuanceRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询证书发放记录列表失败", "error", err)
		respondError(w, http.StatusInternalServerError, "查询证书发放记录列表失败")
		return
	}
	respondJSON(w, http.StatusOK, CertIssuanceListResponse{Items: items, Total: total})
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Title == "" || req.CertTypeName == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	id, err := h.Store.CreateTemplate(r.Context(), store.MicroCertTemplateCreateParams{
		TenantID:     tenantID,
		Title:        req.Title,
		CertTypeID:   req.CertTypeID,
		CertTypeName: req.CertTypeName,
		Content:      req.Content,
		CoverImage:   req.CoverImage,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建微证书模板失败")
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Title == "" || req.CertTypeName == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if err := h.Store.UpdateTemplate(r.Context(), id, store.MicroCertTemplateUpdateParams{
		Title:        req.Title,
		CertTypeID:   req.CertTypeID,
		CertTypeName: req.CertTypeName,
		Content:      req.Content,
		CoverImage:   req.CoverImage,
	}); err != nil {
		respondError(w, http.StatusInternalServerError, "更新微证书模板失败")
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
		respondError(w, http.StatusInternalServerError, "删除微证书模板失败")
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.TemplateID == "" || len(req.UserIDs) == 0 {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	count, err := h.Store.IssueCerts(r.Context(), tenantID, req.TemplateID, req.UserIDs)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "颁发证书失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]int{"count": count})
}
