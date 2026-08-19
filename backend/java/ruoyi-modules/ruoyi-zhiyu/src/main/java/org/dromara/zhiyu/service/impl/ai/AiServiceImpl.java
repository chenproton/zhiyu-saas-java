package org.dromara.zhiyu.service.impl.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.crypto.AesGcm;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.ai.AiUsageLog;
import org.dromara.zhiyu.domain.ai.TenantAiConfig;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIChatRequest;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIChatResponse;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIConfigView;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIUsageDay;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIUsageStats;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ChatMessage;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.CompetencyFill;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.PositionAssistInput;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.PositionAssistResponse;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.PositionPolish;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.SaveAIConfigRequest;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ScenarioAssistInput;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ScenarioAssistResponse;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ScenarioPolish;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ScenarioSuggestion;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ScenarioTaskChain;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ScenarioTaskChainTask;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ScenarioTaskPolish;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.SuggestedAbility;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.SuggestedCertificate;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.Usage;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.ai.AiUsageLogMapper;
import org.dromara.zhiyu.mapper.ai.TenantAiConfigMapper;
import org.dromara.zhiyu.service.ai.IAiService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * 租户 AI 配置/用量/统一对话服务实现（对齐 Go service/ai.go + ai/stream.go）。
 *
 * <p>LLM 调用统一经本服务发起（流式经 chatStream，非流式经 chat）；
 * api_key 永不下发前端、不打日志（红线）。</p>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class AiServiceImpl implements IAiService {

    /** 岗位辅助 field 枚举（对齐 Go PositionAssistField） */
    private static final List<String> POSITION_FIELDS =
        List.of("polish", "responsibilities", "requirements", "careerPath", "certificates", "abilities", "competency");

    /** 场景辅助 field 枚举（对齐 Go ScenarioAssistField） */
    private static final List<String> SCENARIO_FIELDS =
        List.of("polish", "taskPolish", "taskDescription", "taskKnowledge", "taskAbility", "taskResource", "taskChain");

    private final TenantAiConfigMapper configMapper;
    private final AiUsageLogMapper usageMapper;
    private final ZhiyuUserMapper userMapper;

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final HttpClient HTTP = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10)).build();

    /** 与 Go AI_CONFIG_SECRET 同源的密钥（AES-256-GCM 派生）。 */
    @Value("${AI_CONFIG_SECRET:}")
    private String aiConfigSecret;

    // ---------- 配置 ----------

    @Override
    public AIConfigView getConfig(String tenantId) {
        TenantAiConfig cfg = configMapper.selectById(tenantId);
        if (cfg == null) {
            AIConfigView view = new AIConfigView();
            view.setConfigured(false);
            return view;
        }
        AIConfigView view = new AIConfigView();
        view.setConfigured(true);
        view.setBaseUrl(cfg.getBaseUrl());
        view.setModel(cfg.getModel());
        view.setApiKeyMasked(maskApiKey(decryptKeyOrPlaintext(cfg.getApiKeyEncrypted())));
        return view;
    }

    @Override
    public void saveConfig(String tenantId, SaveAIConfigRequest req) {
        if (isBlank(req.getBaseUrl()) || isBlank(req.getModel())) {
            throw new ApiException(400, "bad_request", "baseUrl 与 model 不能为空");
        }
        String keyToStore = req.getApiKey();
        if (isBlank(keyToStore)) {
            TenantAiConfig existing = configMapper.selectById(tenantId);
            if (existing == null) {
                throw new ApiException(400, "bad_request", "首次配置必须填写 apiKey");
            }
            keyToStore = decryptKeyOrPlaintext(existing.getApiKeyEncrypted());
        }
        TenantAiConfig cfg = new TenantAiConfig();
        cfg.setTenantId(tenantId);
        cfg.setBaseUrl(req.getBaseUrl());
        cfg.setApiKeyEncrypted(encryptKey(keyToStore));
        cfg.setModel(req.getModel());
        configMapper.upsert(cfg);
    }

    @Override
    public void deleteConfig(String tenantId) {
        configMapper.deleteById(tenantId);
    }

    // ---------- 用量 ----------

    @Override
    public AIUsageStats getUsage(String tenantId) {
        long totalRequests = usageMapper.selectCount(
            QueryBuilder.lambda(AiUsageLog.class).eq(AiUsageLog::getTenantId, tenantId).build());
        long totalTokens = usageMapper.sumTokens(tenantId);

        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime today = now.toLocalDate().atStartOfDay(now.getOffset()).toOffsetDateTime();
        OffsetDateTime since = today.minusDays(29);
        List<Map<String, Object>> rows = usageMapper.daily(tenantId, since);
        Map<String, long[]> byDay = new HashMap<>();
        for (Map<String, Object> row : rows) {
            String date = String.valueOf(row.get("date"));
            byDay.put(date, new long[]{toLong(row.get("tokens")), toLong(row.get("requests"))});
        }
        List<AIUsageDay> daily = new ArrayList<>(30);
        for (int i = 0; i < 30; i++) {
            String key = since.plusDays(i).toLocalDate().toString();
            long[] v = byDay.get(key);
            AIUsageDay d = new AIUsageDay();
            d.setDate(key);
            d.setTokens(v == null ? 0 : v[0]);
            d.setRequests(v == null ? 0 : v[1]);
            daily.add(d);
        }
        AIUsageStats stats = new AIUsageStats();
        stats.setTotalRequests(totalRequests);
        stats.setTotalTokens(totalTokens);
        stats.setTokenQuota(0);
        stats.setDaily(daily);
        return stats;
    }

    // ---------- 对话 / 辅助 ----------

    @Override
    public AIChatResponse chat(String tenantId, String userId, AIChatRequest req) {
        TenantAiConfig cfg = requireConfigured(tenantId);
        ChatResult result = chatCompletion(cfg,
            req == null ? List.of() : (req.getMessages() == null ? List.of() : req.getMessages()),
            req == null ? null : req.getTemperature(), req == null ? null : req.getMaxTokens());
        Usage usage = new Usage();
        usage.setPromptTokens(result.promptTokens());
        usage.setCompletionTokens(result.completionTokens());
        usage.setTotalTokens(result.totalTokens());
        recordUsage(tenantId, userId, cfg.getModel(), usage);
        AIChatResponse resp = new AIChatResponse();
        resp.setReply(result.reply());
        resp.setUsage(usage);
        return resp;
    }

    @Override
    public String chatStream(String tenantId, String userId, AIChatRequest req, Consumer<String> onDelta) {
        TenantAiConfig cfg = requireConfigured(tenantId);
        List<ChatMessage> messages = req == null ? List.of()
            : (req.getMessages() == null ? List.of() : req.getMessages());
        ChatResult result = chatCompletionStream(cfg, messages,
            req == null ? null : req.getTemperature(), req == null ? null : req.getMaxTokens(), onDelta);
        Usage usage = new Usage();
        usage.setPromptTokens(result.promptTokens());
        usage.setCompletionTokens(result.completionTokens());
        usage.setTotalTokens(result.totalTokens());
        recordUsage(tenantId, userId, cfg.getModel(), usage);
        return result.reply();
    }

    @Override
    public PositionAssistResponse positionAssist(String tenantId, String userId, String field, PositionAssistInput input) {
        TenantAiConfig cfg = requireConfigured(tenantId);
        if (field == null || !POSITION_FIELDS.contains(field)) {
            throw new ApiException(400, "bad_request", "field 不合法");
        }
        String prompt = positionAssistPrompt(field, input);
        PositionAssistResponse resp = new PositionAssistResponse();
        resp.setField(field);
        chatJSON(cfg, List.of(sysMsg(POSITION_SYSTEM_PROMPT), userMsg(prompt)), text -> parsePositionAssist(field, text, resp));
        return resp;
    }

    @Override
    public ScenarioAssistResponse scenarioAssist(String tenantId, String userId, String field, ScenarioAssistInput input) {
        TenantAiConfig cfg = requireConfigured(tenantId);
        if (field == null || !SCENARIO_FIELDS.contains(field)) {
            throw new ApiException(400, "bad_request", "field 不合法");
        }
        String prompt = scenarioAssistPrompt(field, input);
        ScenarioAssistResponse resp = new ScenarioAssistResponse();
        resp.setField(field);
        chatJSON(cfg, List.of(sysMsg(SCENARIO_SYSTEM_PROMPT), userMsg(prompt)), text -> parseScenarioAssist(field, text, resp));
        return resp;
    }

    // ---------- 结构化 AI 辅助（真实 LLM） ----------

    private static final String POSITION_SYSTEM_PROMPT =
        "你是一名资深的企业岗位职业标准建设专家，擅长撰写规范、专业的岗位职业描述文档。\n"
        + "要求：只输出 JSON，不要输出任何解释、Markdown 代码块或额外文字；所有内容使用简体中文。";
    private static final String SCENARIO_SYSTEM_PROMPT =
        "你是一名资深的实践场景教学设计专家，擅长设计面向职业教育的实践场景与任务链。\n"
        + "要求：只输出 JSON，不要输出任何解释、Markdown 代码块或额外文字；所有内容使用简体中文。";

    private ChatMessage sysMsg(String content) {
        ChatMessage m = new ChatMessage();
        m.setRole("system");
        m.setContent(content);
        return m;
    }

    private ChatMessage userMsg(String content) {
        ChatMessage m = new ChatMessage();
        m.setRole("user");
        m.setContent(content);
        return m;
    }

    private ChatMessage assistantMsg(String content) {
        ChatMessage m = new ChatMessage();
        m.setRole("assistant");
        m.setContent(content);
        return m;
    }

    private void chatJSON(TenantAiConfig cfg, List<ChatMessage> messages,
                          java.util.function.Function<String, Boolean> parse) {
        String text = chatCompletion(cfg, messages, 0.4, null).reply();
        if (parse.apply(text)) {
            return;
        }
        List<ChatMessage> repair = new ArrayList<>(messages);
        repair.add(assistantMsg(text));
        repair.add(userMsg("上面的输出不是合法 JSON，请重新输出：只输出一个 JSON 对象，不要 Markdown 代码块、注释或任何额外文字。"));
        text = chatCompletion(cfg, repair, 0.4, null).reply();
        parse.apply(text);
    }

    private String extractJSONObject(String text) {
        String t = text == null ? "" : text.trim();
        if (t.startsWith("```")) {
            int nl = t.indexOf('\n');
            if (nl > 0) {
                t = t.substring(nl + 1);
            }
            int end = t.lastIndexOf("```");
            if (end > 0) {
                t = t.substring(0, end).trim();
            }
        }
        int start = t.indexOf('{');
        int end = t.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        return t.substring(start, end + 1);
    }

    private List<String> textArray(JsonNode node) {
        List<String> out = new ArrayList<>();
        if (node.isArray()) {
            for (JsonNode n : node) {
                out.add(n.asText(""));
            }
        }
        return out;
    }

    private boolean parsePositionAssist(String field, String text, PositionAssistResponse resp) {
        String json = extractJSONObject(text);
        if (json == null) {
            return false;
        }
        try {
            JsonNode root = JSON.readTree(json);
            switch (field) {
                case "polish" -> {
                    PositionPolish p = new PositionPolish();
                    p.setName(root.path("name").asText(""));
                    p.setShortName(root.path("shortName").asText(""));
                    p.setDescription(root.path("description").asText(""));
                    p.setSalaryMin(root.path("salaryMin").asInt(0));
                    p.setSalaryMax(root.path("salaryMax").asInt(0));
                    resp.setPolish(p);
                    return !p.getName().isEmpty();
                }
                case "responsibilities" -> {
                    resp.setResponsibilities(textArray(root.path("responsibilities")));
                    return !resp.getResponsibilities().isEmpty();
                }
                case "requirements" -> {
                    resp.setRequirements(textArray(root.path("requirements")));
                    return !resp.getRequirements().isEmpty();
                }
                case "careerPath" -> {
                    resp.setCareerPath(root.path("careerPath").asText(""));
                    return !resp.getCareerPath().isEmpty();
                }
                case "certificates" -> {
                    List<SuggestedCertificate> list = new ArrayList<>();
                    for (JsonNode n : root.path("certificates")) {
                        SuggestedCertificate c = new SuggestedCertificate();
                        c.setName(n.path("name").asText(""));
                        c.setDescription(n.path("description").asText(""));
                        c.setUrl(n.path("url").asText(""));
                        list.add(c);
                    }
                    resp.setCertificates(list);
                    return !list.isEmpty();
                }
                case "abilities" -> {
                    List<SuggestedAbility> list = new ArrayList<>();
                    for (JsonNode n : root.path("abilities")) {
                        SuggestedAbility a = new SuggestedAbility();
                        a.setName(n.path("name").asText(""));
                        a.setDomain(n.path("domain").asText(""));
                        a.setAttributes(textArray(n.path("attributes")));
                        a.setRubricDescription(n.path("rubricDescription").asText(""));
                        list.add(a);
                    }
                    resp.setAbilities(list);
                    return !list.isEmpty();
                }
                case "competency" -> {
                    List<CompetencyFill> list = new ArrayList<>();
                    for (JsonNode n : root.path("competencies")) {
                        CompetencyFill f = new CompetencyFill();
                        f.setName(n.path("name").asText(""));
                        f.setLevel(n.path("level").asText(""));
                        f.setRubricDescription(n.path("rubricDescription").asText(""));
                        list.add(f);
                    }
                    resp.setCompetencies(list);
                    return !list.isEmpty();
                }
                default -> {
                    return false;
                }
            }
        } catch (Exception e) {
            return false;
        }
    }

    private boolean parseScenarioAssist(String field, String text, ScenarioAssistResponse resp) {
        String json = extractJSONObject(text);
        if (json == null) {
            return false;
        }
        try {
            JsonNode root = JSON.readTree(json);
            switch (field) {
                case "polish" -> {
                    ScenarioPolish p = new ScenarioPolish();
                    p.setName(root.path("name").asText(""));
                    p.setBackground(root.path("background").asText(""));
                    p.setDifficulty(root.path("difficulty").asInt(0));
                    resp.setPolish(p);
                    return !p.getName().isEmpty();
                }
                case "taskPolish" -> {
                    ScenarioTaskPolish t = new ScenarioTaskPolish();
                    t.setName(root.path("name").asText(""));
                    t.setBackground(root.path("background").asText(""));
                    t.setDifficulty(root.path("difficulty").asInt(0));
                    resp.setTask(t);
                    return !t.getName().isEmpty();
                }
                case "taskDescription" -> {
                    resp.setTaskDescription(root.path("taskDescription").asText(""));
                    return !resp.getTaskDescription().isEmpty();
                }
                case "taskKnowledge", "taskAbility", "taskResource" -> {
                    List<ScenarioSuggestion> list = new ArrayList<>();
                    for (JsonNode n : root.path("suggestions")) {
                        ScenarioSuggestion s = new ScenarioSuggestion();
                        s.setName(n.path("name").asText(""));
                        s.setDescription(n.path("description").asText(""));
                        list.add(s);
                    }
                    resp.setSuggestions(list);
                    return !list.isEmpty();
                }
                case "taskChain" -> {
                    ScenarioTaskChain chain = new ScenarioTaskChain();
                    chain.setTaskCount(root.path("taskCount").asInt(0));
                    chain.setAssessmentCount(root.path("assessmentCount").asInt(0));
                    chain.setTrainingCount(root.path("trainingCount").asInt(0));
                    List<ScenarioTaskChainTask> tasks = new ArrayList<>();
                    for (JsonNode n : root.path("tasks")) {
                        ScenarioTaskChainTask t = new ScenarioTaskChainTask();
                        t.setName(n.path("name").asText(""));
                        t.setType(n.path("type").asText(""));
                        t.setDifficulty(n.path("difficulty").asInt(0));
                        t.setEstimatedHours(n.path("estimatedHours").asInt(0));
                        t.setDescription(n.path("description").asText(""));
                        tasks.add(t);
                    }
                    chain.setTasks(tasks);
                    resp.setChain(chain);
                    return !tasks.isEmpty();
                }
                default -> {
                    return false;
                }
            }
        } catch (Exception e) {
            return false;
        }
    }

    private String positionAssistPrompt(String field, PositionAssistInput in) {
        String task;
        String spec;
        switch (field) {
            case "polish" -> {
                task = "润色该岗位的基础信息：1.岗位名称：更专业规范的叫法；2.岗位简称：简短称呼（不超过 8 字）；3.岗位简介：150 字以内；4.参考薪资范围（元/月）。";
                spec = "{\"name\": \"string\", \"shortName\": \"string\", \"description\": \"string\", \"salaryMin\": number, \"salaryMax\": number}";
            }
            case "responsibilities" -> {
                task = "将工作职责拆解为 5-8 条专业条目：每条以动词开头、一句话、不超过 40 字。";
                spec = "{\"responsibilities\": [\"string\"]}";
            }
            case "requirements" -> {
                task = "输出 5-8 条任职要求，覆盖学历专业、经验、专业技能、软素质等维度。";
                spec = "{\"requirements\": [\"string\"]}";
            }
            case "careerPath" -> {
                task = "给出该岗位的纵向晋升路径，用 → 连接各阶段。";
                spec = "{\"careerPath\": \"string\"}";
            }
            case "certificates" -> {
                task = "推荐 2-3 个相关职业资格证书：name 为证书全称，description 为一句介绍，url 为官网地址（不确定时留空）。";
                spec = "{\"certificates\": [{\"name\": \"string\", \"description\": \"string\", \"url\": \"string\"}]}";
            }
            case "abilities" -> {
                task = "针对这条工作职责拆解 3-5 个岗位能力点：name（名词短语）、domain（岗位与行业认知/专业知识/专业技能/通用能力/职业素养/价值观）、attributes（知识/素养/技能选 1）、rubricDescription（一句话胜任标准）。";
                spec = "{\"abilities\": [{\"name\": \"string\", \"domain\": \"string\", \"attributes\": [\"string\"], \"rubricDescription\": \"string\"}]}";
            }
            case "competency" -> {
                task = "为能力点清单中的每个能力点输出：level（understand/comprehend/master/proficient/expert）与 rubricDescription（胜任标准，40-60 字）。";
                spec = "{\"competencies\": [{\"name\": \"string\", \"level\": \"string\", \"rubricDescription\": \"string\"}]}";
            }
            default -> {
                return "";
            }
        }
        StringBuilder sb = new StringBuilder("岗位信息：\n- 岗位名称：" + (in == null ? "" : in.getName()) + "\n");
        if (in != null && in.getIndustry() != null && !in.getIndustry().isEmpty()) {
            sb.append("- 所属行业：").append(in.getIndustry()).append("\n");
        }
        if (in != null && in.getDescription() != null && !in.getDescription().isEmpty()) {
            sb.append("- 岗位简介：").append(in.getDescription()).append("\n");
        }
        if (in != null && in.getResponsibilities() != null) {
            sb.append("- 工作职责：\n");
            for (String r : in.getResponsibilities()) {
                sb.append("  · ").append(r).append("\n");
            }
        }
        sb.append("\n任务：").append(task).append("\n\n输出格式（严格 JSON）：").append(spec);
        return sb.toString();
    }

    private String scenarioAssistPrompt(String field, ScenarioAssistInput in) {
        String task;
        String spec;
        switch (field) {
            case "polish" -> {
                task = "润色该实践场景：name 更专业规范，background 为一句话背景（80 字以内），difficulty 为 1-5 整数。";
                spec = "{\"name\": \"string\", \"background\": \"string\", \"difficulty\": number}";
            }
            case "taskPolish" -> {
                task = "润色该场景任务：name 更专业规范，background 为一句话背景，difficulty 为 1-5 整数。";
                spec = "{\"name\": \"string\", \"background\": \"string\", \"difficulty\": number}";
            }
            case "taskDescription" -> {
                task = "为该场景任务撰写详细任务说明（120 字以内）。";
                spec = "{\"taskDescription\": \"string\"}";
            }
            case "taskKnowledge", "taskAbility", "taskResource" -> {
                task = "推荐 3-5 个相关条目：name 为条目名称，description 为一句说明。";
                spec = "{\"suggestions\": [{\"name\": \"string\", \"description\": \"string\"}]}";
            }
            case "taskChain" -> {
                task = "为该实践场景设计任务链：包含若干任务，每个任务有 name/type/difficulty/estimatedHours/description。";
                spec = "{\"taskCount\": number, \"assessmentCount\": number, \"trainingCount\": number, \"tasks\": [{\"name\": \"string\", \"type\": \"string\", \"difficulty\": number, \"estimatedHours\": number, \"description\": \"string\"}]}";
            }
            default -> {
                return "";
            }
        }
        StringBuilder sb = new StringBuilder("场景信息：\n- 场景名称：" + (in == null ? "" : in.getName()) + "\n");
        if (in != null && in.getBackground() != null && !in.getBackground().isEmpty()) {
            sb.append("- 场景背景：").append(in.getBackground()).append("\n");
        }
        if (in != null && in.getTaskName() != null && !in.getTaskName().isEmpty()) {
            sb.append("- 任务名称：").append(in.getTaskName()).append("\n");
        }
        sb.append("\n任务：").append(task).append("\n\n输出格式（严格 JSON）：").append(spec);
        return sb.toString();
    }

    // ---------- 权限 ----------

    @Override
    public void requireManagePortal() {
        ZhiyuUser user = currentUser();
        if (user == null || "student".equals(user.getRole())) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
    }

    // ---------- 内部工具 ----------

    private TenantAiConfig requireConfigured(String tenantId) {
        TenantAiConfig cfg = configMapper.selectById(tenantId);
        if (cfg == null) {
            throw new ApiException(412, "ai_not_configured", "AI 服务未配置");
        }
        return cfg;
    }

    /** 真实 OpenAI 兼容对话调用（对齐 Go ai.Client.ChatCompletion + service/ai.go Chat）。 */
    private ChatResult chatCompletion(TenantAiConfig cfg, List<ChatMessage> messages, Double temperature,
                                      Integer maxTokens) {
        String apiKey = decryptKeyOrPlaintext(cfg.getApiKeyEncrypted());
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", cfg.getModel());
            List<Map<String, String>> msgs = new ArrayList<>();
            for (ChatMessage m : messages) {
                Map<String, String> mm = new LinkedHashMap<>();
                mm.put("role", m.getRole());
                mm.put("content", m.getContent());
                msgs.add(mm);
            }
            body.put("messages", msgs);
            if (temperature != null) {
                body.put("temperature", temperature);
            }
            if (maxTokens != null) {
                body.put("max_tokens", maxTokens);
            }
            String url = cfg.getBaseUrl().replaceAll("/+$", "") + "/chat/completions";
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body), StandardCharsets.UTF_8))
                .build();
            HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                String msg = "upstream returned status " + resp.statusCode();
                try {
                    JsonNode em = JSON.readTree(resp.body()).path("error").path("message");
                    if (!em.isMissingNode() && !em.asText().isEmpty()) {
                        msg = em.asText();
                    }
                } catch (Exception ignored) {
                    // keep default message
                }
                throw new ApiException(502, "ai_upstream_error", sanitizeUpstream(msg));
            }
            JsonNode root = JSON.readTree(resp.body());
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                throw new ApiException(502, "ai_upstream_error", "upstream returned no choices");
            }
            String reply = choices.get(0).path("message").path("content").asText("");
            JsonNode usageNode = root.path("usage");
            int prompt = usageNode.path("prompt_tokens").asInt(0);
            int completion = usageNode.path("completion_tokens").asInt(0);
            int total = usageNode.path("total_tokens").asInt(0);
            return new ChatResult(reply, prompt, completion, total);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            String msg = e.getMessage() == null ? "ai upstream error" : e.getMessage();
            throw new ApiException(502, "ai_upstream_error", sanitizeUpstream(msg));
        }
    }

    /**
     * 真实 OpenAI 兼容流式对话调用（对齐 Go ai.Client.ChatCompletionStream）：
     * stream=true + stream_options.include_usage，逐 data: 行解析 SSE 增量并经 onDelta 回调，
     * 聚合全文返回。非 2xx 映射 502 ai_upstream_error 且脱敏；api_key 仅入 Authorization 头，不落日志。
     */
    private ChatResult chatCompletionStream(TenantAiConfig cfg, List<ChatMessage> messages, Double temperature,
                                            Integer maxTokens, Consumer<String> onDelta) {
        String apiKey = decryptKeyOrPlaintext(cfg.getApiKeyEncrypted());
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", cfg.getModel());
            List<Map<String, String>> msgs = new ArrayList<>();
            for (ChatMessage m : messages) {
                Map<String, String> mm = new LinkedHashMap<>();
                mm.put("role", m.getRole());
                mm.put("content", m.getContent());
                msgs.add(mm);
            }
            body.put("messages", msgs);
            if (temperature != null) {
                body.put("temperature", temperature);
            }
            if (maxTokens != null) {
                body.put("max_tokens", maxTokens);
            }
            body.put("stream", true);
            Map<String, Object> streamOptions = new LinkedHashMap<>();
            streamOptions.put("include_usage", true);
            body.put("stream_options", streamOptions);

            String url = cfg.getBaseUrl().replaceAll("/+$", "") + "/chat/completions";
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "text/event-stream")
                .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body), StandardCharsets.UTF_8))
                .build();
            HttpResponse<InputStream> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofInputStream());

            if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                String msg = "upstream returned status " + resp.statusCode();
                try {
                    String bodyStr = new String(resp.body().readAllBytes(), StandardCharsets.UTF_8);
                    JsonNode em = JSON.readTree(bodyStr).path("error").path("message");
                    if (!em.isMissingNode() && !em.asText().isEmpty()) {
                        msg = em.asText();
                    }
                } catch (Exception ignored) {
                    // keep default message
                }
                throw new ApiException(502, "ai_upstream_error", sanitizeUpstream(msg));
            }

            StringBuilder full = new StringBuilder();
            int prompt = 0;
            int completion = 0;
            int total = 0;
            try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resp.body(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.startsWith("data:")) {
                        continue;
                    }
                    String data = line.substring("data:".length()).trim();
                    if ("[DONE]".equals(data)) {
                        break;
                    }
                    if (data.isEmpty()) {
                        continue;
                    }
                    try {
                        JsonNode chunk = JSON.readTree(data);
                        JsonNode usageNode = chunk.path("usage");
                        if (!usageNode.isMissingNode()) {
                            prompt = usageNode.path("prompt_tokens").asInt(0);
                            completion = usageNode.path("completion_tokens").asInt(0);
                            total = usageNode.path("total_tokens").asInt(0);
                        }
                        JsonNode choices = chunk.path("choices");
                        if (choices.isArray()) {
                            for (JsonNode choice : choices) {
                                String delta = choice.path("delta").path("content").asText("");
                                if (delta.isEmpty()) {
                                    continue;
                                }
                                full.append(delta);
                                if (onDelta != null) {
                                    onDelta.accept(delta);
                                }
                            }
                        }
                    } catch (Exception ignored) {
                        // 容忍噪声行（注释/心跳），不中断整流
                    }
                }
            }
            return new ChatResult(full.toString(), prompt, completion, total);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            String msg = e.getMessage() == null ? "ai upstream error" : e.getMessage();
            throw new ApiException(502, "ai_upstream_error", sanitizeUpstream(msg));
        }
    }

    private String decryptKeyOrPlaintext(String encrypted) {
        if (encrypted == null || encrypted.isEmpty()) {
            return "";
        }
        try {
            return AesGcm.decrypt(aiConfigSecret, encrypted);
        } catch (Exception e) {
            // 兼容历史明文行（旧 Java 版写入）与密钥轮换前的密文
            return encrypted;
        }
    }

    private String encryptKey(String plain) {
        try {
            return AesGcm.encrypt(aiConfigSecret, plain);
        } catch (Exception e) {
            throw new ApiException(500, "internal_error", "加密 apiKey 失败");
        }
    }

    private static String sanitizeUpstream(String msg) {
        if (msg == null) {
            return "";
        }
        return msg
            .replaceAll("sk-[A-Za-z0-9_\\-]{8,}", "[redacted]")
            .replaceAll("(?i)\\bBearer\\s+[A-Za-z0-9._\\-]{8,}", "[redacted]")
            .replaceAll("(?i)api[_-]?key[\"']?\\s*[:=]\\s*[\"']?[A-Za-z0-9_\\-]{8,}", "[redacted]");
    }

    private record ChatResult(String reply, int promptTokens, int completionTokens, int totalTokens) {
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

    private void recordUsage(String tenantId, String userId, String model, Usage usage) {
        try {
            AiUsageLog logRow = new AiUsageLog();
            logRow.setTenantId(tenantId);
            logRow.setUserId(isBlank(userId) ? null : userId);
            logRow.setModel(model == null ? "" : model);
            logRow.setPromptTokens(usage == null ? 0 : usage.getPromptTokens());
            logRow.setCompletionTokens(usage == null ? 0 : usage.getCompletionTokens());
            logRow.setTotalTokens(usage == null ? 0 : usage.getTotalTokens());
            usageMapper.insert(logRow);
        } catch (Exception e) {
            log.warn("record ai usage failed, tenantId={}", tenantId, e);
        }
    }

    private static String maskApiKey(String key) {
        if (key == null || key.length() < 4) {
            return "****";
        }
        return "sk-****" + key.substring(key.length() - 4);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String blankToNull(String s) {
        return isBlank(s) ? null : s;
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

    private static long toLong(Object v) {
        if (v instanceof Number n) {
            return n.longValue();
        }
        return 0L;
    }
}
