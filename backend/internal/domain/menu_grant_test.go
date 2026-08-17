package domain

import "testing"

func TestMenuGrant_MergeAndCovers(t *testing.T) {
	t.Run("合并多个角色 menus 并集", func(t *testing.T) {
		g := &MenuGrant{GrantedPaths: map[string]bool{}}
		g.Merge(JSONMap{"menus": map[string]interface{}{
			"/job/positions": true, "/job/batches": false,
		}})
		g.Merge(JSONMap{"menus": map[string]interface{}{
			"/library/landing": true, "/job/positions": true,
		}})
		if !g.Covers("/job/positions") || !g.Covers("/library/landing") {
			t.Fatalf("应覆盖两个角色勾选的菜单, got %v", g.GrantedPaths)
		}
		if g.Covers("/job/batches") {
			t.Fatal("false 勾选不应授权")
		}
	})

	t.Run("admin 标记全量放行", func(t *testing.T) {
		g := &MenuGrant{GrantedPaths: map[string]bool{}}
		g.Merge(JSONMap{"admin": true})
		if !g.Covers("/anything/unknown") {
			t.Fatal("admin 应全量放行")
		}
		if g.Empty() {
			t.Fatal("admin 视图不应视为空")
		}
	})

	t.Run("空视图拒绝", func(t *testing.T) {
		g := &MenuGrant{GrantedPaths: map[string]bool{}}
		if g.Covers("/job/landing") {
			t.Fatal("空视图应拒绝")
		}
		if !g.Empty() {
			t.Fatal("空视图应 Empty")
		}
		if g.Covers("") {
			t.Fatal("空视图连空路径也不应放行")
		}
	})
}

func TestMenuGrant_CoversMenuChain(t *testing.T) {
	cases := []struct {
		name    string
		granted string
		need    string
		want    bool
	}{
		{"精确匹配", "/portal/apps/alliance/brands", "/portal/apps/alliance/brands", true},
		{"父菜单授权子菜单", "/portal/apps/alliance/brands", "/portal/apps/alliance/brands/employer", true},
		{"子菜单授权父 API", "/portal/apps/alliance/brands/employer", "/portal/apps/alliance/brands", true},
		{"前缀相似不误匹配", "/job/positions", "/job/positions2", false},
		{"无关路径拒绝", "/job/positions", "/library/landing", false},
		{"根路径", "/portal/workspace", "/portal/workspace", true},
		{"尾斜杠归一", "/portal/apps/alliance/brands/", "/portal/apps/alliance/brands", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			g := &MenuGrant{GrantedPaths: map[string]bool{tc.granted: true}}
			if got := g.Covers(tc.need); got != tc.want {
				t.Fatalf("Covers(%q) = %v, want %v", tc.need, got, tc.want)
			}
		})
	}
}

func TestMenuGrant_NilSafety(t *testing.T) {
	var g *MenuGrant
	if g.Covers("/job/landing") {
		t.Fatal("nil 视图应拒绝")
	}
	if !g.Empty() {
		t.Fatal("nil 视图应 Empty")
	}
}
