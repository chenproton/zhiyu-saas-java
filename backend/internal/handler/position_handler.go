package handler

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/redis/go-redis/v9"
	"github.com/zhiyu-saas/backend/internal/cache"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type PositionHandler struct {
	Service     *service.PositionService
	RedisClient *redis.Client
}

type CreatePositionRequest struct {
	BatchID       *string  `json:"batchId"`
	Name          string   `json:"name"`
	ShortName     *string  `json:"shortName"`
	IndustryID    *string  `json:"industryId"`
	PositionType  string   `json:"positionType"`
	SalaryMin     *int     `json:"salaryMin"`
	SalaryMax     *int     `json:"salaryMax"`
	CoverImage    *string  `json:"coverImage"`
	Description   *string  `json:"description"`
	Requirements  []string `json:"requirements"`
	CareerPath    *string  `json:"careerPath"`
	Version       string   `json:"version"`
	Collaborators []string `json:"collaborators"`
	MajorIDs      []string `json:"majorIds"`
}

type UpdatePositionRequest = CreatePositionRequest

func (h *PositionHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	publicOnly := claims == nil

	var cfg store.ListQueryConfig[domain.CareerPosition]
	if publicOnly {
		cfg = h.Service.Store().Positions().PublicListConfig()
	} else {
		cfg = h.Service.Store().Positions().AdminListConfig()
	}

	params, ok := listParamsFromRequest(r, !publicOnly)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.List(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询岗位失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.CareerPosition]{Items: items, Total: total})
}

func (h *PositionHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID := ""
	if claims.TenantID != nil {
		tenantID = *claims.TenantID
	}
	// 视图计数异步记录，不阻塞详情读取
	recordViewAsync(h.Service.IncrementView, id, claims.UserID, tenantID)
	pos, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, pos.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, pos)
}

func (h *PositionHandler) PublicList(w http.ResponseWriter, r *http.Request) {
	cfg := h.Service.Store().Positions().PublicListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.List(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询岗位失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.CareerPosition]{Items: items, Total: total})
}

func (h *PositionHandler) PublicGet(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "请先登录")
		return
	}

	id := chi.URLParam(r, "id")
	// 视图计数异步记录，不阻塞详情读取
	tenantID := ""
	if claims.TenantID != nil {
		tenantID = *claims.TenantID
	}
	recordViewAsync(h.Service.IncrementView, id, claims.UserID, tenantID)
	pos, err := h.Service.Get(r.Context(), id)
	if err != nil || pos.Status != domain.StatusPublished {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, pos.TenantID) {
		return
	}
	respondJSON(w, http.StatusOK, pos)
}

func (h *PositionHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreatePositionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.PositionType == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.Version == "" {
		req.Version = "v1.0"
	}
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}

	pos, err := h.Service.Create(r.Context(), tenantID, &store.PositionCreateParams{
		BatchID:       req.BatchID,
		Name:          req.Name,
		ShortName:     req.ShortName,
		IndustryID:    req.IndustryID,
		PositionType:  req.PositionType,
		SalaryMin:     req.SalaryMin,
		SalaryMax:     req.SalaryMax,
		CoverImage:    req.CoverImage,
		Description:   req.Description,
		Requirements:  coalesceStringSlice(req.Requirements),
		CareerPath:    req.CareerPath,
		Version:       req.Version,
		Status:        domain.CareerPositionStatusDraft,
		CreatedBy:     claims.UserID,
		Collaborators: coalesceStringSlice(req.Collaborators),
		MajorIDs:      req.MajorIDs,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "岗位名称已存在，请使用其他名称")
			return
		}
		respondServerError(w, r, err, "创建岗位失败")
		return
	}
	respondJSON(w, http.StatusCreated, pos)
}

func (h *PositionHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	existing, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	var req UpdatePositionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		req.Name = existing.Name
	}
	if req.PositionType == "" {
		req.PositionType = string(existing.PositionType)
	}
	if req.ShortName == nil || *req.ShortName == "" {
		req.ShortName = existing.ShortName
	}
	majorIDs := req.MajorIDs
	if majorIDs == nil {
		majorIDs = existing.MajorIDs
	}
	requirements := req.Requirements
	if requirements == nil {
		requirements = existing.Requirements
	}
	collaborators := req.Collaborators
	if collaborators == nil {
		collaborators = existing.Collaborators
	}
	industryID := req.IndustryID
	if industryID == nil {
		industryID = existing.IndustryID
	}
	salaryMin := req.SalaryMin
	if salaryMin == nil {
		salaryMin = existing.SalaryMin
	}
	salaryMax := req.SalaryMax
	if salaryMax == nil {
		salaryMax = existing.SalaryMax
	}
	coverImage := req.CoverImage
	if coverImage == nil {
		coverImage = existing.CoverImage
	}
	description := req.Description
	if description == nil {
		description = existing.Description
	}
	careerPath := req.CareerPath
	if careerPath == nil {
		careerPath = existing.CareerPath
	}
	version := req.Version
	if version == "" {
		version = existing.Version
	}

	pos, err := h.Service.Update(r.Context(), id, &store.PositionUpdateParams{
		BatchID:       existing.BatchID,
		Name:          req.Name,
		ShortName:     req.ShortName,
		IndustryID:    industryID,
		PositionType:  req.PositionType,
		SalaryMin:     salaryMin,
		SalaryMax:     salaryMax,
		CoverImage:    coverImage,
		Description:   description,
		Requirements:  requirements,
		CareerPath:    careerPath,
		Version:       version,
		Collaborators: collaborators,
		MajorIDs:      majorIDs,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "岗位名称已存在，请使用其他名称")
			return
		}
		respondServerError(w, r, err, "更新岗位失败")
		return
	}
	respondJSON(w, http.StatusOK, pos)
}

func (h *PositionHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if middleware.CurrentUser(r) == nil {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID, err := h.Service.TenantID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, tenantID) {
		return
	}
	if err := h.Service.Delete(r.Context(), id); err != nil {
		respondServerError(w, r, err, "删除岗位失败")
		return
	}
	h.clearPublicPositionsCacheByTenantID(r, tenantID)
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// ===== SaveFull =====

type FullPositionResponsibility struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

type FullPositionCertificate struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	URL         *string `json:"url"`
	Description *string `json:"description"`
	Image       *string `json:"image"`
}

type FullPositionAbilityBinding struct {
	ID                string   `json:"id"`
	ResponsibilityID  string   `json:"responsibilityId"`
	Source            string   `json:"source"`
	PublicAbilityID   *string  `json:"publicAbilityId"`
	AbilityPointID    *string  `json:"abilityPointId"`
	Name              string   `json:"name"`
	Category          string   `json:"category"`
	Level             string   `json:"level"`
	RubricDescription *string  `json:"rubricDescription"`
	Description       *string  `json:"description"`
	Attributes        []string `json:"attributes"`
	Domain            *string  `json:"domain"`
}

type FullPositionAbilityDomain struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	BindingIDs  []string `json:"bindingIds"`
}

type SaveFullPositionRequest struct {
	BatchID          string                       `json:"batchId"`
	Name             string                       `json:"name"`
	ShortName        string                       `json:"shortName"`
	Industry         string                       `json:"industry"`
	Majors           []string                     `json:"majors"`
	PositionType     string                       `json:"positionType"`
	SalaryRange      [2]int                       `json:"salaryRange"`
	CoverImage       *string                      `json:"coverImage"`
	Description      *string                      `json:"description"`
	Requirements     []string                     `json:"requirements"`
	CareerPath       *string                      `json:"careerPath"`
	Version          string                       `json:"version"`
	Collaborators    []string                     `json:"collaborators"`
	Responsibilities []FullPositionResponsibility `json:"responsibilities"`
	Certificates     []FullPositionCertificate    `json:"certificates"`
	AbilityBindings  []FullPositionAbilityBinding `json:"abilityBindings"`
	AbilityDomains   []FullPositionAbilityDomain  `json:"abilityDomains"`
}

func (h *PositionHandler) SaveFull(w http.ResponseWriter, r *http.Request) {
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
	existing, err := h.Service.Get(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "岗位不存在")
		return
	}
	if !verifyTenantOwnership(w, r, existing.TenantID) {
		return
	}

	var req SaveFullPositionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.PositionType == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	var batchID *string
	if req.BatchID != "" {
		batchID = &req.BatchID
	}
	var industryID *string
	if req.Industry != "" {
		industryID = &req.Industry
	}
	var coverImage, description, careerPath *string
	if req.CoverImage != nil && *req.CoverImage != "" {
		coverImage = req.CoverImage
	}
	if req.Description != nil && *req.Description != "" {
		description = req.Description
	}
	if req.CareerPath != nil && *req.CareerPath != "" {
		careerPath = req.CareerPath
	}

	certificates := make([]store.FullPositionCertificateItem, 0, len(req.Certificates))
	for _, c := range req.Certificates {
		certificates = append(certificates, store.FullPositionCertificateItem{
			ID: c.ID, Name: c.Name, URL: c.URL, Description: c.Description, Image: c.Image,
		})
	}
	responsibilities := make([]store.FullPositionResponsibilityItem, 0, len(req.Responsibilities))
	for _, resp := range req.Responsibilities {
		var desc *string
		if resp.Description != nil && *resp.Description != "" {
			desc = resp.Description
		}
		responsibilities = append(responsibilities, store.FullPositionResponsibilityItem{
			ID: resp.ID, Name: resp.Name, Description: desc,
		})
	}
	abilityBindings := make([]store.FullPositionAbilityBindingItem, 0, len(req.AbilityBindings))
	for _, b := range req.AbilityBindings {
		publicAbilityID := ""
		if b.PublicAbilityID != nil {
			publicAbilityID = *b.PublicAbilityID
		}
		abilityPointID := ""
		if b.AbilityPointID != nil {
			abilityPointID = *b.AbilityPointID
		}
		var domainField, rubricDesc *string
		if b.Domain != nil && *b.Domain != "" {
			domainField = b.Domain
		}
		if b.RubricDescription != nil && *b.RubricDescription != "" {
			rubricDesc = b.RubricDescription
		}
		abilityBindings = append(abilityBindings, store.FullPositionAbilityBindingItem{
			ID: b.ID, ResponsibilityID: b.ResponsibilityID, Source: b.Source,
			Name: b.Name, Category: b.Category, Description: b.Description,
			PublicAbilityID: publicAbilityID, AbilityPointID: abilityPointID,
			Domain: domainField, RequiredLevel: b.Level,
			RubricDescription: rubricDesc, Attributes: coalesceStringSlice(b.Attributes),
		})
	}
	abilityDomains := make([]store.FullPositionAbilityDomainItem, 0, len(req.AbilityDomains))
	for _, ad := range req.AbilityDomains {
		var desc *string
		if ad.Description != nil && *ad.Description != "" {
			desc = ad.Description
		}
		abilityDomains = append(abilityDomains, store.FullPositionAbilityDomainItem{
			ID: ad.ID, Name: ad.Name, Description: desc, BindingIDs: ad.BindingIDs,
		})
	}

	err = h.Service.SaveFull(r.Context(), tenantID, id, &store.FullPositionSaveParams{
		BatchID:          batchID,
		Name:             req.Name,
		ShortName:        req.ShortName,
		IndustryID:       industryID,
		PositionType:     req.PositionType,
		SalaryRange:      req.SalaryRange,
		CoverImage:       coverImage,
		Description:      description,
		Requirements:     coalesceStringSlice(req.Requirements),
		CareerPath:       careerPath,
		Version:          req.Version,
		Collaborators:    coalesceStringSlice(req.Collaborators),
		Majors:           req.Majors,
		Certificates:     certificates,
		Responsibilities: responsibilities,
		AbilityBindings:  abilityBindings,
		AbilityDomains:   abilityDomains,
	})
	if err != nil {
		respondServerError(w, r, err, "保存岗位失败")
		return
	}

	pos, _ := h.Service.Get(r.Context(), id)
	h.clearPublicPositionsCache(r)
	respondJSON(w, http.StatusOK, pos)
}

// ===== Favorites =====

type FavoriteStatusResponse struct {
	IsFavorite    bool `json:"isFavorite"`
	FavoriteCount int  `json:"favoriteCount"`
}

func (h *PositionHandler) GetFavorite(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "请先登录")
		return
	}
	id := chi.URLParam(r, "id")
	isfav, err := h.Service.GetFavorite(r.Context(), claims.UserID, id)
	if err != nil {
		respondServerError(w, r, err, "查询收藏状态失败")
		return
	}
	cnt, _ := h.Service.FavoriteCount(r.Context(), id)
	respondJSON(w, http.StatusOK, FavoriteStatusResponse{IsFavorite: isfav, FavoriteCount: cnt})
}

func (h *PositionHandler) ToggleFavorite(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "请先登录")
		return
	}
	id := chi.URLParam(r, "id")
	isfav, err := h.Service.ToggleFavorite(r.Context(), claims.UserID, id)
	if err != nil {
		respondServerError(w, r, err, "切换收藏失败")
		return
	}
	// 收藏数变化影响前台岗位列表/排行榜，立即失效公开列表缓存
	h.clearPublicPositionsCache(r)
	cnt, _ := h.Service.FavoriteCount(r.Context(), id)
	respondJSON(w, http.StatusOK, FavoriteStatusResponse{IsFavorite: isfav, FavoriteCount: cnt})
}

func (h *PositionHandler) ListFavorites(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "请先登录")
		return
	}

	cfg := h.Service.Store().Positions().FavoritesListConfig(claims.UserID)
	params, _ := listParamsFromRequest(r, false)
	items, total, err := h.Service.ListFavorites(r.Context(), claims.UserID, params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询收藏岗位失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.CareerPosition]{Items: items, Total: total})
}

// ===== Content actions =====

func (h *PositionHandler) actions() contentActions {
	return contentActions{
		st:         h.Service.Store(),
		table:      "career_positions",
		entityName: "position",
		targetType: "career_position",
		inviteCol:  "collaborators",
		invalidate: h.clearPublicPositionsCacheByTenantID,
		fetch: func(ctx context.Context, id string) (interface{}, error) {
			return h.Service.Get(ctx, id)
		},
	}
}

func (h *PositionHandler) Submit(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPending)
}

func (h *PositionHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *PositionHandler) Invite(w http.ResponseWriter, r *http.Request) {
	h.actions().invite(w, r)
}

func (h *PositionHandler) Review(w http.ResponseWriter, r *http.Request) {
	h.actions().review(w, r)
}

func (h *PositionHandler) Publish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusPublished)
}

func (h *PositionHandler) Archive(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusArchived)
}

func (h *PositionHandler) Unpublish(w http.ResponseWriter, r *http.Request) {
	h.actions().transition(w, r, domain.StatusDraft)
}

func (h *PositionHandler) SaveDraft(w http.ResponseWriter, r *http.Request) {
	h.actions().saveDraft(w, r)
}

// ===== Cache =====

func (h *PositionHandler) clearPublicPositionsCache(r *http.Request) {
	if h.RedisClient == nil {
		return
	}
	claims := middleware.CurrentUser(r)
	tenantID := "global"
	if claims != nil && claims.TenantID != nil {
		tenantID = *claims.TenantID
	}
	h.clearPublicPositionsCacheByTenantID(r, tenantID)
}

func (h *PositionHandler) clearPublicPositionsCacheByTenantID(r *http.Request, tenantID string) {
	cache.InvalidatePrefix(r.Context(), h.RedisClient, "zhiyu:"+tenantID+":public:positions")
}
