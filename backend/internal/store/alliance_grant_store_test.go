package store

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// testGrantPool 真实库连接池（TEST_DATABASE_URL 未配置时跳过集成测试）。
func testGrantPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("create pool: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// grantRowIDs 查询某学校-企业-类型授权行的 resource_ids（text[]）。
func grantRowIDs(t *testing.T, pool *pgxpool.Pool, tenantID, enterpriseID, resourceType string) ([]string, error) {
	t.Helper()
	var ids []string
	err := pool.QueryRow(context.Background(), `
		SELECT resource_ids::text[] FROM alliance_resource_grants
		WHERE tenant_id = $1 AND enterprise_id = $2 AND resource_type = $3
	`, tenantID, enterpriseID, resourceType).Scan(&ids)
	return ids, err
}

// grantTestTenant 预置测试租户（企业主体 tenant_id 外键依赖），返回租户 id。
func grantTestTenant(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	tenantID := uuid.NewString()
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO tenants (id, name, code, status) VALUES ($1, $2, $3, 'active')
	`, tenantID, "授权store测试租户-"+uuid.NewString()[:8], "grant-"+uuid.NewString()[:8]); err != nil {
		t.Fatalf("预置租户: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(context.Background(), `DELETE FROM tenants WHERE id = $1`, tenantID)
	})
	return tenantID
}

// grantTestUser 预置租户内测试用户（scenarios.creator_id 外键依赖），返回用户 id。
func grantTestUser(t *testing.T, pool *pgxpool.Pool, tenantID string) string {
	t.Helper()
	userID := uuid.NewString()
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO users (id, tenant_id, role, platform, username, password_hash, name, status)
		VALUES ($1, $2, 'operator', 'portal', $3, 'hash', $3, 'active')
	`, userID, tenantID, "grant-user-"+uuid.NewString()[:8]); err != nil {
		t.Fatalf("预置用户: %v", err)
	}
	return userID
}

// TestAllianceGrant_AddRemoveResourceID 自动授权增量写入：新行插入、幂等去重、
// 移除后清空整行删除。
func TestAllianceGrant_AddRemoveResourceID(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	st := New(pool)

	tenantID := grantTestTenant(t, pool)
	entID := uuid.NewString()
	if _, err := pool.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`,
		entID, tenantID, "授权store测试企业-"+uuid.NewString()[:8]); err != nil {
		t.Fatalf("预置企业: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, `DELETE FROM alliance_resource_grants WHERE tenant_id = $1`, tenantID)
		pool.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, entID)
	})

	gs := st.AllianceGrants()
	operatorID := uuid.NewString()
	r1, r2 := uuid.NewString(), uuid.NewString()

	// 首次追加：插入新行
	if err := gs.AddResourceID(ctx, tenantID, entID, "position", r1, operatorID); err != nil {
		t.Fatalf("首次追加: %v", err)
	}
	ids, err := grantRowIDs(t, pool, tenantID, entID, "position")
	if err != nil {
		t.Fatalf("查授权行: %v", err)
	}
	if len(ids) != 1 || ids[0] != r1 {
		t.Fatalf("首次追加应只有新 id: %v", ids)
	}

	// 重复追加同一 id：幂等去重
	if err := gs.AddResourceID(ctx, tenantID, entID, "position", r1, operatorID); err != nil {
		t.Fatalf("重复追加: %v", err)
	}
	if ids, _ = grantRowIDs(t, pool, tenantID, entID, "position"); len(ids) != 1 {
		t.Fatalf("重复追加不应产生重复: %v", ids)
	}

	// 追加第二个 id
	if err := gs.AddResourceID(ctx, tenantID, entID, "position", r2, operatorID); err != nil {
		t.Fatalf("追加第二个: %v", err)
	}
	if ids, _ = grantRowIDs(t, pool, tenantID, entID, "position"); len(ids) != 2 {
		t.Fatalf("追加后应含两个 id: %v", ids)
	}

	// 移除一个：另一个保留
	if err := gs.RemoveResourceID(ctx, "position", r1); err != nil {
		t.Fatalf("移除: %v", err)
	}
	ids, err = grantRowIDs(t, pool, tenantID, entID, "position")
	if err != nil {
		t.Fatalf("查授权行: %v", err)
	}
	if len(ids) != 1 || ids[0] != r2 {
		t.Fatalf("移除后应只剩 r2: %v", ids)
	}

	// 移除最后一个：整行删除
	if err := gs.RemoveResourceID(ctx, "position", r2); err != nil {
		t.Fatalf("移除最后一个: %v", err)
	}
	if _, err := grantRowIDs(t, pool, tenantID, entID, "position"); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("清空后授权行应已删除, got: %v", err)
	}
}

// seedCoBuiltPosition 预置企业共建岗位（source_enterprise_id 标记）。
func seedCoBuiltPosition(t *testing.T, pool *pgxpool.Pool, tenantID, enterpriseID, name, status string) string {
	t.Helper()
	id := uuid.NewString()
	if _, err := pool.Exec(context.Background(), `
		INSERT INTO career_positions (id, tenant_id, code, name, position_type, status, source_type, source_enterprise_id, version, created_by)
		VALUES ($1, $2, $3, $4, 'enterprise', $5, 'enterprise', $6, 'V1.0', $7)
	`, id, tenantID, "gw-"+uuid.NewString()[:8], name, status, enterpriseID, uuid.NewString()); err != nil {
		t.Fatalf("预置共建岗位: %v", err)
	}
	return id
}

// TestAllianceGrant_UpsertMergingCoBuilt 学校保存授权自动并入企业共建资源：
// 非 archived 的共建资源始终保留在授权集合，学校自建资源按勾选保存，archived 不并入。
func TestAllianceGrant_UpsertMergingCoBuilt(t *testing.T) {
	pool := testGrantPool(t)
	ctx := context.Background()
	st := New(pool)

	tenantID := grantTestTenant(t, pool)
	userID := grantTestUser(t, pool, tenantID)
	entID := uuid.NewString()
	if _, err := pool.Exec(ctx, `INSERT INTO partner_enterprises (id, tenant_id, name) VALUES ($1,$2,$3)`,
		entID, tenantID, "合并授权store测试企业-"+uuid.NewString()[:8]); err != nil {
		t.Fatalf("预置企业: %v", err)
	}
	coBuiltID := seedCoBuiltPosition(t, pool, tenantID, entID, "共建岗位-"+uuid.NewString()[:8], "published")
	archivedID := seedCoBuiltPosition(t, pool, tenantID, entID, "归档共建岗位-"+uuid.NewString()[:8], "archived")
	schoolOwnedID := uuid.NewString()
	if _, err := pool.Exec(ctx, `
		INSERT INTO career_positions (id, tenant_id, code, name, position_type, status, source_type, version, created_by)
		VALUES ($1, $2, $3, $4, 'internship', 'published', 'school', 'V1.0', $5)
	`, schoolOwnedID, tenantID, "xx-"+uuid.NewString()[:8], "学校自建岗位-"+uuid.NewString()[:8], uuid.NewString()); err != nil {
		t.Fatalf("预置学校自建岗位: %v", err)
	}
	t.Cleanup(func() {
		pool.Exec(ctx, `DELETE FROM career_positions WHERE tenant_id = $1`, tenantID)
		pool.Exec(ctx, `DELETE FROM alliance_resource_grants WHERE tenant_id = $1`, tenantID)
		pool.Exec(ctx, `DELETE FROM partner_enterprises WHERE id = $1`, entID)
	})

	gs := st.AllianceGrants()
	operatorID := uuid.NewString()

	// 只勾选学校自建岗位保存 → 共建岗位自动并入，归档的不并入
	if err := gs.UpsertMergingCoBuilt(ctx, tenantID, entID, "position", []string{schoolOwnedID}, operatorID); err != nil {
		t.Fatalf("合并保存: %v", err)
	}
	ids, err := grantRowIDs(t, pool, tenantID, entID, "position")
	if err != nil {
		t.Fatalf("查授权行: %v", err)
	}
	got := map[string]bool{}
	for _, id := range ids {
		got[id] = true
	}
	if len(ids) != 2 || !got[schoolOwnedID] || !got[coBuiltID] {
		t.Fatalf("应并入非归档共建岗位并保留学校自建: %v", ids)
	}
	if got[archivedID] {
		t.Fatalf("归档共建岗位不应并入: %v", ids)
	}

	// 空集合保存 → 共建岗位仍保留（整组清空不误删共建资源）
	if err := gs.UpsertMergingCoBuilt(ctx, tenantID, entID, "position", nil, operatorID); err != nil {
		t.Fatalf("空集合保存: %v", err)
	}
	ids, _ = grantRowIDs(t, pool, tenantID, entID, "position")
	if len(ids) != 1 || ids[0] != coBuiltID {
		t.Fatalf("空集合保存后共建岗位应保留: %v", ids)
	}

	// 场景类型同样并入
	coBuiltSceneID := uuid.NewString()
	if _, err := pool.Exec(ctx, `
		INSERT INTO scenarios (id, tenant_id, code, name, status, source_type, source_enterprise_id, version, creator_id)
		VALUES ($1, $2, $3, $4, 'draft', 'enterprise', $5, 'V1.0', $6)
	`, coBuiltSceneID, tenantID, "cj-"+uuid.NewString()[:8], "共建场景-"+uuid.NewString()[:8], entID, userID); err != nil {
		t.Fatalf("预置共建场景: %v", err)
	}
	if err := gs.UpsertMergingCoBuilt(ctx, tenantID, entID, "scene", nil, operatorID); err != nil {
		t.Fatalf("场景合并保存: %v", err)
	}
	sceneIDs, err := grantRowIDs(t, pool, tenantID, entID, "scene")
	if err != nil {
		t.Fatalf("查场景授权行: %v", err)
	}
	if len(sceneIDs) != 1 || sceneIDs[0] != coBuiltSceneID {
		t.Fatalf("场景共建资源应并入: %v", sceneIDs)
	}

	// 未知类型回落为普通覆盖保存（不报错）
	if err := gs.UpsertMergingCoBuilt(ctx, tenantID, entID, "unknown", []string{fmt.Sprintf("%s", uuid.NewString())}, operatorID); err != nil {
		t.Fatalf("未知类型应回落普通保存: %v", err)
	}
}
