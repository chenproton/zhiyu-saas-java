package service

import (
	"context"
	"math"

	"github.com/jackc/pgx/v5/pgxpool"
)

// CertificationModelTask 能力点关联的测评任务（场景任务或课程）。
type CertificationModelTask struct {
	TaskID       string  `json:"taskId"`
	TaskName     string  `json:"taskName"`
	ScenarioName string  `json:"scenarioName"`
	TaskType     string  `json:"taskType"` // "scene" | "course"
	Weight       float64 `json:"weight"`
}

// CertificationModelPoint 岗位能力点（掌握程度要求/胜任标准来自 position_ability_bindings）。
type CertificationModelPoint struct {
	AbilityPointID    string                   `json:"abilityPointId"`
	Name              string                   `json:"name"`
	Description       string                   `json:"description"`
	RequiredLevel     string                   `json:"requiredLevel"`
	RubricDescription string                   `json:"rubricDescription"`
	Weight            float64                  `json:"weight"`
	Tasks             []CertificationModelTask `json:"tasks"`
}

// CertificationModelDomain 能力域（按 position_ability_bindings.domain 分组）。
type CertificationModelDomain struct {
	Name   string                    `json:"name"`
	Points []CertificationModelPoint `json:"points"`
}

// LoadCertificationModel 组装岗位能力认定模型：关联链（岗位→能力域→能力点→关联任务）
// 全部从已有数据读取，仅两级权重来自 certification_weights；ruleID 为空或权重缺失时
// 走默认均分（点按点数均分 100、点内任务按任务数均分 100，余数补第一个）。
// model 接口与汇聚服务共用本函数，保证默认权重逻辑一致。
func LoadCertificationModel(ctx context.Context, db *pgxpool.Pool, tenantID, positionID, ruleID string) ([]CertificationModelDomain, error) {
	// 1. 岗位→能力域→能力点：读 position_ability_bindings，按 ability_point_id 去重
	// （同一能力点可能因多职责出现多次，取首条的 domain/requiredLevel/rubricDescription）
	bindRows, err := db.Query(ctx, `
		SELECT b.ability_point_id, COALESCE(b.domain, ''), b.required_level,
			COALESCE(b.rubric_description, ''), COALESCE(ap.name, ''), COALESCE(ap.description, '')
		FROM position_ability_bindings b
		LEFT JOIN ability_points ap ON ap.id = b.ability_point_id
		WHERE b.career_position_id = $1 AND b.tenant_id = $2
		ORDER BY b.id
	`, positionID, tenantID)
	if err != nil {
		return nil, err
	}
	defer bindRows.Close()

	type boundPoint struct {
		point  CertificationModelPoint
		domain string
	}
	points := make([]boundPoint, 0)
	pointIdx := map[string]int{}
	for bindRows.Next() {
		var p CertificationModelPoint
		var domain string
		if err := bindRows.Scan(&p.AbilityPointID, &domain, &p.RequiredLevel, &p.RubricDescription, &p.Name, &p.Description); err != nil {
			return nil, err
		}
		if _, ok := pointIdx[p.AbilityPointID]; ok {
			continue
		}
		p.Tasks = []CertificationModelTask{}
		pointIdx[p.AbilityPointID] = len(points)
		points = append(points, boundPoint{point: p, domain: domain})
	}
	if err := bindRows.Err(); err != nil {
		return nil, err
	}
	if len(points) == 0 {
		return []CertificationModelDomain{}, nil
	}

	// 2. 能力点→关联任务：场景评分点关联链
	// scenarios.career_position_id → scenario_tasks → task_evaluation_methods(is_enabled)
	// → task_eval_points.ability_point_ids；同一任务被多个评分点关联同一能力点只计一次
	pointIDs := make([]string, len(points))
	for i, bp := range points {
		pointIDs[i] = bp.point.AbilityPointID
	}
	taskRows, err := db.Query(ctx, `
		SELECT DISTINCT u.ap_id, t.id, COALESCE(t.name, ''), COALESCE(s.name, '')
		FROM scenarios s
		JOIN scenario_tasks t ON t.scenario_id = s.id
		JOIN task_evaluation_methods m ON m.task_id = t.id AND m.is_enabled = TRUE
		JOIN task_eval_points p ON p.config_id = m.id
		CROSS JOIN LATERAL unnest(p.ability_point_ids) AS u(ap_id)
		WHERE s.career_position_id = $1 AND m.tenant_id = $2 AND u.ap_id = ANY($3)
		ORDER BY u.ap_id, t.id
	`, positionID, tenantID, pointIDs)
	if err != nil {
		return nil, err
	}
	defer taskRows.Close()
	for taskRows.Next() {
		var apID string
		var t CertificationModelTask
		if err := taskRows.Scan(&apID, &t.TaskID, &t.TaskName, &t.ScenarioName); err != nil {
			return nil, err
		}
		t.TaskType = "scene"
		if i, ok := pointIdx[apID]; ok {
			points[i].point.Tasks = append(points[i].point.Tasks, t)
		}
	}
	if err := taskRows.Err(); err != nil {
		return nil, err
	}

	// 2b. 能力点→关联课程：课程上 ability_point_ids 与岗位能力点匹配。
	courseRows, err := db.Query(ctx, `
		SELECT DISTINCT u.ap_id, c.id, COALESCE(c.name, '')
		FROM courses c
		CROSS JOIN LATERAL unnest(c.ability_point_ids) AS u(ap_id)
		WHERE c.tenant_id = $1 AND c.status = 'published' AND u.ap_id = ANY($2)
		ORDER BY u.ap_id, c.id
	`, tenantID, pointIDs)
	if err != nil {
		return nil, err
	}
	defer courseRows.Close()
	for courseRows.Next() {
		var apID string
		var t CertificationModelTask
		if err := courseRows.Scan(&apID, &t.TaskID, &t.TaskName); err != nil {
			return nil, err
		}
		t.TaskType = "course"
		if i, ok := pointIdx[apID]; ok {
			points[i].point.Tasks = append(points[i].point.Tasks, t)
		}
	}
	if err := courseRows.Err(); err != nil {
		return nil, err
	}

	// 3. 两级权重：certification_weights（task_id 为 NULL 的行是能力点占岗位总分的权重）
	type weightKey struct {
		pointID, taskID string
	}
	stored := map[weightKey]float64{}
	if ruleID != "" {
		wRows, err := db.Query(ctx, `
			SELECT ability_point_id, task_id, weight FROM certification_weights WHERE rule_id = $1
		`, ruleID)
		if err != nil {
			return nil, err
		}
		defer wRows.Close()
		for wRows.Next() {
			var k weightKey
			var taskID *string
			var w float64
			if err := wRows.Scan(&k.pointID, &taskID, &w); err != nil {
				return nil, err
			}
			if taskID != nil {
				k.taskID = *taskID
			}
			stored[k] = w
		}
		if err := wRows.Err(); err != nil {
			return nil, err
		}
	}

	// 4. 应用权重：已存权重优先，缺省走均分兜底
	pointDefaults := splitEvenly(100, len(points))
	for i := range points {
		p := &points[i].point
		if w, ok := stored[weightKey{pointID: p.AbilityPointID}]; ok {
			p.Weight = w
		} else {
			p.Weight = pointDefaults[i]
		}
		taskDefaults := splitEvenly(100, len(p.Tasks))
		for j := range p.Tasks {
			if w, ok := stored[weightKey{pointID: p.AbilityPointID, taskID: p.Tasks[j].TaskID}]; ok {
				p.Tasks[j].Weight = w
			} else {
				p.Tasks[j].Weight = taskDefaults[j]
			}
		}
	}

	// 5. 按 domain 分组为能力域（保持绑定出现顺序）
	domains := make([]CertificationModelDomain, 0)
	domainIdx := map[string]int{}
	for _, bp := range points {
		i, ok := domainIdx[bp.domain]
		if !ok {
			i = len(domains)
			domainIdx[bp.domain] = i
			domains = append(domains, CertificationModelDomain{Name: bp.domain, Points: []CertificationModelPoint{}})
		}
		domains[i].Points = append(domains[i].Points, bp.point)
	}
	return domains, nil
}

// splitEvenly 把 total 均分为 n 份（两位小数，除不尽的余数补给第一份）。
func splitEvenly(total float64, n int) []float64 {
	parts := make([]float64, n)
	if n <= 0 {
		return parts
	}
	base := math.Floor(total/float64(n)*100) / 100
	for i := range parts {
		parts[i] = base
	}
	parts[0] = math.Round((total-base*float64(n-1))*100) / 100
	return parts
}
