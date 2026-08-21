package org.dromara.zhiyu.core.seed;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 种子数据 Mapper（等价 Go cmd/seed 的建库初始化：运营方租户 platform + 平台管理员 admin）。
 *
 * <p>仅在部署初始化时由 {@link SeedRunner} 使用，业务代码不引用。
 * 全部 SQL 幂等（ON DUPLICATE KEY UPDATE id = id），重复执行安全。</p>
 *
 * @author zhiyu
 */
@Mapper
public interface SeedMapper {

    /** 平台管理员是否已存在（users 表 login_name=admin AND platform=saas） */
    @Select("SELECT EXISTS(SELECT 1 FROM users WHERE login_name = 'admin' AND platform = 'saas')")
    boolean existsAdmin();

    /** 运营方租户是否已存在 */
    @Select("SELECT EXISTS(SELECT 1 FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001')")
    boolean existsOperatorTenant();

    /** 重置平台管理员密码（已存在时调用） */
    @Update("UPDATE users SET password_hash = #{hash} WHERE login_name = 'admin' AND platform = 'saas'")
    int updateAdminPassword(@Param("hash") String hash);

    /** 运营方租户（platform） */
    @Update("""
        INSERT INTO tenants (id, name, code, status, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000001', '运营管理平台', 'platform', 'active', NOW(), NOW())
        ON DUPLICATE KEY UPDATE id = id
        """)
    int insertOperatorTenant();

    /** 平台管理员角色（platform_admin） */
    @Update("""
        INSERT INTO roles (id, tenant_id, code, name, permissions, user_count, status, created_at)
        VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
                'platform_admin', '平台管理员', '{}', 0, 'active', NOW())
        ON DUPLICATE KEY UPDATE id = id
        """)
    int insertPlatformAdminRole();

    /** 平台管理员用户（admin / saas） */
    @Update("""
        INSERT INTO users (id, tenant_id, login_name, username, name, role, platform, password_hash, status, created_at, updated_at)
        VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
                'admin', 'admin', '平台管理员', 'operator', 'saas', #{hash}, 'active', NOW(), NOW())
        ON DUPLICATE KEY UPDATE id = id
        """)
    int insertAdminUser(@Param("hash") String hash);

    /** 管理员角色绑定 */
    @Update("""
        INSERT INTO user_roles (user_id, role_id)
        VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002')
        ON DUPLICATE KEY UPDATE id = id
        """)
    int insertAdminUserRole();

    /** 刷新角色人数统计 */
    @Update("""
        UPDATE roles SET user_count = (SELECT COUNT(*) FROM user_roles WHERE role_id = '00000000-0000-0000-0000-000000000002')
        WHERE id = '00000000-0000-0000-0000-000000000002'
        """)
    int refreshRoleCount();
}
