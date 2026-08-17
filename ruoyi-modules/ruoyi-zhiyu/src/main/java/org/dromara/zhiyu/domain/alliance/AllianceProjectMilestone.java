package org.dromara.zhiyu.domain.alliance;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.time.LocalDate;

/**
 * 项目里程碑（alliance_project_milestones 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("alliance_project_milestones")
public class AllianceProjectMilestone extends BaseZhiyuEntity {

    private String tenantId;
    private String projectId;
    private String name;
    private String description;
    private LocalDate dueDate;
    private LocalDate completedDate;
    private Boolean isCompleted;
    private Integer sortOrder;
}
