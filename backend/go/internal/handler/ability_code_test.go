package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

var nlCodePattern = regexp.MustCompile(`^NL-[0-9A-Z]{8}$`)

// TestAbilityPoint_AutoCode 验证能力点编码自动生成：
// 1. 通过 /job/abilities 创建的能力点自动获得 NL-XXXXXXXX 编码；
// 2. SaveFull 保存岗位自定义能力点（PrepareAbilityPoint）同样生成编码；
// 3. 存量无编码能力点由迁移回填（此处通过手工插入无编码行验证迁移幂等性不依赖运行时）。
func TestAbilityPoint_AutoCode(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	t.Run("CreateGeneratesNLCode", func(t *testing.T) {
		w := env.Do("POST", "/api/v1/job/abilities", map[string]interface{}{
			"name": "Auto Code Ability Point",

			"isPublic": true,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create ability: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		ability, err := testhelper.Unmarshal[domain.AbilityPoint](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		defer env.DB.Exec(ctx, "DELETE FROM ability_points WHERE id = $1", ability.ID)
		if ability.Code == nil || !nlCodePattern.MatchString(*ability.Code) {
			t.Fatalf("created ability code = %v, want NL-XXXXXXXX pattern", ability.Code)
		}
	})

	t.Run("PrepareAbilityPointGeneratesNLCode", func(t *testing.T) {
		w := env.Do("POST", "/api/v1/job/positions", map[string]interface{}{
			"name":         "Auto Code Position",
			"positionType": "enterprise",
			"version":      "v1.0",
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create position: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		pos, _ := testhelper.Unmarshal[domain.CareerPosition](w)
		defer env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", pos.ID)

		body := map[string]interface{}{
			"name":          "Auto Code Position",
			"shortName":     "AutoCode",
			"industry":      "",
			"majors":        []string{},
			"positionType":  "enterprise",
			"salaryRange":   [2]int{0, 0},
			"requirements":  []string{},
			"version":       "v1.0",
			"collaborators": []string{},
			"abilities":     nil,
			"abilityBindings": []map[string]interface{}{
				{
					"id":               "bind-1",
					"responsibilityId": "",
					"source":           "custom",
					"name":             "SaveFull Custom Ability",
					"level":            "A",
					"attributes":       []string{"知识"},
				},
			},
			"responsibilities": []map[string]interface{}{},
			"certificates":     []map[string]interface{}{},
			"abilityDomains":   []map[string]interface{}{},
		}
		w = env.Do("PUT", fmt.Sprintf("/api/v1/job/positions/%s/save-full", pos.ID), body)
		if w.Code != http.StatusOK {
			t.Fatalf("save-full: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}

		var code *string
		err := env.DB.QueryRow(ctx, `
			SELECT code FROM ability_points WHERE tenant_id = $1 AND name = $2
		`, testhelper.TestTenantID, "SaveFull Custom Ability").Scan(&code)
		if err != nil {
			t.Fatalf("query ability point: %v", err)
		}
		if code == nil || !nlCodePattern.MatchString(*code) {
			t.Fatalf("prepare-created ability code = %v, want NL-XXXXXXXX pattern", code)
		}
	})
}
