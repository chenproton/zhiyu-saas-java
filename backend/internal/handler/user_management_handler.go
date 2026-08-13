package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/mask"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

type UserManagementHandler struct {
	Service *service.UserService
}
type CreateUserRequest struct {
	TenantID      string              `json:"tenantId"`
	InstitutionID *string             `json:"institutionId"`
	OrgNodeID     *string             `json:"orgNodeId"`
	MajorID       *string             `json:"majorId"`
	Role          *string             `json:"role"`
	RoleID        *string             `json:"roleId"`
	Platform      domain.UserPlatform `json:"platform"`
	Username      string              `json:"username"`
	LoginName     *string             `json:"loginName"`
	Password      string              `json:"password"`
	Name          string              `json:"name"`
	Email         *string             `json:"email"`
	Phone         *string             `json:"phone"`
	AvatarURL     *string             `json:"avatarUrl"`
	StudentNo     *string             `json:"studentNo"`
	WorkID        *string             `json:"workId"`
	IDCard        *string             `json:"idCard"`
	TitleIDs      []string            `json:"titleIds"`
}

type UpdateUserRequest struct {
	InstitutionID *string  `json:"institutionId"`
	OrgNodeID     *string  `json:"orgNodeId"`
	MajorID       *string  `json:"majorId"`
	Role          *string  `json:"role"`
	RoleID        *string  `json:"roleId"`
	Username      string   `json:"username"`
	LoginName     *string  `json:"loginName"`
	Name          string   `json:"name"`
	Email         *string  `json:"email"`
	Phone         *string  `json:"phone"`
	AvatarURL     *string  `json:"avatarUrl"`
	StudentNo     *string  `json:"studentNo"`
	WorkID        *string  `json:"workId"`
	IDCard        *string  `json:"idCard"`
	TitleIDs      []string `json:"titleIds"`
}

type UpdateUserStatusRequest struct {
	Status string `json:"status"`
}

type BatchCreateUserRequest struct {
	Users []CreateUserRequest `json:"users"`
}

type ResetPasswordRequest struct {
	Password string `json:"password"`
}

type BatchGraduateRequest struct {
	UserIDs      []string `json:"userIds"`
	GraduateYear *int     `json:"graduateYear"`
}

type BatchDeleteUsersRequest struct {
	UserIDs []string `json:"userIds"`
}

type BatchUpdateOrgNodeRequest struct {
	UserIDs   []string `json:"userIds"`
	OrgNodeID *string  `json:"orgNodeId"`
}

type BindUserRolesRequest struct {
	RoleIDs []string `json:"roleIds"`
}

type UpdateMeRequest struct {
	Name string `json:"name"`
}

type ChangeMyPasswordRequest struct {
	NewPassword string `json:"newPassword"`
}

// UpdateMe 用户自助修改本人姓名（个人中心），仅允许修改当前登录用户自身。
func (h *UserManagementHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.UserID == "" {
		respondError(w, http.StatusUnauthorized, "未登录或登录已过期")
		return
	}

	var req UpdateMeRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, "姓名不能为空")
		return
	}

	if err := h.Service.UpdateSelfName(r.Context(), claims.UserID, req.Name); err != nil {
		respondServerError(w, r, err, "更新姓名失败")
		return
	}

	user, err := h.Service.Get(r.Context(), tenantIDOf(claims), claims.UserID)
	if err != nil {
		respondServerError(w, r, err, "更新后查询用户失败")
		return
	}
	user.PasswordHash = ""
	respondJSON(w, http.StatusOK, user)
}

// ChangeMyPassword 用户自助修改本人密码（个人中心），无需校验旧密码。
func (h *UserManagementHandler) ChangeMyPassword(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.UserID == "" {
		respondError(w, http.StatusUnauthorized, "未登录或登录已过期")
		return
	}

	var req ChangeMyPasswordRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.NewPassword == "" {
		respondError(w, http.StatusBadRequest, "密码不能为空")
		return
	}
	if !isStrongPassword(req.NewPassword) {
		respondError(w, http.StatusBadRequest, "密码长度至少 8 位，且需同时包含字母和数字")
		return
	}

	if err := h.Service.ResetPassword(r.Context(), claims.UserID, req.NewPassword); err != nil {
		respondServerError(w, r, err, "修改密码失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": claims.UserID})
}

func (h *UserManagementHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg := h.Service.Store().Users().ListConfig()
	params, ok := listParamsFromRequest(r, true)
	if !ok {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	items, total, err := h.Service.List(r.Context(), params, cfg)
	if err != nil {
		respondServerError(w, r, err, "查询用户列表失败")
		return
	}
	// 批量场景脱敏：教师等业务角色翻页拉取全租户用户时，
	// 手机号/邮箱/身份证/学号工号统一掩码；OAuth 凭据一律不下发
	manageUsers := canManageUsers(r)
	for i := range items {
		mask.User(manageUsers, &items[i])
		items[i].Oauth = nil
	}
	respondJSON(w, http.StatusOK, ListResponse[domain.User]{Items: items, Total: total})
}

func (h *UserManagementHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	user, err := h.Service.Get(r.Context(), tenantID, id)
	if err != nil {
		respondError(w, http.StatusNotFound, "用户不存在")
		return
	}
	if user.TenantID == nil || !verifyTenantOwnership(w, r, *user.TenantID) {
		return
	}
	user.PasswordHash = ""
	// 详情保留脱敏后的敏感字段供编辑回显，OAuth 凭据不随详情下发
	user.Oauth = nil
	// 敏感信息脱敏：仅系统管理角色可见完整手机号/身份证/学号工号
	mask.User(canManageUsers(r), user)
	respondJSON(w, http.StatusOK, user)
}

func (h *UserManagementHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req CreateUserRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Platform == "" && claims != nil {
		req.Platform = claims.Platform
	}
	if req.TenantID == "" && claims != nil && claims.TenantID != nil {
		req.TenantID = *claims.TenantID
	}
	if req.InstitutionID == nil && claims != nil && claims.InstitutionID != nil {
		req.InstitutionID = claims.InstitutionID
	}
	if !verifyRequestTenant(w, r, req.TenantID) {
		return
	}
	if req.TenantID == "" || req.Username == "" || req.Password == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	params := &store.UserCreateParams{
		TenantID:      req.TenantID,
		InstitutionID: req.InstitutionID,
		OrgNodeID:     req.OrgNodeID,
		MajorID:       req.MajorID,
		Role:          roleOrEmpty(req.Role, string(domain.UserRoleSchool)),
		RoleID:        strOrEmpty(req.RoleID),
		Platform:      string(req.Platform),
		Username:      req.Username,
		LoginName:     strOrEmpty(req.LoginName),
		Password:      req.Password,
		Name:          req.Name,
		Email:         req.Email,
		Phone:         req.Phone,
		AvatarURL:     req.AvatarURL,
		StudentNo:     req.StudentNo,
		WorkID:        req.WorkID,
		IDCard:        req.IDCard,
		TitleIDs:      req.TitleIDs,
	}

	user, err := h.Service.Create(r.Context(), params)
	if err != nil {
		slog.Error("createSingleUser failed", "error", err, "tenantId", req.TenantID, "roleId", req.RoleID, "username", req.Username)
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "用户名已存在，请使用其他用户名")
			return
		}
		respondServerError(w, r, err, "创建用户失败")
		return
	}
	user.PasswordHash = ""
	respondJSON(w, http.StatusCreated, user)
}

func (h *UserManagementHandler) Update(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	oldUser, err := h.Service.Get(r.Context(), tenantID, id)
	if err != nil {
		respondError(w, http.StatusNotFound, "用户不存在")
		return
	}
	if oldUser.TenantID == nil || !verifyTenantOwnership(w, r, *oldUser.TenantID) {
		return
	}

	var req UpdateUserRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "缺少必填字段")
		return
	}

	role := roleOrEmpty(req.Role, string(oldUser.Role))
	rawLoginName := req.Username
	if req.LoginName != nil && *req.LoginName != "" {
		rawLoginName = *req.LoginName
	}
	globalLoginName := ""
	if oldUser.TenantID != nil {
		globalLoginName = *oldUser.TenantID + "_" + rawLoginName
	}

	params := &store.UserUpdateParams{
		ID:              id,
		InstitutionID:   req.InstitutionID,
		OrgNodeID:       req.OrgNodeID,
		MajorID:         req.MajorID,
		Role:            role,
		GlobalLoginName: globalLoginName,
		Username:        rawLoginName,
		Name:            req.Name,
		Email:           req.Email,
		Phone:           req.Phone,
		AvatarURL:       req.AvatarURL,
		StudentNo:       req.StudentNo,
		WorkID:          req.WorkID,
		IDCard:          req.IDCard,
		TitleIDs:        req.TitleIDs,
	}

	err = h.Service.Update(r.Context(), id, *oldUser.TenantID, params, strOrEmpty(req.RoleID))
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "用户名已存在，请使用其他用户名")
			return
		}
		respondServerError(w, r, err, "更新用户失败")
		return
	}

	user, err := h.Service.Get(r.Context(), tenantID, id)
	if err != nil {
		respondServerError(w, r, err, "查询用户失败")
		return
	}
	user.PasswordHash = ""
	respondJSON(w, http.StatusOK, user)
}

func (h *UserManagementHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	user, err := h.Service.Get(r.Context(), tenantID, id)
	if err != nil {
		respondError(w, http.StatusNotFound, "用户不存在")
		return
	}
	if user.TenantID == nil || !verifyTenantOwnership(w, r, *user.TenantID) {
		return
	}

	if err := h.Service.Delete(r.Context(), tenantID, id); err != nil {
		if isForeignKeyViolation(err) {
			respondError(w, http.StatusConflict, "该用户已被教学计划或排课引用，请先解除关联")
			return
		}
		respondServerError(w, r, err, "删除用户失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *UserManagementHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	user, err := h.Service.Get(r.Context(), tenantID, id)
	if err != nil {
		respondError(w, http.StatusNotFound, "用户不存在")
		return
	}
	if user.TenantID == nil || !verifyTenantOwnership(w, r, *user.TenantID) {
		return
	}

	var req UpdateUserStatusRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Status != "active" && req.Status != "disabled" && req.Status != "graduated" {
		respondError(w, http.StatusBadRequest, "无效状态")
		return
	}

	if err := h.Service.UpdateStatus(r.Context(), id, req.Status); err != nil {
		respondServerError(w, r, err, "更新状态失败")
		return
	}

	user, err = h.Service.Get(r.Context(), tenantID, id)
	if err != nil {
		respondServerError(w, r, err, "更新后查询用户失败")
		return
	}
	user.PasswordHash = ""
	respondJSON(w, http.StatusOK, user)
}

func (h *UserManagementHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	user, err := h.Service.Get(r.Context(), tenantID, id)
	if err != nil {
		respondError(w, http.StatusNotFound, "用户不存在")
		return
	}
	if user.TenantID == nil || !verifyTenantOwnership(w, r, *user.TenantID) {
		return
	}

	var req ResetPasswordRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.Password == "" {
		respondError(w, http.StatusBadRequest, "密码不能为空")
		return
	}
	if !isStrongPassword(req.Password) {
		respondError(w, http.StatusBadRequest, "密码长度至少 8 位，且需同时包含字母和数字")
		return
	}

	if err := h.Service.ResetPassword(r.Context(), id, req.Password); err != nil {
		respondServerError(w, r, err, "重置密码失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *UserManagementHandler) BatchCreate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	var req BatchCreateUserRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.Users) == 0 {
		respondError(w, http.StatusBadRequest, "用户列表不能为空")
		return
	}

	params := make([]*store.UserCreateParams, 0, len(req.Users))
	for _, u := range req.Users {
		if u.Platform == "" && claims != nil {
			u.Platform = claims.Platform
		}
		if u.TenantID == "" && claims != nil && claims.TenantID != nil {
			u.TenantID = *claims.TenantID
		}
		if u.InstitutionID == nil && claims != nil && claims.InstitutionID != nil {
			u.InstitutionID = claims.InstitutionID
		}
		if !verifyRequestTenant(w, r, u.TenantID) {
			return
		}
		params = append(params, &store.UserCreateParams{
			TenantID:      u.TenantID,
			InstitutionID: u.InstitutionID,
			OrgNodeID:     u.OrgNodeID,
			MajorID:       u.MajorID,
			Role:          roleOrEmpty(u.Role, string(domain.UserRoleSchool)),
			RoleID:        strOrEmpty(u.RoleID),
			Platform:      string(u.Platform),
			Username:      u.Username,
			LoginName:     strOrEmpty(u.LoginName),
			Password:      u.Password,
			Name:          u.Name,
			Email:         u.Email,
			Phone:         u.Phone,
			AvatarURL:     u.AvatarURL,
			StudentNo:     u.StudentNo,
			WorkID:        u.WorkID,
			IDCard:        u.IDCard,
			TitleIDs:      u.TitleIDs,
		})
	}

	created, err := h.Service.BatchCreate(r.Context(), params)
	if err != nil {
		if isUniqueViolation(err) {
			respondError(w, http.StatusConflict, "用户名已存在，请使用其他用户名")
			return
		}
		respondServerError(w, r, err, "批量创建用户失败")
		return
	}
	// 响应不下发密码哈希/证件号等敏感字段
	for i := range created {
		created[i].PasswordHash = ""
		created[i].IDCard = nil
		created[i].Oauth = nil
	}
	respondJSON(w, http.StatusCreated, ListResponse[domain.User]{Items: created, Total: len(created)})
}

func (h *UserManagementHandler) BatchGraduate(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	callerTenantID := *claims.TenantID

	var req BatchGraduateRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.UserIDs) == 0 {
		respondError(w, http.StatusBadRequest, "缺少用户ID列表")
		return
	}
	for _, id := range req.UserIDs {
		if _, err := uuid.Parse(id); err != nil {
			respondError(w, http.StatusBadRequest, "无效用户ID: "+id)
			return
		}
	}

	graduateYear := time.Now().Year()
	if req.GraduateYear != nil {
		graduateYear = *req.GraduateYear
	}

	if err := h.Service.BatchGraduate(r.Context(), callerTenantID, req.UserIDs, graduateYear); err != nil {
		respondServerError(w, r, err, "批量毕业操作失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]int{"count": len(req.UserIDs)})
}

func (h *UserManagementHandler) BatchDelete(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	callerTenantID := *claims.TenantID

	var req BatchDeleteUsersRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.UserIDs) == 0 {
		respondError(w, http.StatusBadRequest, "缺少用户ID列表")
		return
	}
	for _, id := range req.UserIDs {
		if _, err := uuid.Parse(id); err != nil {
			respondError(w, http.StatusBadRequest, "无效用户ID: "+id)
			return
		}
	}

	count, err := h.Service.BatchDelete(r.Context(), callerTenantID, req.UserIDs)
	if err != nil {
		if isForeignKeyViolation(err) {
			respondError(w, http.StatusConflict, "部分用户已被教学计划或排课引用，请先解除关联")
			return
		}
		respondServerError(w, r, err, "批量删除用户失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]int64{"count": count})
}

func (h *UserManagementHandler) BatchUpdateOrgNode(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}
	claims := middleware.CurrentUser(r)
	if claims == nil || claims.TenantID == nil || *claims.TenantID == "" {
		respondError(w, http.StatusForbidden, "缺少租户信息")
		return
	}
	callerTenantID := *claims.TenantID

	var req BatchUpdateOrgNodeRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if len(req.UserIDs) == 0 {
		respondError(w, http.StatusBadRequest, "缺少用户ID列表")
		return
	}
	for _, id := range req.UserIDs {
		if _, err := uuid.Parse(id); err != nil {
			respondError(w, http.StatusBadRequest, "无效用户ID: "+id)
			return
		}
	}

	count, err := h.Service.BatchUpdateOrgNode(r.Context(), callerTenantID, req.UserIDs, req.OrgNodeID)
	if err != nil {
		if errors.Is(err, service.ErrOrgNodeInvalid) {
			respondError(w, http.StatusBadRequest, "无效机构节点ID")
			return
		}
		respondServerError(w, r, err, "更新用户机构绑定失败")
		return
	}
	respondJSON(w, http.StatusOK, map[string]int64{"count": count})
}

func (h *UserManagementHandler) BindRoles(w http.ResponseWriter, r *http.Request) {
	if !canManageUsers(r) {
		respondError(w, http.StatusForbidden, "权限不足")
		return
	}

	id := chi.URLParam(r, "id")
	tenantID, ok := requireTenant(w, r)
	if !ok {
		return
	}
	user, err := h.Service.Get(r.Context(), tenantID, id)
	if err != nil {
		respondError(w, http.StatusNotFound, "用户不存在")
		return
	}
	if user.TenantID == nil || !verifyTenantOwnership(w, r, *user.TenantID) {
		return
	}

	var req BindUserRolesRequest
	if !decodeBody(w, r, &req) {
		return
	}
	roleIDs := uniqueStrings(req.RoleIDs)
	if len(roleIDs) == 0 {
		respondError(w, http.StatusBadRequest, "至少需要绑定一个角色")
		return
	}

	err = h.Service.BindRoles(r.Context(), id, roleIDs, *user.TenantID)
	if err != nil {
		if errors.Is(err, service.ErrInvalidRoles) {
			respondError(w, http.StatusBadRequest, "存在无效角色或角色不属于当前租户")
			return
		}
		respondServerError(w, r, err, "绑定角色失败")
		return
	}

	updated, err := h.Service.Get(r.Context(), tenantID, id)
	if err != nil {
		respondServerError(w, r, err, "查询用户失败")
		return
	}
	h.Service.AttachRoles(r.Context(), updated)
	updated.PasswordHash = ""
	respondJSON(w, http.StatusOK, updated)
}

func roleOrEmpty(v *string, fallback string) string {
	if v != nil {
		switch *v {
		case string(domain.UserRoleSchool), string(domain.UserRoleEnterprise), string(domain.UserRoleOperator):
			return *v
		}
	}
	if fallback != "" {
		return fallback
	}
	return string(domain.UserRoleSchool)
}

func strOrEmpty(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func uniqueStrings(items []string) []string {
	seen := make(map[string]struct{}, len(items))
	out := make([]string, 0, len(items))
	for _, s := range items {
		if s == "" {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}
