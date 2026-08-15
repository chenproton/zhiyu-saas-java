package store

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// 就业服务（供需大厅）store 集成测试：学生可见性匹配 / 投递档案快照 / 唯一防重。
// TEST_DATABASE_URL 未配置时自动跳过（与 alliance_grant_store_test.go 同模式）。

func testEmploymentPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("create pool: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func employmentTestTenant(t *testing.T, pool *pgxpool.Pool, prefix string) string {
	t.Helper()
	id := uuid.NewString()
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO tenants (id, name, code, status) VALUES ($1, $2, $3, 'active')
	`, id, prefix+uuid.NewString()[:8], prefix+uuid.NewString()[:8]); err != nil {
		t.Fatalf("预置租户: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(context.Background(), `DELETE FROM tenants WHERE id = $1`, id)
	})
	return id
}

// TestAllianceEmployment_VisibilityAndApply 核心规则集成测试。
func TestAllianceEmployment_VisibilityAndApply(t *testing.T) {
	pool := testEmploymentPool(t)
	ctx := context.Background()
	st := New(pool).Alliance()

	schoolTenant := employmentTestTenant(t, pool, "emp-school-")
	entTenant := employmentTestTenant(t, pool, "emp-ent-")

	// 组织树：学院 → 班级；专业；两名学生（画像1 在范围内，画像2 在范围外）
	collegeID := uuid.NewString()
	classID := uuid.NewString()
	orgTypeID := uuid.NewString()
	if _, err := pool.Exec(ctx, `
		INSERT INTO org_types (id, tenant_id, name, category, is_default) VALUES ($1, $2, '院系', 'internal', false)
	`, orgTypeID, schoolTenant); err != nil {
		t.Fatalf("预置组织类型: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		INSERT INTO organizations (id, tenant_id, name, type_id, parent_id) VALUES
		($1, $3, '信息学院', $4, NULL),
		($2, $3, '计科2301班', $4, $1)
	`, collegeID, classID, schoolTenant, orgTypeID); err != nil {
		t.Fatalf("预置组织树: %v", err)
	}
	majorID := uuid.NewString()
	if _, err := pool.Exec(ctx, `
		INSERT INTO majors (id, tenant_id, code, name) VALUES ($1, $2, 'CS', '计算机科学')
	`, majorID, schoolTenant); err != nil {
		t.Fatalf("预置专业: %v", err)
	}
	mkStudent := func(name string, orgNode, major *string, year *int) string {
		id := uuid.NewString()
		if _, err := pool.Exec(ctx, `
			INSERT INTO users (id, tenant_id, org_node_id, major_id, graduate_year, role, platform, username, password_hash, name, student_no, phone, email, status)
			VALUES ($1, $2, $3, $4, $5, 'operator', 'portal', $6, 'hash', $6, $7, '13800000000', $8, 'active')
		`, id, schoolTenant, orgNode, major, year, name+"-"+uuid.NewString()[:6], "202301", name+"@test.local"); err != nil {
			t.Fatalf("预置学生: %v", err)
		}
		return id
	}
	year2026 := 2026
	year2025 := 2025
	studentIn := mkStudent("范围内学生", &classID, &majorID, &year2026)
	studentOut := mkStudent("范围外学生", nil, nil, &year2025)

	// 企业主体
	enterpriseID := uuid.NewString()
	if _, err := pool.Exec(ctx, `
		INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1, $2, $3)
	`, enterpriseID, entTenant, "就业测试企业-"+uuid.NewString()[:8]); err != nil {
		t.Fatalf("预置企业: %v", err)
	}

	// 三个已发布项目：A 面向信息学院 / B 面向 CS+2026 / C 空（全校） + 一个草稿项目 D
	mkProject := func(name, status string, targetGroups string) string {
		id := uuid.NewString()
		if _, err := pool.Exec(ctx, `
			INSERT INTO alliance_employment_projects (id, tenant_id, name, type, publish_status, enterprise_ids, target_groups)
			VALUES ($1, $2, $3, 'spring', $4, $5::jsonb, $6::jsonb)
		`, id, schoolTenant, name, status, `["`+enterpriseID+`"]`, targetGroups); err != nil {
			t.Fatalf("预置项目: %v", err)
		}
		return id
	}
	projA := mkProject("项目A-信息学院", "published", `[{"orgNodeId":"`+collegeID+`","orgNodeName":"信息学院"}]`)
	mkProject("项目B-CS2026", "published", `[{"majorId":"`+majorID+`","graduateYear":2026}]`)
	projC := mkProject("项目C-全校", "published", `[]`)
	projD := mkProject("项目D-草稿", "draft", `[]`)

	mkJob := func(title, projectID, status string) string {
		id := uuid.NewString()
		if _, err := pool.Exec(ctx, `
			INSERT INTO alliance_employment_jobs (id, tenant_id, enterprise_id, project_id, title, job_type, status)
			VALUES ($1, $2, $3, $4, $5, 'full-time', $6)
		`, id, schoolTenant, enterpriseID, projectID, title, status); err != nil {
			t.Fatalf("预置岗位: %v", err)
		}
		return id
	}
	jobA := mkJob("岗位A", projA, "published")
	jobDraft := mkJob("岗位-草稿", projA, "draft")
	jobD := mkJob("岗位D-草稿项目", projD, "published")

	names := func(items []domain.EmploymentProject) []string {
		out := make([]string, 0, len(items))
		for _, p := range items {
			out = append(out, p.Name)
		}
		return out
	}
	contains := func(list []string, name string) bool {
		for _, s := range list {
			if s == name {
				return true
			}
		}
		return false
	}

	// 1. 学生画像：组织祖先链应含 班级+学院
	scopeIn, err := st.GetEmploymentStudentScope(ctx, studentIn)
	if err != nil {
		t.Fatalf("GetEmploymentStudentScope: %v", err)
	}
	if len(scopeIn.OrgPathIDs) != 2 {
		t.Fatalf("范围内学生组织祖先链应为 2（班级+学院），实得 %v", scopeIn.OrgPathIDs)
	}

	// 2. 大厅浏览全量可见（2026-08 语义变更：target_groups 控制投递资格，不再控制可见性）：
	// 任意登录用户可见全部已发布项目 A/B/C，不见草稿 D
	listIn, err := st.ListPublicEmploymentProjects(ctx, schoolTenant, 100, 0)
	if err != nil {
		t.Fatalf("ListPublicEmploymentProjects: %v", err)
	}
	got := names(listIn)
	for _, want := range []string{"项目A-信息学院", "项目B-CS2026", "项目C-全校"} {
		if !contains(got, want) {
			t.Fatalf("大厅应见 %s，实际 %v", want, got)
		}
	}
	if contains(got, "项目D-草稿") {
		t.Fatalf("草稿项目不应出现在大厅: %v", got)
	}

	// 3. 范围外学生画像（用于投递资格断言）
	scopeOut, err := st.GetEmploymentStudentScope(ctx, studentOut)
	if err != nil {
		t.Fatalf("GetEmploymentStudentScope(out): %v", err)
	}

	// 4. 投递：档案快照带出 + 求职信落库
	appID, err := st.CreateEmploymentApplication(ctx, jobA, scopeIn, studentIn, "  您好，我想应聘  ")
	if err != nil {
		t.Fatalf("CreateEmploymentApplication: %v", err)
	}
	if appID == "" {
		t.Fatal("投递已发布岗位应返回 id")
	}
	var majorName, className, cover *string
	if err := pool.QueryRow(ctx, `
		SELECT major_name, class_name, cover_letter FROM alliance_employment_applications WHERE id = $1
	`, appID).Scan(&majorName, &className, &cover); err != nil {
		t.Fatalf("回读投递: %v", err)
	}
	if majorName == nil || *majorName != "计算机科学" || className == nil || *className != "计科2301班" {
		t.Fatalf("档案快照带出错误: major=%v class=%v", majorName, className)
	}

	// 5. 重复投递 → 唯一约束冲突（IsUniqueViolation）
	if _, err := st.CreateEmploymentApplication(ctx, jobA, scopeIn, studentIn, "again"); err == nil || !IsUniqueViolation(err) {
		t.Fatalf("重复投递应触发唯一约束冲突，实得 %v", err)
	}

	// 6. 草稿岗位不可投递（返回空 id 无错误）
	if id, err := st.CreateEmploymentApplication(ctx, jobDraft, scopeIn, studentIn, "x"); err != nil || id != "" {
		t.Fatalf("投递草稿岗位应返回空 id，实得 id=%q err=%v", id, err)
	}

	// 7. 范围外学生投递项目A岗位（可见但无投递资格）→ ErrEmploymentNotEligible
	if id, err := st.CreateEmploymentApplication(ctx, jobA, scopeOut, studentOut, "x"); err == nil || !IsEmploymentNotEligible(err) || id != "" {
		t.Fatalf("范围外学生投递应返回资格不符错误，实得 id=%q err=%v", id, err)
	}
	// 范围内学生投递项目C（空 target_groups=全校可投）的岗位列表校验 → 正常返回
	jobsC, err := st.ListPublicEmploymentJobsByProject(ctx, projC, schoolTenant)
	if err != nil || len(jobsC) != 0 {
		t.Fatalf("项目C无岗位应为空列表，实得 len=%d err=%v", len(jobsC), err)
	}

	// 8. 大厅岗位详情：浏览全量可见——范围外学生同样可读已发布岗位
	if _, err := st.GetPublicEmploymentJobByID(ctx, jobA, schoolTenant); err != nil {
		t.Fatalf("已发布岗位详情应对所有登录用户可读: %v", err)
	}
	// 未发布项目下的岗位详情仍不可见
	if _, err := st.GetPublicEmploymentJobByID(ctx, jobD, schoolTenant); err == nil {
		t.Fatal("草稿项目下的岗位详情不应可读")
	}

	// 9. 封面图字段读写往返（migration 165）
	coverURL := "https://example.com/cover.jpg"
	coverProjID, err := st.CreateEmploymentProject(ctx, &domain.EmploymentProject{
		TenantID: schoolTenant, Name: "项目E-封面", Type: "spring", PublishStatus: "draft",
		CoverImage: &coverURL,
	})
	if err != nil {
		t.Fatalf("CreateEmploymentProject(封面): %v", err)
	}
	cp, err := st.GetEmploymentProjectByID(ctx, coverProjID, schoolTenant)
	if err != nil || cp.CoverImage == nil || *cp.CoverImage != coverURL {
		t.Fatalf("封面读回失败: cp=%+v err=%v", cp, err)
	}
	newCover := "https://example.com/cover2.jpg"
	cp.CoverImage = &newCover
	if err := st.UpdateEmploymentProject(ctx, coverProjID, schoolTenant, cp); err != nil {
		t.Fatalf("UpdateEmploymentProject(封面): %v", err)
	}
	cp2, _ := st.GetEmploymentProjectByID(ctx, coverProjID, schoolTenant)
	if cp2.CoverImage == nil || *cp2.CoverImage != newCover {
		t.Fatalf("封面更新读回失败: %+v", cp2)
	}

	// 10. 企业发布岗位并绑定项目（回归：enterprise_id 与 enterprise_ids 共用参数时
	// 服务端把参数推断为 uuid，jsonb ? 需显式 ::text，否则 SQLSTATE 42883）
	ok, err := st.SetPartnerEmploymentJobStatus(ctx, jobDraft, enterpriseID, "published", projA)
	if err != nil || !ok {
		t.Fatalf("发布并绑定已分配项目应成功，实得 ok=%v err=%v", ok, err)
	}
	// 绑定不存在/未分配的项目 → 0 行命中返回 false（不报错）
	if ok, err := st.SetPartnerEmploymentJobStatus(ctx, jobDraft, enterpriseID, "published", uuid.NewString()); err != nil || ok {
		t.Fatalf("绑定未分配项目应返回 false，实得 ok=%v err=%v", ok, err)
	}
}
