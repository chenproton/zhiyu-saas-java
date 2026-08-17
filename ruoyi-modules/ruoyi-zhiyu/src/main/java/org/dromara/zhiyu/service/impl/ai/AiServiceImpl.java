package org.dromara.zhiyu.service.impl.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.QueryBuilder;
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
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ScenarioTaskPolish;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.SuggestedAbility;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.SuggestedCertificate;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.Usage;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.ai.AiUsageLogMapper;
import org.dromara.zhiyu.mapper.ai.TenantAiConfigMapper;
import org.dromara.zhiyu.service.ai.IAiService;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 租户 AI 配置/用量/统一对话服务实现（对齐 Go service/ai.go）。
 *
 * <p>演示环境：LLM 调用不做真实上游请求，配置存在即返回 mock 回复；
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
        view.setApiKeyMasked(maskApiKey(cfg.getApiKeyEncrypted()));
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
            keyToStore = existing.getApiKeyEncrypted();
        }
        TenantAiConfig cfg = new TenantAiConfig();
        cfg.setTenantId(tenantId);
        cfg.setBaseUrl(req.getBaseUrl());
        cfg.setApiKeyEncrypted(keyToStore);
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

    // ---------- 对话 / 辅助（mock） ----------

    @Override
    public AIChatResponse chat(String tenantId, String userId, AIChatRequest req) {
        TenantAiConfig cfg = requireConfigured(tenantId);
        String reply = mockReply(req == null ? null : req.getMessages());
        Usage usage = mockUsage();
        recordUsage(tenantId, userId, cfg.getModel(), usage);
        AIChatResponse resp = new AIChatResponse();
        resp.setReply(reply);
        resp.setUsage(usage);
        return resp;
    }

    @Override
    public PositionAssistResponse positionAssist(String tenantId, String userId, String field, PositionAssistInput input) {
        requireConfigured(tenantId);
        if (field == null || !POSITION_FIELDS.contains(field)) {
            throw new ApiException(400, "bad_request", "field 不合法");
        }
        PositionAssistResponse resp = new PositionAssistResponse();
        resp.setField(field);
        switch (field) {
            case "polish" -> {
                PositionPolish p = new PositionPolish();
                p.setName(blankToNull(input == null ? null : input.getName()));
                p.setShortName(input == null ? null : input.getShortName());
                p.setDescription("演示润色结果");
                p.setSalaryMin(0);
                p.setSalaryMax(0);
                resp.setPolish(p);
            }
            case "responsibilities" -> resp.setResponsibilities(List.of("演示职责一", "演示职责二"));
            case "requirements" -> resp.setRequirements(List.of("演示任职要求"));
            case "careerPath" -> resp.setCareerPath("演示晋升路径");
            case "certificates" -> {
                SuggestedCertificate c = new SuggestedCertificate();
                c.setName("演示证书");
                c.setDescription("演示证书描述");
                c.setUrl("");
                resp.setCertificates(List.of(c));
            }
            case "abilities" -> {
                SuggestedAbility a = new SuggestedAbility();
                a.setName("演示能力点");
                a.setDomain("通用能力");
                a.setAttributes(List.of("演示属性"));
                a.setRubricDescription("演示胜任标准");
                resp.setAbilities(List.of(a));
            }
            case "competency" -> {
                CompetencyFill f = new CompetencyFill();
                f.setName("演示能力点");
                f.setLevel("掌握");
                f.setRubricDescription("演示胜任标准");
                resp.setCompetencies(List.of(f));
            }
            default -> {
            }
        }
        return resp;
    }

    @Override
    public ScenarioAssistResponse scenarioAssist(String tenantId, String userId, String field, ScenarioAssistInput input) {
        requireConfigured(tenantId);
        if (field == null || !SCENARIO_FIELDS.contains(field)) {
            throw new ApiException(400, "bad_request", "field 不合法");
        }
        ScenarioAssistResponse resp = new ScenarioAssistResponse();
        resp.setField(field);
        switch (field) {
            case "polish" -> {
                ScenarioPolish p = new ScenarioPolish();
                p.setName(blankToNull(input == null ? null : input.getName()));
                p.setBackground("演示场景背景");
                p.setDifficulty(input == null ? 0 : input.getDifficulty());
                resp.setPolish(p);
            }
            case "taskPolish" -> {
                ScenarioTaskPolish t = new ScenarioTaskPolish();
                t.setName(blankToNull(input == null ? null : input.getTaskName()));
                t.setBackground("演示任务背景");
                t.setDifficulty(input == null ? 0 : input.getTaskDifficulty());
                resp.setTask(t);
            }
            case "taskDescription" -> resp.setTaskDescription("演示任务说明：本任务旨在…");
            case "taskKnowledge", "taskAbility", "taskResource" -> {
                ScenarioSuggestion s = new ScenarioSuggestion();
                s.setName("演示推荐条目");
                s.setDescription("演示推荐描述");
                resp.setSuggestions(List.of(s));
            }
            case "taskChain" -> resp.setChain(new ScenarioTaskChain());
            default -> {
            }
        }
        return resp;
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

    private String mockReply(List<ChatMessage> messages) {
        String question = "您的问题";
        if (messages != null) {
            for (ChatMessage m : messages) {
                if ("user".equals(m.getRole()) && !isBlank(m.getContent())) {
                    question = m.getContent();
                    break;
                }
            }
        }
        return "演示回复：已收到「" + truncate(question, 40) + "」";
    }

    private Usage mockUsage() {
        Usage u = new Usage();
        u.setPromptTokens(12);
        u.setCompletionTokens(8);
        u.setTotalTokens(20);
        return u;
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
