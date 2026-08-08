package handler

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type CourseNodeHandler struct {
	Service *service.LessonContentService
}

type SystemCourseNodeResponse struct {
	ID                  string                           `json:"id"`
	CourseID            string                           `json:"courseId"`
	ParentID            *string                          `json:"parentId,omitempty"`
	Name                string                           `json:"name"`
	Code                *string                          `json:"code,omitempty"`
	Order               int                              `json:"order"`
	Type                string                           `json:"type"`
	SourceID            *string                          `json:"sourceId,omitempty"`
	SourceName          *string                          `json:"sourceName,omitempty"`
	TeachingGoals       *string                          `json:"teachingGoals,omitempty"`
	DetailedDescription *string                          `json:"detailedDescription,omitempty"`
	DescriptionPdf      *string                          `json:"descriptionPdf,omitempty"`
	Background          *string                          `json:"background,omitempty"`
	EstimatedHours      *float64                         `json:"estimatedHours,omitempty"`
	Duration            *float64                         `json:"duration,omitempty"`
	Difficulty          *int                             `json:"difficulty,omitempty"`
	EvalData            domain.JSONMap                   `json:"evalData,omitempty"`
	Status              string                           `json:"status"`
	KnowledgePoints     []SystemCourseNodeKnowledgePoint `json:"knowledgePoints"`
	Resources           []SystemCourseNodeResource       `json:"resources"`
	Quizzes             []domain.NodeQuiz                `json:"quizzes"`
	Homeworks           []domain.NodeHomework            `json:"homeworks"`
}

type SystemCourseNodeKnowledgePoint struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Code        *string `json:"code,omitempty"`
	Description *string `json:"description,omitempty"`
	Linked      bool    `json:"linked"`
}

type SystemCourseNodeResource struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
	URL  string `json:"url"`
	Size int    `json:"size"`
}

type CreateCourseNodeRequest struct {
	CourseID            string           `json:"courseId"`
	ParentID            *string          `json:"parentId"`
	Name                string           `json:"name"`
	Code                *string          `json:"code"`
	SortOrder           int              `json:"sortOrder"`
	RefType             string           `json:"refType"`
	SourceID            *string          `json:"sourceId"`
	SourceName          *string          `json:"sourceName"`
	TeachingGoals       *string          `json:"teachingGoals"`
	DetailedDescription *string          `json:"detailedDescription"`
	DescriptionPdf      *string          `json:"descriptionPdf"`
	Background          *string          `json:"background"`
	EstimatedHours      *float64         `json:"estimatedHours"`
	Duration            *float64         `json:"duration"`
	Difficulty          *int             `json:"difficulty"`
	KnowledgePointIds   domain.JSONSlice `json:"knowledgePointIds"`
	ResourceIds         domain.JSONSlice `json:"resourceIds"`
	EvalData            domain.JSONMap   `json:"evalData"`
	Status              string           `json:"status"`
}

type UpdateCourseNodeRequest = CreateCourseNodeRequest

type ReorderCourseNodesRequest struct {
	CourseID string   `json:"courseId"`
	NodeIDs  []string `json:"nodeIds"`
}

type courseNodeBase = store.CourseNodeBase

func (h *CourseNodeHandler) List(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	cfg := h.Service.Store().CourseNodes().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	bases, total, err := h.Service.ListNodeBases(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询课程节点失败")
		return
	}

	items, err := h.enrichCourseNodes(r.Context(), bases)
	if err != nil {
		respondServerError(w, r, err, "丰富课程节点失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[SystemCourseNodeResponse]{Items: items, Total: total})
}

func (h *CourseNodeHandler) Get(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	base, err := h.Service.GetNodeBase(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "课程节点不存在")
		return
	}
	items, err := h.enrichCourseNodes(r.Context(), []courseNodeBase{*base})
	if err != nil {
		respondServerError(w, r, err, "丰富课程节点失败")
		return
	}
	respondJSON(w, http.StatusOK, items[0])
}

func (h *CourseNodeHandler) Create(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateCourseNodeRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CourseID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	if _, err := h.Service.Store().Courses().Get(r.Context(), req.CourseID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "课程不存在")
		return
	}

	kpIDs := jsonSliceToUUIDSlice(req.KnowledgePointIds)
	resIDs := jsonSliceToUUIDSlice(req.ResourceIds)
	// 校验知识点/资源/引用源归属当前租户，防止跨租户绑定与回显
	if !h.checkNodeRefsTenant(w, r, tenantID, kpIDs, resIDs, req.SourceID, req.RefType) {
		return
	}

	node, err := h.Service.CreateNode(r.Context(), tenantID, &store.CourseNodeCreateParams{
		CourseID:            req.CourseID,
		ParentID:            req.ParentID,
		Name:                req.Name,
		Code:                req.Code,
		SortOrder:           req.SortOrder,
		RefType:             req.RefType,
		SourceID:            req.SourceID,
		SourceName:          req.SourceName,
		TeachingGoals:       req.TeachingGoals,
		DetailedDescription: req.DetailedDescription,
		DescriptionPdf:      req.DescriptionPdf,
		Background:          req.Background,
		EstimatedHours:      req.EstimatedHours,
		Duration:            req.Duration,
		Difficulty:          req.Difficulty,
		EvalData:            req.EvalData,
		Status:              req.Status,
	}, kpIDs, resIDs)
	if err != nil {
		respondServerError(w, r, err, "创建课程节点失败")
		return
	}

	items, err := h.enrichCourseNodes(r.Context(), []courseNodeBase{*node})
	if err != nil {
		respondServerError(w, r, err, "丰富课程节点失败")
		return
	}
	respondJSON(w, http.StatusCreated, items[0])
}

func (h *CourseNodeHandler) Update(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	existing, err := h.Service.GetNodeBase(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, "课程节点不存在")
		return
	}

	var req UpdateCourseNodeRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	// 部分更新兜底：未携带字段回退现有值，防止 nil/零值覆盖清空数据
	if req.ParentID == nil {
		req.ParentID = existing.ParentID
	}
	if req.Code == nil {
		req.Code = existing.Code
	}
	if req.SortOrder == 0 {
		req.SortOrder = existing.SortOrder
	}
	if req.RefType == "" {
		req.RefType = existing.RefType
	}
	if req.SourceID == nil {
		req.SourceID = existing.SourceID
	}
	if req.SourceName == nil {
		req.SourceName = existing.SourceName
	}
	if req.TeachingGoals == nil {
		req.TeachingGoals = existing.TeachingGoals
	}
	if req.DetailedDescription == nil {
		req.DetailedDescription = existing.DetailedDescription
	}
	if req.DescriptionPdf == nil {
		req.DescriptionPdf = existing.DescriptionPdf
	}
	if req.Background == nil {
		req.Background = existing.Background
	}
	if req.EstimatedHours == nil {
		req.EstimatedHours = existing.EstimatedHours
	}
	if req.Duration == nil {
		req.Duration = existing.Duration
	}
	if req.Difficulty == nil {
		req.Difficulty = existing.Difficulty
	}
	if req.EvalData == nil {
		req.EvalData = existing.EvalData
	}
	if req.Status == "" {
		req.Status = existing.Status
	}

	kpIDs := jsonSliceToUUIDSlice(req.KnowledgePointIds)
	resIDs := jsonSliceToUUIDSlice(req.ResourceIds)
	if req.RefType == "original" {
		kpIDs = []string{}
		resIDs = []string{}
	}
	// 校验知识点/资源/引用源归属当前租户
	if !h.checkNodeRefsTenant(w, r, tenantID, kpIDs, resIDs, req.SourceID, req.RefType) {
		return
	}

	node, err := h.Service.UpdateNode(r.Context(), id, tenantID, &store.CourseNodeUpdateParams{
		CourseID:            req.CourseID,
		ParentID:            req.ParentID,
		Name:                req.Name,
		Code:                req.Code,
		SortOrder:           req.SortOrder,
		RefType:             req.RefType,
		SourceID:            req.SourceID,
		SourceName:          req.SourceName,
		TeachingGoals:       req.TeachingGoals,
		DetailedDescription: req.DetailedDescription,
		DescriptionPdf:      req.DescriptionPdf,
		Background:          req.Background,
		EstimatedHours:      req.EstimatedHours,
		Duration:            req.Duration,
		Difficulty:          req.Difficulty,
		EvalData:            req.EvalData,
		Status:              req.Status,
	}, kpIDs, resIDs)
	if err != nil {
		respondServerError(w, r, err, "更新课程节点失败")
		return
	}

	items, err := h.enrichCourseNodes(r.Context(), []courseNodeBase{*node})
	if err != nil {
		respondServerError(w, r, err, "丰富课程节点失败")
		return
	}
	respondJSON(w, http.StatusOK, items[0])
}

func (h *CourseNodeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if _, err := h.Service.GetNodeBase(r.Context(), id, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "课程节点不存在")
		return
	}
	if err := h.Service.DeleteNode(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, "删除课程节点失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *CourseNodeHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req ReorderCourseNodesRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.CourseID == "" || len(req.NodeIDs) == 0 {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	if _, err := h.Service.Store().Courses().Get(r.Context(), req.CourseID, tenantID); err != nil {
		respondError(w, http.StatusNotFound, "课程不存在")
		return
	}
	if err := h.Service.ReorderNodes(r.Context(), req.CourseID, req.NodeIDs); err != nil {
		respondServerError(w, r, err, "重新排序nodes失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// enrichCourseNodes 组装节点响应（知识点/资源/测验/作业/original 继承）。
func (h *CourseNodeHandler) enrichCourseNodes(ctx context.Context, bases []courseNodeBase) ([]SystemCourseNodeResponse, error) {
	items := make([]SystemCourseNodeResponse, len(bases))
	nodeIndex := make(map[string]int, len(bases))
	nodeIDs := make([]string, 0, len(bases))
	for i, b := range bases {
		items[i] = SystemCourseNodeResponse{
			ID:                  b.ID,
			CourseID:            b.CourseID,
			ParentID:            b.ParentID,
			Name:                b.Name,
			Code:                b.Code,
			Order:               b.SortOrder,
			Type:                b.RefType,
			SourceID:            b.SourceID,
			SourceName:          b.SourceName,
			TeachingGoals:       b.TeachingGoals,
			DetailedDescription: b.DetailedDescription,
			DescriptionPdf:      b.DescriptionPdf,
			Background:          b.Background,
			EstimatedHours:      b.EstimatedHours,
			Duration:            b.Duration,
			Difficulty:          b.Difficulty,
			EvalData:            b.EvalData,
			Status:              b.Status,
		}
		nodeIndex[b.ID] = i
		nodeIDs = append(nodeIDs, b.ID)
	}
	if len(nodeIDs) == 0 {
		return items, nil
	}

	kpIDSet := make(map[string]bool)
	resIDSet := make(map[string]bool)
	originalSourceIDs := make([]string, 0, len(items))
	nodeIDBySource := make(map[string][]string, len(items))
	for _, b := range bases {
		for _, id := range b.KnowledgePointIds {
			kpIDSet[id] = true
		}
		for _, id := range b.ResourceIds {
			resIDSet[id] = true
		}
		if b.RefType == "original" && b.SourceID != nil && *b.SourceID != "" {
			sourceID := *b.SourceID
			originalSourceIDs = append(originalSourceIDs, sourceID)
			nodeIDBySource[sourceID] = append(nodeIDBySource[sourceID], b.ID)
		}
	}
	allKPIDs := make([]string, 0, len(kpIDSet))
	for id := range kpIDSet {
		allKPIDs = append(allKPIDs, id)
	}
	allResIDs := make([]string, 0, len(resIDSet))
	for id := range resIDSet {
		allResIDs = append(allResIDs, id)
	}

	data, err := h.Service.EnrichNodes(ctx, nodeIDs, allKPIDs, allResIDs, originalSourceIDs)
	if err != nil {
		return nil, err
	}

	for i, b := range bases {
		for _, id := range b.KnowledgePointIds {
			if kp, ok := data.KnowledgePoints[id]; ok {
				items[i].KnowledgePoints = append(items[i].KnowledgePoints, SystemCourseNodeKnowledgePoint{
					ID: kp.ID, Name: kp.Name, Code: kp.Code, Description: kp.Description, Linked: kp.Linked,
				})
			}
		}
		for _, id := range b.ResourceIds {
			if res, ok := data.Resources[id]; ok {
				items[i].Resources = append(items[i].Resources, SystemCourseNodeResource{
					ID: res.ID, Name: res.Name, Type: res.Type, URL: res.URL, Size: res.Size,
				})
			}
		}
	}

	for _, q := range data.Quizzes {
		if idx, ok := nodeIndex[q.NodeID]; ok {
			items[idx].Quizzes = append(items[idx].Quizzes, q)
		}
	}
	for _, hw := range data.Homeworks {
		if idx, ok := nodeIndex[hw.NodeID]; ok {
			items[idx].Homeworks = append(items[idx].Homeworks, hw)
		}
	}

	// original 节点从来源颗粒课继承知识点/资源
	kpSeen := make(map[string]map[string]bool)
	resSeen := make(map[string]map[string]bool)
	for _, b := range bases {
		if b.RefType != "original" {
			continue
		}
		kpSeen[b.ID] = make(map[string]bool)
		for _, id := range b.KnowledgePointIds {
			kpSeen[b.ID][id] = true
		}
		resSeen[b.ID] = make(map[string]bool)
		for _, id := range b.ResourceIds {
			resSeen[b.ID][id] = true
		}
	}
	for courseID, kps := range data.OriginalKP {
		for _, nodeID := range nodeIDBySource[courseID] {
			if idx, ok := nodeIndex[nodeID]; ok {
				for _, kp := range kps {
					if kpSeen[nodeID][kp.ID] {
						continue
					}
					kpSeen[nodeID][kp.ID] = true
					items[idx].KnowledgePoints = append(items[idx].KnowledgePoints, SystemCourseNodeKnowledgePoint{
						ID: kp.ID, Name: kp.Name, Code: kp.Code, Description: kp.Description, Linked: kp.Linked,
					})
				}
			}
		}
	}
	for courseID, resList := range data.OriginalRes {
		for _, nodeID := range nodeIDBySource[courseID] {
			if idx, ok := nodeIndex[nodeID]; ok {
				for _, res := range resList {
					if resSeen[nodeID][res.ID] {
						continue
					}
					resSeen[nodeID][res.ID] = true
					items[idx].Resources = append(items[idx].Resources, SystemCourseNodeResource{
						ID: res.ID, Name: res.Name, Type: res.Type, URL: res.URL, Size: res.Size,
					})
				}
			}
		}
	}

	return items, nil
}

// checkNodeRefsTenant 校验节点引用的知识点/资源/颗粒课源属于当前租户。
func (h *CourseNodeHandler) checkNodeRefsTenant(w http.ResponseWriter, r *http.Request, tenantID string, kpIDs, resIDs []string, sourceID *string, refType string) bool {
	st := h.Service.Store()
	for _, kpID := range kpIDs {
		if _, err := st.KnowledgePoints().Get(r.Context(), kpID, tenantID); err != nil {
			respondError(w, http.StatusNotFound, "知识点不存在")
			return false
		}
	}
	for _, resID := range resIDs {
		item, err := st.ResourceLibrary().Get(r.Context(), resID)
		if err != nil || item.TenantID != tenantID {
			respondError(w, http.StatusNotFound, "资源不存在")
			return false
		}
	}
	if refType == "original" && sourceID != nil && *sourceID != "" {
		if _, err := st.Courses().Get(r.Context(), *sourceID, tenantID); err != nil {
			respondError(w, http.StatusNotFound, "引用颗粒课不存在")
			return false
		}
	}
	return true
}
