package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 学生投递（alliance_employment_applications 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_employment_applications")
public class EmploymentApplication extends BaseZhiyuEntity {

    private String tenantId;
    private String jobId;
    private String enterpriseId;
    private String studentId;
    private String studentName;
    private String studentNo;
    private String majorName;
    private String className;
    private String phone;
    private String email;
    private String coverLetter;
    private String status;

    /** 岗位标题（JOIN，非本表列） */
    @TableField(exist = false)
    private String jobTitle;
    /** 企业名（JOIN，非本表列） */
    @TableField(exist = false)
    private String enterpriseName;
    /** 项目名（JOIN，非本表列） */
    @TableField(exist = false)
    private String projectName;
}
