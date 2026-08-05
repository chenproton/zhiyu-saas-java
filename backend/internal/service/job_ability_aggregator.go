// Package service 提供跨 handler 复用的业务服务。
package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"strconv"
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

// 说明：汇聚锁不删除——若"用完即删"，等待者持有旧 mutex 引用而后来者拿到新锁，
// 会破坏同一岗位的互斥。岗位数量有界，map 常驻可接受。

// aggPoint 汇聚用能力点：关联链来自 position_ability_bindings + 场景评分点关联。
type aggPoint struct {
	abilityPointID string
	name           string
	domain         string // 能力域名（position_ability_bindings.domain）
	requiredLevel  string // 掌握程度代码（understand/comprehend/master/proficient/expert）
	weight         float64
	tasks          []aggTask
	// levels 自定义五档分数线（[{level,min,max}×5]）；为空使用系统默认档位
	levels []levelMapping
}

// levelMapping 能力点自定义分档配置项（与 domain.LevelMapping 同构，避免引入 JSON 依赖）。
type levelMapping struct {
	Level string  `json:"level"`
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
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
	defer posLock.Unlock()

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
			if len(p.LevelMapping) > 0 {
				var ls []levelMapping
				if raw, mErr := json.Marshal(p.LevelMapping); mErr == nil {
					if uErr := json.Unmarshal(raw, &ls); uErr == nil && len(ls) > 0 {
						ap.levels = ls
					}
				}
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

	// 3. 逐学生计算并 upsert（岗位总评 grade 已停用，不再计算/写入；能力点按分档判定达成）
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
			LevelLabel         string  `json:"levelLabel,omitempty"`
			// CompetencyV2 能力点胜任度（新，%）：等级距离法；无效点不写入
			CompetencyV2 *float64 `json:"competencyV2,omitempty"`
		}
		details := make([]pointDetail, 0, len(points))
		pointValid := make([]bool, 0, len(points))
		var posWeightedSum, posWeightSum, cognitionSum, cognitionWeight, competencySum, competencyV2WeightedSum, competencyV2WeightSum float64
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
			// 胜任度（新）：等级距离法，仅有效点参与（无效点剔除，不惩罚）
			compV2 := 0.0
			if valid && p.weight > 0 {
				compV2 = 100 + (levelValue(p.levels, pointScore)-levelRankByCode(p.requiredLevel))*50
				if compV2 < 0 {
					compV2 = 0
				}
				competencyV2WeightedSum += compV2 * p.weight
				competencyV2WeightSum += p.weight
			}
			// 认知得分/胜任度：与读取时回退口径一致，全部权重>0 的点参与（无效点按 0 分计入）
			if p.weight > 0 {
				cognitionSum += pointScore * p.weight
				cognitionWeight += p.weight
				need := pointCompetencyNeed(p.levels, p.requiredLevel)
				if need > 0 {
					if c := (pointScore - need) / need; c > 0 {
						competencySum += c * p.weight
					}
				}
			}
			pointValid = append(pointValid, valid)
			// 达成判定：有自定义分档时用配置档位（分数档位 >= 要求档位），无配置时回退系统固定五档；
			// requiredLevel 无法解析时回退 60 分线
			pointAchieved := false
			if valid {
				if len(p.levels) > 0 {
					requiredRank := customLevelRankByCode(p.levels, p.requiredLevel)
					pointAchieved = requiredRank >= 0 && customLevelRank(p.levels, pointScore) >= requiredRank
				} else {
					requiredRank := masteryCodeRank(p.requiredLevel)
					if requiredRank >= 0 {
						pointAchieved = masteryScoreRank(pointScore) >= requiredRank
					} else {
						pointAchieved = pointScore >= 60
					}
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
				LevelLabel:         pointLevelLabel(p.levels, pointScore),
				CompetencyV2:       competencyV2Ref(valid, compV2),
			})
		}
		if posWeightSum == 0 {
			continue // 无任何有效点则跳过该学生
		}

		positionScore := posWeightedSum / posWeightSum
		rate := math.Round(positionScore*100) / 100

		// 认知得分（0-100）与岗位胜任度（%，负值归零），落库供读取直接返回
		cognition := 0.0
		competency := 0.0
		if cognitionWeight > 0 {
			cognition = math.Round(cognitionSum/cognitionWeight*100) / 100
			competency = math.Round(competencySum/cognitionWeight*100) / 100
		}

		// 岗位胜任度（新，%）：有效能力点胜任度（新）加权平均
		competencyV2 := 0.0
		if competencyV2WeightSum > 0 {
			competencyV2 = math.Round(competencyV2WeightedSum/competencyV2WeightSum*100) / 100
		}

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
				AbilityCognitionScore: cognition,
				PositionCompetency:    competency,
				PositionCompetencyV2:  competencyV2,
				Grade:                 nil, // 岗位总评已停用，列保留置空
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
				OverallGrade:       nil, // 岗位总评已停用，列保留置空
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

// needScoreByLevel 系统五档掌握程度代码→岗位所需得分（无自定义分档时的需求分数线）。
var needScoreByLevel = map[string]float64{
	"understand": 0,
	"comprehend": 60,
	"master":     70,
	"proficient": 80,
	"expert":     90,
}

// pointCompetencyNeed 能力点岗位所需得分：有自定义分档时取要求档位下限，否则回退系统五档分数线；
// 要求档位无法解析返回 0（该点胜任度按 0 计，权重仍计入分母）。
func pointCompetencyNeed(levels []levelMapping, requiredLevel string) float64 {
	if len(levels) > 0 {
		for _, l := range levels {
			if l.Level == requiredLevel {
				return l.Min
			}
		}
	}
	return needScoreByLevel[requiredLevel]
}

// levelRankByCode 掌握程度代码→等效等级基准值（understand=1 … expert=5），
// 未知代码回退 2（对齐旧"60 分线"回退语义，即理解档）。
func levelRankByCode(code string) float64 {
	switch code {
	case "understand":
		return 1
	case "comprehend":
		return 2
	case "master":
		return 3
	case "proficient":
		return 4
	case "expert":
		return 5
	}
	return 2
}

// levelValue 将 0-100 得分映射为等效等级值（等级轴，每跨越一个完整等级 = 1.0）。
// 档位边界：有自定义分档（5 档）时用配置的 min/max；否则系统默认五档
// （了解[0,59]/理解[60,69]/掌握[70,79]/熟练[80,89]/精通[90,100]）。
// 公式：落在第 n 档（n=1..5）→ n + (得分-min)/(max-min+1)；低于首档（未达标带）→ 得分/首档min。
func levelValue(levels []levelMapping, score float64) float64 {
	bands := make([][2]float64, 5)
	if len(levels) == 5 {
		for i, l := range levels {
			bands[i] = [2]float64{l.Min, l.Max}
		}
	} else {
		bounds := []float64{0, 60, 70, 80, 90, 100}
		for i := 0; i < 5; i++ {
			max := bounds[i+1] - 1
			if i == 4 {
				max = 100
			}
			bands[i] = [2]float64{bounds[i], max}
		}
	}
	if score < bands[0][0] {
		return score / bands[0][0]
	}
	for i, b := range bands {
		if score >= b[0] && score <= b[1] {
			return float64(i+1) + (score-b[0])/(b[1]-b[0]+1)
		}
	}
	return 0
}

// competencyV2Ref 有效点返回胜任度（新）指针，无效点返回 nil（明细不写入该字段）。
func competencyV2Ref(valid bool, v float64) *float64 {
	if !valid {
		return nil
	}
	return &v
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

// customLevelRank 自定义分档下分数落档（0-4，低于最低档返回 -1）。
func customLevelRank(levels []levelMapping, score float64) int {
	rank := -1
	for i, l := range levels {
		if score >= l.Min {
			rank = i
		}
	}
	return rank
}

// customLevelRankByCode 自定义分档下等级代码→档位，未命中返回 -1。
func customLevelRankByCode(levels []levelMapping, code string) int {
	for i, l := range levels {
		if l.Level == code {
			return i
		}
	}
	return -1
}

// pointLevelLabel 能力点档位标签：有自定义分档时返回"未达标/了解L1/…/精通L5"，
// 无自定义时返回系统默认档位标签（了解/理解/掌握/熟练/精通）。
func pointLevelLabel(levels []levelMapping, score float64) string {
	if len(levels) > 0 {
		rank := customLevelRank(levels, score)
		if rank < 0 {
			return "未达标"
		}
		return masteryCodeLabel(levels[rank].Level) + "L" + strconv.Itoa(rank+1)
	}
	return masteryGrade(score)
}
