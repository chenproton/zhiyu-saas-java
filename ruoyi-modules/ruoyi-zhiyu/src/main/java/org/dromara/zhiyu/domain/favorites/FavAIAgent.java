package org.dromara.zhiyu.domain.favorites;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * AI 智能体（ai_agents 表，收藏列表子集字段）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("ai_agents")
public class FavAIAgent extends BaseZhiyuEntity {

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

    /** 对话数 */
    private Long chatCount;

    /** 专业 ID */
    private String majorId;

    /** 部门 ID */
    private String departmentId;
}
