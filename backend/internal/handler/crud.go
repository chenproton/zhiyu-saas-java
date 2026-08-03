package handler

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

// crudConfig 描述一个租户域字典实体 Create/Get/Update/Delete 的行为差异；
// HTTP 流程骨架（鉴权 → decode → 校验 → store → 回读 → 响应）由 crudCreate/crudGet/
// crudUpdate/crudDelete 统一实现。各实体的响应状态码/JSON 形状/错误文案与原手写实现逐一对应。
// T 为合并后的请求类型（创建/更新字段一致，创建时多余的 tenantId 在更新流程中被忽略），
// V 为回读/详情响应的领域实体类型。
type crudConfig[T any, V any] struct {
	NotFoundMsg  string
	CreateErrMsg string
	UpdateErrMsg string
	DeleteErrMsg string
	// DeleteCheckErrMsg 删除前引用检查失败（非冲突）时的 500 文案。
	DeleteCheckErrMsg string

	// Permit 追加鉴权函数；nil 表示仅需登录。不满足时响应 403。
	Permit func(r *http.Request) bool
	// PermitGet/PermitUpdate/PermitDelete 各操作独立鉴权；未设置时回退 Permit。
	PermitGet    func(r *http.Request) bool
	PermitUpdate func(r *http.Request) bool
	PermitDelete func(r *http.Request) bool
	// UniqueViolationMsg 非空时，Create/Update 遇唯一键冲突响应 409 并返回该文案。
	UniqueViolationMsg string
	// CheckOwnership 为 true 时，Update/Delete 校验实体租户归属（403）。
	CheckOwnership bool
	// GetOwnership 为 true 时，Get 校验实体租户归属（403）。
	GetOwnership bool

	ValidateCreate func(t *T) string
	// CreateTenantFn 解析创建时所属租户并校验权限；ok=false 时已写入错误响应。
	CreateTenantFn func(w http.ResponseWriter, r *http.Request, t *T) (tenantID string, ok bool)
	PrepareCreate  func(t *T, tenantID, userID string)
	ValidateUpdate func(t *T) string
	// ValidateUpdateExisting 更新时在 decode 后执行的校验/归一化钩子，可读取已存在实体
	// （如根据现有状态补默认值）。返回非空消息时响应 400。
	ValidateUpdateExisting func(t *T, existing *V) string
	CreateFn               func(ctx context.Context, t *T, tenantID, userID string) (string, error)
	UpdateFn               func(ctx context.Context, id, tenantID string, t *T) error
	DeleteFn               func(ctx context.Context, id, tenantID string) error
	GetByIDFn              func(ctx context.Context, id, tenantID string) (V, error)
	// TenantFn 解析当前请求租户（仅 GetByIDFn 需要租户过滤的实体设置，如联盟实体）；
	// ok=false 时已写入错误响应。未设置时 tenantID 为空串。
	TenantFn func(w http.ResponseWriter, r *http.Request) (tenantID string, ok bool)
	// TenantIDFn 返回实体所属租户，用于归属校验；nil 时跳过。
	TenantIDFn func(t *V) string
	// AfterLoad 详情/更新回读后补充数据（如 userCount）；创建回读不执行，与原实现一致。
	AfterLoad func(ctx context.Context, t *V) error
	// DeleteChecks 删除前检查：返回非空消息时响应 409 阻止删除。
	DeleteChecks []func(ctx context.Context, t *V) (blockedMsg string, err error)
}

func crudCheckPermit(w http.ResponseWriter, r *http.Request, permit func(r *http.Request) bool) bool {
	claims := middleware.CurrentUser(r)
	if claims == nil || (permit != nil && !permit(r)) {
		respondError(w, http.StatusForbidden, "权限不足")
		return false
	}
	return true
}

func crudCreate[T any, V any](w http.ResponseWriter, r *http.Request, cfg crudConfig[T, V]) {
	if !crudCheckPermit(w, r, cfg.Permit) {
		return
	}
	var body T
	if !decodeBody(w, r, &body) {
		return
	}
	if cfg.ValidateCreate != nil {
		if msg := cfg.ValidateCreate(&body); msg != "" {
			respondError(w, http.StatusBadRequest, msg)
			return
		}
	}
	tenantID, ok := cfg.CreateTenantFn(w, r, &body)
	if !ok {
		return
	}
	userID := middleware.CurrentUser(r).UserID
	if cfg.PrepareCreate != nil {
		cfg.PrepareCreate(&body, tenantID, userID)
	}
	id, err := cfg.CreateFn(r.Context(), &body, tenantID, userID)
	if err != nil {
		if cfg.UniqueViolationMsg != "" && isUniqueViolation(err) {
			respondError(w, http.StatusConflict, cfg.UniqueViolationMsg)
			return
		}
		respondServerError(w, r, err, cfg.CreateErrMsg)
		return
	}
	item, _ := cfg.GetByIDFn(r.Context(), id, tenantID)
	respondJSON(w, http.StatusCreated, item)
}

func crudGet[T any, V any](w http.ResponseWriter, r *http.Request, cfg crudConfig[T, V]) {
	permit := cfg.Permit
	if cfg.PermitGet != nil {
		permit = cfg.PermitGet
	}
	if !crudCheckPermit(w, r, permit) {
		return
	}
	id := chi.URLParam(r, "id")
	tenantID := ""
	if cfg.TenantFn != nil {
		var ok bool
		tenantID, ok = cfg.TenantFn(w, r)
		if !ok {
			return
		}
	}
	item, err := cfg.GetByIDFn(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, cfg.NotFoundMsg)
		return
	}
	if cfg.GetOwnership && cfg.TenantIDFn != nil && !verifyTenantOwnership(w, r, cfg.TenantIDFn(&item)) {
		return
	}
	if cfg.AfterLoad != nil {
		if err := cfg.AfterLoad(r.Context(), &item); err != nil {
			respondServerError(w, r, err, "查询失败")
			return
		}
	}
	respondJSON(w, http.StatusOK, item)
}

func crudUpdate[T any, V any](w http.ResponseWriter, r *http.Request, cfg crudConfig[T, V]) {
	permit := cfg.Permit
	if cfg.PermitUpdate != nil {
		permit = cfg.PermitUpdate
	}
	if !crudCheckPermit(w, r, permit) {
		return
	}
	id := chi.URLParam(r, "id")
	tenantID := ""
	if cfg.TenantFn != nil {
		var ok bool
		tenantID, ok = cfg.TenantFn(w, r)
		if !ok {
			return
		}
	}
	existing, err := cfg.GetByIDFn(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, cfg.NotFoundMsg)
		return
	}
	if cfg.CheckOwnership && cfg.TenantIDFn != nil && !verifyTenantOwnership(w, r, cfg.TenantIDFn(&existing)) {
		return
	}
	var body T
	if !decodeBody(w, r, &body) {
		return
	}
	if cfg.ValidateUpdate != nil {
		if msg := cfg.ValidateUpdate(&body); msg != "" {
			respondError(w, http.StatusBadRequest, msg)
			return
		}
	}
	if cfg.ValidateUpdateExisting != nil {
		if msg := cfg.ValidateUpdateExisting(&body, &existing); msg != "" {
			respondError(w, http.StatusBadRequest, msg)
			return
		}
	}
	if err := cfg.UpdateFn(r.Context(), id, tenantID, &body); err != nil {
		if cfg.UniqueViolationMsg != "" && isUniqueViolation(err) {
			respondError(w, http.StatusConflict, cfg.UniqueViolationMsg)
			return
		}
		respondServerError(w, r, err, cfg.UpdateErrMsg)
		return
	}
	item, _ := cfg.GetByIDFn(r.Context(), id, tenantID)
	if cfg.AfterLoad != nil {
		if err := cfg.AfterLoad(r.Context(), &item); err != nil {
			respondServerError(w, r, err, "查询失败")
			return
		}
	}
	respondJSON(w, http.StatusOK, item)
}

func crudDelete[T any, V any](w http.ResponseWriter, r *http.Request, cfg crudConfig[T, V]) {
	permit := cfg.Permit
	if cfg.PermitDelete != nil {
		permit = cfg.PermitDelete
	}
	if !crudCheckPermit(w, r, permit) {
		return
	}
	id := chi.URLParam(r, "id")
	tenantID := ""
	if cfg.TenantFn != nil {
		var ok bool
		tenantID, ok = cfg.TenantFn(w, r)
		if !ok {
			return
		}
	}
	existing, err := cfg.GetByIDFn(r.Context(), id, tenantID)
	if err != nil {
		respondError(w, http.StatusNotFound, cfg.NotFoundMsg)
		return
	}
	if cfg.CheckOwnership && cfg.TenantIDFn != nil && !verifyTenantOwnership(w, r, cfg.TenantIDFn(&existing)) {
		return
	}
	for _, check := range cfg.DeleteChecks {
		blockedMsg, checkErr := check(r.Context(), &existing)
		if checkErr != nil {
			respondServerError(w, r, checkErr, cfg.DeleteCheckErrMsg)
			return
		}
		if blockedMsg != "" {
			respondError(w, http.StatusConflict, blockedMsg)
			return
		}
	}
	if err := cfg.DeleteFn(r.Context(), id, tenantID); err != nil {
		respondServerError(w, r, err, cfg.DeleteErrMsg)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}
