// Package service 提供跨 handler 复用的业务服务。
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// JobAbilityAggregator 按认证规则汇聚学生场景任务评分为岗位能力结果。
type JobAbilityAggregator struct {
	DB *pgxpool.Pool
	mu sync.Mutex
	positionLocks map[string]*sync.Mutex
}

func NewJobAbilityAggregator(db *pgxpool.Pool) *JobAbilityAggregator {
	return &JobAbilityAggregator{DB: db, positionLocks: make(map[string]*sync.Mutex)}
}

func (a *JobAbilityAggregator) lockPosition(tenantID, positionID string) *sync.Mutex {
	a.mu.Lock()
	defer a.mu.Unlock()
	key := tenantID + ":" + positionID
	if m, ok := a.positionLocks[key]; ok {
		return m
	}
	m := &sync.Mutex{}
	a.positionLocks[key] = m
	return m
}

// aggPoint 汇聚用能力点：关联链来自 position_ability_bindings + 场景评分点关联。
type aggPoint struct {
	abilityPointID string
	name           string
	domain         string // 能力域名（position_ability_bindings.domain）
	requiredLevel  string // 掌握程度代码（understand/comprehend/master/proficient/expert）
	weight         float64
	tasks          []aggTask
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
	// 防止同岗位并发汇聚导致数据竞争
	posLock := a.lockPosition(tenantID, careerPositionID)
	posLock.Lock()
	defer posLock.Unlock()

	// 1. 加载规则 + 组装能力模型（绑定链/任务链全量自动带出，权重缺省均分兜底）
	// 优先 published，其次任意状态，无规则则使用默认均分权重
	var ruleID string
	err := a.DB.QueryRow(ctx, `
		SELECT id FROM certification_rules
		WHERE career_position_id = $1 AND tenant_id = $2 AND status = 'published'
		ORDER BY updated_at DESC LIMIT 1
	`, careerPositionID, tenantID).Scan(&ruleID)
	if err == pgx.ErrNoRows {
		_ = a.DB.QueryRow(ctx, `
			SELECT id FROM certification_rules
			WHERE career_position_id = $1 AND tenant_id = $2
			ORDER BY updated_at DESC LIMIT 1
		`, careerPositionID, tenantID).Scan(&ruleID)
	} else if err != nil {
		return 0, 0, err
	}

	domains, err := LoadCertificationModel(ctx, a.DB, tenantID, careerPositionID, ruleID)
	if err != nil {
		return 0, 0, err
	}
	points := make([]aggPoint, 0)
	taskIDSet := map[string]bool{}
	for _, d := range domains {
		for _, p := range d.Points {
			ap := aggPoint{
				abilityPointID: p.AbilityPointID,
				name:           p.Name,
				domain:         d.Name,
				requiredLevel:  p.RequiredLevel,
				weight:         p.Weight,
			}
			for _, t := range p.Tasks {
				ap.tasks = append(ap.tasks, aggTask{taskID: t.TaskID, weight: t.Weight})
				taskIDSet[t.TaskID] = true
			}
			points = append(points, ap)
		}
	}
	if len(points) == 0 {
		return 0, 0, nil
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
			SELECT evaluatee_id FROM scene_evaluation_results
			WHERE tenant_id = $1 AND task_id = ANY($2) AND status = 'evaluated'
			UNION
			SELECT evaluatee_id FROM course_evaluation_results
			WHERE tenant_id = $1 AND course_id = ANY($2) AND status = 'evaluated'
			UNION
			SELECT ner.evaluatee_id
			FROM node_evaluation_results ner
			JOIN system_course_nodes n ON n.id = ner.node_id
			WHERE ner.tenant_id = $1 AND n.course_id = ANY($2) AND ner.status = 'evaluated'
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
		SELECT evaluatee_id, task_id, MAX(score)
		FROM (
			SELECT evaluatee_id, task_id, total_score / NULLIF(max_score, 0) * 100 AS score
			FROM scene_evaluation_results
			WHERE tenant_id = $1 AND task_id = ANY($2) AND evaluatee_id = ANY($3) AND total_score IS NOT NULL AND status = 'evaluated'
			UNION ALL
			SELECT evaluatee_id, course_id AS task_id, total_score / NULLIF(max_score, 0) * 100 AS score
			FROM course_evaluation_results
			WHERE tenant_id = $1 AND course_id = ANY($2) AND evaluatee_id = ANY($3) AND total_score IS NOT NULL AND status = 'evaluated'
			UNION ALL
			SELECT ner.evaluatee_id, n.course_id AS task_id, ner.total_score / NULLIF(ner.max_score, 0) * 100 AS score
			FROM node_evaluation_results ner
			JOIN system_course_nodes n ON n.id = ner.node_id
			WHERE ner.tenant_id = $1 AND n.course_id = ANY($2) AND ner.evaluatee_id = ANY($3) AND ner.total_score IS NOT NULL AND ner.status = 'evaluated'
		) t
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

	// 3. 逐学生计算并 upsert（评级固定为掌握程度五档，不再有可配置等级映射）
	updated := 0
	for _, studentID := range studentIDs {
		type pointDetail struct {
			AbilityPointID     string  `json:"abilityPointId"`
			Name               string  `json:"abilityPointName"`
			Score              float64 `json:"score"`
			Weight             float64 `json:"weight"`
			RequiredLevel      string  `json:"requiredLevel"`
			RequiredLevelLabel string  `json:"requiredLevelLabel,omitempty"`
			Achieved           bool    `json:"achieved"`
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
			// 达成判定：能力点定级档位 >= binding.required_level 档位；requiredLevel 无法解析时回退 60 分线
			pointAchieved := false
			if valid {
				requiredRank := masteryCodeRank(p.requiredLevel)
				if requiredRank >= 0 {
					pointAchieved = masteryScoreRank(pointScore) >= requiredRank
				} else {
					pointAchieved = pointScore >= 60
				}
			}
			if pointAchieved {
				achieved++
			}
			details = append(details, pointDetail{
				AbilityPointID:     p.abilityPointID,
				Name:               p.name,
				Score:              math.Round(pointScore*100) / 100,
				Weight:             p.weight,
				RequiredLevel:      p.requiredLevel,
				RequiredLevelLabel: masteryCodeLabel(p.requiredLevel),
				Achieved:           pointAchieved,
			})
		}
		if posWeightSum == 0 {
			continue // 无任何有效点则跳过该学生
		}

		positionScore := posWeightedSum / posWeightSum
		rate := math.Round(positionScore*100) / 100
		grade := masteryGrade(positionScore)

		// 按能力域（position_ability_bindings.domain）汇总域内能力点加权平均分
		domainScores := make([]portraitDomainScore, 0)
		{
			type domainAcc struct {
				weightedSum, weightSum float64
			}
			accs := map[string]*domainAcc{}
			order := make([]string, 0)
			for i, p := range points {
				if !pointValid[i] {
					continue
				}
				d := details[i]
				acc, ok := accs[p.domain]
				if !ok {
					acc = &domainAcc{}
					accs[p.domain] = acc
					order = append(order, p.domain)
				}
				acc.weightedSum += d.Score * p.weight
				acc.weightSum += p.weight
			}
			for _, domainName := range order {
				acc := accs[domainName]
				if acc.weightSum == 0 {
					continue
				}
				score := math.Round(acc.weightedSum/acc.weightSum*100) / 100
				domainScores = append(domainScores, portraitDomainScore{
					Domain:      domainName,
					DomainLabel: domainName,
					Score:       score,
					Level:       masteryGrade(score),
				})
			}
		}

		profile := profiles[studentID]
		detailsJSON, err := json.Marshal(details)
		if err != nil {
			return updated, updated, err
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
			return updated, updated, err
		}

		// 推荐岗位：该用户所有岗位汇聚结果按达标率取前 3
		recommends, err := a.fetchRecommendPositions(ctx, studentID)
		if err != nil {
			return len(studentIDs), updated, err
		}
		domainScoresJSON, err := json.Marshal(domainScores)
		if err != nil {
			return updated, updated, err
		}
		recommendsJSON, err := json.Marshal(recommends)
		if err != nil {
			return updated, updated, err
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
			return updated, updated, err
		}
		updated++
	}

	// 同岗位下按达标率刷新班级/专业排名
	if _, err := a.DB.Exec(ctx, `
		WITH ranked AS (
			SELECT user_id,
				RANK() OVER (PARTITION BY class_name ORDER BY achievement_rate DESC) AS class_rank,
				COUNT(*) OVER (PARTITION BY class_name) AS class_total,
				RANK() OVER (PARTITION BY major_id ORDER BY achievement_rate DESC) AS major_rank,
				COUNT(*) OVER (PARTITION BY major_id) AS major_total
			FROM job_ability_results
			WHERE career_position_id = $1 AND tenant_id = $2
		)
		UPDATE student_ability_portraits p
		SET class_rank = r.class_rank, class_total = r.class_total,
			major_rank = r.major_rank, major_total = r.major_total,
			updated_at = NOW()
		FROM ranked r
		WHERE p.career_position_id = $1 AND p.user_id = r.user_id AND p.tenant_id = $2
	`, careerPositionID, tenantID); err != nil {
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

// masteryLevels 掌握程度五档（分数→等级固定映射，不再支持自定义等级映射）。
var masteryLevels = []struct {
	code  string
	label string
	min   float64
}{
	{"understand", "了解", 0},
	{"comprehend", "理解", 60},
	{"master", "掌握", 70},
	{"proficient", "熟练", 80},
	{"expert", "精通", 90},
}

// masteryScoreRank 分数对应的掌握程度档位（0-4）。
func masteryScoreRank(score float64) int {
	rank := 0
	for i, l := range masteryLevels {
		if score >= l.min {
			rank = i
		}
	}
	return rank
}

// masteryGrade 分数→掌握程度中文标签（0-59 了解/60-69 理解/70-79 掌握/80-89 熟练/90-100 精通）。
func masteryGrade(score float64) string {
	return masteryLevels[masteryScoreRank(score)].label
}

// masteryCodeRank 掌握程度代码→档位，无法解析返回 -1。
func masteryCodeRank(code string) int {
	for i, l := range masteryLevels {
		if l.code == code {
			return i
		}
	}
	return -1
}

// masteryCodeLabel 掌握程度代码→中文标签，无法解析返回空串。
func masteryCodeLabel(code string) string {
	if i := masteryCodeRank(code); i >= 0 {
		return masteryLevels[i].label
	}
	return ""
}
