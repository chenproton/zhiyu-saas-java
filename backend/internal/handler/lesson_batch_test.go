package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestLessonBatch_UpdateWithStatus 覆盖批次 Update 的 UpdateWithStatus 分支：
// PUT 更新携带 status 字段时（CreateFields/UpdateFields 改造的关键路径），
// 状态应写入并在后续更新不传 status 时保持不变。
func TestLessonBatch_UpdateWithStatus(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	wc := env.Do("POST", "/api/v1/lesson/batches", map[string]interface{}{
		"name": "课程批次",
		"code": "LB-001",
	})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	b, err := testhelper.Unmarshal[domain.LessonBatch](wc)
	if err != nil {
		t.Fatalf("unmarshal create: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM lesson_batches WHERE id = $1", b.ID)

	// 更新：携带 status → 应写入
	wUpd := env.Do("PUT", fmt.Sprintf("/api/v1/lesson/batches/%s", b.ID), map[string]interface{}{
		"name":   "课程批次-改",
		"code":   "LB-001",
		"status": "closed",
	})
	if wUpd.Code != http.StatusOK {
		t.Fatalf("update with status: %d %s", wUpd.Code, testhelper.ErrMsg(wUpd))
	}
	upd, err := testhelper.Unmarshal[domain.LessonBatch](wUpd)
	if err != nil {
		t.Fatalf("unmarshal update: %v", err)
	}
	if string(upd.Status) != "closed" {
		t.Fatalf("expected status closed, got %q", upd.Status)
	}

	// 更新：不携带 status → 按配置回落到 StatusOpen（原设计语义）
	wUpd2 := env.Do("PUT", fmt.Sprintf("/api/v1/lesson/batches/%s", b.ID), map[string]interface{}{
		"name": "课程批次-改2",
		"code": "LB-001",
	})
	if wUpd2.Code != http.StatusOK {
		t.Fatalf("update without status: %d %s", wUpd2.Code, testhelper.ErrMsg(wUpd2))
	}
	upd2, err := testhelper.Unmarshal[domain.LessonBatch](wUpd2)
	if err != nil {
		t.Fatalf("unmarshal update2: %v", err)
	}
	if string(upd2.Status) != "open" {
		t.Fatalf("expected status fallback open, got %q", upd2.Status)
	}
	if upd2.Name != "课程批次-改2" {
		t.Fatalf("expected name 课程批次-改2, got %q", upd2.Name)
	}
}
