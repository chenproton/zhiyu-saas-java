package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type BatchCreateRequest struct {
	Name       string  `json:"name"`
	Code       *string `json:"code"`
	OrgNodeID  *string `json:"orgNodeId"`
	MajorID    *string `json:"majorId"`
	WorkflowID *string `json:"workflowId"`
	Status     string  `json:"status"`
}

type BatchUpdateRequest struct {
	Name       string  `json:"name"`
	Code       *string `json:"code"`
	OrgNodeID  *string `json:"orgNodeId"`
	MajorID    *string `json:"majorId"`
	WorkflowID *string `json:"workflowId"`
	Status     string  `json:"status"`
}

type BatchUpdateStatusRequest struct {
	Status string `json:"status"`
}

type BatchTableConfig struct {
	TableName     string
	WriteTableName string
	SelectColumns string
	EntityName    string
	StatusOpen    string
	StatusClosed  string

	SearchColumns []string

	ExtraListFilters func(r *http.Request, argIdx int) (clauses []string, args []any)

	CreateExtraCols []string
	CreateExtraVals []any

	TenantScoped     bool
	TenantFilterColumn string

	CreateWithStatus bool
	UpdateWithStatus bool

	ScanRow  func(ctx context.Context, db *pgxpool.Pool, id string) (any, error)
	ScanRows func(rows pgx.Rows) (any, error)
}

type BatchHandler struct {
	DB     *pgxpool.Pool
	Config BatchTableConfig
}

func NewBatchHandler(db *pgxpool.Pool, config BatchTableConfig) *BatchHandler {
	return &BatchHandler{DB: db, Config: config}
}

func (h *BatchHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	orgNodeID := r.URL.Query().Get("orgNodeId")
	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")
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

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	if h.Config.TenantScoped && effectiveTenantID != "" {
		tc := h.Config.TenantFilterColumn
		if tc == "" {
			tc = "tenant_id"
		}
		where = append(where, tc+" = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if orgNodeID != "" {
		where = append(where, "org_node_id = $"+itoa(argIdx))
		args = append(args, orgNodeID)
		argIdx++
	}
	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if h.Config.ExtraListFilters != nil {
		clauses, extraArgs := h.Config.ExtraListFilters(r, argIdx)
		for _, c := range clauses {
			where = append(where, c)
		}
		args = append(args, extraArgs...)
		argIdx += len(extraArgs)
	}
	if search != "" {
		if len(h.Config.SearchColumns) == 1 {
			where = append(where, h.Config.SearchColumns[0]+" ILIKE $"+itoa(argIdx))
		} else {
			parts := make([]string, len(h.Config.SearchColumns))
			for i, col := range h.Config.SearchColumns {
				parts[i] = col + " ILIKE $" + itoa(argIdx)
			}
			where = append(where, "("+strings.Join(parts, " OR ")+")")
		}
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM " + h.Config.TableName + " WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := "SELECT " + h.Config.SelectColumns + " FROM " + h.Config.TableName +
		" WHERE " + strings.Join(where, " AND ") +
		" ORDER BY created_at DESC LIMIT $" + itoa(argIdx) + " OFFSET $" + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list "+h.Config.EntityName+"es")
		return
	}
	defer rows.Close()

	items, err := h.Config.ScanRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan "+h.Config.EntityName+"es")
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
}

func (h *BatchHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	batch, err := h.Config.ScanRow(r.Context(), h.DB, id)
	if err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+" not found")
		return
	}
	respondJSON(w, http.StatusOK, batch)
}

func (h *BatchHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req BatchCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	id := uuid.NewString()
	status := h.Config.StatusOpen
	if h.Config.CreateWithStatus && req.Status != "" {
		status = req.Status
	}

	var tenantID *string
	if claims.TenantID != nil && *claims.TenantID != "" {
		tenantID = claims.TenantID
	}

	cols := []string{"id", "name", "code", "org_node_id", "major_id", "workflow_id", "status"}
	vals := []any{id, req.Name, req.Code, req.OrgNodeID, req.MajorID, req.WorkflowID, status}
	if h.Config.TenantScoped {
		cols = append(cols, "tenant_id")
		vals = append(vals, tenantID)
	}
	cols = append(cols, h.Config.CreateExtraCols...)
	vals = append(vals, h.Config.CreateExtraVals...)

	placeholders := make([]string, len(cols))
	for i := range cols {
		placeholders[i] = "$" + itoa(i+1)
	}

	query := "INSERT INTO " + h.Config.WriteTableName + " (" + strings.Join(cols, ", ") + ") VALUES (" + strings.Join(placeholders, ", ") + ")"
	_, err := h.DB.Exec(r.Context(), query, vals...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create "+h.Config.EntityName)
		return
	}

	batch, _ := h.Config.ScanRow(r.Context(), h.DB, id)
	respondJSON(w, http.StatusCreated, batch)
}

func (h *BatchHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Config.ScanRow(r.Context(), h.DB, id); err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+" not found")
		return
	}

	var req BatchUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	setClauses := []string{"name = $1", "code = $2", "org_node_id = $3", "major_id = $4", "workflow_id = $5", "updated_at = NOW()"}
	args := []any{req.Name, req.Code, req.OrgNodeID, req.MajorID, req.WorkflowID}
	argIdx := 6

	if h.Config.UpdateWithStatus {
		status := h.Config.StatusOpen
		if req.Status != "" {
			status = req.Status
		}
		setClauses = append(setClauses, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}

	query := "UPDATE " + h.Config.WriteTableName + " SET " + strings.Join(setClauses, ", ") + " WHERE id = $" + itoa(argIdx)
	args = append(args, id)

	_, err := h.DB.Exec(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update "+h.Config.EntityName)
		return
	}

	batch, _ := h.Config.ScanRow(r.Context(), h.DB, id)
	respondJSON(w, http.StatusOK, batch)
}

func (h *BatchHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Config.ScanRow(r.Context(), h.DB, id); err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+" not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), "DELETE FROM "+h.Config.WriteTableName+" WHERE id = $1", id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete "+h.Config.EntityName)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *BatchHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Config.ScanRow(r.Context(), h.DB, id); err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+" not found")
		return
	}

	var req BatchUpdateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Status != h.Config.StatusOpen && req.Status != h.Config.StatusClosed {
		respondError(w, http.StatusBadRequest, "invalid status")
		return
	}

	_, err := h.DB.Exec(r.Context(), "UPDATE "+h.Config.WriteTableName+" SET status = $1, updated_at = NOW() WHERE id = $2", req.Status, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update "+h.Config.EntityName+" status")
		return
	}

	batch, _ := h.Config.ScanRow(r.Context(), h.DB, id)
	respondJSON(w, http.StatusOK, batch)
}
