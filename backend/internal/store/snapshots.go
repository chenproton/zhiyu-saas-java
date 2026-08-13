package store

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
)

// 快照资源类型（= versionedContentTables 白名单的表名，resource_snapshots.resource_type 取值）。
const (
	SnapshotResourcePosition     = "career_positions"
	SnapshotResourceScenario     = "scenarios"
	SnapshotResourceCourse       = "courses"
	SnapshotResourceExam         = "exams"
	SnapshotResourceQuestionBank = "question_banks"
)

// SnapshotStore 资源快照持久化：发布时整树 jsonb 存档，按 (resource_type, resource_id, version) 幂等。
// 快照表无 FK（刻意设计，见 migration 158 注释），读取一律要求 tenant_id 防跨租户。
type SnapshotStore struct {
	q Queryer
}

// NewSnapshotStore 创建快照 store（q 可为连接池或事务内 pgx.Tx）。
func NewSnapshotStore(q Queryer) *SnapshotStore {
	return &SnapshotStore{q: q}
}

// SaveSnapshot 写入快照；同 (resource_type, resource_id, version) 重复写时覆盖内容，不产生第二行（幂等）。
func (s *SnapshotStore) SaveSnapshot(ctx context.Context, tenantID, resourceType, resourceID, version string, data json.RawMessage) error {
	_, err := s.q.Exec(ctx, `
		INSERT INTO resource_snapshots (tenant_id, resource_type, resource_id, version, snapshot_data)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT ON CONSTRAINT uq_resource_snapshots
		DO UPDATE SET snapshot_data = EXCLUDED.snapshot_data, tenant_id = EXCLUDED.tenant_id
	`, tenantID, resourceType, resourceID, version, data)
	return err
}

// GetSnapshot 按版本读取快照；不存在返回 ErrNotFound。
func (s *SnapshotStore) GetSnapshot(ctx context.Context, tenantID, resourceType, resourceID, version string) (json.RawMessage, error) {
	var data []byte
	err := s.q.QueryRow(ctx, `
		SELECT snapshot_data FROM resource_snapshots
		WHERE tenant_id = $1 AND resource_type = $2 AND resource_id = $3 AND version = $4
	`, tenantID, resourceType, resourceID, version).Scan(&data)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return json.RawMessage(data), nil
}

// LiveState 查询资源 live 行的当前版本与状态（限定租户；不存在返回 ErrNotFound）。
// 供快照缺档时的 live 回退判定：仅当请求版本与 live 当前版本一致且状态为 published 才允许回退（文档 3/5.2 A1）。
func (s *SnapshotStore) LiveState(ctx context.Context, tenantID, resourceType, resourceID string) (version string, status string, err error) {
	tbl, err := SanitizeIdentifier(resourceType, AllowedContentTables)
	if err != nil {
		return "", "", err
	}
	err = s.q.QueryRow(ctx, `SELECT COALESCE(version, ''), status FROM `+tbl+` WHERE tenant_id = $1 AND id = $2`,
		tenantID, resourceID).Scan(&version, &status)
	if err == pgx.ErrNoRows {
		return "", "", ErrNotFound
	}
	return version, status, err
}

// LatestVersion 返回某资源最新快照的版本号（按写入时间倒序）；无快照时返回空串（不视为错误，
// 调用方据此回退 live 当前版本）。
func (s *SnapshotStore) LatestVersion(ctx context.Context, tenantID, resourceType, resourceID string) (string, error) {
	var version string
	err := s.q.QueryRow(ctx, `
		SELECT version FROM resource_snapshots
		WHERE tenant_id = $1 AND resource_type = $2 AND resource_id = $3
		ORDER BY created_at DESC, id DESC LIMIT 1
	`, tenantID, resourceType, resourceID).Scan(&version)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return version, err
}

// ResolveResourceVersion 绑定盖章统一口径（文档 5.3）：以快照表最新版本为准，快照缺档回退 live 当前版本；
// 资源本身不存在时返回空串（调用方落 NULL，不视为错误）。
// 与 bundle 读取的回退不同：盖章只取版本号，不要求 live status='published'。
func (s *SnapshotStore) ResolveResourceVersion(ctx context.Context, tenantID, resourceType, resourceID string) (string, error) {
	latest, err := s.LatestVersion(ctx, tenantID, resourceType, resourceID)
	if err != nil {
		return "", err
	}
	if latest != "" {
		return latest, nil
	}
	version, _, err := s.LiveState(ctx, tenantID, resourceType, resourceID)
	if err == ErrNotFound {
		return "", nil
	}
	return version, err
}

// ExpectedOrLatestVersion 并发窗口降级语义（文档 13.B2）：提交方提示的 expected 版本快照存在则采纳，
// 否则回退最新（快照缺档再回退 live）。这是"版本无效回退最新"的降级，不是乐观锁拒绝。
func (s *SnapshotStore) ExpectedOrLatestVersion(ctx context.Context, tenantID, resourceType, resourceID, expected string) (string, error) {
	if expected != "" {
		if _, err := s.GetSnapshot(ctx, tenantID, resourceType, resourceID, expected); err == nil {
			return expected, nil
		} else if err != ErrNotFound {
			return "", err
		}
	}
	return s.ResolveResourceVersion(ctx, tenantID, resourceType, resourceID)
}

// SyncTempExamSnapshot 临时考试兜底（文档 5.1 末条）：temp exam 不走 Transition，在题目同步点维护版本与快照。
// changed 表示 SyncExamQuestions 实际改写了题目集合：
//   - 当前版本尚无快照（首次同步/历史缺档）→ 直接按当前版本补写快照，不 bump；
//   - 当前版本已有快照且题目集合变化 → bump exams.version（NextVersion 同款 +0.1）后写新版快照；
//   - 题目集合未变 → 不动版本。
//
// 最后把引用该试卷的全部 exam_usages.exam_version 刷新为最终版本（temp exam 与安排一一对应），
// 防课程再版 SyncExamQuestions 覆盖旧安排题目内容后安排仍指向旧版（文档 7.2）。
// 返回最终版本号。SaveSnapshot 为 upsert，重复调用幂等。
func (s *SnapshotStore) SyncTempExamSnapshot(ctx context.Context, tenantID, examID string, changed bool) (string, error) {
	version, _, err := s.LiveState(ctx, tenantID, SnapshotResourceExam, examID)
	if err != nil {
		return "", err
	}
	if _, err := s.GetSnapshot(ctx, tenantID, SnapshotResourceExam, examID, version); err == ErrNotFound {
		// 当前版本无快照：首次同步或历史缺档，按当前版本补写（不 bump，避免新建卷从 V1.1 起跳）
		data, err := s.BuildExamSnapshot(ctx, tenantID, examID)
		if err != nil {
			return "", err
		}
		if err := s.SaveSnapshot(ctx, tenantID, SnapshotResourceExam, examID, version, data); err != nil {
			return "", err
		}
	} else if err != nil {
		return "", err
	} else if changed {
		// 当前版本快照已存在而题目集合再次变化：bump 后写新版快照，旧版永久保留可回溯
		version = NextVersion(version)
		if _, err := s.q.Exec(ctx, `UPDATE exams SET version = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`, version, examID, tenantID); err != nil {
			return "", err
		}
		data, err := s.BuildExamSnapshot(ctx, tenantID, examID)
		if err != nil {
			return "", err
		}
		if err := s.SaveSnapshot(ctx, tenantID, SnapshotResourceExam, examID, version, data); err != nil {
			return "", err
		}
	}
	if _, err := s.q.Exec(ctx, `UPDATE exam_usages SET exam_version = $1, updated_at = NOW() WHERE exam_id = $2 AND tenant_id = $3`, version, examID, tenantID); err != nil {
		return "", err
	}
	return version, nil
}
