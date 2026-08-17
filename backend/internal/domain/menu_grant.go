package domain

// MenuGrant 用户合并后的菜单授权视图（菜单驱动 RBAC，见 ADR-0008）。
// 由全部角色的 permissions.menus 合并而来：GrantedPaths 为 granted=true 的
// 菜单路径集合；Admin 为任一角色权限含 admin:true 的全量标记。
type MenuGrant struct {
	GrantedPaths map[string]bool
	Admin        bool
}

// Merge 将单个角色的权限并入授权视图：
//   - permissions.menus 中 granted=true 的路径并入 GrantedPaths；
//   - permissions.admin=true 置 Admin 标记。
func (g *MenuGrant) Merge(perms JSONMap) {
	if perms == nil {
		return
	}
	if v, ok := perms["admin"].(bool); ok && v {
		g.Admin = true
	}
	menus, ok := perms["menus"].(map[string]interface{})
	if !ok {
		return
	}
	for path, granted := range menus {
		if v, ok := granted.(bool); ok && v {
			g.GrantedPaths[path] = true
		}
	}
}

// Covers 判定授权视图是否覆盖所需菜单路径（菜单树同链匹配）：
//   - Admin 全量放行；
//   - 已授权路径与所需路径相等、互为祖先/子孙（同一条菜单链）即视为已授权，
//     与前端 checkMenuPermission 的「子路径继承最近已授权父菜单」语义一致
//     （如勾选 /portal/apps/alliance/brands 即授权 brands/employer 子页 API）。
func (g *MenuGrant) Covers(menuPath string) bool {
	if g == nil {
		return false
	}
	if g.Admin {
		return true
	}
	if len(g.GrantedPaths) == 0 {
		return false
	}
	need := normalizeMenuPath(menuPath)
	for p := range g.GrantedPaths {
		if sameMenuChain(normalizeMenuPath(p), need) {
			return true
		}
	}
	return false
}

// CoversPrefix 判定授权视图是否覆盖指定路径前缀下的任一菜单（含前缀本身），
// 用于模块级授权判断（如联盟管理面 = 任一 /portal/apps/alliance 菜单）。
func (g *MenuGrant) CoversPrefix(prefix string) bool {
	if g == nil {
		return false
	}
	if g.Admin {
		return true
	}
	need := normalizeMenuPath(prefix)
	for p := range g.GrantedPaths {
		q := normalizeMenuPath(p)
		if q == need || hasPathPrefix(q, need) || hasPathPrefix(need, q) {
			return true
		}
	}
	return false
}

// Empty 报告授权视图是否完全为空（无任何已授权路径且非 Admin）。
func (g *MenuGrant) Empty() bool {
	return g == nil || (!g.Admin && len(g.GrantedPaths) == 0)
}

// normalizeMenuPath 去除查询串/尾部斜杠，与前端 normalizeMenuPath 对齐。
func normalizeMenuPath(path string) string {
	clean := path
	if i := indexAnyByte(clean, "?#"); i >= 0 {
		clean = clean[:i]
	}
	if len(clean) > 1 && clean[len(clean)-1] == '/' {
		clean = clean[:len(clean)-1]
	}
	return clean
}

func indexAnyByte(s string, chars string) int {
	for i := 0; i < len(s); i++ {
		for j := 0; j < len(chars); j++ {
			if s[i] == chars[j] {
				return i
			}
		}
	}
	return -1
}

// sameMenuChain 判定两个菜单路径是否在同一条菜单链上（相等或互为祖先/子孙）。
func sameMenuChain(a, b string) bool {
	return a == b || hasPathPrefix(a, b) || hasPathPrefix(b, a)
}

// hasPathPrefix 判定 sub 是否为 prefix 的路径子孙（按段前缀，防 /job/positions2 误匹配 /job/positions）。
func hasPathPrefix(sub, prefix string) bool {
	if prefix == "" || prefix == "/" {
		return true
	}
	if sub == prefix {
		return true
	}
	if len(sub) <= len(prefix) {
		return false
	}
	if sub[len(prefix)] != '/' {
		return false
	}
	return sub[:len(prefix)] == prefix
}
