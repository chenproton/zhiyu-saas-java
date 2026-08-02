package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type CertificationHandler struct {
	Service *service.EvaluationService
}

type CertificationRuleListResponse struct {
	Items []domain.CertificationRule `json:"items"`
	Total int                        `json:"total"`
}

type CertificationItemListResponse struct {
	Items []domain.CertificationAbilityItem `json:"items"`
	Total int                               `json:"total"`
}

type CertificationPointListResponse struct {
	Items []domain.CertificationAbilityPoint `json:"items"`
	Total int                                `json:"total"`
}

type CreateCertificationRuleRequest struct {
	CareerPositionID string `json:"careerPositionId"`
	RuleSource       string `json:"ruleSource"`
}

type CreateCertificationItemRequest struct {
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
}

type CreateCertificationPointRequest struct {
	AbilityPointID     string           `json:"abilityPointId"`
	MappingType        string           `json:"mappingType"`
	CustomLevelMapping domain.JSONSlice `json:"customLevelMapping"`
	RequiredLevel      string           `json:"requiredLevel"`
	Weight             float64          `json:"weight"`
}

type CertificationTaskRequest struct {
	TaskID   string  `json:"taskId"`
	MaxScore float64 `json:"maxScore"`
	Weight   float64 `json:"weight"`
}

type CertificationFullPoint struct {
	ID                 string                            `json:"id"`
	Name               string                            `json:"name"`
	Description        string                            `json:"description"`
	MappingType        string                            `json:"mappingType"`
	CustomLevelMapping domain.JSONSlice                  `json:"customLevelMapping,omitempty"`
	RequiredLevel      string                            `json:"requiredLevel"`
	Weight             float64                           `json:"weight"`
	Tasks              []domain.CertificationRelatedTask `json:"tasks,omitempty"`
}

type CertificationFullItem struct {
	ID          string                   `json:"id"`
	Name        string                   `json:"name"`
	SortOrder   int                      `json:"sortOrder"`
	AbilityName string                   `json:"abilityName,omitempty"`
	Points      []CertificationFullPoint `json:"points"`
}

type PutFullCertificationRuleRequest struct {
	CareerPositionID string                            `json:"careerPositionId"`
	RuleSource       string                            `json:"ruleSource"`
	LevelMapping     domain.JSONSlice                  `json:"levelMapping"`
	Items            []PutFullCertificationItemRequest `json:"items"`
}

type PutFullCertificationItemRequest struct {
	Name      string                             `json:"name"`
	SortOrder int                                `json:"sortOrder"`
	Points    []PutFullCertificationPointRequest `json:"points"`
}

type PutFullCertificationPointRequest struct {
	AbilityPointID     string                     `json:"abilityPointId"`
	MappingType        string                     `json:"mappingType"`
	CustomLevelMapping domain.JSONSlice           `json:"customLevelMapping"`
	RequiredLevel      string                     `json:"requiredLevel"`
	Weight             float64                    `json:"weight"`
	Tasks              []CertificationTaskRequest `json:"tasks"`
}

func (h *CertificationHandler) ListRules(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := store.ListQueryConfig[domain.CertificationRule]{
		Table:         "certification_rules",
		SelectColumns: "id, career_position_id, status, rule_source, level_mapping, created_at, updated_at",
		TenantScoped:  true,
		OrderBy:       "created_at DESC",
		DefaultLimit:  50,
		ScanRows:      store.ScanCertificationRuleRows,
		ExtraFilter: func(p store.ListParams, qb *store.ListQueryBuilder) {
			if status := p.Values["status"]; status != "" {
				qb.AddCondition("status = " + qb.NextArg(status))
			}
		},
	}
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.ListCertificationRules(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询认证规则失败")
		return
	}
	respondJSON(w, http.StatusOK, CertificationRuleListResponse{Items: items, Total: total})
}

func (h *CertificationHandler) GetRule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	rule, err := h.Service.GetCertificationRule(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "认证规则不存在")
		return
	}
	respondJSON(w, http.StatusOK, rule)
}

func (h *CertificationHandler) CreateRule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	var req CreateCertificationRuleRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	// 同一租户同一岗位只允许一条规则
	if existing, err := h.Service.FindRuleByPosition(r.Context(), tenantID, req.CareerPositionID); err == nil && existing != nil {
		respondJSON(w, http.StatusOK, existing)
		return
	}
	rule, err := h.Service.CreateCertificationRule(r.Context(), tenantID, req.CareerPositionID, req.RuleSource)
	if err != nil {
		respondServerError(w, r, err, "创建认证规则失败")
		return
	}
	respondJSON(w, http.StatusCreated, rule)
}

func (h *CertificationHandler) UpdateRuleStatus(w http.ResponseWriter, r *http.Request) {
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetCertificationRuleByTenant(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "认证规则不存在")
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Status != "draft" && req.Status != "published" {
		respondError(w, http.StatusBadRequest, "状态仅支持 draft/published")
		return
	}
	rule, err := h.Service.UpdateCertificationRuleStatus(r.Context(), id, tenantID, req.Status)
	if err != nil {
		respondServerError(w, r, err, "更新规则状态失败")
		return
	}
	respondJSON(w, http.StatusOK, rule)
}

func (h *CertificationHandler) UpdateRule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetCertificationRule(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "认证规则不存在")
		return
	}
	var req CreateCertificationRuleRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	rule, err := h.Service.UpdateCertificationRule(r.Context(), id, req.CareerPositionID, req.RuleSource)
	if err != nil {
		respondServerError(w, r, err, "更新认证规则失败")
		return
	}
	respondJSON(w, http.StatusOK, rule)
}

func (h *CertificationHandler) DeleteRule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetCertificationRule(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "认证规则不存在")
		return
	}
	if err := h.Service.DeleteCertificationRule(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除认证规则失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CertificationHandler) ConfigItems(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	ruleID := chi.URLParam(r, "id")
	if _, err := h.Service.GetCertificationRule(r.Context(), ruleID); err != nil {
		respondError(w, http.StatusNotFound, "认证规则不存在")
		return
	}

	if r.Method == http.MethodPost {
		var req CreateCertificationItemRequest
		if !decodeBody(w, r, &req) {
			return
		}
		if req.Name == "" {
			respondError(w, http.StatusBadRequest, "缺少必填字段")
			return
		}
		tenantID, ok := requireTenant(w, r)
		if !ok {
			return
		}
		item, err := h.Service.CreateCertificationItem(r.Context(), tenantID, ruleID, req.Name, req.SortOrder)
		if err != nil {
			respondServerError(w, r, err, "创建认证项失败")
			return
		}
		respondJSON(w, http.StatusCreated, item)
		return
	}

	items, err := h.Service.ListCertificationItems(r.Context(), ruleID)
	if err != nil {
		respondServerError(w, r, err, "查询认证项失败")
		return
	}
	respondJSON(w, http.StatusOK, CertificationItemListResponse{Items: items, Total: len(items)})
}

func (h *CertificationHandler) ConfigPoints(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	itemID := chi.URLParam(r, "id")
	if _, err := h.Service.GetCertificationItem(r.Context(), itemID); err != nil {
		respondError(w, http.StatusNotFound, "认证项不存在")
		return
	}

	if r.Method == http.MethodPost {
		var req CreateCertificationPointRequest
		if !decodeBody(w, r, &req) {
			return
		}
		if req.AbilityPointID == "" || req.RequiredLevel == "" {
			respondError(w, http.StatusBadRequest, "缺少必填字段")
			return
		}
		tenantID, ok := requireTenant(w, r)
		if !ok {
			return
		}
		if req.CustomLevelMapping == nil {
			req.CustomLevelMapping = domain.JSONSlice{}
		}
		abilityPointUUID, err := uuid.Parse(req.AbilityPointID)
		if err != nil {
			abilityPointUUID = uuid.NewSHA1(uuid.NameSpaceDNS, []byte(req.AbilityPointID))
		}
		point, err := h.Service.CreateCertificationPoint(r.Context(), &store.CertificationPointParams{
			TenantID:           tenantID,
			ItemID:             itemID,
			AbilityPointID:     abilityPointUUID.String(),
			MappingType:        req.MappingType,
			CustomLevelMapping: req.CustomLevelMapping,
			RequiredLevel:      req.RequiredLevel,
			Weight:             req.Weight,
		})
		if err != nil {
			respondServerError(w, r, err, "创建认证点失败")
			return
		}
		respondJSON(w, http.StatusCreated, point)
		return
	}

	points, err := h.Service.ListCertificationPoints(r.Context(), itemID)
	if err != nil {
		respondServerError(w, r, err, "查询认证点失败")
		return
	}
	respondJSON(w, http.StatusOK, CertificationPointListResponse{Items: points, Total: len(points)})
}

func (h *CertificationHandler) DeleteItem(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetCertificationItem(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "认证项不存在")
		return
	}
	if err := h.Service.DeleteCertificationItem(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除认证项失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CertificationHandler) DeletePoint(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetCertificationPoint(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "认证点不存在")
		return
	}
	if err := h.Service.DeleteCertificationPoint(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除认证点失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func validateTaskWeights(tasks []CertificationTaskRequest) bool {
	total := 0.0
	for _, t := range tasks {
		total += t.Weight
	}
	if len(tasks) == 0 {
		return true
	}
	return total >= 99.9 && total <= 100.1
}

func (h *CertificationHandler) PutFullRule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if _, err := h.Service.GetCertificationRuleByTenant(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "认证规则不存在")
		return
	}

	var req PutFullCertificationRuleRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CareerPositionID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	for _, item := range req.Items {
		if item.Name == "" {
			respondError(w, http.StatusBadRequest, "缺少必填字段")
			return
		}
		for _, point := range item.Points {
			if point.AbilityPointID == "" || point.RequiredLevel == "" {
				respondError(w, http.StatusBadRequest, "缺少必填字段")
				return
			}
			tasks := make([]CertificationTaskRequest, 0, len(point.Tasks))
			for _, t := range point.Tasks {
				tasks = append(tasks, CertificationTaskRequest(t))
			}
			if !validateTaskWeights(tasks) {
				respondError(w, http.StatusBadRequest, "关联任务权重之和必须等于 100")
				return
			}
		}
	}

	items := make([]store.PutFullRuleItem, 0, len(req.Items))
	for _, item := range req.Items {
		points := make([]store.PutFullRulePoint, 0, len(item.Points))
		for _, p := range item.Points {
			if p.CustomLevelMapping == nil {
				p.CustomLevelMapping = domain.JSONSlice{}
			}
			tasks := make([]store.PutFullRuleTask, 0, len(p.Tasks))
			for _, t := range p.Tasks {
				tasks = append(tasks, store.PutFullRuleTask{TaskID: t.TaskID, MaxScore: t.MaxScore, Weight: t.Weight})
			}
			points = append(points, store.PutFullRulePoint{
				AbilityPointID:     p.AbilityPointID,
				MappingType:        p.MappingType,
				CustomLevelMapping: p.CustomLevelMapping,
				RequiredLevel:      p.RequiredLevel,
				Weight:             p.Weight,
				Tasks:              tasks,
			})
		}
		items = append(items, store.PutFullRuleItem{Name: item.Name, SortOrder: item.SortOrder, Points: points})
	}

	levelMapping := req.LevelMapping
	if err := h.Service.PutCertificationFull(r.Context(), tenantID, id, req.CareerPositionID, req.RuleSource, levelMapping, items); err != nil {
		respondServerError(w, r, err, "保存认证规则失败")
		return
	}
	rule, _ := h.Service.GetCertificationRule(r.Context(), id)
	respondJSON(w, http.StatusOK, rule)
}

func (h *CertificationHandler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := h.Service.GetCertificationItem(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "认证项不存在")
		return
	}
	var req CreateCertificationItemRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	item, err := h.Service.UpdateCertificationItem(r.Context(), id, req.Name, req.SortOrder)
	if err != nil {
		respondServerError(w, r, err, "更新认证项失败")
		return
	}
	respondJSON(w, http.StatusOK, item)
}

func (h *CertificationHandler) UpdatePoint(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req CreateCertificationPointRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.RequiredLevel == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.CustomLevelMapping == nil {
		req.CustomLevelMapping = domain.JSONSlice{}
	}
	point, err := h.Service.UpdateCertificationPoint(r.Context(), id, tenantID, &store.CertificationPointParams{
		TenantID:           tenantID,
		MappingType:        req.MappingType,
		CustomLevelMapping: req.CustomLevelMapping,
		RequiredLevel:      req.RequiredLevel,
		Weight:             req.Weight,
	})
	if err != nil {
		respondServerError(w, r, err, "更新认证点失败")
		return
	}
	respondJSON(w, http.StatusOK, point)
}

func (h *CertificationHandler) CreateTask(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req CertificationTaskRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.TaskID == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	task, err := h.Service.CreateCertificationTask(r.Context(), tenantID, chi.URLParam(r, "pointId"), req.TaskID, req.MaxScore, req.Weight)
	if err != nil {
		respondServerError(w, r, err, "创建关联任务失败")
		return
	}
	respondJSON(w, http.StatusCreated, task)
}

func (h *CertificationHandler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	var req CertificationTaskRequest
	if !decodeBody(w, r, &req) {
		return
	}
	task, err := h.Service.UpdateCertificationTask(r.Context(), id, tenantID, req.TaskID, req.MaxScore, req.Weight)
	if err != nil {
		respondServerError(w, r, err, "更新关联任务失败")
		return
	}
	respondJSON(w, http.StatusOK, task)
}

func (h *CertificationHandler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if err := h.Service.DeleteCertificationTask(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "删除关联任务失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CertificationHandler) GetFullRule(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	ruleID := chi.URLParam(r, "id")
	rule, err := h.Service.GetCertificationRule(r.Context(), ruleID)
	if err != nil {
		respondError(w, http.StatusNotFound, "认证规则不存在")
		return
	}

	items, points, tasks, err := h.Service.GetCertificationFull(r.Context(), ruleID)
	if err != nil {
		respondServerError(w, r, err, "查询完整规则失败")
		return
	}

	pointMap := make(map[string][]CertificationFullPoint)
	for _, p := range points {
		pointMap[p.ItemID] = append(pointMap[p.ItemID], CertificationFullPoint{
			ID: p.ID, Name: p.Name, Description: p.Description,
			MappingType: p.MappingType, CustomLevelMapping: p.CustomLevelMapping,
			RequiredLevel: p.RequiredLevel, Weight: p.Weight, Tasks: []domain.CertificationRelatedTask{},
		})
	}
	taskMap := make(map[string][]domain.CertificationRelatedTask)
	for _, t := range tasks {
		taskMap[t.CertPointID] = append(taskMap[t.CertPointID], t)
	}

	fullItems := make([]CertificationFullItem, 0, len(items))
	for _, it := range items {
		pts := pointMap[it.ID]
		for j := range pts {
			if ts, ok := taskMap[pts[j].ID]; ok {
				pts[j].Tasks = ts
			}
		}
		fullItems = append(fullItems, CertificationFullItem{
			ID: it.ID, Name: it.Name, SortOrder: it.SortOrder, AbilityName: it.AbilityName, Points: pts,
		})
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"rule":  rule,
		"items": fullItems,
	})
}
