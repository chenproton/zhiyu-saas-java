package org.dromara.zhiyu.service.impl.portal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.portal.CommunityDtos.CommunityReplyDto;
import org.dromara.zhiyu.domain.dto.portal.CommunityDtos.CommunityTopicDto;
import org.dromara.zhiyu.domain.dto.portal.CommunityDtos.CreateReplyRequest;
import org.dromara.zhiyu.domain.dto.portal.CommunityDtos.CreateTopicRequest;
import org.dromara.zhiyu.domain.portal.PortalCommunityReply;
import org.dromara.zhiyu.domain.portal.PortalCommunityTopic;
import org.dromara.zhiyu.domain.portal.PortalViewCounter;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.portal.PortalCommunityReplyMapper;
import org.dromara.zhiyu.mapper.portal.PortalCommunityTopicMapper;
import org.dromara.zhiyu.mapper.portal.PortalViewCounterMapper;
import org.dromara.zhiyu.service.portal.ICommunityService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 学习社区服务实现（对齐 Go community_handler.go + store/community.go 语义）。
 *
 * <p>全部查询按租户隔离；阅读计数失败不阻断详情返回（对齐 Go：计数为非核心写路径）。
 * CreateReply 在事务内同时递增帖子回复数。</p>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class CommunityServiceImpl implements ICommunityService {

    private static final String TOPIC_VIEW_TYPE = "community_topic";

    private final PortalCommunityTopicMapper topicMapper;
    private final PortalCommunityReplyMapper replyMapper;
    private final PortalViewCounterMapper viewCounterMapper;
    private final ZhiyuUserMapper userMapper;

    @Override
    public ListResponse<CommunityTopicDto> listTopics(String sort, long limit, long offset) {
        String userId = requireUser();
        String tenantId = requireTenant();

        String sortKey = sort;
        if (sortKey == null || sortKey.isBlank()) {
            sortKey = "latest";
        }
        if (!"hot".equals(sortKey) && !"latest".equals(sortKey) && !"mine".equals(sortKey)) {
            sortKey = "latest";
        }
        long safeLimit = limit <= 0 ? 50 : Math.min(limit, 100);
        long safeOffset = Math.max(offset, 0);

        // 总数（与列表共用过滤条件）
        var countWrapper = QueryBuilder.lambda(PortalCommunityTopic.class)
            .eq(PortalCommunityTopic::getTenantId, tenantId);
        if ("mine".equals(sortKey)) {
            countWrapper.eq(PortalCommunityTopic::getAuthorId, userId);
        }
        long total = topicMapper.selectCount(countWrapper.build());

        var wrapper = QueryBuilder.lambda(PortalCommunityTopic.class)
            .eq(PortalCommunityTopic::getTenantId, tenantId);
        if ("mine".equals(sortKey)) {
            wrapper.eq(PortalCommunityTopic::getAuthorId, userId);
        }
        if ("hot".equals(sortKey)) {
            // 对齐 Go：按阅读数（view_counters）倒序，再按创建时间倒序
            wrapper.last("ORDER BY COALESCE((SELECT cnt FROM view_counters vc WHERE vc.target_type = 'community_topic'"
                + " AND vc.target_id = community_topics.id), 0) DESC, community_topics.created_at DESC");
        } else {
            wrapper.orderByDesc(PortalCommunityTopic::getCreatedAt);
        }
        wrapper.last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<PortalCommunityTopic> rows = topicMapper.selectList(wrapper.build());

        List<CommunityTopicDto> items = toTopicDtos(rows, userId);
        return ListResponse.of(items, total);
    }

    @Override
    public String createTopic(CreateTopicRequest req) {
        String userId = requireUser();
        String tenantId = requireTenant();
        String title = req.getTitle() == null ? "" : req.getTitle().trim();
        String content = req.getContent() == null ? "" : req.getContent().trim();
        String tag = req.getTag() == null ? "" : req.getTag().trim();
        if (title.isEmpty()) {
            throw new ApiException(400, "bad_request", "标题不能为空");
        }
        if (title.codePointCount(0, title.length()) > 128) {
            throw new ApiException(400, "bad_request", "标题不能超过 128 字");
        }
        if (content.isEmpty()) {
            throw new ApiException(400, "bad_request", "内容不能为空");
        }
        if (tag.codePointCount(0, tag.length()) > 32) {
            throw new ApiException(400, "bad_request", "标签不能超过 32 字");
        }
        PortalCommunityTopic topic = new PortalCommunityTopic();
        topic.setTenantId(tenantId);
        topic.setAuthorId(userId);
        topic.setTitle(title);
        topic.setContent(content);
        topic.setTag(tag.isEmpty() ? null : tag);
        topic.setReplyCount(0);
        topicMapper.insert(topic);
        return topic.getId();
    }

    @Override
    public CommunityTopicDto getTopic(String id) {
        String userId = requireUser();
        String tenantId = requireTenant();
        if (id == null || id.isBlank()) {
            throw new ApiException(400, "bad_request", "缺少话题 ID");
        }
        PortalCommunityTopic topic = topicMapper.selectOne(
            QueryBuilder.lambda(PortalCommunityTopic.class)
                .eq(PortalCommunityTopic::getId, id)
                .eq(PortalCommunityTopic::getTenantId, tenantId)
                .build());
        if (topic == null) {
            throw new ApiException(404, "not_found", "话题不存在");
        }
        // 阅读计数前先读取当前值（对齐 Go：先查后记，返回 +1）
        Long viewCnt = viewCounterMap(TOPIC_VIEW_TYPE, List.of(id)).getOrDefault(id, 0L);
        recordTopicView(id, userId, tenantId);

        List<PortalCommunityTopic> single = List.of(topic);
        CommunityTopicDto dto = toTopicDtos(single, userId).get(0);
        dto.setViewCount(viewCnt.intValue() + 1);
        return dto;
    }

    @Override
    public ListResponse<CommunityReplyDto> listReplies(String topicId) {
        String userId = requireUser();
        String tenantId = requireTenant();
        if (topicId == null || topicId.isBlank()) {
            throw new ApiException(400, "bad_request", "缺少话题 ID");
        }
        PortalCommunityTopic topic = topicMapper.selectOne(
            QueryBuilder.lambda(PortalCommunityTopic.class)
                .eq(PortalCommunityTopic::getId, topicId)
                .eq(PortalCommunityTopic::getTenantId, tenantId)
                .build());
        if (topic == null) {
            return ListResponse.of(new ArrayList<>(), 0);
        }
        List<PortalCommunityReply> rows = replyMapper.selectList(
            QueryBuilder.lambda(PortalCommunityReply.class)
                .eq(PortalCommunityReply::getTopicId, topicId)
                .orderByAsc(PortalCommunityReply::getCreatedAt)
                .build());
        List<CommunityReplyDto> items = toReplyDtos(rows, userId);
        return ListResponse.of(items, items.size());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String createReply(String topicId, CreateReplyRequest req) {
        String userId = requireUser();
        String tenantId = requireTenant();
        if (topicId == null || topicId.isBlank()) {
            throw new ApiException(400, "bad_request", "缺少话题 ID");
        }
        PortalCommunityTopic topic = topicMapper.selectOne(
            QueryBuilder.lambda(PortalCommunityTopic.class)
                .eq(PortalCommunityTopic::getId, topicId)
                .eq(PortalCommunityTopic::getTenantId, tenantId)
                .build());
        if (topic == null) {
            throw new ApiException(404, "not_found", "话题不存在");
        }
        String content = req.getContent() == null ? "" : req.getContent().trim();
        if (content.isEmpty()) {
            throw new ApiException(400, "bad_request", "回复内容不能为空");
        }
        if (content.codePointCount(0, content.length()) > 2000) {
            throw new ApiException(400, "bad_request", "回复内容不能超过 2000 字");
        }
        String parentId = req.getParentId();
        if (parentId != null && !parentId.isBlank()) {
            // 父评论必须属于同一帖子（对齐 Go INSERT...SELECT 校验）
            Long parentCnt = replyMapper.selectCount(
                QueryBuilder.lambda(PortalCommunityReply.class)
                    .eq(PortalCommunityReply::getId, parentId)
                    .eq(PortalCommunityReply::getTopicId, topicId)
                    .build());
            if (parentCnt == 0) {
                throw new ApiException(404, "not_found", "话题不存在");
            }
        }
        PortalCommunityReply reply = new PortalCommunityReply();
        reply.setTopicId(topicId);
        reply.setAuthorId(userId);
        reply.setParentId(parentId == null || parentId.isBlank() ? null : parentId);
        reply.setContent(content);
        replyMapper.insert(reply);

        // 递增帖子回复数（对齐 Go IncrementTopicReplyCount）
        PortalCommunityTopic patch = new PortalCommunityTopic();
        patch.setReplyCount((topic.getReplyCount() == null ? 0 : topic.getReplyCount()) + 1);
        topicMapper.update(patch,
            QueryBuilder.lambda(PortalCommunityTopic.class).eq(PortalCommunityTopic::getId, topicId).build());
        return reply.getId();
    }

    // ---------- 组装助手 ----------

    private List<CommunityTopicDto> toTopicDtos(List<PortalCommunityTopic> rows, String currentUserId) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> topicIds = rows.stream().map(PortalCommunityTopic::getId).toList();
        Set<String> authorIds = rows.stream().map(PortalCommunityTopic::getAuthorId).collect(Collectors.toCollection(LinkedHashSet::new));

        Map<String, ZhiyuUser> authorMap = userMapper.selectList(
                QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, authorIds).build())
            .stream().collect(Collectors.toMap(ZhiyuUser::getId, Function.identity()));

        Map<String, Long> viewMap = viewCounterMap(TOPIC_VIEW_TYPE, topicIds);
        Map<String, OffsetDateTime> lastReplyMap = lastReplyAtMap(topicIds);

        List<CommunityTopicDto> items = new ArrayList<>();
        for (PortalCommunityTopic t : rows) {
            CommunityTopicDto dto = new CommunityTopicDto();
            dto.setId(t.getId());
            dto.setTenantId(t.getTenantId());
            dto.setAuthorId(t.getAuthorId());
            ZhiyuUser author = authorMap.get(t.getAuthorId());
            dto.setAuthorName(author == null || author.getName() == null ? "" : author.getName());
            dto.setAvatarUrl(blankToNull(author == null ? null : author.getAvatarUrl()));
            dto.setTitle(t.getTitle());
            dto.setContent(t.getContent());
            dto.setTag(blankToNull(t.getTag()));
            dto.setReplyCount(t.getReplyCount() == null ? 0 : t.getReplyCount());
            dto.setViewCount(viewMap.getOrDefault(t.getId(), 0L).intValue());
            dto.setLastReplyAt(lastReplyMap.get(t.getId()));
            dto.setCreatedAt(t.getCreatedAt());
            dto.setIsMine(currentUserId.equals(t.getAuthorId()));
            items.add(dto);
        }
        return items;
    }

    private List<CommunityReplyDto> toReplyDtos(List<PortalCommunityReply> rows, String currentUserId) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        Set<String> authorIds = rows.stream().map(PortalCommunityReply::getAuthorId).collect(Collectors.toCollection(LinkedHashSet::new));
        Set<String> parentReplyIds = rows.stream()
            .map(PortalCommunityReply::getParentId)
            .filter(java.util.Objects::nonNull)
            .collect(Collectors.toCollection(LinkedHashSet::new));

        // 父评论（parent_id → 父评论作者），对齐 Go LEFT JOIN community_replies pr / users pu
        Map<String, PortalCommunityReply> parentReplyMap = parentReplyIds.isEmpty() ? Map.of()
            : replyMapper.selectList(
                QueryBuilder.lambda(PortalCommunityReply.class).in(PortalCommunityReply::getId, parentReplyIds).build())
                .stream().collect(Collectors.toMap(PortalCommunityReply::getId, Function.identity()));
        parentReplyMap.values().forEach(p -> {
            if (p.getAuthorId() != null) {
                authorIds.add(p.getAuthorId());
            }
        });

        Map<String, ZhiyuUser> authorMap = userMapper.selectList(
                QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, authorIds).build())
            .stream().collect(Collectors.toMap(ZhiyuUser::getId, Function.identity()));

        List<CommunityReplyDto> items = new ArrayList<>();
        for (PortalCommunityReply r : rows) {
            CommunityReplyDto dto = new CommunityReplyDto();
            dto.setId(r.getId());
            dto.setTopicId(r.getTopicId());
            dto.setAuthorId(r.getAuthorId());
            ZhiyuUser author = authorMap.get(r.getAuthorId());
            dto.setAuthorName(author == null || author.getName() == null ? "" : author.getName());
            dto.setAvatarUrl(blankToNull(author == null ? null : author.getAvatarUrl()));
            if (r.getParentId() != null) {
                dto.setParentId(r.getParentId());
                PortalCommunityReply parentReply = parentReplyMap.get(r.getParentId());
                if (parentReply != null && parentReply.getAuthorId() != null) {
                    ZhiyuUser parentAuthor = authorMap.get(parentReply.getAuthorId());
                    dto.setParentAuthorId(parentReply.getAuthorId());
                    dto.setParentAuthorName(parentAuthor == null ? null : parentAuthor.getName());
                }
            }
            dto.setContent(r.getContent());
            dto.setCreatedAt(r.getCreatedAt());
            dto.setIsMine(currentUserId.equals(r.getAuthorId()));
            items.add(dto);
        }
        return items;
    }

    private Map<String, Long> viewCounterMap(String targetType, List<String> targetIds) {
        Map<String, Long> map = new HashMap<>();
        if (targetIds.isEmpty()) {
            return map;
        }
        try {
            List<PortalViewCounter> counters = viewCounterMapper.selectList(
                QueryBuilder.lambda(PortalViewCounter.class)
                    .eq(PortalViewCounter::getTargetType, targetType)
                    .in(PortalViewCounter::getTargetId, targetIds)
                    .build());
            for (PortalViewCounter c : counters) {
                map.put(c.getTargetId(), c.getCnt() == null ? 0L : c.getCnt());
            }
        } catch (Exception e) {
            log.warn("view counter batch query failed", e);
        }
        return map;
    }

    private Map<String, OffsetDateTime> lastReplyAtMap(List<String> topicIds) {
        Map<String, OffsetDateTime> map = new LinkedHashMap<>();
        if (topicIds.isEmpty()) {
            return map;
        }
        try {
            List<PortalCommunityReply> replies = replyMapper.selectList(
                QueryBuilder.lambda(PortalCommunityReply.class)
                    .in(PortalCommunityReply::getTopicId, topicIds)
                    .build());
            for (PortalCommunityReply r : replies) {
                OffsetDateTime existing = map.get(r.getTopicId());
                if (existing == null || (r.getCreatedAt() != null && r.getCreatedAt().isAfter(existing))) {
                    map.put(r.getTopicId(), r.getCreatedAt());
                }
            }
        } catch (Exception e) {
            log.warn("last reply at query failed", e);
        }
        return map;
    }

    /** 记录阅读（view_logs 插入 + 计数 upsert），失败仅告警（对齐 Go RecordView 容错语义） */
    private void recordTopicView(String topicId, String userId, String tenantId) {
        try {
            viewCounterMapper.logView(TOPIC_VIEW_TYPE, topicId, userId, tenantId);
            viewCounterMapper.increment(TOPIC_VIEW_TYPE, topicId);
        } catch (Exception e) {
            log.warn("record community topic view failed, topicId={}", topicId, e);
        }
    }

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }

    private String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
