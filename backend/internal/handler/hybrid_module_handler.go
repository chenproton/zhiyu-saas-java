package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type HybridModuleHandler struct {
	DB *pgxpool.Pool
}

type HybridModuleListResponse struct {
	Items []domain.HybridNodeModule `json:"items"`
	Total int                       `json:"total"`
}

type UpsertHybridModuleRequest struct {
	ID        string         `json:"id"`
	NodeID    string         `json:"nodeId"`
	ModuleKey string         `json:"moduleKey"`
	Mode      string         `json:"mode"`
	Data      domain.JSONMap `json:"data"`
}

func (h *HybridModuleHandler) ListModules(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	nodeID := r.URL.Query().Get("nodeId")

	items, total, err := executeListQuery(r.Context(), h.DB, r, listQueryConfig[domain.HybridNodeModule]{
		Table:         "hybrid_node_modules",
		SelectColumns: "id, node_id, module_key, mode, data",
		TenantScoped:  true,
		OrderBy:       "module_key ASC",
		NoPagination:  true,
		ExtraFilter: func(r *http.Request, qb *listQueryBuilder) {
			if nodeID != "" {
				qb.addCondition("node_id = " + qb.nextArg(nodeID))
			}
		},
		ScanRows: h.scanHybridModuleRows,
	})
	if err != nil {
		if err.Error() == "missing tenant" {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询混合模块失败")
		return
	}

	respondJSON(w, http.StatusOK, HybridModuleListResponse{Items: items, Total: total})
}

func (h *HybridModuleHandler) UpsertModule(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req UpsertHybridModuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}
	if req.NodeID == "" || req.ModuleKey == "" || req.Mode == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	id := req.ID
	if id == "" {
		id = uuid.NewString()
		_, err := h.DB.Exec(r.Context(), `
			INSERT INTO hybrid_node_modules (id, tenant_id, node_id, module_key, mode, data)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, id, tenantID, req.NodeID, req.ModuleKey, req.Mode, req.Data)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "创建混合模块失败")
			return
		}
	} else {
		_, err := h.DB.Exec(r.Context(), `
			UPDATE hybrid_node_modules SET node_id = $1, module_key = $2, mode = $3, data = $4
			WHERE id = $5
		`, req.NodeID, req.ModuleKey, req.Mode, req.Data, id)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "更新混合模块失败")
			return
		}
	}

	module, _ := h.fetchHybridModule(r.Context(), id)
	respondJSON(w, http.StatusOK, module)
}

func (h *HybridModuleHandler) DeleteModule(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchHybridModule(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "混合模块不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM hybrid_node_modules WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除混合模块失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *HybridModuleHandler) fetchHybridModule(ctx context.Context, id string) (*domain.HybridNodeModule, error) {
	var m domain.HybridNodeModule
	err := h.DB.QueryRow(ctx, `
		SELECT id, node_id, module_key, mode, data FROM hybrid_node_modules WHERE id = $1
	`, id).Scan(&m.ID, &m.NodeID, &m.ModuleKey, &m.Mode, &m.Data)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (h *HybridModuleHandler) scanHybridModuleRows(rows pgx.Rows) ([]domain.HybridNodeModule, error) {
	items := make([]domain.HybridNodeModule, 0)
	for rows.Next() {
		var m domain.HybridNodeModule
		if err := rows.Scan(&m.ID, &m.NodeID, &m.ModuleKey, &m.Mode, &m.Data); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, nil
}
