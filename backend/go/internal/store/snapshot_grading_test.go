package store

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
)

// 阶段 2b 测试（文档 5.4/5.5/5.6）：判分快照化、反向回写链、删除保护、联盟合并 bump+快照。

// ---------- 判分快照化（文档 5.4/13.A5）----------

// 判分数据按 usage 固化的 exam_version 快照读取：试卷再版后旧版本仍读旧题/旧总分；
// 快照内 total_score 缺省回退题目分值求和；快照缺档回退 live（历史数据兼容）。
func TestFetchExamGradingData_SnapshotAndFallback(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID, _ := stampingTenant(t, pool)
	snap := NewSnapshotStore(pool)
	st := NewExamResultStore(pool)

	examID := stampingExam(t, pool, tenantID, "V1.0")
	snapExec(t, pool, `UPDATE exams SET total_score = 100 WHERE id = $1`, examID)
	q1 := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO exam_questions (id, tenant_id, exam_id, type, content, answer, score, sort_order)
		VALUES ($1, $2, $3, 'single', '题干-1', '["A"]', 50, 1)
	`, q1, tenantID, examID)
	snapExec(t, pool, `
		INSERT INTO exam_questions (id, tenant_id, exam_id, type, content, answer, score, sort_order)
		VALUES ($1, $2, $3, 'single', '题干-2', '["B"]', 50, 2)
	`, uuid.NewString(), tenantID, examID)
	built, err := snap.BuildExamSnapshot(ctx, tenantID, examID)
	if err != nil {
		t.Fatalf("BuildExamSnapshot V1.0: %v", err)
	}
	if err := snap.SaveSnapshot(ctx, tenantID, SnapshotResourceExam, examID, "V1.0", built); err != nil {
		t.Fatalf("SaveSnapshot V1.0: %v", err)
	}

	// 试卷再版 V1.1：答案/分值/总分全改
	snapExec(t, pool, `UPDATE exams SET version = 'V1.1', total_score = 200 WHERE id = $1`, examID)
	snapExec(t, pool, `UPDATE exam_questions SET answer = '["C"]', score = 100 WHERE id = $1`, q1)
	snapExec(t, pool, `UPDATE exam_questions SET score = 100 WHERE exam_id = $1 AND id <> $2`, examID, q1)
	built, err = snap.BuildExamSnapshot(ctx, tenantID, examID)
	if err != nil {
		t.Fatalf("BuildExamSnapshot V1.1: %v", err)
	}
	if err := snap.SaveSnapshot(ctx, tenantID, SnapshotResourceExam, examID, "V1.1", built); err != nil {
		t.Fatalf("SaveSnapshot V1.1: %v", err)
	}

	// usage 固化 V1.0：UsageExamRef 返回绑定试卷与版本
	usageID := stampingUsage(t, pool, tenantID, examID, "class", []string{uuid.NewString()}, "V1.0")
	gotExamID, gotVersion, err := st.UsageExamRef(ctx, usageID)
	if err != nil {
		t.Fatalf("UsageExamRef: %v", err)
	}
	if gotExamID != examID || gotVersion != "V1.0" {
		t.Fatalf("UsageExamRef = (%s, %q), want (%s, V1.0)", gotExamID, gotVersion, examID)
	}

	findQ := func(qs []ExamQuestionAnswer, id string) ExamQuestionAnswer {
		t.Helper()
		for _, q := range qs {
			if q.ID == id {
				return q
			}
		}
		t.Fatalf("题目 %s 不在判分数据中", id)
		return ExamQuestionAnswer{}
	}

	// 旧版本 V1.0：读旧题（答案 A、分值 50）与旧总分 100
	qs, total, err := st.FetchExamGradingData(ctx, tenantID, examID, "V1.0")
	if err != nil {
		t.Fatalf("FetchExamGradingData V1.0: %v", err)
	}
	if len(qs) != 2 {
		t.Fatalf("V1.0 题数 = %d, want 2", len(qs))
	}
	q := findQ(qs, q1)
	if len(q.Answer) != 1 || q.Answer[0] != "A" || q.Score != 50 {
		t.Fatalf("V1.0 q1 = %+v, want 答案[A]/50 分", q)
	}
	if total != 100 {
		t.Fatalf("V1.0 总分 = %v, want 100（快照 total_score）", total)
	}

	// 新版本 V1.1：读新题新总分
	qs, total, err = st.FetchExamGradingData(ctx, tenantID, examID, "V1.1")
	if err != nil {
		t.Fatalf("FetchExamGradingData V1.1: %v", err)
	}
	q = findQ(qs, q1)
	if len(q.Answer) != 1 || q.Answer[0] != "C" || q.Score != 100 {
		t.Fatalf("V1.1 q1 = %+v, want 答案[C]/100 分", q)
	}
	if total != 200 {
		t.Fatalf("V1.1 总分 = %v, want 200", total)
	}

	// 快照内 total_score 缺省（0）→ 回退快照题目分值求和（13.A5）
	snapExec(t, pool, `UPDATE exams SET version = 'V1.2', total_score = 0 WHERE id = $1`, examID)
	built, err = snap.BuildExamSnapshot(ctx, tenantID, examID)
	if err != nil {
		t.Fatalf("BuildExamSnapshot V1.2: %v", err)
	}
	if err := snap.SaveSnapshot(ctx, tenantID, SnapshotResourceExam, examID, "V1.2", built); err != nil {
		t.Fatalf("SaveSnapshot V1.2: %v", err)
	}
	_, total, err = st.FetchExamGradingData(ctx, tenantID, examID, "V1.2")
	if err != nil {
		t.Fatalf("FetchExamGradingData V1.2: %v", err)
	}
	if total != 200 {
		t.Fatalf("V1.2 总分 = %v, want 200（快照题目分值求和）", total)
	}

	// 快照缺档（V9.9 不存在）→ 回退 live 题目与总分
	qs, total, err = st.FetchExamGradingData(ctx, tenantID, examID, "V9.9")
	if err != nil {
		t.Fatalf("FetchExamGradingData 缺档: %v", err)
	}
	q = findQ(qs, q1)
	if len(q.Answer) != 1 || q.Answer[0] != "C" {
		t.Fatalf("缺档回退 live q1 答案 = %v, want [C]", q.Answer)
	}
	if total != 200 {
		t.Fatalf("缺档回退 live 总分 = %v, want 200", total)
	}
}

// ---------- 反向回写链（文档 13.A8）----------

// 场景改版后 live resource_config 已指向新试卷：按成绩行盖章版本的快照定位旧考试结果；
// 成绩行未盖章/快照缺档回退 live JOIN。
func TestFindExamResultForGrading_SnapshotLookup(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID, userID := stampingTenant(t, pool)
	user2 := grantTestUser(t, pool, tenantID)
	user3 := grantTestUser(t, pool, tenantID)
	scenarioID, taskID := stampingScenario(t, pool, tenantID, userID, "V1.0")
	exam1 := stampingExam(t, pool, tenantID, "V1.0")
	exam2 := stampingExam(t, pool, tenantID, "V1.1")
	snap := NewSnapshotStore(pool)
	st := NewEvaluationResultStore(pool)

	usage1 := stampingUsage(t, pool, tenantID, exam1, "task", []string{taskID}, "V1.0")
	snapExec(t, pool, `
		INSERT INTO task_evaluation_methods (id, tenant_id, task_id, method_key, weight, resource_config)
		VALUES ($1, $2, $3, 'paper', 100, $4)
	`, uuid.NewString(), tenantID, taskID, `{"usageId":"`+usage1+`","paperId":"`+exam1+`"}`)
	built, err := snap.BuildScenarioSnapshot(ctx, tenantID, scenarioID)
	if err != nil {
		t.Fatalf("BuildScenarioSnapshot: %v", err)
	}
	if err := snap.SaveSnapshot(ctx, tenantID, SnapshotResourceScenario, scenarioID, "V1.0", built); err != nil {
		t.Fatalf("SaveSnapshot V1.0: %v", err)
	}

	// 场景改版：live 方法配置改指新试卷/新安排（旧版本快照仍记旧配置）
	usage2 := stampingUsage(t, pool, tenantID, exam2, "task", []string{taskID}, "V1.1")
	snapExec(t, pool, `
		UPDATE task_evaluation_methods SET resource_config = $2 WHERE task_id = $1 AND method_key = 'paper'
	`, taskID, `{"usageId":"`+usage2+`","paperId":"`+exam2+`"}`)

	insertExamResult := func(usageID, userID, version string) string {
		t.Helper()
		id := uuid.NewString()
		snapExec(t, pool, `
			INSERT INTO exam_results (id, tenant_id, exam_usage_id, user_id, score, total_score, version)
			VALUES ($1, $2, $3, $4, 80, 100, $5)
		`, id, tenantID, usageID, userID, version)
		return id
	}
	insertSceneResult := func(userID string, version *string) string {
		t.Helper()
		id := uuid.NewString()
		snapExec(t, pool, `
			INSERT INTO scene_evaluation_results (id, tenant_id, task_id, scene_id, method_key, evaluatee_id, status, version)
			VALUES ($1, $2, $3, $4, 'paper', $5, 'pending', $6)
		`, id, tenantID, taskID, scenarioID, userID, version)
		return id
	}

	// 盖章 V1.0 的成绩行 → 定位旧安排 er1（live JOIN 会错配 er2）
	er1 := insertExamResult(usage1, userID, "V1.0")
	_ = insertExamResult(usage2, userID, "V1.1") // er2：干扰项，live 配置指向它
	v10 := "V1.0"
	srID := insertSceneResult(userID, &v10)
	got, err := st.FindExamResultForGrading(ctx, pool, srID, taskID, "paper", userID)
	if err != nil {
		t.Fatalf("FindExamResultForGrading: %v", err)
	}
	if got != er1 {
		t.Fatalf("版本化定位 = %s, want %s（旧版本安排的考试结果）", got, er1)
	}

	// 成绩行未盖章（历史数据）→ 回退 live JOIN → 最新 er2
	er2b := insertExamResult(usage2, user2, "V1.1")
	srNoVersion := insertSceneResult(user2, nil)
	got, err = st.FindExamResultForGrading(ctx, pool, srNoVersion, taskID, "paper", user2)
	if err != nil {
		t.Fatalf("FindExamResultForGrading 未盖章: %v", err)
	}
	if got != er2b {
		t.Fatalf("未盖章回退 live = %s, want %s", got, er2b)
	}

	// 盖章版本快照缺档（V9.9）→ 回退 live JOIN
	er2c := insertExamResult(usage2, user3, "V1.1")
	v99 := "V9.9"
	srMissing := insertSceneResult(user3, &v99)
	got, err = st.FindExamResultForGrading(ctx, pool, srMissing, taskID, "paper", user3)
	if err != nil {
		t.Fatalf("FindExamResultForGrading 快照缺档: %v", err)
	}
	if got != er2c {
		t.Fatalf("快照缺档回退 live = %s, want %s", got, er2c)
	}
}

// ---------- 删题保留 exam_questions（migration 158 FK SET NULL 集成验证）----------

func TestDeleteQuestionPreservesExamQuestions(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID, userID := stampingTenant(t, pool)

	bankID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO question_banks (id, tenant_id, name, code, status, creator_id, owner_type)
		VALUES ($1, $2, '题库-删题', $3, 'published', $4, 'mine')
	`, bankID, tenantID, "B-"+uuid.NewString()[:8], userID)
	questionID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO questions (id, tenant_id, bank_id, type, content, answer, code, score, status)
		VALUES ($1, $2, $3, 'single', '题-删', '["A"]', $4, 5, 'published')
	`, questionID, tenantID, bankID, "Q-"+uuid.NewString()[:8])
	examID := stampingExam(t, pool, tenantID, "V1.0")
	eqID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO exam_questions (id, tenant_id, exam_id, question_id, type, content, answer, score, sort_order)
		VALUES ($1, $2, $3, $4, 'single', '题干-保留', '["A"]', 5, 1)
	`, eqID, tenantID, examID, questionID)

	snapExec(t, pool, `DELETE FROM questions WHERE id = $1`, questionID)

	var cnt int
	var qid *string
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) OVER (), question_id FROM exam_questions WHERE id = $1`, eqID).Scan(&cnt, &qid); err != nil {
		t.Fatalf("查询 exam_questions: %v", err)
	}
	if cnt != 1 {
		t.Fatalf("删题后 exam_questions 行数 = %d, want 1（内容行保留）", cnt)
	}
	if qid != nil {
		t.Fatalf("question_id = %v, want NULL（FK SET NULL）", *qid)
	}
}

// ---------- 删除保护（文档 5.5 决策 6）----------

func TestDeleteProtection(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	st := New(pool)

	insertExamResult := func(tenantID, usageID, userID string) {
		t.Helper()
		snapExec(t, pool, `
			INSERT INTO exam_results (id, tenant_id, exam_usage_id, user_id, score, total_score)
			VALUES ($1, $2, $3, $4, 80, 100)
		`, uuid.NewString(), tenantID, usageID, userID)
	}
	insertSceneResult := func(tenantID, taskID string, sceneID *string, userID string) {
		t.Helper()
		snapExec(t, pool, `
			INSERT INTO scene_evaluation_results (id, tenant_id, task_id, scene_id, method_key, evaluatee_id, status)
			VALUES ($1, $2, $3, $4, 'paper', $5, 'pending')
		`, uuid.NewString(), tenantID, taskID, sceneID, userID)
	}

	t.Run("exams", func(t *testing.T) {
		tenantID, userID := stampingTenant(t, pool)
		examID := stampingExam(t, pool, tenantID, "V1.0")
		usageID := stampingUsage(t, pool, tenantID, examID, "class", []string{uuid.NewString()}, "V1.0")
		insertExamResult(tenantID, usageID, userID)
		if err := st.Exams().Delete(ctx, pool, tenantID, examID); !errors.Is(err, ErrResourceInUse) {
			t.Fatalf("有成绩删卷 err = %v, want ErrResourceInUse", err)
		}
		// 无成绩（安排无结果）→ 允许删除
		exam2 := stampingExam(t, pool, tenantID, "V1.0")
		_ = stampingUsage(t, pool, tenantID, exam2, "class", []string{uuid.NewString()}, "V1.0")
		if err := st.Exams().Delete(ctx, pool, tenantID, exam2); err != nil {
			t.Fatalf("无成绩删卷 err = %v", err)
		}
	})

	t.Run("exam_usages", func(t *testing.T) {
		tenantID, userID := stampingTenant(t, pool)
		examID := stampingExam(t, pool, tenantID, "V1.0")
		usageID := stampingUsage(t, pool, tenantID, examID, "class", []string{uuid.NewString()}, "V1.0")
		insertExamResult(tenantID, usageID, userID)
		if err := st.ExamUsages().Delete(ctx, tenantID, usageID); !errors.Is(err, ErrResourceInUse) {
			t.Fatalf("有成绩删安排 err = %v, want ErrResourceInUse", err)
		}
		// 无成绩 → 允许删除；tenant_id 条件生效（错租户删不到）
		usage2 := stampingUsage(t, pool, tenantID, examID, "class", []string{uuid.NewString()}, "V1.0")
		if err := st.ExamUsages().Delete(ctx, uuid.NewString(), usage2); err != nil {
			t.Fatalf("错租户删安排 err = %v", err)
		}
		if v := stampingStr(t, pool, `SELECT id::text FROM exam_usages WHERE id = $1`, usage2); v == "" {
			t.Fatal("错租户删除应不影响安排行（tenant_id 条件）")
		}
		if err := st.ExamUsages().Delete(ctx, tenantID, usage2); err != nil {
			t.Fatalf("无成绩删安排 err = %v", err)
		}
	})

	t.Run("scenarios", func(t *testing.T) {
		tenantID, userID := stampingTenant(t, pool)
		scenarioID, taskID := stampingScenario(t, pool, tenantID, userID, "V1.0")
		insertSceneResult(tenantID, taskID, &scenarioID, userID)
		if err := st.Scenarios().Delete(ctx, scenarioID); !errors.Is(err, ErrResourceInUse) {
			t.Fatalf("有成绩（task_id 路径）删场景 err = %v, want ErrResourceInUse", err)
		}
		// scene_id 路径：成绩挂他场景任务但 scene_id 指向本场景
		scA, _ := stampingScenario(t, pool, tenantID, userID, "V1.0")
		_, taskB := stampingScenario(t, pool, tenantID, userID, "V1.0")
		insertSceneResult(tenantID, taskB, &scA, userID)
		if err := st.Scenarios().Delete(ctx, scA); !errors.Is(err, ErrResourceInUse) {
			t.Fatalf("有成绩（scene_id 路径）删场景 err = %v, want ErrResourceInUse", err)
		}
		// 无成绩 → 允许删除
		scClean, _ := stampingScenario(t, pool, tenantID, userID, "V1.0")
		if err := st.Scenarios().Delete(ctx, scClean); err != nil {
			t.Fatalf("无成绩删场景 err = %v", err)
		}
	})

	t.Run("scenario_tasks", func(t *testing.T) {
		tenantID, userID := stampingTenant(t, pool)
		_, taskID := stampingScenario(t, pool, tenantID, userID, "V1.0")
		insertSceneResult(tenantID, taskID, nil, userID)
		if err := st.ScenarioTasks().Delete(ctx, taskID, tenantID); !errors.Is(err, ErrResourceInUse) {
			t.Fatalf("有成绩删任务 err = %v, want ErrResourceInUse", err)
		}
		_, taskClean := stampingScenario(t, pool, tenantID, userID, "V1.0")
		if err := st.ScenarioTasks().Delete(ctx, taskClean, tenantID); err != nil {
			t.Fatalf("无成绩删任务 err = %v", err)
		}
	})

	t.Run("system_course_nodes", func(t *testing.T) {
		tenantID, userID := stampingTenant(t, pool)
		_, nodeID := stampingCourse(t, pool, tenantID, userID, "V1.0")
		snapExec(t, pool, `
			INSERT INTO node_evaluation_results (tenant_id, node_id, method_key, evaluatee_id, status)
			VALUES ($1, $2, 'paper', $3, 'pending')
		`, tenantID, nodeID, userID)
		if err := st.CourseNodes().Delete(ctx, nodeID, tenantID); !errors.Is(err, ErrResourceInUse) {
			t.Fatalf("有成绩删节点 err = %v, want ErrResourceInUse", err)
		}
		_, nodeClean := stampingCourse(t, pool, tenantID, userID, "V1.0")
		if err := st.CourseNodes().Delete(ctx, nodeClean, tenantID); err != nil {
			t.Fatalf("无成绩删节点 err = %v", err)
		}
	})

	t.Run("courses", func(t *testing.T) {
		tenantID, userID := stampingTenant(t, pool)
		courseID, _ := stampingCourse(t, pool, tenantID, userID, "V1.0")
		snapExec(t, pool, `
			INSERT INTO course_evaluation_results (tenant_id, course_id, method_key, evaluatee_id, status)
			VALUES ($1, $2, 'paper', $3, 'pending')
		`, tenantID, courseID, userID)
		if err := st.Courses().Delete(ctx, courseID, tenantID); !errors.Is(err, ErrResourceInUse) {
			t.Fatalf("有课程成绩删课 err = %v, want ErrResourceInUse", err)
		}
		// 节点成绩路径
		course2, node2 := stampingCourse(t, pool, tenantID, userID, "V1.0")
		snapExec(t, pool, `
			INSERT INTO node_evaluation_results (tenant_id, node_id, method_key, evaluatee_id, status)
			VALUES ($1, $2, 'paper', $3, 'pending')
		`, tenantID, node2, userID)
		if err := st.Courses().Delete(ctx, course2, tenantID); !errors.Is(err, ErrResourceInUse) {
			t.Fatalf("有节点成绩删课 err = %v, want ErrResourceInUse", err)
		}
		courseClean, _ := stampingCourse(t, pool, tenantID, userID, "V1.0")
		if err := st.Courses().Delete(ctx, courseClean, tenantID); err != nil {
			t.Fatalf("无成绩删课 err = %v", err)
		}
	})

	t.Run("career_positions", func(t *testing.T) {
		tenantID, userID := stampingTenant(t, pool)
		newPosition := func() string {
			t.Helper()
			id := uuid.NewString()
			snapExec(t, pool, `
				INSERT INTO career_positions (id, tenant_id, code, name, position_type, version, status, created_by)
				VALUES ($1, $2, $3, $4, 'fulltime', 'V1.0', 'published', $5)
			`, id, tenantID, "P-"+uuid.NewString()[:8], "岗位-保护-"+uuid.NewString()[:8], userID)
			return id
		}
		pos1 := newPosition()
		snapExec(t, pool, `INSERT INTO job_ability_results (career_position_id, user_id) VALUES ($1, $2)`, pos1, userID)
		if err := st.Positions().Delete(ctx, pos1); !errors.Is(err, ErrResourceInUse) {
			t.Fatalf("有能力成绩删岗 err = %v, want ErrResourceInUse", err)
		}
		pos2 := newPosition()
		snapExec(t, pool, `INSERT INTO student_ability_portraits (user_id, career_position_id) VALUES ($1, $2)`, userID, pos2)
		if err := st.Positions().Delete(ctx, pos2); !errors.Is(err, ErrResourceInUse) {
			t.Fatalf("有学生画像删岗 err = %v, want ErrResourceInUse", err)
		}
		pos3 := newPosition()
		scID, _ := stampingScenario(t, pool, tenantID, userID, "V1.0")
		snapExec(t, pool, `UPDATE scenarios SET career_position_id = $1 WHERE id = $2`, pos3, scID)
		if err := st.Positions().Delete(ctx, pos3); !errors.Is(err, ErrResourceInUse) {
			t.Fatalf("被已发布场景引用删岗 err = %v, want ErrResourceInUse", err)
		}
		posClean := newPosition()
		if err := st.Positions().Delete(ctx, posClean); err != nil {
			t.Fatalf("无关联删岗 err = %v", err)
		}
	})
}

// ---------- temp exam 清理路径（文档 5.5 核查：exam_results 对 exam_usages 为 FK CASCADE）----------

// CleanupTaskExamUsages：有成绩的安排保留（防 CASCADE 毁成绩），无成绩的安排及其独占 temp exam 清理。
func TestCleanupTaskExamUsages_RetainsUsagesWithResults(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID, userID := stampingTenant(t, pool)
	_, taskID := stampingScenario(t, pool, tenantID, userID, "V1.0")

	tempExam := func() string {
		t.Helper()
		id := uuid.NewString()
		snapExec(t, pool, `
			INSERT INTO exams (id, tenant_id, code, name, status, duration, version, is_temp)
			VALUES ($1, $2, $3, $4, 'published', 60, 'V1.0', TRUE)
		`, id, tenantID, "T-"+uuid.NewString()[:8], "临时卷-"+uuid.NewString()[:8])
		return id
	}
	exam1 := tempExam()
	usage1 := stampingUsage(t, pool, tenantID, exam1, "task", []string{taskID}, "V1.0")
	snapExec(t, pool, `
		INSERT INTO exam_results (id, tenant_id, exam_usage_id, user_id, score, total_score)
		VALUES ($1, $2, $3, $4, 80, 100)
	`, uuid.NewString(), tenantID, usage1, userID)
	exam2 := tempExam()
	usage2 := stampingUsage(t, pool, tenantID, exam2, "task", []string{taskID}, "V1.0")

	if err := CleanupTaskExamUsages(ctx, pool, taskID); err != nil {
		t.Fatalf("CleanupTaskExamUsages: %v", err)
	}
	if v := stampingStr(t, pool, `SELECT id::text FROM exam_usages WHERE id = $1`, usage1); v == "" {
		t.Fatal("有成绩的安排应保留（防 CASCADE 毁成绩）")
	}
	if v := stampingStr(t, pool, `SELECT id::text FROM exam_results WHERE exam_usage_id = $1`, usage1); v == "" {
		t.Fatal("成绩记录应保留")
	}
	if v := stampingStr(t, pool, `SELECT id::text FROM exams WHERE id = $1`, exam1); v == "" {
		t.Fatal("被保留安排引用的 temp exam 应保留")
	}
	if v := stampingStr(t, pool, `SELECT COALESCE((SELECT id::text FROM exam_usages WHERE id = $1), '')`, usage2); v != "" {
		t.Fatal("无成绩的安排应被清理")
	}
	if v := stampingStr(t, pool, `SELECT COALESCE((SELECT id::text FROM exams WHERE id = $1), '')`, exam2); v != "" {
		t.Fatal("无引用的 temp exam 应被清理")
	}
}

// ---------- 联盟/审批合并 bump+快照（文档 13.A4/5.5）----------

// 合并覆盖事务内补版本 bump + 写快照（岗位/场景），draft 删除。
func TestAllianceMerge_BumpVersionAndSnapshot(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	tenantID, userID := stampingTenant(t, pool)
	st := New(pool)
	snap := NewSnapshotStore(pool)

	// 岗位合并
	posID := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO career_positions (id, tenant_id, code, name, position_type, version, status, created_by)
		VALUES ($1, $2, 'P-M', '岗位-原名', 'fulltime', 'V1.0', 'published', $3)
	`, posID, tenantID, userID)
	posDraft := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO career_positions (id, tenant_id, code, name, position_type, version, status, created_by, source_resource_id)
		VALUES ($1, $2, 'P-D', '岗位-新名（编辑稿）', 'fulltime', 'V1.0', 'draft', $3, $4)
	`, posDraft, tenantID, userID, posID)

	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	if err := st.Positions().MergePositionDraftToSource(ctx, tx, posDraft, tenantID); err != nil {
		tx.Rollback(ctx)
		t.Fatalf("MergePositionDraftToSource: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit: %v", err)
	}

	if v := stampingStr(t, pool, `SELECT version FROM career_positions WHERE id = $1`, posID); v != "V1.1" {
		t.Fatalf("合并后岗位版本 = %q, want V1.1（补 bump）", v)
	}
	if v := stampingStr(t, pool, `SELECT name FROM career_positions WHERE id = $1`, posID); v != "岗位-新名" {
		t.Fatalf("合并后岗位名 = %q, want 岗位-新名", v)
	}
	posSnap, err := snap.GetSnapshot(ctx, tenantID, SnapshotResourcePosition, posID, "V1.1")
	if err != nil {
		t.Fatalf("合并后应存在 V1.1 岗位快照: %v", err)
	}
	posDoc := jsonDoc(t, posSnap)
	var posObj map[string]any
	if err := json.Unmarshal(posDoc["position"], &posObj); err != nil {
		t.Fatalf("岗位快照解析: %v", err)
	}
	if posObj["name"] != "岗位-新名" {
		t.Fatalf("快照 position.name = %v, want 岗位-新名", posObj["name"])
	}
	if v := stampingStr(t, pool, `SELECT COALESCE((SELECT id::text FROM career_positions WHERE id = $1), '')`, posDraft); v != "" {
		t.Fatal("draft 岗位应已删除")
	}

	// 场景合并
	scenarioID, _ := stampingScenario(t, pool, tenantID, userID, "V1.0")
	scDraft := uuid.NewString()
	snapExec(t, pool, `
		INSERT INTO scenarios (id, tenant_id, name, code, version, status, creator_id, source_resource_id)
		VALUES ($1, $2, '场景-新名（编辑稿）', $3, 'V1.0', 'draft', $4, $5)
	`, scDraft, tenantID, "SCD-"+uuid.NewString()[:8], userID, scenarioID)
	snapExec(t, pool, `
		INSERT INTO scenario_tasks (id, scenario_id, tenant_id, name, code, task_type)
		VALUES ($1, $2, $3, '任务-合并后', $4, 'practice')
	`, uuid.NewString(), scDraft, tenantID, "TD-"+uuid.NewString()[:8])

	tx, err = pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	if err := st.Scenarios().MergeScenarioDraftToSource(ctx, tx, scDraft, tenantID); err != nil {
		tx.Rollback(ctx)
		t.Fatalf("MergeScenarioDraftToSource: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit: %v", err)
	}

	if v := stampingStr(t, pool, `SELECT version FROM scenarios WHERE id = $1`, scenarioID); v != "V1.1" {
		t.Fatalf("合并后场景版本 = %q, want V1.1（补 bump）", v)
	}
	scSnap, err := snap.GetSnapshot(ctx, tenantID, SnapshotResourceScenario, scenarioID, "V1.1")
	if err != nil {
		t.Fatalf("合并后应存在 V1.1 场景快照: %v", err)
	}
	scDoc := jsonDoc(t, scSnap)
	tasks := jsonArr(t, scDoc["scenario_tasks"])
	if len(tasks) != 1 || tasks[0]["name"] != "任务-合并后" {
		t.Fatalf("快照 scenario_tasks = %v, want 合并后任务", tasks)
	}
	if v := stampingStr(t, pool, `SELECT COALESCE((SELECT id::text FROM scenarios WHERE id = $1), '')`, scDraft); v != "" {
		t.Fatal("draft 场景应已删除")
	}
}
