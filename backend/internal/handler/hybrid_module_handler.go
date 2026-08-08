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
	Service *service.LessonContentService
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
	cfg := h.Service.Store().HybridModules().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListHybridModules(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询混合模块失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.HybridNodeModule]{Items: items, Total: total})
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
	// 校验目标节点属于当前租户，防止把模块写入他租户节点
	if _, err := h.Service.Store().CourseNodes().Get(r.Context(), req.NodeID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "课程节点不存在")
		return
	}
	module, err := h.Service.UpsertHybridModule(r.Context(), tenantID, req.ID, &store.HybridModuleParams{
		NodeID: req.NodeID, ModuleKey: req.ModuleKey, Mode: req.Mode, Data: req.Data,
	})
	if err != nil {
		respondServerError(w, r, err, "保存混合模块失败")
		return
	}
	respondJSON(w, http.StatusOK, module)
}

func (h *HybridModuleHandler) DeleteModule(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetHybridModule(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "混合模块不存在")
		return
	}
	if err := h.Service.DeleteHybridModule(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "删除混合模块失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ListModules List 别名（路由引用）。
func (h *HybridModuleHandler) ListModules(w http.ResponseWriter, r *http.Request) {
	h.List(w, r)
}

type BatchSaveHybridModulesRequest struct {
	NodeID  string                          `json:"nodeId"`
	Modules []UpsertHybridModuleRequestPart `json:"modules"`
}

type UpsertHybridModuleRequestPart struct {
	ModuleKey string         `json:"moduleKey"`
	Mode      string         `json:"mode"`
	Data      domain.JSONMap `json:"data"`
}

// BatchSave 全量替换某节点的混合模块（新增/编辑统一入口）。
func (h *HybridModuleHandler) BatchSave(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var req BatchSaveHybridModulesRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.NodeID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	modules := make([]store.HybridModuleParams, 0, len(req.Modules))
	for _, m := range req.Modules {
		modules = append(modules, store.HybridModuleParams{
			ModuleKey: m.ModuleKey,
			Mode:      m.Mode,
			Data:      m.Data,
		})
	}
	if err := h.Service.ReplaceHybridModules(r.Context(), tenantID, req.NodeID, modules); err != nil {
		respondServerError(w, r, err, "保存混合模块失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"nodeId": req.NodeID})
}
