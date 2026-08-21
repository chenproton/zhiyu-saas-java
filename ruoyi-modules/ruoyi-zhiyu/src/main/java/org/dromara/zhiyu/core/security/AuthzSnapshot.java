package org.dromara.zhiyu.core.security;

import java.util.List;

/**
 * 当前用户的服务端授权快照：角色编码集合 + 合并后的菜单授权视图。
 *
 * <p>对齐 Go middleware.Claims（RoleCodes）+ MenuContext 装载的 MenuGrant：
 * roleCodes 等价 Go 令牌中的角色编码（登录时快照）；grant 等价 Go 按请求查库
 * 合并的菜单授权（Redis 60s 短缓存）。</p>
 *
 * @author zhiyu
 */
public record AuthzSnapshot(List<String> roleCodes, MenuGrant grant) {

    public AuthzSnapshot {
        roleCodes = roleCodes == null ? List.of() : List.copyOf(roleCodes);
        if (grant == null) {
            grant = new MenuGrant();
        }
    }

    /** 空快照（未登录/降级场景）：无角色、空授权。 */
    public static AuthzSnapshot empty() {
        return new AuthzSnapshot(List.of(), new MenuGrant());
    }

    /** 是否绑定指定角色编码（对齐 Go middleware.HasRole）。 */
    public boolean hasRole(String code) {
        return roleCodes.contains(code);
    }

    /** 是否拥有任一显式授予的菜单（对齐 Go HasAnyMenuPermission：仅看 menus 授予项）。 */
    public boolean hasAnyMenuPermission() {
        return grant != null && !grant.getGrantedPaths().isEmpty();
    }

    /**
     * 是否有系统管理权限（对齐 Go HasSystemPermission）：
     * admin 全量标记，或任一 granted 菜单位于 /portal/apps/system 前缀下。
     * 业务菜单授权永不隐含系统管理权限。
     */
    public boolean hasSystemPermission() {
        if (grant == null) {
            return false;
        }
        if (grant.isAdmin()) {
            return true;
        }
        for (String p : grant.getGrantedPaths()) {
            if (p != null && p.startsWith(ZhiyuMenuCatalog.SYSTEM_MENU_PREFIX)) {
                return true;
            }
        }
        return false;
    }

    /** 菜单授权是否覆盖任一所需菜单路径（对齐 Go HasMenuGrant：任一命中即放行）。 */
    public boolean coversAny(List<String> menuPaths) {
        if (grant == null) {
            return false;
        }
        for (String m : menuPaths) {
            if (grant.covers(m)) {
                return true;
            }
        }
        return false;
    }
}
