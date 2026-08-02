package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type CertificateLibraryHandler struct {
	Service *service.CertificateLibraryService
	Store   *store.CertificateLibraryStore
}

type CreateCertificateLibraryRequest struct {
	Name        string  `json:"name"`
	URL         *string `json:"url"`
	Description *string `json:"description"`
	ImageURL    *string `json:"imageUrl"`
}

type UpdateCertificateLibraryRequest struct {
	Name        *string `json:"name"`
	URL         *string `json:"url"`
	Description *string `json:"description"`
	ImageURL    *string `json:"imageUrl"`
}

func (h *CertificateLibraryHandler) List(w http.ResponseWriter, r *http.Request) {
	creatorID := r.URL.Query().Get("creatorId")

	items, total, err := executeListQuery[domain.CertificateLibraryItem](r.Context(), h.Service.Queryer(), r, store.ListQueryConfig[domain.CertificateLibraryItem]{
		Table:         "certificate_library",
		SelectColumns: "id, tenant_id, name, url, description, image_url, creator_id, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "description"},
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if creatorID != "" {
				qb.AddCondition("creator_id = " + qb.NextArg(creatorID))
			}
		},
		ScanRows: h.Store.ScanRows,
	})
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		slog.Error("查询证书库列表失败", "error", err)
		respondServerError(w, r, err, "查询证书库列表失败")
		return
	}

	respondJSON(w, http.StatusOK, ListResponse[domain.CertificateLibraryItem]{Items: items, Total: total})
}

func (h *CertificateLibraryHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "证书不存在")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *CertificateLibraryHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var req CreateCertificateLibraryRequest
	if !decodeBody(w, r, &req) {
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	id, err := h.Store.Create(r.Context(), store.CertificateLibraryCreateParams{
		TenantID:    tenantID,
		Name:        req.Name,
		URL:         req.URL,
		Description: req.Description,
		ImageURL:    req.ImageURL,
		CreatorID:   claims.UserID,
	})
	if err != nil {
		slog.Error("创建证书失败", "error", err)
		respondServerError(w, r, err, "创建证书失败")
		return
	}

	item, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusCreated, item)
}

func (h *CertificateLibraryHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "证书不存在")
		return
	}

	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	var req UpdateCertificateLibraryRequest
	if !decodeBody(w, r, &req) {
		return
	}

	updateName := existing.Name
	if req.Name != nil {
		updateName = *req.Name
	}
	updateURL := ""
	if req.URL != nil {
		updateURL = *req.URL
	} else if existing.URL != nil {
		updateURL = *existing.URL
	}
	updateDesc := req.Description
	if updateDesc == nil {
		updateDesc = existing.Description
	}
	updateImg := req.ImageURL
	if updateImg == nil {
		updateImg = existing.ImageURL
	}

	err = h.Store.Update(r.Context(), id, store.CertificateLibraryUpdateParams{
		Name:        updateName,
		URL:         updateURL,
		Description: updateDesc,
		ImageURL:    updateImg,
	})
	if err != nil {
		slog.Error("更新证书失败", "error", err)
		respondServerError(w, r, err, "更新证书失败")
		return
	}

	item, _ := h.Store.GetByID(r.Context(), id)
	respondJSON(w, http.StatusOK, item)
}

func (h *CertificateLibraryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.Store.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "证书不存在")
		return
	}
	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	if err := h.Store.Delete(r.Context(), id); err != nil {
		slog.Error("删除证书失败", "error", err)
		respondServerError(w, r, err, "删除证书失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
