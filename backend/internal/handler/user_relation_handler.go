package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type UserRelationHandler struct {
	DB *pgxpool.Pool
}

type UserRelationItem struct {
	ID            string `json:"id"`
	InitiatorID   string `json:"initiatorId"`
	InitiatorName string `json:"initiatorName"`
	InitiatorDept string `json:"initiatorDept"`
	TargetID      string `json:"targetId"`
	TargetName    string `json:"targetName"`
	TargetDept    string `json:"targetDept"`
	RelationType  string `json:"relationType"`
	CreatedAt     string `json:"createdAt"`
}

type UserRelationListResponse struct {
	Items []UserRelationItem `json:"items"`
	Total int                `json:"total"`
}

type CreateUserRelationRequest struct {
	InitiatorID  string `json:"initiatorId"`
	TargetID     string `json:"targetId"`
	RelationType string `json:"relationType"`
	Description  string `json:"description,omitempty"`
}

func (h *UserRelationHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	effectiveTenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	if effectiveTenantID != "" {
		where = append(where, "r.tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	search := r.URL.Query().Get("search")
	if search != "" {
		where = append(where, "(init_u.name ILIKE $"+itoa(argIdx)+" OR tgt_u.name ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	countQuery := `SELECT COUNT(*) FROM user_relations r WHERE ` + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT r.id, r.initiator_id, init_u.name, COALESCE(init_org.name, ''),
			r.target_id, tgt_u.name, COALESCE(tgt_org.name, ''),
			r.relation_type, r.created_at
		FROM user_relations r
		LEFT JOIN users init_u ON init_u.id = r.initiator_id
		LEFT JOIN organizations init_org ON init_org.id = COALESCE(r.initiator_org_node_id, init_u.org_node_id)
		LEFT JOIN users tgt_u ON tgt_u.id = r.target_id
		LEFT JOIN organizations tgt_org ON tgt_org.id = COALESCE(r.target_org_node_id, tgt_u.org_node_id)
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY r.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list user relations")
		return
	}
	defer rows.Close()

	items := []UserRelationItem{}
	for rows.Next() {
		var item UserRelationItem
		var createdAt interface{}
		if err := rows.Scan(&item.ID, &item.InitiatorID, &item.InitiatorName, &item.InitiatorDept,
			&item.TargetID, &item.TargetName, &item.TargetDept,
			&item.RelationType, &createdAt); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to scan user relation")
			return
		}
		item.CreatedAt = fmtTime(createdAt)
		items = append(items, item)
	}

	respondJSON(w, http.StatusOK, UserRelationListResponse{Items: items, Total: total})
}

func (h *UserRelationHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	effectiveTenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}

	var req CreateUserRelationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.InitiatorID == "" || req.TargetID == "" || req.RelationType == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	var validUsers int
	_ = h.DB.QueryRow(r.Context(), `
		SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND id = ANY($2::uuid[])
	`, effectiveTenantID, []string{req.InitiatorID, req.TargetID}).Scan(&validUsers)
	if validUsers != 2 {
		respondError(w, http.StatusBadRequest, "initiator or target not found in tenant")
		return
	}

	id := uuid.NewString()
	var description *string
	if req.Description != "" {
		description = &req.Description
	}
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO user_relations (id, tenant_id, initiator_id, target_id, relation_type, description)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, effectiveTenantID, req.InitiatorID, req.TargetID, req.RelationType, description)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create user relation")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]string{"id": id})
}

func (h *UserRelationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}
	effectiveTenantID, ok := tenantFilter(claims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}

	id := chi.URLParam(r, "id")
	result, err := h.DB.Exec(r.Context(),
		`DELETE FROM user_relations WHERE id = $1 AND tenant_id = $2`,
		id, effectiveTenantID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete user relation")
		return
	}
	if result.RowsAffected() == 0 {
		respondError(w, http.StatusNotFound, "user relation not found")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func fmtTime(v interface{}) string {
	if t, ok := v.(interface{ Format(string) string }); ok {
		return t.Format("2006-01-02 15:04:05")
	}
	if b, ok := v.([]byte); ok {
		return string(b)
	}
	return ""
}
