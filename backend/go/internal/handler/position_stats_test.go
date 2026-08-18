package handler_test

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

// TestPosition_FavoriteAndViewStats 回归验证前台岗位统计：
// 1. 收藏岗位后 favoriteCount 计数并出现在公开列表/排行榜数据中；
// 2. 前台详情页（PublicGet）访问会记录浏览计数，viewCount 递增。
func TestPosition_FavoriteAndViewStats(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	studentID := "cccccccc-cccc-cccc-cccc-cccccccccc01"
	studentToken := env.NewUserToken(studentID, testhelper.TestTenantID, domain.UserRoleEnterprise, nil)

	var positionID string

	t.Run("CreateAndPublish", func(t *testing.T) {
		w := env.Do("POST", "/api/v1/job/positions", map[string]interface{}{
			"name":         "Stats Regression Position",
			"positionType": "enterprise",
			"version":      "v1.0",
		})
		if w.Code != http.StatusCreated {
			t.Fatalf("create: expected 201, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		pos, err := testhelper.Unmarshal[domain.CareerPosition](w)
		if err != nil {
			t.Fatalf("unmarshal: %v", err)
		}
		positionID = pos.ID
		if pos.ViewCount != 0 || pos.FavoriteCount != 0 {
			t.Fatalf("new position should have zero stats, got view=%d fav=%d", pos.ViewCount, pos.FavoriteCount)
		}

		if w := env.Do("POST", fmt.Sprintf("/api/v1/job/positions/%s/submit", positionID), nil); w.Code != http.StatusOK {
			t.Fatalf("submit: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		if w := env.Do("POST", fmt.Sprintf("/api/v1/job/positions/%s/review", positionID), map[string]interface{}{"status": "approved"}); w.Code != http.StatusOK {
			t.Fatalf("review: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		if w := env.Do("POST", fmt.Sprintf("/api/v1/job/positions/%s/publish", positionID), nil); w.Code != http.StatusOK {
			t.Fatalf("publish: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
	})
	defer func() {
		if positionID != "" {
			env.DB.Exec(ctx, "DELETE FROM position_favorites WHERE career_position_id = $1", positionID)
			env.DB.Exec(ctx, "DELETE FROM favorite_counters WHERE target_type = 'career_position' AND target_id = $1", positionID)
			env.DB.Exec(ctx, "DELETE FROM view_logs WHERE target_type = 'career_position' AND target_id = $1", positionID)
			env.DB.Exec(ctx, "DELETE FROM view_counters WHERE target_type = 'career_position' AND target_id = $1", positionID)
			env.DB.Exec(ctx, "DELETE FROM career_positions WHERE id = $1", positionID)
		}
	}()

	t.Run("FavoriteIncrementsCountAndAppearsInPublicList", func(t *testing.T) {
		w := env.DoWithToken("POST", fmt.Sprintf("/api/v1/job/positions/%s/favorite", positionID), nil, studentToken)
		if w.Code != http.StatusOK {
			t.Fatalf("favorite: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
		}
		resp, err := testhelper.Unmarshal[map[string]interface{}](w)
		if err != nil {
			t.Fatalf("unmarshal favorite resp: %v", err)
		}
		if resp["isFavorite"] != true {
			t.Fatalf("expected isFavorite=true, got %v", resp["isFavorite"])
		}
		if resp["favoriteCount"] == nil || int(resp["favoriteCount"].(float64)) != 1 {
			t.Fatalf("expected favoriteCount=1 in response, got %v", resp["favoriteCount"])
		}

		wList := env.Do("GET", "/api/v1/job/public/positions?limit=200", nil)
		if wList.Code != http.StatusOK {
			t.Fatalf("public list: expected 200, got %d: %s", wList.Code, testhelper.ErrMsg(wList))
		}
		items, _, err := testhelper.UnmarshalList[domain.CareerPosition](wList)
		if err != nil {
			t.Fatalf("unmarshal list: %v", err)
		}
		for _, p := range items {
			if p.ID == positionID {
				if p.FavoriteCount != 1 {
					t.Fatalf("public list favoriteCount = %d, want 1", p.FavoriteCount)
				}
				return
			}
		}
		t.Fatalf("position %s missing from public list", positionID)
	})

	t.Run("PublicGetRecordsView", func(t *testing.T) {
		for i := 0; i < 3; i++ {
			w := env.DoWithToken("GET", fmt.Sprintf("/api/v1/job/public/positions/%s", positionID), nil, studentToken)
			if w.Code != http.StatusOK {
				t.Fatalf("public get: expected 200, got %d: %s", w.Code, testhelper.ErrMsg(w))
			}
		}
		// 视图计数异步记录，轮询等待落库
		var got int
		for i := 0; i < 20; i++ {
			var cnt int
			env.DB.QueryRow(ctx, `
				SELECT COALESCE(cnt, 0) FROM view_counters
				WHERE target_type = 'career_position' AND target_id = $1
			`, positionID).Scan(&cnt)
			got = cnt
			if got >= 3 {
				break
			}
			time.Sleep(50 * time.Millisecond)
		}
		if got < 3 {
			t.Fatalf("expected viewCount >= 3 after 3 PublicGet visits, got %d", got)
		}
	})
}
