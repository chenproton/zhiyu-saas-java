package testhelper

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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
	Cleanup        func()
}

func SetupTestEnv(t *testing.T) *TestEnv {
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
	h := router.NewHandlers(pool, TestJWTSecret, &handler.FileHandler{UploadDir: ""}, nil)
	r := chi.NewRouter()
	router.RegisterAPIRoutes(r, TestJWTSecret, pool, h, nil, nil)

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
		Cleanup: func() {
			pool.Close()
		},
	}
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
		"scene_evaluation_results", "course_evaluation_results", "task_evaluation_methods", "scenario_tasks", "scenarios",
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
	}
	for _, tbl := range tables {
		db.Exec(ctx, "DELETE FROM "+tbl+" WHERE tenant_id = $1", TestTenantID)
	}

	db.Exec(ctx, `INSERT INTO tenants (id, name, code, status) VALUES ($1, 'Test Tenant', 'test', 'active') ON CONFLICT (id) DO NOTHING`, TestTenantID)

	pw, _ := bcrypt.GenerateFromPassword([]byte("test123"), bcrypt.DefaultCost)
	db.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'operator', 'saas', 'seedtestuser', 'seedtestuser', $3, 'Test Operator', 'active', '{}')
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
	u := &domain.User{ID: userID, TenantID: &tenantID, Role: role, Platform: domain.UserPlatformPortal, Username: "aux-user", InstitutionID: institutionID}
	token, _ := middleware.GenerateToken(TestJWTSecret, middleware.TokenInput{User: u, RoleCodes: []string{roleCode}})
	return token
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
