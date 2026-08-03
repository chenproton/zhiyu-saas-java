// Package service 提供跨 handler 复用的业务服务。
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"sync"

	"github.com/zhiyu-saas/backend/internal/store"
)

// JobAbilityAggregator 按认证规则汇聚学生场景任务评分为岗位能力结果。
type JobAbilityAggregator struct {
	store         *store.Store
	mu            sync.Mutex
	positionLocks map[string]*sync.Mutex
}

func NewJobAbilityAggregator(st *store.Store) *JobAbilityAggregator {
	return &JobAbilityAggregator{store: st, positionLocks: make(map[string]*sync.Mutex)}
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

// unlockPosition 汇聚结束后移除岗位锁，避免 map 永久膨胀。
func (a *JobAbilityAggregator) unlockPosition(tenantID, positionID string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	delete(a.positionLocks, tenantID+":"+positionID)
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
	targets, err := a.store.Certifications().ListPublishedTargets(ctx)
	if err != nil {
		return err
	}

	var firstErr error
	for _, t := range targets {
		if err := a.AggregatePosition(ctx, t.TenantID, t.PositionID, nil); err != nil {
			slog.Error("岗位能力汇聚失败", "tenantId", t.TenantID, "careerPositionId", t.PositionID, "error", err)
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	return firstErr
}

// CreateLog 写入一条 running 状态的汇聚日志并返回 id。
func (a *JobAbilityAggregator) CreateLog(ctx context.Context, tenantID, careerPositionID string) (string, error) {
	return a.store.JobAbilityResults().CreateAggregateLog(ctx, tenantID, careerPositionID)
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
	if uerr := a.store.JobAbilityResults().FinishAggregateLog(ctx, logID, status, studentCount, updatedCount, errMsg); uerr != nil {
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

// aggregate 为单租户单岗位计算并 upsert 所有学生的岗位能力结果。
func (a *JobAbilityAggregator) aggregate(ctx context.Context, tenantID, careerPositionID string, userIDs []string) (int, int, error) {
	// 防止同岗位并发汇聚导致数据竞争
	posLock := a.lockPosition(tenantID, careerPositionID)
	posLock.Lock()
	defer func() {
		posLock.Unlock()
		a.unlockPosition(tenantID, careerPositionID)
	}()

	// 1. 加载规则 + 组装能力模型（绑定链/任务链全量自动带出，权重缺省均分兜底）
	ruleID, err := a.store.Certifications().FindRuleIDForPosition(ctx, tenantID, careerPositionID)
	if err != nil {
		return 0, 0, err
	}

	domains, err := a.store.Certifications().LoadModel(ctx, tenantID, careerPositionID, ruleID)
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
		ids, err := a.store.JobAbilityResults().ListCandidateStudents(ctx, tenantID, taskIDs)
		if err != nil {
			return 0, 0, err
		}
		for _, id := range ids {
			studentSet[id] = true
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
	scoreRows, err := a.store.JobAbilityResults().LoadStudentTaskScores(ctx, tenantID, taskIDs, studentIDs)
	if err != nil {
		return 0, 0, err
	}
	for _, row := range scoreRows {
		scores[studentTaskKey{row.StudentID, row.TaskID}] = taskScore{score: row.Score}
	}

	// 学生班级/专业信息
	profiles, err := a.store.Users().ListProfiles(ctx, studentIDs)
	if err != nil {
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
			return len(studentIDs), updated, err
		}

		if err := a.store.WithTx(ctx, func(txStore *store.Store) error {
			if err := txStore.JobAbilityResults().UpsertResult(ctx, &store.JobAbilityResultUpsertParams{
				TenantID:              tenantID,
				CareerPositionID:      careerPositionID,
				UserID:                studentID,
				ClassName:             profile.ClassName,
				MajorID:               profile.MajorID,
				MajorName:             profile.MajorName,
				TotalAbilityPoints:    len(points),
				AchievedAbilityPoints: achieved,
				AchievementRate:       rate,
				Grade:                 grade,
				AbilityPointDetails:   detailsJSON,
			}); err != nil {
				return err
			}

			recommends, err := txStore.StudentPortraits().FetchRecommendPositions(ctx, studentID)
			if err != nil {
				return err
			}
			domainScoresJSON, err := json.Marshal(domainScores)
			if err != nil {
				return err
			}
			recommendsJSON, err := json.Marshal(recommends)
			if err != nil {
				return err
			}
			return txStore.StudentPortraits().UpsertPortrait(ctx, &store.StudentPortraitUpsertParams{
				TenantID:           tenantID,
				UserID:             studentID,
				CareerPositionID:   careerPositionID,
				OverallGrade:       grade,
				DomainScores:       domainScoresJSON,
				RecommendPositions: recommendsJSON,
			})
		}); err != nil {
			return len(studentIDs), updated, err
		}
		updated++
	}

	// 同岗位下按达标率刷新班级/专业排名
	if err := a.store.JobAbilityResults().RefreshRanks(ctx, careerPositionID, tenantID); err != nil {
		return len(studentIDs), updated, err
	}

	return len(studentIDs), updated, nil
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
