package org.dromara.zhiyu.domain.partner;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonRawValue;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.time.LocalDate;

/**
 * 就业项目（alliance_employment_projects 表，Go→Java 迁移；企业端只读）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_employment_projects")
public class PartnerEmploymentProject extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 项目名称 */
    private String name;

    /** 项目类型 */
    private String type;

    /** 组织方 */
    private String organizer;

    /** 描述 */
    private String description;

    /** 封面图 */
    private String coverImage;

    /** 开始日期 */
    private LocalDate startDate;

    /** 结束日期 */
    private LocalDate endDate;

    /** 发布状态（draft/published） */
    private String publishStatus;

    /** 参与企业 ID 数组（jsonb 字符串数组，原样透传） */
    @JsonRawValue
    private String enterpriseIds;

    /** 面向学生群体（jsonb 对象数组，原样透传） */
    @JsonRawValue
    private String targetGroups;

    /** 创建人 */
    private String createdBy;

    /** 岗位数（聚合字段，不落库） */
    @TableField(exist = false)
    private Integer jobCount;

    /** 投递数（聚合字段，不落库） */
    @TableField(exist = false)
    private Integer applicationCount;
}
