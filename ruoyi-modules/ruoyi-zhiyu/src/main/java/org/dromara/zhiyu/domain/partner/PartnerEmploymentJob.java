package org.dromara.zhiyu.domain.partner;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 就业岗位（alliance_employment_jobs 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_employment_jobs")
public class PartnerEmploymentJob extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 企业主体 ID */
    private String enterpriseId;

    /** 就业项目 ID */
    private String projectId;

    /** 岗位名称 */
    private String title;

    /** 岗位类型 */
    private String jobType;

    /** 工作地点 */
    private String location;

    /** 最低薪资（千元/月） */
    private BigDecimal salaryMin;

    /** 最高薪资（千元/月） */
    private BigDecimal salaryMax;

    /** 招聘人数 */
    private Integer headcount;

    /** 学历要求 */
    private String education;

    /** 适用专业（jsonb 字符串数组） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> suitableMajors;

    /** 岗位描述 */
    private String description;

    /** 岗位职责 */
    private String responsibilities;

    /** 任职要求 */
    private String requirements;

    /** 联系人 */
    private String contactPerson;

    /** 联系电话 */
    private String contactPhone;

    /** 截止日期 */
    private LocalDate deadline;

    /** 状态（draft/published/closed） */
    private String status;

    /** 创建人 */
    private String createdBy;

    /** 企业名称（JOIN 结果列，非表列） */
    @TableField(exist = false)
    private String enterpriseName;

    /** 项目名称（JOIN 结果列，非表列） */
    @TableField(exist = false)
    private String projectName;

    /** 投递数（JOIN 结果列，非表列） */
    @TableField(exist = false)
    private Integer applicationCount;
}
