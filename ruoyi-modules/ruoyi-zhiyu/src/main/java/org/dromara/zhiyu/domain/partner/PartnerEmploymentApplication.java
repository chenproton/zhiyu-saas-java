package org.dromara.zhiyu.domain.partner;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 学生投递（alliance_employment_applications 表，Go→Java 迁移；企业端只读）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_employment_applications")
public class PartnerEmploymentApplication extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 岗位 ID */
    private String jobId;

    /** 企业主体 ID */
    private String enterpriseId;

    /** 学生账号 ID */
    private String studentId;

    /** 学生姓名（投递快照） */
    private String studentName;

    /** 学号（投递快照） */
    private String studentNo;

    /** 专业名称（投递快照） */
    private String majorName;

    /** 班级名称（投递快照） */
    private String className;

    /** 手机号（投递快照） */
    private String phone;

    /** 邮箱（投递快照） */
    private String email;

    /** 求职信 */
    private String coverLetter;

    /** 状态（pending） */
    private String status;

    /** 岗位名称（JOIN 结果列，非表列） */
    @TableField(exist = false)
    private String jobTitle;

    /** 企业名称（JOIN 结果列，非表列） */
    @TableField(exist = false)
    private String enterpriseName;

    /** 项目名称（JOIN 结果列，非表列） */
    @TableField(exist = false)
    private String projectName;
}
