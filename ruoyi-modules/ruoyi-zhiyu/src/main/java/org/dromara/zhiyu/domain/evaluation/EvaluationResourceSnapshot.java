package org.dromara.zhiyu.domain.evaluation;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 资源快照（resource_snapshots 表；快照无 FK，读取一律限定租户）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("resource_snapshots")
public class EvaluationResourceSnapshot extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 资源类型（exams/question_banks/scenarios/courses/career_positions） */
    private String resourceType;

    /** 资源 ID */
    private String resourceId;

    /** 版本（V1.0 起，同一资源版本唯一） */
    private String version;

    /** 快照内容（jsonb 对象 JSON 文本） */
    private String snapshotData;
}
