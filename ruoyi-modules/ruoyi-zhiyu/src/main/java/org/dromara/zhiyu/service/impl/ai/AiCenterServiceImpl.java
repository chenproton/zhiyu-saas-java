package org.dromara.zhiyu.service.impl.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.ai.AiAgent;
import org.dromara.zhiyu.domain.ai.AiAgentKb;
import org.dromara.zhiyu.domain.ai.AiConversation;
import org.dromara.zhiyu.domain.ai.AiIntegration;
import org.dromara.zhiyu.domain.ai.AiKbAsk;
import org.dromara.zhiyu.domain.ai.AiKbCollaborator;
import org.dromara.zhiyu.domain.ai.AiKbDocument;
import org.dromara.zhiyu.domain.ai.AiKnowledgeBase;
import org.dromara.zhiyu.domain.ai.AiMessage;
import org.dromara.zhiyu.domain.ai.AiReviewLog;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AgentInput;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.IntegrationInput;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.KbInput;
import org.dromara.zhiyu.domain.portal.PortalMajor;
import org.dromara.zhiyu.domain.portal.PortalOrganization;
import org.dromara.zhiyu.domain.portal.PortalViewCounter;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.ai.AiAgentKbMapper;
import org.dromara.zhiyu.mapper.ai.AiAgentMapper;
import org.dromara.zhiyu.mapper.ai.AiConversationMapper;
import org.dromara.zhiyu.mapper.ai.AiIntegrationMapper;
import org.dromara.zhiyu.mapper.ai.AiKbAskMapper;
import org.dromara.zhiyu.mapper.ai.AiKbCollaboratorMapper;
import org.dromara.zhiyu.mapper.ai.AiKbDocumentMapper;
import org.dromara.zhiyu.mapper.ai.AiKnowledgeBaseMapper;
import org.dromara.zhiyu.mapper.ai.AiMessageMapper;
import org.dromara.zhiyu.mapper.ai.AiReviewLogMapper;
import org.dromara.zhiyu.mapper.ai.TenantAiConfigMapper;
import org.dromara.zhiyu.mapper.portal.PortalMajorMapper;
import org.dromara.zhiyu.mapper.portal.PortalOrganizationMapper;
import org.dromara.zhiyu.mapper.portal.PortalViewCounterMapper;
import org.dromara.zhiyu.service.ai.ChatStreamResult;
import org.dromara.zhiyu.service.ai.IAiCenterService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * AI 智能服务中心服务实现（对齐 Go ai_center_*.go）。
 *
 * <p>检索/LLM 调用在演示环境为 mock：预检 AI 配置（未配置 → 412），
 * 配置存在即返回「演示回复」文本并分片流式下发；api_key 不触碰。</p>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class AiCenterServiceImpl implements IAiCenterService {

    private static final List<String> KB_TYPES = List.of("course_resource", "research", "teaching_case", "qa");
    private static final List<String> SUPPORTED_DOC_EXTS = List.of(".pdf", ".docx", ".txt", ".md");

    private final AiKnowledgeBaseMapper kbMapper;
    private final AiAgentMapper agentMapper;
    private final AiKbDocumentMapper docMapper;
    private final AiKbCollaboratorMapper collabMapper;
    private final AiConversationMapper convMapper;
    private final AiMessageMapper msgMapper;
    private final AiIntegrationMapper integrationMapper;
    private final AiReviewLogMapper reviewLogMapper;
    private final AiKbAskMapper kbAskMapper;
    private final AiAgentKbMapper agentKbMapper;
    private final TenantAiConfigMapper configMapper;
    private final ZhiyuUserMapper userMapper;
    private final PortalMajorMapper majorMapper;
    private final PortalOrganizationMapper orgMapper;
    private final PortalViewCounterMapper viewCounterMapper;

    // ==================== 知识库 ====================

    @Override
    public ListResponse<AiKnowledgeBase> listKbs(String scope, String q, long page, long pageSize) {
        String tenantId = requireTenant();
        String userId = requireUser();
        long[] lo = pageLimitOffset(page, pageSize);

        List<String> collabKbIds = collabMapper.selectList(
                QueryBuilder.lambda(AiKbCollaborator.class)
                    .eq(AiKbCollaborator::getTenantId, tenantId)
                    .eq(AiKbCollaborator::getUserId, userId).build())
            .stream().map(AiKbCollaborator::getKbId).toList();

        var wrapper = QueryBuilder.lambda(AiKnowledgeBase.class).eq(AiKnowledgeBase::getTenantId, tenantId);
        switch (scope == null ? "all" : scope) {
            case "owned" -> wrapper.eq(AiKnowledgeBase::getOwnerId, userId);
            case "collaborating" -> {
                if (collabKbIds.isEmpty()) {
                    return ListResponse.of(Collections.emptyList(), 0);
                }
                wrapper.in(AiKnowledgeBase::getId, collabKbIds);
            }
            default -> wrapper.and(w -> {
                w.eq(AiKnowledgeBase::getOwnerId, userId);
                if (!collabKbIds.isEmpty()) {
                    w.or().in(AiKnowledgeBase::getId, collabKbIds);
                }
            });
        }
        wrapper.likeIfText(AiKnowledgeBase::getName, trimToNull(q));

        long total = kbMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(AiKnowledgeBase::getUpdatedAt).last("LIMIT " + lo[0] + " OFFSET " + lo[1]);
        List<AiKnowledgeBase> rows = kbMapper.selectList(wrapper.build());
        assembleKbList(rows, tenantId, userId);
        return ListResponse.of(rows, total);
    }

    @Override
    public AiKnowledgeBase createKb(KbInput in) {
        String tenantId = requireTenant();
        String userId = requireUser();
        validateKbInput(in);

        AiKnowledgeBase kb = new AiKnowledgeBase();
        kb.setTenantId(tenantId);
        kb.setOwnerId(userId);
        kb.setName(trim(in.getName()));
        kb.setDescription(trim(in.getDescription()));
        kb.setTags(normalizeTags(in.getTags()));
        kb.setCoverImage(trimToNull(in.getCoverImage()));
        kb.setMajorId(trimToNull(in.getMajorId()));
        kb.setDepartmentId(trimToNull(in.getDepartmentId()));
        kb.setKbType(trimToNull(in.getKbType()));
        kbMapper.insert(kb);

        AiKnowledgeBase saved = kbMapper.selectById(kb.getId());
        saved.setMyRole("owner");
        return saved;
    }

    @Override
    public AiKnowledgeBase getKb(String id) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, id);
        String role = resolveKbRole(kb, userId, isSchoolAdmin());
        kb.setMyRole(role);
        fillKbNames(kb);
        recordView("ai_kb", id);
        kb.setViewCount(viewCount("ai_kb", id));
        return kb;
    }

    @Override
    public Map<String, String> updateKb(String id, KbInput in) {
        String tenantId = requireTenant();
        String userId = requireUser();
        validateKbInput(in);
        AiKnowledgeBase kb = getKbChecked(tenantId, id);
        String role = resolveKbRole(kb, userId, false);
        if (!"owner".equals(role) && !"editor".equals(role)) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        kb.setName(trim(in.getName()));
        kb.setDescription(trim(in.getDescription()));
        kb.setTags(normalizeTags(in.getTags()));
        kb.setCoverImage(trimToNull(in.getCoverImage()));
        kb.setMajorId(trimToNull(in.getMajorId()));
        kb.setDepartmentId(trimToNull(in.getDepartmentId()));
        kb.setKbType(trimToNull(in.getKbType()));
        kbMapper.updateById(kb);
        return ok();
    }

    @Override
    public Map<String, String> deleteKb(String id) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, id);
        if (!"owner".equals(resolveKbRole(kb, userId, false))) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        if (!"private".equals(kb.getStatus()) && !"rejected".equals(kb.getStatus())) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作");
        }
        kbMapper.deleteById(id);
        return ok();
    }

    @Override
    public Map<String, String> submitKb(String id) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, id);
        if (!"owner".equals(resolveKbRole(kb, userId, false))) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        if (kbMapper.submitStatus(tenantId, id) == 0) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作");
        }
        insertReviewLog(tenantId, "kb", id, "submit", userId, "");
        return ok();
    }

    @Override
    public Map<String, String> unpublishKb(String id) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, id);
        if (!"owner".equals(resolveKbRole(kb, userId, false))) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        if (kbMapper.unpublishStatus(tenantId, id) == 0) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作");
        }
        insertReviewLog(tenantId, "kb", id, "unpublish", userId, "");
        return ok();
    }

    // ==================== 文档 ====================

    @Override
    public List<AiKbDocument> listDocuments(String kbId) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, kbId);
        resolveKbRole(kb, userId, isSchoolAdmin());
        List<AiKbDocument> docs = docMapper.selectList(
            QueryBuilder.lambda(AiKbDocument.class)
                .eq(AiKbDocument::getTenantId, tenantId)
                .eq(AiKbDocument::getKbId, kbId)
                .orderByDesc(AiKbDocument::getCreatedAt)
                .last("LIMIT 500").build());
        fillUploaderNames(docs);
        return docs;
    }

    @Override
    public AiKbDocument getDocument(String kbId, String docId) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, kbId);
        resolveKbRole(kb, userId, isSchoolAdmin());
        AiKbDocument doc = docMapper.selectOne(
            QueryBuilder.lambda(AiKbDocument.class)
                .eq(AiKbDocument::getTenantId, tenantId)
                .eq(AiKbDocument::getKbId, kbId)
                .eq(AiKbDocument::getId, docId).build());
        if (doc == null) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        return doc;
    }

    @Override
    public AiKbDocument uploadDocument(String kbId, MultipartFile file) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, kbId);
        String role = resolveKbRole(kb, userId, false);
        if (!"owner".equals(role) && !"editor".equals(role)) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        if (file == null || file.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少文件字段");
        }
        String original = file.getOriginalFilename();
        String ext = extensionOf(original);
        if (!SUPPORTED_DOC_EXTS.contains(ext)) {
            throw new ApiException(400, "bad_request", "仅支持 PDF/DOCX/TXT/MD（.doc 请另存为 .docx）");
        }
        // 演示环境：不做真实落盘与解析，直接登记为 ready
        AiKbDocument doc = new AiKbDocument();
        doc.setTenantId(tenantId);
        doc.setKbId(kbId);
        doc.setUploaderId(userId);
        doc.setName(original == null ? "unnamed" + ext : original);
        doc.setFilePath("/demo/ai-kb/" + kbId + "/" + original);
        doc.setFileSize(file.getSize());
        doc.setMime(file.getContentType() == null ? "" : file.getContentType());
        doc.setStatus("ready");
        doc.setError("");
        doc.setChunkCount(0);
        doc.setCharCount(0);
        docMapper.insert(doc);
        return docMapper.selectById(doc.getId());
    }

    @Override
    public Map<String, String> deleteDocument(String kbId, String docId) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, kbId);
        String role = resolveKbRole(kb, userId, false);
        if (!"owner".equals(role) && !"editor".equals(role)) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        int rows = docMapper.delete(QueryBuilder.lambda(AiKbDocument.class)
            .eq(AiKbDocument::getTenantId, tenantId)
            .eq(AiKbDocument::getKbId, kbId)
            .eq(AiKbDocument::getId, docId).build());
        if (rows == 0) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        return ok();
    }

    // ==================== 协作者 ====================

    @Override
    public List<AiKbCollaborator> listCollaborators(String kbId) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, kbId);
        resolveKbRole(kb, userId, false);
        List<AiKbCollaborator> list = collabMapper.selectList(
            QueryBuilder.lambda(AiKbCollaborator.class)
                .eq(AiKbCollaborator::getTenantId, tenantId)
                .eq(AiKbCollaborator::getKbId, kbId)
                .orderByAsc(AiKbCollaborator::getCreatedAt)
                .last("LIMIT 200").build());
        fillCollaboratorNames(list);
        return list;
    }

    @Override
    public Map<String, String> addCollaborator(String kbId, String targetUserId, String role) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, kbId);
        if (!"owner".equals(resolveKbRole(kb, userId, false))) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        if (targetUserId == null || targetUserId.isBlank()) {
            throw new ApiException(400, "bad_request", "缺少 userId");
        }
        if (targetUserId.equals(kb.getOwnerId())) {
            throw new ApiException(400, "bad_request", "所有者无需添加为协作者");
        }
        if (!"editor".equals(role) && !"viewer".equals(role)) {
            throw new ApiException(400, "bad_request", "协作角色仅支持 editor/viewer");
        }
        ZhiyuUser target = userMapper.selectById(targetUserId);
        if (target == null || !tenantId.equals(target.getTenantId())) {
            throw new ApiException(404, "not_found", "用户不存在或不属于本租户");
        }
        collabMapper.upsert(tenantId, kbId, targetUserId, role);
        return ok();
    }

    @Override
    public Map<String, String> removeCollaborator(String kbId, String targetUserId) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, kbId);
        if (!"owner".equals(resolveKbRole(kb, userId, false))) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        int rows = collabMapper.delete(QueryBuilder.lambda(AiKbCollaborator.class)
            .eq(AiKbCollaborator::getTenantId, tenantId)
            .eq(AiKbCollaborator::getKbId, kbId)
            .eq(AiKbCollaborator::getUserId, targetUserId).build());
        if (rows == 0) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        return ok();
    }

    // ==================== 问答 ====================

    @Override
    public List<AiKbAsk> listMyKbAsks(String kbId) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, kbId);
        resolveKbRole(kb, userId, isSchoolAdmin());
        return kbAskMapper.selectList(
            QueryBuilder.lambda(AiKbAsk.class)
                .eq(AiKbAsk::getTenantId, tenantId)
                .eq(AiKbAsk::getKbId, kbId)
                .eq(AiKbAsk::getUserId, userId)
                .orderByDesc(AiKbAsk::getCreatedAt)
                .last("LIMIT 50").build());
    }

    @Override
    public ChatStreamResult kbAsk(String kbId, String message) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiKnowledgeBase kb = getKbChecked(tenantId, kbId);
        resolveKbRole(kb, userId, isSchoolAdmin());
        requireConfigured(tenantId);

        String reply = mockReply(message);
        AiKbAsk ask = new AiKbAsk();
        ask.setTenantId(tenantId);
        ask.setKbId(kbId);
        ask.setUserId(userId);
        ask.setQuestion(message);
        ask.setAnswer(reply);
        try {
            kbAskMapper.insert(ask);
        } catch (Exception e) {
            log.warn("insert kb ask failed, kbId={}", kbId, e);
        }
        return new ChatStreamResult(null, null, reply, null, true);
    }

    // ==================== 智能体 ====================

    @Override
    public List<AiAgent> listAgents() {
        String tenantId = requireTenant();
        String userId = requireUser();
        List<AiAgent> rows = agentMapper.selectList(
            QueryBuilder.lambda(AiAgent.class)
                .eq(AiAgent::getTenantId, tenantId)
                .eq(AiAgent::getOwnerId, userId)
                .orderByDesc(AiAgent::getUpdatedAt)
                .last("LIMIT 200").build());
        assembleAgentList(rows);
        return rows;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AiAgent createAgent(AgentInput in) {
        String tenantId = requireTenant();
        String userId = requireUser();
        validateAgentInput(in);

        AiAgent a = new AiAgent();
        a.setTenantId(tenantId);
        a.setOwnerId(userId);
        a.setName(trim(in.getName()));
        a.setAvatar(trimToNull(in.getAvatar()));
        a.setDescription(trim(in.getDescription()));
        a.setCoverImage(trimToNull(in.getCoverImage()));
        a.setGreeting(trim(in.getGreeting()));
        a.setSystemPrompt(trim(in.getSystemPrompt()));
        a.setMajorId(trimToNull(in.getMajorId()));
        a.setDepartmentId(trimToNull(in.getDepartmentId()));
        agentMapper.insert(a);

        List<String> kbIds = in.getKbIds() == null ? List.of() : in.getKbIds();
        validateAgentKbLinks(tenantId, userId, kbIds);
        replaceAgentKbs(tenantId, a.getId(), kbIds);

        AiAgent saved = agentMapper.selectById(a.getId());
        fillAgentKbRefs(saved);
        return saved;
    }

    @Override
    public AiAgent getAgent(String id) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiAgent a = getAgentChecked(tenantId, id);
        if (!a.getOwnerId().equals(userId) && !"published".equals(a.getStatus()) && !isSchoolAdmin()) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        fillAgentKbRefs(a);
        fillAgentNames(a);
        recordView("ai_agent", id);
        a.setViewCount(viewCount("ai_agent", id));
        return a;
    }

    @Override
    public Map<String, String> updateAgent(String id, AgentInput in) {
        String tenantId = requireTenant();
        String userId = requireUser();
        validateAgentInput(in);
        AiAgent a = getAgentChecked(tenantId, id);
        if (!a.getOwnerId().equals(userId)) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        List<String> kbIds = in.getKbIds() == null ? List.of() : in.getKbIds();
        validateAgentKbLinks(tenantId, userId, kbIds);

        a.setName(trim(in.getName()));
        a.setAvatar(trimToNull(in.getAvatar()));
        a.setDescription(trim(in.getDescription()));
        a.setCoverImage(trimToNull(in.getCoverImage()));
        a.setGreeting(trim(in.getGreeting()));
        a.setSystemPrompt(trim(in.getSystemPrompt()));
        a.setMajorId(trimToNull(in.getMajorId()));
        a.setDepartmentId(trimToNull(in.getDepartmentId()));
        agentMapper.updateById(a);
        replaceAgentKbs(tenantId, id, kbIds);
        return ok();
    }

    @Override
    public Map<String, String> deleteAgent(String id) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiAgent a = getAgentChecked(tenantId, id);
        if (!a.getOwnerId().equals(userId)) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        if (!"private".equals(a.getStatus()) && !"rejected".equals(a.getStatus())) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作");
        }
        agentMapper.deleteById(id);
        return ok();
    }

    @Override
    public Map<String, Object> submitAgent(String id) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiAgent a = getAgentChecked(tenantId, id);
        if (!a.getOwnerId().equals(userId)) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        if (agentMapper.submitStatus(tenantId, id) == 0) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作");
        }
        insertReviewLog(tenantId, "agent", id, "submit", userId, "");

        List<String> warnings = new ArrayList<>();
        List<String> kbIds = agentKbMapper.selectKbIds(tenantId, id);
        for (String kbId : kbIds) {
            AiKnowledgeBase kb = kbMapper.selectById(kbId);
            if (kb != null && !"published".equals(kb.getStatus())) {
                warnings.add("关联的知识库「" + kb.getName() + "」未发布，其他用户对话时不会检索其内容");
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "ok");
        result.put("warnings", warnings);
        return result;
    }

    @Override
    public Map<String, String> unpublishAgent(String id) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiAgent a = getAgentChecked(tenantId, id);
        if (!a.getOwnerId().equals(userId)) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        if (agentMapper.unpublishStatus(tenantId, id) == 0) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作");
        }
        insertReviewLog(tenantId, "agent", id, "unpublish", userId, "");
        return ok();
    }

    @Override
    public ChatStreamResult agentChat(String agentId, String conversationId, String message) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiAgent a = getAgentChecked(tenantId, agentId);
        if (!a.getOwnerId().equals(userId) && !"published".equals(a.getStatus()) && !isSchoolAdmin()) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        requireConfigured(tenantId);

        AiConversation cv = resolveConversation(tenantId, agentId, userId, conversationId);

        AiMessage userMsg = new AiMessage();
        userMsg.setTenantId(tenantId);
        userMsg.setConversationId(cv.getId());
        userMsg.setRole("user");
        userMsg.setContent(message);
        userMsg.setSources("[]");
        msgMapper.insert(userMsg);
        convMapper.touch(tenantId, cv.getId(), truncate(message, 30));

        String reply = mockReply(message);
        AiMessage assistantMsg = new AiMessage();
        assistantMsg.setTenantId(tenantId);
        assistantMsg.setConversationId(cv.getId());
        assistantMsg.setRole("assistant");
        assistantMsg.setContent(reply);
        assistantMsg.setSources("[]");
        msgMapper.insert(assistantMsg);
        convMapper.touch(tenantId, cv.getId(), "");
        try {
            agentMapper.incrementChatCount(tenantId, agentId);
        } catch (Exception e) {
            log.warn("increment agent chat count failed, agentId={}", agentId, e);
        }
        return new ChatStreamResult(cv.getId(), userMsg.getId(), reply, assistantMsg.getId(), false);
    }

    @Override
    public Map<String, String> previewAgent(String agentId, String systemPrompt, String message) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiAgent a = getAgentChecked(tenantId, agentId);
        if (!a.getOwnerId().equals(userId) && !isSchoolAdmin()) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        requireConfigured(tenantId);
        Map<String, String> result = new LinkedHashMap<>();
        result.put("reply", mockReply(message));
        return result;
    }

    // ==================== 会话 ====================

    @Override
    public List<AiConversation> listConversations(String agentId) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiAgent a = getAgentChecked(tenantId, agentId);
        if (!a.getOwnerId().equals(userId) && !"published".equals(a.getStatus())) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        return convMapper.selectList(
            QueryBuilder.lambda(AiConversation.class)
                .eq(AiConversation::getTenantId, tenantId)
                .eq(AiConversation::getAgentId, agentId)
                .eq(AiConversation::getUserId, userId)
                .orderByDesc(AiConversation::getUpdatedAt)
                .last("LIMIT 100").build());
    }

    @Override
    public Map<String, Object> getConversation(String id) {
        String tenantId = requireTenant();
        String userId = requireUser();
        AiConversation cv = convMapper.selectById(id);
        if (cv == null || !tenantId.equals(cv.getTenantId())) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        if (!cv.getUserId().equals(userId)) {
            throw new ApiException(403, "forbidden", "无权操作");
        }
        List<AiMessage> messages = msgMapper.selectList(
            QueryBuilder.lambda(AiMessage.class)
                .eq(AiMessage::getTenantId, tenantId)
                .eq(AiMessage::getConversationId, id)
                .orderByAsc(AiMessage::getCreatedAt)
                .last("LIMIT 500").build());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("conversation", cv);
        result.put("messages", messages);
        return result;
    }

    @Override
    public Map<String, String> renameConversation(String id, String title) {
        String tenantId = requireTenant();
        String userId = requireUser();
        String t = trim(title);
        if (t.isEmpty()) {
            throw new ApiException(400, "bad_request", "会话标题不能为空");
        }
        if (convMapper.rename(tenantId, id, userId, truncate(t, 100)) == 0) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        return ok();
    }

    @Override
    public Map<String, String> deleteConversation(String id) {
        String tenantId = requireTenant();
        String userId = requireUser();
        int rows = convMapper.delete(QueryBuilder.lambda(AiConversation.class)
            .eq(AiConversation::getTenantId, tenantId)
            .eq(AiConversation::getId, id)
            .eq(AiConversation::getUserId, userId).build());
        if (rows == 0) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        return ok();
    }

    // ==================== 广场 / 挂接 ====================

    @Override
    public ListResponse<AiKnowledgeBase> squareKbs(String q, String tag, String sort, long page, long pageSize,
                                                   String majorId, String departmentId, String kbType, String updated) {
        String tenantId = requireTenant();
        long[] lo = pageLimitOffset(page, pageSize);
        var wrapper = QueryBuilder.lambda(AiKnowledgeBase.class)
            .eq(AiKnowledgeBase::getTenantId, tenantId)
            .eq(AiKnowledgeBase::getStatus, "published");
        wrapper.eqIfText(AiKnowledgeBase::getMajorId, trimToNull(majorId));
        wrapper.eqIfText(AiKnowledgeBase::getDepartmentId, trimToNull(departmentId));
        wrapper.eqIfText(AiKnowledgeBase::getKbType, trimToNull(kbType));
        OffsetDateTime after = updatedAfter(updated);
        if (after != null) {
            wrapper.ge(AiKnowledgeBase::getUpdatedAt, after);
        }
        String kw = trimToNull(q);
        if (kw != null) {
            wrapper.and(w -> w.like(AiKnowledgeBase::getName, kw).or().like(AiKnowledgeBase::getDescription, kw));
        }
        String tagV = trimToNull(tag);
        if (tagV != null) {
            wrapper.apply("tags @> to_jsonb({0}::text)", tagV);
        }
        switch (sort == null ? "hot" : sort) {
            case "docs" -> wrapper.orderByDesc(AiKnowledgeBase::getDocCount).orderByDesc(AiKnowledgeBase::getCreatedAt);
            case "views" -> wrapper.orderByDesc(AiKnowledgeBase::getAskCount).orderByDesc(AiKnowledgeBase::getCreatedAt);
            case "updated" -> wrapper.orderByDesc(AiKnowledgeBase::getUpdatedAt);
            default -> wrapper.orderByDesc(AiKnowledgeBase::getAskCount).orderByDesc(AiKnowledgeBase::getCreatedAt);
        }
        long total = kbMapper.selectCount(wrapper.build());
        wrapper.last("LIMIT " + lo[0] + " OFFSET " + lo[1]);
        List<AiKnowledgeBase> rows = kbMapper.selectList(wrapper.build());
        assembleKbList(rows, tenantId, null);
        return ListResponse.of(rows, total);
    }

    @Override
    public ListResponse<AiAgent> squareAgents(String q, String sort, long page, long pageSize,
                                              String majorId, String departmentId, String updated) {
        String tenantId = requireTenant();
        long[] lo = pageLimitOffset(page, pageSize);
        var wrapper = QueryBuilder.lambda(AiAgent.class)
            .eq(AiAgent::getTenantId, tenantId)
            .eq(AiAgent::getStatus, "published");
        wrapper.eqIfText(AiAgent::getMajorId, trimToNull(majorId));
        wrapper.eqIfText(AiAgent::getDepartmentId, trimToNull(departmentId));
        OffsetDateTime after = updatedAfter(updated);
        if (after != null) {
            wrapper.ge(AiAgent::getUpdatedAt, after);
        }
        String kw = trimToNull(q);
        if (kw != null) {
            wrapper.and(w -> w.like(AiAgent::getName, kw).or().like(AiAgent::getDescription, kw));
        }
        if ("views".equals(sort)) {
            wrapper.orderByDesc(AiAgent::getChatCount).orderByDesc(AiAgent::getCreatedAt);
        } else if ("hot".equals(sort)) {
            wrapper.orderByDesc(AiAgent::getChatCount).orderByDesc(AiAgent::getCreatedAt);
        } else {
            wrapper.orderByDesc(AiAgent::getCreatedAt);
        }
        long total = agentMapper.selectCount(wrapper.build());
        wrapper.last("LIMIT " + lo[0] + " OFFSET " + lo[1]);
        List<AiAgent> rows = agentMapper.selectList(wrapper.build());
        assembleAgentList(rows);
        return ListResponse.of(rows, total);
    }

    @Override
    public List<AiIntegration> listIntegrations(String kind) {
        String tenantId = requireTenant();
        return integrationMapper.selectList(
            QueryBuilder.lambda(AiIntegration.class)
                .eq(AiIntegration::getTenantId, tenantId)
                .eqIfText(AiIntegration::getKind, trimToNull(kind))
                .eq(AiIntegration::getStatus, "active")
                .orderByAsc(AiIntegration::getSort)
                .orderByDesc(AiIntegration::getCreatedAt)
                .last("LIMIT 200").build());
    }

    // ==================== YIKnow ====================

    @Override
    public List<AiConversation> listGeneralConversations() {
        String tenantId = requireTenant();
        String userId = requireUser();
        return convMapper.selectList(
            QueryBuilder.lambda(AiConversation.class)
                .eq(AiConversation::getTenantId, tenantId)
                .isNull(AiConversation::getAgentId)
                .eq(AiConversation::getUserId, userId)
                .orderByDesc(AiConversation::getUpdatedAt)
                .last("LIMIT 100").build());
    }

    @Override
    public ChatStreamResult yiknowChat(String conversationId, String message) {
        String tenantId = requireTenant();
        String userId = requireUser();
        requireConfigured(tenantId);

        AiConversation cv = resolveConversation(tenantId, null, userId, conversationId);

        AiMessage userMsg = new AiMessage();
        userMsg.setTenantId(tenantId);
        userMsg.setConversationId(cv.getId());
        userMsg.setRole("user");
        userMsg.setContent(message);
        userMsg.setSources("[]");
        msgMapper.insert(userMsg);
        convMapper.touch(tenantId, cv.getId(), truncate(message, 30));

        String reply = mockReply(message);
        AiMessage assistantMsg = new AiMessage();
        assistantMsg.setTenantId(tenantId);
        assistantMsg.setConversationId(cv.getId());
        assistantMsg.setRole("assistant");
        assistantMsg.setContent(reply);
        assistantMsg.setSources("[]");
        msgMapper.insert(assistantMsg);
        convMapper.touch(tenantId, cv.getId(), "");
        return new ChatStreamResult(cv.getId(), userMsg.getId(), reply, null, true);
    }

    // ==================== 管理端 ====================

    @Override
    public ListResponse<Object> listReviews(String type, String status, long page, long pageSize) {
        requireTenant();
        requireSchoolAdmin();
        long[] lo = pageLimitOffset(page, pageSize);
        String tenantId = TenantContext.getTenantId();
        if ("kb".equals(type)) {
            var wrapper = QueryBuilder.lambda(AiKnowledgeBase.class).eq(AiKnowledgeBase::getTenantId, tenantId);
            applyReviewStatusKb(wrapper, status);
            long total = kbMapper.selectCount(wrapper.build());
            wrapper.orderByDesc(AiKnowledgeBase::getUpdatedAt).last("LIMIT " + lo[0] + " OFFSET " + lo[1]);
            List<AiKnowledgeBase> rows = kbMapper.selectList(wrapper.build());
            assembleKbList(rows, tenantId, null);
            List<Object> items = new ArrayList<>(rows);
            return ListResponse.of(items, total);
        }
        if ("agent".equals(type)) {
            var wrapper = QueryBuilder.lambda(AiAgent.class).eq(AiAgent::getTenantId, tenantId);
            applyReviewStatusAgent(wrapper, status);
            long total = agentMapper.selectCount(wrapper.build());
            wrapper.orderByDesc(AiAgent::getUpdatedAt).last("LIMIT " + lo[0] + " OFFSET " + lo[1]);
            List<AiAgent> rows = agentMapper.selectList(wrapper.build());
            assembleAgentList(rows);
            List<Object> items = new ArrayList<>(rows);
            return ListResponse.of(items, total);
        }
        throw new ApiException(400, "bad_request", "type 仅支持 kb/agent");
    }

    @Override
    public Map<String, String> reviewAction(String type, String id, String action, String comment) {
        String tenantId = requireTenant();
        String userId = requireUser();
        requireSchoolAdmin();
        String to;
        String from;
        switch (action == null ? "" : action) {
            case "approve" -> {
                to = "published";
                from = "pending";
            }
            case "reject" -> {
                if (trim(comment).isEmpty()) {
                    throw new ApiException(400, "bad_request", "驳回必须填写理由");
                }
                to = "rejected";
                from = "pending";
            }
            case "takedown" -> {
                to = "private";
                from = "published";
            }
            default -> throw new ApiException(400, "bad_request", "不支持的审核动作");
        }
        int rows;
        if ("kb".equals(type)) {
            rows = kbMapper.reviewStatus(tenantId, id, from, to, trim(comment), userId);
        } else if ("agent".equals(type)) {
            rows = agentMapper.reviewStatus(tenantId, id, from, to, trim(comment), userId);
        } else {
            throw new ApiException(400, "bad_request", "type 仅支持 kb/agent");
        }
        if (rows == 0) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作");
        }
        insertReviewLog(tenantId, type, id, action, userId, trim(comment));
        return ok();
    }

    @Override
    public Map<String, Object> adminOverview() {
        String tenantId = requireTenant();
        requireSchoolAdmin();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kbTotal", kbMapper.selectCount(QueryBuilder.lambda(AiKnowledgeBase.class)
            .eq(AiKnowledgeBase::getTenantId, tenantId).build()));
        out.put("kbPending", kbMapper.selectCount(QueryBuilder.lambda(AiKnowledgeBase.class)
            .eq(AiKnowledgeBase::getTenantId, tenantId).eq(AiKnowledgeBase::getStatus, "pending").build()));
        out.put("kbPublished", kbMapper.selectCount(QueryBuilder.lambda(AiKnowledgeBase.class)
            .eq(AiKnowledgeBase::getTenantId, tenantId).eq(AiKnowledgeBase::getStatus, "published").build()));
        out.put("agentTotal", agentMapper.selectCount(QueryBuilder.lambda(AiAgent.class)
            .eq(AiAgent::getTenantId, tenantId).build()));
        out.put("agentPending", agentMapper.selectCount(QueryBuilder.lambda(AiAgent.class)
            .eq(AiAgent::getTenantId, tenantId).eq(AiAgent::getStatus, "pending").build()));
        out.put("agentPublished", agentMapper.selectCount(QueryBuilder.lambda(AiAgent.class)
            .eq(AiAgent::getTenantId, tenantId).eq(AiAgent::getStatus, "published").build()));
        out.put("integrations", integrationMapper.selectCount(QueryBuilder.lambda(AiIntegration.class)
            .eq(AiIntegration::getTenantId, tenantId).eq(AiIntegration::getStatus, "active").build()));
        return out;
    }

    @Override
    public List<AiIntegration> listAdminIntegrations(String kind) {
        String tenantId = requireTenant();
        requireSchoolAdmin();
        return integrationMapper.selectList(
            QueryBuilder.lambda(AiIntegration.class)
                .eq(AiIntegration::getTenantId, tenantId)
                .eqIfText(AiIntegration::getKind, trimToNull(kind))
                .orderByAsc(AiIntegration::getSort)
                .orderByDesc(AiIntegration::getCreatedAt)
                .last("LIMIT 200").build());
    }

    @Override
    public AiIntegration createIntegration(IntegrationInput in) {
        String tenantId = requireTenant();
        String userId = requireUser();
        requireSchoolAdmin();
        validateIntegration(in);
        AiIntegration it = new AiIntegration();
        it.setTenantId(tenantId);
        it.setKind(in.getKind());
        it.setName(trim(in.getName()));
        it.setDescription(trim(in.getDescription()));
        it.setUrl(trim(in.getUrl()));
        it.setIcon(trimToNull(in.getIcon()));
        it.setCategory(trimToNull(in.getCategory()));
        it.setSort(in.getSort() == null ? 0 : in.getSort());
        it.setCreatedBy(userId);
        integrationMapper.insert(it);
        return integrationMapper.selectById(it.getId());
    }

    @Override
    public Map<String, String> updateIntegration(String id, IntegrationInput in) {
        String tenantId = requireTenant();
        requireSchoolAdmin();
        validateIntegration(in);
        AiIntegration it = integrationMapper.selectById(id);
        if (it == null || !tenantId.equals(it.getTenantId())) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        it.setKind(in.getKind());
        it.setName(trim(in.getName()));
        it.setDescription(trim(in.getDescription()));
        it.setUrl(trim(in.getUrl()));
        it.setIcon(trimToNull(in.getIcon()));
        it.setCategory(trimToNull(in.getCategory()));
        it.setSort(in.getSort() == null ? 0 : in.getSort());
        integrationMapper.updateById(it);
        return ok();
    }

    @Override
    public Map<String, String> toggleIntegration(String id, String status) {
        String tenantId = requireTenant();
        requireSchoolAdmin();
        if (!"active".equals(status) && !"inactive".equals(status)) {
            throw new ApiException(400, "bad_request", "status 仅支持 active/inactive");
        }
        if (integrationMapper.setStatus(tenantId, id, status) == 0) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        return ok();
    }

    @Override
    public Map<String, String> deleteIntegration(String id) {
        String tenantId = requireTenant();
        requireSchoolAdmin();
        int rows = integrationMapper.delete(QueryBuilder.lambda(AiIntegration.class)
            .eq(AiIntegration::getTenantId, tenantId)
            .eq(AiIntegration::getId, id).build());
        if (rows == 0) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        return ok();
    }

    // ==================== 权限 / 上下文 ====================

    private String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        return userId;
    }

    private void requireSchoolAdmin() {
        if (!isSchoolAdmin()) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
    }

    private boolean isSchoolAdmin() {
        ZhiyuUser user = currentUser();
        return user != null && "school_admin".equals(user.getRole());
    }

    private ZhiyuUser currentUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            return null;
        }
        try {
            return userMapper.selectById(userId);
        } catch (Exception e) {
            return null;
        }
    }

    // ==================== 可见性 ====================

    private AiKnowledgeBase getKbChecked(String tenantId, String id) {
        AiKnowledgeBase kb = kbMapper.selectById(id);
        if (kb == null || !tenantId.equals(kb.getTenantId())) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        return kb;
    }

    private AiAgent getAgentChecked(String tenantId, String id) {
        AiAgent a = agentMapper.selectById(id);
        if (a == null || !tenantId.equals(a.getTenantId())) {
            throw new ApiException(404, "not_found", "资源不存在或无权访问");
        }
        return a;
    }

    private String resolveKbRole(AiKnowledgeBase kb, String userId, boolean isAdmin) {
        if (kb.getOwnerId().equals(userId)) {
            return "owner";
        }
        AiKbCollaborator collab = collabMapper.selectOne(
            QueryBuilder.lambda(AiKbCollaborator.class)
                .eq(AiKbCollaborator::getTenantId, kb.getTenantId())
                .eq(AiKbCollaborator::getKbId, kb.getId())
                .eq(AiKbCollaborator::getUserId, userId).build());
        if (collab != null) {
            return collab.getRole();
        }
        if ("published".equals(kb.getStatus())) {
            return "member";
        }
        if (isAdmin) {
            return "viewer";
        }
        throw new ApiException(404, "not_found", "资源不存在或无权访问");
    }

    private AiConversation resolveConversation(String tenantId, String agentId, String userId, String conversationId) {
        if (conversationId != null && !conversationId.isBlank()) {
            AiConversation cv = convMapper.selectById(conversationId);
            if (cv == null || !tenantId.equals(cv.getTenantId()) || !cv.getUserId().equals(userId)) {
                throw new ApiException(403, "forbidden", "无权操作");
            }
            if (!java.util.Objects.equals(agentId, cv.getAgentId())) {
                throw new ApiException(403, "forbidden", "无权操作");
            }
            return cv;
        }
        AiConversation cv = new AiConversation();
        cv.setTenantId(tenantId);
        cv.setAgentId(agentId);
        cv.setUserId(userId);
        cv.setTitle("");
        convMapper.insert(cv);
        return cv;
    }

    private void requireConfigured(String tenantId) {
        if (configMapper.selectById(tenantId) == null) {
            throw new ApiException(412, "ai_not_configured", "AI 服务未配置");
        }
    }

    // ==================== 校验 ====================

    private void validateKbInput(KbInput in) {
        if (in == null || isBlank(in.getName())) {
            throw new ApiException(400, "bad_request", "名称必填且不超过 200 字");
        }
        if (runes(in.getName()) > 200) {
            throw new ApiException(400, "bad_request", "名称必填且不超过 200 字");
        }
        if (in.getDescription() != null && runes(in.getDescription()) > 2000) {
            throw new ApiException(400, "bad_request", "描述过长");
        }
        if (in.getKbType() != null && !in.getKbType().isBlank() && !KB_TYPES.contains(in.getKbType())) {
            throw new ApiException(400, "bad_request", "invalid kb type: " + in.getKbType());
        }
    }

    private void validateAgentInput(AgentInput in) {
        if (in == null || isBlank(in.getName()) || runes(in.getName()) > 100) {
            throw new ApiException(400, "bad_request", "名称必填且不超过 100 字");
        }
        if (isBlank(in.getSystemPrompt()) || runes(in.getSystemPrompt()) > 4000) {
            throw new ApiException(400, "bad_request", "提示词必填且不超过 4000 字");
        }
        if (in.getDescription() != null && runes(in.getDescription()) > 500) {
            throw new ApiException(400, "bad_request", "描述/欢迎语不超过 500 字");
        }
        if (in.getGreeting() != null && runes(in.getGreeting()) > 500) {
            throw new ApiException(400, "bad_request", "描述/欢迎语不超过 500 字");
        }
    }

    private void validateIntegration(IntegrationInput in) {
        if (in == null || (!"agent".equals(in.getKind()) && !"app".equals(in.getKind()))) {
            throw new ApiException(400, "bad_request", "挂接配置不合法：kind 仅支持 agent/app");
        }
        if (isBlank(in.getName()) || runes(in.getName()) > 200) {
            throw new ApiException(400, "bad_request", "挂接配置不合法：名称必填且不超过 200 字");
        }
        if (isBlank(in.getUrl()) || (!in.getUrl().startsWith("http://") && !in.getUrl().startsWith("https://"))) {
            throw new ApiException(400, "bad_request", "挂接配置不合法：链接仅支持 http/https");
        }
        if (in.getUrl().length() > 500) {
            throw new ApiException(400, "bad_request", "挂接配置不合法：链接过长");
        }
    }

    private void validateAgentKbLinks(String tenantId, String userId, List<String> kbIds) {
        if (kbIds.size() > 5) {
            throw new ApiException(400, "bad_request", "关联知识库最多 5 个");
        }
        Set<String> seen = new LinkedHashSet<>();
        for (String kbId : kbIds) {
            if (!seen.add(kbId)) {
                continue;
            }
            AiKnowledgeBase kb = kbMapper.selectById(kbId);
            if (kb == null || !tenantId.equals(kb.getTenantId())) {
                throw new ApiException(403, "forbidden", "关联了不可见库");
            }
            try {
                resolveKbRole(kb, userId, false);
            } catch (ApiException e) {
                throw new ApiException(403, "forbidden", "关联了不可见库");
            }
        }
    }

    private void replaceAgentKbs(String tenantId, String agentId, List<String> kbIds) {
        agentKbMapper.delete(QueryBuilder.lambda(AiAgentKb.class)
            .eq(AiAgentKb::getTenantId, tenantId)
            .eq(AiAgentKb::getAgentId, agentId).build());
        for (String kbId : kbIds) {
            AiAgentKb link = new AiAgentKb();
            link.setTenantId(tenantId);
            link.setAgentId(agentId);
            link.setKbId(kbId);
            agentKbMapper.insert(link);
        }
    }

    // ==================== 组装 ====================

    private void assembleKbList(List<AiKnowledgeBase> rows, String tenantId, String userId) {
        if (rows.isEmpty()) {
            return;
        }
        fillKbNames(rows);
        fillOwnerNamesKb(rows);
        Map<String, Long> views = viewMap("ai_kb", rows.stream().map(AiKnowledgeBase::getId).toList());
        for (AiKnowledgeBase kb : rows) {
            kb.setViewCount(views.getOrDefault(kb.getId(), 0L));
            if (userId != null) {
                if (kb.getOwnerId().equals(userId)) {
                    kb.setMyRole("owner");
                }
            }
        }
        if (userId != null) {
            List<String> nonOwnerIds = rows.stream()
                .filter(k -> !k.getOwnerId().equals(userId)).map(AiKnowledgeBase::getId).toList();
            if (!nonOwnerIds.isEmpty()) {
                Map<String, String> roles = collabMapper.selectList(
                        QueryBuilder.lambda(AiKbCollaborator.class)
                            .eq(AiKbCollaborator::getTenantId, tenantId)
                            .eq(AiKbCollaborator::getUserId, userId)
                            .in(AiKbCollaborator::getKbId, nonOwnerIds).build())
                    .stream().collect(Collectors.toMap(AiKbCollaborator::getKbId, AiKbCollaborator::getRole, (a, b) -> a));
                for (AiKnowledgeBase kb : rows) {
                    if (kb.getMyRole() == null) {
                        kb.setMyRole(roles.get(kb.getId()));
                    }
                }
            }
        }
    }

    private void assembleAgentList(List<AiAgent> rows) {
        if (rows.isEmpty()) {
            return;
        }
        fillAgentNames(rows);
        fillOwnerNamesAgent(rows);
        Map<String, Long> views = viewMap("ai_agent", rows.stream().map(AiAgent::getId).toList());
        for (AiAgent a : rows) {
            a.setViewCount(views.getOrDefault(a.getId(), 0L));
        }
    }

    private void fillKbNames(AiKnowledgeBase kb) {
        fillKbNames(List.of(kb));
    }

    private void fillKbNames(List<AiKnowledgeBase> rows) {
        List<String> majorIds = rows.stream().map(AiKnowledgeBase::getMajorId).filter(java.util.Objects::nonNull).toList();
        List<String> deptIds = rows.stream().map(AiKnowledgeBase::getDepartmentId).filter(java.util.Objects::nonNull).toList();
        Map<String, String> majorNames = majorIds.isEmpty() ? Map.of() : nameMap(majorMapper.selectList(
            QueryBuilder.lambda(PortalMajor.class).in(PortalMajor::getId, majorIds).build()));
        Map<String, String> deptNames = deptIds.isEmpty() ? Map.of() : nameMap(orgMapper.selectList(
            QueryBuilder.lambda(PortalOrganization.class).in(PortalOrganization::getId, deptIds).build()));
        for (AiKnowledgeBase kb : rows) {
            kb.setMajorName(kb.getMajorId() == null ? null : majorNames.getOrDefault(kb.getMajorId(), ""));
            kb.setDepartmentName(kb.getDepartmentId() == null ? null : deptNames.getOrDefault(kb.getDepartmentId(), ""));
        }
    }

    private void fillOwnerNamesKb(List<AiKnowledgeBase> rows) {
        Map<String, String> names = userNameMap(rows.stream().map(AiKnowledgeBase::getOwnerId).toList());
        for (AiKnowledgeBase kb : rows) {
            kb.setOwnerName(names.get(kb.getOwnerId()));
        }
    }

    private void fillAgentNames(AiAgent a) {
        fillAgentNames(List.of(a));
    }

    private void fillAgentNames(List<AiAgent> rows) {
        List<String> majorIds = rows.stream().map(AiAgent::getMajorId).filter(java.util.Objects::nonNull).toList();
        List<String> deptIds = rows.stream().map(AiAgent::getDepartmentId).filter(java.util.Objects::nonNull).toList();
        Map<String, String> majorNames = majorIds.isEmpty() ? Map.of() : nameMap(majorMapper.selectList(
            QueryBuilder.lambda(PortalMajor.class).in(PortalMajor::getId, majorIds).build()));
        Map<String, String> deptNames = deptIds.isEmpty() ? Map.of() : nameMap(orgMapper.selectList(
            QueryBuilder.lambda(PortalOrganization.class).in(PortalOrganization::getId, deptIds).build()));
        for (AiAgent a : rows) {
            a.setMajorName(a.getMajorId() == null ? null : majorNames.getOrDefault(a.getMajorId(), ""));
            a.setDepartmentName(a.getDepartmentId() == null ? null : deptNames.getOrDefault(a.getDepartmentId(), ""));
        }
    }

    private void fillOwnerNamesAgent(List<AiAgent> rows) {
        Map<String, String> names = userNameMap(rows.stream().map(AiAgent::getOwnerId).toList());
        for (AiAgent a : rows) {
            a.setOwnerName(names.get(a.getOwnerId()));
        }
    }

    private void fillAgentKbRefs(AiAgent a) {
        List<String> kbIds = agentKbMapper.selectKbIds(a.getTenantId(), a.getId());
        a.setKbIds(kbIds);
        List<String> names = new ArrayList<>();
        for (String kbId : kbIds) {
            AiKnowledgeBase kb = kbMapper.selectById(kbId);
            if (kb != null) {
                names.add(kb.getName());
            }
        }
        a.setKbNames(names);
    }

    private void fillUploaderNames(List<AiKbDocument> docs) {
        Map<String, String> names = userNameMap(docs.stream().map(AiKbDocument::getUploaderId).toList());
        for (AiKbDocument d : docs) {
            d.setUploaderName(names.get(d.getUploaderId()));
        }
    }

    private void fillCollaboratorNames(List<AiKbCollaborator> list) {
        Map<String, String> names = userNameMap(list.stream().map(AiKbCollaborator::getUserId).toList());
        for (AiKbCollaborator c : list) {
            c.setUserName(names.get(c.getUserId()));
        }
    }

    private Map<String, String> nameMap(List<?> rows) {
        Map<String, String> map = new LinkedHashMap<>();
        for (Object row : rows) {
            String id = readField(row, "id");
            String name = readField(row, "name");
            if (id != null && name != null) {
                map.put(id, name);
            }
        }
        return map;
    }

    private Map<String, String> userNameMap(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return Map.of();
        }
        try {
            return userMapper.selectList(QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, ids).build())
                .stream().filter(u -> u.getName() != null)
                .collect(Collectors.toMap(ZhiyuUser::getId, ZhiyuUser::getName, (a, b) -> a));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, Long> viewMap(String targetType, List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return viewCounterMapper.selectList(QueryBuilder.lambda(PortalViewCounter.class)
                    .eq(PortalViewCounter::getTargetType, targetType)
                    .in(PortalViewCounter::getTargetId, ids).build())
                .stream().collect(Collectors.toMap(PortalViewCounter::getTargetId,
                    c -> c.getCnt() == null ? 0L : c.getCnt()));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private void recordView(String targetType, String targetId) {
        try {
            viewCounterMapper.logView(targetType, targetId, TenantContext.getUserId(), TenantContext.getTenantId());
            viewCounterMapper.increment(targetType, targetId);
        } catch (Exception e) {
            log.warn("record view failed, targetType={}, targetId={}", targetType, targetId, e);
        }
    }

    private long viewCount(String targetType, String targetId) {
        return viewMap(targetType, List.of(targetId)).getOrDefault(targetId, 0L);
    }

    private void insertReviewLog(String tenantId, String type, String id, String action, String actorId, String comment) {
        AiReviewLog logRow = new AiReviewLog();
        logRow.setTenantId(tenantId);
        logRow.setTargetType(type);
        logRow.setTargetId(id);
        logRow.setAction(action);
        logRow.setActorId(actorId);
        logRow.setComment(comment == null ? "" : comment);
        reviewLogMapper.insert(logRow);
    }

    // ==================== 工具 ====================

    private void applyReviewStatusKb(org.dromara.common.mybatis.core.query.LambdaQueryBuilder<AiKnowledgeBase> wrapper, String status) {
        if (status != null && !status.isBlank()) {
            wrapper.eq(AiKnowledgeBase::getStatus, status);
        } else {
            wrapper.in(AiKnowledgeBase::getStatus, List.of("pending", "published", "rejected"));
        }
    }

    private void applyReviewStatusAgent(org.dromara.common.mybatis.core.query.LambdaQueryBuilder<AiAgent> wrapper, String status) {
        if (status != null && !status.isBlank()) {
            wrapper.eq(AiAgent::getStatus, status);
        } else {
            wrapper.in(AiAgent::getStatus, List.of("pending", "published", "rejected"));
        }
    }

    private String mockReply(String message) {
        return "演示回复：已收到「" + truncate(message == null ? "" : message, 40) + "」";
    }

    private List<String> normalizeTags(List<String> tags) {
        if (tags == null) {
            return new ArrayList<>();
        }
        Set<String> seen = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();
        for (String t : tags) {
            String v = trim(t);
            if (v.isEmpty() || runes(v) > 30 || seen.contains(v)) {
                continue;
            }
            seen.add(v);
            out.add(v);
            if (out.size() >= 10) {
                break;
            }
        }
        return out;
    }

    private long[] pageLimitOffset(long page, long pageSize) {
        long p = page < 1 ? 1 : page;
        long s = pageSize < 1 || pageSize > 50 ? 20 : pageSize;
        return new long[]{s, (p - 1) * s};
    }

    private OffsetDateTime updatedAfter(String updated) {
        if ("7d".equals(updated)) {
            return OffsetDateTime.now().minusDays(7);
        }
        if ("30d".equals(updated)) {
            return OffsetDateTime.now().minusDays(30);
        }
        if ("180d".equals(updated)) {
            return OffsetDateTime.now().minusDays(180);
        }
        return null;
    }

    private String extensionOf(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot).toLowerCase();
    }

    private static Map<String, String> ok() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("status", "ok");
        return m;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static int runes(String s) {
        return s == null ? 0 : s.codePointCount(0, s.length());
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        if (s.codePointCount(0, s.length()) <= max) {
            return s;
        }
        return s.substring(0, s.offsetByCodePoints(0, max));
    }

    private static String readField(Object row, String field) {
        try {
            var pd = org.springframework.beans.BeanUtils.getPropertyDescriptor(row.getClass(), field);
            if (pd == null || pd.getReadMethod() == null) {
                return null;
            }
            Object v = pd.getReadMethod().invoke(row);
            return v == null ? null : v.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
