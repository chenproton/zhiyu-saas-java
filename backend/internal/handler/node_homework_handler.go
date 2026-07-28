package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
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
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}
	if nodeID != "" {
		where = append(where, "node_id = $"+itoa(argIdx))
		args = append(args, nodeID)
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM node_homeworks WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, node_id, title, requirement, need_attachment, deadline
		FROM node_homeworks
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY id DESC
	`
	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list homeworks")
		return
	}
	defer rows.Close()

	items, err := h.scanNodeHomeworkRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan homeworks")
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
		respondError(w, http.StatusNotFound, "homework not found")
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
		respondError(w, http.StatusInternalServerError, "failed to create homework")
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
		respondError(w, http.StatusNotFound, "homework not found")
		return
	}

	var req UpdateNodeHomeworkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
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
		respondError(w, http.StatusInternalServerError, "failed to update homework")
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
		respondError(w, http.StatusNotFound, "homework not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM node_homeworks WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete homework")
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
