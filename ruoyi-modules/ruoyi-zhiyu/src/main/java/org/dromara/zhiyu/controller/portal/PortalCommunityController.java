package org.dromara.zhiyu.controller.portal;

import lombok.RequiredArgsConstructor;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.dto.portal.CommunityDtos.CommunityReplyDto;
import org.dromara.zhiyu.domain.dto.portal.CommunityDtos.CommunityTopicDto;
import org.dromara.zhiyu.domain.dto.portal.CommunityDtos.CreateReplyRequest;
import org.dromara.zhiyu.domain.dto.portal.CommunityDtos.CreateTopicRequest;
import org.dromara.zhiyu.service.portal.ICommunityService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 门户学习社区控制器（对齐 Go routes.go 的 /portal/community 路由组）。
 *
 * @author zhiyu
 */
@Validated
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/portal/community")
public class PortalCommunityController {

    private final ICommunityService communityService;

    /** 帖子列表（sort=hot|latest|mine） */
    @GetMapping("/topics")
    public ListResponse<CommunityTopicDto> listTopics(
        @RequestParam(value = "sort", required = false) String sort,
        @RequestParam(value = "limit", required = false, defaultValue = "50") long limit,
        @RequestParam(value = "offset", required = false, defaultValue = "0") long offset) {
        return communityService.listTopics(sort, limit, offset);
    }

    /** 发帖 */
    @PostMapping("/topics")
    public Map<String, String> createTopic(@RequestBody CreateTopicRequest req) {
        return Map.of("id", communityService.createTopic(req));
    }

    /** 帖子详情（累加阅读数） */
    @GetMapping("/topics/{id}")
    public CommunityTopicDto getTopic(@PathVariable String id) {
        return communityService.getTopic(id);
    }

    /** 帖子回复列表 */
    @GetMapping("/topics/{id}/replies")
    public ListResponse<CommunityReplyDto> listReplies(@PathVariable String id) {
        return communityService.listReplies(id);
    }

    /** 回复帖子/回复评论 */
    @PostMapping("/topics/{id}/replies")
    public Map<String, String> createReply(@PathVariable String id, @RequestBody CreateReplyRequest req) {
        return Map.of("id", communityService.createReply(id, req));
    }
}
