package store

import (
	"context"
	"encoding/json"
	"reflect"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/zhiyu-saas/backend/internal/domain"
)

// ---------- 常量一致性（文档 5.6：builder 字段清单与 clone 列常量一致性） ----------

func splitColumns(t *testing.T, constName, cols string) []string {
	t.Helper()
	parts := strings.Split(cols, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		t.Fatalf("%s 解析为空", constName)
	}
	return out
}

func assertColumnsContain(t *testing.T, constName, cols string, required ...string) {
	t.Helper()
	got := make(map[string]bool)
	for _, c := range splitColumns(t, constName, cols) {
		got[c] = true
	}
	for _, r := range required {
		if !got[r] {
			t.Errorf("%s 缺少列 %s", constName, r)
		}
	}
}

// builder 直接复用这些常量拼接 SELECT，常量内容正确即保证 builder 与 clone 字段清单一致。
func TestSnapshotColumnConstants(t *testing.T) {
	assertColumnsContain(t, "TaskInsertColumns", TaskInsertColumns,
		"scenario_id", "name", "code", "sort_order", "description", "detailed_description",
		"description_pdf", "estimated_hours", "task_type", "difficulty", "background",
		"dependency_ids", "knowledge_point_ids", "ability_point_ids", "resource_ids", "eval_data", "tenant_id")
	assertColumnsContain(t, "PositionInsertColumns", PositionInsertColumns,
		"id", "tenant_id", "code", "name", "industry_id", "position_type", "description",
		"requirements", "career_path", "version", "status", "created_by", "collaborators")
	assertColumnsContain(t, "CourseInsertColumns", CourseInsertColumns,
		"id", "tenant_id", "code", "name", "type", "category", "version", "status",
		"knowledge_point_ids", "ability_point_ids", "resource_ids", "eval_data", "description")
	assertColumnsContain(t, "SystemCourseNodeInsertColumns", SystemCourseNodeInsertColumns,
		"id", "tenant_id", "course_id", "parent_id", "name", "sort_order", "ref_type", "source_id",
		"teaching_goals", "knowledge_point_ids", "resource_ids", "ability_point_ids", "eval_data", "status")
}

// ---------- 测试辅助 ----------

func snapExec(t *testing.T, pool *pgxpool.Pool, sql string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("fixture SQL 失败: %v\nsql: %s", err, sql)
	}
}

// snapCleanup 清理快照表（resource_snapshots 无 FK 是刻意设计，删租户不会级联）。
func snapCleanup(t *testing.T, pool *pgxpool.Pool, tenantID string) {
	t.Helper()
	t.Cleanup(func() {
		pool.Exec(context.Background(), `DELETE FROM resource_snapshots WHERE tenant_id = $1`, tenantID)
	})
}

func jsonDoc(t *testing.T, raw json.RawMessage) map[string]json.RawMessage {
	t.Helper()
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("快照 jsonb 解析失败: %v", err)
	}
	return doc
}

func jsonArr(t *testing.T, raw json.RawMessage) []map[string]any {
	t.Helper()
	var arr []map[string]any
	if err := json.Unmarshal(raw, &arr); err != nil {
		t.Fatalf("快照数组解析失败: %v", err)
	}
	return arr
}

// assertJSONEqual 语义级比对两份 jsonb（键序无关）。
func assertJSONEqual(t *testing.T, want, got json.RawMessage) {
	t.Helper()
	var w, g any
	if err := json.Unmarshal(want, &w); err != nil {
		t.Fatalf("want 解析失败: %v", err)
	}
	if err := json.Unmarshal(got, &g); err != nil {
		t.Fatalf("got 解析失败: %v", err)
	}
	if !reflect.DeepEqual(w, g) {
		t.Fatalf("往返读回不一致:\nwant: %s\ngot:  %s", want, got)
	}
}

// ---------- SnapshotStore 基础读写 ----------

// 覆盖：SaveSnapshot 幂等（同 version 重复写不产生第二行）、GetSnapshot 读回、LatestVersion。
func TestSnapshotStore_SaveGetLatest(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID := grantTestTenant(t, pool)
	snapCleanup(t, pool, tenantID)
	st := NewSnapshotStore(pool)
	resID := uuid.NewString()

	v1 := json.RawMessage(`{"a":1}`)
	if err := st.SaveSnapshot(ctx, tenantID, SnapshotResourceScenario, resID, "V1.0", v1); err != nil {
		t.Fatalf("SaveSnapshot: %v", err)
	}
	got, err := st.GetSnapshot(ctx, tenantID, SnapshotResourceScenario, resID, "V1.0")
	if err != nil {
		t.Fatalf("GetSnapshot: %v", err)
	}
	assertJSONEqual(t, v1, got)

	// 同 version 重复写：覆盖内容、不产生第二行
	v1b := json.RawMessage(`{"a":2}`)
	if err := st.SaveSnapshot(ctx, tenantID, SnapshotResourceScenario, resID, "V1.0", v1b); err != nil {
		t.Fatalf("SaveSnapshot 重复写: %v", err)
	}
	var rowCount int
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM resource_snapshots WHERE resource_type = $1 AND resource_id = $2 AND version = 'V1.0'
	`, SnapshotResourceScenario, resID).Scan(&rowCount); err != nil {
		t.Fatalf("count: %v", err)
	}
	if rowCount != 1 {
		t.Fatalf("同 version 重复写应只有一行, got %d", rowCount)
	}
	got, _ = st.GetSnapshot(ctx, tenantID, SnapshotResourceScenario, resID, "V1.0")
	assertJSONEqual(t, v1b, got)

	// LatestVersion 取最新写入的版本
	if err := st.SaveSnapshot(ctx, tenantID, SnapshotResourceScenario, resID, "V1.1", v1); err != nil {
		t.Fatalf("SaveSnapshot V1.1: %v", err)
	}
	latest, err := st.LatestVersion(ctx, tenantID, SnapshotResourceScenario, resID)
	if err != nil || latest != "V1.1" {
		t.Fatalf("LatestVersion = %q, %v; want V1.1", latest, err)
	}

	// 无快照资源返回空串（不报错，调用方回退 live）
	latest, err = st.LatestVersion(ctx, tenantID, SnapshotResourceScenario, uuid.NewString())
	if err != nil || latest != "" {
		t.Fatalf("无快照 LatestVersion = %q, %v; want 空串", latest, err)
	}

	// 跨租户隔离：其他租户读不到
	if _, err := st.GetSnapshot(ctx, uuid.NewString(), SnapshotResourceScenario, resID, "V1.0"); err != ErrNotFound {
		t.Fatalf("跨租户 GetSnapshot 应 ErrNotFound, got %v", err)
	}
	if _, err := st.GetSnapshot(ctx, tenantID, SnapshotResourceScenario, resID, "V9.9"); err != ErrNotFound {
		t.Fatalf("缺失版本应 ErrNotFound, got %v", err)
	}
}

// ---------- builder 往返 ----------

// 场景快照：整树 + 连带引用 + random_draw 抽题 + 关联岗位树，构建→SaveSnapshot→GetSnapshot 读回比对。
func TestBuildScenarioSnapshotRoundTrip(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID := grantTestTenant(t, pool)
	snapCleanup(t, pool, tenantID)
	userID := grantTestUser(t, pool, tenantID)
	st := NewSnapshotStore(pool)

	// 关联岗位（最小行）
	posID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO career_positions (id, tenant_id, code, name, position_type, version, status, created_by)
		VALUES ($1, $2, 'P1', '电商运营', 'fulltime', 'V1.0', 'published', $3)
	`, posID, tenantID, userID)

	// 连带引用实体
	kpID := uuid.NewString()
	snapExec(t, pool, `INSERT INTO knowledge_points (id, tenant_id, name, category) VALUES ($1, $2, '知识点-选品', '专业')`, kpID, tenantID)
	apID := uuid.NewString()
	snapExec(t, pool, `INSERT INTO ability_points (id, tenant_id, name) VALUES ($1, $2, '能力点-沟通')`, apID, tenantID)
	resID := uuid.NewString()
	snapExec(t, pool, `INSERT INTO resource_library (id, tenant_id, name, resource_type) VALUES ($1, $2, '资源-案例PDF', 'document')`, resID, tenantID)
	rdqID := uuid.NewString()
	snapExec(t, pool, `INSERT INTO random_draw_questions (id, tenant_id, name, answer) VALUES ($1, $2, '抽题-客服话术', '参考答案')`, rdqID, tenantID)

	// 场景 + 任务 + 测评配置
	scenarioID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO scenarios (id, tenant_id, name, code, version, status, creator_id, career_position_id)
		VALUES ($1, $2, '场景-店铺运营', 'SC-1', 'V1.0', 'draft', $3, $4)
	`, scenarioID, tenantID, userID, posID)
	taskID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO scenario_tasks (id, scenario_id, tenant_id, name, code, task_type, knowledge_point_ids, ability_point_ids, resource_ids)
		VALUES ($1, $2, $3, '任务-上架', 'T-1', 'practice', ARRAY[$4]::uuid[], ARRAY[$5]::uuid[], ARRAY[$6]::uuid[])
	`, taskID, scenarioID, tenantID, kpID, apID, resID)
	cfgID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, weight, resource_config)
		VALUES ($1, $2, $3, 'random_draw', 40, $4)
	`, cfgID, tenantID, taskID, `{"selectedQuestionIds":["`+rdqID+`"]}`)
	snapExec(t, pool, `INSERT INTO task_eval_points (id, tenant_id, config_id, name) VALUES ($1, $2, $3, '评分点-完整性')`, uuid.NewString(), tenantID, cfgID)
	snapExec(t, pool, `INSERT INTO task_eval_score_rules (id, tenant_id, config_id, name, weight) VALUES ($1, $2, $3, '规则-基础分', 10)`, uuid.NewString(), tenantID, cfgID)
	snapExec(t, pool, `INSERT INTO task_review_steps (id, tenant_id, config_id, label) VALUES ($1, $2, $3, '教师评审')`, uuid.NewString(), tenantID, cfgID)
	snapExec(t, pool, `INSERT INTO task_deliverables (id, tenant_id, task_id, type, name) VALUES ($1, $2, $3, 'file', '交付物-截图')`, uuid.NewString(), tenantID, taskID)
	snapExec(t, pool, `INSERT INTO task_knowledge_bindings (id, tenant_id, task_id, knowledge_point_id) VALUES ($1, $2, $3, $4)`, uuid.NewString(), tenantID, taskID, kpID)
	snapExec(t, pool, `INSERT INTO scenario_weight_configs (id, tenant_id, scenario_id, task_id, weight) VALUES ($1, $2, $3, $4, 100)`, uuid.NewString(), tenantID, scenarioID, taskID)
	snapExec(t, pool, `INSERT INTO scenario_grade_mappings (id, tenant_id, scenario_id, task_id, level, min_score, max_score) VALUES ($1, $2, $3, $4, 'A', 90, 100)`, uuid.NewString(), tenantID, scenarioID, taskID)

	built, err := st.BuildScenarioSnapshot(ctx, tenantID, scenarioID)
	if err != nil {
		t.Fatalf("BuildScenarioSnapshot: %v", err)
	}
	doc := jsonDoc(t, built)

	// 主表与子表内容
	var scenario map[string]any
	if err := json.Unmarshal(doc["scenario"], &scenario); err != nil {
		t.Fatalf("scenario 解析: %v", err)
	}
	if scenario["name"] != "场景-店铺运营" {
		t.Fatalf("scenario.name = %v", scenario["name"])
	}
	tasks := jsonArr(t, doc["scenario_tasks"])
	if len(tasks) != 1 || tasks[0]["name"] != "任务-上架" {
		t.Fatalf("scenario_tasks = %v", tasks)
	}
	if _, ok := tasks[0]["eval_data"]; !ok {
		t.Fatal("scenario_tasks 行缺 eval_data 列")
	}
	methods := jsonArr(t, doc["task_evaluation_methods"])
	if len(methods) != 1 || methods[0]["method_key"] != "random_draw" {
		t.Fatalf("task_evaluation_methods = %v", methods)
	}
	if len(jsonArr(t, doc["task_eval_points"])) != 1 ||
		len(jsonArr(t, doc["task_eval_score_rules"])) != 1 ||
		len(jsonArr(t, doc["task_review_steps"])) != 1 ||
		len(jsonArr(t, doc["task_deliverables"])) != 1 ||
		len(jsonArr(t, doc["task_knowledge_bindings"])) != 1 ||
		len(jsonArr(t, doc["scenario_weight_configs"])) != 1 ||
		len(jsonArr(t, doc["scenario_grade_mappings"])) != 1 {
		t.Fatal("场景子表行数不符")
	}

	// 连带引用内容冻结
	kps := jsonArr(t, doc["knowledge_points"])
	if len(kps) != 1 || kps[0]["name"] != "知识点-选品" {
		t.Fatalf("knowledge_points = %v", kps)
	}
	aps := jsonArr(t, doc["ability_points"])
	if len(aps) != 1 || aps[0]["name"] != "能力点-沟通" {
		t.Fatalf("ability_points = %v", aps)
	}
	resources := jsonArr(t, doc["resource_library"])
	if len(resources) != 1 || resources[0]["name"] != "资源-案例PDF" {
		t.Fatalf("resource_library = %v", resources)
	}

	// random_draw 抽题连带（文档 8.8）
	rdqs := jsonArr(t, doc["random_draw_questions"])
	if len(rdqs) != 1 || rdqs[0]["name"] != "抽题-客服话术" || rdqs[0]["answer"] != "参考答案" {
		t.Fatalf("random_draw_questions = %v", rdqs)
	}

	// 关联岗位树
	posDoc := jsonDoc(t, doc["position"])
	var pos map[string]any
	if err := json.Unmarshal(posDoc["position"], &pos); err != nil {
		t.Fatalf("内嵌岗位解析: %v", err)
	}
	if pos["name"] != "电商运营" {
		t.Fatalf("内嵌岗位 name = %v", pos["name"])
	}

	// 往返：写入后读回语义一致
	if err := st.SaveSnapshot(ctx, tenantID, SnapshotResourceScenario, scenarioID, "V1.0", built); err != nil {
		t.Fatalf("SaveSnapshot: %v", err)
	}
	got, err := st.GetSnapshot(ctx, tenantID, SnapshotResourceScenario, scenarioID, "V1.0")
	if err != nil {
		t.Fatalf("GetSnapshot: %v", err)
	}
	assertJSONEqual(t, built, got)
}

// 课程快照：节点 eval_data 显式包含（文档 13.D3）+ 颗粒课一层嵌入（文档 12.3）。
func TestBuildCourseSnapshotRoundTrip(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID := grantTestTenant(t, pool)
	snapCleanup(t, pool, tenantID)
	userID := grantTestUser(t, pool, tenantID)
	st := NewSnapshotStore(pool)

	// 颗粒课（被引用的一层）
	granularID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO courses (id, tenant_id, code, name, type, category, status, creator_id, version)
		VALUES ($1, $2, 'GC-1', '颗粒课-详情页制作', 'system', '专业', 'published', $3, 'V1.0')
	`, granularID, tenantID, userID)
	gNodeID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO system_course_nodes (id, tenant_id, course_id, name) VALUES ($1, $2, $3, '颗粒课节点-1')
	`, gNodeID, tenantID, granularID)

	// 主课
	courseID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO courses (id, tenant_id, code, name, type, category, status, creator_id, version)
		VALUES ($1, $2, 'C-1', '体系课-电商基础', 'system', '专业', 'draft', $3, 'V1.0')
	`, courseID, tenantID, userID)
	nodeID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO system_course_nodes (id, tenant_id, course_id, name, eval_data)
		VALUES ($1, $2, $3, '节点-第一章', '{"paper":{"passScore":60}}'::jsonb)
	`, nodeID, tenantID, courseID)
	refNodeID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO system_course_nodes (id, tenant_id, course_id, name, ref_type, source_id)
		VALUES ($1, $2, $3, '引用-颗粒课', 'original', $4)
	`, refNodeID, tenantID, courseID, granularID)
	quizID := uuid.NewString()
	snapExec(t, pool, `INSERT INTO node_quizzes (id, tenant_id, node_id, title, type) VALUES ($1, $2, $3, '章节测验', 'quiz')`, quizID, tenantID, nodeID)
	snapExec(t, pool, `
		INSERT INTO node_quiz_questions (id, tenant_id, quiz_id, type, question, answer, score)
		VALUES ($1, $2, $3, 'single', '1+1=?', '["2"]', 5)
	`, uuid.NewString(), tenantID, quizID)
	snapExec(t, pool, `
		INSERT INTO hybrid_node_modules (id, tenant_id, node_id, module_key, mode, data)
		VALUES ($1, $2, $3, 'video', 'online', '{"url":"https://example.com/v.mp4"}'::jsonb)
	`, uuid.NewString(), tenantID, nodeID)

	built, err := st.BuildCourseSnapshot(ctx, tenantID, courseID)
	if err != nil {
		t.Fatalf("BuildCourseSnapshot: %v", err)
	}
	doc := jsonDoc(t, built)

	nodes := jsonArr(t, doc["system_course_nodes"])
	if len(nodes) != 2 {
		t.Fatalf("system_course_nodes 应有 2 行, got %d", len(nodes))
	}
	var evalData map[string]any
	foundEval := false
	for _, n := range nodes {
		if n["name"] == "节点-第一章" {
			raw, _ := json.Marshal(n["eval_data"])
			if err := json.Unmarshal(raw, &evalData); err == nil {
				if paper, ok := evalData["paper"].(map[string]any); ok && paper["passScore"] == float64(60) {
					foundEval = true
				}
			}
		}
	}
	if !foundEval {
		t.Fatal("system_course_nodes 快照缺 eval_data 内容（文档 13.D3）")
	}
	if len(jsonArr(t, doc["node_quizzes"])) != 1 || len(jsonArr(t, doc["node_quiz_questions"])) != 1 {
		t.Fatal("节点测验快照缺失")
	}
	if len(jsonArr(t, doc["hybrid_node_modules"])) != 1 {
		t.Fatal("混合模块快照缺失")
	}

	// 颗粒课一层：含主表+节点，不递归
	var granular map[string]json.RawMessage
	if err := json.Unmarshal(doc["granular_courses"], &granular); err != nil {
		t.Fatalf("granular_courses 解析: %v", err)
	}
	entry, ok := granular[granularID]
	if !ok {
		t.Fatalf("granular_courses 缺颗粒课 %s", granularID)
	}
	entryDoc := jsonDoc(t, entry)
	var gc map[string]any
	if err := json.Unmarshal(entryDoc["course"], &gc); err != nil {
		t.Fatalf("颗粒课主表解析: %v", err)
	}
	if gc["name"] != "颗粒课-详情页制作" {
		t.Fatalf("颗粒课 name = %v", gc["name"])
	}
	if len(jsonArr(t, entryDoc["system_course_nodes"])) != 1 {
		t.Fatal("颗粒课节点快照缺失")
	}
	if _, recursive := entryDoc["granular_courses"]; recursive {
		t.Fatal("颗粒课只嵌入一层，不得递归")
	}

	// 往返
	if err := st.SaveSnapshot(ctx, tenantID, SnapshotResourceCourse, courseID, "V1.0", built); err != nil {
		t.Fatalf("SaveSnapshot: %v", err)
	}
	got, err := st.GetSnapshot(ctx, tenantID, SnapshotResourceCourse, courseID, "V1.0")
	if err != nil {
		t.Fatalf("GetSnapshot: %v", err)
	}
	assertJSONEqual(t, built, got)
}

// 试卷快照 + 题库快照（题库只含已发布题目）。
func TestBuildExamAndQuestionBankSnapshot(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID := grantTestTenant(t, pool)
	snapCleanup(t, pool, tenantID)
	userID := grantTestUser(t, pool, tenantID)
	st := NewSnapshotStore(pool)

	examID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO exams (id, tenant_id, code, name, status, duration, version)
		VALUES ($1, $2, 'E-1', '期末试卷', 'draft', 60, 'V1.0')
	`, examID, tenantID)
	snapExec(t, pool, `
		INSERT INTO exam_questions (id, tenant_id, exam_id, type, content, answer, score, sort_order)
		VALUES ($1, $2, $3, 'single', '题干-A', '["A"]', 5, 1)
	`, uuid.NewString(), tenantID, examID)

	built, err := st.BuildExamSnapshot(ctx, tenantID, examID)
	if err != nil {
		t.Fatalf("BuildExamSnapshot: %v", err)
	}
	doc := jsonDoc(t, built)
	var exam map[string]any
	if err := json.Unmarshal(doc["exam"], &exam); err != nil {
		t.Fatalf("exam 解析: %v", err)
	}
	if exam["name"] != "期末试卷" {
		t.Fatalf("exam.name = %v", exam["name"])
	}
	eqs := jsonArr(t, doc["exam_questions"])
	if len(eqs) != 1 || eqs[0]["content"] != "题干-A" {
		t.Fatalf("exam_questions = %v", eqs)
	}

	if err := st.SaveSnapshot(ctx, tenantID, SnapshotResourceExam, examID, "V1.0", built); err != nil {
		t.Fatalf("SaveSnapshot: %v", err)
	}
	got, err := st.GetSnapshot(ctx, tenantID, SnapshotResourceExam, examID, "V1.0")
	if err != nil {
		t.Fatalf("GetSnapshot: %v", err)
	}
	assertJSONEqual(t, built, got)

	// 题库：只快照已发布题目
	bankID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO question_banks (id, tenant_id, code, name, status, creator_id, owner_type, version)
		VALUES ($1, $2, 'B-1', '题库-电商', 'draft', $3, 'mine', 'V1.0')
	`, bankID, tenantID, userID)
	snapExec(t, pool, `
		INSERT INTO questions (id, tenant_id, bank_id, code, type, content, answer, status)
		VALUES ($1, $2, $3, 'Q-1', 'single', '已发布题', '["A"]', 'published')
	`, uuid.NewString(), tenantID, bankID)
	snapExec(t, pool, `
		INSERT INTO questions (id, tenant_id, bank_id, code, type, content, answer, status)
		VALUES ($1, $2, $3, 'Q-2', 'single', '草稿题', '["B"]', 'draft')
	`, uuid.NewString(), tenantID, bankID)

	built, err = st.BuildQuestionBankSnapshot(ctx, tenantID, bankID)
	if err != nil {
		t.Fatalf("BuildQuestionBankSnapshot: %v", err)
	}
	doc = jsonDoc(t, built)
	qs := jsonArr(t, doc["questions"])
	if len(qs) != 1 || qs[0]["content"] != "已发布题" {
		t.Fatalf("题库快照只应含已发布题目, got %v", qs)
	}
}

// 岗位快照：全树 + clone 缺失的 certification_rules 链。
func TestBuildPositionSnapshotChain(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID := grantTestTenant(t, pool)
	snapCleanup(t, pool, tenantID)
	userID := grantTestUser(t, pool, tenantID)
	st := NewSnapshotStore(pool)

	apID := uuid.NewString()
	snapExec(t, pool, `INSERT INTO ability_points (id, tenant_id, name) VALUES ($1, $2, '能力点-分析')`, apID, tenantID)

	posID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO career_positions (id, tenant_id, code, name, position_type, version, status, created_by)
		VALUES ($1, $2, 'P-9', '数据分析师', 'fulltime', 'V1.0', 'draft', $3)
	`, posID, tenantID, userID)
	respID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO position_responsibilities (id, tenant_id, career_position_id, name, sort_order)
		VALUES ($1, $2, $3, '职责-报表', 1)
	`, respID, tenantID, posID)
	snapExec(t, pool, `
		INSERT INTO position_ability_bindings (id, tenant_id, career_position_id, responsibility_id, ability_point_id, required_level, weight)
		VALUES ($1, $2, $3, $4, $5, 'L3', 50)
	`, uuid.NewString(), tenantID, posID, respID, apID)
	snapExec(t, pool, `
		INSERT INTO ability_domains (id, tenant_id, career_position_id, name, sort_order)
		VALUES ($1, $2, $3, '领域-数据', 1)
	`, uuid.NewString(), tenantID, posID)
	certLibID := uuid.NewString()
	snapExec(t, pool, `INSERT INTO certificate_library (id, tenant_id, name) VALUES ($1, $2, '证书-数据分析师')`, certLibID, tenantID)
	snapExec(t, pool, `
		INSERT INTO position_certificates (id, tenant_id, career_position_id, certificate_library_id)
		VALUES ($1, $2, $3, $4)
	`, uuid.NewString(), tenantID, posID, certLibID)

	// certification_rules 链（clone 不覆盖，快照必须包含）
	ruleID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO certification_rules (id, tenant_id, career_position_id, status, level_mapping)
		VALUES ($1, $2, $3, 'active', '[{"level":"L3","min":80}]'::jsonb)
	`, ruleID, tenantID, posID)
	snapExec(t, pool, `
		INSERT INTO certification_weights (id, tenant_id, rule_id, ability_point_id, weight)
		VALUES ($1, $2, $3, $4, 60)
	`, uuid.NewString(), tenantID, ruleID, apID)
	itemID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO certification_ability_items (id, tenant_id, rule_id, name, sort_order)
		VALUES ($1, $2, $3, '认定项-分析', 1)
	`, itemID, tenantID, ruleID)
	snapExec(t, pool, `
		INSERT INTO certification_ability_points (id, tenant_id, item_id, ability_point_id, required_level, weight)
		VALUES ($1, $2, $3, $4, 'L3', 100)
	`, uuid.NewString(), tenantID, itemID, apID)

	built, err := st.BuildPositionSnapshot(ctx, tenantID, posID)
	if err != nil {
		t.Fatalf("BuildPositionSnapshot: %v", err)
	}
	doc := jsonDoc(t, built)

	var pos map[string]any
	if err := json.Unmarshal(doc["position"], &pos); err != nil {
		t.Fatalf("position 解析: %v", err)
	}
	if pos["name"] != "数据分析师" {
		t.Fatalf("position.name = %v", pos["name"])
	}
	for _, key := range []string{
		"career_position_majors", "position_responsibilities", "position_ability_bindings",
		"ability_domains", "position_certificates",
		"certification_rules", "certification_weights",
		"certification_ability_items", "certification_ability_points", "ability_points",
	} {
		if _, ok := doc[key]; !ok {
			t.Fatalf("岗位快照缺 key %s", key)
		}
	}
	if len(jsonArr(t, doc["position_responsibilities"])) != 1 ||
		len(jsonArr(t, doc["position_ability_bindings"])) != 1 ||
		len(jsonArr(t, doc["ability_domains"])) != 1 ||
		len(jsonArr(t, doc["position_certificates"])) != 1 {
		t.Fatal("岗位 clone 覆盖链子表行数不符")
	}
	if len(jsonArr(t, doc["certification_rules"])) != 1 ||
		len(jsonArr(t, doc["certification_weights"])) != 1 ||
		len(jsonArr(t, doc["certification_ability_items"])) != 1 ||
		len(jsonArr(t, doc["certification_ability_points"])) != 1 {
		t.Fatal("certification_rules 链快照缺失（clone 缺失链必须补齐）")
	}
	aps := jsonArr(t, doc["ability_points"])
	if len(aps) != 1 || aps[0]["name"] != "能力点-分析" {
		t.Fatalf("连带 ability_points = %v", aps)
	}

	if err := st.SaveSnapshot(ctx, tenantID, SnapshotResourcePosition, posID, "V1.0", built); err != nil {
		t.Fatalf("SaveSnapshot: %v", err)
	}
	got, err := st.GetSnapshot(ctx, tenantID, SnapshotResourcePosition, posID, "V1.0")
	if err != nil {
		t.Fatalf("GetSnapshot: %v", err)
	}
	assertJSONEqual(t, built, got)
}

// ---------- Transition 发布挂载点 ----------

// 发布五类资源（scenarios）→ 同事务落快照，版本 = bump 后的 V1.1；
// teaching_plans 发布不生成快照（文档 8.15 白名单过滤）。
func TestTransitionPublishSavesSnapshot(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID := grantTestTenant(t, pool)
	snapCleanup(t, pool, tenantID)
	userID := grantTestUser(t, pool, tenantID)
	st := New(pool)

	scenarioID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO scenarios (id, tenant_id, name, code, version, status, creator_id)
		VALUES ($1, $2, '场景-发布挂载', 'SC-9', 'V1.0', 'approved', $3)
	`, scenarioID, tenantID, userID)
	snapExec(t, pool, `
		INSERT INTO scenario_tasks (id, scenario_id, tenant_id, name, code, task_type)
		VALUES ($1, $2, $3, '任务-1', 'T-1', 'practice')
	`, uuid.NewString(), scenarioID, tenantID)

	if err := st.ContentActions().Transition(ctx, "scenarios", scenarioID, domain.StatusPublished, "", nil); err != nil {
		t.Fatalf("Transition publish: %v", err)
	}

	// 版本 bump 到 V1.1
	var version string
	if err := pool.QueryRow(ctx, `SELECT version FROM scenarios WHERE id = $1`, scenarioID).Scan(&version); err != nil {
		t.Fatalf("读版本: %v", err)
	}
	if version != "V1.1" {
		t.Fatalf("发布后版本 = %q, want V1.1", version)
	}
	// 快照随发布落库，版本 = bump 后新版本
	snap, err := st.Snapshots().GetSnapshot(ctx, tenantID, SnapshotResourceScenario, scenarioID, "V1.1")
	if err != nil {
		t.Fatalf("发布后应存在 V1.1 快照: %v", err)
	}
	doc := jsonDoc(t, snap)
	var scenario map[string]any
	if err := json.Unmarshal(doc["scenario"], &scenario); err != nil {
		t.Fatalf("scenario 解析: %v", err)
	}
	if scenario["name"] != "场景-发布挂载" {
		t.Fatalf("快照 scenario.name = %v", scenario["name"])
	}
	if len(jsonArr(t, doc["scenario_tasks"])) != 1 {
		t.Fatal("快照应含任务")
	}
	latest, _ := st.Snapshots().LatestVersion(ctx, tenantID, SnapshotResourceScenario, scenarioID)
	if latest != "V1.1" {
		t.Fatalf("LatestVersion = %q, want V1.1", latest)
	}

	// teaching_plans 发布不生成快照
	termID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO terms (id, tenant_id, name, start_date, end_date) VALUES ($1, $2, '2026-1', '2026-03-01', '2026-07-01')
	`, termID, tenantID)
	programID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO training_programs (id, tenant_id, name, entry_year) VALUES ($1, $2, '人培-电商', 2026)
	`, programID, tenantID)
	planID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO teaching_plans (id, tenant_id, program_id, term_id, entry_year, status)
		VALUES ($1, $2, $3, $4, 2026, 'approved')
	`, planID, tenantID, programID, termID)
	if err := st.ContentActions().Transition(ctx, "teaching_plans", planID, domain.StatusPublished, "", nil); err != nil {
		t.Fatalf("teaching_plans Transition publish: %v", err)
	}
	var cnt int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM resource_snapshots WHERE resource_id = $1`, planID).Scan(&cnt); err != nil {
		t.Fatalf("count: %v", err)
	}
	if cnt != 0 {
		t.Fatalf("teaching_plans 不应生成快照, got %d 行", cnt)
	}
}
