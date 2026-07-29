// Package service 提供跨 handler 复用的业务服务。
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"sort"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// JobAbilityAggregator 按认证规则汇聚学生场景任务评分为岗位能力结果。
type JobAbilityAggregator struct {
	DB *pgxpool.Pool
}

func NewJobAbilityAggregator(db *pgxpool.Pool) *JobAbilityAggregator {
	return &JobAbilityAggregator{DB: db}
}

type levelMapping struct {
	Level string  `json:"level"`
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
}

type aggPoint struct {
	id                 string
	itemID             string
	itemName           string
	abilityPointID     string
	name               string
	requiredLevel      string
	weight             float64
	customLevelMapping []levelMapping
	tasks              []aggTask
}

type aggTask struct {
	taskID string
	weight float64
}

type taskScore struct {
	score float64 // 归一化到 0-100
}

// AggregatePosition 汇聚单个岗位（创建并收尾自己的汇聚日志）。
func (a *JobAbilityAggregator) AggregatePosition(ctx context.Context, tenantID, careerPositionID string, userIDs []string) error {
	logID, err := a.CreateLog(ctx, tenantID, careerPositionID)
	if err != nil {
		return fmt.Errorf("create aggregate log: %w", err)
	}
	return a.RunAggregate(ctx, logID, tenantID, careerPositionID, userIDs)
}

// AggregateAllPublished 遍历所有 published 规则的 tenant+position 组合逐个汇聚。
func (a *JobAbilityAggregator) AggregateAllPublished(ctx context.Context) error {
	rows, err := a.DB.Query(ctx, `
		SELECT DISTINCT tenant_id, career_position_id FROM certification_rules
		WHERE status = 'published' AND tenant_id IS NOT NULL
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	type target struct {
		tenantID, positionID string
	}
	var targets []target
	for rows.Next() {
		var t target
		if err := rows.Scan(&t.tenantID, &t.positionID); err != nil {
			return err
		}
		targets = append(targets, t)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	var firstErr error
	for _, t := range targets {
		if err := a.AggregatePosition(ctx, t.tenantID, t.positionID, nil); err != nil {
			slog.Error("岗位能力汇聚失败", "tenantId", t.tenantID, "careerPositionId", t.positionID, "error", err)
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	return firstErr
}

// CreateLog 写入一条 running 状态的汇聚日志并返回 id。
func (a *JobAbilityAggregator) CreateLog(ctx context.Context, tenantID, careerPositionID string) (string, error) {
	var id string
	err := a.DB.QueryRow(ctx, `
		INSERT INTO job_ability_aggregate_logs (tenant_id, career_position_id, status)
		VALUES ($1, $2, 'running') RETURNING id
	`, tenantID, careerPositionID).Scan(&id)
	return id, err
}

// RunAggregate 执行汇聚并收尾指定日志记录（success/failed + 统计数）。
func (a *JobAbilityAggregator) RunAggregate(ctx context.Context, logID, tenantID, careerPositionID string, userIDs []string) error {
	studentCount, updatedCount, err := a.aggregate(ctx, tenantID, careerPositionID, userIDs)

	status := "success"
	var errMsg *string
	if err != nil {
		status = "failed"
		msg := err.Error()
		errMsg = &msg
		slog.Error("岗位能力汇聚失败", "tenantId", tenantID, "careerPositionId", careerPositionID, "error", err)
	}
	if _, uerr := a.DB.Exec(ctx, `
		UPDATE job_ability_aggregate_logs
		SET status = $1, student_count = $2, updated_count = $3, error_message = $4, finished_at = NOW()
		WHERE id = $5
	`, status, studentCount, updatedCount, errMsg, logID); uerr != nil {
		slog.Error("更新汇聚日志失败", "logId", logID, "error", uerr)
	}
	return err
}

// portraitDomainScore 画像能力域得分，字段名对齐前端 AbilityDomainScore 类型。
type portraitDomainScore struct {
	Domain      string  `json:"domain"`
	DomainLabel string  `json:"domainLabel"`
	Score       float64 `json:"score"`
	Level       string  `json:"level"`
}

// portraitRecommendPosition 画像推荐岗位，字段名对齐前端 recommendPositions 类型。
type portraitRecommendPosition struct {
	PositionID   string  `json:"positionId"`
	PositionName string  `json:"positionName"`
	MatchRate    float64 `json:"matchRate"`
	Grade        string  `json:"grade,omitempty"`
}

// aggregate 为单租户单岗位计算并 upsert 所有学生的岗位能力结果。
func (a *JobAbilityAggregator) aggregate(ctx context.Context, tenantID, careerPositionID string, userIDs []string) (int, int, error) {
	// 1. 加载 published 规则全量配置（items → points → tasks）
	var ruleID string
	err := a.DB.QueryRow(ctx, `
		SELECT id FROM certification_rules
		WHERE career_position_id = $1 AND tenant_id = $2 AND status = 'published'
		ORDER BY updated_at DESC LIMIT 1
	`, careerPositionID, tenantID).Scan(&ruleID)
	if err == pgx.ErrNoRows {
		return 0, 0, nil // 无规则直接返回
	}
	if err != nil {
		return 0, 0, err
	}

	pointRows, err := a.DB.Query(ctx, `
		SELECT p.id, i.id, COALESCE(i.name, ''), p.ability_point_id, COALESCE(ap.name, ''), p.required_level, p.weight, p.custom_level_mapping
		FROM certification_ability_points p
		JOIN certification_ability_items i ON i.id = p.item_id
		LEFT JOIN ability_points ap ON ap.id = p.ability_point_id
		WHERE i.rule_id = $1
		ORDER BY i.sort_order, p.id
	`, ruleID)
	if err != nil {
		return 0, 0, err
	}
	defer pointRows.Close()

	var points []aggPoint
	for pointRows.Next() {
		var p aggPoint
		var mappingJSON []byte
		if err := pointRows.Scan(&p.id, &p.itemID, &p.itemName, &p.abilityPointID, &p.name, &p.requiredLevel, &p.weight, &mappingJSON); err != nil {
			return 0, 0, err
		}
		if len(mappingJSON) > 0 {
			_ = json.Unmarshal(mappingJSON, &p.customLevelMapping)
		}
		points = append(points, p)
	}
	if err := pointRows.Err(); err != nil {
		return 0, 0, err
	}
	if len(points) == 0 {
		return 0, 0, nil
	}

	pointIDs := make([]string, len(points))
	pointIdx := make(map[string]int, len(points))
	for i, p := range points {
		pointIDs[i] = p.id
		pointIdx[p.id] = i
	}
	taskRows, err := a.DB.Query(ctx, `
		SELECT cert_point_id, task_id, weight FROM certification_related_tasks
		WHERE cert_point_id = ANY($1)
	`, pointIDs)
	if err != nil {
		return 0, 0, err
	}
	defer taskRows.Close()
	taskIDSet := map[string]bool{}
	for taskRows.Next() {
		var pointID string
		var t aggTask
		if err := taskRows.Scan(&pointID, &t.taskID, &t.weight); err != nil {
			return 0, 0, err
		}
		if i, ok := pointIdx[pointID]; ok {
			points[i].tasks = append(points[i].tasks, t)
			taskIDSet[t.taskID] = true
		}
	}
	if err := taskRows.Err(); err != nil {
		return 0, 0, err
	}

	taskIDs := make([]string, 0, len(taskIDSet))
	for id := range taskIDSet {
		taskIDs = append(taskIDs, id)
	}
	if len(taskIDs) == 0 {
		return 0, 0, nil
	}

	// 2. 候选学生（若指定 userIDs 则取交集）
	studentSet := map[string]bool{}
	if len(userIDs) > 0 {
		for _, id := range userIDs {
			studentSet[id] = true
		}
	} else {
		stRows, err := a.DB.Query(ctx, `
			SELECT DISTINCT evaluatee_id FROM scene_evaluation_results
			WHERE tenant_id = $1 AND task_id = ANY($2)
		`, tenantID, taskIDs)
		if err != nil {
			return 0, 0, err
		}
		defer stRows.Close()
		for stRows.Next() {
			var id string
			if err := stRows.Scan(&id); err != nil {
				return 0, 0, err
			}
			studentSet[id] = true
		}
		if err := stRows.Err(); err != nil {
			return 0, 0, err
		}
	}
	studentIDs := make([]string, 0, len(studentSet))
	for id := range studentSet {
		studentIDs = append(studentIDs, id)
	}
	if len(studentIDs) == 0 {
		return 0, 0, nil
	}

	// 每学生每任务的归一化得分（同一任务多方法评分取最高）
	type studentTaskKey struct {
		studentID, taskID string
	}
	scores := map[studentTaskKey]taskScore{}
	scoreRows, err := a.DB.Query(ctx, `
		SELECT evaluatee_id, task_id, MAX(total_score / NULLIF(max_score, 0) * 100)
		FROM scene_evaluation_results
		WHERE tenant_id = $1 AND task_id = ANY($2) AND evaluatee_id = ANY($3) AND total_score IS NOT NULL
		GROUP BY evaluatee_id, task_id
	`, tenantID, taskIDs, studentIDs)
	if err != nil {
		return 0, 0, err
	}
	defer scoreRows.Close()
	for scoreRows.Next() {
		var k studentTaskKey
		var s float64
		if err := scoreRows.Scan(&k.studentID, &k.taskID, &s); err != nil {
			return 0, 0, err
		}
		scores[k] = taskScore{score: s}
	}
	if err := scoreRows.Err(); err != nil {
		return 0, 0, err
	}

	// 学生班级/专业信息
	type userProfile struct {
		className string
		majorID   *string
		majorName string
	}
	profiles := map[string]userProfile{}
	profileRows, err := a.DB.Query(ctx, `
		SELECT u.id, COALESCE(o.name, ''), u.major_id, COALESCE(m.name, '')
		FROM users u
		LEFT JOIN organizations o ON o.id = u.org_node_id
		LEFT JOIN majors m ON m.id = u.major_id
		WHERE u.id = ANY($1)
	`, studentIDs)
	if err != nil {
		return 0, 0, err
	}
	defer profileRows.Close()
	for profileRows.Next() {
		var id string
		var p userProfile
		if err := profileRows.Scan(&id, &p.className, &p.majorID, &p.majorName); err != nil {
			return 0, 0, err
		}
		profiles[id] = p
	}
	if err := profileRows.Err(); err != nil {
		return 0, 0, err
	}

	// 岗位等级映射：取第一个非空的 custom_level_mapping，否则用默认区间
	var mappings []levelMapping
	for _, p := range points {
		if len(p.customLevelMapping) > 0 {
			mappings = p.customLevelMapping
			break
		}
	}

	// 3. 逐学生计算并 upsert
	updated := 0
	for _, studentID := range studentIDs {
		type pointDetail struct {
			AbilityPointID string  `json:"abilityPointId"`
			Name           string  `json:"abilityPointName"`
			Score          float64 `json:"score"`
			Weight         float64 `json:"weight"`
			RequiredLevel  string  `json:"requiredLevel"`
			Achieved       bool    `json:"achieved"`
		}
		details := make([]pointDetail, 0, len(points))
		pointValid := make([]bool, 0, len(points))
		var posWeightedSum, posWeightSum float64
		achieved := 0
		for _, p := range points {
			var weightedSum, weightSum float64
			for _, t := range p.tasks {
				if s, ok := scores[studentTaskKey{studentID, t.taskID}]; ok {
					weightedSum += s.score * t.weight
					weightSum += t.weight
				}
			}
			pointScore := 0.0
			valid := weightSum > 0
			if valid {
				pointScore = weightedSum / weightSum
				posWeightedSum += pointScore * p.weight
				posWeightSum += p.weight
			}
			pointValid = append(pointValid, valid)
			pointAchieved := valid && pointScore >= 60
			if pointAchieved {
				achieved++
			}
			details = append(details, pointDetail{
				AbilityPointID: p.abilityPointID,
				Name:           p.name,
				Score:          math.Round(pointScore*100) / 100,
				Weight:         p.weight,
				RequiredLevel:  p.requiredLevel,
				Achieved:       pointAchieved,
			})
		}
		if posWeightSum == 0 {
			continue // 无任何有效点则跳过该学生
		}

		positionScore := posWeightedSum / posWeightSum
		rate := math.Round(positionScore*100) / 100
		grade := resolveGrade(positionScore, mappings)

		// 按能力域（certification_ability_items）汇总域内能力点加权平均分
		domainScores := make([]portraitDomainScore, 0)
		{
			type domainAcc struct {
				label                  string
				weightedSum, weightSum float64
			}
			accs := map[string]*domainAcc{}
			order := make([]string, 0)
			for i, p := range points {
				if !pointValid[i] {
					continue
				}
				d := details[i]
				acc, ok := accs[p.itemID]
				if !ok {
					acc = &domainAcc{label: p.itemName}
					accs[p.itemID] = acc
					order = append(order, p.itemID)
				}
				acc.weightedSum += d.Score * p.weight
				acc.weightSum += p.weight
			}
			for _, itemID := range order {
				acc := accs[itemID]
				if acc.weightSum == 0 {
					continue
				}
				score := math.Round(acc.weightedSum/acc.weightSum*100) / 100
				domainScores = append(domainScores, portraitDomainScore{
					Domain:      itemID,
					DomainLabel: acc.label,
					Score:       score,
					Level:       resolveGrade(score, mappings),
				})
			}
		}

		profile := profiles[studentID]
		detailsJSON, err := json.Marshal(details)
		if err != nil {
			return len(studentIDs), updated, err
		}

		_, err = a.DB.Exec(ctx, `
			INSERT INTO job_ability_results (
				tenant_id, career_position_id, user_id, class_name, major_id, major_name,
				total_ability_points, achieved_ability_points, achievement_rate, grade,
				ability_point_details, evaluated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
			ON CONFLICT (career_position_id, user_id) DO UPDATE SET
				tenant_id = EXCLUDED.tenant_id,
				class_name = EXCLUDED.class_name,
				major_id = EXCLUDED.major_id,
				major_name = EXCLUDED.major_name,
				total_ability_points = EXCLUDED.total_ability_points,
				achieved_ability_points = EXCLUDED.achieved_ability_points,
				achievement_rate = EXCLUDED.achievement_rate,
				grade = EXCLUDED.grade,
				ability_point_details = EXCLUDED.ability_point_details,
				grade_history = CASE
					WHEN job_ability_results.grade IS NOT NULL AND job_ability_results.grade IS DISTINCT FROM EXCLUDED.grade
					THEN job_ability_results.grade_history || jsonb_build_array(jsonb_build_object(
						'grade', job_ability_results.grade,
						'achievementRate', job_ability_results.achievement_rate,
						'evaluatedAt', job_ability_results.evaluated_at))
					ELSE job_ability_results.grade_history
				END,
				evaluated_at = EXCLUDED.evaluated_at
		`, tenantID, careerPositionID, studentID, profile.className, profile.majorID, profile.majorName,
			len(points), achieved, rate, grade, detailsJSON)
		if err != nil {
			return len(studentIDs), updated, err
		}

		// 推荐岗位：该用户所有岗位汇聚结果按达标率取前 3
		recommends, err := a.fetchRecommendPositions(ctx, studentID)
		if err != nil {
			return len(studentIDs), updated, err
		}
		domainScoresJSON, err := json.Marshal(domainScores)
		if err != nil {
			return len(studentIDs), updated, err
		}
		recommendsJSON, err := json.Marshal(recommends)
		if err != nil {
			return len(studentIDs), updated, err
		}

		// 同步学生画像（岗位等级 + 能力域得分 + 推荐岗位；排名在循环后统一刷新）
		_, err = a.DB.Exec(ctx, `
			INSERT INTO student_ability_portraits (
				tenant_id, user_id, career_position_id, overall_grade,
				domain_scores, recommend_positions, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, NOW())
			ON CONFLICT (user_id, career_position_id) DO UPDATE SET
				tenant_id = EXCLUDED.tenant_id,
				overall_grade = EXCLUDED.overall_grade,
				domain_scores = EXCLUDED.domain_scores,
				recommend_positions = EXCLUDED.recommend_positions,
				updated_at = EXCLUDED.updated_at
		`, tenantID, studentID, careerPositionID, grade, domainScoresJSON, recommendsJSON)
		if err != nil {
			return len(studentIDs), updated, err
		}
		updated++
	}

	// 同岗位下按达标率刷新班级/专业排名
	if _, err := a.DB.Exec(ctx, `
		WITH ranked AS (
			SELECT user_id,
				ROW_NUMBER() OVER (PARTITION BY class_name ORDER BY achievement_rate DESC, user_id) AS class_rank,
				COUNT(*) OVER (PARTITION BY class_name) AS class_total,
				ROW_NUMBER() OVER (PARTITION BY major_id ORDER BY achievement_rate DESC, user_id) AS major_rank,
				COUNT(*) OVER (PARTITION BY major_id) AS major_total
			FROM job_ability_results
			WHERE career_position_id = $1
		)
		UPDATE student_ability_portraits p
		SET class_rank = r.class_rank, class_total = r.class_total,
			major_rank = r.major_rank, major_total = r.major_total,
			updated_at = NOW()
		FROM ranked r
		WHERE p.career_position_id = $1 AND p.user_id = r.user_id
	`, careerPositionID); err != nil {
		return len(studentIDs), updated, err
	}

	return len(studentIDs), updated, nil
}

// fetchRecommendPositions 取该用户所有岗位汇聚结果按达标率排序的前 3 名。
func (a *JobAbilityAggregator) fetchRecommendPositions(ctx context.Context, userID string) ([]portraitRecommendPosition, error) {
	rows, err := a.DB.Query(ctx, `
		SELECT r.career_position_id, COALESCE(cp.name, ''), r.achievement_rate, COALESCE(r.grade, '')
		FROM job_ability_results r
		LEFT JOIN career_positions cp ON cp.id = r.career_position_id
		WHERE r.user_id = $1
		ORDER BY r.achievement_rate DESC
		LIMIT 3
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]portraitRecommendPosition, 0)
	for rows.Next() {
		var p portraitRecommendPosition
		if err := rows.Scan(&p.PositionID, &p.PositionName, &p.MatchRate, &p.Grade); err != nil {
			return nil, err
		}
		items = append(items, p)
	}
	return items, rows.Err()
}

// resolveGrade 按映射区间取等级；映射为空时用默认区间。
func resolveGrade(score float64, mappings []levelMapping) string {
	if len(mappings) == 0 {
		mappings = []levelMapping{
			{Level: "未达标", Min: 0, Max: 59},
			{Level: "达标", Min: 60, Max: 69},
			{Level: "良好", Min: 70, Max: 79},
			{Level: "优秀", Min: 80, Max: 89},
			{Level: "卓越", Min: 90, Max: 100},
		}
	}
	sorted := make([]levelMapping, len(mappings))
	copy(sorted, mappings)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Min < sorted[j].Min })

	for _, m := range sorted {
		if score >= m.Min && score <= m.Max {
			return m.Level
		}
	}
	// 区间存在空隙时取 min 不大于 score 的最高档
	level := sorted[0].Level
	for _, m := range sorted {
		if score >= m.Min {
			level = m.Level
		}
	}
	return level
}
