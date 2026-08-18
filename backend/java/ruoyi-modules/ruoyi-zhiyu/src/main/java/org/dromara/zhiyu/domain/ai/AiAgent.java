package org.dromara.zhiyu.domain.ai;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * AI 智能体（ai_agents 表，Go→Java 迁移）。
 *
 * <p>视图扩展字段（ownerName/majorName/departmentName/viewCount/kbIds/kbNames）
 * 非本表列，由 Service 组装后置入。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ai_agents")
public class AiAgent extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 创建人 ID */
    private String ownerId;

    /** 名称 */
    private String name;

    /** 头像 */
    private String avatar;

    /** 描述 */
    private String description;

    /** 封面图 */
    private String coverImage;

    /** 问候语 */
    private String greeting;

    /** 系统提示词 */
    private String systemPrompt;

    /** 状态（private/pending/published/rejected） */
    private String status;

    /** 审核意见 */
    private String reviewComment;

    /** 审核人 ID */
    private String reviewedBy;

    /** 审核时间 */
    private OffsetDateTime reviewedAt;

    /** 对话数 */
    private Long chatCount;

    /** 专业 ID */
    private String majorId;

    /** 部门 ID */
    private String departmentId;

    // ---------- 视图扩展字段（非表列） ----------

    /** 浏览量 */
    @TableField(exist = false)
    private Long viewCount;

    /** 专业名称 */
    @TableField(exist = false)
    private String majorName;

    /** 部门名称 */
    @TableField(exist = false)
    private String departmentName;

    /** 创建人姓名 */
    @TableField(exist = false)
    private String ownerName;

    /** 关联知识库 ID 列表 */
    @TableField(exist = false)
    private List<String> kbIds;

    /** 关联知识库名称列表 */
    @TableField(exist = false)
    private List<String> kbNames;
}
