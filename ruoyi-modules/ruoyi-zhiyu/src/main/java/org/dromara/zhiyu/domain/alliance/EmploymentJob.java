package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 就业岗位（alliance_employment_jobs 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_employment_jobs")
public class EmploymentJob extends BaseZhiyuEntity {

    private String tenantId;
    private String enterpriseId;
    private String projectId;
    private String title;
    private String jobType;
    private String location;
    private BigDecimal salaryMin;
    private BigDecimal salaryMax;
    private Integer headcount;
    private String education;
    /** jsonb 字符串数组（suitable_majors） */
    private String suitableMajors;
    private String description;
    private String responsibilities;
    private String requirements;
    private String contactPerson;
    private String contactPhone;
    private LocalDate deadline;
    private String status;
    private String createdBy;

    /** 企业名（JOIN，非本表列） */
    @TableField(exist = false)
    private String enterpriseName;
    /** 项目名（JOIN，非本表列） */
    @TableField(exist = false)
    private String projectName;
    /** 投递数（聚合，非本表列） */
    @TableField(exist = false)
    private Integer applicationCount;
}
