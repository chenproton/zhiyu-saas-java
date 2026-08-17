package org.dromara.zhiyu.service.ai;

import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.domain.ai.AiAgent;
import org.dromara.zhiyu.domain.ai.AiConversation;
import org.dromara.zhiyu.domain.ai.AiIntegration;
import org.dromara.zhiyu.domain.ai.AiKbAsk;
import org.dromara.zhiyu.domain.ai.AiKbCollaborator;
import org.dromara.zhiyu.domain.ai.AiKbDocument;
import org.dromara.zhiyu.domain.ai.AiKnowledgeBase;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AgentInput;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.IntegrationInput;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.KbInput;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/**
 * AI 智能服务中心服务（对齐 Go AICenterService）。
 *
 * @author zhiyu
 */
public interface IAiCenterService {

    // ---------- 知识库 ----------

    ListResponse<AiKnowledgeBase> listKbs(String scope, String q, long page, long pageSize);

    AiKnowledgeBase createKb(KbInput in);

    AiKnowledgeBase getKb(String id);

    Map<String, String> updateKb(String id, KbInput in);

    Map<String, String> deleteKb(String id);

    Map<String, String> submitKb(String id);

    Map<String, String> unpublishKb(String id);

    // ---------- 文档 ----------

    List<AiKbDocument> listDocuments(String kbId);

    AiKbDocument getDocument(String kbId, String docId);

    AiKbDocument uploadDocument(String kbId, MultipartFile file);

    Map<String, String> deleteDocument(String kbId, String docId);

    // ---------- 协作者 ----------

    List<AiKbCollaborator> listCollaborators(String kbId);

    Map<String, String> addCollaborator(String kbId, String userId, String role);

    Map<String, String> removeCollaborator(String kbId, String userId);

    // ---------- 问答 ----------

    List<AiKbAsk> listMyKbAsks(String kbId);

    ChatStreamResult kbAsk(String kbId, String message);

    // ---------- 智能体 ----------

    List<AiAgent> listAgents();

    AiAgent createAgent(AgentInput in);

    AiAgent getAgent(String id);

    Map<String, String> updateAgent(String id, AgentInput in);

    Map<String, String> deleteAgent(String id);

    Map<String, Object> submitAgent(String id);

    Map<String, String> unpublishAgent(String id);

    ChatStreamResult agentChat(String agentId, String conversationId, String message);

    Map<String, String> previewAgent(String agentId, String systemPrompt, String message);

    // ---------- 会话 ----------

    List<AiConversation> listConversations(String agentId);

    Map<String, Object> getConversation(String id);

    Map<String, String> renameConversation(String id, String title);

    Map<String, String> deleteConversation(String id);

    // ---------- 广场 / 挂接 ----------

    ListResponse<AiKnowledgeBase> squareKbs(String q, String tag, String sort, long page, long pageSize,
                                            String majorId, String departmentId, String kbType, String updated);

    ListResponse<AiAgent> squareAgents(String q, String sort, long page, long pageSize,
                                       String majorId, String departmentId, String updated);

    List<AiIntegration> listIntegrations(String kind);

    // ---------- YIKnow 通用会话 ----------

    List<AiConversation> listGeneralConversations();

    ChatStreamResult yiknowChat(String conversationId, String message);

    // ---------- 管理端 ----------

    ListResponse<Object> listReviews(String type, String status, long page, long pageSize);

    Map<String, String> reviewAction(String type, String id, String action, String comment);

    Map<String, Object> adminOverview();

    List<AiIntegration> listAdminIntegrations(String kind);

    AiIntegration createIntegration(IntegrationInput in);

    Map<String, String> updateIntegration(String id, IntegrationInput in);

    Map<String, String> toggleIntegration(String id, String status);

    Map<String, String> deleteIntegration(String id);
}
