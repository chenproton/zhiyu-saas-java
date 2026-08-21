package org.dromara.zhiyu.core.security;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * 用户合并后的菜单授权视图（菜单驱动 RBAC，对齐 Go domain/menu_grant.go，见 ADR-0008）。
 *
 * <p>由全部角色的 permissions.menus 合并而来：grantedPaths 为 granted=true 的
 * 菜单路径集合；admin 为任一角色权限含 admin:true 的全量标记。</p>
 *
 * <p>判定语义与 Go 完全一致：</p>
 * <ul>
 *   <li>{@link #covers(String)}：admin 全量放行；已授权路径与所需路径相等、互为
 *       祖先/子孙（同一条菜单链）即视为已授权。后端按「同链任一方向」判定，比前端
 *       checkMenuPermission 略宽——勾选子菜单（如 brands/employer）也能覆盖祖先
 *       需求（brands 页 API），这是有意为之：菜单树中子菜单页依赖父页 API。</li>
 *   <li>{@link #coversPrefix(String)}：前缀下任一菜单（含前缀本身），用于模块级
 *       授权判断（如联盟管理面 = 任一 /portal/apps/alliance 菜单）。</li>
 * </ul>
 *
 * @author zhiyu
 */
public class MenuGrant {

    /** granted=true 的菜单路径集合（对齐 Go GrantedPaths） */
    private final Set<String> grantedPaths = new HashSet<>();

    /** 任一角色权限含 admin:true 的全量标记（对齐 Go Admin） */
    private boolean admin;

    public Set<String> getGrantedPaths() {
        return grantedPaths;
    }

    public boolean isAdmin() {
        return admin;
    }

    public void setAdmin(boolean admin) {
        this.admin = admin;
    }

    /**
     * 将单个角色的权限并入授权视图（对齐 Go Merge）：
     * permissions.menus 中 granted=true 的路径并入 grantedPaths；
     * permissions.admin=true 置 admin 标记。
     */
    public void merge(Map<String, Object> perms) {
        if (perms == null) {
            return;
        }
        Object adminFlag = perms.get("admin");
        if (adminFlag instanceof Boolean b && b) {
            this.admin = true;
        }
        Object menus = perms.get("menus");
        if (!(menus instanceof Map<?, ?> menuMap)) {
            return;
        }
        for (Map.Entry<?, ?> entry : menuMap.entrySet()) {
            if (entry.getKey() instanceof String path && entry.getValue() instanceof Boolean granted && granted) {
                grantedPaths.add(path);
            }
        }
    }

    /**
     * 判定授权视图是否覆盖所需菜单路径（菜单树同链匹配，对齐 Go Covers）。
     */
    public boolean covers(String menuPath) {
        if (admin) {
            return true;
        }
        if (grantedPaths.isEmpty()) {
            return false;
        }
        String need = normalizeMenuPath(menuPath);
        for (String p : grantedPaths) {
            if (sameMenuChain(normalizeMenuPath(p), need)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 判定授权视图是否覆盖指定路径前缀下的任一菜单（含前缀本身，对齐 Go CoversPrefix），
     * 用于模块级授权判断（如联盟管理面 = 任一 /portal/apps/alliance 菜单）。
     */
    public boolean coversPrefix(String prefix) {
        if (admin) {
            return true;
        }
        String need = normalizeMenuPath(prefix);
        for (String p : grantedPaths) {
            String q = normalizeMenuPath(p);
            if (q.equals(need) || hasPathPrefix(q, need) || hasPathPrefix(need, q)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 授权视图是否完全为空（无任何已授权路径且非 admin，对齐 Go Empty）。
     */
    public boolean isEmpty() {
        return !admin && grantedPaths.isEmpty();
    }

    /**
     * 去除查询串/尾部斜杠（对齐 Go normalizeMenuPath，与前端 normalizeMenuPath 对齐）。
     */
    public static String normalizeMenuPath(String path) {
        String clean = path;
        int cut = -1;
        for (int i = 0; i < clean.length(); i++) {
            char c = clean.charAt(i);
            if (c == '?' || c == '#') {
                cut = i;
                break;
            }
        }
        if (cut >= 0) {
            clean = clean.substring(0, cut);
        }
        if (clean.length() > 1 && clean.charAt(clean.length() - 1) == '/') {
            clean = clean.substring(0, clean.length() - 1);
        }
        return clean;
    }

    /**
     * 判定两个菜单路径是否在同一条菜单链上（相等或互为祖先/子孙，对齐 Go sameMenuChain）。
     */
    public static boolean sameMenuChain(String a, String b) {
        return a.equals(b) || hasPathPrefix(a, b) || hasPathPrefix(b, a);
    }

    /**
     * 判定 sub 是否为 prefix 的路径子孙（按段前缀，防 /job/positions2 误匹配 /job/positions，
     * 对齐 Go hasPathPrefix）。
     */
    public static boolean hasPathPrefix(String sub, String prefix) {
        if (prefix.isEmpty() || "/".equals(prefix)) {
            return true;
        }
        if (sub.equals(prefix)) {
            return true;
        }
        if (sub.length() <= prefix.length()) {
            return false;
        }
        if (sub.charAt(prefix.length()) != '/') {
            return false;
        }
        return sub.startsWith(prefix);
    }
}
