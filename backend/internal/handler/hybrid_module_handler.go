package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type HybridModuleHandler struct {
	Service *service.PositionService
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

func (h *HybridModuleHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	nodeID := r.URL.Query().Get("nodeId")
	cfg := store.ListQueryConfig[domain.HybridNodeModule]{
		Table:         "hybrid_node_modules",
		SelectColumns: "id, node_id, module_key, mode, data",
		TenantScoped:  true,
		OrderBy:       "module_key ASC",
		NoPagination:  true,
		ScanRows:      store.ScanHybridModuleRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if nodeID != "" {
				qb.AddCondition("node_id = " + qb.NextArg(nodeID))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListHybridModules(r.Context(), params, cfg)
	if err != nil {
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
	if !decodeBody(w, r, &req) {
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
	module, err := h.Service.UpsertHybridModule(r.Context(), tenantID, req.ID, &store.HybridModuleParams{
		NodeID: req.NodeID, ModuleKey: req.ModuleKey, Mode: req.Mode, Data: req.Data,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "保存混合模块失败")
		return
	}
	respondJSON(w, http.StatusOK, module)
}

func (h *HybridModuleHandler) DeleteModule(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetHybridModule(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "混合模块不存在")
		return
	}
	if err := h.Service.DeleteHybridModule(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除混合模块失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ListModules List 别名（路由引用）。
func (h *HybridModuleHandler) ListModules(w http.ResponseWriter, r *http.Request) {
	h.List(w, r)
}
