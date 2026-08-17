package org.dromara.zhiyu.domain.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.util.List;

/**
 * AI 域 DTO（对齐 Go ai/ai-center 相关 handler 与 shared-types）。
 *
 * @author zhiyu
 */
public final class AiDtos {

    private AiDtos() {
    }

    // ---------- AI 配置 / 用量 ----------

    /** 保存 AI 配置请求（apiKey 留空表示不修改） */
    @Data
    public static class SaveAIConfigRequest {
        private String baseUrl;
        private String apiKey;
        private String model;
    }

    /** AI 配置视图（永不包含明文/密文 api key） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AIConfigView {
        private boolean configured;
        private String baseUrl;
        private String model;
        private String apiKeyMasked;
    }

    /** 对话消息（OpenAI chat 格式） */
    @Data
    public static class ChatMessage {
        private String role;
        private String content;
    }

    /** 对话请求 */
    @Data
    public static class AIChatRequest {
        private List<ChatMessage> messages;
        private Double temperature;
        private Integer maxTokens;
    }

    /** 用量 */
    @Data
    public static class Usage {
        private int promptTokens;
        private int completionTokens;
        private int totalTokens;
    }

    /** 对话响应 */
    @Data
    public static class AIChatResponse {
        private String reply;
        private Usage usage;
    }

    /** 单日用量 */
    @Data
    public static class AIUsageDay {
        private String date;
        private long tokens;
        private long requests;
    }

    /** 用量统计 */
    @Data
    public static class AIUsageStats {
        private long totalRequests;
        private long totalTokens;
        private long tokenQuota;
        private List<AIUsageDay> daily;
    }

    // ---------- 岗位 / 场景 AI 辅助 ----------

    /** 岗位辅助请求 */
    @Data
    public static class PositionAssistRequest {
        private String field;
        private PositionAssistInput position;
    }

    /** 岗位辅助上下文 */
    @Data
    public static class PositionAssistInput {
        private String name;
        private String shortName;
        private String industry;
        private List<String> majors;
        private int[] salaryRange;
        private String description;
        private List<String> responsibilities;
        private List<String> requirements;
        private String careerPath;
        private String responsibilityName;
        private List<PositionAbilityContext> abilities;
    }

    /** 能力绑定上下文 */
    @Data
    public static class PositionAbilityContext {
        private String name;
        private String domain;
        private List<String> attributes;
        private String description;
    }

    /** 岗位辅助响应（仅含请求 field 对应字段） */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PositionAssistResponse {
        private String field;
        private PositionPolish polish;
        private List<String> responsibilities;
        private List<String> requirements;
        private String careerPath;
        private List<SuggestedCertificate> certificates;
        private List<SuggestedAbility> abilities;
        private List<CompetencyFill> competencies;
    }

    @Data
    public static class PositionPolish {
        private String name;
        private String shortName;
        private String description;
        private int salaryMin;
        private int salaryMax;
    }

    @Data
    public static class SuggestedCertificate {
        private String name;
        private String description;
        private String url;
    }

    @Data
    public static class SuggestedAbility {
        private String name;
        private String domain;
        private List<String> attributes;
        private String rubricDescription;
    }

    @Data
    public static class CompetencyFill {
        private String name;
        private String level;
        private String rubricDescription;
    }

    /** 场景辅助请求 */
    @Data
    public static class ScenarioAssistRequest {
        private String field;
        private ScenarioAssistInput scenario;
    }

    /** 场景辅助上下文 */
    @Data
    public static class ScenarioAssistInput {
        private String name;
        private String background;
        private int difficulty;
        private List<String> industryNames;
        private List<String> professionNames;
        private String positionId;
        private String positionName;
        private String taskName;
        private String taskBackground;
        private String taskDescription;
        private int taskDifficulty;
        private List<ScenarioExistingTask> existingTasks;
        private String intention;
    }

    @Data
    public static class ScenarioExistingTask {
        private String name;
        private String type;
        private int difficulty;
    }

    /** 场景辅助响应 */
    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ScenarioAssistResponse {
        private String field;
        private ScenarioPolish polish;
        private List<ScenarioSuggestion> industrySuggestions;
        private List<ScenarioSuggestion> professionSuggestions;
        private ScenarioSuggestion positionSuggestion;
        private ScenarioTaskPolish task;
        private String taskDescription;
        private List<ScenarioSuggestion> suggestions;
        private ScenarioTaskChain chain;
    }

    @Data
    public static class ScenarioPolish {
        private String name;
        private String background;
        private int difficulty;
    }

    @Data
    public static class ScenarioTaskPolish {
        private String name;
        private String background;
        private int difficulty;
    }

    @Data
    public static class ScenarioSuggestion {
        private String name;
        private String description;
        private String type;
        private String matchedId;
        private String matchedName;
    }

    @Data
    public static class ScenarioTaskChain {
        private int taskCount;
        private int assessmentCount;
        private int trainingCount;
        private List<ScenarioTaskChainTask> tasks;
    }

    @Data
    public static class ScenarioTaskChainTask {
        private String name;
        private String type;
        private int difficulty;
        private int estimatedHours;
        private String description;
    }

    // ---------- ai-center 请求体 ----------

    /** 知识库创建/编辑输入 */
    @Data
    public static class KbInput {
        private String name;
        private String description;
        private List<String> tags;
        private String coverImage;
        private String majorId;
        private String departmentId;
        private String kbType;
    }

    /** 智能体创建/编辑输入 */
    @Data
    public static class AgentInput {
        private String name;
        private String avatar;
        private String description;
        private String coverImage;
        private String greeting;
        private String systemPrompt;
        private List<String> kbIds;
        private String majorId;
        private String departmentId;
    }

    /** 协作者请求 */
    @Data
    public static class CollaboratorRequest {
        private String userId;
        private String role;
    }

    /** 流式对话请求（SSE） */
    @Data
    public static class ChatStreamRequest {
        private String conversationId;
        private String message;
    }

    /** 智能体预览请求 */
    @Data
    public static class PreviewAgentRequest {
        private String systemPrompt;
        private String message;
    }

    /** 会话重命名请求 */
    @Data
    public static class RenameConversationRequest {
        private String title;
    }

    /** 审核动作请求 */
    @Data
    public static class ReviewActionRequest {
        private String comment;
    }

    /** 第三方挂接输入 */
    @Data
    public static class IntegrationInput {
        private String kind;
        private String name;
        private String description;
        private String url;
        private String icon;
        private String category;
        private Integer sort;
    }

    /** 挂接上下架请求 */
    @Data
    public static class IntegrationToggleRequest {
        private String status;
    }
}
