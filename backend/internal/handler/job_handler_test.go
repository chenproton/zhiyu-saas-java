package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

func TestPosition_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	var createdID string
	var createdVersion string

	t.Run("Create", func(t *testing.T) {
		body := map[string]interface{}{
			"name":         "Test Position",
			"positionType": "enterprise",
			"version":      "v1.0",
		}
		w := env.Do("POST", "/api/v1/job/positions", body)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if pos.Name != "Test Position" {
			t.Errorf("name = %q, want %q", pos.Name, "Test Position")
		}
		if string(pos.PositionType) != "enterprise" {
			t.Errorf("positionType = %q, want enterprise", pos.PositionType)
		}
		if pos.Version != "v1.0" {
			t.Errorf("version = %q, want v1.0", pos.Version)
		}
		createdID = pos.ID
		createdVersion = pos.Version
	})
	defer func() {
		if createdID != "" {
			env.DB.Exec(context.Background(), "DELETE FROM career_positions WHERE id = $1", createdID)
		}
	}()

	if createdID == "" {
		t.Fatal("no created ID, skipping remaining tests")
	}

	t.Run("List", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/job/positions", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.CareerPosition](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total < 1 {
			t.Errorf("total = %d, want > 0", total)
		}
		if len(items) < 1 {
			t.Errorf("items length = %d, want > 0", len(items))
		}
	})

	t.Run("Get", func(t *testing.T) {
		w := env.Do("GET", fmt.Sprintf("/api/v1/job/positions/%s", createdID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if pos.ID != createdID {
			t.Errorf("ID = %q, want %q", pos.ID, createdID)
		}
	})

	t.Run("Update", func(t *testing.T) {
		body := map[string]interface{}{
			"name":         "Updated Position",
			"positionType": "enterprise",
			"version":      createdVersion,
		}
		w := env.Do("PUT", fmt.Sprintf("/api/v1/job/positions/%s", createdID), body)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if pos.Name != "Updated Position" {
			t.Errorf("name = %q, want %q", pos.Name, "Updated Position")
		}
	})

	t.Run("Delete", func(t *testing.T) {
		deletedID := createdID
		w := env.Do("DELETE", fmt.Sprintf("/api/v1/job/positions/%s", deletedID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		createdID = ""

		w = env.Do("GET", fmt.Sprintf("/api/v1/job/positions/%s", deletedID), nil)
		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404 after delete, got %d", w.Code)
		}
	})
}

func TestPosition_StatusTransitions(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	body := map[string]interface{}{
		"name":         "Status Test Position",
		"positionType": "enterprise",
		"version":      "v1.0",
	}
	w := env.Do("POST", "/api/v1/job/positions", body)
	if w.Code != http.StatusCreated {
		t.Fatalf("create: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	positionID := pos.ID
	defer env.DB.Exec(context.Background(), "DELETE FROM career_positions WHERE id = $1", positionID)

	if string(pos.Status) != string(domain.CareerPositionStatusDraft) {
		t.Fatalf("initial status = %q, want draft", pos.Status)
	}

	t.Run("Submit", func(t *testing.T) {
		w := env.Do("POST", fmt.Sprintf("/api/v1/job/positions/%s/submit", positionID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if string(pos.Status) != string(domain.CareerPositionStatusPending) {
			t.Errorf("status = %q, want pending", pos.Status)
		}
	})

	t.Run("Review_Approved", func(t *testing.T) {
		body := map[string]interface{}{"status": "approved"}
		w := env.Do("POST", fmt.Sprintf("/api/v1/job/positions/%s/review", positionID), body)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if string(pos.Status) != string(domain.CareerPositionStatusApproved) {
			t.Errorf("status = %q, want approved", pos.Status)
		}
	})

	t.Run("Publish", func(t *testing.T) {
		w := env.Do("POST", fmt.Sprintf("/api/v1/job/positions/%s/publish", positionID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if string(pos.Status) != string(domain.CareerPositionStatusPublished) {
			t.Errorf("status = %q, want published", pos.Status)
		}
	})

	t.Run("Archive", func(t *testing.T) {
		w := env.Do("POST", fmt.Sprintf("/api/v1/job/positions/%s/archive", positionID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if string(pos.Status) != string(domain.CareerPositionStatusArchived) {
			t.Errorf("status = %q, want archived", pos.Status)
		}
	})
}

func TestPosition_SaveFull(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	var createdID string

	t.Run("Create", func(t *testing.T) {
		body := map[string]interface{}{
			"name":         "Full Save Position",
			"positionType": "enterprise",
			"version":      "v1.0",
		}
		w := env.Do("POST", "/api/v1/job/positions", body)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		createdID = pos.ID
	})
	defer func() {
		if createdID != "" {
			env.DB.Exec(context.Background(), "DELETE FROM career_positions WHERE id = $1", createdID)
		}
	}()

	if createdID == "" {
		t.Fatal("no created ID")
	}

	t.Run("SaveFull", func(t *testing.T) {
		body := map[string]interface{}{
			"batchId":      "",
			"name":         "Updated Full Position",
			"shortName":    "Updated",
			"industry":     "",
			"majors":       []string{},
			"positionType": "enterprise",
			"salaryRange":  [2]int{5000, 10000},
			"description":  "updated description",
			"requirements": []string{"req1", "req2"},
			"careerPath":   "updated path",
			"version":      "v1.0",
			"collaborators": []string{},
			"responsibilities": []map[string]interface{}{
				{"id": "resp-1", "name": "Responsibility 1", "description": "desc 1"},
				{"id": "resp-2", "name": "Responsibility 2"},
			},
			"certificates": []map[string]interface{}{
				{"id": "cert-1", "name": "Certificate 1", "url": "https://example.com"},
			},
			"abilityBindings": []map[string]interface{}{
				{"id": "bind-1", "responsibilityId": "resp-1", "source": "custom", "name": "Custom Ability", "category": "专业技能", "level": "master", "rubricDescription": "rubric", "attributes": []string{"技能"}, "domain": "业务洞察"},
			},
			"abilityDomains": []map[string]interface{}{
				{"id": "domain-1", "name": "Domain 1", "bindingIds": []string{"bind-1"}},
			},
		}
		w := env.Do("PUT", fmt.Sprintf("/api/v1/job/positions/%s/save-full", createdID), body)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("VerifyResponsibilities", func(t *testing.T) {
		w := env.Do("GET", fmt.Sprintf("/api/v1/job/position-responsibilities?careerPositionId=%s", createdID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.PositionResponsibility](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total != 2 {
			t.Errorf("total = %d, want 2", total)
		}
		if len(items) != 2 {
			t.Errorf("items length = %d, want 2", len(items))
		}
	})

	t.Run("VerifyCertificates", func(t *testing.T) {
		w := env.Do("GET", fmt.Sprintf("/api/v1/job/position-certificates?careerPositionId=%s", createdID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.PositionCertificate](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total != 1 {
			t.Errorf("total = %d, want 1", total)
		}
		if len(items) != 1 || items[0].Name != "Certificate 1" {
			t.Errorf("certificate not saved correctly")
		}
	})

	// Regression: saving another binding with the same custom ability name should
	// reuse the existing ability point instead of violating the tenant+name unique
	// constraint and returning 500.
	t.Run("SaveFull_DuplicateAbilityName", func(t *testing.T) {
		body := map[string]interface{}{
			"batchId":       "",
			"name":          "Updated Full Position",
			"shortName":     "Updated",
			"industry":      "",
			"majors":        []string{},
			"positionType":  "enterprise",
			"salaryRange":   [2]int{5000, 10000},
			"description":   "updated description",
			"requirements":  []string{"req1", "req2"},
			"careerPath":    "updated path",
			"version":       "v1.0",
			"collaborators": []string{},
			"responsibilities": []map[string]interface{}{
				{"id": "resp-1", "name": "Responsibility 1", "description": "desc 1"},
				{"id": "resp-2", "name": "Responsibility 2"},
			},
			"certificates": []map[string]interface{}{
				{"id": "cert-1", "name": "Certificate 1", "url": "https://example.com"},
			},
			"abilityBindings": []map[string]interface{}{
				// Existing binding from the previous SaveFull call.
				{"id": "bind-1", "responsibilityId": "resp-1", "source": "custom", "name": "Custom Ability", "category": "专业技能", "level": "master", "rubricDescription": "rubric", "attributes": []string{"技能"}, "domain": "业务洞察"},
				// New binding referencing the same ability name under a different responsibility.
				{"id": "bind-2", "responsibilityId": "resp-2", "source": "custom", "name": "Custom Ability", "category": "专业技能", "level": "understand", "rubricDescription": "", "attributes": []string{"技能"}, "domain": ""},
			},
			"abilityDomains": []map[string]interface{}{
				{"id": "domain-1", "name": "Domain 1", "bindingIds": []string{"bind-1", "bind-2"}},
			},
		}
		w := env.Do("PUT", fmt.Sprintf("/api/v1/job/positions/%s/save-full", createdID), body)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("VerifyAbilityBindings", func(t *testing.T) {
		w := env.Do("GET", fmt.Sprintf("/api/v1/job/position-abilities?careerPositionId=%s", createdID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.PositionAbilityBinding](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total != 2 {
			t.Errorf("total = %d, want 2", total)
		}
		if len(items) != 2 {
			t.Errorf("items length = %d, want 2", len(items))
			return
		}
		if items[0].AbilityPointID != items[1].AbilityPointID {
			t.Errorf("ability points not reused: %q != %q", items[0].AbilityPointID, items[1].AbilityPointID)
		}
	})
}

func TestPosition_ValidationErrors(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	t.Run("Create_MissingName", func(t *testing.T) {
		body := map[string]interface{}{
			"positionType": "enterprise",
		}
		w := env.Do("POST", "/api/v1/job/positions", body)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("Create_MissingPositionType", func(t *testing.T) {
		body := map[string]interface{}{
			"name": "Test",
		}
		w := env.Do("POST", "/api/v1/job/positions", body)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("Get_NonExistent", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/job/positions/non-existent-id-12345", nil)
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("Review_InvalidStatus", func(t *testing.T) {
		body := map[string]interface{}{"status": "invalid-status"}
		w := env.Do("POST", "/api/v1/job/positions/some-id/review", body)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})
}

func TestAbility_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	var abilityID string

	t.Run("Create", func(t *testing.T) {
		body := map[string]interface{}{
			"name":     "Test Ability",
			"category": "skill",
			"isPublic": true,
		}
		w := env.Do("POST", "/api/v1/job/abilities", body)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		a, err := testhelper.Unmarshal[domain.AbilityPoint](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if a.Name != "Test Ability" {
			t.Errorf("name = %q, want %q", a.Name, "Test Ability")
		}
		if string(a.Category) != "skill" {
			t.Errorf("category = %q, want skill", a.Category)
		}
		if !a.IsPublic {
			t.Errorf("isPublic = %v, want true", a.IsPublic)
		}
		abilityID = a.ID
	})
	defer func() {
		if abilityID != "" {
			env.DB.Exec(context.Background(), "DELETE FROM ability_points WHERE id = $1", abilityID)
		}
	}()

	if abilityID == "" {
		t.Fatal("no created ability ID, skipping remaining tests")
	}

	t.Run("List", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/job/abilities", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.AbilityPoint](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total < 1 {
			t.Errorf("total = %d, want > 0", total)
		}
		if len(items) < 1 {
			t.Errorf("items length = %d, want > 0", len(items))
		}
	})

	t.Run("List_WithFilter", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/job/abilities?category=skill&search=Test", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.AbilityPoint](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total < 1 {
			t.Errorf("filtered total = %d, want > 0", total)
		}
		_ = items
	})

	t.Run("Get", func(t *testing.T) {
		w := env.Do("GET", fmt.Sprintf("/api/v1/job/abilities/%s", abilityID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		a, err := testhelper.Unmarshal[domain.AbilityPoint](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if a.ID != abilityID {
			t.Errorf("ID = %q, want %q", a.ID, abilityID)
		}
	})

	t.Run("Update", func(t *testing.T) {
		body := map[string]interface{}{
			"name":     "Updated Ability",
			"category": "knowledge",
			"isPublic": false,
		}
		w := env.Do("PUT", fmt.Sprintf("/api/v1/job/abilities/%s", abilityID), body)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		a, err := testhelper.Unmarshal[domain.AbilityPoint](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if a.Name != "Updated Ability" {
			t.Errorf("name = %q, want %q", a.Name, "Updated Ability")
		}
		if string(a.Category) != "knowledge" {
			t.Errorf("category = %q, want knowledge", a.Category)
		}
	})

	t.Run("Delete", func(t *testing.T) {
		w := env.Do("DELETE", fmt.Sprintf("/api/v1/job/abilities/%s", abilityID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		abilityID = ""
	})
}

func TestAbilityDomain_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	posBody := map[string]interface{}{
		"name":         "Domain Test Position",
		"positionType": "enterprise",
		"version":      "v1.0",
	}
	w := env.Do("POST", "/api/v1/job/positions", posBody)
	if w.Code != http.StatusCreated {
		t.Fatalf("create position: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
	if err != nil {
		t.Fatalf("unmarshal position: %v", err)
	}
	positionID := pos.ID
	defer env.DB.Exec(context.Background(), "DELETE FROM career_positions WHERE id = $1", positionID)

	abilityBody := map[string]interface{}{
		"name":     "Domain Ability",
		"category": "skill",
		"isPublic": true,
	}
	w = env.Do("POST", "/api/v1/job/abilities", abilityBody)
	if w.Code != http.StatusCreated {
		t.Fatalf("create ability: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	ability, err := testhelper.Unmarshal[domain.AbilityPoint](w)
	if err != nil {
		t.Fatalf("unmarshal ability: %v", err)
	}
	abilityID := ability.ID
	defer env.DB.Exec(context.Background(), "DELETE FROM ability_points WHERE id = $1", abilityID)

	var domainID string

	t.Run("Create", func(t *testing.T) {
		body := map[string]interface{}{
			"careerPositionId": positionID,
			"name":             "Test Domain",
			"bindingIds":       []string{abilityID},
		}
		w := env.Do("POST", "/api/v1/job/ability-domains", body)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		d, err := testhelper.Unmarshal[domain.AbilityDomain](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if d.Name != "Test Domain" {
			t.Errorf("name = %q, want %q", d.Name, "Test Domain")
		}
		if d.CareerPositionID != positionID {
			t.Errorf("careerPositionId = %q, want %q", d.CareerPositionID, positionID)
		}
		domainID = d.ID
	})
	defer func() {
		if domainID != "" {
			env.DB.Exec(context.Background(), "DELETE FROM ability_domains WHERE id = $1", domainID)
		}
	}()

	if domainID == "" {
		t.Fatal("no created domain ID, skipping remaining tests")
	}

	t.Run("List", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/job/ability-domains", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.AbilityDomain](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total < 1 {
			t.Errorf("total = %d, want > 0", total)
		}
		_ = items
	})

	t.Run("Update", func(t *testing.T) {
		body := map[string]interface{}{
			"careerPositionId": positionID,
			"name":             "Updated Domain",
			"bindingIds":       []string{abilityID},
			"sortOrder":        1,
		}
		w := env.Do("PUT", fmt.Sprintf("/api/v1/job/ability-domains/%s", domainID), body)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		d, err := testhelper.Unmarshal[domain.AbilityDomain](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if d.Name != "Updated Domain" {
			t.Errorf("name = %q, want %q", d.Name, "Updated Domain")
		}
	})

	t.Run("Delete", func(t *testing.T) {
		w := env.Do("DELETE", fmt.Sprintf("/api/v1/job/ability-domains/%s", domainID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		domainID = ""
	})
}

func TestJobBatch_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	var batchID string

	t.Run("Create", func(t *testing.T) {
		body := map[string]interface{}{
			"name": "Test Batch",
		}
		w := env.Do("POST", "/api/v1/job/batches", body)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		b, err := testhelper.Unmarshal[domain.JobBatch](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if b.Name != "Test Batch" {
			t.Errorf("name = %q, want %q", b.Name, "Test Batch")
		}
		batchID = b.ID
	})
	defer func() {
		if batchID != "" {
			env.DB.Exec(context.Background(), "DELETE FROM batches WHERE id = $1", batchID)
		}
	}()

	if batchID == "" {
		t.Fatal("no created batch ID, skipping remaining tests")
	}

	t.Run("List", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/job/batches", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.JobBatch](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total < 1 {
			t.Errorf("total = %d, want > 0", total)
		}
		_ = items
	})

	t.Run("Get", func(t *testing.T) {
		w := env.Do("GET", fmt.Sprintf("/api/v1/job/batches/%s", batchID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		b, err := testhelper.Unmarshal[domain.JobBatch](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if b.ID != batchID {
			t.Errorf("ID = %q, want %q", b.ID, batchID)
		}
	})

	t.Run("Update", func(t *testing.T) {
		body := map[string]interface{}{
			"name": "Updated Batch",
		}
		w := env.Do("PUT", fmt.Sprintf("/api/v1/job/batches/%s", batchID), body)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		b, err := testhelper.Unmarshal[domain.JobBatch](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if b.Name != "Updated Batch" {
			t.Errorf("name = %q, want %q", b.Name, "Updated Batch")
		}
	})

	t.Run("UpdateStatus", func(t *testing.T) {
		body := map[string]interface{}{
			"status": "closed",
		}
		w := env.Do("POST", fmt.Sprintf("/api/v1/job/batches/%s/status", batchID), body)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		b, err := testhelper.Unmarshal[domain.JobBatch](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if string(b.Status) != "closed" {
			t.Errorf("status = %q, want closed", b.Status)
		}
	})

	t.Run("Delete", func(t *testing.T) {
		w := env.Do("DELETE", fmt.Sprintf("/api/v1/job/batches/%s", batchID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		batchID = ""
	})
}

func TestRecommend_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	var majorID string
	if err := env.DB.QueryRow(context.Background(), `
		INSERT INTO majors (tenant_id, code, name, enabled) VALUES ($1, $2, $3, true) RETURNING id
	`, testhelper.TestTenantID, "rec-test-major", "Rec Test Major").Scan(&majorID); err != nil {
		t.Fatalf("create major: %v", err)
	}
	defer env.DB.Exec(context.Background(), "DELETE FROM majors WHERE id = $1", majorID)

	posBody := map[string]interface{}{
		"name":         "Recommend Test Position",
		"positionType": "enterprise",
		"version":      "v1.0",
	}
	w := env.Do("POST", "/api/v1/job/positions", posBody)
	if w.Code != http.StatusCreated {
		t.Fatalf("create position: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
	}
	pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
	if err != nil {
		t.Fatalf("unmarshal position: %v", err)
	}
	positionID := pos.ID
	defer env.DB.Exec(context.Background(), "DELETE FROM career_positions WHERE id = $1", positionID)

	var recID string

	t.Run("Create", func(t *testing.T) {
		body := map[string]interface{}{
			"careerPositionId": positionID,
			"positionType":     "enterprise",
			"majorId":          majorID,
		}
		w := env.Do("POST", "/api/v1/job/recommendations", body)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		rec, err := testhelper.Unmarshal[domain.PositionRecommendation](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if rec.CareerPositionID != positionID {
			t.Errorf("careerPositionId = %q, want %q", rec.CareerPositionID, positionID)
		}
		recID = rec.ID
	})
	defer func() {
		if recID != "" {
			env.DB.Exec(context.Background(), "DELETE FROM position_recommendations WHERE id = $1", recID)
		}
	}()

	if recID == "" {
		t.Fatal("no created recommendation ID, skipping remaining tests")
	}

	t.Run("List", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/job/recommendations", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.PositionRecommendation](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total < 1 {
			t.Errorf("total = %d, want > 0", total)
		}
		_ = items
	})

	t.Run("Update", func(t *testing.T) {
		body := map[string]interface{}{
			"careerPositionId": positionID,
			"positionType":     "enterprise",
			"majorId":          majorID,
		}
		w := env.Do("PUT", fmt.Sprintf("/api/v1/job/recommendations/%s", recID), body)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		rec, err := testhelper.Unmarshal[domain.PositionRecommendation](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		_ = rec
	})

	t.Run("Delete", func(t *testing.T) {
		w := env.Do("DELETE", fmt.Sprintf("/api/v1/job/recommendations/%s", recID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		recID = ""
	})
}

func TestLearnRoad_CRUD(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()

	var roadID string

	t.Run("Create", func(t *testing.T) {
		body := map[string]interface{}{
			"name":        "Test Road",
			"positionIds": []string{"pos-1"},
			"steps":       []interface{}{},
		}
		w := env.Do("POST", "/api/v1/job/learn-roads", body)
		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		r, err := testhelper.Unmarshal[domain.LearnRoad](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if r.Name != "Test Road" {
			t.Errorf("name = %q, want %q", r.Name, "Test Road")
		}
		if len(r.PositionIDs) != 1 {
			t.Errorf("positionIds length = %d, want 1", len(r.PositionIDs))
		}
		roadID = r.ID
	})
	defer func() {
		if roadID != "" {
			env.DB.Exec(context.Background(), "DELETE FROM learn_roads WHERE id = $1", roadID)
		}
	}()

	if roadID == "" {
		t.Fatal("no created learn road ID, skipping remaining tests")
	}

	t.Run("List", func(t *testing.T) {
		w := env.Do("GET", "/api/v1/job/learn-roads", nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		items, total, err := testhelper.UnmarshalList[domain.LearnRoad](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if total < 1 {
			t.Errorf("total = %d, want > 0", total)
		}
		_ = items
	})

	t.Run("Get", func(t *testing.T) {
		w := env.Do("GET", fmt.Sprintf("/api/v1/job/learn-roads/%s", roadID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		r, err := testhelper.Unmarshal[domain.LearnRoad](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if r.ID != roadID {
			t.Errorf("ID = %q, want %q", r.ID, roadID)
		}
	})

	t.Run("Update", func(t *testing.T) {
		body := map[string]interface{}{
			"name":        "Updated Road",
			"positionIds": []string{"pos-1", "pos-2"},
			"steps":       []interface{}{},
		}
		w := env.Do("PUT", fmt.Sprintf("/api/v1/job/learn-roads/%s", roadID), body)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		r, err := testhelper.Unmarshal[domain.LearnRoad](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if r.Name != "Updated Road" {
			t.Errorf("name = %q, want %q", r.Name, "Updated Road")
		}
	})

	t.Run("Delete", func(t *testing.T) {
		w := env.Do("DELETE", fmt.Sprintf("/api/v1/job/learn-roads/%s", roadID), nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		roadID = ""
	})
}
