package handler

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/store"
)

// PartnerEmploymentHandler 企业端就业服务：查看被分配的就业项目、录入岗位、只读查看学生投递。
// 见 docs/spec/partner-enterprise-platform.md。
type PartnerEmploymentHandler struct {
	Store *store.AllianceStore
	Links *store.AllianceEnterpriseLinkStore
}

// partnerEmploymentCaller 解析企业身份：token 租户 → partner_enterprises.id。
func (h *PartnerEmploymentHandler) partnerEmploymentCaller(w http.ResponseWriter, r *http.Request) (enterpriseID, userID string, ok bool) {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return "", "", false
	}
	ent, err := h.Store.GetEnterpriseByTenant(r.Context(), *claims.TenantID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) || errors.Is(err, store.ErrNotFound) {
			respondError(w, http.StatusNotFound, "企业不存在")
			return "", "", false
		}
		respondServerError(w, r, err, "查询企业信息失败")
		return "", "", false
	}
	return ent.ID, claims.UserID, true
}

// requireActiveEmploymentLink 写操作前置校验：目标学校与本企业存在 active 合作 link（同共建惯例）。
func (h *PartnerEmploymentHandler) requireActiveEmploymentLink(w http.ResponseWriter, r *http.Request, enterpriseID, schoolTenantID string) bool {
	link, err := h.Links.GetLinkByEnterprise(r.Context(), enterpriseID, schoolTenantID)
	if err != nil || link == nil || link.Status != "active" {
		respondError(w, http.StatusForbidden, "与该学校无生效中的合作关系")
		return false
	}
	return true
}

// ===== 就业项目（只读，学校分配） =====

func (h *PartnerEmploymentHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	enterpriseID, _, ok := h.partnerEmploymentCaller(w, r)
	if !ok {
		return
	}
	schoolTenantID := r.URL.Query().Get("schoolTenantId")
	items, err := h.Store.ListPartnerEmploymentProjects(r.Context(), enterpriseID, schoolTenantID)
	if err != nil {
		respondServerError(w, r, err, "查询就业项目列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.EmploymentProject]{Items: items, Total: len(items)})
}

func (h *PartnerEmploymentHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	enterpriseID, _, ok := h.partnerEmploymentCaller(w, r)
	if !ok {
		return
	}
	item, err := h.Store.GetPartnerEmploymentProjectByID(r.Context(), chi.URLParam(r, "id"), enterpriseID)
	if err != nil {
		alliancePublicGetErr(w, r, err, "就业项目不存在")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

// ===== 岗位 CRUD =====

func (h *PartnerEmploymentHandler) ListJobs(w http.ResponseWriter, r *http.Request) {
	enterpriseID, _, ok := h.partnerEmploymentCaller(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	items, err := h.Store.ListPartnerEmploymentJobs(r.Context(), enterpriseID, q.Get("projectId"), q.Get("status"))
	if err != nil {
		respondServerError(w, r, err, "查询岗位列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.EmploymentJob]{Items: items, Total: len(items)})
}

func (h *PartnerEmploymentHandler) GetJob(w http.ResponseWriter, r *http.Request) {
	enterpriseID, _, ok := h.partnerEmploymentCaller(w, r)
	if !ok {
		return
	}
	item, err := h.Store.GetPartnerEmploymentJobByID(r.Context(), chi.URLParam(r, "id"), enterpriseID)
	if err != nil {
		alliancePublicGetErr(w, r, err, "岗位不存在")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *PartnerEmploymentHandler) CreateJob(w http.ResponseWriter, r *http.Request) {
	enterpriseID, userID, ok := h.partnerEmploymentCaller(w, r)
	if !ok {
		return
	}
	var body struct {
		domain.EmploymentJob
		SchoolTenantID string `json:"schoolTenantId"`
	}
	if !decodeBody(w, r, &body) {
		return
	}
	j := body.EmploymentJob
	if j.Title == "" {
		respondError(w, http.StatusBadRequest, "岗位名称不能为空")
		return
	}
	if body.SchoolTenantID == "" {
		respondError(w, http.StatusBadRequest, "请选择合作学校")
		return
	}
	if !h.requireActiveEmploymentLink(w, r, enterpriseID, body.SchoolTenantID) {
		return
	}
	// 挂项目时校验项目属于该校且企业已被分配（防跨校项目绑定孤儿岗位）
	if j.ProjectID != nil && *j.ProjectID != "" {
		project, err := h.Store.GetPartnerEmploymentProjectByID(r.Context(), *j.ProjectID, enterpriseID)
		if err != nil {
			respondError(w, http.StatusBadRequest, "就业项目不存在或未分配给本企业")
			return
		}
		if project.TenantID != body.SchoolTenantID {
			respondError(w, http.StatusBadRequest, "就业项目不属于所选合作学校")
			return
		}
	} else {
		j.ProjectID = nil
	}
	j.TenantID = body.SchoolTenantID
	j.EnterpriseID = enterpriseID
	j.Status = "draft"
	j.CreatedBy = &userID
	id, err := h.Store.CreateEmploymentJob(r.Context(), &j)
	if err != nil {
		respondServerError(w, r, err, "创建岗位失败")
		return
	}
	item, err := h.Store.GetPartnerEmploymentJobByID(r.Context(), id, enterpriseID)
	if err != nil {
		respondServerError(w, r, err, "查询岗位失败")
		return
	}
	respondJSON(w, http.StatusCreated, item)
}

func (h *PartnerEmploymentHandler) UpdateJob(w http.ResponseWriter, r *http.Request) {
	enterpriseID, _, ok := h.partnerEmploymentCaller(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := h.Store.GetPartnerEmploymentJobByID(r.Context(), id, enterpriseID)
	if err != nil {
		alliancePublicGetErr(w, r, err, "岗位不存在")
		return
	}
	var body domain.EmploymentJob
	if !decodeBody(w, r, &body) {
		return
	}
	if body.Title == "" {
		body.Title = existing.Title
	}
	if body.JobType == "" {
		body.JobType = existing.JobType
	}
	if err := h.Store.UpdateEmploymentJob(r.Context(), id, enterpriseID, &body); err != nil {
		respondServerError(w, r, err, "更新岗位失败")
		return
	}
	item, err := h.Store.GetPartnerEmploymentJobByID(r.Context(), id, enterpriseID)
	if err != nil {
		respondServerError(w, r, err, "查询岗位失败")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *PartnerEmploymentHandler) DeleteJob(w http.ResponseWriter, r *http.Request) {
	enterpriseID, _, ok := h.partnerEmploymentCaller(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := h.Store.GetPartnerEmploymentJobByID(r.Context(), id, enterpriseID)
	if err != nil {
		alliancePublicGetErr(w, r, err, "岗位不存在")
		return
	}
	// 仅草稿可删：避免删除已发布岗位时 FK CASCADE 连带清空学生投递
	if existing.Status != "draft" {
		respondError(w, http.StatusConflict, "仅草稿岗位可删除，已发布岗位请先关闭")
		return
	}
	if err := h.Store.DeleteEmploymentJob(r.Context(), id, enterpriseID); err != nil {
		respondServerError(w, r, err, "删除岗位失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// SetJobStatus 岗位状态流转：publish（可同时绑定就业项目）/ close。
func (h *PartnerEmploymentHandler) SetJobStatus(w http.ResponseWriter, r *http.Request) {
	enterpriseID, _, ok := h.partnerEmploymentCaller(w, r)
	if !ok {
		return
	}
	var body struct {
		Action    string `json:"action"`    // publish|close
		ProjectID string `json:"projectId"` // publish 时可绑定/改绑就业项目
	}
	if !decodeBody(w, r, &body) {
		return
	}
	var status string
	switch body.Action {
	case "publish":
		status = "published"
	case "close":
		status = "closed"
	default:
		respondError(w, http.StatusBadRequest, "不支持的操作")
		return
	}
	if body.Action == "close" && body.ProjectID != "" {
		respondError(w, http.StatusBadRequest, "关闭岗位不能同时绑定项目")
		return
	}
	id := chi.URLParam(r, "id")
	updated, err := h.Store.SetPartnerEmploymentJobStatus(r.Context(), id, enterpriseID, status, body.ProjectID)
	if err != nil {
		respondServerError(w, r, err, "更新岗位状态失败")
		return
	}
	if !updated {
		respondError(w, http.StatusNotFound, "岗位不存在，或就业项目未分配给本企业")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id, "status": status})
}

// ===== 投递（只读） =====

func (h *PartnerEmploymentHandler) ListApplications(w http.ResponseWriter, r *http.Request) {
	enterpriseID, _, ok := h.partnerEmploymentCaller(w, r)
	if !ok {
		return
	}
	items, err := h.Store.ListPartnerEmploymentApplications(r.Context(), chi.URLParam(r, "id"), enterpriseID)
	if err != nil {
		respondServerError(w, r, err, "查询投递列表失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.EmploymentApplication]{Items: items, Total: len(items)})
}

func (h *PartnerEmploymentHandler) GetApplication(w http.ResponseWriter, r *http.Request) {
	enterpriseID, _, ok := h.partnerEmploymentCaller(w, r)
	if !ok {
		return
	}
	item, err := h.Store.GetPartnerEmploymentApplicationByID(r.Context(), chi.URLParam(r, "id"), enterpriseID)
	if err != nil {
		alliancePublicGetErr(w, r, err, "投递记录不存在")
		return
	}
	respondJSON(w, http.StatusOK, item)
}
