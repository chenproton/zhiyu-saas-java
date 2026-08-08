package handler_test

import (
	"bytes"
	"context"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

// TestBrandTemplateAlignsWithFrontend 校验品牌内容导入模板表头与前端表单展示字段完全对齐：
// 名称/状态/描述/封面图URL/是否公开/是否推荐 + 六类关联对象（学生/企业/岗位/专业/教师/专家）。
func TestBrandTemplateAlignsWithFrontend(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	claims := &middleware.Claims{
		UserID:      testhelper.TestOperatorID,
		TenantID:    &tenantID,
		Permissions: map[string]interface{}{"admin": true},
	}

	// 1. 通过模板下载接口获取系统生成的品牌模板，校验表头
	req := httptest.NewRequest("GET", "/api/v1/templates/alliance-brands", nil)
	req = req.WithContext(context.WithValue(req.Context(), middleware.ContextKeyUser, claims))
	w := httptest.NewRecorder()
	(&handler.TemplateHandler{}).ServeBrandTemplate(w, req)
	if w.Code != 200 {
		t.Fatalf("模板下载失败: %d %s", w.Code, w.Body.String())
	}
	f, err := excelize.OpenReader(bytes.NewReader(w.Body.Bytes()))
	if err != nil {
		t.Fatalf("解析模板失败: %v", err)
	}
	defer f.Close()
	rows, _ := f.GetRows("品牌内容")
	if len(rows) < 2 {
		t.Fatalf("模板缺少表头")
	}
	wantHeaders := []string{
		"品牌类型 *", "名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL",
		"关联学生名称", "关联企业名称", "关联岗位名称", "关联专业名称", "关联教师名称", "关联专家名称",
	}
	got := rows[1]
	if len(got) != len(wantHeaders) {
		t.Fatalf("表头数量不一致: got %d want %d (%v)", len(got), len(wantHeaders), got)
	}
	for i := range wantHeaders {
		if got[i] != wantHeaders[i] {
			t.Fatalf("表头第%d列不一致: got %q want %q", i+1, got[i], wantHeaders[i])
		}
	}
}

// TestBrandImportAllFields 验证品牌内容导入：状态/公开/推荐/封面图/六类关联对象名称匹配。
func TestBrandImportAllFields(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	claims := &middleware.Claims{
		UserID:      testhelper.TestOperatorID,
		TenantID:    &tenantID,
		Permissions: map[string]interface{}{"admin": true},
	}
	ctx := context.Background()

	// 清理品牌与关联测试数据（关联对象按名称清理，避免重复运行遗留同名记录影响匹配）
	env.DB.Exec(ctx, `DELETE FROM alliance_brands WHERE tenant_id=$1`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE tenant_id=$1 AND name=$2`, tenantID, "测试关联企业")
	env.DB.Exec(ctx, `DELETE FROM career_positions WHERE tenant_id=$1 AND name=$2`, tenantID, "测试关联岗位")
	env.DB.Exec(ctx, `DELETE FROM majors WHERE tenant_id=$1 AND name=$2`, tenantID, "测试关联专业")
	env.DB.Exec(ctx, `DELETE FROM alliance_experts WHERE tenant_id=$1 AND name=$2`, tenantID, "测试关联专家")
	env.DB.Exec(ctx, `DELETE FROM users WHERE tenant_id=$1 AND name IN ($2,$3)`, tenantID, "测试学生甲", "测试教师甲")

	// 准备关联对象（users 无 student/teacher 角色，按姓名匹配任意角色用户）
	studentID := uuid.NewString()
	teacherID := uuid.NewString()
	entID := uuid.NewString()
	posID := uuid.NewString()
	majorID := uuid.NewString()
	expID := uuid.NewString()
	pw := "x"
	env.DB.Exec(ctx, `INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1,$2,'operator','saas','tstu','tstu',$3,'测试学生甲','active','{}')`, studentID, tenantID, pw)
	env.DB.Exec(ctx, `INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1,$2,'operator','saas','tteach','tteach',$3,'测试教师甲','active','{}')`, teacherID, tenantID, pw)
	env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`, entID, tenantID, "测试关联企业")
	env.DB.Exec(ctx, `INSERT INTO career_positions (id, tenant_id, name, position_type, version, status, created_by, code)
		VALUES ($1,$2,$3,'profession','v1','published',$4,$5)`, posID, tenantID, "测试关联岗位", testhelper.TestOperatorID, "TEST-POS-01")
	env.DB.Exec(ctx, `INSERT INTO majors (id, tenant_id, code, name) VALUES ($1,$2,$3,$4)`, majorID, tenantID, "TEST-01", "测试关联专业")
	env.DB.Exec(ctx, `INSERT INTO alliance_experts (id, tenant_id, name, status) VALUES ($1,$2,$3,'active')`, expID, tenantID, "测试关联专家")

	// 2. 导入 6 类品牌（与前端 6 个页面字段一一对应）
	file := buildExcel(t, "品牌内容", [][]interface{}{
		{"填写说明"},
		{"品牌类型 *", "名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联学生名称", "关联企业名称", "关联岗位名称", "关联专业名称", "关联教师名称", "关联专家名称"},
		{"人才品牌", "测试人才品牌", "人才品牌描述", "已发布", "是", "是", "https://example.com/talent.jpg", "测试学生甲", "", "", "测试关联专业", "", ""},
		{"雇主品牌", "测试雇主品牌", "雇主品牌描述", "草稿", "否", "否", "", "", "测试关联企业", "", "", "", ""},
		{"岗位品牌", "测试岗位品牌", "岗位品牌描述", "已发布", "是", "否", "https://example.com/job.jpg", "", "", "测试关联岗位", "", "", ""},
		{"专业品牌", "测试专业品牌", "专业品牌描述", "草稿", "否", "是", "", "", "", "", "测试关联专业", "", ""},
		{"师资品牌", "测试师资品牌", "师资品牌描述", "已发布", "是", "是", "https://example.com/teacher.jpg", "", "", "", "", "测试教师甲", "测试关联专家"},
		{"文化品牌", "测试文化品牌", "文化品牌描述", "已归档", "否", "否", "", "", "", "", "测试关联专业", "", ""},
	})
	h := &handler.ResourceImportHandler{Store: env.Store}
	w := httptest.NewRecorder()
	h.ImportBrands(w, makeRequest(t, "/import/alliance-brands/excel", file, claims))
	if w.Code != 200 {
		t.Fatalf("品牌导入失败: %d %s", w.Code, w.Body.String())
	}

	type brandRow struct {
		status string
		isPub  bool
		isFeat bool
		cover  *string
		st     *string
		ent    *string
		pos    *string
		major  *string
		teach  *string
		exp    *string
	}
	check := func(brandType, name string, want statusWant) {
		t.Helper()
		var br brandRow
		err := env.DB.QueryRow(ctx, `SELECT status, is_public, is_featured, cover_image,
			student_id, enterprise_id, position_id, major_id, teacher_id, expert_id
			FROM alliance_brands WHERE tenant_id=$1 AND brand_type=$2 AND name=$3`,
			tenantID, brandType, name).Scan(&br.status, &br.isPub, &br.isFeat, &br.cover,
			&br.st, &br.ent, &br.pos, &br.major, &br.teach, &br.exp)
		if err != nil {
			t.Fatalf("查询品牌[%s/%s]失败: %v", brandType, name, err)
		}
		if br.status != want.status || br.isPub != want.isPub || br.isFeat != want.isFeat {
			t.Fatalf("品牌[%s/%s]状态字段不一致: got status=%s pub=%v feat=%v, want status=%s pub=%v feat=%v",
				brandType, name, br.status, br.isPub, br.isFeat, want.status, want.isPub, want.isFeat)
		}
		if want.cover != "" && (br.cover == nil || *br.cover != want.cover) {
			t.Fatalf("品牌[%s/%s]封面图不一致: got %v", brandType, name, br.cover)
		}
		checkID := func(label string, got *string, wantID string) {
			t.Helper()
			if wantID == "" {
				if got != nil {
					t.Fatalf("品牌[%s/%s]%s应为空, got %s", brandType, name, label, *got)
				}
				return
			}
			if got == nil || *got != wantID {
				t.Fatalf("品牌[%s/%s]%s未按名称匹配: got %v want %s", brandType, name, label, got, wantID)
			}
		}
		checkID("关联学生", br.st, want.studentID)
		checkID("关联企业", br.ent, want.entID)
		checkID("关联岗位", br.pos, want.posID)
		checkID("关联专业", br.major, want.majorID)
		checkID("关联教师", br.teach, want.teacherID)
		checkID("关联专家", br.exp, want.expID)
	}

	check("talent", "测试人才品牌", statusWant{status: "published", isPub: true, isFeat: true, cover: "https://example.com/talent.jpg", studentID: studentID, majorID: majorID})
	check("employer", "测试雇主品牌", statusWant{status: "draft", entID: entID})
	check("job", "测试岗位品牌", statusWant{status: "published", isPub: true, cover: "https://example.com/job.jpg", posID: posID})
	check("major", "测试专业品牌", statusWant{status: "draft", isFeat: true, majorID: majorID})
	check("teacher", "测试师资品牌", statusWant{status: "published", isPub: true, isFeat: true, cover: "https://example.com/teacher.jpg", teacherID: teacherID, expID: expID})
	check("culture", "测试文化品牌", statusWant{status: "archived", majorID: majorID})
}

type statusWant struct {
	status    string
	isPub     bool
	isFeat    bool
	cover     string
	studentID string
	entID     string
	posID     string
	majorID   string
	teacherID string
	expID     string
}
