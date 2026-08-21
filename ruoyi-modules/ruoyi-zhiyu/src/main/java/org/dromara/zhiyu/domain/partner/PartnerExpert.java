package org.dromara.zhiyu.domain.partner;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler;

import java.util.List;

/**
 * 企业专家档案（alliance_experts 表，Go→Java 迁移）。
 *
 * <p>professionalFields/specialties/photos/attachments/secondaryColleges 为 jsonb
 * 字符串数组列，经 {@link JsonStringListTypeHandler} 映射。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_experts")
public class PartnerExpert extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 专家姓名 */
    private String name;

    /** 性别 */
    private String gender;

    /** 年龄 */
    private Integer age;

    /** 职称 */
    private String title;

    /** 职务 */
    private String position;

    /** 专家类型 */
    private String expertType;

    /** 行业 */
    private String industry;

    /** 专业领域（jsonb） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> professionalFields;

    /** 专长（jsonb） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> specialties;

    /** 从业年限 */
    private Integer experienceYears;

    /** 学历 */
    private String education;

    /** 简介 */
    private String introduction;

    /** 工作经历 */
    private String workExperience;

    /** 城市 */
    private String city;

    /** 头像 URL */
    private String avatarUrl;

    /** 封面图 */
    private String coverImage;

    /** 照片（jsonb） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> photos;

    /** 附件（jsonb） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> attachments;

    /** 归属企业 ID */
    private String enterpriseId;

    /** 企业名称（JOIN 结果列，非表列） */
    @TableField(exist = false)
    private String enterpriseName;

    /** 所属机构 */
    private String organization;

    /** 评级 */
    private String rating;

    /** 状态（active/inactive） */
    private String status;

    /** 来源（cooperation 等） */
    private String partnerSource;

    /** 就业方向 */
    private String positionDirection;

    /** 二级学院（jsonb） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> secondaryColleges;

    /** 是否公开 */
    private Boolean isPublic;

    /** 绑定账号（partner 平台 users.id） */
    private String userId;

    /** 创建人 ID */
    private String createdBy;
}
