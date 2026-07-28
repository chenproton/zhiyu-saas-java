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

	ExtraListFilters listQueryFilter

	CreateExtraCols []string
	CreateExtraVals []any

	TenantScoped     bool
	TenantFilterColumn string

	CreateWithStatus bool
	UpdateWithStatus bool

	ScanRow  func(ctx context.Context, db *pgxpool.Pool, id string) (any, error)
	ScanRows func(rows pgx.Rows) ([]any, error)
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
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	orgNodeID := r.URL.Query().Get("orgNodeId")
	status := r.URL.Query().Get("status")

	tenantColumn := h.Config.TenantFilterColumn
	if tenantColumn == "" {
		tenantColumn = "tenant_id"
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, listQueryConfig[any]{
		Table:         h.Config.TableName,
		SelectColumns: h.Config.SelectColumns,
		TenantScoped:  h.Config.TenantScoped,
		TenantColumn:  tenantColumn,
		SearchColumns: h.Config.SearchColumns,
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if orgNodeID != "" {
				qb.addCondition("org_node_id = " + qb.nextArg(orgNodeID))
			}
			if status != "" {
				qb.addCondition("status = " + qb.nextArg(status))
			}
			if h.Config.ExtraListFilters != nil {
				h.Config.ExtraListFilters(r, qb)
			}
		},
		ScanRows: h.Config.ScanRows,
	})
	if err != nil {
		if err.Error() == "missing tenant" {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询"+h.Config.EntityName+"es失败")
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{"items": items, "total": total})
}

func (h *BatchHandler) checkTenantAccess(w http.ResponseWriter, r *http.Request, id string) bool {
	if !h.Config.TenantScoped {
		return true
	}

	var entityTenantID string
	err := h.DB.QueryRow(r.Context(), "SELECT tenant_id FROM "+h.Config.WriteTableName+" WHERE id = $1", id).Scan(&entityTenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+" not found")
		return false
	}

	return verifyTenantOwnership(w, r, entityTenantID)
}

func (h *BatchHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if !h.checkTenantAccess(w, r, id) {
		return
	}
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
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req BatchCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
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
		respondError(w, http.StatusInternalServerError, "创建"+h.Config.EntityName+"失败")
		return
	}

	batch, _ := h.Config.ScanRow(r.Context(), h.DB, id)
	respondJSON(w, http.StatusCreated, batch)
}

func (h *BatchHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if !h.checkTenantAccess(w, r, id) {
		return
	}
	if _, err := h.Config.ScanRow(r.Context(), h.DB, id); err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+" not found")
		return
	}

	var req BatchUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
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
		respondError(w, http.StatusInternalServerError, "更新"+h.Config.EntityName+"失败")
		return
	}

	batch, _ := h.Config.ScanRow(r.Context(), h.DB, id)
	respondJSON(w, http.StatusOK, batch)
}

func (h *BatchHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if !h.checkTenantAccess(w, r, id) {
		return
	}
	if _, err := h.Config.ScanRow(r.Context(), h.DB, id); err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+" not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), "DELETE FROM "+h.Config.WriteTableName+" WHERE id = $1", id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除"+h.Config.EntityName+"失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *BatchHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if !h.checkTenantAccess(w, r, id) {
		return
	}
	if _, err := h.Config.ScanRow(r.Context(), h.DB, id); err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+" not found")
		return
	}

	var req BatchUpdateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Status != h.Config.StatusOpen && req.Status != h.Config.StatusClosed {
		respondError(w, http.StatusBadRequest, "无效状态")
		return
	}

	_, err := h.DB.Exec(r.Context(), "UPDATE "+h.Config.WriteTableName+" SET status = $1, updated_at = NOW() WHERE id = $2", req.Status, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新"+h.Config.EntityName+"状态失败")
		return
	}

	batch, _ := h.Config.ScanRow(r.Context(), h.DB, id)
	respondJSON(w, http.StatusOK, batch)
}
