package handler_test

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
)

// TestAllianceImportWithRelations 验证 alliance 五个实体导入的新字段与名称关联：
// 企业（信用代码/成立年份/企业规模/简介）、项目（预算/关联企业）、成果（关联项目/关联企业）、
// 专家（年龄/从业年限/关联企业/擅长领域/从业经历）、协议（关联项目/关联企业）。
func TestAllianceImportWithRelations(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	claims := &middleware.Claims{
		UserID:      testhelper.TestOperatorID,
		TenantID:    &tenantID,
		Permissions: map[string]interface{}{"admin": true},
	}
	ctx := context.Background()

	// 清理本测试租户的 alliance 数据，避免重复导入时跳过
	for _, tbl := range []string{
		"alliance_agreements", "alliance_achievements", "alliance_projects",
		"alliance_experts", "alliance_enterprises",
	} {
		env.DB.Exec(ctx, "DELETE FROM "+tbl+" WHERE tenant_id=$1", tenantID)
	}

	// 1. 合作企业：新增字段 统一社会信用代码/成立年份/企业规模（人数）/企业简介
	entFile := buildExcel(t, "合作企业", [][]interface{}{
		{"填写说明"},
		{"企业名称 *", "企业类型", "所属行业", "所在地区", "合作状态", "合作评级", "联系人", "联系电话", "联系邮箱", "企业地址", "统一社会信用代码", "成立年份", "企业规模（人数）", "企业简介"},
		{"测试企业甲", "合作企业", "智能制造", "苏州市", "合作中", "战略合作", "张伟", "13800000000", "a@example.com", "苏州市工业园区", "91320594MA1P7ABC1X", "2015", "1200", "测试企业简介"},
	})
	hEnt := &handler.ResourceImportHandler{DB: env.DB}
	w := httptest.NewRecorder()
	hEnt.ImportEnterprises(w, makeRequest(t, "/import/alliance-enterprises/excel", entFile, claims))
	if w.Code != 200 {
		t.Fatalf("企业导入失败: %d %s", w.Code, w.Body.String())
	}
	var entID, creditCode string
	var establishedYear, employeeCount int
	var description *string
	err := env.DB.QueryRow(ctx, `SELECT id, unified_social_credit_code, established_year, employee_count, description FROM alliance_enterprises WHERE tenant_id=$1 AND name=$2`,
		tenantID, "测试企业甲").Scan(&entID, &creditCode, &establishedYear, &employeeCount, &description)
	if err != nil {
		t.Fatalf("查询企业失败: %v", err)
	}
	if creditCode != "91320594MA1P7ABC1X" || establishedYear != 2015 || employeeCount != 1200 || description == nil || *description != "测试企业简介" {
		t.Fatalf("企业扩展字段导入不正确: code=%s year=%d count=%d desc=%v", creditCode, establishedYear, employeeCount, description)
	}

	// 2. 合作项目：预算 + 关联合作企业（按名称匹配）
	projFile := buildExcel(t, "合作项目", [][]interface{}{
		{"填写说明"},
		{"项目名称 *", "项目类型", "项目阶段", "开始日期", "结束日期", "描述", "预算", "关联合作企业"},
		{"测试联合研发项目", "联合研发", "执行中", "2026-01-15", "2027-06-30", "项目描述", "300万", "测试企业甲"},
	})
	hProj := &handler.ResourceImportHandler{DB: env.DB}
	w = httptest.NewRecorder()
	hProj.ImportProjects(w, makeRequest(t, "/import/alliance-projects/excel", projFile, claims))
	if w.Code != 200 {
		t.Fatalf("项目导入失败: %d %s", w.Code, w.Body.String())
	}
	var projID, budget string
	var projEntIDs []byte
	err = env.DB.QueryRow(ctx, `SELECT id, budget, enterprise_ids FROM alliance_projects WHERE tenant_id=$1 AND name=$2`,
		tenantID, "测试联合研发项目").Scan(&projID, &budget, &projEntIDs)
	if err != nil {
		t.Fatalf("查询项目失败: %v", err)
	}
	if budget != "300万" {
		t.Fatalf("项目预算导入不正确: %s", budget)
	}
	var projEntList []string
	json.Unmarshal(projEntIDs, &projEntList)
	if len(projEntList) != 1 || projEntList[0] != entID {
		t.Fatalf("项目关联企业未按名称匹配: %v", projEntList)
	}

	// 3. 合作成果：关联归属项目 + 关联合作企业（按名称匹配）
	achFile := buildExcel(t, "合作成果", [][]interface{}{
		{"填写说明"},
		{"成果名称 *", "成果类型", "描述", "成果日期", "关联归属项目", "关联合作企业"},
		{"测试视觉质检标准", "自定义成果", "成果描述", "2026-05-20", "测试联合研发项目", "测试企业甲"},
	})
	hAch := &handler.ResourceImportHandler{DB: env.DB}
	w = httptest.NewRecorder()
	hAch.ImportAchievements(w, makeRequest(t, "/import/alliance-achievements/excel", achFile, claims))
	if w.Code != 200 {
		t.Fatalf("成果导入失败: %d %s", w.Code, w.Body.String())
	}
	var achEntIDs, achProjIDs []byte
	err = env.DB.QueryRow(ctx, `SELECT enterprise_ids, project_ids FROM alliance_achievements WHERE tenant_id=$1 AND title=$2`,
		tenantID, "测试视觉质检标准").Scan(&achEntIDs, &achProjIDs)
	if err != nil {
		t.Fatalf("查询成果失败: %v", err)
	}
	var achEntList, achProjList []string
	json.Unmarshal(achEntIDs, &achEntList)
	json.Unmarshal(achProjIDs, &achProjList)
	if len(achEntList) != 1 || achEntList[0] != entID {
		t.Fatalf("成果关联企业未按名称匹配: %v", achEntList)
	}
	if len(achProjList) != 1 || achProjList[0] != projID {
		t.Fatalf("成果关联项目未按名称匹配: %v", achProjList)
	}

	// 4. 专家资源：年龄/从业年限/关联合作企业/擅长领域/从业经历
	expFile := buildExcel(t, "专家资源", [][]interface{}{
		{"填写说明"},
		{"姓名 *", "头衔", "职位", "行业", "城市", "简介", "年龄", "从业年限", "关联合作企业", "擅长领域", "从业经历"},
		{"测试专家张工", "教授级高工", "特聘教授", "智能制造", "苏州市", "专家简介", "45", "20", "测试企业甲", "机器视觉；工业机器人", "主持多项省部级课题"},
	})
	hExp := &handler.ResourceImportHandler{DB: env.DB}
	w = httptest.NewRecorder()
	hExp.ImportExperts(w, makeRequest(t, "/import/alliance-experts/excel", expFile, claims))
	if w.Code != 200 {
		t.Fatalf("专家导入失败: %d %s", w.Code, w.Body.String())
	}
	var age, expYears int
	var expertEntID *string
	var specialties []byte
	var workExperience *string
	err = env.DB.QueryRow(ctx, `SELECT age, experience_years, enterprise_id, specialties, work_experience FROM alliance_experts WHERE tenant_id=$1 AND name=$2`,
		tenantID, "测试专家张工").Scan(&age, &expYears, &expertEntID, &specialties, &workExperience)
	if err != nil {
		t.Fatalf("查询专家失败: %v", err)
	}
	if age != 45 || expYears != 20 {
		t.Fatalf("专家年龄/从业年限导入不正确: age=%d years=%d", age, expYears)
	}
	if expertEntID == nil || *expertEntID != entID {
		t.Fatalf("专家关联企业未按名称匹配: %v", expertEntID)
	}
	var specList []string
	json.Unmarshal(specialties, &specList)
	if len(specList) != 2 || specList[0] != "机器视觉" || specList[1] != "工业机器人" {
		t.Fatalf("专家擅长领域导入不正确: %v", specList)
	}
	if workExperience == nil || *workExperience != "主持多项省部级课题" {
		t.Fatalf("专家从业经历导入不正确: %v", workExperience)
	}

	// 5. 合作协议：关联归属项目 + 关联合作企业（按名称匹配）
	agrFile := buildExcel(t, "合作协议", [][]interface{}{
		{"填写说明"},
		{"协议名称 *", "协议类型", "开始日期", "结束日期", "状态", "内容", "关联归属项目", "关联合作企业"},
		{"测试共建实验室协议", "实验室共建", "2026-01-10", "2027-01-09", "生效中", "协议内容", "测试联合研发项目", "测试企业甲"},
	})
	hAgr := &handler.ResourceImportHandler{DB: env.DB}
	w = httptest.NewRecorder()
	hAgr.ImportAgreements(w, makeRequest(t, "/import/alliance-agreements/excel", agrFile, claims))
	if w.Code != 200 {
		t.Fatalf("协议导入失败: %d %s", w.Code, w.Body.String())
	}
	var agrEntIDs, agrProjIDs []byte
	err = env.DB.QueryRow(ctx, `SELECT enterprise_ids, project_ids FROM alliance_agreements WHERE tenant_id=$1 AND name=$2`,
		tenantID, "测试共建实验室协议").Scan(&agrEntIDs, &agrProjIDs)
	if err != nil {
		t.Fatalf("查询协议失败: %v", err)
	}
	var agrEntList, agrProjList []string
	json.Unmarshal(agrEntIDs, &agrEntList)
	json.Unmarshal(agrProjIDs, &agrProjList)
	if len(agrEntList) != 1 || agrEntList[0] != entID {
		t.Fatalf("协议关联企业未按名称匹配: %v", agrEntList)
	}
	if len(agrProjList) != 1 || agrProjList[0] != projID {
		t.Fatalf("协议关联项目未按名称匹配: %v", agrProjList)
	}
}
