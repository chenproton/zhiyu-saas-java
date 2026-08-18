package handler_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// cleanupAbilityCitationData 清理能力点引用统计涉及的租户数据，
// 保证统计断言不受历史数据干扰（SetupTestEnv 不清理这些表）。
func cleanupAbilityCitationData(t *testing.T, env *testhelper.TestEnv) {
	t.Helper()
	ctx := context.Background()
	if _, err := env.DB.Exec(ctx, "DELETE FROM position_ability_bindings WHERE tenant_id = $1", testhelper.TestTenantID); err != nil {
		t.Fatalf("cleanup position_ability_bindings: %v", err)
	}
	if _, err := env.DB.Exec(ctx, "DELETE FROM certification_ability_points WHERE tenant_id = $1", testhelper.TestTenantID); err != nil {
		t.Fatalf("cleanup certification_ability_points: %v", err)
	}
	if _, err := env.DB.Exec(ctx, "DELETE FROM certification_ability_items WHERE tenant_id = $1", testhelper.TestTenantID); err != nil {
		t.Fatalf("cleanup certification_ability_items: %v", err)
	}
	if _, err := env.DB.Exec(ctx, "DELETE FROM certification_rules WHERE career_position_id IN (SELECT id FROM career_positions WHERE created_by = $1)", testhelper.TestOperatorID); err != nil {
		t.Fatalf("cleanup certification_rules: %v", err)
	}
	if _, err := env.DB.Exec(ctx, "DELETE FROM position_responsibilities WHERE career_position_id IN (SELECT id FROM career_positions WHERE created_by = $1)", testhelper.TestOperatorID); err != nil {
		t.Fatalf("cleanup position_responsibilities: %v", err)
	}
	if _, err := env.DB.Exec(ctx, "DELETE FROM career_positions WHERE created_by = $1", testhelper.TestOperatorID); err != nil {
		t.Fatalf("cleanup career_positions: %v", err)
	}
	if _, err := env.DB.Exec(ctx, "DELETE FROM ability_points WHERE tenant_id = $1", testhelper.TestTenantID); err != nil {
		t.Fatalf("cleanup ability_points: %v", err)
	}
}

// TestAbilityCitationStats 验证能力点引用次数分布：
// 引用源为岗位职责/节点/场景任务/认证绑定，全部未引用时 zeroCount 覆盖全量。
func TestAbilityCitationStats(t *testing.T) {
	env, do := newResourceLibraryTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	cleanupAbilityCitationData(t, env)

	prefix := fmt.Sprintf("能力点引用-%s", uuid.NewString()[:8])
	createAbility := func(name string) string {
		w := do("POST", "/api/v1/job/abilities", map[string]interface{}{
			"name":     name,
			"isPublic": true,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create ability: %d %s", w.Code, testhelper.ErrMsg(w))
		}
		var item struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(w.Body).Decode(&item); err != nil {
			t.Fatalf("decode ability: %v", err)
		}
		t.Cleanup(func() { env.DB.Exec(ctx, "DELETE FROM ability_points WHERE id = $1", item.ID) })
		return item.ID
	}

	abilityZero := createAbility(prefix + "-零引用")
	abilityPosition := createAbility(prefix + "-岗位引用")
	abilityCert := createAbility(prefix + "-认证引用")

	// 岗位职责引用（position_ability_bindings）：先建岗位与职责
	positionID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO career_positions (id, name, position_type, requirements, version, status, created_by, collaborators, code)
		VALUES ($1, $2, '专业', '{}', 'v1', 'draft', $3, '{}', $4)
	`, positionID, prefix+"-岗位", testhelper.TestOperatorID, "POS-"+uuid.NewString()[:6]); err != nil {
		t.Fatalf("insert position: %v", err)
	}
	responsibilityID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO position_responsibilities (id, career_position_id, name, sort_order)
		VALUES ($1, $2, $3, 0)
	`, responsibilityID, positionID, prefix+"-职责"); err != nil {
		t.Fatalf("insert responsibility: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO position_ability_bindings (id, career_position_id, responsibility_id, ability_point_id, required_level)
		VALUES ($1, $2, $3, $4, 'L1')
	`, uuid.NewString(), positionID, responsibilityID, abilityPosition); err != nil {
		t.Fatalf("insert position binding: %v", err)
	}
	// 认证引用（certification_ability_points）：先建规则与能力项
	ruleID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO certification_rules (id, career_position_id, status, rule_source, level_mapping)
		VALUES ($1, $2, 'active', 'manual', '{}')
	`, ruleID, positionID); err != nil {
		t.Fatalf("insert cert rule: %v", err)
	}
	itemID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO certification_ability_items (id, tenant_id, rule_id, name, sort_order)
		VALUES ($1, $2, $3, $4, 0)
	`, itemID, testhelper.TestTenantID, ruleID, prefix+"-能力项"); err != nil {
		t.Fatalf("insert cert item: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO certification_ability_points (id, tenant_id, item_id, ability_point_id, required_level)
		VALUES ($1, $2, $3, $4, 'L1')
	`, uuid.NewString(), testhelper.TestTenantID, itemID, abilityCert); err != nil {
		t.Fatalf("insert certification binding: %v", err)
	}

	wStats := do("GET", "/api/v1/job/abilities/citation-stats", nil)
	if wStats.Code != http.StatusOK {
		t.Fatalf("citation stats: %d %s", wStats.Code, testhelper.ErrMsg(wStats))
	}
	resp := decodeCitationStats(t, wStats)
	if resp.Total != 3 {
		t.Fatalf("total = %d, want 3", resp.Total)
	}
	if resp.ZeroCount != 1 || bucketCount(resp, "0次") != 1 {
		t.Fatalf("zeroCount=%d (want 1), 0次桶=%d", resp.ZeroCount, bucketCount(resp, "0次"))
	}
	if got := bucketCount(resp, "1-5次"); got != 2 {
		t.Fatalf("1-5次桶 = %d, want 2", got)
	}
	t.Logf("ability ids: zero=%s position=%s cert=%s", abilityZero, abilityPosition, abilityCert)
}

// TestAbilityUncitedList 验证零引用能力点列表：时段筛选 + 租户隔离。
func TestAbilityUncitedList(t *testing.T) {
	env, do := newResourceLibraryTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	prefix := fmt.Sprintf("能力点零引用-%s", uuid.NewString()[:8])
	createAbility := func(name string) string {
		w := do("POST", "/api/v1/job/abilities", map[string]interface{}{
			"name":     name,
			"isPublic": true,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create ability: %d %s", w.Code, testhelper.ErrMsg(w))
		}
		var item struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(w.Body).Decode(&item); err != nil {
			t.Fatalf("decode ability: %v", err)
		}
		t.Cleanup(func() { env.DB.Exec(ctx, "DELETE FROM ability_points WHERE id = $1", item.ID) })
		return item.ID
	}

	abilityA := createAbility(prefix + "-A")
	abilityB := createAbility(prefix + "-B")

	if _, err := env.DB.Exec(ctx, `
		UPDATE ability_points SET created_at = NOW() - INTERVAL '30 days' WHERE id = $1
	`, abilityA); err != nil {
		t.Fatalf("backdate abilityA: %v", err)
	}

	base := "/api/v1/job/abilities/uncited"
	var list struct {
		Items []struct {
			ID        string    `json:"id"`
			Name      string    `json:"name"`
			CreatedAt time.Time `json:"createdAt"`
		} `json:"items"`
		Total int `json:"total"`
	}
	wAll := do("GET", base+"?limit=20&offset=0", nil)
	if wAll.Code != http.StatusOK {
		t.Fatalf("uncited all: %d %s", wAll.Code, testhelper.ErrMsg(wAll))
	}
	if err := json.NewDecoder(wAll.Body).Decode(&list); err != nil {
		t.Fatalf("decode uncited: %v", err)
	}
	found := map[string]bool{}
	for _, it := range list.Items {
		found[it.ID] = true
	}
	if !found[abilityA] || !found[abilityB] {
		t.Fatalf("uncited missing: %v, want abilityA+abilityB", found)
	}

	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	wRecent := do("GET", base+"?startDate="+yesterday, nil)
	if wRecent.Code != http.StatusOK {
		t.Fatalf("uncited recent: %d %s", wRecent.Code, testhelper.ErrMsg(wRecent))
	}
	if err := json.NewDecoder(wRecent.Body).Decode(&list); err != nil {
		t.Fatalf("decode uncited recent: %v", err)
	}
	found = map[string]bool{}
	for _, it := range list.Items {
		found[it.ID] = true
	}
	if found[abilityA] || !found[abilityB] {
		t.Fatalf("recent filter wrong: %v; want only abilityB", found)
	}
}

// cleanupCertificateCitationData 清理证书引用统计涉及的租户数据，
// 保证统计断言不受历史数据干扰（SetupTestEnv 不清理这些表）。
func cleanupCertificateCitationData(t *testing.T, env *testhelper.TestEnv) {
	t.Helper()
	ctx := context.Background()
	if _, err := env.DB.Exec(ctx, "DELETE FROM position_certificates WHERE tenant_id = $1", testhelper.TestTenantID); err != nil {
		t.Fatalf("cleanup position_certificates: %v", err)
	}
	if _, err := env.DB.Exec(ctx, "DELETE FROM certificate_library WHERE tenant_id = $1", testhelper.TestTenantID); err != nil {
		t.Fatalf("cleanup certificate_library: %v", err)
	}
	if _, err := env.DB.Exec(ctx, "DELETE FROM career_positions WHERE created_by = $1", testhelper.TestOperatorID); err != nil {
		t.Fatalf("cleanup career_positions: %v", err)
	}
}

// TestCertificateCitationStats 验证证书引用次数分布（引用源：岗位证书绑定）。
func TestCertificateCitationStats(t *testing.T) {
	env, do := newResourceLibraryTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	cleanupCertificateCitationData(t, env)

	prefix := fmt.Sprintf("证书引用-%s", uuid.NewString()[:8])
	createCert := func(name string) string {
		w := do("POST", "/api/v1/job/certificate-library", map[string]interface{}{
			"name": name,
			"url":  "https://example.com/" + name,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create cert: %d %s", w.Code, testhelper.ErrMsg(w))
		}
		var item struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(w.Body).Decode(&item); err != nil {
			t.Fatalf("decode cert: %v", err)
		}
		t.Cleanup(func() { env.DB.Exec(ctx, "DELETE FROM certificate_library WHERE id = $1", item.ID) })
		return item.ID
	}

	certZero := createCert(prefix + "-零引用")
	certReferenced := createCert(prefix + "-被引用")

	// 岗位证书绑定（position_certificates）：先建真实岗位
	positionID := uuid.NewString()
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO career_positions (id, name, position_type, requirements, version, status, created_by, collaborators, code)
		VALUES ($1, $2, '专业', '{}', 'v1', 'draft', $3, '{}', $4)
	`, positionID, prefix+"-岗位", testhelper.TestOperatorID, "POS-"+uuid.NewString()[:6]); err != nil {
		t.Fatalf("insert position: %v", err)
	}
	if _, err := env.DB.Exec(ctx, `
		INSERT INTO position_certificates (id, career_position_id, certificate_library_id, tenant_id)
		VALUES ($1, $2, $3, $4)
	`, uuid.NewString(), positionID, certReferenced, testhelper.TestTenantID); err != nil {
		t.Fatalf("insert position cert: %v", err)
	}

	wStats := do("GET", "/api/v1/job/certificate-library/citation-stats", nil)
	if wStats.Code != http.StatusOK {
		t.Fatalf("citation stats: %d %s", wStats.Code, testhelper.ErrMsg(wStats))
	}
	resp := decodeCitationStats(t, wStats)
	if resp.Total != 2 {
		t.Fatalf("total = %d, want 2", resp.Total)
	}
	if resp.ZeroCount != 1 || bucketCount(resp, "1-5次") != 1 {
		t.Fatalf("zeroCount=%d (want 1), 1-5次桶=%d (want 1)", resp.ZeroCount, bucketCount(resp, "1-5次"))
	}
	t.Logf("cert ids: zero=%s referenced=%s", certZero, certReferenced)
}

// TestCertificateUncitedList 验证零引用证书列表：时段筛选 + 租户隔离。
func TestCertificateUncitedList(t *testing.T) {
	env, do := newResourceLibraryTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()
	cleanupCertificateCitationData(t, env)

	prefix := fmt.Sprintf("证书零引用-%s", uuid.NewString()[:8])
	createCert := func(name string) string {
		w := do("POST", "/api/v1/job/certificate-library", map[string]interface{}{
			"name": name,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create cert: %d %s", w.Code, testhelper.ErrMsg(w))
		}
		var item struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(w.Body).Decode(&item); err != nil {
			t.Fatalf("decode cert: %v", err)
		}
		t.Cleanup(func() { env.DB.Exec(ctx, "DELETE FROM certificate_library WHERE id = $1", item.ID) })
		return item.ID
	}

	certA := createCert(prefix + "-A")
	certB := createCert(prefix + "-B")

	if _, err := env.DB.Exec(ctx, `
		UPDATE certificate_library SET created_at = NOW() - INTERVAL '30 days' WHERE id = $1
	`, certA); err != nil {
		t.Fatalf("backdate certA: %v", err)
	}

	base := "/api/v1/job/certificate-library/uncited"
	var list struct {
		Items []struct {
			ID        string    `json:"id"`
			Name      string    `json:"name"`
			CreatedAt time.Time `json:"createdAt"`
		} `json:"items"`
		Total int `json:"total"`
	}
	wAll := do("GET", base+"?limit=20&offset=0", nil)
	if wAll.Code != http.StatusOK {
		t.Fatalf("uncited all: %d %s", wAll.Code, testhelper.ErrMsg(wAll))
	}
	if err := json.NewDecoder(wAll.Body).Decode(&list); err != nil {
		t.Fatalf("decode uncited: %v", err)
	}
	if list.Total != 2 {
		t.Fatalf("uncited total = %d, want 2", list.Total)
	}

	yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
	wRecent := do("GET", base+"?startDate="+yesterday, nil)
	if wRecent.Code != http.StatusOK {
		t.Fatalf("uncited recent: %d %s", wRecent.Code, testhelper.ErrMsg(wRecent))
	}
	if err := json.NewDecoder(wRecent.Body).Decode(&list); err != nil {
		t.Fatalf("decode uncited recent: %v", err)
	}
	found := map[string]bool{}
	for _, it := range list.Items {
		found[it.ID] = true
	}
	if found[certA] || !found[certB] {
		t.Fatalf("recent filter wrong: %v; want only certB", found)
	}
}

// 补充：零引用能力点/证书均可通过 DELETE 批量删除（与库页面删除行为一致）。
func TestAbilityAndCertificateUncitedDelete(t *testing.T) {
	env, do := newResourceLibraryTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	prefix := fmt.Sprintf("零引用删除-%s", uuid.NewString()[:8])
	w := do("POST", "/api/v1/job/abilities", map[string]interface{}{"name": prefix + "-能力点"})
	if w.Code != http.StatusCreated {
		t.Fatalf("create ability: %d", w.Code)
	}
	var ability struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(w.Body).Decode(&ability); err != nil {
		t.Fatalf("decode ability: %v", err)
	}
	if w := do("DELETE", "/api/v1/job/abilities/"+ability.ID, nil); w.Code != http.StatusOK {
		t.Fatalf("delete ability: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	// 验证数据库行确实被删除（防止静默失败/软删）
	var abilityExists bool
	env.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM ability_points WHERE id = $1)`, ability.ID).Scan(&abilityExists)
	if abilityExists {
		t.Fatalf("ability still exists after delete: %s", ability.ID)
	}

	wc := do("POST", "/api/v1/job/certificate-library", map[string]interface{}{"name": prefix + "-证书"})
	if wc.Code != http.StatusCreated {
		t.Fatalf("create cert: %d", wc.Code)
	}
	var cert struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(wc.Body).Decode(&cert); err != nil {
		t.Fatalf("decode cert: %v", err)
	}
	if w := do("DELETE", "/api/v1/job/certificate-library/"+cert.ID, nil); w.Code != http.StatusOK {
		t.Fatalf("delete cert: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	var certExists bool
	env.DB.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM certificate_library WHERE id = $1)`, cert.ID).Scan(&certExists)
	if certExists {
		t.Fatalf("cert still exists after delete: %s", cert.ID)
	}
}
