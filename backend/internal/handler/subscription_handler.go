package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type SubscriptionHandler struct {
	DB *pgxpool.Pool
}

type UpdateSubscriptionRequest struct {
	Name       string         `json:"name"`
	ValidUntil *string        `json:"validUntil"`
	Modules    domain.JSONMap `json:"modules"`
	Status     string         `json:"status"`
}

func (h *SubscriptionHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}

	sub, err := h.fetchSubscriptionByTenant(r.Context(), tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "subscription not found")
		return
	}
	respondJSON(w, http.StatusOK, sub)
}

func (h *SubscriptionHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchSubscription(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "subscription not found")
		return
	}

	var req UpdateSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}
	if req.Modules == nil {
		req.Modules = domain.JSONMap{}
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE subscription_packages SET name = $1, valid_until = $2, modules = $3, status = $4, updated_at = NOW()
		WHERE id = $5
	`, req.Name, req.ValidUntil, req.Modules, req.Status, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update subscription")
		return
	}

	sub, _ := h.fetchSubscription(r.Context(), id)
	respondJSON(w, http.StatusOK, sub)
}

func (h *SubscriptionHandler) fetchSubscription(ctx context.Context, id string) (domain.SubscriptionPackage, error) {
	var sub domain.SubscriptionPackage
	var validUntil *string
	var modules domain.JSONMap

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, name, valid_until, modules, status, created_at, updated_at
		FROM subscription_packages WHERE id = $1
	`, id).Scan(
		&sub.ID, &sub.TenantID, &sub.Name, &validUntil, &modules, &sub.Status, &sub.CreatedAt, &sub.UpdatedAt,
	)
	if err != nil {
		return sub, err
	}
	sub.ValidUntil = validUntil
	sub.Modules = modules
	return sub, nil
}

func (h *SubscriptionHandler) fetchSubscriptionByTenant(ctx context.Context, tenantID string) (domain.SubscriptionPackage, error) {
	var sub domain.SubscriptionPackage
	var validUntil *string
	var modules domain.JSONMap

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, name, valid_until, modules, status, created_at, updated_at
		FROM subscription_packages WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT 1
	`, tenantID).Scan(
		&sub.ID, &sub.TenantID, &sub.Name, &validUntil, &modules, &sub.Status, &sub.CreatedAt, &sub.UpdatedAt,
	)
	if err != nil {
		return sub, err
	}
	sub.ValidUntil = validUntil
	sub.Modules = modules
	return sub, nil
}
