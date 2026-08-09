package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestFavorites_SceneToggleAndList 回归验证通用收藏：
// 1. 收藏场景后 isFavorite/favoriteCount 正确返回；
// 2. 收藏列表按类型返回收藏实体（仅已发布）；
// 3. 再次切换取消收藏，列表不再包含；
// 4. 非法类型返回 400，未登录返回 401。
func TestFavorites_SceneToggleAndList(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	studentID := "cccccccc-cccc-cccc-cccc-cccccccccc02"
	studentToken := env.NewUserToken(studentID, testhelper.TestTenantID, domain.UserRoleEnterprise, nil)

	var sceneID string

	t.Run("CreateAndPublishScene", func(t *testing.T) {
		w := env.Do("POST", "/api/v1/scene/scenarios", map[string]interface{}{
			"name":       "Favorites Regression Scene",
			"version":    "v1.0",
			"difficulty": 3,
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create scene: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		sc, err := testhelper.Unmarshal[domain.Scenario](w)
		if err != nil {
			t.Fatalf("unmarshal scene: %v", err)
		}
		sceneID = sc.ID

		// 发布需走完整流转：draft → pending → approved → published
		if w := env.Do("POST", fmt.Sprintf("/api/v1/scene/scenarios/%s/submit", sceneID), nil); w.Code != http.StatusOK {
			t.Fatalf("submit scene: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		if w := env.Do("POST", fmt.Sprintf("/api/v1/scene/scenarios/%s/review", sceneID), map[string]string{"status": "approved"}); w.Code != http.StatusOK {
			t.Fatalf("approve scene: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		if w := env.Do("POST", fmt.Sprintf("/api/v1/scene/scenarios/%s/publish", sceneID), nil); w.Code != http.StatusOK {
			t.Fatalf("publish scene: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})
	defer func() {
		if sceneID != "" {
			env.DB.Exec(ctx, "DELETE FROM user_favorites WHERE target_type = 'scene' AND target_id = $1", sceneID)
			env.DB.Exec(ctx, "DELETE FROM favorite_counters WHERE target_type = 'scene' AND target_id = $1", sceneID)
			env.DB.Exec(ctx, "DELETE FROM scenarios WHERE id = $1", sceneID)
		}
	}()

	t.Run("ToggleAndCheckStatus", func(t *testing.T) {
		w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/favorites/scene/%s", sceneID), nil, studentToken)
		if w.Code != http.StatusOK {
			t.Fatalf("favorite scene: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		resp, err := testhelper.Unmarshal[map[string]interface{}](w)
		if err != nil {
			t.Fatalf("unmarshal favorite resp: %v", err)
		}
		if resp["isFavorite"] != true {
			t.Fatalf("expected isFavorite=true, got %v", resp["isFavorite"])
		}
		if resp["favoriteCount"] == nil || int(resp["favoriteCount"].(float64)) != 1 {
			t.Fatalf("expected favoriteCount=1, got %v", resp["favoriteCount"])
		}

		wGet := env.DoWithToken("GET", fmt.Sprintf("/api/v1/favorites/scene/%s", sceneID), nil, studentToken)
		if wGet.Code != http.StatusOK {
			t.Fatalf("get favorite status: expected 200, got %d: %s", wGet.Code, testhelper.ErrMsg(wGet))
		}
		status, err := testhelper.Unmarshal[map[string]interface{}](wGet)
		if err != nil {
			t.Fatalf("unmarshal status: %v", err)
		}
		if status["isFavorite"] != true {
			t.Fatalf("expected isFavorite=true from status, got %v", status["isFavorite"])
		}
	})

	t.Run("ListContainsScene", func(t *testing.T) {
		w := env.DoWithToken("GET", "/api/v1/favorites", nil, studentToken)
		if w.Code != http.StatusOK {
			t.Fatalf("list favorites: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		body, err := testhelper.Unmarshal[map[string]interface{}](w)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		scenes, ok := body["scene"].([]interface{})
		if !ok {
			t.Fatalf("expected scene array in list, got %v", body["scene"])
		}
		found := false
		for _, item := range scenes {
			m := item.(map[string]interface{})
			if m["id"] == sceneID {
				found = true
				if m["name"] != "Favorites Regression Scene" {
					t.Fatalf("expected scene name in favorite list, got %v", m["name"])
				}
			}
		}
		if !found {
			t.Fatalf("scene %s missing from favorites list", sceneID)
		}
	})

	t.Run("UntoggleRemovesFromList", func(t *testing.T) {
		w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/favorites/scene/%s", sceneID), nil, studentToken)
		if w.Code != http.StatusOK {
			t.Fatalf("unfavorite scene: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		resp, err := testhelper.Unmarshal[map[string]interface{}](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		if resp["isFavorite"] != false {
			t.Fatalf("expected isFavorite=false after untoggle, got %v", resp["isFavorite"])
		}

		wList := env.DoWithToken("GET", "/api/v1/favorites", nil, studentToken)
		body, err := testhelper.Unmarshal[map[string]interface{}](wList)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		if scenes, ok := body["scene"].([]interface{}); ok && len(scenes) != 0 {
			t.Fatalf("expected empty scene favorites after untoggle, got %d items", len(scenes))
		}
	})

	t.Run("InvalidTypeRejected", func(t *testing.T) {
		w := env.DoWithToken("POST", "/api/v1/favorites/unknown_type/123", nil, studentToken)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("invalid type: expected 400, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})

	t.Run("UnauthorizedRejected", func(t *testing.T) {
		w := env.DoNoAuth("GET", "/api/v1/favorites", nil)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("no auth: expected 401, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})
}
