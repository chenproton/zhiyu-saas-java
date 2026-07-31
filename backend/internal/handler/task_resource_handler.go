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
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type TaskResourceHandler struct {
	DB *pgxpool.Pool
}

type TaskResourceListResponse struct {
	Items []domain.TaskResource `json:"items"`
	Total int                   `json:"total"`
}

type TaskResourceBindingListResponse struct {
	Items []domain.TaskResourceBinding `json:"items"`
	Total int                          `json:"total"`
}

type CreateTaskResourceRequest struct {
	Name              string         `json:"name"`
	Type              string         `json:"type"`
	URL               *string        `json:"url"`
	Description       *string        `json:"description"`
	Thumbnail         *string        `json:"thumbnail"`
	Size              *string        `json:"size"`
	KnowledgePointIDs []string       `json:"knowledgePointIds"`
	ExtraData         domain.JSONMap `json:"extraData"`
}

type BindTaskResourceRequest struct {
	TaskID     string `json:"taskId"`
	ResourceID string `json:"resourceId"`
}

func (h *TaskResourceHandler) ListResources(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	taskID := r.URL.Query().Get("taskId")
	search := r.URL.Query().Get("search")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parsePageLimit(limitStr, 50); err == nil && v > 0 {
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
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "rl.tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	joinTaskBindings := ""
	if taskID != "" {
		joinTaskBindings = `JOIN task_resource_bindings tb ON tb.resource_id = rl.id AND tb.task_id = $` + itoa(argIdx)
		args = append(args, taskID)
		argIdx++
	}
	if search != "" {
		where = append(where, "(rl.name ILIKE $"+itoa(argIdx)+" OR rl.description ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := `
		SELECT COUNT(*) FROM resource_library rl
		` + joinTaskBindings + `
		WHERE ` + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT rl.id, rl.name, rl.resource_type, rl.url, rl.description, rl.thumbnail,
			COALESCE(rl.file_size::text, '') AS size,
			COALESCE(rl.metadata->>'knowledgePointIds', '[]')::text AS knowledge_point_ids,
			rl.uploaded_by, rl.created_at
		FROM resource_library rl
		` + joinTaskBindings + `
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY rl.created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询资源失败")
		return
	}
	defer rows.Close()

	items, err := h.scanResourceRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "读取资源失败")
		return
	}

	respondJSON(w, http.StatusOK, TaskResourceListResponse{Items: items, Total: total})
}

func (h *TaskResourceHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req CreateTaskResourceRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.Type == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	metadata := domain.JSONMap{}
	if req.ExtraData != nil {
		for k, v := range req.ExtraData {
			metadata[k] = v
		}
	}
	metadata["knowledgePointIds"] = req.KnowledgePointIDs

	var fileSize *int64
	if req.Size != nil && *req.Size != "" {
		if parsed, err := parseInt(*req.Size, 0); err == nil {
			s := int64(parsed)
			fileSize = &s
		}
	}

	id := uuid.NewString()
	uploadedBy := claims.UserID
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO resource_library (id, tenant_id, name, resource_type, url, description, thumbnail, file_size, metadata, uploaded_by)
		VALUES ($1, $2, $3, $4::resource_type, $5, $6, $7, $8, $9, $10)
	`, id, tenantID, req.Name, req.Type, req.URL, req.Description, req.Thumbnail, fileSize, jsonMapBytes(metadata), uploadedBy)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建资源失败")
		return
	}

	resource, _ := h.fetchResource(r.Context(), id)
	respondJSON(w, http.StatusCreated, resource)
}

func (h *TaskResourceHandler) BindResource(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	var req BindTaskResourceRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.TaskID == "" || req.ResourceID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	var id string
	err := h.DB.QueryRow(r.Context(), `
		INSERT INTO task_resource_bindings (tenant_id, task_id, resource_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (task_id, resource_id) DO UPDATE SET task_id = EXCLUDED.task_id
		RETURNING id
	`, tenantID, req.TaskID, req.ResourceID).Scan(&id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "绑定资源失败")
		return
	}

	binding, _ := h.fetchBinding(r.Context(), id)
	respondJSON(w, http.StatusOK, binding)
}

func (h *TaskResourceHandler) UnbindResource(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusUnauthorized, "未授权")
		return
	}

	id := chi.URLParam(r, "id")
	_, err := h.DB.Exec(r.Context(), `DELETE FROM task_resource_bindings WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "解绑资源失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *TaskResourceHandler) fetchBinding(ctx context.Context, id string) (*domain.TaskResourceBinding, error) {
	var b domain.TaskResourceBinding
	err := h.DB.QueryRow(ctx, `SELECT id, task_id, resource_id FROM task_resource_bindings WHERE id = $1`, id).Scan(
		&b.ID, &b.TaskID, &b.ResourceID,
	)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (h *TaskResourceHandler) fetchResource(ctx context.Context, id string) (*domain.TaskResource, error) {
	var res domain.TaskResource
	var metadata domain.JSONMap
	err := h.DB.QueryRow(ctx, `
		SELECT id, name, resource_type, url, description, thumbnail,
			COALESCE(file_size::text, '') AS size,
			metadata, uploaded_by, created_at
		FROM resource_library WHERE id = $1
	`, id).Scan(
		&res.ID, &res.Name, &res.Type, &res.URL, &res.Description, &res.Thumbnail,
		&res.Size, &metadata, &res.UploadedBy, &res.UploadedAt,
	)
	if err != nil {
		return nil, err
	}
	if metadata != nil {
		res.ExtraData = metadata
		if kp, ok := metadata["knowledgePointIds"]; ok {
			if arr, ok := kp.([]interface{}); ok {
				ids := make([]string, 0, len(arr))
				for _, v := range arr {
					if s, ok := v.(string); ok {
						ids = append(ids, s)
					}
				}
				res.KnowledgePointIDs = ids
			}
		}
	}
	return &res, nil
}

func (h *TaskResourceHandler) scanResourceRows(rows pgx.Rows) ([]domain.TaskResource, error) {
	items := make([]domain.TaskResource, 0)
	for rows.Next() {
		var res domain.TaskResource
		var kpRaw string
		if err := rows.Scan(&res.ID, &res.Name, &res.Type, &res.URL, &res.Description, &res.Thumbnail, &res.Size, &kpRaw, &res.UploadedBy, &res.UploadedAt); err != nil {
			return nil, err
		}
		var kp []string
		if err := json.Unmarshal([]byte(kpRaw), &kp); err == nil {
			res.KnowledgePointIDs = kp
		}
		items = append(items, res)
	}
	return items, nil
}
