package testhelper

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/router"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
	"golang.org/x/crypto/bcrypt"
)

const (
	TestJWTSecret  = "test-secret-key-for-unit-tests"
	TestOperatorID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01"
	TestTenantID   = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02"
)

type TestEnv struct {
	DB            *pgxpool.Pool
	Store         *store.Store
	Router        chi.Router
	OperatorToken string
	// SaasAdminToken saas 平台 token（platform_admin），用于 /api/v1/admin/* 平台管理接口。
	SaasAdminToken string
	// Captcha 验证码服务（SetupTestEnvWithCaptcha 时非 nil），供测试预信任设备。
	Captcha *service.CaptchaService
	Cleanup func()
}

// SetupTestEnv 构建测试环境：默认关闭登录验证码挂载（登录流程测试不受验证码干扰），
// 验证码专属测试请使用 SetupTestEnvWithCaptcha。
func SetupTestEnv(t *testing.T) *TestEnv {
	return setupTestEnv(t, false)
}

// SetupTestEnvWithCaptcha 构建带登录验证码的测试环境（验证码规则与生产一致：
// 无 deviceId 每次必须验证码；新设备必须验证码；常用设备失败达阈值后必须验证码）。
func SetupTestEnvWithCaptcha(t *testing.T) *TestEnv {
	return setupTestEnv(t, true)
}

func setupTestEnv(t *testing.T, keepCaptcha bool) *TestEnv {
	t.Helper()

	_ = godotenv.Load("../../../.env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		// 安全红线：绝不回退 DATABASE_URL（生产库）。测试会对库执行迁移与 DELETE 种子数据，
		// 误连生产库会造成不可逆数据损失。未显式配置测试库时直接跳过。
		// 明确提示测试被跳过，避免 CI "全绿但零测试"
		fmt.Println("[testhelper] TEST_DATABASE_URL not set — integration tests SKIPPED (CI 请配置测试库)")
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}

	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		t.Fatalf("parse db url: %v", err)
	}
	config.MinConns = 1
	config.MaxConns = 5

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		t.Fatalf("create pool: %v", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		t.Fatalf("ping db: %v", err)
	}

	runTestMigrations(t, pool)

	st2 := store.New(pool)

	// 复用生产路由装配（router.NewHandlers + RegisterAPIRoutes），
	// 避免手工维护的路由副本与生产漂移（漏注册/中间件不一致导致的假 404/403）。
	// redis 与 oplogBuffer 传 nil：cache.RateLimit/Cached 对 nil client 直通，
	// OperationLog 对 nil buffer 退化为同步写库，均为生产已有行为。
	// geo 传 nil：登录日志地点留空，不依赖 ip2region 数据文件。
	h := router.NewHandlers(pool, TestJWTSecret, &handler.FileHandler{UploadDir: ""}, nil, nil, "test-ai-secret", "")
	r := chi.NewRouter()
	router.RegisterAPIRoutes(r, TestJWTSecret, "", pool, h, nil, nil)

	if !keepCaptcha {
		// 登录流程测试专注登录本身：解除验证码挂载后登录即回到无验证码路径
		h.AuthHandler().Captcha = nil
	}

	generateTestToken := func(userID, tenantID string, role domain.UserRole, platform domain.UserPlatform) string {
		u := &domain.User{ID: userID, TenantID: &tenantID, Role: role, Platform: platform, Username: "test-user"}
		token, _ := middleware.GenerateToken(TestJWTSecret, middleware.TokenInput{User: u, RoleCodes: []string{domain.RolePlatformAdmin}})
		return token
	}

	// 生产路由按 platform 隔离（RequirePlatform）：OperatorToken 走 portal（覆盖绝大多数
	// 业务路由场景），SaasAdminToken 走 saas（/admin/* 平台管理接口专用）。
	operatorToken := generateTestToken(TestOperatorID, TestTenantID, domain.UserRoleOperator, domain.UserPlatformPortal)
	saasAdminToken := generateTestToken(TestOperatorID, TestTenantID, domain.UserRoleOperator, domain.UserPlatformSaas)

	ensureSeedData(t, pool, operatorToken)

	return &TestEnv{
		DB:             pool,
		Store:          st2,
		Router:         r,
		OperatorToken:  operatorToken,
		SaasAdminToken: saasAdminToken,
		Captcha:        h.CaptchaService(),
		Cleanup: func() {
			pool.Close()
		},
	}
}

// TrustDevice 将指定账号×设备预标记为常用设备（等价于该设备此前成功登录过），
// 使验证码规则跳过"新设备必须验证码"，仅保留失败阈值触发。无验证码环境为空操作。
func (e *TestEnv) TrustDevice(platform domain.UserPlatform, username, deviceID string) {
	if e.Captcha == nil {
		return
	}
	e.Captcha.MarkTrustedDevice(context.Background(), string(platform), username, deviceID)
}

func ensureSeedData(t *testing.T, db *pgxpool.Pool, token string) {
	t.Helper()
	ctx := context.Background()

	// 清理旧测试数据，避免 UNIQUE 约束冲突
	// 注意：引用方（FK 依赖）必须先于主体删除，否则删除会因 FK 失败
	tables := []string{
		// 引用方优先（FK 依赖），再删主体
		"learn_roads", "workflows",
		"exam_results", "exam_questions", "exam_usages", "question_banks", "exams",
		"node_knowledge_point_bindings", "node_resource_bindings", "node_homework_submissions", "node_homeworks", "node_quizzes",
		"system_course_nodes", "course_knowledge_bindings", "course_resource_bindings", "course_homework_submissions", "course_homeworks",
		"training_program_courses", "training_programs", "courses",
		"scene_evaluation_results", "course_evaluation_results", "node_evaluation_results", "task_evaluation_methods", "scenario_tasks", "scenarios",
		"resource_snapshots",
		"position_ability_bindings", "position_responsibilities", "position_certificates", "career_position_majors",
		"career_positions", "ability_domains", "ability_points", "knowledge_points", "resource_library", "tags",
		"resource_tag_relations", "user_favorites", "favorite_counters", "view_counters",
		"community_topics", "community_posts", "on_site_question_library",
		"schedule_entries", "teaching_plan_entry_classes", "teaching_plan_entries", "teaching_plans",
		"period_slots", "venues", "terms",
		"staff_titles", "industries", "majors", "org_types", "organizations",
		"lesson_batches", "scene_batches", "evaluation_batches", "affairs_batches",
		"certification_rules", "certification_ability_items", "certification_ability_points",
		"appeal_records", "user_relations", "hybrid_node_modules", "job_ability_results", "student_honors",
		// alliance 模块（开发库模板拷贝会带入脏数据，计数断言需干净起点；无 tenant_id 的表 DELETE 报错被忽略）
		"alliance_enterprise_links", "alliance_brands", "alliance_experts", "alliance_projects",
		"alliance_dictionaries", "alliance_resource_grants", "alliance_agreements", "alliance_achievements",
		"alliance_employment_jobs", "alliance_employment_projects", "alliance_employment_applications",
		"alliance_brand_topics", "alliance_permissions", "alliance_project_milestones",
		"alliance_school_info", "alliance_enterprise_agreements",
	}
	for _, tbl := range tables {
		db.Exec(ctx, "DELETE FROM "+tbl+" WHERE tenant_id = $1", TestTenantID)
	}

	db.Exec(ctx, `INSERT INTO tenants (id, name, code, status) VALUES ($1, 'Test Tenant', 'test', 'active') ON CONFLICT (id) DO NOTHING`, TestTenantID)

	pw, _ := bcrypt.GenerateFromPassword([]byte("test123"), bcrypt.DefaultCost)
	db.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids, password_changed_at)
		VALUES ($1, $2, 'operator', 'saas', 'seedtestuser', 'seedtestuser', $3, 'Test Operator', 'active', '{}', NOW() - interval '1 day')
		ON CONFLICT (id) DO UPDATE SET
			username = EXCLUDED.username,
			login_name = EXCLUDED.login_name,
			platform = EXCLUDED.platform,
			password_hash = EXCLUDED.password_hash,
			updated_at = NOW()
	`, TestOperatorID, TestTenantID, string(pw))

	db.Exec(ctx, `INSERT INTO platform_configs (key, value) VALUES ('platform_fee_rate', '0.15') ON CONFLICT (key) DO NOTHING`)
	db.Exec(ctx, `INSERT INTO platform_configs (key, value) VALUES ('min_withdrawal_amount', '100') ON CONFLICT (key) DO NOTHING`)
}

func runTestMigrations(t *testing.T, db *pgxpool.Pool) {
	t.Helper()
	ctx := context.Background()

	conn, err := db.Acquire(ctx)
	if err != nil {
		t.Fatalf("acquire connection for migrations: %v", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT NOW())`); err != nil {
		t.Fatalf("create schema_migrations table: %v", err)
	}

	migrationsDir := "migrations"
	candidates := []string{
		filepath.Join("..", "..", "migrations"),
		filepath.Join("..", "..", "..", "migrations"),
	}
	for _, d := range candidates {
		if info, err := os.Stat(d); err == nil && info.IsDir() {
			migrationsDir = d
			break
		}
	}

	files, err := os.ReadDir(migrationsDir)
	if err != nil {
		t.Fatalf("read migrations directory %s: %v", migrationsDir, err)
	}

	var migrations []string
	for _, f := range files {
		if strings.HasSuffix(f.Name(), ".up.sql") {
			migrations = append(migrations, f.Name())
		}
	}
	sort.Strings(migrations)

	for _, name := range migrations {
		version := strings.TrimSuffix(name, ".up.sql")
		var exists bool
		if err := conn.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)`, version).Scan(&exists); err != nil {
			t.Fatalf("check migration %s: %v", version, err)
		}
		if exists {
			continue
		}
		sql, err := os.ReadFile(filepath.Join(migrationsDir, name))
		if err != nil {
			t.Fatalf("read migration %s: %v", name, err)
		}
		if _, err := conn.Exec(ctx, string(sql)); err != nil {
			t.Fatalf("apply migration %s: %v", name, err)
		}
		if _, err := conn.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			t.Fatalf("record migration %s: %v", name, err)
		}
	}
}

func (e *TestEnv) Do(method, path string, body interface{}) *httptest.ResponseRecorder {
	return e.DoWithToken(method, path, body, e.OperatorToken)
}

func (e *TestEnv) DoNoAuth(method, path string, body interface{}) *httptest.ResponseRecorder {
	return e.DoWithToken(method, path, body, "")
}

func (e *TestEnv) NewUserToken(userID, tenantID string, role domain.UserRole, institutionID *string) string {
	return e.NewTokenWithIdentity(userID, tenantID, role, institutionID, domain.RolePlatformAdmin)
}

func (e *TestEnv) NewTokenWithIdentity(userID, tenantID string, role domain.UserRole, institutionID *string, roleCode string) string {
	// RequireActiveUser 逐请求校验会话态（34f12b2b 起）：辅助用户必须在库中存在。
	// 历史测试用非 UUID 字符串 ID（如 "school-admin-001"），确定性映射为 UUID v5 后落库，
	// 调用点无需改动；租户不存在时一并补种（users.tenant_id 外键）。
	realID := userID
	if _, err := uuid.Parse(userID); err != nil {
		realID = uuid.NewSHA1(uuid.NameSpaceOID, []byte("testaux:"+userID)).String()
	}
	e.seedAuxUser(realID, tenantID, role, roleCode)
	u := &domain.User{ID: realID, TenantID: &tenantID, Role: role, Platform: domain.UserPlatformPortal, Username: "aux-user", InstitutionID: institutionID}
	token, _ := middleware.GenerateToken(TestJWTSecret, middleware.TokenInput{User: u, RoleCodes: []string{roleCode}})
	return token
}

// seedAuxUser 幂等补种辅助用户（与种子 operator 一致：password_changed_at 早于 token 签发，
// 避免被「改密后旧 token 失效」误判），并按角色绑定菜单授权角色：
//   - 学生（roleCode=student）：绑定学生菜单角色（落地页 + 服务台），路由层仅放行
//     只读面（RequireMenu 管理菜单 ∪ landing），管理写 API 403——与生产菜单驱动语义一致；
//   - 其余角色：绑定 permissions.admin=true 的测试角色，RequireMenu 路由层全量放行
//     （路由层授权矩阵由 middleware/menu_test.go 单测覆盖，集成测试聚焦 handler 层
//     业务校验：越权/归属/状态机）。
func (e *TestEnv) seedAuxUser(userID, tenantID string, role domain.UserRole, roleCode string) {
	ctx := context.Background()
	// code 有全局唯一约束：按租户 ID 派生，避免多 aux 租户互撞
	code := tenantID
	if len(code) > 8 {
		code = code[:8]
	}
	if _, err := e.DB.Exec(ctx, `INSERT INTO tenants (id, name, code, status) VALUES ($1, 'Aux Tenant', $2, 'active') ON CONFLICT DO NOTHING`, tenantID, "aux-"+code); err != nil {
		fmt.Printf("SEED-TENANT-ERR: %v\n", err)
	}
	// 部分老测试把 roleCode（student/teacher）误传为 UserRole：非法枚举值归一为 school
	if role != domain.UserRoleSchool && role != domain.UserRoleEnterprise && role != domain.UserRoleOperator {
		role = domain.UserRoleSchool
	}
	platform := string(domain.UserPlatformPortal)
	if role == domain.UserRoleOperator {
		platform = "saas"
	}
	if _, err := e.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids, password_changed_at)
		VALUES ($1, $2, $3, $4, $5, $5, 'x', 'Aux User', 'active', '{}', NOW() - interval '1 day')
		ON CONFLICT (id) DO NOTHING
	`, userID, tenantID, string(role), platform, "aux-"+userID); err != nil {
		fmt.Printf("SEED-USER-ERR: %v\n", err)
	}
	// 菜单驱动 RBAC（ADR-0008）：MenuContext 查库合并角色菜单授权。
	// 学生角色绑定学生菜单（落地页 + 服务台），路由层只放行只读面；
	// 其余角色绑定 admin 测试角色全量放行（见 seedAuxUser 注释）。
	// 按角色类型派生 roleID（admin/student 互斥），并解除旧的辅助角色绑定，
	// 避免角色类型变更（测试改 roleCode）后 admin/student 双绑定叠加成全量。
	perms := `{"admin": true}`
	roleCodeName := "aux_admin_" + userID
	roleNS := "auxadmin-role:"
	if roleCode == domain.RoleStudent {
		perms = `{"menus":{"/job/landing":true,"/lesson/landing":true,"/scene/landing":true,` +
			`"/evaluation/landing":true,"/library/landing":true,"/portal/workspace":true}}`
		roleCodeName = "aux_student_" + userID
		roleNS = "auxstudent-role:"
	}
	otherNS := "auxstudent-role:"
	if roleCode == domain.RoleStudent {
		otherNS = "auxadmin-role:"
	}
	roleID := uuid.NewSHA1(uuid.NameSpaceOID, []byte(roleNS+userID)).String()
	otherRoleID := uuid.NewSHA1(uuid.NameSpaceOID, []byte(otherNS+userID)).String()
	if _, err := e.DB.Exec(ctx, `
		DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2
	`, userID, otherRoleID); err != nil {
		fmt.Printf("SEED-ROLEUNBIND-ERR: %v\n", err)
	}
	if _, err := e.DB.Exec(ctx, `
		INSERT INTO roles (id, tenant_id, code, name, description, permissions, user_count, status)
		VALUES ($1, $2, $3, '测试辅助角色', '', $4, 0, 'active')
		ON CONFLICT (id) DO UPDATE SET permissions = EXCLUDED.permissions
	`, roleID, tenantID, roleCodeName, perms); err != nil {
		fmt.Printf("SEED-ROLE-ERR: %v\n", err)
	}
	if _, err := e.DB.Exec(ctx, `
		INSERT INTO user_roles (role_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
	`, roleID, userID); err != nil {
		fmt.Printf("SEED-ROLEBIND-ERR: %v\n", err)
	}
}

func (e *TestEnv) DoWithToken(method, path string, body interface{}, token string) *httptest.ResponseRecorder {
	var reqBody *bytes.Buffer
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(b)
	} else {
		reqBody = bytes.NewBuffer(nil)
	}

	req := httptest.NewRequest(method, path, reqBody)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	w := httptest.NewRecorder()
	e.Router.ServeHTTP(w, req)
	return w
}

func Unmarshal[T any](w *httptest.ResponseRecorder) (T, error) {
	var v T
	if err := json.NewDecoder(w.Body).Decode(&v); err != nil {
		return v, fmt.Errorf("decode body: %w (status=%d body=%s)", err, w.Code, w.Body.String())
	}
	return v, nil
}

func UnmarshalList[T any](w *httptest.ResponseRecorder) ([]T, int, error) {
	type listResp struct {
		Items []T `json:"items"`
		Total int `json:"total"`
	}
	var v listResp
	if err := json.NewDecoder(w.Body).Decode(&v); err != nil {
		return nil, 0, err
	}
	return v.Items, v.Total, nil
}

func ErrMsg(w *httptest.ResponseRecorder) string {
	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	return resp["error"]
}
