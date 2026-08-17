package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 资源快照（resource_snapshots 表，仅 created_at 列，故不继承 BaseZhiyuEntity）。
 * 课程/场景版本回退口径：排课版本 → 最新快照 → live version。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("resource_snapshots")
public class PortalResourceSnapshot {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 租户 ID */
    private String tenantId;

    /** 资源类型（courses/scenarios 等） */
    private String resourceType;

    /** 资源 ID */
    private String resourceId;

    /** 版本号 */
    private String version;

    /** 快照内容（jsonb 列，存 JSON 文本） */
    private String snapshotData;

    /** 创建时间 */
    @TableField("created_at")
    private OffsetDateTime createdAt;
}
