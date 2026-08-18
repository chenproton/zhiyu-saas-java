package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// StudentHonorHandler 学生荣誉（个人中心-我的荣誉奖励配置，画像页展示）。
type StudentHonorHandler struct {
	Service *service.EvaluationService
}

func NewStudentHonorHandler(st *store.Store) *StudentHonorHandler {
	return &StudentHonorHandler{Service: service.NewEvaluationService(service.New(st))}
}

// StudentHonorItem 荣誉响应项。
type StudentHonorItem struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Issuer    string `json:"issuer"`
	HonorDate string `json:"honorDate"`
	FileName  string `json:"fileName"`
	FileURL   string `json:"fileUrl"`
}

// HonorUpsertRequest 荣誉创建/更新请求。
type HonorUpsertRequest struct {
	Name      string `json:"name"`
	Issuer    string `json:"issuer"`
	HonorDate string `json:"honorDate"`
	FileName  string `json:"fileName"`
	FileURL   string `json:"fileUrl"`
}

func toHonorItem(h store.StudentHonor) StudentHonorItem {
	return StudentHonorItem{ID: h.ID, Name: h.Name, Issuer: h.Issuer, HonorDate: h.HonorDate, FileName: h.FileName, FileURL: h.FileURL}
}

// List 查询学生荣誉（学生强制本人，业务用户可按 userId 查看）。
func (h *StudentHonorHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	userID := r.URL.Query().Get("userId")
	if middleware.HasRole(claims, domain.RoleStudent) {
		userID = claims.UserID
	}
	if userID == "" {
		respondError(w, http.StatusBadRequest, "缺少用户ID")
		return
	}
	rows, err := h.Service.ListHonors(r.Context(), tenantID, userID)
	if err != nil {
		respondServerError(w, r, err, "查询荣誉失败")
		return
	}
	items := make([]StudentHonorItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, toHonorItem(row))
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"items": items, "total": len(items)})
}

// Create 新增荣誉（仅学生本人）。
func (h *StudentHonorHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil || !middleware.HasRole(claims, domain.RoleStudent) {
		respondError(w, http.StatusForbidden, "仅学生可配置荣誉")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req HonorUpsertRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "荣誉名称不能为空")
		return
	}
	id, err := h.Service.CreateHonor(r.Context(), &store.HonorUpsertParams{
		TenantID: tenantID, UserID: claims.UserID,
		Name: req.Name, Issuer: req.Issuer, HonorDate: req.HonorDate,
		FileName: req.FileName, FileURL: req.FileURL,
	})
	if err != nil {
		respondServerError(w, r, err, "新增荣誉失败")
		return
	}
	respondJSON(w, http.StatusCreated, map[string]string{"id": id})
}

// Update 更新荣誉（仅本人）。
func (h *StudentHonorHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil || !middleware.HasRole(claims, domain.RoleStudent) {
		respondError(w, http.StatusForbidden, "仅学生可配置荣誉")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var req HonorUpsertRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "荣誉名称不能为空")
		return
	}
	if err := h.Service.UpdateHonor(r.Context(), &store.HonorUpsertParams{
		ID: id, TenantID: tenantID, UserID: claims.UserID,
		Name: req.Name, Issuer: req.Issuer, HonorDate: req.HonorDate,
		FileName: req.FileName, FileURL: req.FileURL,
	}); err != nil {
		respondServerError(w, r, err, "更新荣誉失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// Delete 删除荣誉（仅本人）。
func (h *StudentHonorHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil || !middleware.HasRole(claims, domain.RoleStudent) {
		respondError(w, http.StatusForbidden, "仅学生可配置荣誉")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Service.DeleteHonor(r.Context(), id, tenantID, claims.UserID); err != nil {
		respondServerError(w, r, err, "删除荣誉失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
