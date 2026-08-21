package org.dromara.zhiyu.service;

import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.mapper.system.SystemRoleMapper;
import org.dromara.zhiyu.mapper.system.SystemUserMapper;
import org.dromara.zhiyu.service.impl.system.SystemUserServiceImpl;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 系统用户管理服务单测：批量删除防跨租户 IDOR（租户 A 提交租户 B 用户 ID 时，
 * 角色清理/删除必须只作用于当前租户真实存在的用户）。
 *
 * @author zhiyu
 */
@Tag("local")
class SystemUserServiceImplTest {

    private static final String TENANT_A = "tenant-a";
    private static final String ADMIN = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa0";
    private static final String USER_A1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
    private static final String USER_B1 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1";
    private static final String USER_B2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2";

    private SystemUserMapper userMapper;
    private SystemRoleMapper roleMapper;
    private SystemUserServiceImpl service;

    @BeforeEach
    void setUp() {
        userMapper = mock(SystemUserMapper.class);
        roleMapper = mock(SystemRoleMapper.class);
        // SystemGuard 从 DB 查角色码（selectRoleCodesByUser），stub school_admin 通过权限校验
        when(roleMapper.selectRoleCodesByUser(ADMIN)).thenReturn(List.of("school_admin"));
        service = new SystemUserServiceImpl(userMapper, roleMapper,
            new SystemGuard(roleMapper));
        TenantContext.set(ADMIN, TENANT_A, "admin", "saas");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    @DisplayName("batchDelete 只清理当前租户用户，跨租户 ID 被过滤")
    void batchDeleteOnlyProcessesTenantOwnedUsers() {
        // 请求包含：本租户用户 + 他租户用户（b1 不属于 tenant-a）
        List<String> requested = List.of(USER_A1, USER_B1);
        // 租户过滤后仅返回 tenant-a 真实存在的用户
        when(userMapper.filterTenantUserIds(TENANT_A, requested)).thenReturn(List.of(USER_A1));

        long deleted = service.batchDelete(requested);

        assertEquals(1, deleted, "返回值应为实际删除的本租户用户数");
        // 角色清理只针对本租户用户，且 SQL 均带租户条件
        verify(roleMapper, times(1)).decrementUserCountsByUser(USER_A1, TENANT_A);
        verify(roleMapper, times(1)).deleteUserRolesByUser(USER_A1, TENANT_A);
        // 他租户用户绝不触碰角色数据
        verify(roleMapper, never()).decrementUserCountsByUser(eq(USER_B1), anyString());
        verify(roleMapper, never()).deleteUserRolesByUser(eq(USER_B1), anyString());
        // 用户删除也只作用于租户过滤后的列表
        verify(userMapper, times(1)).batchDeleteUsers(TENANT_A, List.of(USER_A1));
    }

    @Test
    @DisplayName("batchDelete 传入全为他租户 ID 时返回 0 且无任何写操作")
    void batchDeleteAllForeignIdsIsNoop() {
        List<String> requested = List.of(USER_B1, USER_B2);
        when(userMapper.filterTenantUserIds(TENANT_A, requested)).thenReturn(List.of());

        long deleted = service.batchDelete(requested);

        assertEquals(0, deleted);
        verify(roleMapper, never()).decrementUserCountsByUser(eq(USER_B1), anyString());
        verify(roleMapper, never()).deleteUserRolesByUser(eq(USER_B2), anyString());
        verify(userMapper, never()).batchDeleteUsers(eq(TENANT_A), anyList());
    }
}
