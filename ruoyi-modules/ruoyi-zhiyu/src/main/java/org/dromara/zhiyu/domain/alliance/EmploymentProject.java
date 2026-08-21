package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.time.LocalDate;

/**
 * 就业项目（alliance_employment_projects 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_employment_projects")
public class EmploymentProject extends BaseZhiyuEntity {

    private String tenantId;
    private String name;
    private String type;
    private String organizer;
    private String description;
    private String coverImage;
    private LocalDate startDate;
    private LocalDate endDate;
    private String publishStatus;
    /** jsonb 字符串数组（enterprise_ids） */
    private String enterpriseIds;
    /** jsonb 对象数组（target_groups） */
    private String targetGroups;
    private String createdBy;

    /** 岗位数（聚合，非本表列） */
    @TableField(exist = false)
    private Integer jobCount;
    /** 投递数（聚合，非本表列） */
    @TableField(exist = false)
    private Integer applicationCount;
}
