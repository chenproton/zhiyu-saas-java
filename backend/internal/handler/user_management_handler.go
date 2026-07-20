package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"golang.org/x/crypto/bcrypt"
)

type UserManagementHandler struct {
	DB *pgxpool.Pool
}

type UserListResponse struct {
	Items []domain.User `json:"items"`
	Total int           `json:"total"`
}

type CreateUserRequest struct {
	TenantID      string              `json:"tenantId"`
	InstitutionID *string             `json:"institutionId"`
	RoleID        *string             `json:"roleId"`
	OrgNodeID     *string             `json:"orgNodeId"`
	MajorID       *string             `json:"majorId"`
	Username      string              `json:"username"`
	LoginName     *string             `json:"loginName"`
	Password      string              `json:"password"`
	Name          string              `json:"name"`
	Email         string              `json:"email"`
	Phone         *string             `json:"phone"`
	AvatarURL     *string             `json:"avatarUrl"`
	StudentNo     *string             `json:"studentNo"`
	WorkID        *string             `json:"workId"`
	IDCard        *string             `json:"idCard"`
	TitleIDs      []string            `json:"titleIds"`
	Role          *string             `json:"role"`
	Platform      domain.UserPlatform `json:"platform"`
}

type UpdateUserRequest struct {
	InstitutionID *string  `json:"institutionId"`
	RoleID        *string  `json:"roleId"`
	OrgNodeID     *string  `json:"orgNodeId"`
	MajorID       *string  `json:"majorId"`
	Username      string   `json:"username"`
	LoginName     *string  `json:"loginName"`
	Name          string   `json:"name"`
	Email         string   `json:"email"`
	Phone         *string  `json:"phone"`
	AvatarURL     *string  `json:"avatarUrl"`
	StudentNo     *string  `json:"studentNo"`
	WorkID        *string  `json:"workId"`
	IDCard        *string  `json:"idCard"`
	TitleIDs      []string `json:"titleIds"`
	Role          *string  `json:"role"`
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

type BindUserRolesRequest struct {
	RoleIDs []string `json:"roleIds"`
}

func (h *UserManagementHandler) canManageUsers(r *http.Request) bool {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		return false
	}
	return canManagePortal(claims)
}

func (h *UserManagementHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := r.URL.Query().Get("tenantId")
	institutionID := r.URL.Query().Get("institutionId")
	roleID := r.URL.Query().Get("roleId")
	roleCode := r.URL.Query().Get("roleCode")
	orgNodeID := r.URL.Query().Get("orgNodeId")
	status := r.URL.Query().Get("status")
	search := r.URL.Query().Get("search")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0
	if v, err := parseInt(limitStr, 50); err == nil && v > 0 {
		limit = v
	}
	if v, err := parseInt(offsetStr, 0); err == nil && v >= 0 {
		offset = v
	}

	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1
	tenantClaims := middleware.CurrentUser(r)
	effectiveTenantID, ok := tenantFilter(tenantClaims)
	if !ok {
		respondError(w, http.StatusForbidden, "missing tenant")
		return
	}
	if effectiveTenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, effectiveTenantID)
		argIdx++
	}

	if tenantID != "" {
		where = append(where, "tenant_id = $"+itoa(argIdx))
		args = append(args, tenantID)
		argIdx++
	}
	if institutionID != "" {
		where = append(where, "institution_id = $"+itoa(argIdx))
		args = append(args, institutionID)
		argIdx++
	}
	if roleID != "" {
		where = append(where, "EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = users.id AND ur.role_id = $"+itoa(argIdx)+")")
		args = append(args, roleID)
		argIdx++
	}
	if roleCode != "" {
		where = append(where, "EXISTS (SELECT 1 FROM user_roles ur JOIN roles r2 ON r2.id = ur.role_id WHERE ur.user_id = users.id AND r2.code = $"+itoa(argIdx)+")")
		args = append(args, roleCode)
		argIdx++
	}
	if orgNodeID != "" {
		where = append(where, "org_node_id = $"+itoa(argIdx))
		args = append(args, orgNodeID)
		argIdx++
	}
	if status != "" {
		where = append(where, "status = $"+itoa(argIdx))
		args = append(args, status)
		argIdx++
	}
	if search != "" {
		where = append(where, "(username ILIKE $"+itoa(argIdx)+" OR name ILIKE $"+itoa(argIdx)+" OR email ILIKE $"+itoa(argIdx)+")")
		args = append(args, "%"+search+"%")
		argIdx++
	}

	countQuery := "SELECT COUNT(*) FROM users WHERE " + strings.Join(where, " AND ")
	var total int
	_ = h.DB.QueryRow(r.Context(), countQuery, args...).Scan(&total)

	query := `
		SELECT id, tenant_id, institution_id, org_node_id, major_id,
			role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
			student_no, work_id, id_card, title_ids, oauth, status, graduate_year, last_login_at, created_at, updated_at
		FROM users
		WHERE ` + strings.Join(where, " AND ") + `
		ORDER BY created_at DESC
		LIMIT $` + itoa(argIdx) + ` OFFSET $` + itoa(argIdx+1)
	args = append(args, limit, offset)

	rows, err := h.DB.Query(r.Context(), query, args...)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	defer rows.Close()

	items, err := h.scanUserRows(rows)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to scan users")
		return
	}
	h.attachUserRoles(r.Context(), items)

	respondJSON(w, http.StatusOK, UserListResponse{Items: items, Total: total})
}

func (h *UserManagementHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	user, err := h.fetchUser(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "user not found")
		return
	}
	user.PasswordHash = ""
	respondJSON(w, http.StatusOK, user)
}

func (h *UserManagementHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
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

	if req.TenantID == "" || req.Username == "" || req.Password == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	user, err := h.createSingleUser(r.Context(), req)
	if err != nil {
		log.Printf("ERROR createSingleUser: %v, req: tenantId=%s roleId=%v username=%s platform=%s",
			err, req.TenantID, req.RoleID, req.Username, req.Platform)
		respondError(w, http.StatusInternalServerError, "failed to create user")
		return
	}
	user.PasswordHash = ""
	respondJSON(w, http.StatusCreated, user)
}

func (h *UserManagementHandler) Update(w http.ResponseWriter, r *http.Request) {
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	oldUser, err := h.fetchUser(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "user not found")
		return
	}

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Username == "" || req.Name == "" {
		respondError(w, http.StatusBadRequest, "missing required fields")
		return
	}

	role := h.resolveRole(req.Role, oldUser.Role)

	rawLoginName := req.Username
	if req.LoginName != nil && *req.LoginName != "" {
		rawLoginName = *req.LoginName
	}
	globalLoginName := ""
	if oldUser.TenantID != nil {
		globalLoginName = *oldUser.TenantID + "_" + rawLoginName
	}

	_, err = h.DB.Exec(r.Context(), `
		UPDATE users SET institution_id = $1, org_node_id = $2, major_id = $3,
			role = $4, login_name = $5, username = $6, name = $7, email = $8, phone = $9, avatar_url = $10,
			student_no = $11, work_id = $12, id_card = $13, title_ids = $14, updated_at = NOW()
		WHERE id = $15
	`, req.InstitutionID, req.OrgNodeID, req.MajorID,
		role, globalLoginName, rawLoginName, req.Name, req.Email, req.Phone, req.AvatarURL,
		req.StudentNo, req.WorkID, req.IDCard, coalesceStringSlice(req.TitleIDs), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update user")
		return
	}

	if req.RoleID != nil && *req.RoleID != "" {
		if err := h.rebindUserRole(r.Context(), id, *req.RoleID, oldUser.TenantID); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to bind role")
			return
		}
	}

	user, _ := h.fetchUser(r.Context(), id)
	user.PasswordHash = ""
	respondJSON(w, http.StatusOK, user)
}

func (h *UserManagementHandler) Delete(w http.ResponseWriter, r *http.Request) {
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	user, err := h.fetchUser(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "user not found")
		return
	}

	_ = user
	h.decRoleCountsForUser(r.Context(), id)

	_, err = h.DB.Exec(r.Context(), `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete user")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *UserManagementHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchUser(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "user not found")
		return
	}

	var req UpdateUserStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Status != "active" && req.Status != "inactive" && req.Status != "disabled" && req.Status != "graduated" {
		respondError(w, http.StatusBadRequest, "invalid status")
		return
	}

	_, err := h.DB.Exec(r.Context(), `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`, req.Status, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to update status")
		return
	}

	user, _ := h.fetchUser(r.Context(), id)
	user.PasswordHash = ""
	respondJSON(w, http.StatusOK, user)
}

func (h *UserManagementHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	if _, err := h.fetchUser(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, "user not found")
		return
	}

	var req ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Password == "" {
		respondError(w, http.StatusBadRequest, "password is required")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	_, err = h.DB.Exec(r.Context(), `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, string(hash), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to reset password")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"id": id})
}

func (h *UserManagementHandler) BatchCreate(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req BatchCreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.Users) == 0 {
		respondError(w, http.StatusBadRequest, "empty user list")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	created := make([]domain.User, 0, len(req.Users))
	seen := make(map[string]bool, len(req.Users))
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
		if u.TenantID == "" || u.Username == "" || u.Password == "" || u.Name == "" {
			continue
		}
		dedupKey := u.TenantID + ":" + string(u.Platform) + ":" + u.Username
		if seen[dedupKey] {
			continue
		}
		seen[dedupKey] = true
		user, err := h.createSingleUserInTx(r.Context(), tx, u)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "failed to create users")
			return
		}
		user.PasswordHash = ""
		created = append(created, user)
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	respondJSON(w, http.StatusCreated, UserListResponse{Items: created, Total: len(created)})
}

func (h *UserManagementHandler) BatchGraduate(w http.ResponseWriter, r *http.Request) {
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	var req BatchGraduateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.UserIDs) == 0 {
		respondError(w, http.StatusBadRequest, "userIds is required")
		return
	}

	graduateYear := time.Now().Year()
	if req.GraduateYear != nil {
		graduateYear = *req.GraduateYear
	}

	uuids := make([]uuid.UUID, len(req.UserIDs))
	for i, id := range req.UserIDs {
		uid, err := uuid.Parse(id)
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid userId: "+id)
			return
		}
		uuids[i] = uid
	}

	_, err := h.DB.Exec(r.Context(),
		`UPDATE users SET status = 'graduated', graduate_year = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`,
		graduateYear, uuids)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to batch graduate")
		return
	}

	respondJSON(w, http.StatusOK, map[string]int{"count": len(req.UserIDs)})
}

// BindRoles replaces the user's role bindings with the given set (at least one),
// all roles must belong to the user's tenant.
func (h *UserManagementHandler) BindRoles(w http.ResponseWriter, r *http.Request) {
	if !h.canManageUsers(r) {
		respondError(w, http.StatusForbidden, "permission denied")
		return
	}

	id := chi.URLParam(r, "id")
	user, err := h.fetchUser(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "user not found")
		return
	}

	var req BindUserRolesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	roleIDs := uniqueStrings(req.RoleIDs)
	if len(roleIDs) == 0 {
		respondError(w, http.StatusBadRequest, "至少需要绑定一个角色")
		return
	}

	var validCount int
	_ = h.DB.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM roles WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
		roleIDs, user.TenantID,
	).Scan(&validCount)
	if validCount != len(roleIDs) {
		respondError(w, http.StatusBadRequest, "存在无效角色或角色不属于当前租户")
		return
	}

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context())

	if _, err := tx.Exec(r.Context(), `
		UPDATE roles SET user_count = GREATEST(user_count - 1, 0)
		WHERE id IN (SELECT role_id FROM user_roles WHERE user_id = $1)
	`, id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to bind roles")
		return
	}
	if _, err := tx.Exec(r.Context(), `DELETE FROM user_roles WHERE user_id = $1`, id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to bind roles")
		return
	}
	for _, roleID := range roleIDs {
		if _, err := tx.Exec(r.Context(), `
			INSERT INTO user_roles (id, user_id, role_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, role_id) DO NOTHING
		`, uuid.NewString(), id, roleID); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to bind roles")
			return
		}
	}
	if _, err := tx.Exec(r.Context(),
		`UPDATE roles SET user_count = user_count + 1 WHERE id = ANY($1::uuid[])`,
		roleIDs,
	); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to bind roles")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to commit")
		return
	}

	updated, _ := h.fetchUser(r.Context(), id)
	updated.PasswordHash = ""
	items := []domain.User{updated}
	h.attachUserRoles(r.Context(), items)
	respondJSON(w, http.StatusOK, items[0])
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

func (h *UserManagementHandler) decRoleCountsForUser(ctx context.Context, userID string) {
	_, _ = h.DB.Exec(ctx, `
		UPDATE roles SET user_count = GREATEST(user_count - 1, 0)
		WHERE id IN (SELECT role_id FROM user_roles WHERE user_id = $1)
	`, userID)
}

func (h *UserManagementHandler) createSingleUser(ctx context.Context, req CreateUserRequest) (domain.User, error) {
	tx, err := h.DB.Begin(ctx)
	if err != nil {
		return domain.User{}, err
	}
	defer tx.Rollback(ctx)

	user, err := h.createSingleUserInTx(ctx, tx, req)
	if err != nil {
		return user, err
	}

	if err := tx.Commit(ctx); err != nil {
		return user, err
	}
	return user, nil
}

func (h *UserManagementHandler) createSingleUserInTx(ctx context.Context, tx pgx.Tx, req CreateUserRequest) (domain.User, error) {
	id := uuid.NewString()

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("ERROR bcrypt in createSingleUserInTx: %v", err)
		return domain.User{}, err
	}

	role := h.resolveRole(req.Role, domain.UserRoleSchool)
	platform := req.Platform
	if platform == "" {
		platform = domain.UserPlatformSaas
	}

	rawLoginName := req.Username
	if req.LoginName != nil && *req.LoginName != "" {
		rawLoginName = *req.LoginName
	}
	globalLoginName := req.TenantID + "_" + rawLoginName

	_, err = tx.Exec(ctx, `
		INSERT INTO users (id, tenant_id, institution_id, org_node_id, major_id,
			role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
			student_no, work_id, id_card, title_ids, oauth, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'active')
	`, id, req.TenantID, req.InstitutionID, req.OrgNodeID, req.MajorID,
		role, platform, globalLoginName, rawLoginName, string(hash), req.Name, req.Email, req.Phone, req.AvatarURL,
		req.StudentNo, req.WorkID, req.IDCard, coalesceStringSlice(req.TitleIDs), domain.JSONMap{})
	if err != nil {
		log.Printf("ERROR INSERT users in createSingleUserInTx: %v, tenantId=%s roleId=%v username=%s",
			err, req.TenantID, req.RoleID, req.Username)
		return domain.User{}, err
	}

	if req.RoleID != nil && *req.RoleID != "" {
		var validRole bool
		_ = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM roles WHERE id = $1 AND tenant_id = $2)`, *req.RoleID, req.TenantID).Scan(&validRole)
		if !validRole {
			return domain.User{}, fmt.Errorf("invalid roleId: role not in tenant")
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO user_roles (id, user_id, role_id)
			VALUES ($1, $2, $3)
			ON CONFLICT (user_id, role_id) DO NOTHING
		`, uuid.NewString(), id, *req.RoleID); err != nil {
			return domain.User{}, err
		}
		_, _ = tx.Exec(ctx, `UPDATE roles SET user_count = user_count + 1 WHERE id = $1`, *req.RoleID)
	}

	return h.fetchUserInTx(ctx, tx, id)
}

// resolveRole maps the request-provided platform role enum, keeping the
// fallback when absent. users.role 仅用于 marketplace 平台分区，与角色体系无关。
func (h *UserManagementHandler) resolveRole(roleOverride *string, fallback domain.UserRole) domain.UserRole {
	if roleOverride != nil {
		switch *roleOverride {
		case string(domain.UserRoleSchool), string(domain.UserRoleEnterprise), string(domain.UserRoleOperator):
			return domain.UserRole(*roleOverride)
		}
	}
	if fallback != "" {
		return fallback
	}
	return domain.UserRoleSchool
}

// rebindUserRole replaces all role bindings of a user with the single given role.
// 角色必须属于用户所在租户，防止跨租户角色（如运营方 platform_admin）被绑定。
func (h *UserManagementHandler) rebindUserRole(ctx context.Context, userID, roleID string, tenantID *string) error {
	var validRole bool
	_ = h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM roles WHERE id = $1 AND tenant_id = $2)`, roleID, tenantID).Scan(&validRole)
	if !validRole {
		return fmt.Errorf("invalid roleId: role not in tenant")
	}
	h.decRoleCountsForUser(ctx, userID)
	if _, err := h.DB.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1`, userID); err != nil {
		return err
	}
	if _, err := h.DB.Exec(ctx, `
		INSERT INTO user_roles (id, user_id, role_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, role_id) DO NOTHING
	`, uuid.NewString(), userID, roleID); err != nil {
		return err
	}
	_, _ = h.DB.Exec(ctx, `UPDATE roles SET user_count = user_count + 1 WHERE id = $1`, roleID)
	return nil
}

// attachUserRoles populates RoleIDs/RoleCodes/RoleNames for the given users.
func (h *UserManagementHandler) attachUserRoles(ctx context.Context, items []domain.User) {
	if len(items) == 0 {
		return
	}
	ids := make([]string, 0, len(items))
	index := make(map[string]int, len(items))
	for i, u := range items {
		ids = append(ids, u.ID)
		index[u.ID] = i
	}
	rows, err := h.DB.Query(ctx, `
		SELECT ur.user_id, r.id, r.code, r.name
		FROM user_roles ur
		JOIN roles r ON r.id = ur.role_id
		WHERE ur.user_id = ANY($1::uuid[])
		ORDER BY r.created_at
	`, ids)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var userID, roleID, code, name string
		if err := rows.Scan(&userID, &roleID, &code, &name); err != nil {
			continue
		}
		if i, ok := index[userID]; ok {
			items[i].RoleIDs = append(items[i].RoleIDs, roleID)
			items[i].RoleCodes = append(items[i].RoleCodes, code)
			items[i].RoleNames = append(items[i].RoleNames, name)
		}
	}
}

func (h *UserManagementHandler) fetchUser(ctx context.Context, id string) (domain.User, error) {
	var user domain.User
	var tenantID, institutionID, orgNodeID, majorID, loginName, phone, avatarURL, studentNo, workID, idCard *string
	var titleIDs []string
	var oauth domain.JSONMap

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, institution_id, org_node_id, major_id,
			role, login_name, username, password_hash, name, email, phone, avatar_url,
			student_no, work_id, id_card, title_ids, oauth, status, graduate_year, last_login_at, created_at, updated_at
		FROM users WHERE id = $1
	`, id).Scan(
		&user.ID, &tenantID, &institutionID, &orgNodeID, &majorID,
		&user.Role, &loginName, &user.Username, &user.PasswordHash, &user.Name, &user.Email,
		&phone, &avatarURL, &studentNo, &workID, &idCard, &titleIDs, &oauth, &user.Status,
		&user.GraduateYear, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return user, err
	}
	user.TenantID = tenantID
	user.InstitutionID = institutionID
	user.OrgNodeID = orgNodeID
	user.MajorID = majorID
	user.LoginName = loginName
	user.Phone = phone
	user.AvatarURL = avatarURL
	user.StudentNo = studentNo
	user.WorkID = workID
	user.IDCard = idCard
	user.TitleIDs = titleIDs
	user.Oauth = oauth
	return user, nil
}

func (h *UserManagementHandler) fetchUserInTx(ctx context.Context, tx pgx.Tx, id string) (domain.User, error) {
	var user domain.User
	var tenantID, institutionID, orgNodeID, majorID, loginName, phone, avatarURL, studentNo, workID, idCard *string
	var titleIDs []string
	var oauth domain.JSONMap

	err := tx.QueryRow(ctx, `
		SELECT id, tenant_id, institution_id, org_node_id, major_id,
			role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
			student_no, work_id, id_card, title_ids, oauth, status, graduate_year, last_login_at, created_at, updated_at
		FROM users WHERE id = $1
	`, id).Scan(
		&user.ID, &tenantID, &institutionID, &orgNodeID, &majorID,
		&user.Role, &user.Platform, &loginName, &user.Username, &user.PasswordHash, &user.Name, &user.Email,
		&phone, &avatarURL, &studentNo, &workID, &idCard, &titleIDs, &oauth, &user.Status,
		&user.GraduateYear, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return user, err
	}
	user.TenantID = tenantID
	user.InstitutionID = institutionID
	user.OrgNodeID = orgNodeID
	user.MajorID = majorID
	user.LoginName = loginName
	user.Phone = phone
	user.AvatarURL = avatarURL
	user.StudentNo = studentNo
	user.WorkID = workID
	user.IDCard = idCard
	user.TitleIDs = titleIDs
	user.Oauth = oauth
	return user, nil
}

func (h *UserManagementHandler) scanUserRows(rows pgx.Rows) ([]domain.User, error) {
	items := make([]domain.User, 0)
	for rows.Next() {
		var user domain.User
		var tenantID, institutionID, orgNodeID, majorID, loginName, phone, avatarURL, studentNo, workID, idCard *string
		var titleIDs []string
		var oauth domain.JSONMap
		if err := rows.Scan(
			&user.ID, &tenantID, &institutionID, &orgNodeID, &majorID,
			&user.Role, &user.Platform, &loginName, &user.Username, &user.PasswordHash, &user.Name, &user.Email,
			&phone, &avatarURL, &studentNo, &workID, &idCard, &titleIDs, &oauth, &user.Status,
			&user.GraduateYear, &user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
		); err != nil {
			return nil, err
		}
		user.TenantID = tenantID
		user.InstitutionID = institutionID
		user.OrgNodeID = orgNodeID
		user.MajorID = majorID
		user.LoginName = loginName
		user.Phone = phone
		user.AvatarURL = avatarURL
		user.StudentNo = studentNo
		user.WorkID = workID
		user.IDCard = idCard
		user.TitleIDs = titleIDs
		user.Oauth = oauth
		items = append(items, user)
	}
	return items, nil
}

func (h *UserManagementHandler) validateUserOrgMajor(ctx context.Context, tenantID string, orgNodeID, majorID *string) error {
	if tenantID == "" {
		return nil
	}
	if orgNodeID != nil && *orgNodeID != "" {
		var exists bool
		err := h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM organizations WHERE id = $1 AND tenant_id = $2)`, *orgNodeID, tenantID).Scan(&exists)
		if err != nil || !exists {
			return fmt.Errorf("invalid orgNodeId")
		}
	}
	if majorID != nil && *majorID != "" {
		var exists bool
		err := h.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM majors WHERE id = $1 AND tenant_id = $2)`, *majorID, tenantID).Scan(&exists)
		if err != nil || !exists {
			return fmt.Errorf("invalid majorId")
		}
	}
	return nil
}
