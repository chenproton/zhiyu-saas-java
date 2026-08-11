package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	Service    *service.AuthService
	JWTSecret  string
	usedNonces sync.Map // map[string]time.Time
	stopCh     chan struct{}

	// PartnerService 企业平台注册/主体查询（router 装配时注入）。
	PartnerService *service.PartnerService
	// Captcha 滑块验证码服务（router 装配时注入）。nil 时登录不校验验证码。
	Captcha *service.CaptchaService
}

func NewAuthHandler(svc *service.AuthService, jwtSecret string) *AuthHandler {
	h := &AuthHandler{Service: svc, JWTSecret: jwtSecret, stopCh: make(chan struct{})}
	goAsync(nil, func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				h.usedNonces.Range(func(key, value interface{}) bool {
					if t, ok := value.(time.Time); ok && time.Since(t) > 10*time.Minute {
						h.usedNonces.Delete(key)
					}
					return true
				})
			case <-h.stopCh:
				return
			}
		}
	})
	return h
}

func (h *AuthHandler) Shutdown() {
	close(h.stopCh)
}

type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
	// 字符验证码：登录失败达到阈值后必填（captchaId 由 GET /auth/captcha 下发，
	// captchaCode 为用户输入的验证码字符）。
	CaptchaID   string `json:"captchaId"`
	CaptchaCode string `json:"captchaCode"`
}

type LoginResponse struct {
	Token                string         `json:"token"`
	User                 domain.User    `json:"user"`
	NeedsTenantSelection bool           `json:"needsTenantSelection,omitempty"`
	PreAuthToken         string         `json:"preAuthToken,omitempty"`
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
	User        domain.User          `json:"user"`
	Institution *domain.Institution  `json:"institution,omitempty"`
	Tenant      *domain.Tenant       `json:"tenant,omitempty"`
	OrgNode     *domain.Organization `json:"orgNode,omitempty"`
	Major       *domain.Major        `json:"major,omitempty"`
	Roles       []domain.Role        `json:"roles,omitempty"`
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

func (h *AuthHandler) PartnerLogin(w http.ResponseWriter, r *http.Request) {
	h.loginWithPlatform(w, r, domain.UserPlatformPartner)
}

// PartnerRegisterRequest 企业自助注册请求。
type PartnerRegisterRequest struct {
	EnterpriseName          string `json:"enterpriseName" validate:"required"`
	Username                string `json:"username" validate:"required"`
	Password                string `json:"password" validate:"required"`
	ContactName             string `json:"contactName"`
	UnifiedSocialCreditCode string `json:"unifiedSocialCreditCode"`
	ContactPerson           string `json:"contactPerson"`
	ContactPhone            string `json:"contactPhone"`
	ContactEmail            string `json:"contactEmail"`
}

// PartnerRegister 企业自助注册：创建企业租户+主体+管理员后直接签发 token。
func (h *AuthHandler) PartnerRegister(w http.ResponseWriter, r *http.Request) {
	var req PartnerRegisterRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if req.EnterpriseName == "" || req.Username == "" {
		respondError(w, http.StatusBadRequest, "企业名称和用户名不能为空")
		return
	}
	if err := validatePassword(req.Password); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	res, err := h.PartnerService.Register(r.Context(), &service.PartnerRegisterParams{
		EnterpriseName:          req.EnterpriseName,
		Username:                req.Username,
		Password:                req.Password,
		ContactName:             req.ContactName,
		UnifiedSocialCreditCode: req.UnifiedSocialCreditCode,
		ContactPerson:           req.ContactPerson,
		ContactPhone:            req.ContactPhone,
		ContactEmail:            req.ContactEmail,
	})
	if err != nil {
		switch {
		case isUniqueViolation(err):
			respondError(w, http.StatusConflict, "企业名称已被注册")
		default:
			respondServerError(w, r, err, "注册失败")
		}
		return
	}

	h.issueTokenForUser(w, r, res.User)
}

func (h *AuthHandler) loginWithPlatform(w http.ResponseWriter, r *http.Request, platform domain.UserPlatform) {
	var req LoginRequest
	if !decodeBody(w, r, &req) {
		return
	}

	// 防爆破：同一 IP 登录失败达到阈值后，必须通过滑块验证码（校验失败直接返回，
	// 不泄露账号是否存在）。验证码未配置（Captcha == nil）时跳过。
	if h.Captcha != nil {
		ip := middleware.ClientIP(r)
		if fail, _ := h.Captcha.FailCount(r.Context(), ip); fail >= service.CaptchaFailThreshold {
			if err := h.Captcha.Verify(r.Context(), req.CaptchaID, req.CaptchaCode); err != nil {
				if errors.Is(err, service.ErrCaptchaWrong) {
					respondJSON(w, http.StatusBadRequest, errorResponse{
						Code:  CodeCaptchaWrong,
						Error: "验证码不正确，请重试",
					})
				} else {
					respondJSON(w, http.StatusBadRequest, errorResponse{
						Code:  CodeCaptchaRequired,
						Error: "请完成滑块验证",
					})
				}
				return
			}
		}
	}

	type candidate struct {
		user   domain.User
		tenant domain.Tenant
	}

	rows, err := h.Service.FindUsersByUsername(r.Context(), req.Username, platform)
	if err != nil {
		respondServerError(w, r, err, "登录失败")
		return
	}

	var candidates []candidate
	var expiredTenant bool
	for _, row := range rows {
		u := candidate{user: row.User, tenant: row.Tenant}
		// 停用用户 / 停用租户不允许登录
		if u.user.Status != "" && u.user.Status != "active" {
			continue
		}
		if u.tenant.Status != "" && string(u.tenant.Status) != string(domain.TenantStatusActive) {
			continue
		}
		if err := bcrypt.CompareHashAndPassword([]byte(u.user.PasswordHash), []byte(req.Password)); err != nil {
			continue
		}
		// 租户不在有效期内（未开始或已过期）不允许登录
		if !isTenantWithinValidity(u.tenant) {
			expiredTenant = true
			continue
		}
		candidates = append(candidates, u)
	}

	if len(candidates) == 0 {
		if expiredTenant {
			respondError(w, http.StatusForbidden, "租户不在有效期内，请联系管理员")
			return
		}
		// 凭证错误：计入该 IP 失败次数（达到阈值后要求验证码）
		if h.Captcha != nil {
			h.Captcha.RecordFailure(r.Context(), middleware.ClientIP(r))
		}
		respondError(w, http.StatusUnauthorized, "用户名或密码错误")
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
		respondServerError(w, r, err, "登录失败")
		return
	}

	respondJSON(w, http.StatusOK, LoginResponse{
		NeedsTenantSelection: true,
		PreAuthToken:         preAuthToken,
		Tenants:              options,
	})
}

// isTenantWithinValidity 判断租户是否在有效期内（valid_from/valid_until 为 YYYY-MM-DD，空表示不限）。
func isTenantWithinValidity(t domain.Tenant) bool {
	today := time.Now().Format("2006-01-02")
	if t.ValidFrom != nil && *t.ValidFrom != "" && *t.ValidFrom > today {
		return false
	}
	if t.ValidUntil != nil && *t.ValidUntil != "" && *t.ValidUntil < today {
		return false
	}
	return true
}

func (h *AuthHandler) SelectTenant(w http.ResponseWriter, r *http.Request) {
	var req SelectTenantRequest
	if !decodeBody(w, r, &req) {
		return
	}

	token, err := jwt.ParseWithClaims(req.PreAuthToken, &preAuthClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("意外的签名方法：%v", t.Header["alg"])
		}
		return []byte(h.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		respondError(w, http.StatusUnauthorized, "预授权令牌无效或已过期")
		return
	}

	claims, ok := token.Claims.(*preAuthClaims)
	if !ok {
		respondError(w, http.StatusUnauthorized, "预授权令牌信息无效")
		return
	}

	if claims.JTI != "" {
		if v, loaded := h.usedNonces.Load(claims.JTI); loaded {
			if t, ok := v.(time.Time); ok && time.Since(t) < 2*time.Minute {
				respondError(w, http.StatusUnauthorized, "预授权令牌已被使用")
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
		respondError(w, http.StatusBadRequest, "无效租户选择")
		return
	}

	user, err := h.fetchUserByID(r.Context(), targetUserID)
	if err != nil || user.ID == "" {
		respondServerError(w, r, err, "查询用户信息失败")
		return
	}
	if user.Status != "" && user.Status != "active" {
		respondError(w, http.StatusUnauthorized, "账号已停用")
		return
	}
	h.issueTokenForUser(w, r, &user)
}

func (h *AuthHandler) issueTokenForUser(w http.ResponseWriter, r *http.Request, user *domain.User) {
	// 认证成功：清零该 IP 登录失败计数（登录/注册/选租户统一入口）
	if h.Captcha != nil {
		h.Captcha.ResetFailure(r.Context(), middleware.ClientIP(r))
	}
	h.Service.UpdateLastLogin(r.Context(), user.ID, time.Now())
	h.recordLoginLog(r, user, "success")

	roleCodes := h.fetchUserRoleCodes(r.Context(), user.ID)
	perms := h.fetchMergedPermissions(r.Context(), user.ID)

	token, err := middleware.GenerateToken(h.JWTSecret, middleware.TokenInput{
		User:        user,
		RoleCodes:   roleCodes,
		Permissions: perms,
	})
	if err != nil {
		respondServerError(w, r, err, "生成令牌失败")
		return
	}

	user.PasswordHash = ""
	// OAuth 第三方凭据不随登录响应下发
	user.Oauth = nil
	// 文件资源通道：HttpOnly cookie 供 <img>/kkFileView 等无 Authorization 头的请求使用
	middleware.SetAuthCookie(w, token)
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
	h.Service.RecordLoginLog(r.Context(), *user.TenantID, user.ID, userName, middleware.ClientIP(r), device, status)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "未登录或登录已过期")
		return
	}

	user, err := h.fetchUserByID(r.Context(), claims.UserID)
	if err != nil {
		respondServerError(w, r, err, "查询用户信息失败")
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

// PartnerMeResponse partner 端用户信息 + 企业主体合并返回。
type PartnerMeResponse struct {
	MeResponse
	Enterprise *domain.AllianceEnterprise `json:"enterprise,omitempty"`
}

// PartnerMe partner 端 me：用户信息 + 租户 + 角色 + 企业主体。
func (h *AuthHandler) PartnerMe(w http.ResponseWriter, r *http.Request) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "未登录或登录已过期")
		return
	}
	if claims.Platform != domain.UserPlatformPartner {
		respondError(w, http.StatusForbidden, "无效平台")
		return
	}

	user, err := h.fetchUserByID(r.Context(), claims.UserID)
	if err != nil {
		respondServerError(w, r, err, "查询用户信息失败")
		return
	}
	user.PasswordHash = ""
	user.Oauth = nil

	resp := PartnerMeResponse{MeResponse: MeResponse{User: user}}
	if user.TenantID != nil {
		resp.Tenant = h.fetchTenantByID(r.Context(), *user.TenantID)
		if h.PartnerService != nil {
			if enterprise, err := h.PartnerService.GetProfile(r.Context(), *user.TenantID); err == nil {
				resp.Enterprise = enterprise
			}
		}
	}
	resp.Roles = h.fetchUserRoles(r.Context(), user.ID)

	respondJSON(w, http.StatusOK, resp)
}

func (h *AuthHandler) meWithPlatform(w http.ResponseWriter, r *http.Request, platform domain.UserPlatform) {
	claims := middleware.CurrentUser(r)
	if claims == nil {
		respondError(w, http.StatusUnauthorized, "未登录或登录已过期")
		return
	}

	if claims.Platform != platform {
		respondError(w, http.StatusForbidden, "无效平台")
		return
	}

	h.Me(w, r)
}

func (h *AuthHandler) fetchUserByID(ctx context.Context, id string) (domain.User, error) {
	u, err := h.Service.GetUserByID(ctx, id)
	if err != nil {
		return domain.User{}, err
	}
	return *u, nil
}

func (h *AuthHandler) fetchInstitution(ctx context.Context, id string) (*domain.Institution, error) {
	return h.Service.GetInstitution(ctx, id)
}

func (h *AuthHandler) fetchTenantByID(ctx context.Context, id string) *domain.Tenant {
	return h.Service.GetTenantByID(ctx, id)
}

func (h *AuthHandler) fetchOrganizationByID(ctx context.Context, id string) *domain.Organization {
	return h.Service.GetOrganizationByID(ctx, id)
}

func (h *AuthHandler) fetchMajorByID(ctx context.Context, id string) *domain.Major {
	return h.Service.GetMajorByID(ctx, id)
}

func (h *AuthHandler) fetchUserRoles(ctx context.Context, userID string) []domain.Role {
	return h.Service.ListUserRoles(ctx, userID)
}

func (h *AuthHandler) fetchUserRoleCodes(ctx context.Context, userID string) []string {
	return h.Service.ListUserRoleCodes(ctx, userID)
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
