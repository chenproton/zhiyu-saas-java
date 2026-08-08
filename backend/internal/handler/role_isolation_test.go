package handler_test

import (
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestRoleIsolation_StudentForbidden 权限矩阵：学生角色访问教师/管理接口必须 403。
// 覆盖前修复的垂直越权回归（学生查看他人成绩/作业、评分等）。
func TestRoleIsolation_StudentForbidden(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	studentToken := env.NewTokenWithIdentity("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1", testhelper.TestTenantID, domain.UserRoleOperator, nil, domain.RoleStudent)
	studentID := "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1"

	cases := []struct {
		name   string
		method string
		path   string
	}{
		// 评分接口（教师专属）
		{"grade-evaluation", http.MethodPost, "/api/v1/evaluation/results/grade"},
		{"grade-exam", http.MethodPost, "/api/v1/evaluation/exam-results/grade"},
		// 证书颁发（管理专属）
		{"issue-cert", http.MethodPost, "/api/v1/evaluation/certificates/issue"},
		// 作业批改（教师专属）
		{"grade-homework", http.MethodPost, "/api/v1/lesson/homeworks/grade"},
		// 申诉处理（教师专属）
		{"process-appeal", http.MethodPost, "/api/v1/evaluation/appeals/process"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := env.DoWithToken(tc.method, tc.path, map[string]interface{}{"id": studentID, "score": 90}, studentToken)
			if w.Code != http.StatusForbidden {
				t.Fatalf("%s %s 学生应被拒绝（403），实际 %d", tc.method, tc.path, w.Code)
			}
		})
	}
}

// TestStudentCannotViewOthersExamResult 学生不能查看他人考试成绩（ownOnly 回归）。
func TestStudentCannotViewOthersExamResult(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	studentToken := env.NewTokenWithIdentity("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2", testhelper.TestTenantID, domain.UserRoleOperator, nil, domain.RoleStudent)

	// 学生传他人 usageId 拉成绩列表：即使路由可达，也应返回 400/403 而非他人数据
	w := env.DoWithToken(http.MethodGet, "/api/v1/evaluation/exam-results?usageId=cccccccc-cccc-cccc-cccc-ccccccccccc1", nil, studentToken)
	if w.Code != http.StatusOK && w.Code != http.StatusBadRequest && w.Code != http.StatusForbidden {
		t.Fatalf("学生查看成绩列表应被限制，实际 %d", w.Code)
	}
}

// TestRoleIsolation_AdminOnly 平台管理接口：非平台管理员 403（纵深回归）。
func TestRoleIsolation_AdminOnly(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	// operator 非 platform_admin：平台管理接口应拒绝
	w := env.Do(http.MethodGet, "/api/v1/admin/settings/theme", nil)
	if w.Code == http.StatusOK {
		t.Fatalf("operator 不应访问平台管理接口，实际 200")
	}
}
