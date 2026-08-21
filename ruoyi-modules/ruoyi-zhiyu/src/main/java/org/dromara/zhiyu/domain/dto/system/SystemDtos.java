package org.dromara.zhiyu.domain.dto.system;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 系统管理域（users/staff-titles/orgs/roles/majors/industries/resource-codes/tenants/订阅/主题）
 * 请求/响应 DTO 集合（对齐 Go handler 各请求结构体 + 前端契约字段名）。
 *
 * @author zhiyu
 */
public final class SystemDtos {

    private SystemDtos() {
    }

    // ==================== 用户 ====================

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CreateUserRequest {
        private String tenantId;
        private String institutionId;
        private String orgNodeId;
        private String majorId;
        private String role;
        private String roleId;
        private String platform;
        private String username;
        private String loginName;
        private String password;
        private String name;
        private String email;
        private String phone;
        private String avatarUrl;
        private String studentNo;
        private String workId;
        private String idCard;
        private List<String> titleIds;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UpdateUserRequest {
        private String institutionId;
        private String orgNodeId;
        private String majorId;
        private String role;
        private String roleId;
        private String username;
        private String loginName;
        private String name;
        private String email;
        private String phone;
        private String avatarUrl;
        private String studentNo;
        private String workId;
        private String idCard;
        private List<String> titleIds;
    }

    @Data
    public static class UpdateUserStatusRequest {
        private String status;
    }

    @Data
    public static class ResetPasswordRequest {
        private String password;
    }

    @Data
    public static class BatchCreateUserRequest {
        private List<CreateUserRequest> users;
    }

    @Data
    public static class BatchGraduateRequest {
        private List<String> userIds;
        private Integer graduateYear;
    }

    @Data
    public static class BatchDeleteUsersRequest {
        private List<String> userIds;
    }

    @Data
    public static class BatchUpdateOrgNodeRequest {
        private List<String> userIds;
        private String orgNodeId;
    }

    @Data
    public static class BindUserRolesRequest {
        private List<String> roleIds;
    }

    // ==================== 组织 ====================

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CreateOrgRequest {
        private String tenantId;
        private String name;
        private String typeId;
        private String parentId;
        private Integer sortOrder;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UpdateOrgRequest {
        private String name;
        private String typeId;
        private String parentId;
        private Integer sortOrder;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class OrgTreeNode {
        private String id;
        private String tenantId;
        private String name;
        private String typeId;
        private String parentId;
        private Integer sortOrder;
        private Integer memberCount;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
        private List<OrgTreeNode> children;
    }

    // ==================== 组织类型 / 角色 / 职称 / 专业 / 行业 / 资源码 ====================

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class OrgTypeRequest {
        private String tenantId;
        private String name;
        private String category;
        private String description;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RoleRequest {
        private String tenantId;
        private String code;
        private String name;
        private String description;
        private Map<String, Object> permissions;
    }

    @Data
    public static class AssignRoleRequest {
        private String userId;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class StaffTitleRequest {
        private String tenantId;
        private String code;
        private String name;
        private String description;
        private String status;
    }

    @Data
    public static class ToggleStatusRequest {
        private String status;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UserExtensionFieldUpdateRequest {
        private String fieldName;
        private Boolean isEnabled;
        private Boolean isRequired;
        private List<String> applicableRoleCodes;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CreateUserRelationRequest {
        private String initiatorId;
        private String targetId;
        private String relationType;
        private String description;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UserRelationItem {
        private String id;
        private String initiatorId;
        private String initiatorName;
        private String initiatorDept;
        private String targetId;
        private String targetName;
        private String targetDept;
        private String relationType;
        private OffsetDateTime createdAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MajorRequest {
        private String tenantId;
        private String code;
        private String name;
        private String alias;
        private Boolean enabled;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class IndustryRequest {
        private String tenantId;
        private String code;
        private String name;
        private String parentId;
        private Boolean enabled;
        private Integer sortOrder;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ResourceCodeRequest {
        private String tenantId;
        private String code;
        private String name;
        private String description;
        private String type;
    }

    // ==================== 租户 / 管理员 / 订阅 ====================

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CreateTenantRequest {
        private String name;
        private String code;
        private String type;
        private String username;
        private String password;
        private String logoUrl;
        private String domain;
        private String enterpriseCode;
        private String contact;
        private String phone;
        private String contactEmail;
        private String address;
        private String description;
        private String validFrom;
        private String validUntil;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UpdateTenantRequest {
        private String name;
        private String logoUrl;
        private String domain;
        private String enterpriseCode;
        private String contact;
        private String phone;
        private String address;
        private String description;
        private String shortName;
        private String schoolType;
        private String province;
        private String city;
        private String website;
        private String contactPhone;
        private Map<String, Object> scaleData;
        private List<Object> secondaryColleges;
        private String educationLevel;
        private String educationNature;
        private String validFrom;
        private String validUntil;
    }

    @Data
    public static class UpdateTenantStatusRequest {
        private String status;
    }

    @Data
    public static class SetPasswordRequest {
        private String password;
    }

    @Data
    public static class CreateTenantAdminRequest {
        private String username;
        private String name;
    }

    @Data
    public static class UpdateTenantAdminRequest {
        private String username;
        private String name;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TenantAdminItem {
        private String id;
        private String tenantId;
        private String username;
        private String loginName;
        private String name;
        private String status;
        private String newPassword;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;
        private OffsetDateTime lastLoginAt;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AdminUserInfo {
        private String id;
        private String username;
        private String loginName;
        private String initialPassword;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UpdateSubscriptionRequest {
        private String name;
        private String validUntil;
        private Map<String, Object> modules;
        private String status;
        private Long aiTokenQuota;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AdminEnterpriseProfile {
        private String id;
        private String tenantId;
        private String name;
        private String unifiedSocialCreditCode;
        private String contactPerson;
        private String contactPhone;
        private String contactEmail;
        private String address;
        private String description;
        private Boolean enablePublic;
    }

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AdminEnterpriseUpdateRequest {
        private String name;
        private String unifiedSocialCreditCode;
        private String contactPerson;
        private String contactPhone;
        private String contactEmail;
        private Boolean enablePublic;
        private String status;
        private String validFrom;
        private String validUntil;
    }
}
