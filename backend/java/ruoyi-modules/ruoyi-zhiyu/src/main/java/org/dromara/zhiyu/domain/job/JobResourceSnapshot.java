package org.dromara.zhiyu.domain.job;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 资源快照（resource_snapshots 表，Go→Java 迁移）。
 *
 * <p>表仅有 created_at（无 updated_at），故不继承 {@code BaseZhiyuEntity}，
 * 自建 id 主键。snapshotData 为 jsonb 列（bundle 原始 JSON 文本）。</p>
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("resource_snapshots")
public class JobResourceSnapshot {

    /** 主键（UUID） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 资源类型（position/scenario/course/exam/question_bank） */
    private String resourceType;

    /** 资源 ID */
    private String resourceId;

    /** 版本号（如 V1.0） */
    private String version;

    /** 快照内容（jsonb，bundle 原始 JSON 文本） */
    private String snapshotData;

    /** 创建时间 */
    private OffsetDateTime createdAt;
}
