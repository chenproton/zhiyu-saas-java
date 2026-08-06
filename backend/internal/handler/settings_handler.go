package handler

import (
	"errors"
	"net/http"
	"regexp"

	"github.com/zhiyu-saas/backend/internal/store"
)

// DefaultThemePrimary 平台默认主题色（与前端 globals.css 的 --brand 一致）。
const DefaultThemePrimary = "#4862e4"

// themePrimaryPattern 校验 #RRGGBB 格式。
var themePrimaryPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// SettingsHandler 平台级配置（主题色）。
type SettingsHandler struct {
	Store *store.PlatformSettingsStore
}

// GetTheme GET /api/v1/settings/theme（公开，供登录前加载主题）。
func (h *SettingsHandler) GetTheme(w http.ResponseWriter, r *http.Request) {
	value, err := h.Store.Get(r.Context(), store.KeyThemePrimary)
	if errors.Is(err, store.ErrSettingNotFound) || !themePrimaryPattern.MatchString(value) {
		respondJSON(w, http.StatusOK, map[string]string{"primary": DefaultThemePrimary})
		return
	}
	if err != nil {
		respondServerError(w, r, err, "读取主题配置失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"primary": value})
}

// UpdateTheme PUT /api/v1/admin/settings/theme（平台管理员）。
func (h *SettingsHandler) UpdateTheme(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Primary string `json:"primary"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if !themePrimaryPattern.MatchString(req.Primary) {
		respondError(w, http.StatusBadRequest, "主题色必须是 #RRGGBB 格式")
		return
	}
	if err := h.Store.Upsert(r.Context(), store.KeyThemePrimary, req.Primary); err != nil {
		respondServerError(w, r, err, "保存主题配置失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"primary": req.Primary})
}
