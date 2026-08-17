package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 专家（alliance_experts 表，tenant_id = 企业租户；校本档案副本 enterprise_id 为空）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_experts")
public class AllianceExpert extends BaseZhiyuEntity {

    private String tenantId;
    private String name;
    private String gender;
    private Integer age;
    private String title;
    private String position;
    private String expertType;
    private String industry;
    /** jsonb 字符串数组（professional_fields） */
    private String professionalFields;
    /** jsonb 字符串数组（specialties） */
    private String specialties;
    private Integer experienceYears;
    private String education;
    private String introduction;
    private String workExperience;
    private String city;
    private String avatarUrl;
    private String coverImage;
    /** jsonb 字符串数组（photos） */
    private String photos;
    /** jsonb 字符串数组（attachments） */
    private String attachments;
    private String enterpriseId;
    private String organization;
    private String rating;
    private String status;
    private String partnerSource;
    private String positionDirection;
    /** jsonb 字符串数组（secondary_colleges） */
    private String secondaryColleges;
    private Boolean isPublic;
    private String userId;
    private String createdBy;

    /** 归属企业名称（公开接口 JOIN 返回，非本表列） */
    @TableField(exist = false)
    private String enterpriseName;
}
