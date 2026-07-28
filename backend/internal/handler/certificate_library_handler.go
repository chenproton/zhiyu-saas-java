package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type CertificateLibraryHandler struct {
	DB *pgxpool.Pool
}

type CertificateLibraryListResponse struct {
	Items []domain.CertificateLibraryItem `json:"items"`
	Total int                             `json:"total"`
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

	items, total, err := executeListQuery[domain.CertificateLibraryItem](r.Context(), h.DB, r, listQueryConfig[domain.CertificateLibraryItem]{
		Table:         "certificate_library",
		SelectColumns: "id, tenant_id, name, url, description, image_url, creator_id, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "description"},
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if creatorID != "" {
				qb.addCondition("creator_id = " + qb.nextArg(creatorID))
			}
		},
		ScanRows: h.scanCertificateLibraryRows,
	})
	if err != nil {
		if errors.Is(err, ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, CertificateLibraryListResponse{Items: items, Total: total})
}

func (h *CertificateLibraryHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.fetchItem(r.Context(), id)
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	id := uuid.NewString()
	creatorID := claims.UserID
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO certificate_library (id, tenant_id, name, url, description, image_url, creator_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, tenantID, req.Name, req.URL, req.Description, req.ImageURL, creatorID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建证书失败")
		return
	}

	item, _ := h.fetchItem(r.Context(), id)
	respondJSON(w, http.StatusCreated, item)
}

func (h *CertificateLibraryHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchItem(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "证书不存在")
		return
	}

	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	var req UpdateCertificateLibraryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	name := existing.Name
	url := existing.URL
	description := existing.Description
	imageURL := existing.ImageURL
	if req.Name != nil {
		name = *req.Name
	}
	if req.URL != nil {
		url = req.URL
	}
	if req.Description != nil {
		description = req.Description
	}
	if req.ImageURL != nil {
		imageURL = req.ImageURL
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE certificate_library SET
			name = $1, url = $2, description = $3, image_url = $4
		WHERE id = $5
	`, name, url, description, imageURL, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新证书失败")
		return
	}

	item, _ := h.fetchItem(r.Context(), id)
	respondJSON(w, http.StatusOK, item)
}

func (h *CertificateLibraryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.fetchItem(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "证书不存在")
		return
	}

	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM certificate_library WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除证书失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CertificateLibraryHandler) fetchItem(ctx context.Context, id string) (domain.CertificateLibraryItem, error) {
	var item domain.CertificateLibraryItem
	var url, description, imageURL, creatorID *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, name, url, description, image_url, creator_id, created_at
		FROM certificate_library WHERE id = $1
	`, id).Scan(
		&item.ID, &item.TenantID, &item.Name, &url, &description, &imageURL, &creatorID, &item.CreatedAt,
	)
	if err != nil {
		return item, err
	}
	item.URL = url
	item.Description = description
	item.ImageURL = imageURL
	item.CreatorID = creatorID
	return item, nil
}

func (h *CertificateLibraryHandler) scanCertificateLibraryRows(rows pgx.Rows) ([]domain.CertificateLibraryItem, error) {
	items := make([]domain.CertificateLibraryItem, 0)
	for rows.Next() {
		var item domain.CertificateLibraryItem
		var url, description, imageURL, creatorID *string
		if err := rows.Scan(
			&item.ID, &item.TenantID, &item.Name, &url, &description, &imageURL, &creatorID, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		item.URL = url
		item.Description = description
		item.ImageURL = imageURL
		item.CreatorID = creatorID
		items = append(items, item)
	}
	return items, nil
}
