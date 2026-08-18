package org.dromara.zhiyu.domain.portal;

import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;

/**
 * 社区帖子（community_topics 表）。
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("community_topics")
public class PortalCommunityTopic extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 作者用户 ID */
    private String authorId;

    /** 标题 */
    private String title;

    /** 内容 */
    private String content;

    /** 标签 */
    private String tag;

    /** 回复数 */
    private Integer replyCount;
}
