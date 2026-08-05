package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestStudentHonorCRUD 学生荣誉：学生本人增删改查 + 业务用户只读。
func TestStudentHonorCRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	studentID := "11111111-2222-4333-8444-777777777791"
	env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'student', 'portal', 'honor-stu', 'honor-stu', 'x', '荣誉学生', 'active', '{}')
	`, studentID, testhelper.TestTenantID)
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", studentID)
	defer env.DB.Exec(ctx, "DELETE FROM student_honors WHERE user_id = $1", studentID)

	studentToken := env.NewUserToken(studentID, testhelper.TestTenantID, domain.RoleStudent, nil)

	// 创建
	w := env.DoWithToken("POST", "/api/v1/portal/workspace/honors", map[string]interface{}{
		"name": "国家励志奖学金", "issuer": "教育部", "honorDate": "2025-11", "fileName": "a.pdf", "fileUrl": "/uploads/a.pdf",
	}, studentToken)
	if w.Code != http.StatusCreated {
		t.Fatalf("create: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil || created.ID == "" {
		t.Fatalf("create response: %v %s", err, w.Body.String())
	}

	// 更新
	w = env.DoWithToken("PUT", "/api/v1/portal/workspace/honors/"+created.ID, map[string]interface{}{
		"name": "三好学生", "issuer": "学校教务处", "honorDate": "2025-09",
	}, studentToken)
	if w.Code != http.StatusOK {
		t.Fatalf("update: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}

	// 列表（学生本人）
	w = env.DoWithToken("GET", "/api/v1/portal/workspace/honors", nil, studentToken)
	if w.Code != http.StatusOK {
		t.Fatalf("list: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	var resp struct {
		Items []handler.StudentHonorItem `json:"items"`
		Total int                        `json:"total"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if resp.Total != 1 || len(resp.Items) != 1 || resp.Items[0].Name != "三好学生" {
		t.Fatalf("list result: total=%d items=%+v", resp.Total, resp.Items)
	}

	// 业务用户只读：可查该学生荣誉
	w = env.Do("GET", "/api/v1/portal/workspace/honors?userId="+studentID, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list by business user: expected 200, got %d", w.Code)
	}

	// 业务用户不能创建
	w = env.Do("POST", "/api/v1/portal/workspace/honors", map[string]interface{}{"name": "x"})
	if w.Code != http.StatusForbidden {
		t.Fatalf("create by business user: expected 403, got %d", w.Code)
	}

	// 删除
	w = env.DoWithToken("DELETE", "/api/v1/portal/workspace/honors/"+created.ID, nil, studentToken)
	if w.Code != http.StatusOK {
		t.Fatalf("delete: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	var after struct {
		Total int `json:"total"`
	}
	w = env.DoWithToken("GET", "/api/v1/portal/workspace/honors", nil, studentToken)
	_ = json.Unmarshal(w.Body.Bytes(), &after)
	if after.Total != 0 {
		t.Fatalf("after delete total = %d, want 0", after.Total)
	}
}
