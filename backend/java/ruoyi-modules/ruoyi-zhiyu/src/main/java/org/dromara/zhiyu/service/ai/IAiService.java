package org.dromara.zhiyu.service.ai;

import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIChatRequest;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIChatResponse;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIConfigView;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.AIUsageStats;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.PositionAssistInput;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.PositionAssistResponse;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.SaveAIConfigRequest;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ScenarioAssistInput;
import org.dromara.zhiyu.domain.dto.ai.AiDtos.ScenarioAssistResponse;

/**
 * 租户 AI 配置/用量/统一对话服务（对齐 Go AIService）。
 *
 * @author zhiyu
 */
public interface IAiService {

    /** 查看租户 AI 配置（脱敏；未配置返回 configured=false） */
    AIConfigView getConfig(String tenantId);

    /** 保存租户 AI 配置（apiKey 留空表示不修改） */
    void saveConfig(String tenantId, SaveAIConfigRequest req);

    /** 清除租户 AI 配置 */
    void deleteConfig(String tenantId);

    /** 租户 AI 用量统计 */
    AIUsageStats getUsage(String tenantId);

    /** 统一对话（非流式；未配置 → 412 ai_not_configured） */
    AIChatResponse chat(String tenantId, String userId, AIChatRequest req);

    /** 岗位 AI 辅助编写（mock 建议，不落库） */
    PositionAssistResponse positionAssist(String tenantId, String userId, String field, PositionAssistInput input);

    /** 场景/任务 AI 辅助编写（mock 建议，不落库） */
    ScenarioAssistResponse scenarioAssist(String tenantId, String userId, String field, ScenarioAssistInput input);

    /** 校验当前用户可管理 portal 系统（非学生；403） */
    void requireManagePortal();
}
