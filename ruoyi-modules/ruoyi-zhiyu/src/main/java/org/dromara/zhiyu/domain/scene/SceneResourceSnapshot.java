package org.dromara.zhiyu.domain.scene;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 资源快照（resource_snapshots 表，Go→Java 迁移）。
 *
 * <p>snapshot_data 为 jsonb 列，实体以 String 承载（快照 bundle 原文，Service 负责解析）。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("resource_snapshots")
public class SceneResourceSnapshot extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 资源类型（career_positions/scenarios/courses/exams/question_banks） */
    private String resourceType;

    /** 资源 ID */
    private String resourceId;

    /** 版本号（如 V1.1） */
    private String version;

    /** 快照数据（jsonb 原文） */
    private String snapshotData;
}
