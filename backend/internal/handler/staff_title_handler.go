package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"unicode"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type StaffTitleHandler struct {
	DB *pgxpool.Pool
}

type StaffTitleListResponse struct {
	Items []domain.StaffTitle `json:"items"`
	Total int                 `json:"total"`
}

type CreateStaffTitleRequest struct {
	TenantID    string  `json:"tenantId"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
}

type UpdateStaffTitleRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
}

type ToggleStaffTitleStatusRequest struct {
	Status string `json:"status"`
}

func (h *StaffTitleHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg := listQueryConfig[domain.StaffTitle]{
		Table:         "staff_titles",
		SelectColumns: "id, tenant_id, code, name, description, user_count, status, created_at",
		TenantScoped:  true,
		SearchColumns: []string{"name", "code"},
		ScanRows:      h.scanStaffTitleRows,
	}

	items, total, err := executeListQuery(r.Context(), h.DB, r, cfg)
	if err != nil {
		if err.Error() == "missing tenant" {
			respondError(w, http.StatusForbidden, "缺少租户信息")
			return
		}
		respondError(w, http.StatusInternalServerError, "查询职称失败")
		return
	}

	if len(items) > 0 {
		// batchCountUsersByTitle needs the tenant ID from the current request.
		if tenantID, ok := tenantFilter(middleware.CurrentUser(r)); ok {
			counts := h.batchCountUsersByTitle(r.Context(), tenantID, items)
			for i := range items {
				items[i].UserCount = counts[items[i].ID]
			}
		}
	}

	respondJSON(w, http.StatusOK, StaffTitleListResponse{Items: items, Total: total})
}

func (h *StaffTitleHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	title, err := h.fetchStaffTitle(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "职称不存在")
		return
	}
	if !verifyTenantOwnership(w, r, title.TenantID) {
		return
	}
	title.UserCount = h.countUsersByTitle(r.Context(), id, title.TenantID)
	respondJSON(w, http.StatusOK, title)
}

func (h *StaffTitleHandler) Create(w http.ResponseWriter, r *http.Request) {
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateStaffTitleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.TenantID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if !verifyRequestTenant(w, r, req.TenantID) {
		return
	}

	if req.Status == "" {
		req.Status = "active"
	}
	if req.Status != "active" && req.Status != "inactive" {
		respondError(w, http.StatusBadRequest, "无效状态")
		return
	}

	code := req.Code
	if code == "" {
		code = generateCodeFromName(req.Name)
	}

	id := uuid.NewString()
	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO staff_titles (id, tenant_id, code, name, description, user_count, status)
		VALUES ($1, $2, $3, $4, $5, 0, $6)
	`, id, req.TenantID, code, req.Name, req.Description, req.Status)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "职称代码已存在，请使用其他代码")
			return
		}
		respondError(w, http.StatusInternalServerError, "创建职称失败")
		return
	}

	title, _ := h.fetchStaffTitle(r.Context(), id)
	respondJSON(w, http.StatusCreated, title)
}

func (h *StaffTitleHandler) Update(w http.ResponseWriter, r *http.Request) {
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	title, err := h.fetchStaffTitle(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "职称不存在")
		return
	}
	if !verifyTenantOwnership(w, r, title.TenantID) {
		return
	}

	var req UpdateStaffTitleRequest
	if err = json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	if req.Status != "" && req.Status != "active" && req.Status != "inactive" {
		respondError(w, http.StatusBadRequest, "无效状态")
		return
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE staff_titles SET name = $1, description = $2, status = COALESCE(NULLIF($3, ''), status), updated_at = NOW()
		WHERE id = $4
	`, req.Name, req.Description, req.Status, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新职称失败")
		return
	}

	title, _ = h.fetchStaffTitle(r.Context(), id)
	title.UserCount = h.countUsersByTitle(r.Context(), id, title.TenantID)
	respondJSON(w, http.StatusOK, title)
}

func (h *StaffTitleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	title, err := h.fetchStaffTitle(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "职称不存在")
		return
	}
	if !verifyTenantOwnership(w, r, title.TenantID) {
		return
	}

	var userCount int
	if err := h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND $2 = ANY(title_ids)`,
		title.TenantID, id,
	).Scan(&userCount); err != nil {
		respondError(w, http.StatusInternalServerError, "检查职称引用失败")
		return
	}
	if userCount > 0 {
		respondError(w, http.StatusConflict, "该职位仍有用户关联，不可删除")
		return
	}

	_, err = h.DB.Exec(r.Context(), `DELETE FROM staff_titles WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "删除职称失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *StaffTitleHandler) ToggleStatus(w http.ResponseWriter, r *http.Request) {
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	title, err := h.fetchStaffTitle(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "职称不存在")
		return
	}
	if !verifyTenantOwnership(w, r, title.TenantID) {
		return
	}

	var req ToggleStaffTitleStatusRequest
	if err = json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Status != "active" && req.Status != "inactive" {
		respondError(w, http.StatusBadRequest, "无效状态")
		return
	}

	_, err = h.DB.Exec(r.Context(), `UPDATE staff_titles SET status = $1, updated_at = NOW() WHERE id = $2`, req.Status, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "更新状态失败")
		return
	}

	title, _ = h.fetchStaffTitle(r.Context(), id)
	title.UserCount = h.countUsersByTitle(r.Context(), id, title.TenantID)
	respondJSON(w, http.StatusOK, title)
}

func (h *StaffTitleHandler) canManageUsers(r *http.Request) bool {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		return false
	}
	return canManagePortal(claims)
}

func (h *StaffTitleHandler) fetchStaffTitle(ctx context.Context, id string) (domain.StaffTitle, error) {
	var title domain.StaffTitle
	var description *string

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, code, name, description, user_count, status, created_at
		FROM staff_titles WHERE id = $1
	`, id).Scan(
		&title.ID, &title.TenantID, &title.Code, &title.Name, &description, &title.UserCount, &title.Status, &title.CreatedAt,
	)
	if err != nil {
		return title, err
	}
	title.Description = description
	return title, nil
}

func (h *StaffTitleHandler) scanStaffTitleRows(rows pgx.Rows) ([]domain.StaffTitle, error) {
	items := make([]domain.StaffTitle, 0)
	for rows.Next() {
		var title domain.StaffTitle
		var description *string
		if err := rows.Scan(
			&title.ID, &title.TenantID, &title.Code, &title.Name, &description, &title.UserCount, &title.Status, &title.CreatedAt,
		); err != nil {
			return nil, err
		}
		title.Description = description
		items = append(items, title)
	}
	return items, nil
}

func (h *StaffTitleHandler) batchCountUsersByTitle(ctx context.Context, tenantID string, titles []domain.StaffTitle) map[string]int {
	ids := make([]string, len(titles))
	for i, t := range titles {
		ids[i] = t.ID
	}
	rows, err := h.DB.Query(ctx, `
		SELECT title_id, COUNT(*) FROM users, unnest(title_ids) AS title_id
		WHERE tenant_id = $1 AND title_id = ANY($2::uuid[])
		GROUP BY title_id
	`, tenantID, ids)
	if err != nil {
		return nil
	}
	defer rows.Close()
	counts := make(map[string]int)
	for rows.Next() {
		var id string
		var count int
		if err := rows.Scan(&id, &count); err != nil {
			continue
		}
		counts[id] = count
	}
	return counts
}

func (h *StaffTitleHandler) countUsersByTitle(ctx context.Context, titleID, tenantID string) int {
	var count int
	_ = h.DB.QueryRow(ctx, `
		SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND $2 = ANY(title_ids)
	`, tenantID, titleID).Scan(&count)
	return count
}

func generateCodeFromName(name string) string {
	var b strings.Builder
	for _, r := range name {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			b.WriteRune(unicode.ToLower(r))
		} else if b.Len() > 0 && b.String()[b.Len()-1] != '_' {
			b.WriteRune('_')
		}
	}
	code := strings.Trim(b.String(), "_")
	if code == "" {
		code = "title"
	}
	return code
}
