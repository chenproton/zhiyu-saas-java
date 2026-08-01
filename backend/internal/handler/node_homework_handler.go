package handler

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

type NodeHomeworkHandler struct {
	DB *pgxpool.Pool
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

	items, total, err := executeListQuery(r.Context(), h.DB, r, store.ListQueryConfig[domain.NodeHomework]{
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
		ScanRows: h.scanNodeHomeworkRows,
	})
	if err != nil {
		if errors.Is(err, store.ErrMissingTenant) {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
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
	hw, err := h.fetchNodeHomework(r.Context(), id)
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

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO node_homeworks (id, tenant_id, node_id, title, requirement, need_attachment, deadline)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, id, tenantID, req.NodeID, req.Title, req.Requirement, req.NeedAttachment, req.Deadline)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建作业失败")
		return
	}

	hw, _ := h.fetchNodeHomework(r.Context(), id)
	respondJSON(w, http.StatusCreated, hw)
}

func (h *NodeHomeworkHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchNodeHomework(r.Context(), id); err != nil {
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

	_, err := h.DB.Exec(r.Context(), `
		UPDATE node_homeworks SET title = $1, requirement = $2, need_attachment = $3, deadline = $4
		WHERE id = $5
	`, req.Title, req.Requirement, req.NeedAttachment, req.Deadline, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新作业失败")
		return
	}

	hw, _ := h.fetchNodeHomework(r.Context(), id)
	respondJSON(w, http.StatusOK, hw)
}

func (h *NodeHomeworkHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchNodeHomework(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "作业不存在")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM node_homeworks WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除作业失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *NodeHomeworkHandler) fetchNodeHomework(ctx context.Context, id string) (*domain.NodeHomework, error) {
	var hw domain.NodeHomework
	err := h.DB.QueryRow(ctx, `
		SELECT id, node_id, title, requirement, need_attachment, deadline
		FROM node_homeworks WHERE id = $1
	`, id).Scan(&hw.ID, &hw.NodeID, &hw.Title, &hw.Requirement, &hw.NeedAttachment, &hw.Deadline)
	if err != nil {
		return nil, err
	}
	return &hw, nil
}

func (h *NodeHomeworkHandler) scanNodeHomeworkRows(rows pgx.Rows) ([]domain.NodeHomework, error) {
	items := make([]domain.NodeHomework, 0)
	for rows.Next() {
		var hw domain.NodeHomework
		if err := rows.Scan(&hw.ID, &hw.NodeID, &hw.Title, &hw.Requirement, &hw.NeedAttachment, &hw.Deadline); err != nil {
			return nil, err
		}
		items = append(items, hw)
	}
	return items, nil
}
