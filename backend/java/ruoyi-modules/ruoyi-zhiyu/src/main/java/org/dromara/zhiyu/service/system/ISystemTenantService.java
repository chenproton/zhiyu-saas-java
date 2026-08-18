package org.dromara.zhiyu.service.system;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.ZhiyuTenant;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.TenantAdminItem;
import org.dromara.zhiyu.domain.dto.system.SystemDtos.UpdateTenantRequest;
import org.dromara.zhiyu.domain.system.SystemSubscriptionPackage;

import java.util.List;

/**
 * 门户侧租户/管理员/订阅服务（对齐 Go registerPortalRoutes 的 /tenants、/admins、/subscriptions）。
 *
 * @author zhiyu
 */
public interface ISystemTenantService {

    ListResponse<ZhiyuTenant> list(String search, String status, String type, long limit, long offset);

    ZhiyuTenant get(String id);

    ZhiyuTenant update(String id, UpdateTenantRequest req);

    List<TenantAdminItem> listSchoolAdmins();

    TenantAdminItem createSchoolAdmin(String username, String name);

    TenantAdminItem updateSchoolAdmin(String id, String username, String name);

    String deleteSchoolAdmin(String id);

    String resetSchoolAdminPassword(String id, String password);

    SystemSubscriptionPackage getSubscription();
}
