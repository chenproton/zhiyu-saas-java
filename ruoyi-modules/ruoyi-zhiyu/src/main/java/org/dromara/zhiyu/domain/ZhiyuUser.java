package org.dromara.zhiyu.domain;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.PgArrayTypeHandler;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 用户实体（users 表，Go→Java 迁移：PG uuid 主键 + 现有列命名）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("users")
public class ZhiyuUser extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 机构 ID */
    private String institutionId;

    /** 组织节点 ID */
    private String orgNodeId;

    /** 专业 ID */
    private String majorId;

    /** 角色（user_role 枚举：operator/teacher/student/admin 等） */
    private String role;

    /** 平台（saas/portal/partner） */
    private String platform;

    /** 登录名 */
    private String loginName;

    /** 用户名 */
    private String username;

    /** 密码哈希（bcrypt，永不回传前端） */
    @JsonIgnore
    private String passwordHash;

    /** 姓名 */
    private String name;

    /** 邮箱 */
    private String email;

    /** 手机号 */
    private String phone;

    /** 头像地址 */
    private String avatarUrl;

    /** 学号 */
    private String studentNo;

    /** 工号 */
    private String workId;

    /** 身份证号 */
    private String idCard;

    /** 职称 ID 数组（uuid[]） */
    @TableField(typeHandler = PgArrayTypeHandler.class)
    private List<String> titleIds;

    /** OAuth 凭据（jsonb，永不回传前端） */
    @JsonIgnore
    private Map<String, Object> oauth;

    /** 角色 ID 列表（关联 user_roles+roles 组装，非本表列） */
    @TableField(exist = false)
    private List<String> roleIds;

    /** 角色码列表（关联组装） */
    @TableField(exist = false)
    private List<String> roleCodes;

    /** 角色名列表（关联组装） */
    @TableField(exist = false)
    private List<String> roleNames;

    /** 状态（active/停用） */
    private String status;

    /** 最后登录时间 */
    private OffsetDateTime lastLoginAt;

    /** 毕业年份 */
    private Integer graduateYear;

    /** 改密时间（用于会话失效判定，Go 版语义） */
    private OffsetDateTime passwordChangedAt;
}
