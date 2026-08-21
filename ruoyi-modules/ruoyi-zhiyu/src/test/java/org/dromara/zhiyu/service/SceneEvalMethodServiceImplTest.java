package org.dromara.zhiyu.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.SaveEvalMethodsRequest;
import org.dromara.zhiyu.domain.dto.scene.SceneDtos.TaskEvaluationMethodInput;
import org.dromara.zhiyu.domain.evaluation.EvaluationQuestion;
import org.dromara.zhiyu.domain.scene.SceneEvalMethod;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamQuestionMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamUsageMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationQuestionMapper;
import org.dromara.zhiyu.mapper.portal.PortalResourceSnapshotMapper;
import org.dromara.zhiyu.mapper.scene.SceneEvalMethodMapper;
import org.dromara.zhiyu.mapper.scene.SceneEvalPointMapper;
import org.dromara.zhiyu.mapper.scene.SceneReviewStepMapper;
import org.dromara.zhiyu.mapper.scene.SceneRubricTemplateMapper;
import org.dromara.zhiyu.mapper.scene.SceneScenarioTaskMapper;
import org.dromara.zhiyu.mapper.scene.SceneScoreRuleMapper;
import org.dromara.zhiyu.mapper.system.SystemRoleMapper;
import org.dromara.zhiyu.service.impl.scene.SceneEvalMethodServiceImpl;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 场景任务测评方式「临时考试联动」单测（对齐 Go task_auto_exam_naming_test.go 场景）。
 *
 * <p>名称格式：{场景名}-{任务名}-{测评类型}-{YYYYMMDD}-{同天序号}；
 * 去重：同试卷同任务的 draft 安排复用；临时卷按租户+名称+is_temp 复用。</p>
 *
 * @author zhiyu
 */
@Tag("local")
class SceneEvalMethodServiceImplTest {

    private static final String TENANT = "tenant-1";
    private static final String CREATOR = "creator-1";
    private static final String TASK_ID = "task-1";
    private static final String DATE = "20260105";

    private SceneEvalMethodMapper evalMethodMapper;
    private SceneScenarioTaskMapper taskMapper;
    private EvaluationExamMapper examMapper;
    private EvaluationExamUsageMapper examUsageMapper;
    private EvaluationExamQuestionMapper examQuestionMapper;
    private EvaluationQuestionMapper questionMapper;
    private PortalResourceSnapshotMapper snapshotMapper;
    private SceneEvalMethodServiceImpl service;

    @BeforeEach
    void setUp() {
        evalMethodMapper = mock(SceneEvalMethodMapper.class);
        taskMapper = mock(SceneScenarioTaskMapper.class);
        examMapper = mock(EvaluationExamMapper.class);
        examUsageMapper = mock(EvaluationExamUsageMapper.class);
        examQuestionMapper = mock(EvaluationExamQuestionMapper.class);
        questionMapper = mock(EvaluationQuestionMapper.class);
        snapshotMapper = mock(PortalResourceSnapshotMapper.class);
        // SystemGuard 直读 TenantContext（requireTenant/requireUser 不触库），注入 mock roleMapper 即可
        service = new SceneEvalMethodServiceImpl(
            new SystemGuard(mock(SystemRoleMapper.class)), evalMethodMapper, mock(SceneEvalPointMapper.class), mock(SceneScoreRuleMapper.class),
            mock(SceneReviewStepMapper.class), mock(SceneRubricTemplateMapper.class), taskMapper,
            examMapper, examUsageMapper, examQuestionMapper, questionMapper, snapshotMapper);

        TenantContext.set(CREATOR, TENANT, "operator", "saas");
        when(taskMapper.selectTenantId(TASK_ID)).thenReturn(TENANT);
        when(taskMapper.selectName(TASK_ID)).thenReturn("任务 1");
        when(taskMapper.selectScenarioName(TASK_ID)).thenReturn("软件项目经理场景2");
        when(evalMethodMapper.selectMaxVersion(TASK_ID, TENANT)).thenReturn(0);
        // MySQL 版：upsertMethod（ON DUPLICATE KEY UPDATE）+ selectMethodId 回读行 id
        when(evalMethodMapper.selectMethodId(anyString(), anyString(), anyString())).thenReturn("cfg-1");
        when(evalMethodMapper.selectList(org.mockito.ArgumentMatchers.<Wrapper<SceneEvalMethod>>any()))
            .thenReturn(List.of());
        when(examUsageMapper.currentDateYmd()).thenReturn(DATE);
        when(snapshotMapper.selectLatestVersion(anyString(), eq("exams"), anyString())).thenReturn(null);
        when(examMapper.selectVersion(anyString(), anyString())).thenReturn("V1.0");
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private TaskEvaluationMethodInput method(String key, Map<String, Object> resourceConfig) {
        TaskEvaluationMethodInput input = new TaskEvaluationMethodInput();
        input.setMethodKey(key);
        input.setIsEnabled(true);
        input.setResourceConfig(resourceConfig);
        return input;
    }

    private SaveEvalMethodsRequest request(TaskEvaluationMethodInput... methods) {
        SaveEvalMethodsRequest req = new SaveEvalMethodsRequest();
        req.setVersion(0);
        req.setMethods(List.of(methods));
        return req;
    }

    @Test
    @DisplayName("paper 手动启停：创建 exam_usages，名称=场景名-任务名-试卷-YYYYMMDD-1，草稿状态")
    void paperUsageAutoNaming() {
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("paperId", "exam-p1");
        cfg.put("activationMode", "manual");
        cfg.put("duration", 60);
        when(examUsageMapper.countUsagesCreatedToday(TENANT, "task")).thenReturn(0);

        service.saveMethods(TASK_ID, request(method("paper", cfg)));

        // 创建安排：名称前缀「软件项目经理场景2-任务 1-试卷-」，同天序号 1
        verify(examUsageMapper).insertNodeUsage(anyString(), eq(TENANT), eq("exam-p1"),
            eq("软件项目经理场景2-任务 1-试卷-" + DATE + "-1"),
            isNull(), isNull(), eq(60), eq("task"), eq(List.of(TASK_ID)),
            eq("draft"), eq("manual"), eq(CREATOR), eq("V1.0"));
        // usageId 写回 resourceConfig 并随方法行落库
        ArgumentCaptor<String> rcCaptor = ArgumentCaptor.forClass(String.class);
        verify(evalMethodMapper).upsertMethod(eq(TENANT), eq(TASK_ID), eq("paper"), any(),
            any(), any(), anyString(), any(), any(), rcCaptor.capture(), eq(1), eq(true));
        assertTrue(rcCaptor.getValue().contains("\"usageId\""));
        // paper 不创建临时卷、不同步题目
        verify(examMapper, never()).insertTempExam(anyString(), anyString(), anyString(), anyString(),
            any(), anyString());
        verify(examQuestionMapper, never()).upsertExamQuestion(anyString(), anyString(), anyString(),
            anyString(), any(), any(), any(), any(), any(), any(), anyInt());
    }

    @Test
    @DisplayName("同天第二个测评（quiz）：复用 paper 草稿安排，quiz 新建且序号递增为 2")
    void sameDaySequenceIncrements() {
        Map<String, Object> paperCfg = new LinkedHashMap<>();
        paperCfg.put("paperId", "exam-p1");
        paperCfg.put("activationMode", "manual");
        paperCfg.put("duration", 60);
        Map<String, Object> quizCfg = new LinkedHashMap<>();
        quizCfg.put("examId", "exam-q1");
        quizCfg.put("activationMode", "manual");
        quizCfg.put("timeLimit", 30);
        quizCfg.put("questionIds", List.of("q-1"));
        // paper 的 draft 安排已存在（第一次保存生成）→ 复用并仅更新时间窗
        when(examUsageMapper.selectDraftTaskUsageId(TENANT, "exam-p1", TASK_ID)).thenReturn("usage-1");
        when(examUsageMapper.selectDraftTaskUsageId(TENANT, "exam-q1", TASK_ID)).thenReturn(null);
        // 当天已有 1 条安排 → quiz 序号为 2
        when(examUsageMapper.countUsagesCreatedToday(TENANT, "task")).thenReturn(1);
        EvaluationQuestion q = new EvaluationQuestion();
        q.setId("q-1");
        q.setType("single");
        q.setContent("题干");
        q.setOptions("[]");
        q.setAnswer("[\"A\"]");
        q.setScore(new BigDecimal("100"));
        when(questionMapper.selectByIdsOrdered(List.of("q-1"), TENANT)).thenReturn(List.of(q));

        service.saveMethods(TASK_ID, request(method("paper", paperCfg), method("quiz", quizCfg)));

        // paper：复用 draft 安排，仅更新窗口
        verify(examUsageMapper).updateUsageWindow("usage-1", TENANT, null, null, 60, "manual");
        // quiz：同步题目（含总分重算）
        verify(examQuestionMapper).deleteNotIn("exam-q1", TENANT, List.of("q-1"));
        verify(examQuestionMapper).upsertExamQuestion(anyString(), eq(TENANT), eq("exam-q1"), eq("q-1"),
            eq("single"), eq("题干"), eq("[]"), eq("[\"A\"]"), isNull(), eq(new BigDecimal("100")), eq(1));
        verify(examQuestionMapper).recalcExamTotal("exam-q1", TENANT);
        // quiz：新建安排，名称序号 2
        verify(examUsageMapper, times(1)).insertNodeUsage(anyString(), eq(TENANT), eq("exam-q1"),
            eq("软件项目经理场景2-任务 1-随堂测-" + DATE + "-2"),
            isNull(), isNull(), eq(30), eq("task"), eq(List.of(TASK_ID)),
            eq("draft"), eq("manual"), eq(CREATOR), eq("V1.0"));
    }

    @Test
    @DisplayName("quiz 无 examId：按「任务名-随堂测-任务ID」创建/复用临时卷（时长取 timeLimit，默认 90），examId 写回配置")
    void quizCreatesTempExam() {
        Map<String, Object> quizCfg = new LinkedHashMap<>();
        quizCfg.put("timeLimit", 30);
        quizCfg.put("questionIds", List.of("q-1"));
        when(examMapper.selectTempExamId(TENANT, "任务 1-随堂测-" + TASK_ID)).thenReturn(null);
        when(examMapper.existsCode(eq(TENANT), anyString())).thenReturn(false);
        when(examUsageMapper.selectDraftTaskUsageId(anyString(), anyString(), anyString())).thenReturn(null);
        when(examUsageMapper.countUsagesCreatedToday(TENANT, "task")).thenReturn(0);
        when(questionMapper.selectByIdsOrdered(anyList(), anyString())).thenReturn(List.of());

        service.saveMethods(TASK_ID, request(method("quiz", quizCfg)));

        // 临时卷：published 占位创建，名称「任务 1-随堂测-task-1」，时长 30
        verify(examMapper).insertTempExam(anyString(), eq(TENANT), anyString(),
            eq("任务 1-随堂测-" + TASK_ID), eq(30), eq(CREATOR));
        // 无 activationMode 时 quiz 默认随时作答 → 安排直接 published
        verify(examUsageMapper).insertNodeUsage(anyString(), eq(TENANT), anyString(),
            eq("软件项目经理场景2-任务 1-随堂测-" + DATE + "-1"),
            isNull(), isNull(), eq(30), eq("task"), eq(List.of(TASK_ID)),
            eq("published"), eq("always"), eq(CREATOR), eq("V1.0"));
        // examId/usageId 写回配置并落库
        ArgumentCaptor<String> rcCaptor = ArgumentCaptor.forClass(String.class);
        verify(evalMethodMapper).upsertMethod(eq(TENANT), eq(TASK_ID), eq("quiz"), any(),
            any(), any(), anyString(), any(), any(), rcCaptor.capture(), eq(1), eq(true));
        assertTrue(rcCaptor.getValue().contains("\"examId\""));
        assertTrue(rcCaptor.getValue().contains("\"usageId\""));
    }

    @Test
    @DisplayName("临时卷去重：同租户同名称 is_temp 卷已存在时复用，不重复创建")
    void tempExamReusedByName() {
        Map<String, Object> quizCfg = new LinkedHashMap<>();
        quizCfg.put("questionIds", List.of("q-1"));
        when(examMapper.selectTempExamId(TENANT, "任务 1-随堂测-" + TASK_ID)).thenReturn("exam-existing");
        when(examUsageMapper.selectDraftTaskUsageId(TENANT, "exam-existing", TASK_ID)).thenReturn(null);
        when(examUsageMapper.countUsagesCreatedToday(TENANT, "task")).thenReturn(0);
        when(questionMapper.selectByIdsOrdered(anyList(), anyString())).thenReturn(List.of());

        service.saveMethods(TASK_ID, request(method("quiz", quizCfg)));

        verify(examMapper, never()).insertTempExam(anyString(), anyString(), anyString(), anyString(),
            any(), anyString());
        // 复用已有卷：题目同步与安排创建都指向 exam-existing
        verify(examQuestionMapper).deleteNotIn("exam-existing", TENANT, List.of("q-1"));
        verify(examUsageMapper).insertNodeUsage(anyString(), eq(TENANT), eq("exam-existing"),
            anyString(), isNull(), isNull(), isNull(), eq("task"), eq(List.of(TASK_ID)),
            eq("published"), eq("always"), eq(CREATOR), eq("V1.0"));
        // examId 写回配置并随方法行落库
        ArgumentCaptor<String> rcCaptor = ArgumentCaptor.forClass(String.class);
        verify(evalMethodMapper).upsertMethod(eq(TENANT), eq(TASK_ID), eq("quiz"), any(),
            any(), any(), anyString(), any(), any(), rcCaptor.capture(), eq(1), eq(true));
        assertTrue(rcCaptor.getValue().contains("exam-existing"));
    }

    @Test
    @DisplayName("questionIds 为空：题库/随堂测不做任何联动；禁用方法跳过联动")
    void emptyQuestionsOrDisabledSkips() {
        Map<String, Object> quizCfg = new LinkedHashMap<>();
        quizCfg.put("questionIds", List.of());
        TaskEvaluationMethodInput quiz = method("quiz", quizCfg);
        Map<String, Object> paperCfg = new LinkedHashMap<>();
        paperCfg.put("paperId", "exam-p1");
        TaskEvaluationMethodInput paper = method("paper", paperCfg);
        paper.setIsEnabled(false);

        service.saveMethods(TASK_ID, request(quiz, paper));

        verify(examMapper, never()).insertTempExam(anyString(), anyString(), anyString(), anyString(),
            any(), anyString());
        verify(examUsageMapper, never()).insertNodeUsage(anyString(), anyString(), anyString(),
            anyString(), any(), any(), any(), anyString(), anyList(), anyString(), anyString(),
            any(), any());
        verify(examUsageMapper, never()).updateUsageWindow(anyString(), anyString(), any(), any(),
            any(), anyString());
    }
}
