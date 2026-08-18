package org.dromara.zhiyu.domain.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 认证相关 DTO（对齐 Go 版 auth_handler.go 的请求/响应结构，字段名与前端契约一致）。
 *
 * @author zhiyu
 */
public class AuthDtos {

    /** 登录请求（Go LoginRequest） */
    @Data
    public static class LoginRequest {
        @NotBlank(message = "用户名不能为空")
        private String username;
        @NotBlank(message = "密码不能为空")
        private String password;
        private String captchaId;
        private String captchaCode;
        private String deviceId;
    }

    /** 租户选项（Go TenantOption） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TenantOption {
        private String tenantId;
        private String tenantName;
        private String userId;
    }

    /** 登录响应（Go LoginResponse，omitempty 对齐） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class LoginResponse {
        private String token;
        private ZhiyuUserView user;
        private Boolean needsTenantSelection;
        private String preAuthToken;
        private java.util.List<TenantOption> tenants;
    }

    /** 选择租户请求（Go SelectTenantRequest） */
    @Data
    public static class SelectTenantRequest {
        @NotBlank(message = "预授权令牌不能为空")
        private String preAuthToken;
        @NotBlank(message = "租户 ID 不能为空")
        private String tenantId;
    }

    /** Me 响应（Go MeResponse：user/institution/tenant/orgNode/major/roles） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class MeResponse {
        private ZhiyuUserView user;
        private Object institution;
        private ZhiyuTenantView tenant;
        private Object orgNode;
        private Object major;
        /** 角色对象数组（对齐 Go []domain.Role：含 permissions，前端按 activeRole.permissions.menus 判菜单） */
        private java.util.List<RoleView> roles;
    }

    /** 角色视图（对齐 Go domain.Role JSON：id/tenantId/code/name/description/permissions/userCount/status/createdAt） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RoleView {
        private String id;
        private String tenantId;
        private String code;
        private String name;
        private String description;
        private java.util.Map<String, Object> permissions;
        private Integer userCount;
        private String status;
        private java.time.OffsetDateTime createdAt;
    }

    /** 用户视图（密码等敏感字段不回传，对齐 Go issueTokenForUser 的脱敏） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ZhiyuUserView {
        private String id;
        private String tenantId;
        private String institutionId;
        private String orgNodeId;
        private String majorId;
        private String role;
        private String platform;
        private String loginName;
        private String username;
        private String name;
        private String email;
        private String phone;
        private String avatarUrl;
        private String studentNo;
        private String workId;
        private String idCard;
        private String status;
        private java.time.OffsetDateTime lastLoginAt;
        private java.time.OffsetDateTime createdAt;
        private java.time.OffsetDateTime updatedAt;
        private Integer graduateYear;
        private java.util.List<String> roleIds;
        private java.util.List<String> roleCodes;
        private java.util.List<String> roleNames;
    }

    /** 租户视图（Go Tenant JSON 对齐） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ZhiyuTenantView {
        private String id;
        private String name;
        private String code;
        private String logoUrl;
        private String domain;
        private String enterpriseCode;
        private String contact;
        private String phone;
        private String address;
        private String description;
        private String status;
        private java.time.OffsetDateTime createdAt;
        private java.time.OffsetDateTime updatedAt;
        private String shortName;
        private String schoolType;
        private String province;
        private String city;
        private String website;
        private String contactPhone;
        private String validFrom;
        private String validUntil;
    }

    /** 验证码响应（Go CaptchaOut：captchaId + dataURL 图片） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CaptchaData {
        private String captchaId;
        /** data:image/png;base64, 前缀的图片 dataURL */
        private String image;
    }

    /** 企业自助注册请求（Go PartnerRegisterRequest） */
    @Data
    public static class PartnerRegisterRequest {
        @NotBlank(message = "企业名称不能为空")
        private String enterpriseName;
        @NotBlank(message = "用户名不能为空")
        private String username;
        @NotBlank(message = "密码不能为空")
        private String password;
        /** 管理员姓名（可选，缺省为「企业名+管理员」） */
        private String contactName;
        private String unifiedSocialCreditCode;
        private String contactPerson;
        private String contactPhone;
        private String contactEmail;
    }

    /** Partner 端 me 响应（Go PartnerMeResponse：user + enterprise + roles） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PartnerMeResponse {
        private ZhiyuUserView user;
        private org.dromara.zhiyu.domain.partner.PartnerEnterprise enterprise;
        private java.util.List<org.dromara.zhiyu.domain.system.SystemRole> roles;
    }
}
