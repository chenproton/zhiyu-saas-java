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
)

// TestAllianceImportWithRelations 验证 alliance 导入的名称关联：
// 项目（预算/关联企业）、成果（关联项目/关联企业）、协议（关联项目/关联企业）。
// 企业/专家导入已随 Partner 平台改造移除（学校不再创建企业/维护专家），
// 关联企业改为直接预置 partner_enterprises 主体（企业平台维护）。
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
		"alliance_agreements", "alliance_achievements", "alliance_projects", "alliance_enterprise_links",
	} {
		env.DB.Exec(ctx, "DELETE FROM "+tbl+" WHERE tenant_id=$1", tenantID)
	}
	env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE tenant_id=$1 AND name=$2`, tenantID, "测试企业甲")

	// 预置企业主体（Partner 平台维护的全局实体，学校侧仅通过名称关联）
	entID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`,
		entID, tenantID, "测试企业甲"); err != nil {
		t.Fatalf("预置企业失败: %v", err)
	}
	defer env.DB.Exec(ctx, `DELETE FROM partner_enterprises WHERE id=$1`, entID)

	// 1. 合作项目：预算 + 关联合作企业（按名称匹配）
	projFile := buildExcel(t, "合作项目", [][]interface{}{
		{"填写说明"},
		{"项目名称 *", "项目类型", "项目阶段", "开始日期", "结束日期", "描述", "预算", "关联合作企业"},
		{"测试联合研发项目", "联合研发", "执行中", "2026-01-15", "2027-06-30", "项目描述", "300万", "测试企业甲"},
	})
	hProj := &handler.ResourceImportHandler{Store: env.Store}
	w := httptest.NewRecorder()
	hProj.ImportProjects(w, makeRequest(t, "/import/alliance-projects/excel", projFile, claims))
	if w.Code != 200 {
		t.Fatalf("项目导入失败: %d %s", w.Code, w.Body.String())
	}
	var projID, budget string
	var projEntIDs []byte
	err := env.DB.QueryRow(ctx, `SELECT id, budget, enterprise_ids FROM alliance_projects WHERE tenant_id=$1 AND name=$2`,
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

	// 2. 合作成果：关联归属项目 + 关联合作企业（按名称匹配）
	achFile := buildExcel(t, "合作成果", [][]interface{}{
		{"填写说明"},
		{"成果名称 *", "成果类型", "描述", "成果日期", "关联归属项目", "关联合作企业"},
		{"测试视觉质检标准", "自定义成果", "成果描述", "2026-05-20", "测试联合研发项目", "测试企业甲"},
	})
	hAch := &handler.ResourceImportHandler{Store: env.Store}
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

	// 3. 合作协议：关联归属项目 + 关联合作企业（按名称匹配）
	agrFile := buildExcel(t, "合作协议", [][]interface{}{
		{"填写说明"},
		{"协议名称 *", "协议类型", "开始日期", "结束日期", "状态", "内容", "关联归属项目", "关联合作企业"},
		{"测试共建实验室协议", "实验室共建", "2026-01-10", "2027-01-09", "生效中", "协议内容", "测试联合研发项目", "测试企业甲"},
	})
	hAgr := &handler.ResourceImportHandler{Store: env.Store}
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
