package handler_test

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// landingEnv 构造 landing handler 测试环境。
type landingEnv struct {
	env      *testhelper.TestEnv
	handler  *handler.LandingHandler
	student  string
	student2 string
	classID  string
	posA     string
	posB     string
	posC     string
	posD     string
}

// setupLandingEnv 构造测试数据：
// 专业组织节点 → 班级组织节点；学生1挂班级；方案(已发布,专业=该专业)含岗位A、B（课程级），
// 岗位C 在 draft 方案中；岗位D 未关联任何方案；岗位E 属于其他租户。
func setupLandingEnv(t *testing.T) *landingEnv {
	t.Helper()
	e := testhelper.SetupTestEnv(t)
	ctx := context.Background()
	tenantID := testhelper.TestTenantID

	// 清理可能残留的测试用户（users 不在 ensureSeedData 清理列表，且用户名有租户级唯一约束）
	if _, err := e.DB.Exec(ctx, `DELETE FROM users WHERE tenant_id = $1 AND login_name LIKE 'stu%'`, tenantID); err != nil {
		t.Fatalf("cleanup students: %v", err)
	}

	st := store.New(e.DB)
	landingHandler := &handler.LandingHandler{Service: service.NewPositionService(service.New(st))}

	le := &landingEnv{env: e, handler: landingHandler}

	// 组织类型：专业/班级
	var orgTypeMajorID, orgTypeClassID string
	if err := e.DB.QueryRow(ctx, `INSERT INTO org_types (id, tenant_id, name, category) VALUES (gen_random_uuid(), $1, '专业', 'internal') RETURNING id`, tenantID).Scan(&orgTypeMajorID); err != nil {
		t.Fatalf("create major org type: %v", err)
	}
	if err := e.DB.QueryRow(ctx, `INSERT INTO org_types (id, tenant_id, name, category) VALUES (gen_random_uuid(), $1, '班级', 'internal') RETURNING id`, tenantID).Scan(&orgTypeClassID); err != nil {
		t.Fatalf("create class org type: %v", err)
	}

	// 专业（majors + 组织节点同名）
	majorID := uuid.NewString()
	if _, err := e.DB.Exec(ctx, `INSERT INTO majors (id, tenant_id, code, name) VALUES ($1, $2, 'MAJ-001', '软件工程')`, majorID, tenantID); err != nil {
		t.Fatalf("create major: %v", err)
	}
	majorOrgID := uuid.NewString()
	if _, err := e.DB.Exec(ctx, `INSERT INTO organizations (id, tenant_id, name, type_id) VALUES ($1, $2, '软件工程', $3)`, majorOrgID, tenantID, orgTypeMajorID); err != nil {
		t.Fatalf("create major org: %v", err)
	}
	le.classID = uuid.NewString()
	if _, err := e.DB.Exec(ctx, `INSERT INTO organizations (id, tenant_id, name, type_id, parent_id) VALUES ($1, $2, '软件工程2401班', $3, $4)`, le.classID, tenantID, orgTypeClassID, majorOrgID); err != nil {
		t.Fatalf("create class org: %v", err)
	}

	// 学生（users.role 统一 school，业务角色经 user_roles 关联）
	le.student = uuid.NewString()
	if _, err := e.DB.Exec(ctx, `INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, org_node_id)
		VALUES ($1, $2, 'school', 'portal', 'stu1', 'stu1', 'x', '学生1', 'active', $3) ON CONFLICT (id) DO NOTHING`, le.student, tenantID, le.classID); err != nil {
		t.Fatalf("create student: %v", err)
	}
	le.student2 = uuid.NewString()
	if _, err := e.DB.Exec(ctx, `INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status)
		VALUES ($1, $2, 'school', 'portal', 'stu2', 'stu2', 'x', '学生2（未分班）', 'active') ON CONFLICT (id) DO NOTHING`, le.student2, tenantID); err != nil {
		t.Fatalf("create unassigned student: %v", err)
	}

	// 岗位
	createPosition := func(name string) string {
		id := uuid.NewString()
		if _, err := e.DB.Exec(ctx, `INSERT INTO career_positions (id, tenant_id, name, code, position_type, version, status, created_by)
			VALUES ($1, $2, $3, $4, 'enterprise', 'v1', 'published', $5)`, id, tenantID, name, "GW-"+name, testhelper.TestOperatorID); err != nil {
			t.Fatalf("create position %s: %v", name, err)
		}
		return id
	}
	le.posA = createPosition("后端开发工程师")
	le.posB = createPosition("前端开发工程师")
	le.posC = createPosition("测试工程师")
	le.posD = createPosition("运维工程师")
	// 其他租户岗位（career_positions.tenant_id 有 FK，需先建租户；code 租户级唯一，用随机值避免跨测试冲突）
	foreignTenantID := uuid.NewString()
	foreignCode := "foreign" + uuid.NewString()[:8]
	if _, err := e.DB.Exec(ctx, `INSERT INTO tenants (id, name, code, status) VALUES ($1, 'Foreign', $2, 'active') ON CONFLICT (id) DO NOTHING`, foreignTenantID, foreignCode); err != nil {
		t.Fatalf("create foreign tenant: %v", err)
	}
	posE := uuid.NewString()
	if _, err := e.DB.Exec(ctx, `INSERT INTO career_positions (id, tenant_id, name, code, position_type, version, status, created_by)
		VALUES ($1, $2, $3, $4, 'enterprise', 'v1', 'published', $5)`, posE, foreignTenantID, "外租户岗位", "GW-OUT", testhelper.TestOperatorID); err != nil {
		t.Fatalf("create foreign position: %v", err)
	}

	// 方案：published（含 A、B），draft（含 C）
	createProgram := func(status string) string {
		id := uuid.NewString()
		if _, err := e.DB.Exec(ctx, `INSERT INTO training_programs (id, tenant_id, name, code, major_id, entry_year, status, created_by)
			VALUES ($1, $2, $3, $4, $5, 2024, $6, $7)`, id, tenantID, "2024软件工程培养方案", "FA-2024", majorID, status, testhelper.TestOperatorID); err != nil {
			t.Fatalf("create program %s: %v", status, err)
		}
		return id
	}
	publishedProgram := createProgram("published")
	draftProgram := createProgram("draft")

	linkPosition := func(programID, positionID, name string) {
		if _, err := e.DB.Exec(ctx, `INSERT INTO training_program_courses (program_id, name, position_id, semester)
			VALUES ($1, $2, $3, 1)`, programID, name, positionID); err != nil {
			t.Fatalf("link position course: %v", err)
		}
	}
	linkPosition(publishedProgram, le.posA, "后端开发岗位课程")
	linkPosition(publishedProgram, le.posB, "前端开发岗位课程")
	linkPosition(publishedProgram, le.posA, "后端开发岗位课程（重复关联）")
	linkPosition(draftProgram, le.posC, "测试岗位课程")
	linkPosition(publishedProgram, le.posD, "运维岗位课程")

	return le
}

func (le *landingEnv) listTarget(claims *middleware.Claims) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", "/job/landing/target-positions", nil)
	req = req.WithContext(context.WithValue(req.Context(), middleware.ContextKeyUser, claims))
	w := httptest.NewRecorder()
	le.handler.ListTargetPositions(w, req)
	return w
}

// TestLanding_TargetPositions 学生目标岗位来自人培方案排给班级的岗位。
func TestLanding_TargetPositions(t *testing.T) {
	le := setupLandingEnv(t)
	defer le.env.Cleanup()

	tenantID := testhelper.TestTenantID
	studentClaims := &middleware.Claims{UserID: le.student, TenantID: &tenantID}

	w := le.listTarget(studentClaims)
	if w.Code != 200 {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var resp struct {
		Items []domain.CareerPosition `json:"items"`
		Total int                     `json:"total"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if resp.Total != 3 {
		t.Fatalf("total = %d, want 3（岗位A、B、D；重复关联去重；draft 方案岗位C、外租户岗位E 不出现）", resp.Total)
	}
	ids := map[string]bool{}
	for _, p := range resp.Items {
		ids[p.ID] = true
	}
	if !ids[le.posA] || !ids[le.posB] || !ids[le.posD] {
		t.Fatalf("target positions = %v, want A, B and D", ids)
	}
	if ids[le.posC] {
		t.Fatalf("unexpected positions: %v", ids)
	}
	for _, p := range resp.Items {
		if p.Status != domain.StatusPublished {
			t.Errorf("position %s status = %s, want published", p.ID, p.Status)
		}
	}
}

// TestLanding_TargetPositions_NoClass 未分班学生无目标岗位。
func TestLanding_TargetPositions_NoClass(t *testing.T) {
	le := setupLandingEnv(t)
	defer le.env.Cleanup()

	tenantID := testhelper.TestTenantID
	w := le.listTarget(&middleware.Claims{UserID: le.student2, TenantID: &tenantID})
	if w.Code != 200 {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	items, total, err := testhelper.UnmarshalList[domain.CareerPosition](w)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if total != 0 || len(items) != 0 {
		t.Fatalf("total = %d, items = %d, want 0（未分班学生无班级节点）", total, len(items))
	}
}

// TestLanding_TargetPositions_NoAuth 未登录拒绝访问。
func TestLanding_TargetPositions_NoAuth(t *testing.T) {
	le := setupLandingEnv(t)
	defer le.env.Cleanup()

	w := le.listTarget(nil)
	if w.Code != 403 {
		t.Fatalf("status = %d, want 403", w.Code)
	}
}
