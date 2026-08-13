package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
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

// ===== 类型化导入（按页面模板） =====

// brandImportEnv 类型化导入测试公共数据：角色/关联对象/基础专业。
func brandImportEnv(t *testing.T, env *testhelper.TestEnv) (tenantID string, claims *middleware.Claims, ids map[string]string) {
	t.Helper()
	ctx := context.Background()
	tenantID = testhelper.TestTenantID
	claims = &middleware.Claims{
		UserID:      testhelper.TestOperatorID,
		TenantID:    &tenantID,
		Permissions: map[string]interface{}{"admin": true},
	}

	env.DB.Exec(ctx, `DELETE FROM alliance_brands WHERE tenant_id=$1`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM alliance_enterprise_links WHERE tenant_id=$1`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE tenant_id=$1 AND name IN ('测试学生甲','测试教师甲'))`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM roles WHERE tenant_id=$1 AND code IN ('teacher','student')`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM users WHERE tenant_id=$1 AND name IN ('测试学生甲','测试教师甲')`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE tenant_id=$1 AND name IN ('测试关联企业','测试合作企业B')`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM career_positions WHERE tenant_id=$1 AND name IN ('测试教学岗位','测试企业岗位')`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM career_position_majors WHERE career_position_id IN (SELECT id FROM career_positions WHERE tenant_id=$1)`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM position_responsibilities WHERE tenant_id=$1`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM alliance_achievements WHERE tenant_id=$1`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM courses WHERE tenant_id=$1`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM alliance_experts WHERE tenant_id=$1 AND name IN ('测试关联专家')`, tenantID)
	env.DB.Exec(ctx, `DELETE FROM majors WHERE tenant_id=$1 AND name IN ('测试关联专业','测试专业甲','测试专业乙')`, tenantID)

	ids = map[string]string{}
	pw := "x"
	env.DB.Exec(ctx, `INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1,$2,'operator','saas','tstu2','tstu2',$3,'测试学生甲','active','{}')`, uuid.NewString(), tenantID, pw)
	var studentID string
	env.DB.QueryRow(ctx, `SELECT id FROM users WHERE tenant_id=$1 AND name='测试学生甲'`, tenantID).Scan(&studentID)
	ids["student"] = studentID
	env.DB.Exec(ctx, `INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1,$2,'operator','saas','tteach2','tteach2',$3,'测试教师甲','active','{}')`, uuid.NewString(), tenantID, pw)
	var teacherID string
	env.DB.QueryRow(ctx, `SELECT id FROM users WHERE tenant_id=$1 AND name='测试教师甲'`, tenantID).Scan(&teacherID)
	ids["teacher"] = teacherID
	for code, uid := range map[string]string{"student": studentID, "teacher": teacherID} {
		roleID := uuid.NewString()
		env.DB.Exec(ctx, `INSERT INTO roles (id, tenant_id, code, name, permissions, user_count, status) VALUES ($1,$2,$3,$4,'{}',0,'active')`, roleID, tenantID, code, code)
		env.DB.Exec(ctx, `INSERT INTO user_roles (role_id, user_id) VALUES ($1,$2)`, roleID, uid)
	}

	entID := uuid.NewString()
	env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,'测试关联企业')`, entID, tenantID)
	ids["enterprise"] = entID
	entBID := uuid.NewString()
	env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,'测试合作企业B')`, entBID, tenantID)
	ids["enterpriseB"] = entBID

	teachingID := uuid.NewString()
	env.DB.Exec(ctx, `INSERT INTO career_positions (id, tenant_id, name, position_type, version, status, created_by, code)
		VALUES ($1,$2,$3,'teaching','v1','published',$4,'TEACH-01')`, teachingID, tenantID, "测试教学岗位", testhelper.TestOperatorID)
	ids["teachingPosition"] = teachingID

	majorID := uuid.NewString()
	env.DB.Exec(ctx, `INSERT INTO majors (id, tenant_id, code, name) VALUES ($1,$2,'TEST-02','测试关联专业')`, majorID, tenantID)
	ids["major"] = majorID
	majorA := uuid.NewString()
	env.DB.Exec(ctx, `INSERT INTO majors (id, tenant_id, code, name) VALUES ($1,$2,'MAJ-A','测试专业甲')`, majorA, tenantID)
	ids["majorA"] = majorA
	env.DB.Exec(ctx, `INSERT INTO majors (id, tenant_id, code, name) VALUES ($1,$2,'MAJ-B','测试专业乙')`, uuid.NewString(), tenantID)

	expID := uuid.NewString()
	env.DB.Exec(ctx, `INSERT INTO alliance_experts (id, tenant_id, name, status) VALUES ($1,$2,'测试关联专家','active')`, expID, tenantID)
	ids["expert"] = expID

	jobBrandID := uuid.NewString()
	env.DB.Exec(ctx, `INSERT INTO alliance_brands (id, tenant_id, brand_type, name, status, is_public, created_at, updated_at)
		VALUES ($1,$2,'job','测试岗位品牌甲','draft',false,NOW(),NOW())`, jobBrandID, tenantID)
	ids["jobBrand"] = jobBrandID

	achID := uuid.NewString()
	env.DB.Exec(ctx, `INSERT INTO alliance_achievements (id, tenant_id, title, type, status) VALUES ($1,$2,'测试成果C','custom','draft')`, achID, tenantID)
	ids["achievement"] = achID

	courseID := uuid.NewString()
	env.DB.Exec(ctx, `INSERT INTO courses (id, tenant_id, code, name, type, category, status, creator_id)
		VALUES ($1,$2,'C-01','测试课程D','custom','custom','draft',$3)`, courseID, tenantID, testhelper.TestOperatorID)
	ids["course"] = courseID

	return tenantID, claims, ids
}

// TestBrandTypeTemplates 校验六类类型化模板表头，且 major 模板预填系统专业。
func TestBrandTypeTemplates(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	tenantID := testhelper.TestTenantID
	claims := &middleware.Claims{
		UserID:      testhelper.TestOperatorID,
		TenantID:    &tenantID,
		Permissions: map[string]interface{}{"admin": true},
	}
	ctx := context.Background()
	env.DB.Exec(ctx, `DELETE FROM majors WHERE tenant_id=$1 AND name='模板预填专业'`, tenantID)
	env.DB.Exec(ctx, `INSERT INTO majors (id, tenant_id, code, name) VALUES ($1,$2,'TPL-01','模板预填专业')`, uuid.NewString(), tenantID)

	wantHeaders := map[string][]string{
		"talent":   {"案例名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联学生名称", "关联专业名称"},
		"employer": {"企业类型 *", "企业名称 *", "是否公开", "是否推荐", "统一社会信用代码", "所属行业", "所在地区", "成立年份", "企业规模（人数）", "关联二级学院", "企业简介", "联系人", "联系电话", "联系邮箱", "详细地址", "企业Logo URL", "企业主页封面 URL", "企业风采照片URL", "企业营业执照URL", "企业知识产权URL", "企业荣誉资质URL"},
		"job":      {"岗位类型 *", "岗位名称 *", "是否公开", "是否推荐", "薪资下限(K)", "薪资上限(K)", "面向专业", "所属行业", "岗位简介", "任职要求", "职业发展路径", "岗位职责"},
		"major":    {"专业名称", "专业代码", "是否公开", "是否推荐", "品牌介绍", "封面图URL", "关联岗位品牌名称", "关联合作企业名称", "关联合作成果名称", "关联特色课程名称"},
		"teacher":  {"师资类型 *", "关联教师名称", "关联专家名称", "是否公开", "是否推荐", "性别", "年龄", "所在城市", "职称", "职务", "从业年限", "学历", "所属行业", "擅长领域", "个人简介", "工作经历", "头像URL"},
		"culture":  {"名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联专业名称"},
	}
	for brandType, headers := range wantHeaders {
		req := httptest.NewRequest("GET", "/api/v1/templates/alliance-brands?brandType="+brandType, nil)
		req = req.WithContext(context.WithValue(req.Context(), middleware.ContextKeyUser, claims))
		w := httptest.NewRecorder()
		(&handler.TemplateHandler{Store: env.Store}).ServeBrandTemplate(w, req)
		if w.Code != 200 {
			t.Fatalf("模板下载失败[%s]: %d %s", brandType, w.Code, w.Body.String())
		}
		f, err := excelize.OpenReader(bytes.NewReader(w.Body.Bytes()))
		if err != nil {
			t.Fatalf("解析模板[%s]失败: %v", brandType, err)
		}
		rows, _ := f.GetRows("品牌内容")
		if len(rows) < 2 {
			t.Fatalf("模板[%s]缺少表头", brandType)
		}
		got := rows[1]
		if len(got) != len(headers) {
			t.Fatalf("模板[%s]表头数量不一致: got %d want %d (%v)", brandType, len(got), len(headers), got)
		}
		for i := range headers {
			if got[i] != headers[i] {
				t.Fatalf("模板[%s]表头第%d列不一致: got %q want %q", brandType, i+1, got[i], headers[i])
			}
		}
		// major 模板预填专业断言
		if brandType == "major" {
			var prefilled bool
			for _, r := range rows[2:] {
				if len(r) > 0 && r[0] == "模板预填专业" {
					prefilled = true
					if len(r) > 1 && r[1] != "TPL-01" {
						t.Fatalf("major 模板专业代码预填错误: got %q", r[1])
					}
				}
			}
			if !prefilled {
				t.Fatalf("major 模板未预填系统专业")
			}
		}
		f.Close()
	}
}

// TestBrandTypedImport 类型化导入：六类页面模板逐类校验（含失败行报错与关联落库）。
func TestBrandTypedImport(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	tenantID, claims, ids := brandImportEnv(t, env)
	ctx := context.Background()
	h := &handler.ResourceImportHandler{Store: env.Store}

	// 1. 人才品牌（就业案例）：学生角色过滤匹配 + 专业关联 + 未命中报错
	file := buildExcel(t, "品牌内容", [][]interface{}{
		{"填写说明"},
		{"案例名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联学生名称", "关联专业名称"},
		{"测试就业案例", "案例描述", "已发布", "是", "是", "https://x.com/case.jpg", "测试学生甲", "测试关联专业"},
		{"未命中学生案例", "", "", "", "", "", "不存在学生", ""},
	})
	w := httptest.NewRecorder()
	h.ImportBrands(w, makeRequest(t, "/import/alliance-brands/excel?brandType=talent", file, claims))
	var res map[string]interface{}
	json.NewDecoder(w.Body).Decode(&res)
	if w.Code != 200 || res["failed"].(float64) != 1 || res["created"].(float64) != 1 {
		t.Fatalf("人才品牌导入结果异常: %d %s", w.Code, w.Body.String())
	}
	var caseBrand struct {
		Status     string  `json:"status"`
		IsPublic   bool    `json:"isPublic"`
		IsFeatured bool    `json:"isFeatured"`
		Cover      *string `json:"coverImage"`
		StudentID  *string `json:"studentId"`
		MajorID    *string `json:"majorId"`
	}
	err := env.DB.QueryRow(ctx, `SELECT status, is_public, is_featured, cover_image, student_id, major_id
		FROM alliance_brands WHERE tenant_id=$1 AND brand_type='talent' AND name='测试就业案例'`,
		tenantID).Scan(&caseBrand.Status, &caseBrand.IsPublic, &caseBrand.IsFeatured, &caseBrand.Cover, &caseBrand.StudentID, &caseBrand.MajorID)
	if err != nil {
		t.Fatalf("查询人才案例失败: %v", err)
	}
	if caseBrand.Status != "published" || !caseBrand.IsPublic || !caseBrand.IsFeatured || caseBrand.Cover == nil ||
		caseBrand.StudentID == nil || *caseBrand.StudentID != ids["student"] || caseBrand.MajorID == nil || *caseBrand.MajorID != ids["major"] {
		t.Fatalf("人才案例字段不一致: %+v (want student=%s major=%s)", caseBrand, ids["student"], ids["major"])
	}

	// 2. 雇主品牌：合作企业名称关联 + 独立雇主资料组装
	file = buildExcel(t, "品牌内容", [][]interface{}{
		{"填写说明"},
		{"企业类型 *", "企业名称 *", "是否公开", "是否推荐", "统一社会信用代码", "所属行业", "所在地区", "成立年份", "企业规模（人数）", "关联二级学院", "企业简介", "联系人", "联系电话", "联系邮箱", "详细地址", "企业Logo URL", "企业主页封面 URL", "企业风采照片URL", "企业营业执照URL", "企业知识产权URL", "企业荣誉资质URL"},
		{"合作企业", "测试关联企业", "是", "否", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""},
		{"独立雇主企业", "测试独立雇主", "否", "是", "91330100", "信息技术", "深圳", "2010", "500", "计算机学院", "独立企业简介", "张三", "13800000000", "a@b.com", "详细地址", "https://x.com/logo", "https://x.com/cover", "https://x.com/p1；https://x.com/p2", "", "", "https://x.com/q1"},
		{"未知类型", "测试未知", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""},
	})
	w = httptest.NewRecorder()
	h.ImportBrands(w, makeRequest(t, "/import/alliance-brands/excel?brandType=employer", file, claims))
	json.NewDecoder(w.Body).Decode(&res)
	if w.Code != 200 || res["failed"].(float64) != 1 || res["created"].(float64) != 2 {
		t.Fatalf("雇主品牌导入结果异常: %d %s", w.Code, w.Body.String())
	}
	var linkedEnterpriseID *string
	err = env.DB.QueryRow(ctx, `SELECT enterprise_id FROM alliance_brands WHERE tenant_id=$1 AND brand_type='employer' AND name='测试关联企业'`, tenantID).Scan(&linkedEnterpriseID)
	if err != nil || linkedEnterpriseID == nil || *linkedEnterpriseID != ids["enterprise"] {
		t.Fatalf("合作企业品牌未关联企业: %v", err)
	}
	var linkCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM alliance_enterprise_links WHERE tenant_id=$1 AND enterprise_id=$2`, tenantID, ids["enterprise"]).Scan(&linkCount)
	if linkCount == 0 {
		t.Fatalf("合作企业品牌未补建企业合作关联")
	}
	var infoRaw []byte
	err = env.DB.QueryRow(ctx, `SELECT data FROM alliance_brands WHERE tenant_id=$1 AND brand_type='employer' AND name='测试独立雇主'`, tenantID).Scan(&infoRaw)
	if err != nil {
		t.Fatalf("查询独立雇主失败: %v", err)
	}
	var data struct {
		EnterpriseInfo struct {
			Name                    string   `json:"name"`
			UnifiedSocialCreditCode string   `json:"unifiedSocialCreditCode"`
			Industry                string   `json:"industry"`
			Region                  string   `json:"region"`
			EstablishedYear         int      `json:"establishedYear"`
			EmployeeCount           int      `json:"employeeCount"`
			SecondaryColleges       []string `json:"secondaryColleges"`
			Description             string   `json:"description"`
			ContactPerson           string   `json:"contactPerson"`
			ContactPhone            string   `json:"contactPhone"`
			ContactEmail            string   `json:"contactEmail"`
			Address                 string   `json:"address"`
			LogoURL                 string   `json:"logoUrl"`
			CoverImage              string   `json:"coverImage"`
			CoverPhotos             []string `json:"coverPhotos"`
			QualificationPhotos     []string `json:"qualificationPhotos"`
		} `json:"enterpriseInfo"`
	}
	json.Unmarshal(infoRaw, &data)
	info := data.EnterpriseInfo
	if info.Name != "测试独立雇主" || info.UnifiedSocialCreditCode != "91330100" || info.Industry != "信息技术" ||
		info.Region != "深圳" || info.EstablishedYear != 2010 || info.EmployeeCount != 500 ||
		len(info.SecondaryColleges) != 1 || info.ContactPerson != "张三" || info.ContactEmail != "a@b.com" ||
		info.LogoURL != "https://x.com/logo" || len(info.CoverPhotos) != 2 || len(info.QualificationPhotos) != 1 {
		t.Fatalf("独立雇主资料不一致: %+v", info)
	}

	// 3. 岗位品牌：教学岗位名称关联 + 企业岗位创建（薪资/专业/职责）
	file = buildExcel(t, "品牌内容", [][]interface{}{
		{"填写说明"},
		{"岗位类型 *", "岗位名称 *", "是否公开", "是否推荐", "薪资下限(K)", "薪资上限(K)", "面向专业", "所属行业", "岗位简介", "任职要求", "职业发展路径", "岗位职责"},
		{"教学岗位", "测试教学岗位", "是", "否", "", "", "", "", "", "", "", ""},
		{"企业岗位", "测试企业岗位", "否", "是", "10", "20", "测试关联专业", "信息技术", "企业岗位简介", "要求一；要求二", "发展路径", "职责一|负责X\n职责二|负责Y"},
		{"未知类型", "测试未知岗位", "", "", "", "", "", "", "", "", "", ""},
	})
	w = httptest.NewRecorder()
	h.ImportBrands(w, makeRequest(t, "/import/alliance-brands/excel?brandType=job", file, claims))
	json.NewDecoder(w.Body).Decode(&res)
	if w.Code != 200 || res["failed"].(float64) != 1 || res["created"].(float64) != 2 {
		t.Fatalf("岗位品牌导入结果异常: %d %s", w.Code, w.Body.String())
	}
	var teachingPosID *string
	err = env.DB.QueryRow(ctx, `SELECT position_id FROM alliance_brands WHERE tenant_id=$1 AND brand_type='job' AND name='测试教学岗位'`, tenantID).Scan(&teachingPosID)
	if err != nil || teachingPosID == nil || *teachingPosID != ids["teachingPosition"] {
		t.Fatalf("教学岗位品牌未关联岗位: %v", err)
	}
	var entPos struct {
		ID          string
		PosType     string
		SalaryMin   int
		SalaryMax   int
		Description string
	}
	err = env.DB.QueryRow(ctx, `SELECT b.position_id, cp.position_type, cp.salary_min, cp.salary_max, cp.description
		FROM alliance_brands b JOIN career_positions cp ON cp.id = b.position_id
		WHERE b.tenant_id=$1 AND b.brand_type='job' AND b.name='测试企业岗位'`, tenantID).
		Scan(&entPos.ID, &entPos.PosType, &entPos.SalaryMin, &entPos.SalaryMax, &entPos.Description)
	if err != nil {
		t.Fatalf("查询企业岗位失败: %v", err)
	}
	if entPos.PosType != "enterprise" || entPos.SalaryMin != 10 || entPos.SalaryMax != 20 || entPos.Description != "企业岗位简介" {
		t.Fatalf("企业岗位字段不一致: %+v", entPos)
	}
	var majorBind int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM career_position_majors WHERE career_position_id=$1 AND major_id=$2`, entPos.ID, ids["major"]).Scan(&majorBind)
	if majorBind != 1 {
		t.Fatalf("企业岗位专业绑定缺失")
	}
	var respCount int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM position_responsibilities WHERE career_position_id=$1`, entPos.ID).Scan(&respCount)
	if respCount != 2 {
		t.Fatalf("企业岗位职责数量不一致: got %d want 2", respCount)
	}

	// 4. 专业品牌：命中专业创建/空白行跳过/未命中报错/四类关联
	file = buildExcel(t, "品牌内容", [][]interface{}{
		{"填写说明"},
		{"专业名称", "专业代码", "是否公开", "是否推荐", "品牌介绍", "封面图URL", "关联岗位品牌名称", "关联合作企业名称", "关联合作成果名称", "关联特色课程名称"},
		{"测试专业甲", "MAJ-A", "是", "", "专业介绍甲", "https://x.com/major.jpg", "测试岗位品牌甲", "测试合作企业B", "测试成果C", "测试课程D"},
		{"测试专业乙", "MAJ-B", "", "", "", "", "", "", "", ""},
		{"不存在专业", "", "是", "", "", "", "", "", "", ""},
	})
	w = httptest.NewRecorder()
	h.ImportBrands(w, makeRequest(t, "/import/alliance-brands/excel?brandType=major", file, claims))
	json.NewDecoder(w.Body).Decode(&res)
	if w.Code != 200 || res["failed"].(float64) != 1 || res["created"].(float64) != 1 {
		t.Fatalf("专业品牌导入结果异常: %d %s", w.Code, w.Body.String())
	}
	var majorData []byte
	var majorBrandID string
	err = env.DB.QueryRow(ctx, `SELECT id, data FROM alliance_brands WHERE tenant_id=$1 AND brand_type='major' AND name='测试专业甲'`, tenantID).Scan(&majorBrandID, &majorData)
	if err != nil {
		t.Fatalf("查询专业品牌失败: %v", err)
	}
	var mData struct {
		EmploymentDirections    []struct{ ID, Name string } `json:"employmentDirections"`
		CooperationEnterprises  []struct{ ID, Name string } `json:"cooperationEnterprises"`
		CooperationAchievements []struct{ ID, Name string } `json:"cooperationAchievements"`
		FeaturedCourses         []struct{ ID, Name string } `json:"featuredCourses"`
	}
	json.Unmarshal(majorData, &mData)
	if len(mData.EmploymentDirections) != 1 || mData.EmploymentDirections[0].ID != ids["jobBrand"] ||
		len(mData.CooperationEnterprises) != 1 || mData.CooperationEnterprises[0].ID != ids["enterpriseB"] ||
		len(mData.CooperationAchievements) != 1 || mData.CooperationAchievements[0].ID != ids["achievement"] ||
		len(mData.FeaturedCourses) != 1 || mData.FeaturedCourses[0].ID != ids["course"] {
		t.Fatalf("专业品牌关联数据不一致: %+v", mData)
	}
	var majorBExists int
	env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM alliance_brands WHERE tenant_id=$1 AND brand_type='major' AND name='测试专业乙'`, tenantID).Scan(&majorBExists)
	if majorBExists != 0 {
		t.Fatalf("空白行不应创建品牌")
	}
	_ = majorBrandID

	// 5. 师资品牌：校本师资（角色过滤+资料档案+teacherExpertId）/ 企业专家名称关联
	file = buildExcel(t, "品牌内容", [][]interface{}{
		{"填写说明"},
		{"师资类型 *", "关联教师名称", "关联专家名称", "是否公开", "是否推荐", "性别", "年龄", "所在城市", "职称", "职务", "从业年限", "学历", "所属行业", "擅长领域", "个人简介", "工作经历", "头像URL"},
		{"校本师资", "测试教师甲", "", "是", "", "男", "35", "杭州", "副教授", "系主任", "10", "硕士", "教育", "课程设计；教学管理", "个人简介", "工作经历", "https://x.com/avatar"},
		{"企业专家", "", "测试关联专家", "否", "是", "", "", "", "", "", "", "", "", "", "", "", ""},
		{"校本师资", "不存在教师", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""},
	})
	w = httptest.NewRecorder()
	h.ImportBrands(w, makeRequest(t, "/import/alliance-brands/excel?brandType=teacher", file, claims))
	json.NewDecoder(w.Body).Decode(&res)
	if w.Code != 200 || res["failed"].(float64) != 1 || res["created"].(float64) != 2 {
		t.Fatalf("师资品牌导入结果异常: %d %s", w.Code, w.Body.String())
	}
	var schoolBrand struct {
		TeacherID *string
		ExpertID  *string
		Data      []byte
	}
	err = env.DB.QueryRow(ctx, `SELECT teacher_id, expert_id, data FROM alliance_brands WHERE tenant_id=$1 AND brand_type='teacher' AND name='测试教师甲'`, tenantID).
		Scan(&schoolBrand.TeacherID, &schoolBrand.ExpertID, &schoolBrand.Data)
	if err != nil || schoolBrand.TeacherID == nil || *schoolBrand.TeacherID != ids["teacher"] {
		t.Fatalf("校本师资品牌未关联教师: %v", err)
	}
	var tbData struct {
		TeacherExpertID string `json:"teacherExpertId"`
	}
	json.Unmarshal(schoolBrand.Data, &tbData)
	if tbData.TeacherExpertID == "" {
		t.Fatalf("校本师资品牌未回写 teacherExpertId")
	}
	var profile struct {
		Gender      *string  `json:"gender"`
		Age         *int     `json:"age"`
		City        *string  `json:"city"`
		Title       *string  `json:"title"`
		Position    *string  `json:"position"`
		UserID      *string  `json:"userId"`
		Specialties []string `json:"specialties"`
	}
	var rawJSON []byte
	err = env.DB.QueryRow(ctx, `SELECT jsonb_build_object('gender', gender, 'age', age, 'city', city, 'title', title, 'position', position, 'userId', user_id, 'specialties', specialties)
		FROM alliance_experts WHERE id=$1`, tbData.TeacherExpertID).Scan(&rawJSON)
	if err != nil {
		t.Fatalf("查询师资档案失败: %v", err)
	}
	json.Unmarshal(rawJSON, &profile)
	if profile.Title == nil || *profile.Title != "副教授" || profile.Age == nil || *profile.Age != 35 ||
		profile.UserID == nil || *profile.UserID != ids["teacher"] ||
		len(profile.Specialties) != 2 || profile.Specialties[0] != "课程设计" {
		t.Fatalf("师资档案不一致: %s", string(rawJSON))
	}
	var expertBrand *string
	err = env.DB.QueryRow(ctx, `SELECT expert_id FROM alliance_brands WHERE tenant_id=$1 AND brand_type='teacher' AND name='测试关联专家'`, tenantID).Scan(&expertBrand)
	if err != nil || expertBrand == nil || *expertBrand != ids["expert"] {
		t.Fatalf("企业专家师资未关联: %v", err)
	}

	// 6. 文化思政品牌：基础字段 + 专业关联
	file = buildExcel(t, "品牌内容", [][]interface{}{
		{"填写说明"},
		{"名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联专业名称"},
		{"测试文化品牌", "文化描述", "已归档", "是", "否", "https://x.com/c.jpg", "测试关联专业"},
	})
	w = httptest.NewRecorder()
	h.ImportBrands(w, makeRequest(t, "/import/alliance-brands/excel?brandType=culture", file, claims))
	json.NewDecoder(w.Body).Decode(&res)
	if w.Code != 200 || res["failed"].(float64) != 0 || res["created"].(float64) != 1 {
		t.Fatalf("文化品牌导入结果异常: %d %s", w.Code, w.Body.String())
	}
	var cultureBrand struct {
		Status   string  `json:"status"`
		IsPublic bool    `json:"isPublic"`
		MajorID  *string `json:"majorId"`
	}
	err = env.DB.QueryRow(ctx, `SELECT status, is_public, major_id FROM alliance_brands WHERE tenant_id=$1 AND brand_type='culture' AND name='测试文化品牌'`, tenantID).
		Scan(&cultureBrand.Status, &cultureBrand.IsPublic, &cultureBrand.MajorID)
	if err != nil || cultureBrand.Status != "archived" || !cultureBrand.IsPublic || cultureBrand.MajorID == nil || *cultureBrand.MajorID != ids["major"] {
		t.Fatalf("文化品牌字段不一致: %+v", cultureBrand)
	}

	// 7. 覆盖导入：同名校牌 overwrite 更新（未提供字段保留）
	file = buildExcel(t, "品牌内容", [][]interface{}{
		{"填写说明"},
		{"案例名称 *", "描述", "状态", "是否公开", "是否推荐", "封面图URL", "关联学生名称", "关联专业名称"},
		{"测试就业案例", "更新后的描述", "", "", "", "", "", ""},
	})
	w = httptest.NewRecorder()
	h.ImportBrands(w, makeRequest(t, "/import/alliance-brands/excel?brandType=talent&overwrite=true", file, claims))
	json.NewDecoder(w.Body).Decode(&res)
	if w.Code != 200 || res["created"].(float64) != 1 {
		t.Fatalf("覆盖导入结果异常: %d %s", w.Code, w.Body.String())
	}
	var overwritten struct {
		Desc      string  `json:"description"`
		Status    string  `json:"status"`
		IsPublic  bool    `json:"isPublic"`
		StudentID *string `json:"studentId"`
	}
	err = env.DB.QueryRow(ctx, `SELECT COALESCE(description,''), status, is_public, student_id FROM alliance_brands WHERE tenant_id=$1 AND brand_type='talent' AND name='测试就业案例'`, tenantID).
		Scan(&overwritten.Desc, &overwritten.Status, &overwritten.IsPublic, &overwritten.StudentID)
	if err != nil || overwritten.Desc != "更新后的描述" || overwritten.Status != "draft" {
		t.Fatalf("覆盖导入字段不一致: %+v", overwritten)
	}
}
