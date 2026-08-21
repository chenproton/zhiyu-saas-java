package org.dromara.zhiyu.domain.dto.portal;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 学习社区 DTO（对齐 Go community_handler.go 与 shared-types portal.ts CommunityTopic/CommunityReply）。
 *
 * @author zhiyu
 */
public class CommunityDtos {

    /** 发帖请求（CreateTopicRequest） */
    @Data
    public static class CreateTopicRequest {
        private String title;
        private String content;
        private String tag;
    }

    /** 回复请求（CreateReplyRequest，parentId 非空表示回复某条评论） */
    @Data
    public static class CreateReplyRequest {
        private String content;
        private String parentId;
    }

    /** 帖子（CommunityTopic） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CommunityTopicDto {
        private String id;
        private String tenantId;
        private String authorId;
        private String authorName;
        private String avatarUrl;
        private String title;
        private String content;
        private String tag;
        private Integer replyCount;
        private Integer viewCount;
        private OffsetDateTime lastReplyAt;
        private OffsetDateTime createdAt;
        private Boolean isMine;
    }

    /** 回复（CommunityReply） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CommunityReplyDto {
        private String id;
        private String topicId;
        private String authorId;
        private String authorName;
        private String avatarUrl;
        private String parentId;
        private String parentAuthorId;
        private String parentAuthorName;
        private String content;
        private OffsetDateTime createdAt;
        private Boolean isMine;
    }
}
