package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// batchService 是批次类 handler 需要的通用服务接口。
type batchService interface {
	BatchQueryer() store.Queryer
	BatchTenantOf(ctx context.Context, table, id string) (string, error)
	BatchCreate(ctx context.Context, table string, cols []string, vals []any) error
	BatchUpdate(ctx context.Context, table string, setClauses []string, args []any) error
	BatchDelete(ctx context.Context, table, id string) error
	BatchUpdateStatus(ctx context.Context, table, id, status string) error
	BatchGetByTable(ctx context.Context, table, selectColumns, id string) (pgx.Row, error)
}

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

// BatchScanRowFunc 批次单行扫描（经 store 查询后由扫描函数转换）。
type BatchScanRowFunc func(ctx context.Context, row pgx.Row) (any, error)

// BatchScanRowsFunc 批次列表行扫描。
type BatchScanRowsFunc func(rows pgx.Rows) ([]any, error)

type BatchTableConfig struct {
	TableName      string
	WriteTableName string
	SelectColumns  string
	EntityName     string
	StatusOpen     string
	StatusClosed   string

	SearchColumns []string

	ExtraListFilters store.ListQueryFilter

	CreateExtraCols []string
	CreateExtraVals []any

	TenantScoped       bool
	TenantFilterColumn string

	CreateWithStatus bool
	UpdateWithStatus bool

	ScanRow  BatchScanRowFunc
	ScanRows BatchScanRowsFunc
}

type BatchHandler struct {
	Service batchService
	Config  BatchTableConfig
}

func NewBatchHandler(svc *service.PositionService, config BatchTableConfig) *BatchHandler {
	return &BatchHandler{Service: svc, Config: config}
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

	cfg := store.ListQueryConfig[any]{
		Table:         h.Config.TableName,
		SelectColumns: h.Config.SelectColumns,
		TenantScoped:  h.Config.TenantScoped,
		TenantColumn:  tenantColumn,
		SearchColumns: h.Config.SearchColumns,
		ScanRows:      h.Config.ScanRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if orgNodeID != "" {
				qb.AddCondition("org_node_id = " + qb.NextArg(orgNodeID))
			}
			if status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
			if h.Config.ExtraListFilters != nil {
				h.Config.ExtraListFilters(p, qb)
			}
		},
	}
	params, ok := listParamsFromRequest(r, h.Config.TenantScoped)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := store.ExecuteListQuery(r.Context(), h.Service.BatchQueryer(), params, cfg)
	if err != nil {
		slog.Error("batch list failed", "entity", h.Config.EntityName, "error", err)
		if errors.Is(err, store.ErrMissingTenant) {
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
	entityTenantID, err := h.Service.BatchTenantOf(r.Context(), h.Config.WriteTableName, id)
	if err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+"不存在")
		return false
	}
	return verifyTenantOwnership(w, r, entityTenantID)
}

func (h *BatchHandler) scanRow(ctx context.Context, id string) (any, error) {
	row, err := h.Service.BatchGetByTable(ctx, h.Config.TableName, h.Config.SelectColumns, id)
	if err != nil {
		return nil, err
	}
	return h.Config.ScanRow(ctx, row)
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
	batch, err := h.scanRow(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+"不存在")
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
	if !decodeBody(w, r, &req) {
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

	if err := h.Service.BatchCreate(r.Context(), h.Config.WriteTableName, cols, vals); err != nil {
		respondError(w, http.StatusInternalServerError, "创建"+h.Config.EntityName+"失败")
		return
	}
	batch, err2 := h.scanRow(r.Context(), id)
	if err2 != nil {
		respondError(w, http.StatusInternalServerError, "创建"+h.Config.EntityName+"失败")
		return
	}
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
	if _, err := h.scanRow(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+"不存在")
		return
	}
	var req BatchUpdateRequest
	if !decodeBody(w, r, &req) {
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
	args = append(args, id)

	if err := h.Service.BatchUpdate(r.Context(), h.Config.WriteTableName, setClauses, args); err != nil {
		respondError(w, http.StatusInternalServerError, "更新"+h.Config.EntityName+"失败")
		return
	}
	batch, err2 := h.scanRow(r.Context(), id)
	if err2 != nil {
		respondError(w, http.StatusInternalServerError, "更新"+h.Config.EntityName+"失败")
		return
	}
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
	if _, err := h.scanRow(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+"不存在")
		return
	}
	if err := h.Service.BatchDelete(r.Context(), h.Config.WriteTableName, id); err != nil {
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
	if _, err := h.scanRow(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, h.Config.EntityName+"不存在")
		return
	}
	var req BatchUpdateStatusRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Status != h.Config.StatusOpen && req.Status != h.Config.StatusClosed {
		respondError(w, http.StatusBadRequest, "无效状态")
		return
	}
	if err := h.Service.BatchUpdateStatus(r.Context(), h.Config.WriteTableName, id, req.Status); err != nil {
		respondError(w, http.StatusInternalServerError, "更新"+h.Config.EntityName+"状态失败")
		return
	}
	batch, err2 := h.scanRow(r.Context(), id)
	if err2 != nil {
		respondError(w, http.StatusInternalServerError, "更新"+h.Config.EntityName+"状态失败")
		return
	}
	respondJSON(w, http.StatusOK, batch)
}

var _ = strings.Join
