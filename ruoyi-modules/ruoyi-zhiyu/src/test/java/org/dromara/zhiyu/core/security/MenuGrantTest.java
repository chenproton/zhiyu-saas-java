package org.dromara.zhiyu.core.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link MenuGrant} 判定矩阵单测（对齐 Go internal/domain/menu_grant.go 语义与
 * internal/middleware/menu_test.go 用例矩阵，ADR-0008）。
 *
 * @author zhiyu
 */
@Tag("local")
@Tag("dev")
@DisplayName("菜单授权视图判定矩阵（对齐 Go menu_grant.go / menu_test.go）")
class MenuGrantTest {

    private static MenuGrant grantOf(Map<String, Object> perms) {
        MenuGrant g = new MenuGrant();
        g.merge(perms);
        return g;
    }

    private static Map<String, Object> menus(String... paths) {
        Map<String, Object> m = new HashMap<>();
        for (String p : paths) {
            m.put(p, true);
        }
        return Map.of("menus", m);
    }

    // ---------- Covers 同链匹配（menu_test.go TestRequireMenu_GrantMatrix）----------

    @Test
    @DisplayName("勾选 brands 菜单放行 brands API")
    void grantedExactMenuCovers() {
        assertTrue(grantOf(menus("/portal/apps/alliance/brands")).covers("/portal/apps/alliance/brands"));
    }

    @Test
    @DisplayName("勾选 brands/employer 子菜单放行父 API（同链任一方向，有意宽于前端）")
    void grantedChildMenuCoversParent() {
        assertTrue(grantOf(menus("/portal/apps/alliance/brands/employer")).covers("/portal/apps/alliance/brands"));
    }

    @Test
    @DisplayName("勾选父菜单放银子页面 API（祖先覆盖子孙）")
    void grantedParentMenuCoversChild() {
        assertTrue(grantOf(menus("/portal/apps/alliance/brands")).covers("/portal/apps/alliance/brands/employer"));
    }

    @Test
    @DisplayName("未勾选对应菜单拒绝（跨模块菜单不覆盖）")
    void unrelatedMenuDenied() {
        assertFalse(grantOf(menus("/job/positions")).covers("/portal/apps/alliance/brands"));
    }

    @Test
    @DisplayName("menus 缺失 fail-closed 拒绝")
    void missingMenusDenied() {
        assertFalse(grantOf(Map.of("admin", false)).covers("/job/positions"));
    }

    @Test
    @DisplayName("空授权视图拒绝一切")
    void emptyGrantDenied() {
        MenuGrant g = new MenuGrant();
        assertFalse(g.covers("/job/positions"));
        assertFalse(g.coversPrefix("/portal/apps/alliance"));
        assertTrue(g.isEmpty());
    }

    @Test
    @DisplayName("admin 全量放行")
    void adminCoversAll() {
        MenuGrant g = grantOf(Map.of("admin", true));
        assertTrue(g.covers("/job/positions"));
        assertTrue(g.covers("/portal/apps/system/tenant"));
        assertTrue(g.coversPrefix("/portal/apps/alliance"));
        assertFalse(g.isEmpty());
    }

    @Test
    @DisplayName("多菜单任一命中放行")
    void anyOfMultipleMenusCovers() {
        MenuGrant g = grantOf(menus("/job/batches"));
        // HasMenuGrant 语义：任一所需菜单被覆盖即放行（此处验证单菜单覆盖）
        assertTrue(g.covers("/job/batches"));
        assertFalse(g.covers("/portal/apps/alliance/brands"));
    }

    @Test
    @DisplayName("granted=false 的菜单不并入授权视图")
    void falseGrantedNotMerged() {
        Map<String, Object> m = new HashMap<>();
        m.put("/job/positions", false);
        MenuGrant g = grantOf(Map.of("menus", m));
        assertFalse(g.covers("/job/positions"));
        assertTrue(g.isEmpty());
    }

    // ---------- 路径规范化与前缀判定（menu_grant.go normalizeMenuPath/hasPathPrefix）----------

    @Test
    @DisplayName("normalizeMenuPath 去查询串/尾部斜杠")
    void normalizeStripsQueryAndTrailingSlash() {
        org.junit.jupiter.api.Assertions.assertEquals("/job/positions",
            MenuGrant.normalizeMenuPath("/job/positions?a=1"));
        org.junit.jupiter.api.Assertions.assertEquals("/job/positions",
            MenuGrant.normalizeMenuPath("/job/positions#frag"));
        org.junit.jupiter.api.Assertions.assertEquals("/job/positions",
            MenuGrant.normalizeMenuPath("/job/positions/"));
        org.junit.jupiter.api.Assertions.assertEquals("/", MenuGrant.normalizeMenuPath("/"));
    }

    @Test
    @DisplayName("带查询串/尾斜杠的已授权路径同样覆盖")
    void coversNormalizesBothSides() {
        assertTrue(grantOf(menus("/job/positions/")).covers("/job/positions?x=1"));
    }

    @Test
    @DisplayName("hasPathPrefix 按段前缀：/job/positions2 不匹配 /job/positions")
    void segmentPrefixGuard() {
        assertFalse(MenuGrant.hasPathPrefix("/job/positions2", "/job/positions"));
        assertTrue(MenuGrant.hasPathPrefix("/job/positions/2", "/job/positions"));
        assertTrue(MenuGrant.hasPathPrefix("/job/positions", "/job/positions"));
        assertTrue(MenuGrant.hasPathPrefix("/anything", "/"));
        assertTrue(MenuGrant.hasPathPrefix("/anything", ""));
        assertFalse(MenuGrant.hasPathPrefix("/job", "/job/positions"));
    }

    // ---------- CoversPrefix 模块级判定（canManageAlliance 用）----------

    @Test
    @DisplayName("coversPrefix：任一联盟管理菜单即覆盖联盟管理面")
    void coversPrefixAlliance() {
        assertTrue(grantOf(menus("/portal/apps/alliance/brands")).coversPrefix("/portal/apps/alliance"));
        assertTrue(grantOf(menus("/portal/apps/alliance/school")).coversPrefix("/portal/apps/alliance"));
    }

    @Test
    @DisplayName("coversPrefix：仅勾前台落地页不获管理权限")
    void landingOnlyNotManage() {
        assertFalse(grantOf(menus("/portal/alliance/landing")).coversPrefix("/portal/apps/alliance"));
    }

    @Test
    @DisplayName("coversPrefix：空视图拒绝")
    void coversPrefixEmptyDenied() {
        assertFalse(new MenuGrant().coversPrefix("/portal/apps/alliance"));
    }
}
