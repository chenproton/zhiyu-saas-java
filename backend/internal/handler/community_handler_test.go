package handler_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/zhiyu-saas/backend/internal/domain"
	"github.com/zhiyu-saas/backend/internal/handler/testhelper"
)

func createCommunityUser(t *testing.T, env *testhelper.TestEnv, name string) (userID, token string) {
	t.Helper()
	userID = createPortalUser(t, env, "community-"+uuid.NewString()[:8], "pass1234")
	_, _ = env.DB.Exec(context.Background(), "UPDATE users SET name = $1 WHERE id = $2", name, userID)
	token = env.NewTokenWithIdentity(userID, testhelper.TestTenantID, domain.UserRoleSchool, nil, "student")
	return userID, token
}

func TestCommunity_CreateTopicAndList(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	userID, token := createCommunityUser(t, env, "王小明")
	defer env.DB.Exec(ctx, "DELETE FROM community_replies WHERE topic_id IN (SELECT id FROM community_topics WHERE author_id = $1)", userID)
	defer env.DB.Exec(ctx, "DELETE FROM community_topics WHERE author_id = $1", userID)

	// 空标题 → 400
	w := env.DoWithToken("POST", "/api/v1/portal/community/topics", map[string]interface{}{
		"title": "  ", "content": "内容",
	}, token)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("empty title: expected 400, got %d %s", w.Code, testhelper.ErrMsg(w))
	}

	// 正常发帖
	w = env.DoWithToken("POST", "/api/v1/portal/community/topics", map[string]interface{}{
		"title": "网络配置疑问", "content": "交换机 VLAN 划分如何配置？", "tag": "网络技术",
	}, token)
	if w.Code != http.StatusOK {
		t.Fatalf("create topic: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	created, err := testhelper.Unmarshal[map[string]string](w)
	if err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	topicID := created["id"]
	if topicID == "" {
		t.Fatal("missing topic id")
	}

	// 列表 latest：按时间流展示本人话题
	items, total, err := testhelper.UnmarshalList[domain.CommunityTopic](
		env.DoWithToken("GET", "/api/v1/portal/community/topics?sort=latest", nil, token))
	if err != nil {
		t.Fatalf("list topics: %v", err)
	}
	if total < 1 || len(items) == 0 {
		t.Fatalf("expected topics, got total=%d items=%d", total, len(items))
	}
	found := false
	for _, it := range items {
		if it.ID == topicID {
			found = true
			if it.AuthorName != "王小明" {
				t.Fatalf("author name = %s, want 王小明", it.AuthorName)
			}
			if !it.IsMine {
				t.Fatal("own topic should be marked isMine")
			}
			if it.Title != "网络配置疑问" || it.Tag != "网络技术" {
				t.Fatalf("topic fields mismatch: %+v", it)
			}
		}
	}
	if !found {
		t.Fatal("created topic not in latest list")
	}

	// 我的提问过滤
	_, mineTotal, err := testhelper.UnmarshalList[domain.CommunityTopic](
		env.DoWithToken("GET", "/api/v1/portal/community/topics?sort=mine", nil, token))
	if err != nil {
		t.Fatalf("list mine: %v", err)
	}
	if mineTotal != 1 {
		t.Fatalf("mine total = %d, want 1", mineTotal)
	}
}

func TestCommunity_GetTopicBumpsViewCount(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	userID, token := createCommunityUser(t, env, "李雷")
	defer env.DB.Exec(ctx, "DELETE FROM community_topics WHERE author_id = $1", userID)

	w := env.DoWithToken("POST", "/api/v1/portal/community/topics", map[string]interface{}{
		"title": "阅读数测试", "content": "内容",
	}, token)
	created, _ := testhelper.Unmarshal[map[string]string](w)
	topicID := created["id"]

	for i := 1; i <= 2; i++ {
		w = env.DoWithToken("GET", "/api/v1/portal/community/topics/"+topicID, nil, token)
		if w.Code != http.StatusOK {
			t.Fatalf("get topic #%d: %d %s", i, w.Code, testhelper.ErrMsg(w))
		}
		topic, err := testhelper.Unmarshal[domain.CommunityTopic](w)
		if err != nil {
			t.Fatalf("unmarshal topic: %v", err)
		}
		if topic.ViewCount != i {
			t.Fatalf("view count after %d view(s) = %d, want %d", i, topic.ViewCount, i)
		}
	}
}

func TestCommunity_Replies(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	userID, token := createCommunityUser(t, env, "韩梅梅")
	otherUserID, otherToken := createCommunityUser(t, env, "赵四")
	defer env.DB.Exec(ctx, "DELETE FROM community_replies WHERE topic_id IN (SELECT id FROM community_topics WHERE author_id IN ($1, $2))", userID, otherUserID)
	defer env.DB.Exec(ctx, "DELETE FROM community_topics WHERE author_id IN ($1, $2)", userID, otherUserID)

	// 空回复 → 400
	w := env.DoWithToken("POST", "/api/v1/portal/community/topics/00000000-0000-0000-0000-000000000000/replies", map[string]interface{}{
		"content": " ",
	}, token)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("empty reply: expected 400, got %d", w.Code)
	}

	// 不存在的话题回复 → 404
	w = env.DoWithToken("POST", "/api/v1/portal/community/topics/00000000-0000-0000-0000-000000000000/replies", map[string]interface{}{
		"content": "你好",
	}, token)
	if w.Code != http.StatusNotFound {
		t.Fatalf("reply to missing topic: expected 404, got %d", w.Code)
	}

	// 发帖 + 两条回复（直接回复 + 回复评论）
	w = env.DoWithToken("POST", "/api/v1/portal/community/topics", map[string]interface{}{
		"title": "回复测试", "content": "正文",
	}, token)
	created, _ := testhelper.Unmarshal[map[string]string](w)
	topicID := created["id"]

	w = env.DoWithToken("POST", "/api/v1/portal/community/topics/"+topicID+"/replies", map[string]interface{}{
		"content": "第一条回复",
	}, otherToken)
	if w.Code != http.StatusOK {
		t.Fatalf("create reply: %d %s", w.Code, testhelper.ErrMsg(w))
	}
	replyCreated, _ := testhelper.Unmarshal[map[string]string](w)
	replyID := replyCreated["id"]

	// 回复一条评论（parentId 指向他人回复）
	w = env.DoWithToken("POST", "/api/v1/portal/community/topics/"+topicID+"/replies", map[string]interface{}{
		"content":  "回复赵四的评论",
		"parentId": replyID,
	}, token)
	if w.Code != http.StatusOK {
		t.Fatalf("create sub reply: %d %s", w.Code, testhelper.ErrMsg(w))
	}

	// 回复列表：两条，第二条带 parent 作者
	replies, total, err := testhelper.UnmarshalList[domain.CommunityReply](
		env.DoWithToken("GET", "/api/v1/portal/community/topics/"+topicID+"/replies", nil, token))
	if err != nil {
		t.Fatalf("list replies: %v", err)
	}
	if total != 2 || len(replies) != 2 {
		t.Fatalf("replies total = %d/%d, want 2", total, len(replies))
	}
	first, second := replies[0], replies[1]
	if first.ParentID != nil || first.AuthorName != "赵四" || first.IsMine {
		t.Fatalf("first reply mismatch: %+v", first)
	}
	if second.ParentID == nil || *second.ParentID != replyID {
		t.Fatalf("second reply parentId mismatch: %+v", second)
	}
	if second.ParentAuthorName != "赵四" || !second.IsMine {
		t.Fatalf("second reply author mismatch: %+v", second)
	}

	// 帖子回复数已递增
	topic, _ := testhelper.Unmarshal[domain.CommunityTopic](
		env.DoWithToken("GET", "/api/v1/portal/community/topics/"+topicID, nil, token))
	if topic.ReplyCount != 2 {
		t.Fatalf("topic reply count = %d, want 2", topic.ReplyCount)
	}

	// 热门排序：回复数不影响，但查看详情后阅读数 +1，热门列表应在最前
	items, _, _ := testhelper.UnmarshalList[domain.CommunityTopic](
		env.DoWithToken("GET", "/api/v1/portal/community/topics?sort=hot", nil, token))
	if len(items) == 0 || items[0].ID != topicID {
		t.Fatalf("hot list first = %+v, want topic %s", items, topicID)
	}
}

func TestCommunity_TenantIsolation(t *testing.T) {
	env := testhelper.SetupTestEnv(t)
	defer env.Cleanup()
	ctx := context.Background()

	userID, token := createCommunityUser(t, env, "本校学生")
	defer env.DB.Exec(ctx, "DELETE FROM community_topics WHERE author_id = $1", userID)

	w := env.DoWithToken("POST", "/api/v1/portal/community/topics", map[string]interface{}{
		"title": "隔离测试", "content": "内容",
	}, token)
	created, _ := testhelper.Unmarshal[map[string]string](w)
	topicID := created["id"]

	// 其他租户用户无法查看该话题
	otherTenantID := uuid.NewString()
	otherUserID := uuid.NewString()
	_, err := env.DB.Exec(ctx, `
		INSERT INTO tenants (id, name, code) VALUES ($1, '测试租户B', $2)
	`, otherTenantID, "test-tenant-b-"+uuid.NewString()[:6])
	if err != nil {
		t.Fatalf("insert other tenant: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM tenants WHERE id = $1", otherTenantID)
	_, err = env.DB.Exec(ctx, `
		INSERT INTO users (id, tenant_id, role, platform, username, login_name, password_hash, name, status, title_ids)
		VALUES ($1, $2, 'school', 'portal', 'other-tenant', 'other-tenant', 'x', '外校学生', 'active', '{}')
	`, otherUserID, otherTenantID)
	if err != nil {
		t.Fatalf("insert other tenant user: %v", err)
	}
	defer env.DB.Exec(ctx, "DELETE FROM users WHERE id = $1", otherUserID)
	otherToken := env.NewTokenWithIdentity(otherUserID, otherTenantID, domain.UserRoleSchool, nil, "student")

	w = env.DoWithToken("GET", "/api/v1/portal/community/topics/"+topicID, nil, otherToken)
	if w.Code != http.StatusNotFound {
		t.Fatalf("other tenant get topic: expected 404, got %d %s", w.Code, testhelper.ErrMsg(w))
	}
	_, otherTotal, err := testhelper.UnmarshalList[domain.CommunityTopic](
		env.DoWithToken("GET", "/api/v1/portal/community/topics?sort=latest", nil, otherToken))
	if err != nil {
		t.Fatalf("other tenant list: %v", err)
	}
	if otherTotal != 0 {
		t.Fatalf("other tenant total = %d, want 0", otherTotal)
	}
}
