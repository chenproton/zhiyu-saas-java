package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB         *pgxpool.Pool
	JWTSecret  string
	usedNonces sync.Map // map[string]time.Time
}

type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	Token                string       `json:"token"`
	User                 domain.User  `json:"user"`
	NeedsTenantSelection bool         `json:"needsTenantSelection,omitempty"`
	PreAuthToken         string       `json:"preAuthToken,omitempty"`
	Tenants              []TenantOption `json:"tenants,omitempty"`
}

type TenantOption struct {
	TenantID   string `json:"tenantId"`
	TenantName string `json:"tenantName"`
	UserID     string `json:"userId"`
}

type SelectTenantRequest struct {
	PreAuthToken string `json:"preAuthToken"`
	TenantID     string `json:"tenantId"`
}

type preAuthClaims struct {
	Username  string         `json:"username"`
	Platform  string         `json:"platform"`
	TenantIDs []TenantOption `json:"tenantIds"`
	JTI       string         `json:"jti"`
	jwt.RegisteredClaims
}

type MeResponse struct {
	User         domain.User          `json:"user"`
	Institution  *domain.Institution  `json:"institution,omitempty"`
	Tenant       *domain.Tenant       `json:"tenant,omitempty"`
	OrgNode      *domain.Organization `json:"orgNode,omitempty"`
	Major        *domain.Major        `json:"major,omitempty"`
	Roles        []domain.Role        `json:"roles,omitempty"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	h.loginWithPlatform(w, r, domain.UserPlatformSaas)
}

func (h *AuthHandler) SaasLogin(w http.ResponseWriter, r *http.Request) {
	h.loginWithPlatform(w, r, domain.UserPlatformSaas)
}

func (h *AuthHandler) PortalLogin(w http.ResponseWriter, r *http.Request) {
	h.loginWithPlatform(w, r, domain.UserPlatformPortal)
}

func (h *AuthHandler) loginWithPlatform(w http.ResponseWriter, r *http.Request, platform domain.UserPlatform) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	type candidate struct {
		user     domain.User
		tenant   domain.Tenant
	}

	rows, err := h.DB.Query(r.Context(), `
		SELECT u.id, u.tenant_id, u.institution_id, u.org_node_id, u.major_id,
		       u.role, u.platform, u.login_name, u.username, u.password_hash, u.name, u.email,
		       u.phone, u.avatar_url, u.student_no, u.work_id, u.id_card, u.title_ids, u.oauth,
		       u.status, u.created_at, u.updated_at,
		       t.name as tenant_name
		FROM users u
		JOIN tenants t ON t.id = u.tenant_id
		WHERE u.username = $1 AND u.platform = $2
	`, req.Username, platform)
	if err != nil {
		log.Printf("ERROR login query: %v", err)
		respondError(w, http.StatusInternalServerError, "login failed")
		return
	}
	defer rows.Close()

	var candidates []candidate
	for rows.Next() {
		var u candidate
		var tenantID, orgNodeID, majorID, loginName *string
		var phone, avatarURL, studentNo, workID, idCard *string
		var titleIDs []string
		var oauth domain.JSONMap

		if err := rows.Scan(
			&u.user.ID, &tenantID, &u.user.InstitutionID, &orgNodeID, &majorID,
			&u.user.Role, &u.user.Platform, &loginName, &u.user.Username, &u.user.PasswordHash, &u.user.Name, &u.user.Email,
			&phone, &avatarURL, &studentNo, &workID, &idCard, &titleIDs, &oauth, &u.user.Status,
			&u.user.CreatedAt, &u.user.UpdatedAt, &u.tenant.Name,
		); err != nil {
			log.Printf("ERROR login scan: %v", err)
			continue
		}
		u.user.TenantID = tenantID
		u.user.OrgNodeID = orgNodeID
		u.user.MajorID = majorID
		u.user.LoginName = loginName
		u.user.Phone = phone
		u.user.AvatarURL = avatarURL
		u.user.StudentNo = studentNo
		u.user.WorkID = workID
		u.user.IDCard = idCard
		u.user.TitleIDs = titleIDs
		u.user.Oauth = oauth
		u.tenant.ID = *tenantID

		if err := bcrypt.CompareHashAndPassword([]byte(u.user.PasswordHash), []byte(req.Password)); err == nil {
			candidates = append(candidates, u)
		}
	}

	if len(candidates) == 0 {
		respondError(w, http.StatusUnauthorized, "invalid username or password")
		return
	}

	if len(candidates) == 1 {
		h.issueTokenForUser(w, r, &candidates[0].user)
		return
	}

	// Multi-tenant: issue pre-auth token
	options := make([]TenantOption, len(candidates))
	for i, c := range candidates {
		options[i] = TenantOption{
			TenantID:   c.tenant.ID,
			TenantName: c.tenant.Name,
			UserID:     c.user.ID,
		}
	}
	jtiBytes := make([]byte, 16)
	rand.Read(jtiBytes)
	jti := hex.EncodeToString(jtiBytes)
	preAuthClaims := preAuthClaims{
		Username:  req.Username,
		Platform:  string(platform),
		TenantIDs: options,
		JTI:       jti,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	preAuthToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, preAuthClaims).SignedString([]byte(h.JWTSecret))
	if err != nil {
		log.Printf("ERROR generating preAuthToken: %v", err)
		respondError(w, http.StatusInternalServerError, "login failed")
		return
	}

	respondJSON(w, http.StatusOK, LoginResponse{
		NeedsTenantSelection: true,
		PreAuthToken:         preAuthToken,
		Tenants:              options,
	})
}

func (h *AuthHandler) SelectTenant(w http.ResponseWriter, r *http.Request) {
	var req SelectTenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	token, err := jwt.ParseWithClaims(req.PreAuthToken, &preAuthClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(h.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		respondError(w, http.StatusUnauthorized, "invalid or expired pre-auth token")
		return
	}

	claims, ok := token.Claims.(*preAuthClaims)
	if !ok {
		respondError(w, http.StatusUnauthorized, "invalid pre-auth token claims")
		return
	}

	if claims.JTI != "" {
		if v, loaded := h.usedNonces.Load(claims.JTI); loaded {
			if t, ok := v.(time.Time); ok && time.Since(t) < 2*time.Minute {
				respondError(w, http.StatusUnauthorized, "pre-auth token already used")
				return
			}
			h.usedNonces.Delete(claims.JTI)
		}
		h.usedNonces.Store(claims.JTI, time.Now())
	}

	var targetUserID string
	for _, opt := range claims.TenantIDs {
		if opt.TenantID == req.TenantID {
			targetUserID = opt.UserID
			break
		}
	}
	if targetUserID == "" {
		respondError(w, http.StatusBadRequest, "invalid tenant selection")
		return
	}

	user, err := h.fetchUserByID(r.Context(), targetUserID)
	if err != nil || user.ID == "" {
		respondError(w, http.StatusInternalServerError, "failed to fetch user")
		return
	}
	h.issueTokenForUser(w, r, &user)
}

func (h *AuthHandler) issueTokenForUser(w http.ResponseWriter, r *http.Request, user *domain.User) {
	_, _ = h.DB.Exec(r.Context(), `UPDATE users SET last_login_at = $1 WHERE id = $2`, time.Now(), user.ID)
	h.recordLoginLog(r, user, "success")

	roleCodes := h.fetchUserRoleCodes(r.Context(), user.ID)
	perms := h.fetchMergedPermissions(r.Context(), user.ID)

	token, err := middleware.GenerateToken(h.JWTSecret, middleware.TokenInput{
		User:        user,
		RoleCodes:   roleCodes,
		Permissions: perms,
	})
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	user.PasswordHash = ""
	respondJSON(w, http.StatusOK, LoginResponse{Token: token, User: *user})
}

func (h *AuthHandler) recordLoginLog(r *http.Request, user *domain.User, status string) {
	if user.TenantID == nil || *user.TenantID == "" {
		return
	}
	userName := user.Name
	if userName == "" {
		userName = user.Username
	}
	device := r.UserAgent()
	if len(device) > 256 {
		device = device[:256]
	}
	_, _ = h.DB.Exec(r.Context(), `
		INSERT INTO login_logs (tenant_id, user_id, user_name, ip, device, status)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, *user.TenantID, user.ID, userName, middleware.ClientIP(r), device, status)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	user, err := h.fetchUserByID(r.Context(), claims.UserID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to fetch user")
		return
	}

	resp := MeResponse{User: user}

	if user.InstitutionID != nil {
		inst, err := h.fetchInstitution(r.Context(), *user.InstitutionID)
		if err == nil {
			resp.Institution = inst
		}
	}
	if user.TenantID != nil {
		resp.Tenant = h.fetchTenantByID(r.Context(), *user.TenantID)
	}
	if user.OrgNodeID != nil {
		resp.OrgNode = h.fetchOrganizationByID(r.Context(), *user.OrgNodeID)
	}
	if user.MajorID != nil {
		resp.Major = h.fetchMajorByID(r.Context(), *user.MajorID)
	}
	resp.Roles = h.fetchUserRoles(r.Context(), user.ID)

	respondJSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) SaasMe(w http.ResponseWriter, r *http.Request) {
	h.meWithPlatform(w, r, domain.UserPlatformSaas)
}

func (h *AuthHandler) PortalMe(w http.ResponseWriter, r *http.Request) {
	h.meWithPlatform(w, r, domain.UserPlatformPortal)
}

func (h *AuthHandler) meWithPlatform(w http.ResponseWriter, r *http.Request, platform domain.UserPlatform) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	if claims.Platform != platform {
		respondError(w, http.StatusForbidden, "invalid platform")
		return
	}

	h.Me(w, r)
}

func (h *AuthHandler) fetchUserByID(ctx context.Context, id string) (domain.User, error) {
	var user domain.User
	var tenantID, orgNodeID, majorID, loginName, phone, avatarURL, studentNo, workID, idCard *string
	var titleIDs []string
	var oauth domain.JSONMap

	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, institution_id, org_node_id, major_id,
		       role, platform, login_name, username, password_hash, name, email, phone, avatar_url,
		       student_no, work_id, id_card, title_ids, oauth, status, last_login_at, created_at, updated_at
		FROM users WHERE id = $1
	`, id).Scan(
		&user.ID, &tenantID, &user.InstitutionID, &orgNodeID, &majorID,
		&user.Role, &user.Platform, &loginName, &user.Username, &user.PasswordHash, &user.Name, &user.Email,
		&phone, &avatarURL, &studentNo, &workID, &idCard, &titleIDs, &oauth, &user.Status,
		&user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return user, err
	}
	user.TenantID = tenantID
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

func (h *AuthHandler) fetchInstitution(ctx context.Context, id string) (*domain.Institution, error) {
	var inst domain.Institution
	err := h.DB.QueryRow(ctx, `
		SELECT id, type, name, credit_code, logo, intro, contact_name, contact_phone, contact_email,
		       qualification_file, status, org_code, balance, total_spent, total_income, created_at, updated_at
		FROM institutions WHERE id = $1
	`, id).Scan(
		&inst.ID, &inst.Type, &inst.Name, &inst.CreditCode, &inst.Logo, &inst.Intro,
		&inst.ContactName, &inst.ContactPhone, &inst.ContactEmail, &inst.QualificationFile,
		&inst.Status, &inst.OrgCode, &inst.Balance, &inst.TotalSpent, &inst.TotalIncome,
		&inst.CreatedAt, &inst.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	tags, _ := h.fetchInstitutionTags(ctx, inst.ID)
	inst.ExpertiseTags = tags
	return &inst, nil
}

func (h *AuthHandler) fetchInstitutionTags(ctx context.Context, institutionID string) ([]string, error) {
	rows, err := h.DB.Query(ctx, `SELECT tag_value FROM institution_expertise_tags WHERE institution_id = $1 ORDER BY tag_value`, institutionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err == nil {
			tags = append(tags, t)
		}
	}
	return tags, nil
}

func (h *AuthHandler) fetchTenantByID(ctx context.Context, id string) *domain.Tenant {
	var t domain.Tenant
	var logo, domainVal, enterpriseCode, contact, phone, address, description *string
	err := h.DB.QueryRow(ctx, `
		SELECT id, name, code, logo_url, domain, enterprise_code, contact, phone, address, description, admin_ids, status, created_at, updated_at
		FROM tenants WHERE id = $1
	`, id).Scan(
		&t.ID, &t.Name, &t.Code, &logo, &domainVal, &enterpriseCode, &contact, &phone, &address, &description,
		&t.AdminIDs, &t.Status, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil
	}
	t.LogoURL = logo
	t.Domain = domainVal
	t.EnterpriseCode = enterpriseCode
	t.Contact = contact
	t.Phone = phone
	t.Address = address
	t.Description = description
	return &t
}

func (h *AuthHandler) fetchOrganizationByID(ctx context.Context, id string) *domain.Organization {
	var o domain.Organization
	var parentID *string
	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, name, type_id, parent_id, sort_order, member_count, created_at, updated_at
		FROM organizations WHERE id = $1
	`, id).Scan(
		&o.ID, &o.TenantID, &o.Name, &o.TypeID, &parentID, &o.SortOrder, &o.MemberCount, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		return nil
	}
	o.ParentID = parentID
	return &o
}

func (h *AuthHandler) fetchMajorByID(ctx context.Context, id string) *domain.Major {
	var m domain.Major
	var orgNodeID, alias *string
	err := h.DB.QueryRow(ctx, `
		SELECT id, tenant_id, org_node_id, code, name, alias, enabled, created_at, updated_at
		FROM majors WHERE id = $1
	`, id).Scan(
		&m.ID, &m.TenantID, &orgNodeID, &m.Code, &m.Name, &alias, &m.Enabled, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		return nil
	}
	m.OrgNodeID = orgNodeID
	m.Alias = alias
	return &m
}

func (h *AuthHandler) fetchUserRoles(ctx context.Context, userID string) []domain.Role {
	rows, err := h.DB.Query(ctx, `
		SELECT r.id, r.tenant_id, r.code, r.name, r.description, r.permissions, r.user_count, r.status, r.created_at
		FROM roles r
		JOIN user_roles ur ON ur.role_id = r.id
		WHERE ur.user_id = $1
	`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var roles []domain.Role
	for rows.Next() {
		var r domain.Role
		var description *string
		if err := rows.Scan(&r.ID, &r.TenantID, &r.Code, &r.Name, &description, &r.Permissions, &r.UserCount, &r.Status, &r.CreatedAt); err != nil {
			continue
		}
		r.Description = description
		roles = append(roles, r)
	}
	return roles
}

func (h *AuthHandler) fetchUserRoleCodes(ctx context.Context, userID string) []string {
	rows, err := h.DB.Query(ctx, `
		SELECT r.code
		FROM roles r
		JOIN user_roles ur ON ur.role_id = r.id
		WHERE ur.user_id = $1
		ORDER BY r.created_at
	`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var codes []string
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err == nil {
			codes = append(codes, code)
		}
	}
	return codes
}

func (h *AuthHandler) fetchMergedPermissions(ctx context.Context, userID string) domain.JSONMap {
	roles := h.fetchUserRoles(ctx, userID)
	merged := domain.JSONMap{}
	for _, r := range roles {
		if r.Permissions == nil {
			continue
		}
		for k, v := range r.Permissions {
			merged[k] = v
		}
	}
	return merged
}
