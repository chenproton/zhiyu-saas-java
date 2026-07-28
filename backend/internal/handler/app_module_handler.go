package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

type AppModuleHandler struct {
	DB *pgxpool.Pool
}

type AppModuleGroup struct {
	ID      string             `json:"id"`
	Name    string             `json:"name"`
	Modules []domain.AppModule `json:"modules"`
}

type AppModuleListResponse struct {
	Platforms []AppModuleGroup `json:"platforms"`
}

type CreateAppModuleRequest struct {
	Platform    string `json:"platform"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Href        string `json:"href"`
	SortOrder   int    `json:"sortOrder"`
}

type UpdateAppModuleRequest struct {
	Platform    string `json:"platform"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Href        string `json:"href"`
	SortOrder   int    `json:"sortOrder"`
}

func (h *AppModuleHandler) List(w http.ResponseWriter, r *http.Request) {
	platform := r.URL.Query().Get("platform")

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if platform != "" {
		where = append(where, "platform = $"+itoa(argIdx))
		args = append(args, platform)
		argIdx++
	}

	query := `
		SELECT id, platform, title, description, href, sort_order
		FROM app_modules
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY platform ASC, sort_order ASC, title ASC
	`

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list app modules")
		return
	}
	defer rows.Close()

	modules, err := h.scanAppModuleRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan app modules")
		return
	}

	groups := h.groupByPlatform(modules)
	respondJSON(w, http.StatusOK, AppModuleListResponse{Platforms: groups})
}

func (h *AppModuleHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	module, err := h.fetchAppModule(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "app module not found")
		return
	}
	respondJSON(w, http.StatusOK, module)
}

func (h *AppModuleHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateAppModuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Platform == "" || req.Title == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	id := uuid.NewString()

	_, err := h.DB.Exec(r.Context(), `
		INSERT INTO app_modules (id, platform, title, description, href, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, req.Platform, req.Title, req.Description, req.Href, req.SortOrder)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create app module")
		return
	}

	module, _ := h.fetchAppModule(r.Context(), id)
	respondJSON(w, http.StatusCreated, module)
}

func (h *AppModuleHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchAppModule(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "app module not found")
		return
	}

	var req UpdateAppModuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效请求体")
		return
	}

	if req.Platform == "" || req.Title == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	_, err := h.DB.Exec(r.Context(), `
		UPDATE app_modules SET platform = $1, title = $2, description = $3, href = $4, sort_order = $5
		WHERE id = $6
	`, req.Platform, req.Title, req.Description, req.Href, req.SortOrder, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update app module")
		return
	}

	module, _ := h.fetchAppModule(r.Context(), id)
	respondJSON(w, http.StatusOK, module)
}

func (h *AppModuleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManagePlatform(claims) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchAppModule(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "app module not found")
		return
	}

	_, err := h.DB.Exec(r.Context(), `DELETE FROM app_modules WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete app module")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *AppModuleHandler) fetchAppModule(ctx context.Context, id string) (domain.AppModule, error) {
	var module domain.AppModule

	err := h.DB.QueryRow(ctx, `
		SELECT id, platform, title, description, href, sort_order
		FROM app_modules WHERE id = $1
	`, id).Scan(
		&module.ID, &module.Platform, &module.Title, &module.Description, &module.Href, &module.SortOrder,
	)
	return module, err
}

func (h *AppModuleHandler) scanAppModuleRows(rows pgx.Rows) ([]domain.AppModule, error) {
	items := make([]domain.AppModule, 0)
	for rows.Next() {
		var module domain.AppModule
		if err := rows.Scan(
			&module.ID, &module.Platform, &module.Title, &module.Description, &module.Href, &module.SortOrder,
		); err != nil {
			return nil, err
		}
		items = append(items, module)
	}
	return items, nil
}

func (h *AppModuleHandler) groupByPlatform(modules []domain.AppModule) []AppModuleGroup {
	groupMap := make(map[string]*AppModuleGroup)
	order := make([]string, 0)

	for _, m := range modules {
		g, ok := groupMap[m.Platform]
		if !ok {
			g = &AppModuleGroup{
				ID:      m.Platform,
				Name:    platformDisplayName(m.Platform),
				Modules: make([]domain.AppModule, 0),
			}
			groupMap[m.Platform] = g
			order = append(order, m.Platform)
		}
		g.Modules = append(g.Modules, m)
	}

	// Sort modules within each group by sort order.
	for _, g := range groupMap {
		sort.SliceStable(g.Modules, func(i, j int) bool {
			return g.Modules[i].SortOrder < g.Modules[j].SortOrder
		})
	}

	result := make([]AppModuleGroup, 0, len(order))
	for _, key := range order {
		result = append(result, *groupMap[key])
	}
	return result
}

func platformDisplayName(platform string) string {
	names := map[string]string{
		"system":   "系统管理",
		"alliance": "产教协同与人才品牌运营平台",
		"career":   "职业岗位学习平台",
		"course":   "数字课程服务平台",
		"scene":    "实践场景学习平台",
		"ability":  "能力评价与测评资源管理平台",
		"affairs":  "教务服务平台",
		"ai":       "AI 智能服务平台",
		"resource": "教学资源共享服务平台",
		"opc":      "OPC专区",
		"decision": "敏捷决策中心",
		"research": "教科研服务中心",
		"mall":     "产教资源中心",
	}
	if name, ok := names[platform]; ok {
		return name
	}
	return platform
}
