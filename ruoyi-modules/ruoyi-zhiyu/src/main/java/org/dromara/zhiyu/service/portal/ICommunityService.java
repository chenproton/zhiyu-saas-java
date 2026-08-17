package org.dromara.zhiyu.service.portal;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.portal.CommunityDtos.CommunityReplyDto;
import org.dromara.zhiyu.domain.dto.portal.CommunityDtos.CommunityTopicDto;
import org.dromara.zhiyu.domain.dto.portal.CommunityDtos.CreateReplyRequest;
import org.dromara.zhiyu.domain.dto.portal.CommunityDtos.CreateTopicRequest;

/**
 * 学习社区服务（对齐 Go community_handler.go + CommunityService 语义）。
 *
 * @author zhiyu
 */
public interface ICommunityService {

    /**
     * 帖子列表（sort=hot 按阅读数、latest 按时间流、mine 我的提问）。
     *
     * @param sort   排序（hot/latest/mine，非法值回退 latest）
     * @param limit  每页条数（默认 50，上限 100）
     * @param offset 偏移
     * @return 帖子列表
     */
    ListResponse<CommunityTopicDto> listTopics(String sort, long limit, long offset);

    /**
     * 发帖。
     *
     * @param req 发帖请求
     * @return 新帖子 ID
     */
    String createTopic(CreateTopicRequest req);

    /**
     * 帖子详情（同时累加阅读数）。
     *
     * @param id 帖子 ID
     * @return 帖子
     */
    CommunityTopicDto getTopic(String id);

    /**
     * 帖子回复列表。
     *
     * @param topicId 帖子 ID
     * @return 回复列表
     */
    ListResponse<CommunityReplyDto> listReplies(String topicId);

    /**
     * 回复帖子/回复评论。
     *
     * @param topicId 帖子 ID
     * @param req     回复请求
     * @return 新回复 ID
     */
    String createReply(String topicId, CreateReplyRequest req);
}
