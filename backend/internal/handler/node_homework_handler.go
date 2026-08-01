package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type NodeHomeworkHandler struct {
	Service *service.LessonContentService
}

type NodeHomeworkListResponse struct {
	Items []domain.NodeHomework `json:"items"`
	Total int                   `json:"total"`
}

type CreateNodeHomeworkRequest struct {
	NodeID         string     `json:"nodeId"`
	Title          string     `json:"title"`
	Requirement    *string    `json:"requirement"`
	NeedAttachment bool       `json:"needAttachment"`
	Deadline       *time.Time `json:"deadline"`
}

type UpdateNodeHomeworkRequest struct {
	Title          string     `json:"title"`
	Requirement    *string    `json:"requirement"`
	NeedAttachment bool       `json:"needAttachment"`
	Deadline       *time.Time `json:"deadline"`
}

func (h *NodeHomeworkHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	nodeID := r.URL.Query().Get("nodeId")
	cfg := store.ListQueryConfig[domain.NodeHomework]{
		Table:         "node_homeworks",
		SelectColumns: "id, node_id, title, requirement, need_attachment, deadline",
		TenantScoped:  true,
		OrderBy:       "id DESC",
		NoPagination:  true,
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
	items, total, err := h.Service.ListNodeHomeworks(r.Context(), params, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询作业失败")
		return
	}
	respondJSON(w, http.StatusOK, NodeHomeworkListResponse{Items: items, Total: total})
}

func (h *NodeHomeworkHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	hw, err := h.Service.GetNodeHomework(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "作业不存在")
		return
	}
	respondJSON(w, http.StatusOK, hw)
}

func (h *NodeHomeworkHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateNodeHomeworkRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.NodeID == "" || req.Title == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	hw, err := h.Service.CreateNodeHomework(r.Context(), tenantID, &store.NodeHomeworkCreateParams{
		NodeID:         req.NodeID,
		Title:          req.Title,
		Requirement:    req.Requirement,
		NeedAttachment: req.NeedAttachment,
		Deadline:       req.Deadline,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建作业失败")
		return
	}
	respondJSON(w, http.StatusCreated, hw)
}

func (h *NodeHomeworkHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetNodeHomework(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "作业不存在")
		return
	}

	var req UpdateNodeHomeworkRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Title == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	hw, err := h.Service.UpdateNodeHomework(r.Context(), id, &store.NodeHomeworkUpdateParams{
		Title:          req.Title,
		Requirement:    req.Requirement,
		NeedAttachment: req.NeedAttachment,
		Deadline:       req.Deadline,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新作业失败")
		return
	}
	respondJSON(w, http.StatusOK, hw)
}

func (h *NodeHomeworkHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetNodeHomework(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "作业不存在")
		return
	}

	if err := h.Service.DeleteNodeHomework(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "删除作业失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
