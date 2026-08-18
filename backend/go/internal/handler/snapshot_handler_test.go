package handler_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
	"github.com/zhiyu-saas/backend/internal/store"
)

// publishContent 走完发布链路：submit → review(approved) → publish（每次发布版本 +0.1 并落快照）。
func publishContent(t *testing.T, env *testhelper.TestEnv, base, id string) {
	t.Helper()
	if w := env.Do("POST", base+"/"+id+"/submit", nil); w.Code != http.StatusOK {
		t.Fatalf("submit %s: expected 200, got %d: %s", base, w.Code, testhelper.ErrMsg(w))
	}
	if w := env.Do("POST", base+"/"+id+"/review", map[string]string{"status": "approved"}); w.Code != http.StatusOK {
		t.Fatalf("review %s: expected 200, got %d: %s", base, w.Code, testhelper.ErrMsg(w))
	}
	if w := env.Do("POST", base+"/"+id+"/publish", nil); w.Code != http.StatusOK {
		t.Fatalf("publish %s: expected 200, got %d: %s", base, w.Code, testhelper.ErrMsg(w))
	}
}

// republishContent 转草稿后重新走发布链路（published → draft → 发布）。
func republishContent(t *testing.T, env *testhelper.TestEnv, base, id string) {
	t.Helper()
	if w := env.Do("POST", base+"/"+id+"/save-draft", nil); w.Code != http.StatusOK {
		t.Fatalf("save-draft %s: expected 200, got %d: %s", base, w.Code, testhelper.ErrMsg(w))
	}
	publishContent(t, env, base, id)
}

func createScenario(t *testing.T, env *testhelper.TestEnv, name string) string {
	t.Helper()
	w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
		"name":       name,
		"code":       fmt.Sprintf("snap-sc-%s", uuid.NewString()[:8]),
		"difficulty": 1,
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create scenario: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	sc, err := testhelper.Unmarshal[domain.Scenario](w)
	if err != nil {
		t.Fatalf("unmarshal scenario: %v", err)
	}
	return sc.ID
}

func createCourse(t *testing.T, env *testhelper.TestEnv, name string) string {
	t.Helper()
	w := env.Do("POST", "/api/v1/lesson/courses", map[string]interface{}{
		"name":     name,
		"type":     "system",
		"category": "公共基础课",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create course: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	c, err := testhelper.Unmarshal[domain.Course](w)
	if err != nil {
		t.Fatalf("unmarshal course: %v", err)
	}
	return c.ID
}

func createExam(t *testing.T, env *testhelper.TestEnv, name string) string {
	t.Helper()
	w := env.Do("POST", "/api/v1/evaluation/exams", map[string]interface{}{"name": name, "duration": 60})
	if w.Code != http.StatusCreated {
		t.Fatalf("create exam: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	e, err := testhelper.Unmarshal[domain.Exam](w)
	if err != nil {
		t.Fatalf("unmarshal exam: %v", err)
	}
	return e.ID
}

func studentToken(env *testhelper.TestEnv) string {
	return env.NewTokenWithIdentity(uuid.NewString(), testhelper.TestTenantID, domain.RoleStudent, nil, domain.RoleStudent)
}

func teacherToken(env *testhelper.TestEnv) string {
	return env.NewTokenWithIdentity(uuid.NewString(), testhelper.TestTenantID, domain.RoleTeacher, nil, domain.RoleTeacher)
}

func snapshotCount(t *testing.T, env *testhelper.TestEnv, resourceType, resourceID string) int {
	t.Helper()
	var cnt int
	if err := env.DB.QueryRow(context.Background(), `
		SELECT COUNT(*) FROM resource_snapshots WHERE resource_type = $1 AND resource_id = $2
	`, resourceType, resourceID).Scan(&cnt); err != nil {
		t.Fatalf("count snapshots: %v", err)
	}
	return cnt
}

func bundleOf(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var doc map[string]any
	if err := json.NewDecoder(w.Body).Decode(&doc); err != nil {
		t.Fatalf("decode bundle: %v (status=%d body=%s)", err, w.Code, w.Body.String())
	}
	return doc
}

// 发布落快照 + 幂等 + ?version= 读快照：再发布后旧版本快照内容不漂移。
func TestSnapshotBundle_PublishAndVersionRead(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	scenarioID := createScenario(t, env, "快照场景-初版")
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scenarioID)
	defer env.DB.Exec(ctx, "DELETE FROM resource_snapshots WHERE resource_id = $1", scenarioID)

	publishContent(t, env, "/api/v1/scene/scenarios", scenarioID)
	if cnt := snapshotCount(t, env, store.SnapshotResourceScenario, scenarioID); cnt != 1 {
		t.Fatalf("after first publish: expected 1 snapshot, got %d", cnt)
	}

	// 默认读最新快照（V1.1 = 首次发布 bump 后版本）
	w := env.Do("GET", "/api/v1/scene/scenarios/"+scenarioID+"/snapshot", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get snapshot: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	doc := bundleOf(t, w)
	scenario, _ := doc["scenario"].(map[string]any)
	if scenario["version"] != "V1.1" {
		t.Fatalf("expected snapshot version V1.1, got %v", scenario["version"])
	}
	if scenario["name"] != "快照场景-初版" {
		t.Fatalf("expected initial name, got %v", scenario["name"])
	}

	// 改名再发布 → V1.2 新快照，V1.1 旧快照内容不漂移
	w = env.Do("PUT", "/api/v1/scene/scenarios/"+scenarioID, map[string]interface{}{"name": "快照场景-改版"})
	if w.Code != http.StatusOK {
		t.Fatalf("update scenario: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	republishContent(t, env, "/api/v1/scene/scenarios", scenarioID)
	if cnt := snapshotCount(t, env, store.SnapshotResourceScenario, scenarioID); cnt != 2 {
		t.Fatalf("after republish: expected 2 snapshots, got %d", cnt)
	}

	w = env.Do("GET", "/api/v1/scene/scenarios/"+scenarioID+"/snapshot?version=V1.1", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("get snapshot V1.1: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	scenario, _ = bundleOf(t, w)["scenario"].(map[string]any)
	if scenario["name"] != "快照场景-初版" {
		t.Fatalf("V1.1 snapshot should keep old name, got %v", scenario["name"])
	}

	w = env.Do("GET", "/api/v1/scene/scenarios/"+scenarioID+"/snapshot", nil)
	scenario, _ = bundleOf(t, w)["scenario"].(map[string]any)
	if scenario["version"] != "V1.2" || scenario["name"] != "快照场景-改版" {
		t.Fatalf("latest snapshot should be V1.2 改版, got version=%v name=%v", scenario["version"], scenario["name"])
	}

	// 快照写入幂等：同 (resource_type, resource_id, version) 重复写不产生第二行
	raw := json.RawMessage(`{"scenario":{"name":"幂等覆盖"}}`)
	snap := env.Store.Snapshots()
	if err := snap.SaveSnapshot(ctx, testhelper.TestTenantID, store.SnapshotResourceScenario, scenarioID, "V1.1", raw); err != nil {
		t.Fatalf("save snapshot: %v", err)
	}
	if err := snap.SaveSnapshot(ctx, testhelper.TestTenantID, store.SnapshotResourceScenario, scenarioID, "V1.1", raw); err != nil {
		t.Fatalf("save snapshot again: %v", err)
	}
	if cnt := snapshotCount(t, env, store.SnapshotResourceScenario, scenarioID); cnt != 2 {
		t.Fatalf("idempotent save: expected still 2 snapshots, got %d", cnt)
	}
}

// 学生读 draft：Get 加固 404 + bundle 快照缺档回退 live 的 published 条件（A1）。
func TestSnapshotBundle_StudentDraft404(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	student := studentToken(env)

	// draft 场景/课程/试卷：学生 Get 一律 404，bundle 也 404（无快照 + live 非 published 不回退）
	scenarioID := createScenario(t, env, "草稿场景")
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", scenarioID)
	if w := env.DoWithToken("GET", "/api/v1/scene/scenarios/"+scenarioID, nil, student); w.Code != http.StatusNotFound {
		t.Fatalf("student get draft scenario: expected 404, got %d", w.Code)
	}
	if w := env.DoWithToken("GET", "/api/v1/scene/scenarios/"+scenarioID+"/snapshot", nil, student); w.Code != http.StatusNotFound {
		t.Fatalf("student get draft scenario snapshot: expected 404, got %d", w.Code)
	}

	courseID := createCourse(t, env, "草稿课程")
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", courseID)
	if w := env.DoWithToken("GET", "/api/v1/lesson/courses/"+courseID, nil, student); w.Code != http.StatusNotFound {
		t.Fatalf("student get draft course: expected 404, got %d", w.Code)
	}
	if w := env.DoWithToken("GET", "/api/v1/lesson/courses/"+courseID+"/snapshot", nil, student); w.Code != http.StatusNotFound {
		t.Fatalf("student get draft course snapshot: expected 404, got %d", w.Code)
	}

	examID := createExam(t, env, "草稿试卷")
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", examID)
	if w := env.DoWithToken("GET", "/api/v1/evaluation/exams/"+examID, nil, student); w.Code != http.StatusNotFound {
		t.Fatalf("student get draft exam: expected 404, got %d", w.Code)
	}
	if w := env.DoWithToken("GET", "/api/v1/evaluation/exams/"+examID+"/snapshot", nil, student); w.Code != http.StatusNotFound {
		t.Fatalf("student get draft exam snapshot: expected 404, got %d", w.Code)
	}

	// 历史数据（无快照）：live published 时回退 live 组装 bundle
	legacyID := uuid.NewString()
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", legacyID)
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO scenarios (id, tenant_id, name, code, difficulty, version, status)
		VALUES ($1, $2, '历史已发布场景', $3, 1, 'V1.0', 'published')
	`, legacyID, testhelper.TestTenantID, "snap-legacy-"+legacyID[:8]); err != nil {
		t.Fatalf("insert legacy scenario: %v", err)
	}
	if w := env.DoWithToken("GET", "/api/v1/scene/scenarios/"+legacyID+"/snapshot", nil, student); w.Code != http.StatusOK {
		t.Fatalf("legacy published fallback: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	if w := env.DoWithToken("GET", "/api/v1/scene/scenarios/"+legacyID+"/snapshot?version=V1.0", nil, student); w.Code != http.StatusOK {
		t.Fatalf("legacy published fallback with version: expected 200, got %d", w.Code)
	}

	// A1：转草稿期间 version 不变，快照缺档时回退 live 必须 404（含显式 version 匹配 live 版本的情况）
	if _, err := env.DB.Exec(ctx, `UPDATE scenarios SET status = 'draft' WHERE id = $1`, legacyID); err != nil {
		t.Fatalf("demote legacy scenario: %v", err)
	}
	if w := env.DoWithToken("GET", "/api/v1/scene/scenarios/"+legacyID+"/snapshot", nil, student); w.Code != http.StatusNotFound {
		t.Fatalf("legacy draft fallback: expected 404, got %d", w.Code)
	}
	if w := env.DoWithToken("GET", "/api/v1/scene/scenarios/"+legacyID+"/snapshot?version=V1.0", nil, student); w.Code != http.StatusNotFound {
		t.Fatalf("legacy draft fallback with version: expected 404, got %d", w.Code)
	}
}

// 学生请求 bundle 剥离答案/解析；教师不剥离。
func TestSnapshotBundle_StudentAnswerStrip(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	// 题库 + 已发布题目（快照 builder 只收 published 题目）
	w := env.Do("POST", "/api/v1/evaluation/question-banks", map[string]interface{}{"name": "剥离测试题库"})
	if w.Code != http.StatusCreated {
		t.Fatalf("create bank: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	bank, err := testhelper.Unmarshal[domain.QuestionBank](w)
	if err != nil {
		t.Fatalf("unmarshal bank: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM question_banks WHERE id = $1", bank.ID)
	defer env.DB.Exec(ctx, "DELETE FROM resource_snapshots WHERE resource_id = $1", bank.ID)

	questionID := uuid.NewString()
	defer env.DB.Exec(ctx, "DELETE FROM questions WHERE id = $1", questionID)
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO questions (id, tenant_id, code, bank_id, type, content, options, answer, analysis, score, status)
		VALUES ($1, $2, $3, $4, 'single', '题干', '[{"key":"A","value":"选项A"}]', '["A"]', '解析文本', 5, 'published')
	`, questionID, testhelper.TestTenantID, "snap-q-"+questionID[:8], bank.ID); err != nil {
		t.Fatalf("insert question: %v", err)
	}

	examID := createExam(t, env, "剥离测试试卷")
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", examID)
	defer env.DB.Exec(ctx, "DELETE FROM resource_snapshots WHERE resource_id = $1", examID)
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO exam_questions (id, tenant_id, exam_id, question_id, type, content, options, answer, analysis, score, sort_order)
		VALUES (gen_random_uuid(), $1, $2, $3, 'single', '题干', '[{"key":"A","value":"选项A"}]', '["A"]', '解析文本', 5, 1)
	`, testhelper.TestTenantID, examID, questionID); err != nil {
		t.Fatalf("insert exam question: %v", err)
	}

	publishContent(t, env, "/api/v1/evaluation/exams", examID)
	publishContent(t, env, "/api/v1/evaluation/question-banks", bank.ID)

	// 试卷 bundle：教师可见答案，学生剥离 answer/analysis
	examQuestions := func(w *httptest.ResponseRecorder) []any {
		doc := bundleOf(t, w)
		qs, _ := doc["exam_questions"].([]any)
		if len(qs) == 0 {
			t.Fatalf("bundle missing exam_questions: %v", doc)
		}
		return qs
	}
	w = env.DoWithToken("GET", "/api/v1/evaluation/exams/"+examID+"/snapshot", nil, teacherToken(env))
	if w.Code != http.StatusOK {
		t.Fatalf("teacher get exam bundle: expected 200, got %d", w.Code)
	}
	q, _ := examQuestions(w)[0].(map[string]any)
	if _, ok := q["answer"]; !ok {
		t.Fatalf("teacher bundle should keep answer")
	}
	if _, ok := q["analysis"]; !ok {
		t.Fatalf("teacher bundle should keep analysis")
	}

	w = env.DoWithToken("GET", "/api/v1/evaluation/exams/"+examID+"/snapshot", nil, studentToken(env))
	if w.Code != http.StatusOK {
		t.Fatalf("student get exam bundle: expected 200, got %d", w.Code)
	}
	q, _ = examQuestions(w)[0].(map[string]any)
	if _, ok := q["answer"]; ok {
		t.Fatalf("student bundle must strip answer, got %v", q["answer"])
	}
	if _, ok := q["analysis"]; ok {
		t.Fatalf("student bundle must strip analysis")
	}
	if q["content"] != "题干" {
		t.Fatalf("student bundle should keep question content, got %v", q["content"])
	}

	// 题库 bundle：学生同样剥离题目 answer/analysis
	w = env.DoWithToken("GET", "/api/v1/evaluation/question-banks/"+bank.ID+"/snapshot", nil, studentToken(env))
	if w.Code != http.StatusOK {
		t.Fatalf("student get bank bundle: expected 200, got %d", w.Code)
	}
	qs, _ := bundleOf(t, w)["questions"].([]any)
	if len(qs) == 0 {
		t.Fatalf("bank bundle missing questions")
	}
	bq, _ := qs[0].(map[string]any)
	if _, ok := bq["answer"]; ok {
		t.Fatalf("student bank bundle must strip answer")
	}
	if _, ok := bq["analysis"]; ok {
		t.Fatalf("student bank bundle must strip analysis")
	}
}

// 学生列表仅见已发布；教师/管理员列表语义不变。
func TestSnapshotHardening_ListFilter(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	student := studentToken(env)

	draftScenario := createScenario(t, env, "列表-草稿场景-唯一")
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", draftScenario)
	publishedScenario := createScenario(t, env, "列表-已发布场景-唯一")
	defer env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", publishedScenario)
	defer env.DB.Exec(ctx, "DELETE FROM resource_snapshots WHERE resource_id = $1", publishedScenario)
	publishContent(t, env, "/api/v1/scene/scenarios", publishedScenario)

	draftCourse := createCourse(t, env, "列表-草稿课程-唯一")
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", draftCourse)
	publishedCourse := createCourse(t, env, "列表-已发布课程-唯一")
	defer env.DB.Exec(ctx, "DELETE FROM courses WHERE id = $1", publishedCourse)
	defer env.DB.Exec(ctx, "DELETE FROM resource_snapshots WHERE resource_id = $1", publishedCourse)
	publishContent(t, env, "/api/v1/lesson/courses", publishedCourse)

	listIDs := func(w *httptest.ResponseRecorder) map[string]bool {
		items, _, err := testhelper.UnmarshalList[map[string]any](w)
		if err != nil {
			t.Fatalf("unmarshal list (status=%d body=%q): %v", w.Code, w.Body.String(), err)
		}
		ids := make(map[string]bool, len(items))
		for _, it := range items {
			if id, _ := it["id"].(string); id != "" {
				ids[id] = true
			}
		}
		return ids
	}

	// 学生：草稿不可见，已发布可见
	w := env.DoWithToken("GET", "/api/v1/scene/scenarios?limit=200", nil, student)
	if w.Code != http.StatusOK {
		t.Fatalf("student list scenarios: expected 200, got %d", w.Code)
	}
	if ids := listIDs(w); ids[draftScenario] || !ids[publishedScenario] {
		t.Fatalf("student scenario list: draft visible=%v, published visible=%v", ids[draftScenario], ids[publishedScenario])
	}

	w = env.DoWithToken("GET", "/api/v1/lesson/courses?limit=200", nil, student)
	if ids := listIDs(w); ids[draftCourse] || !ids[publishedCourse] {
		t.Fatalf("student course list: draft visible=%v, published visible=%v", ids[draftCourse], ids[publishedCourse])
	}

	// 教师/管理（operator token）：草稿与已发布均可见（语义不变）
	w = env.Do("GET", "/api/v1/scene/scenarios?limit=200", nil)
	if ids := listIDs(w); !ids[draftScenario] || !ids[publishedScenario] {
		t.Fatalf("operator scenario list should contain both draft and published")
	}
	w = env.Do("GET", "/api/v1/lesson/courses?limit=200", nil)
	if ids := listIDs(w); !ids[draftCourse] || !ids[publishedCourse] {
		t.Fatalf("operator course list should contain both draft and published")
	}
}

// 临时试卷统一为 published：学生可读取并作答（Get 不因 status 404），答案仍剥离。
func TestSnapshotHardening_TempExamPublished(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	student := studentToken(env)

	tempExamID := uuid.NewString()
	defer env.DB.Exec(ctx, "DELETE FROM exams WHERE id = $1", tempExamID)
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO exams (id, tenant_id, code, name, status, total_score, duration, version, owner_type, is_temp)
		VALUES ($1, $2, $3, '任务测评临时卷', 'published', 0, 60, 'V1.0', 'mine', TRUE)
	`, tempExamID, testhelper.TestTenantID, "snap-temp-"+tempExamID[:8]); err != nil {
		t.Fatalf("insert temp exam: %v", err)
	}

	// 学生可读临时卷（无快照，live published 回退）
	if w := env.DoWithToken("GET", "/api/v1/evaluation/exams/"+tempExamID, nil, student); w.Code != http.StatusOK {
		t.Fatalf("student get temp exam: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	if w := env.DoWithToken("GET", "/api/v1/evaluation/exams/"+tempExamID+"/snapshot", nil, student); w.Code != http.StatusOK {
		t.Fatalf("student get temp exam bundle: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
}
