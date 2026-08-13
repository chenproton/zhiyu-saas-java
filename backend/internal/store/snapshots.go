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
