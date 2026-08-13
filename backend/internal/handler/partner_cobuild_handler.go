package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// PartnerCoBuildHandler 企业端资源共建接口（岗位/场景/任务，薄适配：claims → service → 错误映射）。
type PartnerCoBuildHandler struct {
	Service *service.PartnerCoBuildService
}

// partnerCaller 解析企业用户身份（租户 + 用户 ID）。
func (h *PartnerCoBuildHandler) partnerCaller(w http.ResponseWriter, r *http.Request) (string, string, bool) {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return "", "", false
	}
	return *claims.TenantID, claims.UserID, true
}

// respondCoBuildError 共建业务错误 → HTTP 状态映射。
func respondCoBuildError(w http.ResponseWriter, r *http.Request, err error, notFoundMsg, serverMsg string) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		respondError(w, http.StatusNotFound, notFoundMsg)
	case errors.Is(err, pgx.ErrNoRows):
		respondError(w, http.StatusNotFound, "企业主体不存在")
	case errors.Is(err, service.ErrCoBuildLinkInactive):
		respondError(w, http.StatusForbidden, "目标学校与本企业无生效中的合作关系")
	case errors.Is(err, service.ErrCoBuildNotEditable):
		respondError(w, http.StatusConflict, "当前状态不允许编辑或删除")
	case errors.Is(err, store.ErrApprovalExists):
		respondError(w, http.StatusConflict, "该内容已有待审批记录")
	case errors.Is(err, service.ErrMethodVersionConflict):
		respondError(w, http.StatusConflict, "评价规则已被其他会话修改")
	case errors.Is(err, store.ErrResourceInUse):
		respondError(w, http.StatusConflict, "该资源已存在成绩记录或活跃绑定，无法删除")
	case err != nil && strings.HasPrefix(err.Error(), "invalid transition"):
		respondError(w, http.StatusBadRequest, err.Error())
	default:
		respondServerError(w, r, err, serverMsg)
	}
}

// respondSchoolScopedList 合作学校只读列表通用响应（错误映射 + ListResponse 包装）。
func respondSchoolScopedList[T any](w http.ResponseWriter, r *http.Request, items []T, total int, err error, serverMsg string) {
	if err != nil {
		respondCoBuildError(w, r, err, "学校不存在", serverMsg)
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[T]{Items: items, Total: total})
}

// schoolListHandler 合作学校只读列表 handler 骨架（partner 租户 + 学校租户路径参数）。
func schoolListHandler[T any](h *PartnerCoBuildHandler, list func(ctx context.Context, partnerTenantID, schoolTenantID string, p store.ListParams) ([]T, int, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		partnerTenantID, _, ok := h.partnerCaller(w, r)
		if !ok {
			return
		}
		schoolTenantID := chi.URLParam(r, "tenantId")
		items, total, err := list(r.Context(), partnerTenantID, schoolTenantID, schoolListParams(r, schoolTenantID))
		respondSchoolScopedList(w, r, items, total, err, "查询学校数据失败")
	}
}

// schoolListParams 构造学校租户域的列表参数（tenant 强制为目标学校，其余查询参数透传）。
func schoolListParams(r *http.Request, schoolTenantID string) store.ListParams {
	p := store.ListParams{
		Search:   r.URL.Query().Get("search"),
		TenantID: schoolTenantID,
		Values:   map[string]string{},
	}
	for k, vs := range r.URL.Query() {
		if len(vs) > 0 {
			p.Values[k] = vs[0]
		}
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := parseInt(v, 0); err == nil && n > 0 {
			p.Limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := parseInt(v, 0); err == nil && n >= 0 {
			p.Offset = n
		}
	}
	return p
}

func optionalSchoolFilter(r *http.Request) *string {
	if v := r.URL.Query().Get("schoolTenantId"); v != "" {
		return &v
	}
	return nil
}

// ===== 岗位 =====

// coBuildPositionCreateRequest 共建岗位创建请求（portal 岗位字段 + 目标学校）。
type coBuildPositionCreateRequest struct {
	CreatePositionRequest
	SchoolTenantID string `json:"schoolTenantId"`
}

func (h *PartnerCoBuildHandler) ListPositions(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	limit, offset := parseLimitOffset(r, 50)
	items, total, err := h.Service.ListPositions(r.Context(), partnerTenantID, optionalSchoolFilter(r), r.URL.Query().Get("search"), limit, offset)
	if err != nil {
		respondCoBuildError(w, r, err, "岗位不存在", "查询共建岗位失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.PartnerCoBuildPosition]{Items: items, Total: total})
}

func (h *PartnerCoBuildHandler) GetPosition(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	pos, err := h.Service.GetPosition(r.Context(), partnerTenantID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "岗位不存在", "查询共建岗位失败")
		return
	}
	respondJSON(w, http.StatusOK, pos)
}

// EditSourcePosition 学校授权编辑：复制学校自建岗位为 draft 副本（幂等，返回副本）。
func (h *PartnerCoBuildHandler) EditSourcePosition(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, userID, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	pos, err := h.Service.EditSourcePosition(r.Context(), partnerTenantID, userID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "岗位不存在或未授权", "创建编辑稿失败")
		return
	}
	respondJSON(w, http.StatusOK, pos)
}

func (h *PartnerCoBuildHandler) CreatePosition(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, userID, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	var req coBuildPositionCreateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.SchoolTenantID == "" || req.Name == "" || req.PositionType == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.Version == "" {
		req.Version = "V1.0"
	}
	pos, err := h.Service.CreatePosition(r.Context(), partnerTenantID, userID, req.SchoolTenantID, &store.PositionCreateParams{
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
		Collaborators: coalesceStringSlice(req.Collaborators),
		MajorIDs:      req.MajorIDs,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "岗位名称已存在，请使用其他名称")
			return
		}
		respondCoBuildError(w, r, err, "岗位不存在", "创建共建岗位失败")
		return
	}
	respondJSON(w, http.StatusCreated, pos)
}

// UpdatePosition 与 portal 一致的部分更新兜底：未携带字段保留原值。
func (h *PartnerCoBuildHandler) UpdatePosition(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := h.Service.GetPosition(r.Context(), partnerTenantID, id)
	if err != nil {
		respondCoBuildError(w, r, err, "岗位不存在", "查询共建岗位失败")
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
	if req.MajorIDs == nil {
		req.MajorIDs = existing.MajorIDs
	}
	if req.Requirements == nil {
		req.Requirements = existing.Requirements
	}
	if req.Collaborators == nil {
		req.Collaborators = existing.Collaborators
	}
	if req.IndustryID == nil {
		req.IndustryID = existing.IndustryID
	}
	if req.SalaryMin == nil {
		req.SalaryMin = existing.SalaryMin
	}
	if req.SalaryMax == nil {
		req.SalaryMax = existing.SalaryMax
	}
	if req.CoverImage == nil {
		req.CoverImage = existing.CoverImage
	}
	if req.Description == nil {
		req.Description = existing.Description
	}
	if req.CareerPath == nil {
		req.CareerPath = existing.CareerPath
	}
	if req.Version == "" {
		req.Version = existing.Version
	}
	if req.BatchID == nil {
		req.BatchID = existing.BatchID
	}

	pos, err := h.Service.UpdatePosition(r.Context(), partnerTenantID, id, &store.PositionUpdateParams{
		BatchID:       req.BatchID,
		Name:          req.Name,
		ShortName:     req.ShortName,
		IndustryID:    req.IndustryID,
		PositionType:  req.PositionType,
		SalaryMin:     req.SalaryMin,
		SalaryMax:     req.SalaryMax,
		CoverImage:    req.CoverImage,
		Description:   req.Description,
		Requirements:  req.Requirements,
		CareerPath:    req.CareerPath,
		Version:       req.Version,
		Collaborators: req.Collaborators,
		MajorIDs:      req.MajorIDs,
	})
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "岗位名称已存在，请使用其他名称")
			return
		}
		respondCoBuildError(w, r, err, "岗位不存在", "更新共建岗位失败")
		return
	}
	respondJSON(w, http.StatusOK, pos)
}

func (h *PartnerCoBuildHandler) DeletePosition(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Service.DeletePosition(r.Context(), partnerTenantID, id); err != nil {
		respondCoBuildError(w, r, err, "岗位不存在", "删除共建岗位失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

// SaveFullPosition 完整保存共建岗位（请求形状与 portal save-full 一致）。
func (h *PartnerCoBuildHandler) SaveFullPosition(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	var req SaveFullPositionRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.PositionType == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	pos, err := h.Service.SaveFullPosition(r.Context(), partnerTenantID, id, toFullPositionSaveParams(&req))
	if err != nil {
		respondCoBuildError(w, r, err, "岗位不存在", "保存共建岗位失败")
		return
	}
	respondJSON(w, http.StatusOK, pos)
}

func (h *PartnerCoBuildHandler) SubmitPosition(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, userID, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	pos, err := h.Service.SubmitPosition(r.Context(), partnerTenantID, userID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "岗位不存在", "提交审核失败")
		return
	}
	respondJSON(w, http.StatusOK, pos)
}

func (h *PartnerCoBuildHandler) WithdrawPosition(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	pos, err := h.Service.WithdrawPosition(r.Context(), partnerTenantID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "岗位不存在", "撤回审核失败")
		return
	}
	respondJSON(w, http.StatusOK, pos)
}

// ===== 岗位编辑子资源只读（形状与 portal 对应接口一致） =====

// ListPositionResponsibilities 共建岗位职责（同 portal positionResponsibilityApi.list）。
func (h *PartnerCoBuildHandler) ListPositionResponsibilities(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	items, total, err := h.Service.ListPositionResponsibilities(r.Context(), partnerTenantID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "岗位不存在", "查询岗位职责失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.PositionResponsibility]{Items: items, Total: total})
}

// ListPositionCertificates 共建岗位证书（同 portal positionCertificateApi.list，支持 limit/offset）。
func (h *PartnerCoBuildHandler) ListPositionCertificates(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	limit, offset := parseLimitOffset(r, 50)
	items, total, err := h.Service.ListPositionCertificates(r.Context(), partnerTenantID, chi.URLParam(r, "id"), limit, offset)
	if err != nil {
		respondCoBuildError(w, r, err, "岗位不存在", "查询证书失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.PositionCertificate]{Items: items, Total: total})
}

// ListPositionAbilityBindings 共建岗位能力绑定（同 portal abilityApi.listBindings，含能力点名称）。
func (h *PartnerCoBuildHandler) ListPositionAbilityBindings(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	items, total, err := h.Service.ListPositionAbilityBindings(r.Context(), partnerTenantID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "岗位不存在", "查询绑定失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.PositionAbilityBinding]{Items: items, Total: total})
}

// ListPositionAbilityDomains 共建岗位能力域（同 portal abilityApi.listDomains）。
func (h *PartnerCoBuildHandler) ListPositionAbilityDomains(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	items, total, err := h.Service.ListPositionAbilityDomains(r.Context(), partnerTenantID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "岗位不存在", "查询能力域失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.AbilityDomain]{Items: items, Total: total})
}

// ===== 场景 =====

// coBuildScenarioCreateRequest 共建场景创建请求（portal 场景字段 + 目标学校）。
type coBuildScenarioCreateRequest struct {
	CreateScenarioRequest
	SchoolTenantID string `json:"schoolTenantId"`
}

func (h *PartnerCoBuildHandler) ListScenarios(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	limit, offset := parseLimitOffset(r, 50)
	items, total, err := h.Service.ListScenarios(r.Context(), partnerTenantID, optionalSchoolFilter(r), r.URL.Query().Get("search"), limit, offset)
	if err != nil {
		respondCoBuildError(w, r, err, "场景不存在", "查询共建场景失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.PartnerCoBuildScenario]{Items: items, Total: total})
}

func (h *PartnerCoBuildHandler) GetScenario(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	sc, err := h.Service.GetScenario(r.Context(), partnerTenantID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "场景方案不存在", "查询共建场景失败")
		return
	}
	respondJSON(w, http.StatusOK, sc)
}

// EditSourceScenario 学校授权编辑：复制学校自建场景为 draft 副本（幂等，返回副本）。
func (h *PartnerCoBuildHandler) EditSourceScenario(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, userID, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	sc, err := h.Service.EditSourceScenario(r.Context(), partnerTenantID, userID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "场景不存在或未授权", "创建编辑稿失败")
		return
	}
	respondJSON(w, http.StatusOK, sc)
}

func (h *PartnerCoBuildHandler) CreateScenario(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, userID, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	var req coBuildScenarioCreateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.SchoolTenantID == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	if req.Version == "" {
		req.Version = "V1.0"
	}
	// 快速创建未填难度：场景 difficulty 检查约束要求 1-5，默认 1（草稿由编辑页完善）
	if req.Difficulty == 0 {
		req.Difficulty = 1
	}
	sc, err := h.Service.CreateScenario(r.Context(), partnerTenantID, userID, req.SchoolTenantID, &store.ScenarioCreateParams{
		Name:             req.Name,
		CoverImage:       req.CoverImage,
		CareerPositionID: req.CareerPositionID,
		IndustryIDs:      coalesceStringSlice(req.IndustryIDs),
		ProfessionIDs:    coalesceStringSlice(req.ProfessionIDs),
		BatchID:          emptyStrToNil(req.BatchID),
		Difficulty:       req.Difficulty,
		Version:          req.Version,
		Background:       req.Background,
		DeliveryGoal:     req.DeliveryGoal,
		CoBuilderIDs:     coalesceStringSlice(req.CoBuilderIDs),
	})
	if err != nil {
		respondCoBuildError(w, r, err, "场景方案不存在", "创建共建场景失败")
		return
	}
	respondJSON(w, http.StatusCreated, sc)
}

// UpdateScenario 与 portal 一致的部分更新语义（Nullable* 区分未携带与显式清空）。
func (h *PartnerCoBuildHandler) UpdateScenario(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := h.Service.GetScenario(r.Context(), partnerTenantID, id)
	if err != nil {
		respondCoBuildError(w, r, err, "场景方案不存在", "查询共建场景失败")
		return
	}

	var req UpdateScenarioRequest
	if !decodeBody(w, r, &req) {
		return
	}

	name := req.Name
	if name == "" {
		name = existing.Name
	}
	version := req.Version
	if version == "" {
		version = existing.Version
	}
	difficulty := req.Difficulty
	if difficulty == 0 {
		difficulty = existing.Difficulty
	}
	coBuilderIDs := req.CoBuilderIDs
	if coBuilderIDs == nil {
		coBuilderIDs = existing.CoBuilderIDs
	}

	resolveNullable := func(n NullableString, existing *string) *string {
		if !n.Present {
			return existing
		}
		if n.Value != nil && *n.Value == "" {
			return nil
		}
		return n.Value
	}
	resolveNullableSlice := func(n NullableStringSlice, existing []string) []string {
		if !n.Present {
			return existing
		}
		return coalesceStringSlice(n.Value)
	}

	sc, err := h.Service.UpdateScenario(r.Context(), partnerTenantID, id, &store.ScenarioUpdateParams{
		Name:             name,
		CoverImage:       resolveNullable(req.CoverImage, existing.CoverImage),
		CareerPositionID: resolveNullable(req.CareerPositionID, existing.CareerPositionID),
		IndustryIDs:      resolveNullableSlice(req.IndustryIDs, existing.IndustryIDs),
		ProfessionIDs:    resolveNullableSlice(req.ProfessionIDs, existing.ProfessionIDs),
		BatchID:          resolveNullable(req.BatchID, existing.BatchID),
		Difficulty:       difficulty,
		Version:          version,
		Background:       resolveNullable(req.Background, existing.Background),
		DeliveryGoal:     resolveNullable(req.DeliveryGoal, existing.DeliveryGoal),
		CoBuilderIDs:     coBuilderIDs,
	})
	if err != nil {
		respondCoBuildError(w, r, err, "场景方案不存在", "更新共建场景失败")
		return
	}
	respondJSON(w, http.StatusOK, sc)
}

func (h *PartnerCoBuildHandler) DeleteScenario(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if err := h.Service.DeleteScenario(r.Context(), partnerTenantID, id); err != nil {
		respondCoBuildError(w, r, err, "场景方案不存在", "删除共建场景失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *PartnerCoBuildHandler) SubmitScenario(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, userID, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	sc, err := h.Service.SubmitScenario(r.Context(), partnerTenantID, userID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "场景方案不存在", "提交审核失败")
		return
	}
	respondJSON(w, http.StatusOK, sc)
}

func (h *PartnerCoBuildHandler) WithdrawScenario(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	sc, err := h.Service.WithdrawScenario(r.Context(), partnerTenantID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "场景方案不存在", "撤回审核失败")
		return
	}
	respondJSON(w, http.StatusOK, sc)
}

// ===== 场景任务 =====

func scenarioTaskParams(scenarioID string, tenantID *string, req *CreateScenarioTaskRequest) *store.ScenarioTaskParams {
	return &store.ScenarioTaskParams{
		ScenarioID:          scenarioID,
		Name:                req.Name,
		Code:                req.Code,
		SortOrder:           req.SortOrder,
		Description:         req.Description,
		DetailedDescription: req.DetailedDescription,
		DescriptionPdf:      req.DescriptionPdf,
		EstimatedHours:      req.EstimatedHours,
		TaskType:            req.TaskType,
		Difficulty:          req.Difficulty,
		Background:          req.Background,
		DependencyIDs:       coalesceStringSlice(req.DependencyIDs),
		IsReferenced:        req.IsReferenced,
		SourceScenarioID:    req.SourceScenarioID,
		KnowledgePointIDs:   coalesceStringSlice(req.KnowledgePointIDs),
		AbilityPointIDs:     coalesceStringSlice(req.AbilityPointIDs),
		ResourceIDs:         coalesceStringSlice(req.ResourceIDs),
		EvalData:            jsonMapBytes(req.EvalData),
		TenantID:            tenantID,
	}
}

func (h *PartnerCoBuildHandler) ListTasks(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	items, err := h.Service.ListTasks(r.Context(), partnerTenantID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "场景方案不存在", "查询任务失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ScenarioTask]{Items: items, Total: len(items)})
}

func (h *PartnerCoBuildHandler) CreateTask(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	scenarioID := chi.URLParam(r, "id")
	var req CreateScenarioTaskRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" || req.Code == "" || req.TaskType == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}
	task, err := h.Service.CreateTask(r.Context(), partnerTenantID, scenarioID, scenarioTaskParams(scenarioID, nil, &req))
	if err != nil {
		respondCoBuildError(w, r, err, "场景方案不存在", "创建任务失败")
		return
	}
	respondJSON(w, http.StatusCreated, task)
}

func (h *PartnerCoBuildHandler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	taskID := chi.URLParam(r, "taskId")
	var req CreateScenarioTaskRequest
	if !decodeBody(w, r, &req) {
		return
	}
	// 部分更新兜底：与 portal 端一致，未携带字段回退已有值，
	// 防止全列覆盖把 evalData/难度/依赖等清空
	existing, err := h.Service.GetTask(r.Context(), partnerTenantID, taskID)
	if err != nil {
		respondCoBuildError(w, r, err, "场景任务不存在", "更新任务失败")
		return
	}
	applyTaskPartialUpdate(&req, existing)
	task, err := h.Service.UpdateTask(r.Context(), partnerTenantID, taskID, scenarioTaskParams(req.ScenarioID, nil, &req))
	if err != nil {
		respondCoBuildError(w, r, err, "场景任务不存在", "更新任务失败")
		return
	}
	respondJSON(w, http.StatusOK, task)
}

func (h *PartnerCoBuildHandler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	taskID := chi.URLParam(r, "taskId")
	if err := h.Service.DeleteTask(r.Context(), partnerTenantID, taskID); err != nil {
		respondCoBuildError(w, r, err, "场景任务不存在", "删除任务失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": taskID})
}

// coBuildReorderTasksRequest 任务重排请求（场景由路径确定）。
type coBuildReorderTasksRequest struct {
	TaskIDs []string `json:"taskIds"`
}

func (h *PartnerCoBuildHandler) ReorderTasks(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	var req coBuildReorderTasksRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if err := h.Service.ReorderTasks(r.Context(), partnerTenantID, chi.URLParam(r, "id"), req.TaskIDs); err != nil {
		respondCoBuildError(w, r, err, "场景方案不存在", "重新排序任务失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ===== 任务测评方式 =====

func (h *PartnerCoBuildHandler) GetTaskEvaluationMethods(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	configs, err := h.Service.GetTaskEvaluationMethods(r.Context(), partnerTenantID, chi.URLParam(r, "taskId"))
	if err != nil {
		respondCoBuildError(w, r, err, "场景任务不存在", "查询测评方式失败")
		return
	}
	respondJSON(w, http.StatusOK, TaskEvaluationMethodListResponse{Methods: configs})
}

// PutTaskEvaluationMethods 保存测评方式（请求形状与 portal 一致：version + methods）。
func (h *PartnerCoBuildHandler) PutTaskEvaluationMethods(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, userID, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	var req SaveTaskEvaluationMethodsRequest
	if !decodeBody(w, r, &req) {
		return
	}
	configs, err := h.Service.SaveTaskEvaluationMethods(r.Context(), partnerTenantID, userID, chi.URLParam(r, "taskId"), req.Version, toMethodSaveInputs(&req))
	if err != nil {
		respondCoBuildError(w, r, err, "场景任务不存在", "保存测评方式失败")
		return
	}
	respondJSON(w, http.StatusOK, TaskEvaluationMethodListResponse{Methods: configs})
}

// ===== 学校数据只读列表（编辑器数据源，与 portal 对应接口响应形状一致） =====

func (h *PartnerCoBuildHandler) ListSchoolAbilities(w http.ResponseWriter, r *http.Request) {
	schoolListHandler(h, h.Service.ListSchoolAbilities)(w, r)
}

func (h *PartnerCoBuildHandler) ListSchoolEvaluationMethods(w http.ResponseWriter, r *http.Request) {
	schoolListHandler(h, h.Service.ListSchoolEvaluationMethods)(w, r)
}

// ListSchoolKnowledgePoints 合作学校知识点库只读列表（任务链知识点选择器数据源）。
func (h *PartnerCoBuildHandler) ListSchoolKnowledgePoints(w http.ResponseWriter, r *http.Request) {
	schoolListHandler(h, h.Service.ListSchoolKnowledgePoints)(w, r)
}

// ListSchoolCourses 合作学校课程只读列表（任务链微课程选择器数据源，type=granular）。
func (h *PartnerCoBuildHandler) ListSchoolCourses(w http.ResponseWriter, r *http.Request) {
	schoolListHandler(h, h.Service.ListSchoolCourses)(w, r)
}

// ListSchoolAbilityBindings 合作学校岗位能力绑定只读列表（任务链能力面板数据源）。
func (h *PartnerCoBuildHandler) ListSchoolAbilityBindings(w http.ResponseWriter, r *http.Request) {
	schoolListHandler(h, h.Service.ListSchoolAbilityBindings)(w, r)
}

// ListSchoolQuestionBanks 合作学校题库只读列表（测评题库选择面板数据源）。
func (h *PartnerCoBuildHandler) ListSchoolQuestionBanks(w http.ResponseWriter, r *http.Request) {
	schoolListHandler(h, h.Service.ListSchoolQuestionBanks)(w, r)
}

// ListSchoolQuestions 合作学校题目只读列表（按 bankId 过滤）。
func (h *PartnerCoBuildHandler) ListSchoolQuestions(w http.ResponseWriter, r *http.Request) {
	schoolListHandler(h, h.Service.ListSchoolQuestions)(w, r)
}

// ListSchoolRandomDrawQuestions 合作学校现场问答题只读列表（随机抽题面板数据源）。
func (h *PartnerCoBuildHandler) ListSchoolRandomDrawQuestions(w http.ResponseWriter, r *http.Request) {
	schoolListHandler(h, h.Service.ListSchoolRandomDrawQuestions)(w, r)
}

// ListSchoolExams 合作学校试卷只读列表（测评试卷方法面板数据源）。
func (h *PartnerCoBuildHandler) ListSchoolExams(w http.ResponseWriter, r *http.Request) {
	schoolListHandler(h, h.Service.ListSchoolExams)(w, r)
}

// ListSchoolMajors 合作学校专业字典只读列表（测评编辑专业选择器数据源）。
func (h *PartnerCoBuildHandler) ListSchoolMajors(w http.ResponseWriter, r *http.Request) {
	schoolListHandler(h, h.Service.ListSchoolMajors)(w, r)
}

// ListSchoolScenarios 合作学校场景只读列表（任务克隆候选数据源）。
func (h *PartnerCoBuildHandler) ListSchoolScenarios(w http.ResponseWriter, r *http.Request) {
	schoolListHandler(h, h.Service.ListSchoolScenarios)(w, r)
}

// ListSchoolTasks 合作学校任务只读列表（任务克隆候选数据源）。
func (h *PartnerCoBuildHandler) ListSchoolTasks(w http.ResponseWriter, r *http.Request) {
	schoolListHandler(h, h.Service.ListSchoolTasks)(w, r)
}

// ListSchoolResources 合作学校资源库只读列表（任务链资源选择器数据源）。
func (h *PartnerCoBuildHandler) ListSchoolResources(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	schoolTenantID := chi.URLParam(r, "tenantId")
	limit, offset := parseLimitOffset(r, 50)
	items, total, err := h.Service.ListSchoolResources(r.Context(), partnerTenantID, schoolTenantID,
		r.URL.Query().Get("search"), r.URL.Query().Get("resourceType"), limit, offset)
	respondSchoolScopedList(w, r, items, total, err, "查询学校资源失败")
}

// ListScenarioWeights 共建场景任务权重列表。
func (h *PartnerCoBuildHandler) ListScenarioWeights(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	items, err := h.Service.ListScenarioWeights(r.Context(), partnerTenantID, chi.URLParam(r, "id"))
	if err != nil {
		respondCoBuildError(w, r, err, "场景不存在或未授权", "查询任务权重失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.ScenarioWeightConfig]{Items: items, Total: len(items)})
}

// coBuildSaveWeightsRequest 批量保存任务权重请求。
type coBuildSaveWeightsRequest struct {
	Weights []coBuildWeightItem `json:"weights"`
}

type coBuildWeightItem struct {
	TaskID string  `json:"taskId"`
	Weight float64 `json:"weight"`
}

// SaveScenarioWeights 批量保存共建场景任务权重。
func (h *PartnerCoBuildHandler) SaveScenarioWeights(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	var req coBuildSaveWeightsRequest
	if !decodeBody(w, r, &req) {
		return
	}
	params := make([]store.ScenarioWeightUpsertParams, 0, len(req.Weights))
	for _, item := range req.Weights {
		if item.TaskID == "" {
			respondError(w, http.StatusBadRequest, "缺少任务 id")
			return
		}
		params = append(params, store.ScenarioWeightUpsertParams{TaskID: item.TaskID, Weight: item.Weight})
	}
	if err := h.Service.SaveScenarioWeights(r.Context(), partnerTenantID, chi.URLParam(r, "id"), params); err != nil {
		respondCoBuildError(w, r, err, "场景不存在或未授权", "保存任务权重失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ListSchoolCoBuilders 合作学校共建人候选（岗位编辑页共建人选择器数据源）：
// 学校教师 + 企业专家（与 portal 共建导师选择器同源，仅返回绑定账号者）。
func (h *PartnerCoBuildHandler) ListSchoolCoBuilders(w http.ResponseWriter, r *http.Request) {
	partnerTenantID, _, ok := h.partnerCaller(w, r)
	if !ok {
		return
	}
	schoolTenantID := chi.URLParam(r, "tenantId")
	items, err := h.Service.ListSchoolCoBuilders(r.Context(), partnerTenantID, schoolTenantID)
	if err != nil {
		respondCoBuildError(w, r, err, "学校不存在", "查询共建人候选失败")
		return
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.CoBuildUserOption]{Items: items, Total: len(items)})
}
