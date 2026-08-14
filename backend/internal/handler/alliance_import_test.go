package handler_test

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
)

// TestAllianceImportWithRelations 验证 alliance 导入的名称关联：
// 项目（预算/关联企业）、成果（关联项目/关联企业）、协议（关联项目/关联企业）。
// 企业/专家导入已随 Partner 平台改造移除（学校不再创建企业/维护专家），
// 关联企业改为直接预置 partner_enterprises 主体（企业平台维护）。
func TestAllianceImportWithRelations(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	tenantID := testhelper.TestTenantID
	// 企业主体归属企业自身租户（全局实体，tenant_id ≠ 学校租户），模拟生产数据归属
	entTenantID := "00000000-0000-0000-0000-0000000000aa"
	claims := &middleware.Claims{
		UserID:      testhelper.TestOperatorID,
		TenantID:    &tenantID,
		Permissions: map[string]interface{}{"admin": true},
	}
	ctx := context.Background()

	// 清理本测试租户的 alliance 数据，避免重复导入时跳过
	for _, tbl := range []string{
		"alliance_agreements", "alliance_achievements", "alliance_projects", "alliance_enterprise_links",
	} {
		env.DB.Exec(ctx, "DELETE FROM "+tbl+" WHERE tenant_id=$1", tenantID)
	}
	env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE tenant_id=$1 AND name=$2`, entTenantID, "测试企业甲")

	// 预置企业主体（Partner 平台维护的全局实体，学校侧仅通过名称关联）
	env.DB.Exec(ctx, `INSERT INTO tenants (id, name, code, status) VALUES ($1, '测试企业甲租户', 'ent-test-aa', 'active') ON CONFLICT (id) DO NOTHING`, entTenantID)
	entID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`,
		entID, entTenantID, "测试企业甲"); err != nil {
		t.Fatalf("预置企业失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id=$1`, entID)

	// 1. 合作项目：预算 + 关联合作企业（按名称匹配）+ 二级学院 + 公开显示
	projFile := buildExcel(t, "合作项目", [][]interface{}{
		{"填写说明"},
		{"项目名称 *", "合作类型", "项目阶段", "预算", "开始日期", "结束日期", "项目描述", "合作企业", "二级学院", "公开显示"},
		{"测试联合研发项目", "联合研发", "执行中", "300万", "2026-01-15", "2027-06-30", "项目描述", "测试企业甲", "智能制造学院；人工智能学院", "是"},
	})
	hProj := &handler.ResourceImportHandler{Svc: service.NewResourceImportService(service.New(env.Store))}
	w := httptest.NewRecorder()
	hProj.ImportProjects(w, makeRequest(t, "/import/alliance-projects/excel", projFile, claims))
	if w.Code != 200 {
		t.Fatalf("项目导入失败: %d %s", w.Code, w.Body.String())
	}
	var projID, budget string
	var projEntIDs, projColleges []byte
	var projPublic bool
	err := env.DB.QueryRow(ctx, `SELECT id, budget, enterprise_ids, secondary_colleges, is_public FROM alliance_projects WHERE tenant_id=$1 AND name=$2`,
		tenantID, "测试联合研发项目").Scan(&projID, &budget, &projEntIDs, &projColleges, &projPublic)
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
	// 导入执行阶段应自动补建本校-企业合作关联（学校侧页面按已引入企业显示名称）
	var linkCount int
	if err := env.DB.QueryRow(ctx, `SELECT COUNT(*) FROM alliance_enterprise_links WHERE tenant_id=$1 AND enterprise_id=$2`,
		tenantID, entID).Scan(&linkCount); err != nil {
		t.Fatalf("查询企业关联失败: %v", err)
	}
	if linkCount != 1 {
		t.Fatalf("导入未补建企业合作关联: %d", linkCount)
	}
	var projCollegeList []string
	json.Unmarshal(projColleges, &projCollegeList)
	if len(projCollegeList) != 2 || projCollegeList[0] != "智能制造学院" || projCollegeList[1] != "人工智能学院" {
		t.Fatalf("项目二级学院未按名称导入: %v", projCollegeList)
	}
	if !projPublic {
		t.Fatalf("项目公开显示未导入: %v", projPublic)
	}

	// 2. 合作成果：关联归属项目 + 关联合作企业（按名称匹配）+ 二级学院 + 公开显示
	achFile := buildExcel(t, "合作成果", [][]interface{}{
		{"填写说明"},
		{"成果名称 *", "成果类型", "成果日期", "成果描述", "归属项目", "合作企业", "二级学院", "公开显示"},
		{"测试视觉质检标准", "自定义成果", "2026-05-20", "成果描述", "测试联合研发项目", "测试企业甲", "智能制造学院", "是"},
	})
	hAch := &handler.ResourceImportHandler{Svc: service.NewResourceImportService(service.New(env.Store))}
	w = httptest.NewRecorder()
	hAch.ImportAchievements(w, makeRequest(t, "/import/alliance-achievements/excel", achFile, claims))
	if w.Code != 200 {
		t.Fatalf("成果导入失败: %d %s", w.Code, w.Body.String())
	}
	var achEntIDs, achProjIDs, achColleges []byte
	var achPublic bool
	err = env.DB.QueryRow(ctx, `SELECT enterprise_ids, project_ids, secondary_colleges, is_public FROM alliance_achievements WHERE tenant_id=$1 AND title=$2`,
		tenantID, "测试视觉质检标准").Scan(&achEntIDs, &achProjIDs, &achColleges, &achPublic)
	if err != nil {
		t.Fatalf("查询成果失败: %v", err)
	}
	var achEntList, achProjList, achCollegeList []string
	json.Unmarshal(achEntIDs, &achEntList)
	json.Unmarshal(achProjIDs, &achProjList)
	json.Unmarshal(achColleges, &achCollegeList)
	if len(achEntList) != 1 || achEntList[0] != entID {
		t.Fatalf("成果关联企业未按名称匹配: %v", achEntList)
	}
	if len(achProjList) != 1 || achProjList[0] != projID {
		t.Fatalf("成果关联项目未按名称匹配: %v", achProjList)
	}
	if len(achCollegeList) != 1 || achCollegeList[0] != "智能制造学院" {
		t.Fatalf("成果二级学院未按名称导入: %v", achCollegeList)
	}
	if !achPublic {
		t.Fatalf("成果公开显示未导入: %v", achPublic)
	}

	// 3. 合作协议：关联归属项目 + 关联合作企业（按名称匹配）；前台展示跟随企业/项目，无独立开关
	agrFile := buildExcel(t, "合作协议", [][]interface{}{
		{"填写说明"},
		{"协议名称 *", "协议类型", "协议状态", "开始日期", "结束日期", "内容", "合作企业", "关联项目"},
		{"测试共建实验室协议", "实验室共建", "生效中", "2026-01-10", "2027-01-09", "协议内容", "测试企业甲", "测试联合研发项目"},
	})
	hAgr := &handler.ResourceImportHandler{Svc: service.NewResourceImportService(service.New(env.Store))}
	w = httptest.NewRecorder()
	hAgr.ImportAgreements(w, makeRequest(t, "/import/alliance-agreements/excel", agrFile, claims))
	if w.Code != 200 {
		t.Fatalf("协议导入失败: %d %s", w.Code, w.Body.String())
	}
	var agrEntIDs, agrProjIDs []byte
	var agrPublic bool
	err = env.DB.QueryRow(ctx, `SELECT enterprise_ids, project_ids, is_public FROM alliance_agreements WHERE tenant_id=$1 AND name=$2`,
		tenantID, "测试共建实验室协议").Scan(&agrEntIDs, &agrProjIDs, &agrPublic)
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
	if agrPublic {
		t.Fatalf("协议导入不再写入前台展示开关: %v", agrPublic)
	}
}
