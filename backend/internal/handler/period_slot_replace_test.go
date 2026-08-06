package handler_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/middleware"
	"github.com/zhiyu-saas/backend/internal/service"
	"github.com/zhiyu-saas/backend/internal/store"
)

// TestReplacePeriodSlots 验证节次整体替换接口：
// 同名更新、新增、多余删除、事务落库、空列表校验。
func TestReplacePeriodSlots(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	st := store.New(env.DB)
	sch := &handler.SchedulingHandler{Service: service.NewAffairsService(service.New(st))}
	env.Router.Group(func(r chi.Router) {
		r.Use(middleware.JWT(testhelper.TestJWTSecret))
		r.Put("/api/v1/affairs/period-slots/replace", sch.ReplacePeriodSlots)
		r.Get("/api/v1/affairs/period-slots", sch.ListPeriodSlots)
		r.Post("/api/v1/affairs/period-slots", sch.CreatePeriodSlot)
	})

	token := env.NewTokenWithIdentity("school-admin-001", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	do := func(method, path string, body interface{}) *httptest.ResponseRecorder {
		return env.DoWithToken(method, path, body, token)
	}
	defer env.DB.Exec(ctx, "DELETE FROM period_slots WHERE tenant_id = $1", testhelper.TestTenantID)

	// 1. 整体替换：创建 上午1/上午2/下午1 三个节次
	wc := do("PUT", "/api/v1/affairs/period-slots/replace", map[string]interface{}{
		"items": []map[string]interface{}{
			{"name": "上午1", "type": "morning", "sortOrder": 0, "startTime": "08:00", "endTime": "08:45"},
			{"name": "上午2", "type": "morning", "sortOrder": 1, "startTime": "08:55", "endTime": "09:40"},
			{"name": "下午1", "type": "afternoon", "sortOrder": 2, "startTime": "14:00", "endTime": "14:45"},
		},
	})
	if wc.Code != http.StatusOK {
		t.Fatalf("replace create: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	slots, _, err := testhelper.UnmarshalList[domain.PeriodSlot](wc)
	if err != nil {
		t.Fatalf("unmarshal replace: %v", err)
	}
	if len(slots) != 3 {
		t.Fatalf("expected 3 slots, got %d", len(slots))
	}
	if slots[0].Type != "morning" || slots[2].Type != "afternoon" {
		t.Fatalf("slot types mismatch: %+v", slots)
	}
	if slots[0].StartTime == nil || *slots[0].StartTime != "08:00" {
		t.Fatalf("slot startTime mismatch: %+v", slots[0])
	}

	// 2. 再次替换：上午1 同名更新时间，新增 早自习1，删除 上午2/下午1
	wc = do("PUT", "/api/v1/affairs/period-slots/replace", map[string]interface{}{
		"items": []map[string]interface{}{
			{"name": "早自习1", "type": "morning_self", "sortOrder": 0, "startTime": "07:30", "endTime": "07:50"},
			{"name": "上午1", "type": "morning", "sortOrder": 1, "startTime": "08:10", "endTime": "08:55"},
		},
	})
	if wc.Code != http.StatusOK {
		t.Fatalf("replace update: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	slots, _, err = testhelper.UnmarshalList[domain.PeriodSlot](wc)
	if err != nil {
		t.Fatalf("unmarshal replace2: %v", err)
	}
	if len(slots) != 2 {
		t.Fatalf("expected 2 slots after replace, got %d", len(slots))
	}
	byName := map[string]domain.PeriodSlot{}
	for _, s := range slots {
		byName[s.Name] = s
	}
	if s, ok := byName["上午1"]; !ok || s.StartTime == nil || *s.StartTime != "08:10" {
		t.Fatalf("上午1 should be updated with new startTime: %+v", byName)
	}
	if s, ok := byName["早自习1"]; !ok || s.Type != "morning_self" {
		t.Fatalf("早自习1 should exist with type morning_self: %+v", byName)
	}
	if _, ok := byName["上午2"]; ok {
		t.Fatal("上午2 should have been deleted")
	}

	// 3. 落库校验：重新查询仍为替换后的结果
	wl := do("GET", "/api/v1/affairs/period-slots?tenantId="+testhelper.TestTenantID, nil)
	if wl.Code != http.StatusOK {
		t.Fatalf("list: %d", wl.Code)
	}
	listed, _, err := testhelper.UnmarshalList[domain.PeriodSlot](wl)
	if err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(listed) != 2 {
		t.Fatalf("expected 2 slots in db, got %d", len(listed))
	}

	// 4. 空列表拒绝
	wc = do("PUT", "/api/v1/affairs/period-slots/replace", map[string]interface{}{"items": []interface{}{}})
	if wc.Code != http.StatusBadRequest {
		t.Fatalf("empty items should be 400, got %d", wc.Code)
	}
}

// TestReplacePeriodSlotsTypeNormalize 类型缺省归一为 morning，非法类型不落库。
func TestReplacePeriodSlotsTypeNormalize(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	st := store.New(env.DB)
	sch := &handler.SchedulingHandler{Service: service.NewAffairsService(service.New(st))}
	env.Router.Group(func(r chi.Router) {
		r.Use(middleware.JWT(testhelper.TestJWTSecret))
		r.Put("/api/v1/affairs/period-slots/replace", sch.ReplacePeriodSlots)
	})

	token := env.NewTokenWithIdentity("school-admin-002", testhelper.TestTenantID, domain.UserRoleSchool, nil, "school_admin")
	defer env.DB.Exec(ctx, "DELETE FROM period_slots WHERE tenant_id = $1", testhelper.TestTenantID)

	wc := env.DoWithToken("PUT", "/api/v1/affairs/period-slots/replace", map[string]interface{}{
		"items": []map[string]interface{}{
			{"name": "上午1", "sortOrder": 0},
			{"name": "晚自习1", "type": "weird", "sortOrder": 1},
		},
	}, token)
	if wc.Code != http.StatusOK {
		t.Fatalf("replace: %d %s", wc.Code, testhelper.ErrMsg(wc))
	}
	slots, _, err := testhelper.UnmarshalList[domain.PeriodSlot](wc)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	byName := map[string]domain.PeriodSlot{}
	for _, s := range slots {
		byName[s.Name] = s
	}
	if byName["上午1"].Type != "morning" {
		t.Fatalf("缺省类型应为 morning, got %s", byName["上午1"].Type)
	}
	if byName["晚自习1"].Type != "morning" {
		t.Fatalf("非法类型应归一为 morning, got %s", byName["晚自习1"].Type)
	}
}
