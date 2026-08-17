package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 社区回复（community_replies 表，仅 created_at 列，故不继承 BaseZhiyuEntity）。
 *
 * @author zhiyu
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("community_replies")
public class PortalCommunityReply {

    /** 主键 */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /** 帖子 ID */
    private String topicId;

    /** 作者用户 ID */
    private String authorId;

    /** 父评论 ID */
    private String parentId;

    /** 回复内容 */
    private String content;

    /** 创建时间 */
    @TableField("created_at")
    private OffsetDateTime createdAt;
}
