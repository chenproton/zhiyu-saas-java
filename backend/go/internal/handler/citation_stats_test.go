package handler_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// citationStatsResp 引用次数分布接口响应。
type citationStatsResp struct {
	Buckets []struct {
		Label string `json:"label"`
		Count int    `json:"count"`
	} `json:"buckets"`
	ZeroCount int `json:"zeroCount"`
	Total     int `json:"total"`
}

func decodeCitationStats(t *testing.T, w *httptest.ResponseRecorder) citationStatsResp {
	t.Helper()
	var resp citationStatsResp
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode citation stats: %v", err)
	}
	return resp
}

func bucketCount(resp citationStatsResp, label string) int {
	for _, b := range resp.Buckets {
		if b.Label == label {
			return b.Count
		}
	}
	return -1
}

// cleanupResourceCitationData 清理资源引用统计涉及的租户数据，
// 保证统计断言不受历史数据干扰（SetupTestEnv 不清理这些表）。
func cleanupResourceCitationData(t *testing.T, env *testhelper.TestEnv) {
	t.Helper()
	ctx := context.Background()
	for _, tbl := range []string{"course_resource_bindings", "node_resource_bindings", "task_resource_bindings"} {
		if _, err := env.DB.Exec(ctx, "DELETE FROM "+tbl+" WHERE tenant_id = $1", testhelper.TestTenantID); err != nil {
			t.Fatalf("cleanup %s: %v", tbl, err)
		}
	}
	if _, err := env.DB.Exec(ctx, "DELETE FROM courses WHERE tenant_id = $1", testhelper.TestTenantID); err != nil {
		t.Fatalf("cleanup courses: %v", err)
	}
	if _, err := env.DB.Exec(ctx, "DELETE FROM resource_library WHERE tenant_id = $1", testhelper.TestTenantID); err != nil {
		t.Fatalf("cleanup resource_library: %v", err)
	}
}

// TestKnowledgePointCitationStats 验证知识点引用次数分布：
// 引用源为课程/节点/题库/试题，全部未引用时 zeroCount 覆盖全量。
func TestKnowledgePointCitationStats(t *testing.T) {
	env, do := newResourceLibraryTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	prefix := fmt.Sprintf("引用统计-%s", uuid.NewString()[:8])
	createKP := func(name string) string {
		w := do("POST", "/api/v1/lesson/knowledge-points", map[string]interface{}{
			"name":   name,
			"linked": false,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create kp: %d %s", w.Code, testhelper.ErrMsg(w))
		}
		var item struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(w.Body).Decode(&item); err != nil {
			t.Fatalf("decode kp: %v", err)
		}
		t.Cleanup(func() { env.DB.Exec(ctx, "DELETE FROM knowledge_points WHERE id = $1", item.ID) })
		return item.ID
	}

	kpZero := createKP(prefix + "-零引用")
	kpCourse := createKP(prefix + "-课程引用")
	kpNode := createKP(prefix + "-节点引用")
	kpBank := createKP(prefix + "-题库引用")
	kpQuestion := createKP(prefix + "-试题引用")

	// 课程引用（courses.knowledge_point_ids 数组）：先建真实课程（node 也复用此课程）
	courseID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO courses (id, code, name, type, category, status, creator_id, tenant_id, knowledge_point_ids)
		VALUES ($1, $2, $3, 'system', '测试', 'draft', $4, $5, ARRAY[$6::uuid])
	`, courseID, "CODE-"+uuid.NewString()[:6], prefix+"-课", testhelper.TestOperatorID, testhelper.TestTenantID, kpCourse); err != nil {
		t.Fatalf("insert course ref: %v", err)
	}
	// 节点引用（node_knowledge_point_bindings）：先建真实节点（system_course_nodes）
	nodeID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO system_course_nodes (id, course_id, name, ref_type)
		VALUES ($1, $2, $3, 'manual')
	`, nodeID, courseID, prefix+"-节点"); err != nil {
		t.Fatalf("insert node: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO node_knowledge_point_bindings (id, node_id, knowledge_point_id)
		VALUES ($1, $2, $3)
	`, uuid.NewString(), nodeID, kpNode); err != nil {
		t.Fatalf("insert node ref: %v", err)
	}
	// 题库引用（question_bank_knowledge_points）：先建真实题库
	bankID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO question_banks (id, name, status, question_count, creator_id, collaborator_ids, collaborator_dept_ids, owner_type, is_draft_pool, code)
		VALUES ($1, $2, 'draft', 0, $3, '{}', '{}', 'private', false, $4)
	`, bankID, prefix+"-题库", testhelper.TestOperatorID, "QB-"+uuid.NewString()[:6]); err != nil {
		t.Fatalf("insert bank: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO question_bank_knowledge_points (id, question_bank_id, knowledge_point_id)
		VALUES ($1, $2, $3)
	`, uuid.NewString(), bankID, kpBank); err != nil {
		t.Fatalf("insert bank ref: %v", err)
	}
	// 试题引用（questions.knowledge_point_ids）：复用上面题库
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO questions (id, bank_id, type, content, answer, code, knowledge_point_ids, tenant_id)
		VALUES ($1, $2, 'single', '题目', '答案', 'Q-' || $5, ARRAY[$3::uuid], $4)
	`, uuid.NewString(), bankID, kpQuestion, testhelper.TestTenantID, uuid.NewString()[:6]); err != nil {
		t.Fatalf("insert question ref: %v", err)
	}

	wStats := do("GET", "/api/v1/lesson/knowledge-points/citation-stats", nil)
	if wStats.Code != http.StatusOK {
		t.Fatalf("citation stats: %d %s", wStats.Code, testhelper.ErrMsg(wStats))
	}
	resp := decodeCitationStats(t, wStats)
	if resp.Total != 5 {
		t.Fatalf("total = %d, want 5", resp.Total)
	}
	if resp.ZeroCount != 1 || bucketCount(resp, "0次") != 1 {
		t.Fatalf("zeroCount = %d, want 1; 0次桶 = %d", resp.ZeroCount, bucketCount(resp, "0次"))
	}
	if got := bucketCount(resp, "1-5次"); got != 4 {
		t.Fatalf("1-5次桶 = %d, want 4", got)
	}
	if len(resp.Buckets) != 5 {
		t.Fatalf("buckets = %d, want 5", len(resp.Buckets))
	}
	t.Logf("kp ids: zero=%s course=%s node=%s bank=%s question=%s", kpZero, kpCourse, kpNode, kpBank, kpQuestion)
}

// TestKnowledgePointUncitedList 验证零引用知识点列表：时段筛选 + 分页 + 租户隔离。
func TestKnowledgePointUncitedList(t *testing.T) {
	env, do := newResourceLibraryTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	prefix := fmt.Sprintf("零引用列表-%s", uuid.NewString()[:8])
	createKP := func(name string) string {
		w := do("POST", "/api/v1/lesson/knowledge-points", map[string]interface{}{
			"name":   name,
			"linked": false,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create kp: %d %s", w.Code, testhelper.ErrMsg(w))
		}
		var item struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(w.Body).Decode(&item); err != nil {
			t.Fatalf("decode kp: %v", err)
		}
		t.Cleanup(func() { env.DB.Exec(ctx, "DELETE FROM knowledge_points WHERE id = $1", item.ID) })
		return item.ID
	}

	kpA := createKP(prefix + "-A")
	kpB := createKP(prefix + "-B")

	// 把 kpA 的上传时间改到 30 天前，kpB 保持今天，验证时段筛选
	if _, err := env.DB.Exec(ctx, `
		UPDATE knowledge_points SET created_at = NOW() - INTERVAL '30 days' WHERE id = $1
	`, kpA); err != nil {
		t.Fatalf("backdate kpA: %v", err)
	}

	base := "/api/v1/lesson/knowledge-points/uncited"
	wAll := do("GET", base+"?limit=20&offset=0", nil)
	if wAll.Code != http.StatusOK {
		t.Fatalf("uncited all: %d %s", wAll.Code, testhelper.ErrMsg(wAll))
	}
	var list struct {
		Items []struct {
			ID        string    `json:"id"`
			Name      string    `json:"name"`
			CreatedAt time.Time `json:"createdAt"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if err := json.NewDecoder(wAll.Body).Decode(&list); err != nil {
		t.Fatalf("decode uncited: %v", err)
	}
	found := map[string]bool{}
	for _, it := range list.Items {
		found[it.ID] = true
	}
	if !found[kpA] || !found[kpB] {
		t.Fatalf("uncited items missing: %v, want kpA+kpB", found)
	}

	// 时段筛选：仅近 7 天（kpB）
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	wRecent := do("GET", base+"?startDate="+yesterday, nil)
	if wRecent.Code != http.StatusOK {
		t.Fatalf("uncited recent: %d %s", wRecent.Code, testhelper.ErrMsg(wRecent))
	}
	if err := json.NewDecoder(wRecent.Body).Decode(&list); err != nil {
		t.Fatalf("decode uncited recent: %v", err)
	}
	found = map[string]bool{}
	for _, it := range list.Items {
		found[it.ID] = true
	}
	if found[kpA] {
		t.Fatalf("recent filter should exclude backdated kpA: %v", found)
	}
	if !found[kpB] {
		t.Fatalf("recent filter should include kpB: %v", found)
	}

	// 非法日期返回 400
	wBad := do("GET", base+"?startDate=2026-13-45", nil)
	if wBad.Code != http.StatusBadRequest {
		t.Fatalf("bad date: %d, want 400", wBad.Code)
	}
}

// TestResourceCitationStats 验证资源引用次数分布（引用源：课程/节点/任务绑定）+ 类型过滤。
func TestResourceCitationStats(t *testing.T) {
	env, do := newResourceLibraryTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	cleanupResourceCitationData(t, env)

	prefix := fmt.Sprintf("资源引用统计-%s", uuid.NewString()[:8])
	ids := createTestResources(t, do, prefix, "document", "document", "image")

	// 课程绑定引用第一个 document；节点绑定引用第二个 document；image 零引用
	courseID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO courses (id, code, name, type, category, status, creator_id, tenant_id)
		VALUES ($1, $2, $3, 'system', '测试', 'draft', $4, $5)
	`, courseID, "CODE-"+uuid.NewString()[:6], prefix+"-课", testhelper.TestOperatorID, testhelper.TestTenantID); err != nil {
		t.Fatalf("insert course: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO course_resource_bindings (id, tenant_id, course_id, resource_id)
		VALUES ($1, $2, $3, $4)
	`, uuid.NewString(), testhelper.TestTenantID, courseID, ids[0]); err != nil {
		t.Fatalf("insert course binding: %v", err)
	}
	nodeID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO system_course_nodes (id, course_id, name, ref_type)
		VALUES ($1, $2, $3, 'manual')
	`, nodeID, courseID, prefix+"-节点"); err != nil {
		t.Fatalf("insert node: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO node_resource_bindings (id, node_id, resource_id)
		VALUES ($1, $2, $3)
	`, uuid.NewString(), nodeID, ids[1]); err != nil {
		t.Fatalf("insert node binding: %v", err)
	}

	// 全量统计：3 个资源，1 个零引用
	wStats := do("GET", "/api/v1/library/resources/citation-stats", nil)
	if wStats.Code != http.StatusOK {
		t.Fatalf("citation stats: %d %s", wStats.Code, testhelper.ErrMsg(wStats))
	}
	resp := decodeCitationStats(t, wStats)
	if resp.Total != 3 {
		t.Fatalf("total = %d, want 3", resp.Total)
	}
	if resp.ZeroCount != 1 || bucketCount(resp, "1-5次") != 2 {
		t.Fatalf("zeroCount=%d (want 1), 1-5次桶=%d (want 2)", resp.ZeroCount, bucketCount(resp, "1-5次"))
	}

	// 类型过滤：仅 image → 1 个零引用
	wImg := do("GET", "/api/v1/library/resources/citation-stats?resourceType=image", nil)
	if wImg.Code != http.StatusOK {
		t.Fatalf("citation stats image: %d %s", wImg.Code, testhelper.ErrMsg(wImg))
	}
	respImg := decodeCitationStats(t, wImg)
	if respImg.Total != 1 || respImg.ZeroCount != 1 {
		t.Fatalf("image stats total=%d zeroCount=%d, want 1/1", respImg.Total, respImg.ZeroCount)
	}

	// 类型过滤：仅 document → 2 个，均被引用
	wDoc := do("GET", "/api/v1/library/resources/citation-stats?resourceType=document", nil)
	if wDoc.Code != http.StatusOK {
		t.Fatalf("citation stats document: %d %s", wDoc.Code, testhelper.ErrMsg(wDoc))
	}
	respDoc := decodeCitationStats(t, wDoc)
	if respDoc.Total != 2 || respDoc.ZeroCount != 0 {
		t.Fatalf("document stats total=%d zeroCount=%d, want 2/0", respDoc.Total, respDoc.ZeroCount)
	}
}

// TestResourceUncitedList 验证零引用资源列表：时段筛选 + 类型过滤。
func TestResourceUncitedList(t *testing.T) {
	env, do := newResourceLibraryTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	cleanupResourceCitationData(t, env)

	prefix := fmt.Sprintf("资源零引用-%s", uuid.NewString()[:8])
	ids := createTestResources(t, do, prefix, "document", "image")

	// 把第一个资源回拨到 30 天前
	if _, err := env.DB.Exec(ctx, `
		UPDATE resource_library SET created_at = NOW() - INTERVAL '30 days' WHERE id = $1
	`, ids[0]); err != nil {
		t.Fatalf("backdate resource: %v", err)
	}

	base := "/api/v1/library/resources/uncited"
	var list struct {
		Items []struct {
			ID        string    `json:"id"`
			Name      string    `json:"name"`
			CreatedAt time.Time `json:"createdAt"`
		} `json:"items"`
		Total int `json:"total"`
	}

	wAll := do("GET", base+"?limit=20&offset=0", nil)
	if wAll.Code != http.StatusOK {
		t.Fatalf("uncited all: %d %s", wAll.Code, testhelper.ErrMsg(wAll))
	}
	if err := json.NewDecoder(wAll.Body).Decode(&list); err != nil {
		t.Fatalf("decode uncited: %v", err)
	}
	if list.Total != 2 {
		t.Fatalf("uncited total = %d, want 2", list.Total)
	}

	// 时段筛选：近 7 天只应包含第二个资源
	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	wRecent := do("GET", base+"?startDate="+yesterday, nil)
	if wRecent.Code != http.StatusOK {
		t.Fatalf("uncited recent: %d %s", wRecent.Code, testhelper.ErrMsg(wRecent))
	}
	if err := json.NewDecoder(wRecent.Body).Decode(&list); err != nil {
		t.Fatalf("decode uncited recent: %v", err)
	}
	found := map[string]bool{}
	for _, it := range list.Items {
		found[it.ID] = true
	}
	if found[ids[0]] || !found[ids[1]] {
		t.Fatalf("recent filter wrong: %v; want only ids[1]", found)
	}

	// 类型过滤：仅 image
	wImg := do("GET", base+"?resourceType=image", nil)
	if wImg.Code != http.StatusOK {
		t.Fatalf("uncited image: %d %s", wImg.Code, testhelper.ErrMsg(wImg))
	}
	if err := json.NewDecoder(wImg.Body).Decode(&list); err != nil {
		t.Fatalf("decode uncited image: %v", err)
	}
	if list.Total != 1 {
		t.Fatalf("uncited image total = %d, want 1", list.Total)
	}
}
