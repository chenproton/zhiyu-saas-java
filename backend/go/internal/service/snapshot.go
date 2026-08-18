package service

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/zhiyu-saas/backend/internal/store"
)

// SnapshotService 资源快照读取（bundle 接口）：按版本解析快照，缺档时按规则回退 live。
// 设计出处：docs/resource-snapshot-versioning.md 3（版本解析顺序）、5.2（bundle 与安全要求）。
type SnapshotService struct {
	st *store.Store
}

// NewSnapshotService 创建快照读取 service。
func NewSnapshotService(svc *Service) *SnapshotService {
	return &SnapshotService{st: svc.Store()}
}

// GetBundle 返回资源某版本的内容 bundle（教学内容+测评配置，不含动态数据）与解析后的版本号。
// 版本解析顺序：URL ?version= > 最新已发布快照；快照缺档时回退 live 现场组装，
// 但仅当请求版本与 live 当前版本一致且 live status='published' 才回退，否则 ErrNotFound（A1：
// 转草稿编辑期间 version 不变，不加版本/状态双重条件学生回退 live 会读到 draft）。
// 所有 404 语义统一返回 store.ErrNotFound，由 handler 映射为 404。
func (s *SnapshotService) GetBundle(ctx context.Context, tenantID, resourceType, resourceID, version string) (json.RawMessage, string, error) {
	snap := s.st.Snapshots()

	v := version
	if v == "" {
		latest, err := snap.LatestVersion(ctx, tenantID, resourceType, resourceID)
		if err != nil {
			return nil, "", err
		}
		v = latest
	}
	if v != "" {
		data, err := snap.GetSnapshot(ctx, tenantID, resourceType, resourceID, v)
		if err == nil {
			return data, v, nil
		}
		if !errors.Is(err, store.ErrNotFound) {
			return nil, "", err
		}
	}

	// 快照缺档（历史数据）：回退 live 现场组装 bundle。
	liveVersion, status, err := snap.LiveState(ctx, tenantID, resourceType, resourceID)
	if err != nil {
		return nil, "", err
	}
	if status != "published" {
		return nil, "", store.ErrNotFound
	}
	if version != "" && version != liveVersion {
		return nil, "", store.ErrNotFound
	}
	data, err := s.buildLiveBundle(ctx, tenantID, resourceType, resourceID)
	if err != nil {
		return nil, "", err
	}
	return data, liveVersion, nil
}

// buildLiveBundle 用快照 builder 现场组装 live 等价 bundle（schema 与快照 jsonb 一致）。
func (s *SnapshotService) buildLiveBundle(ctx context.Context, tenantID, resourceType, resourceID string) (json.RawMessage, error) {
	snap := s.st.Snapshots()
	switch resourceType {
	case store.SnapshotResourceScenario:
		return snap.BuildScenarioSnapshot(ctx, tenantID, resourceID)
	case store.SnapshotResourceCourse:
		return snap.BuildCourseSnapshot(ctx, tenantID, resourceID)
	case store.SnapshotResourceExam:
		return snap.BuildExamSnapshot(ctx, tenantID, resourceID)
	case store.SnapshotResourceQuestionBank:
		return snap.BuildQuestionBankSnapshot(ctx, tenantID, resourceID)
	case store.SnapshotResourcePosition:
		return snap.BuildPositionSnapshot(ctx, tenantID, resourceID)
	default:
		return nil, store.ErrNotFound
	}
}

// snapshotAnswerStripKeys 各资源类型 bundle 中需对学生剥离答案/解析的数组 key 及字段。
// 与 GET /evaluation/exams/{id} 的学生剥离逻辑（exam_handler.go）语义一致。
var snapshotAnswerStripKeys = map[string]map[string][]string{
	store.SnapshotResourceExam: {
		"exam_questions": {"answer", "analysis"},
	},
	store.SnapshotResourceCourse: {
		"node_quiz_questions": {"answer"},
	},
	store.SnapshotResourceScenario: {
		"random_draw_questions": {"answer"},
	},
	store.SnapshotResourceQuestionBank: {
		"questions": {"answer", "analysis"},
	},
}

// StripStudentAnswers 学生角色请求 bundle 时剥离内嵌答案/解析字段（文档 5.2 安全要求）。
// 课程 bundle 内嵌的颗粒课一层（granular_courses）同样剥离。
// 注意：hybrid_node_modules data 中 classQuestions 的 questions[].answer 是"参考答案"，
// 现有学生学习页（hybrid-modules-view.tsx）本就向学生展示，非客观题判分答案，故不剥离；
// 剥离会导致 bundle 与 live 行为不一致、学生端 UI 退化。
// 解析失败时原样返回（宁可多返也不破坏数据结构），调用方按角色保证仅在学生路径使用。
func StripStudentAnswers(resourceType string, data json.RawMessage) json.RawMessage {
	keys := snapshotAnswerStripKeys[resourceType]
	if len(keys) == 0 {
		return data
	}
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(data, &doc); err != nil {
		return data
	}
	stripSnapshotAnswers(doc, keys)
	if resourceType == store.SnapshotResourceCourse {
		// 颗粒课一层：source_id → 课程核心 bundle（含 node_quiz_questions）
		var granular map[string]json.RawMessage
		if raw, ok := doc["granular_courses"]; ok && json.Unmarshal(raw, &granular) == nil {
			for gid, entry := range granular {
				var sub map[string]json.RawMessage
				if json.Unmarshal(entry, &sub) != nil {
					continue
				}
				stripSnapshotAnswers(sub, keys)
				if out, err := json.Marshal(sub); err == nil {
					granular[gid] = out
				}
			}
			if out, err := json.Marshal(granular); err == nil {
				doc["granular_courses"] = out
			}
		}
	}
	out, err := json.Marshal(doc)
	if err != nil {
		return data
	}
	return out
}

// stripSnapshotAnswers 按规则剥离 doc 中各数组 key 的行内字段（原地修改）。
func stripSnapshotAnswers(doc map[string]json.RawMessage, keys map[string][]string) {
	for key, fields := range keys {
		raw, ok := doc[key]
		if !ok {
			continue
		}
		var rows []map[string]json.RawMessage
		if err := json.Unmarshal(raw, &rows); err != nil {
			continue
		}
		for _, row := range rows {
			for _, f := range fields {
				delete(row, f)
			}
		}
		if out, err := json.Marshal(rows); err == nil {
			doc[key] = out
		}
	}
}
