package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type UserExtensionFieldHandler struct {
	DB *pgxpool.Pool
}

type UserExtensionFieldListResponse struct {
	Items []domain.UserExtensionField `json:"items"`
}

type UpdateUserExtensionFieldRequest struct {
	FieldName           string   `json:"fieldName"`
	IsEnabled           bool     `json:"isEnabled"`
	IsRequired          bool     `json:"isRequired"`
	ApplicableRoleCodes []string `json:"applicableRoleCodes"`
}

func (h *UserExtensionFieldHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	tenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}

	if err := h.ensureDefaultSlots(r.Context(), tenantID); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to ensure default extension fields")
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT id, tenant_id, field_key, field_name, field_type, is_enabled, is_required,
			applicable_role_codes, slot_number, created_at
		FROM user_extension_fields
		WHERE tenant_id = $1
		ORDER BY slot_number ASC
	`, tenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list extension fields")
		return
	}
	defer rows.Close()

	items, err := h.scanUserExtensionFieldRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan extension fields")
		return
	}

	respondJSON(w, http.StatusOK, UserExtensionFieldListResponse{Items: items})
}

func (h *UserExtensionFieldHandler) Update(w http.ResponseWriter, r *http.Request) {
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")

	var existing domain.UserExtensionField
	var applicableCodes []string
	err := h.DB.QueryRow(r.Context(), `
		SELECT id, tenant_id, field_key, field_name, field_type, is_enabled, is_required,
			applicable_role_codes, slot_number, created_at
		FROM user_extension_fields WHERE id = $1
	`, id).Scan(
		&existing.ID, &existing.TenantID, &existing.FieldKey, &existing.FieldName, &existing.FieldType,
		&existing.IsEnabled, &existing.IsRequired, &applicableCodes, &existing.SlotNumber, &existing.CreatedAt,
	)
	if err != nil {
		respondError(w, http.StatusNotFound, "extension field not found")
		return
	}
	existing.ApplicableRoleCodes = applicableCodes
	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	var req UpdateUserExtensionFieldRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.FieldName == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	roleCodes := h.filterTenantRoleCodes(r.Context(), existing.TenantID, req.ApplicableRoleCodes)

	_, err = h.DB.Exec(r.Context(), `
		UPDATE user_extension_fields SET field_name = $1, is_enabled = $2, is_required = $3,
			applicable_role_codes = $4
		WHERE id = $5
	`, req.FieldName, req.IsEnabled, req.IsRequired, roleCodes, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update extension field")
		return
	}

	updated, _ := h.fetchUserExtensionField(r.Context(), id)
	respondJSON(w, http.StatusOK, updated)
}

func (h *UserExtensionFieldHandler) ensureDefaultSlots(ctx context.Context, tenantID string) error {
	rows, err := h.DB.Query(ctx, `
		SELECT slot_number FROM user_extension_fields WHERE tenant_id = $1
	`, tenantID)
	if err != nil {
		return err
	}
	defer rows.Close()

	existing := make(map[int]bool)
	for rows.Next() {
		var slot int
		if err := rows.Scan(&slot); err != nil {
			return err
		}
		existing[slot] = true
	}

	for slot := 1; slot <= 20; slot++ {
		if existing[slot] {
			continue
		}
		fieldKey := "field_" + itoa(slot)
		fieldName := "扩展字段" + itoa(slot)
		_, err := h.DB.Exec(ctx, `
			INSERT INTO user_extension_fields (id, tenant_id, field_key, field_name, field_type, is_enabled, is_required, applicable_role_codes, slot_number)
			VALUES ($1, $2, $3, $4, 'text', FALSE, FALSE, '{}', $5)
			ON CONFLICT (tenant_id, field_key) DO NOTHING
		`, uuid.NewString(), tenantID, fieldKey, fieldName, slot)
		if err != nil {
			return err
		}
	}
	return nil
}

// filterTenantRoleCodes keeps only codes that exist as roles under the tenant.
func (h *UserExtensionFieldHandler) filterTenantRoleCodes(ctx context.Context, tenantID string, codes []string) []string {
	if len(codes) == 0 {
		return []string{}
	}
	rows, err := h.DB.Query(ctx, `
		SELECT code FROM roles WHERE tenant_id = $1 AND code = ANY($2::text[])
	`, tenantID, codes)
	if err != nil {
		return []string{}
	}
	defer rows.Close()

	valid := make([]string, 0, len(codes))
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err == nil {
			valid = append(valid, code)
		}
	}
	sort.Strings(valid)
	return valid
}

func (h *UserExtensionFieldHandler) canManageUsers(r *http.Request) bool {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		return false
	}
	return canManagePortal(claims)
}

func (h *UserExtensionFieldHandler) fetchUserExtensionField(ctx context.Context, id string) (domain.UserExtensionField, error) {
	var field domain.UserExtensionField
	var applicableCodes []string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, field_key, field_name, field_type, is_enabled, is_required,
			applicable_role_codes, slot_number, created_at
		FROM user_extension_fields WHERE id = $1
	`, id).Scan(
		&field.ID, &field.TenantID, &field.FieldKey, &field.FieldName, &field.FieldType,
		&field.IsEnabled, &field.IsRequired, &applicableCodes, &field.SlotNumber, &field.CreatedAt,
	)
	if err != nil {
		return field, err
	}
	field.ApplicableRoleCodes = applicableCodes
	return field, nil
}

func (h *UserExtensionFieldHandler) scanUserExtensionFieldRows(rows pgx.Rows) ([]domain.UserExtensionField, error) {
	items := make([]domain.UserExtensionField, 0)
	for rows.Next() {
		var field domain.UserExtensionField
		var applicableCodes []string
		if err := rows.Scan(
			&field.ID, &field.TenantID, &field.FieldKey, &field.FieldName, &field.FieldType,
			&field.IsEnabled, &field.IsRequired, &applicableCodes, &field.SlotNumber, &field.CreatedAt,
		); err != nil {
			return nil, err
		}
		field.ApplicableRoleCodes = applicableCodes
		items = append(items, field)
	}
	return items, nil
}
