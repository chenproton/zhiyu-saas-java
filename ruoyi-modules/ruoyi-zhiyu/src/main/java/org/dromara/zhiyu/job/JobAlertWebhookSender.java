package org.dromara.zhiyu.job;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import org.dromara.zhiyu.core.util.ZhiyuJsonUtils;

/**
 * 定时任务最终失败告警（对齐 Go scheduler.notifyAlert）。
 *
 * <p>webhook 地址取环境变量 {@code ALERT_WEBHOOK_URL}（未配置则跳过）；
 * 以 JSON POST 通知外部系统（企业微信/钉钉/自建告警网关等），5 秒超时；
 * 序列化/请求失败仅记日志，不影响任务主流程。</p>
 *
 * @author zhiyu
 */
@Slf4j
@Component
public class JobAlertWebhookSender {

    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    private final String webhookUrl;
    private final HttpClient httpClient;

    public JobAlertWebhookSender() {
        this(System.getenv("ALERT_WEBHOOK_URL"),
            HttpClient.newBuilder().connectTimeout(TIMEOUT).build());
    }

    /** 测试用构造（注入 webhook 地址与 HttpClient）。 */
    JobAlertWebhookSender(String webhookUrl, HttpClient httpClient) {
        this.webhookUrl = webhookUrl;
        this.httpClient = httpClient;
    }

    /** 最终失败告警；未配置 webhook 或发送失败均不抛错。 */
    public void send(String jobName, Throwable err, OffsetDateTime started) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            return;
        }
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("level", "error");
            payload.put("type", "cron_job_failed");
            payload.put("job", jobName);
            payload.put("error", err.getMessage() == null ? String.valueOf(err) : err.getMessage());
            payload.put("startedAt",
                started.truncatedTo(ChronoUnit.SECONDS).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
            String body = ZhiyuJsonUtils.MAPPER.writeValueAsString(payload);
            HttpRequest request = HttpRequest.newBuilder(URI.create(webhookUrl))
                .timeout(TIMEOUT)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
            HttpResponse<Void> resp = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
            if (resp.statusCode() >= 300) {
                log.warn("定时任务告警被拒绝 job={} status={}", jobName, resp.statusCode());
            }
        } catch (Exception e) {
            log.warn("定时任务告警发送失败 job={}", jobName, e);
        }
    }
}
