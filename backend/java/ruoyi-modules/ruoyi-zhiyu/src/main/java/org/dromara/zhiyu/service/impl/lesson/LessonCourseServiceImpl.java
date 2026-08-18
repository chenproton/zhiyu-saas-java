package org.dromara.zhiyu.service.impl.lesson;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CloneCourseRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CourseDto;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.CreateCourseRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.ReviewRequest;
import org.dromara.zhiyu.domain.dto.lesson.LessonDtos.UpdateCourseRequest;
import org.dromara.zhiyu.domain.evaluation.EvaluationQuestion;
import org.dromara.zhiyu.domain.lesson.KnowledgePoint;
import org.dromara.zhiyu.domain.lesson.SystemCourseNode;
import org.dromara.zhiyu.domain.portal.PortalCourse;
import org.dromara.zhiyu.domain.portal.PortalIndustry;
import org.dromara.zhiyu.domain.portal.PortalLessonBatch;
import org.dromara.zhiyu.domain.portal.PortalMajor;
import org.dromara.zhiyu.domain.portal.PortalViewCounter;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamQuestionMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationExamUsageMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationQuestionMapper;
import org.dromara.zhiyu.mapper.lesson.KnowledgePointMapper;
import org.dromara.zhiyu.mapper.lesson.LessonCourseCloneMapper;
import org.dromara.zhiyu.mapper.lesson.SystemCourseNodeMapper;
import org.dromara.zhiyu.mapper.portal.PortalCourseMapper;
import org.dromara.zhiyu.mapper.portal.PortalIndustryMapper;
import org.dromara.zhiyu.mapper.portal.PortalLessonBatchMapper;
import org.dromara.zhiyu.mapper.portal.PortalMajorMapper;
import org.dromara.zhiyu.mapper.portal.PortalResourceSnapshotMapper;
import org.dromara.zhiyu.mapper.portal.PortalViewCounterMapper;
import org.dromara.zhiyu.service.lesson.ILessonCourseService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 课程服务实现（对齐 Go course_handler.go + content_actions.go + course_clone.go 语义）。
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class LessonCourseServiceImpl implements ILessonCourseService {

    private static final String CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
        "draft", Set.of("pending", "archived"),
        "rejected", Set.of("draft", "pending", "archived"),
        "pending", Set.of("draft", "approved", "rejected"),
        "approved", Set.of("draft", "published", "archived"),
        "published", Set.of("draft", "archived"),
        "archived", Set.of("draft")
    );

    private final PortalCourseMapper courseMapper;
    private final LessonCourseCloneMapper cloneMapper;
    private final PortalResourceSnapshotMapper snapshotMapper;
    private final PortalMajorMapper majorMapper;
    private final PortalIndustryMapper industryMapper;
    private final PortalLessonBatchMapper lessonBatchMapper;
    private final PortalViewCounterMapper viewCounterMapper;
    private final ZhiyuUserMapper userMapper;
    private final KnowledgePointMapper knowledgePointMapper;
    private final SystemCourseNodeMapper nodeMapper;
    private final EvaluationExamMapper examMapper;
    private final EvaluationExamUsageMapper examUsageMapper;
    private final EvaluationExamQuestionMapper examQuestionMapper;
    private final EvaluationQuestionMapper questionMapper;

    @Override
    public ListResponse<CourseDto> list(String search, String type, String category, String status, String batchId,
                                        long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);

        String effectiveStatus = status;
        if (isStudent()) {
            effectiveStatus = "published";
        }

        LambdaQueryBuilder<PortalCourse> wrapper = baseListWrapper(tenantId, search, type, category, effectiveStatus, batchId);
        long total = courseMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(PortalCourse::getCreatedAt).last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<PortalCourse> rows = courseMapper.selectList(wrapper.build());
        return ListResponse.of(assembleList(rows, tenantId), total);
    }

    @Override
    public CourseDto get(String id) {
        requireUser();
        PortalCourse course = fetchOwned(id);
        if (isStudent() && !"published".equals(course.getStatus())) {
            throw new ApiException(404, "not_found", "课程不存在");
        }
        return assembleDetail(course, course.getTenantId());
    }

    @Override
    public CourseDto create(CreateCourseRequest req) {
        String tenantId = requireTenant();
        String userId = requireUser();
        if (req.getName() == null || req.getName().isEmpty()
            || req.getType() == null || req.getType().isEmpty()
            || req.getCategory() == null || req.getCategory().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String version = req.getVersion() == null || req.getVersion().isEmpty() ? "V1.0" : req.getVersion();
        String prefix = "granular".equals(req.getType()) ? "KL" : "XT";
        String code = generateUniqueCode(tenantId, prefix);

        String id = UUID.randomUUID().toString();
        List<String> kpIds = coalesce(req.getKnowledgePointIds());
        List<String> apIds = coalesce(req.getAbilityPointIds());
        List<String> resIds = coalesce(req.getResourceIds());
        List<String> coIds = coalesce(req.getCoCreatorIds());

        courseMapper.insertCourse(id, tenantId, code, req.getName(), req.getType(), req.getCategory(),
            emptyToNull(req.getMajorId()), emptyToNull(req.getTeacherId()), emptyToNull(req.getIndustryId()),
            version, req.getOnlineHours(), req.getOfflineHours(), req.getOnlineWeight(), req.getOfflineWeight(),
            req.getSemester(), req.getClassName(), req.getCoverColor(), req.getCoverImage(), req.getCourseTag(),
            req.getDifficulty(), req.getDescription(), userId, coIds, emptyToNull(req.getBatchId()),
            kpIds, apIds, resIds, toJson(req.getEvalData()));
        replaceCourseBindings(tenantId, id, userId, kpIds, resIds);
        syncKpGranularLessons(tenantId, id, kpIds);
        return assembleDetail(fetchOwned(id), tenantId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CourseDto update(String id, UpdateCourseRequest req) {
        requireUser();
        PortalCourse existing = fetchOwned(id);
        String tenantId = existing.getTenantId();

        String name = empty(req.getName()) ? existing.getName() : req.getName();
        String type = empty(req.getType()) ? existing.getType() : req.getType();
        String category = empty(req.getCategory()) ? existing.getCategory() : req.getCategory();
        String majorId = req.getMajorId() != null ? emptyToNull(req.getMajorId()) : existing.getMajorId();
        String teacherId = req.getTeacherId() != null ? emptyToNull(req.getTeacherId()) : existing.getTeacherId();
        String industryId = req.getIndustryId() != null ? emptyToNull(req.getIndustryId()) : existing.getIndustryId();
        String version = req.getVersion() == null || req.getVersion().isEmpty() ? existing.getVersion() : req.getVersion();
        String batchId = req.getBatchId() != null ? emptyToNull(req.getBatchId()) : existing.getBatchId();

        List<String> kpIds = req.getKnowledgePointIds() != null ? req.getKnowledgePointIds() : existing.getKnowledgePointIds();
        List<String> apIds = req.getAbilityPointIds() != null ? req.getAbilityPointIds() : existing.getAbilityPointIds();
        List<String> resIds = req.getResourceIds() != null ? req.getResourceIds() : existing.getResourceIds();
        List<String> coIds = req.getCoCreatorIds() != null ? req.getCoCreatorIds() : existing.getCoCreatorIds();
        String evalData = req.getEvalData() != null ? toJson(req.getEvalData()) : existing.getEvalData();

        courseMapper.updateCourse(id, tenantId, name, type, category, majorId, teacherId, industryId, version,
            req.getOnlineHours() != null ? req.getOnlineHours() : existing.getOnlineHours(),
            req.getOfflineHours() != null ? req.getOfflineHours() : existing.getOfflineHours(),
            req.getOnlineWeight() != null ? req.getOnlineWeight() : existing.getOnlineWeight(),
            req.getOfflineWeight() != null ? req.getOfflineWeight() : existing.getOfflineWeight(),
            req.getSemester() != null ? req.getSemester() : existing.getSemester(),
            req.getClassName() != null ? req.getClassName() : existing.getClassName(),
            req.getCoverColor() != null ? req.getCoverColor() : existing.getCoverColor(),
            req.getCoverImage() != null ? req.getCoverImage() : existing.getCoverImage(),
            req.getCourseTag() != null ? req.getCourseTag() : existing.getCourseTag(),
            req.getDifficulty() != null ? req.getDifficulty() : existing.getDifficulty(),
            req.getDescription() != null ? req.getDescription() : existing.getDescription(),
            coIds, batchId, kpIds, apIds, resIds, evalData);

        boolean replaceBindings = req.getKnowledgePointIds() != null || req.getResourceIds() != null;
        if (replaceBindings) {
            replaceCourseBindings(tenantId, id, requireUser(), kpIds, resIds);
            syncKpGranularLessons(tenantId, id, kpIds);
        }
        return assembleDetail(fetchOwned(id), tenantId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String delete(String id) {
        requireUser();
        PortalCourse existing = fetchOwned(id);
        String tenantId = existing.getTenantId();
        if (courseMapper.existsEvaluationResults(id)) {
            throw new ApiException(409, "conflict", "该课程已存在测评成绩，无法删除");
        }
        courseMapper.unbindTrainingPrograms(id);
        courseMapper.unbindTeachingPlans(id);
        courseMapper.unbindSchedules(id);
        courseMapper.deleteCourseHomeworkSubmissions(id);
        courseMapper.deleteCourseHomeworks(id);
        courseMapper.deleteCourseExamUsages(id);
        courseMapper.unbindKnowledgePointGranularRefs(id);
        courseMapper.deleteCourse(id, tenantId);
        return id;
    }

    @Override
    public CourseDto submit(String id) {
        return transition(id, "pending");
    }

    @Override
    public CourseDto withdraw(String id) {
        return transition(id, "draft");
    }

    @Override
    public CourseDto saveDraft(String id) {
        return transition(id, "draft");
    }

    @Override
    public CourseDto publish(String id) {
        return transition(id, "published");
    }

    @Override
    public CourseDto archive(String id) {
        return transition(id, "archived");
    }

    @Override
    public CourseDto unpublish(String id) {
        return transition(id, "draft");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CourseDto review(String id, ReviewRequest req) {
        requireUser();
        String toStatus;
        if ("approved".equals(req.getStatus())) {
            toStatus = "approved";
        } else if ("rejected".equals(req.getStatus())) {
            toStatus = "rejected";
        } else {
            throw new ApiException(400, "bad_request", "无效的审核状态");
        }
        PortalCourse course = fetchOwned(id);
        int rows = courseMapper.casReview(id, course.getTenantId(), toStatus);
        if (rows == 0) {
            throw new ApiException(400, "bad_request", "课程不存在或不在待处理状态");
        }
        return assembleDetail(fetchOwned(id), course.getTenantId());
    }

    @Override
    public CourseDto invite(String id, InviteRequest req) {
        requireUser();
        PortalCourse course = fetchOwned(id);
        String tenantId = course.getTenantId();
        if (req.getUserId() == null || req.getUserId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少用户ID");
        }
        if (!userExistsInTenant(req.getUserId(), tenantId)) {
            throw new ApiException(400, "bad_request", "用户不存在或不属于本租户");
        }
        courseMapper.inviteCollaborator(id, req.getUserId());
        return assembleDetail(fetchOwned(id), tenantId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CourseDto clone(String id, CloneCourseRequest req) {
        String tenantId = requireTenant();
        String userId = requireUser();
        LessonCourseCloneMapper.SourceCourseRow src = cloneMapper.selectSource(id);
        if (src == null) {
            throw new ApiException(404, "not_found", "课程不存在");
        }
        if (src.getTenantId() != null && !src.getTenantId().isEmpty() && !src.getTenantId().equals(tenantId)) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        String newName = req.getName() == null || req.getName().isEmpty() ? src.getName() + " (克隆)" : req.getName();
        String prefix = "granular".equals(src.getType()) ? "KL" : "XT";
        String code = generateUniqueCode(tenantId, prefix);
        String newId = UUID.randomUUID().toString();

        cloneMapper.cloneCourseMain(newId, tenantId, code, newName, id, userId);
        cloneMapper.cloneKnowledgeBindings(newId, id, tenantId);
        cloneMapper.cloneResourceBindings(newId, id, tenantId);
        cloneNodes(id, newId, tenantId);
        cloneMapper.updateNodeCount(newId);
        return assembleDetail(fetchOwned(newId), tenantId);
    }

    @Override
    public Map<String, Object> getSnapshot(String id, String version) {
        requireUser();
        String tenantId = requireTenant();
        String v = version;
        if (v == null || v.isEmpty()) {
            v = snapshotMapper.selectLatestVersion(tenantId, "courses", id);
        }
        if (v != null && !v.isEmpty()) {
            String data = snapshotMapper.selectSnapshotData(tenantId, "courses", id, v);
            if (data != null) {
                Map<String, Object> bundle = fromJson(data);
                if (isStudent()) {
                    stripStudentAnswers(bundle);
                }
                return bundle;
            }
        }
        PortalResourceSnapshotMapper.LiveStateRow live = snapshotMapper.selectCourseLiveState(tenantId, id);
        if (live == null || !"published".equals(live.getStatus())) {
            throw new ApiException(404, "not_found", "资源不存在或未发布");
        }
        if (version != null && !version.isEmpty() && !version.equals(live.getVersion())) {
            throw new ApiException(404, "not_found", "资源不存在或未发布");
        }
        Map<String, Object> bundle = fromJson(buildCourseSnapshotJson(tenantId, id));
        if (isStudent()) {
            stripStudentAnswers(bundle);
        }
        return bundle;
    }

    // ---------- 状态流转 ----------

    @Transactional(rollbackFor = Exception.class)
    protected CourseDto transition(String id, String toStatus) {
        requireUser();
        PortalCourse course = fetchOwned(id);
        String tenantId = course.getTenantId();
        String currentStatus = course.getStatus();
        if (!canTransition(currentStatus, toStatus)) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作（课程）");
        }
        int rows = courseMapper.casTransition(id, tenantId, currentStatus, toStatus);
        if (rows == 0) {
            throw new ApiException(500, "internal_error", "状态流转失败");
        }
        if ("pending".equals(currentStatus) && "draft".equals(toStatus)) {
            courseMapper.deletePendingApproval(id);
        }
        if ("published".equals(toStatus)) {
            String version = nextVersion(course.getVersion());
            courseMapper.bumpVersion(id, version);
            snapshotMapper.saveSnapshot(tenantId, "courses", id, version, buildCourseSnapshotJson(tenantId, id));
            // 发布 hook：按节点 eval_data 生成测评（考试安排/临时卷/题目同步）
            generateCourseAssessments(course);
        }
        return assembleDetail(fetchOwned(id), tenantId);
    }

    // ===== 发布测评生成（对齐 Go GenerateCourseAssessments） =====

    /**
     * 发布课程时生成节点测评（考试/作业）。
     * 体系课读 eval_data.evalRuleConfig；混合课读 eval_data.hybridEvalRules 三个子规则
     * （preQuiz/inClassQuiz/homework）各自独立生成测评实体。
     * 核心链路：考试安排（exam_usages）+ 临时试卷（exams）+ 题目同步（exam_questions）。
     * 未覆盖子步骤：课程级旧测评清理（CleanupCourseLevelAssessments）、临时卷版本/快照固化
     * （SyncTempExamSnapshot/exam_version stamp）、NextAutoUsageName 同日序号命名。
     */
    private void generateCourseAssessments(PortalCourse course) {
        String type = course.getType();
        if (!"system".equals(type) && !"hybrid".equals(type)) {
            return;
        }
        String courseId = course.getId();
        List<SystemCourseNode> nodes = nodeMapper.selectList(
            QueryBuilder.lambda(SystemCourseNode.class)
                .eq(SystemCourseNode::getCourseId, courseId)
                .orderByAsc(SystemCourseNode::getSortOrder)
                .orderByAsc(SystemCourseNode::getId)
                .build());
        for (SystemCourseNode node : nodes) {
            Map<String, Object> evalData = fromJson(node.getEvalData());
            boolean updated = "hybrid".equals(type)
                ? generateHybridNodeAssessments(course, node, evalData)
                : generateSystemNodeAssessment(course, node, evalData);
            if (updated) {
                nodeMapper.updateNodeEvalData(node.getId(), course.getTenantId(), toJson(evalData));
            }
        }
    }

    private boolean generateSystemNodeAssessment(PortalCourse course, SystemCourseNode node,
                                                 Map<String, Object> evalData) {
        Map<String, Object> ruleConfig = mapValue(evalData.get("evalRuleConfig"));
        if (ruleConfig == null) {
            return false;
        }
        boolean changed = applyRuleConfig(course, node, ruleConfig);
        if (changed) {
            evalData.put("evalRuleConfig", ruleConfig);
        }
        return changed;
    }

    private boolean generateHybridNodeAssessments(PortalCourse course, SystemCourseNode node,
                                                  Map<String, Object> evalData) {
        Map<String, Object> hybridRules = mapValue(evalData.get("hybridEvalRules"));
        if (hybridRules == null) {
            return false;
        }
        boolean updated = false;
        for (String moduleKey : new String[]{"preQuiz", "inClassQuiz", "homework"}) {
            Map<String, Object> part = mapValue(hybridRules.get(moduleKey));
            if (part == null) {
                continue;
            }
            Map<String, Object> ruleConfig = mapValue(part.get("evalRuleConfig"));
            if (ruleConfig == null) {
                continue;
            }
            boolean changed = applyRuleConfig(course, node, ruleConfig);
            if (changed) {
                part.put("evalRuleConfig", ruleConfig);
                hybridRules.put(moduleKey, part);
                updated = true;
            }
        }
        if (updated) {
            evalData.put("hybridEvalRules", hybridRules);
        }
        return updated;
    }

    /** 按测评方法（paper/question_bank/quiz）生成对应测评实体，写回 methodResourceConfigs。 */
    private boolean applyRuleConfig(PortalCourse course, SystemCourseNode node, Map<String, Object> ruleConfig) {
        List<String> methods = stringList(ruleConfig.get("evaluationMethods"));
        Map<String, Object> methodResourceConfigs = mapValue(ruleConfig.get("methodResourceConfigs"));
        if (methodResourceConfigs == null) {
            methodResourceConfigs = new LinkedHashMap<>();
        }
        boolean updated = false;
        for (String methodKey : methods) {
            Map<String, Object> rc = mapValue(methodResourceConfigs.get(methodKey));
            if (rc == null) {
                rc = new LinkedHashMap<>();
            }
            if ("paper".equals(methodKey)) {
                ensureNodePaperUsage(course, node, rc, ruleConfig);
                methodResourceConfigs.put(methodKey, rc);
                updated = true;
            } else if ("question_bank".equals(methodKey) || "quiz".equals(methodKey)) {
                ensureNodeQuestionExam(course, node, methodKey, rc, ruleConfig);
                methodResourceConfigs.put(methodKey, rc);
                updated = true;
            }
        }
        if (updated) {
            ruleConfig.put("methodResourceConfigs", methodResourceConfigs);
        }
        return updated;
    }

    /** 生成节点试卷安排（paper 方式引用正式试卷 paperIds）。 */
    private void ensureNodePaperUsage(PortalCourse course, SystemCourseNode node,
                                      Map<String, Object> rc, Map<String, Object> ruleConfig) {
        List<String> paperIds = stringList(ruleConfig.get("paperIds"));
        if (paperIds.isEmpty()) {
            return;
        }
        String startTime = extractScheduledTime(rc, "scheduledTime");
        String endTime = extractScheduledTime(rc, "scheduledEndTime");
        Integer duration = extractDuration(rc, "paper");
        String activationMode = resolveActivationMode(rc, "paper");
        Map<String, String> existing = new LinkedHashMap<>();
        for (EvaluationExamUsageMapper.NodeUsageRow row : examUsageMapper.selectNodeUsageRows(paperIds, node.getId())) {
            existing.put(row.getExamId(), row.getId());
        }
        for (String paperId : paperIds) {
            if (paperId == null || paperId.isEmpty()) {
                continue;
            }
            String usageId = existing.get(paperId);
            if (usageId == null) {
                usageId = UUID.randomUUID().toString();
                examUsageMapper.insertNodeUsage(usageId, course.getTenantId(), paperId,
                    autoUsageName(course.getName(), node.getName(), "试卷"), startTime, endTime, duration,
                    "node", List.of(node.getId()), statusFor(activationMode), activationMode,
                    course.getCreatorId(), null);
                rc.put("usageId", usageId);
            } else if (startTime != null || endTime != null || duration != null || rc.get("activationMode") != null) {
                examUsageMapper.updateUsageWindow(usageId, course.getTenantId(), startTime, endTime, duration,
                    activationMode);
            }
        }
    }

    /** 生成节点题库/随堂测考试：临时卷 + 题目同步 + 考试安排。 */
    private void ensureNodeQuestionExam(PortalCourse course, SystemCourseNode node, String methodKey,
                                        Map<String, Object> rc, Map<String, Object> ruleConfig) {
        String field = "question_bank".equals(methodKey) ? "questionBankQuestions" : "quizQuestions";
        List<String> questionIds = stringList(ruleConfig.get(field));
        if (questionIds.isEmpty()) {
            return;
        }
        String label = "question_bank".equals(methodKey) ? "题库" : "随堂测";
        String examId = strValue(rc.get("examId"));
        String usageId = strValue(rc.get("usageId"));
        String startTime = extractScheduledTime(rc, "scheduledTime");
        String endTime = extractScheduledTime(rc, "scheduledEndTime");
        Integer duration = extractDuration(rc, methodKey);
        String activationMode = resolveActivationMode(rc, methodKey);

        if (examId == null || examId.isEmpty()) {
            int examDuration = intValue(rc.get("duration"), 0);
            if (examDuration <= 0) {
                examDuration = intValue(rc.get("timeLimit"), 0);
            }
            if (examDuration <= 0) {
                examDuration = 90;
            }
            examId = createTempExam(course, node.getName() == null ? "" : node.getName(), label, examDuration);
            rc.put("examId", examId);
        }

        syncExamQuestions(course.getTenantId(), examId, questionIds);

        if (usageId == null || usageId.isEmpty()) {
            String found = examUsageMapper.selectNodeUsageId(examId, node.getId());
            if (found != null && !found.isEmpty()) {
                usageId = found;
                rc.put("usageId", usageId);
            }
        }
        if (usageId == null || usageId.isEmpty()) {
            usageId = UUID.randomUUID().toString();
            examUsageMapper.insertNodeUsage(usageId, course.getTenantId(), examId,
                autoUsageName(course.getName(), node.getName(), label), startTime, endTime, duration,
                "node", List.of(node.getId()), statusFor(activationMode), activationMode,
                course.getCreatorId(), null);
            rc.put("usageId", usageId);
        } else if (startTime != null || endTime != null || duration != null || rc.get("activationMode") != null) {
            examUsageMapper.updateUsageWindow(usageId, course.getTenantId(), startTime, endTime, duration,
                activationMode);
        }
    }

    private String createTempExam(PortalCourse course, String nodeName, String label, int duration) {
        String name = (course.getName() == null ? "" : course.getName()) + "-" + nodeName + "-" + label;
        String existing = examMapper.selectTempExamId(course.getTenantId(), name);
        if (existing != null && !existing.isEmpty()) {
            return existing;
        }
        String id = UUID.randomUUID().toString();
        examMapper.insertTempExam(id, course.getTenantId(), generateExamCode(course.getTenantId()), name, duration,
            course.getCreatorId());
        return id;
    }

    /** 同步考试题目（prune 旧题 + 按配置顺序 upsert + 重算总分），对齐 Go SyncExamQuestions。 */
    private void syncExamQuestions(String tenantId, String examId, List<String> questionIds) {
        examQuestionMapper.deleteNotIn(examId, tenantId, questionIds);
        List<EvaluationQuestion> questions = questionMapper.selectByIdsOrdered(questionIds, tenantId);
        int sortOrder = 0;
        for (EvaluationQuestion q : questions) {
            examQuestionMapper.upsertExamQuestion(UUID.randomUUID().toString(), tenantId, examId, q.getId(),
                q.getType(), q.getContent(), q.getOptions(), q.getAnswer(), q.getAnalysis(), q.getScore(), ++sortOrder);
        }
        examQuestionMapper.recalcExamTotal(examId, tenantId);
    }

    // ---------- 测评生成辅助（JSON 提取 / 命名） ----------

    private String generateExamCode(String tenantId) {
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 10; i++) {
            StringBuilder sb = new StringBuilder("SJ-");
            for (int j = 0; j < 8; j++) {
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (!examMapper.existsCode(tenantId, code)) {
                return code;
            }
        }
        throw new ApiException(500, "internal_error", "生成试卷编码失败");
    }

    private String autoUsageName(String courseName, String nodeName, String label) {
        String date = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
        return (courseName == null ? "" : courseName) + "-" + (nodeName == null ? "" : nodeName)
            + "-" + label + "-" + date;
    }

    private String statusFor(String activationMode) {
        return "always".equals(activationMode) ? "published" : "draft";
    }

    private String resolveActivationMode(Map<String, Object> rc, String methodKey) {
        String mode = strValue(rc.get("activationMode"));
        if (mode != null) {
            return mode;
        }
        if ("question_bank".equals(methodKey) || "quiz".equals(methodKey)) {
            return "always";
        }
        return "manual";
    }

    private String extractScheduledTime(Map<String, Object> rc, String key) {
        if (!"scheduled".equals(strValue(rc.get("activationMode")))) {
            return null;
        }
        return strValue(rc.get(key));
    }

    private Integer extractDuration(Map<String, Object> rc, String methodKey) {
        if ("paper".equals(methodKey)) {
            int d = intValue(rc.get("duration"), 0);
            return d > 0 ? d : null;
        }
        int t = intValue(rc.get("timeLimit"), 0);
        if (t > 0) {
            return t;
        }
        int d = intValue(rc.get("duration"), 0);
        return d > 0 ? d : null;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapValue(Object raw) {
        if (raw instanceof Map<?, ?> m) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (e.getKey() != null) {
                    out.put(String.valueOf(e.getKey()), e.getValue());
                }
            }
            return out;
        }
        return null;
    }

    private List<String> stringList(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (Object x : list) {
            if (x != null) {
                out.add(String.valueOf(x));
            }
        }
        return out;
    }

    private String strValue(Object raw) {
        if (raw == null) {
            return null;
        }
        String s = String.valueOf(raw);
        return s.isEmpty() ? null : s;
    }

    private int intValue(Object raw, int def) {
        if (raw instanceof Number n) {
            return n.intValue();
        }
        if (raw != null) {
            try {
                return Integer.parseInt(String.valueOf(raw).trim());
            } catch (NumberFormatException ignored) {
                // 非数字按默认值
            }
        }
        return def;
    }

    // ---------- 克隆辅助 ----------

    private void cloneNodes(String oldCourseId, String newCourseId, String tenantId) {
        List<LessonCourseCloneMapper.NodeSourceRow> nodes = cloneMapper.selectSourceNodes(oldCourseId);
        if (nodes.isEmpty()) {
            return;
        }
        Map<String, String> idMap = new LinkedHashMap<>();
        for (LessonCourseCloneMapper.NodeSourceRow n : nodes) {
            idMap.put(n.getId(), UUID.randomUUID().toString());
        }
        for (LessonCourseCloneMapper.NodeSourceRow n : nodes) {
            String newId = idMap.get(n.getId());
            String newParentId = null;
            if (n.getParentId() != null && !n.getParentId().isEmpty()) {
                newParentId = idMap.get(n.getParentId());
            }
            cloneMapper.insertCloneNode(newId, tenantId, newCourseId, newParentId, n.getName(), n.getCode(),
                n.getSortOrder(), n.getRefType(), n.getSourceId(), n.getSourceName(), n.getTeachingGoals(),
                n.getDetailedDescription(), n.getDescriptionPdf(), n.getBackground(), n.getEstimatedHours(),
                n.getDuration(), n.getDifficulty(), n.getKnowledgePointIds(), n.getResourceIds(),
                n.getAbilityPointIds(), n.getEvalData(), n.getStatus());
            cloneMapper.cloneNodeKnowledgeBindings(n.getId(), newId);
            cloneMapper.cloneNodeResourceBindings(n.getId(), newId);
        }
        List<String> oldNodeIds = new ArrayList<>(idMap.keySet());
        Map<String, String> quizIdMap = new LinkedHashMap<>();
        for (LessonCourseCloneMapper.QuizSourceRow q : cloneMapper.selectSourceQuizzes(oldNodeIds)) {
            String newQuizId = UUID.randomUUID().toString();
            quizIdMap.put(q.getId(), newQuizId);
            cloneMapper.insertCloneQuiz(newQuizId, tenantId, idMap.get(q.getNodeId()), q.getTitle(), q.getType(),
                q.getTimeLimit());
        }
        if (!quizIdMap.isEmpty()) {
            List<String> oldQuizIds = new ArrayList<>(quizIdMap.keySet());
            for (LessonCourseCloneMapper.QuestionSourceRow qq : cloneMapper.selectSourceQuizQuestions(oldQuizIds)) {
                String newQuizId = quizIdMap.get(qq.getQuizId());
                if (newQuizId == null) {
                    continue;
                }
                cloneMapper.insertCloneQuizQuestion(UUID.randomUUID().toString(), tenantId, newQuizId, qq.getType(),
                    qq.getQuestion(), qq.getOptions(), qq.getAnswer(), qq.getScore(), qq.getSortOrder());
            }
        }
        for (LessonCourseCloneMapper.HybridSourceRow m : cloneMapper.selectSourceHybridModules(oldNodeIds)) {
            cloneMapper.insertCloneHybridModule(UUID.randomUUID().toString(), tenantId, idMap.get(m.getNodeId()),
                m.getModuleKey(), m.getMode(), m.getData());
        }
    }

    // ---------- 绑定/同步 ----------

    private void replaceCourseBindings(String tenantId, String courseId, String userId,
                                       List<String> kpIds, List<String> resIds) {
        courseMapper.deleteCourseKnowledgeBindings(courseId);
        for (String kpId : kpIds) {
            courseMapper.insertCourseKnowledgeBinding(tenantId, courseId, kpId, userId);
        }
        courseMapper.deleteCourseResourceBindings(courseId);
        for (String resId : resIds) {
            courseMapper.insertCourseResourceBinding(tenantId, courseId, resId);
        }
    }

    private void syncKpGranularLessons(String tenantId, String courseId, List<String> kpIds) {
        knowledgePointMapper.appendCourseToGranularLessons(courseId, tenantId, kpIds);
        knowledgePointMapper.removeCourseFromGranularLessons(courseId, tenantId, kpIds);
    }

    // ---------- 快照构建 ----------

    private String buildCourseSnapshotJson(String tenantId, String courseId) {
        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.putAll(fromJson(snapshotMapper.selectCourseCoreJson(tenantId, courseId)));
        bundle.putAll(fromJson(snapshotMapper.selectCourseRefsJson(tenantId, courseId)));
        Map<String, Object> granular = new LinkedHashMap<>();
        for (String gid : snapshotMapper.selectGranularCourseIds(tenantId, courseId)) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.putAll(fromJson(snapshotMapper.selectCourseCoreJson(tenantId, gid)));
            entry.putAll(fromJson(snapshotMapper.selectCourseRefsJson(tenantId, gid)));
            granular.put(gid, entry);
        }
        bundle.put("granular_courses", granular);
        try {
            return MAPPER.writeValueAsString(bundle);
        } catch (Exception e) {
            throw new ApiException(500, "internal_error", "构建课程快照失败");
        }
    }

    /** 学生剥离课程快照内嵌测验答案（对齐 Go StripStudentAnswers courses）。 */
    @SuppressWarnings("unchecked")
    private void stripStudentAnswers(Map<String, Object> bundle) {
        Object raw = bundle.get("node_quiz_questions");
        if (raw instanceof List<?> rows) {
            for (Object row : rows) {
                if (row instanceof Map<?, ?> m) {
                    ((Map<String, Object>) m).remove("answer");
                }
            }
        }
        Object granular = bundle.get("granular_courses");
        if (granular instanceof Map<?, ?> map) {
            for (Object entry : map.values()) {
                if (entry instanceof Map<?, ?> core) {
                    Object qs = core.get("node_quiz_questions");
                    if (qs instanceof List<?> qRows) {
                        for (Object row : qRows) {
                            if (row instanceof Map<?, ?> m) {
                                ((Map<String, Object>) m).remove("answer");
                            }
                        }
                    }
                }
            }
        }
    }

    // ---------- 组装 ----------

    private List<CourseDto> assembleList(List<PortalCourse> rows, String tenantId) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> ids = rows.stream().map(PortalCourse::getId).toList();
        Set<String> majorIds = new LinkedHashSet<>();
        Set<String> industryIds = new LinkedHashSet<>();
        Set<String> batchIds = new LinkedHashSet<>();
        Set<String> creatorIds = new LinkedHashSet<>();
        Set<String> kpIds = new LinkedHashSet<>();
        for (PortalCourse c : rows) {
            if (c.getMajorId() != null) {
                majorIds.add(c.getMajorId());
            }
            if (c.getIndustryId() != null) {
                industryIds.add(c.getIndustryId());
            }
            if (c.getBatchId() != null) {
                batchIds.add(c.getBatchId());
            }
            if (c.getCreatorId() != null) {
                creatorIds.add(c.getCreatorId());
            }
            if (c.getKnowledgePointIds() != null) {
                kpIds.addAll(c.getKnowledgePointIds());
            }
        }
        Map<String, String> majorNames = majorIdNames(new ArrayList<>(majorIds));
        Map<String, String> industryNames = industryIdNames(new ArrayList<>(industryIds));
        Map<String, String> batchNames = batchIdNames(new ArrayList<>(batchIds));
        Map<String, String> creatorNames = userIdNames(new ArrayList<>(creatorIds));
        Map<String, String> kpNames = kpIdNames(new ArrayList<>(kpIds));
        Map<String, Long> nodeCounts = nodeCountMap(ids);
        Map<String, Long> viewCounts = viewCountMap(ids);

        List<CourseDto> items = new ArrayList<>(rows.size());
        for (PortalCourse c : rows) {
            CourseDto dto = toDto(c);
            dto.setMajorName(c.getMajorId() == null ? null : majorNames.get(c.getMajorId()));
            dto.setIndustryName(c.getIndustryId() == null ? null : industryNames.get(c.getIndustryId()));
            dto.setBatchName(c.getBatchId() == null ? null : batchNames.get(c.getBatchId()));
            dto.setCreatorName(c.getCreatorId() == null ? null : creatorNames.get(c.getCreatorId()));
            dto.setKnowledgePointNames(mapOrdered(c.getKnowledgePointIds(), kpNames));
            dto.setNodeCount(nodeCounts.getOrDefault(c.getId(), 0L).intValue());
            dto.setResourceCount(c.getResourceIds() == null ? 0 : c.getResourceIds().size());
            dto.setViewCount(viewCounts.getOrDefault(c.getId(), 0L).intValue());
            items.add(dto);
        }
        return items;
    }

    private CourseDto assembleDetail(PortalCourse c, String tenantId) {
        CourseDto dto = toDto(c);
        if (c.getMajorId() != null) {
            dto.setMajorName(majorIdNames(List.of(c.getMajorId())).get(c.getMajorId()));
        }
        if (c.getIndustryId() != null) {
            dto.setIndustryName(industryIdNames(List.of(c.getIndustryId())).get(c.getIndustryId()));
        }
        if (c.getBatchId() != null) {
            dto.setBatchName(batchIdNames(List.of(c.getBatchId())).get(c.getBatchId()));
        }
        if (c.getCreatorId() != null) {
            dto.setCreatorName(userIdNames(List.of(c.getCreatorId())).get(c.getCreatorId()));
        }
        if (c.getKnowledgePointIds() != null && !c.getKnowledgePointIds().isEmpty()) {
            dto.setKnowledgePointNames(mapOrdered(c.getKnowledgePointIds(), kpIdNames(c.getKnowledgePointIds())));
        }
        dto.setNodeCount(nodeCountMap(List.of(c.getId())).getOrDefault(c.getId(), 0L).intValue());
        dto.setResourceCount(c.getResourceIds() == null ? 0 : c.getResourceIds().size());
        dto.setViewCount(viewCountMap(List.of(c.getId())).getOrDefault(c.getId(), 0L).intValue());
        return dto;
    }

    private CourseDto toDto(PortalCourse c) {
        CourseDto dto = new CourseDto();
        dto.setId(c.getId());
        dto.setCode(c.getCode());
        dto.setName(c.getName());
        dto.setType(c.getType());
        dto.setCategory(c.getCategory());
        dto.setMajorId(c.getMajorId());
        dto.setTeacherId(c.getTeacherId());
        dto.setIndustryId(c.getIndustryId());
        dto.setVersion(c.getVersion());
        dto.setOnlineHours(c.getOnlineHours());
        dto.setOfflineHours(c.getOfflineHours());
        dto.setOnlineWeight(c.getOnlineWeight());
        dto.setOfflineWeight(c.getOfflineWeight());
        dto.setSemester(c.getSemester());
        dto.setClassName(c.getClassName());
        dto.setStatus(c.getStatus());
        dto.setCoverColor(c.getCoverColor());
        dto.setCoverImage(c.getCoverImage());
        dto.setCourseTag(c.getCourseTag());
        dto.setDifficulty(c.getDifficulty());
        dto.setDescription(c.getDescription());
        dto.setKnowledgePointIds(c.getKnowledgePointIds());
        dto.setAbilityPointIds(c.getAbilityPointIds());
        dto.setResourceIds(c.getResourceIds());
        dto.setCreatorId(c.getCreatorId());
        dto.setCoCreatorIds(c.getCoCreatorIds());
        dto.setBatchId(c.getBatchId());
        dto.setEvalData(fromJson(c.getEvalData()));
        dto.setStudyCount(c.getStudyCount());
        dto.setCreatedAt(c.getCreatedAt());
        dto.setUpdatedAt(c.getUpdatedAt());
        return dto;
    }

    // ---------- 批量关联查询（防 N+1） ----------

    private Map<String, String> majorIdNames(List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return majorMapper.selectList(QueryBuilder.lambda(PortalMajor.class).in(PortalMajor::getId, ids).build())
            .stream().collect(Collectors.toMap(PortalMajor::getId, m -> m.getName() == null ? "" : m.getName()));
    }

    private Map<String, String> industryIdNames(List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return industryMapper.selectList(QueryBuilder.lambda(PortalIndustry.class).in(PortalIndustry::getId, ids).build())
            .stream().collect(Collectors.toMap(PortalIndustry::getId, m -> m.getName() == null ? "" : m.getName()));
    }

    private Map<String, String> batchIdNames(List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return lessonBatchMapper.selectList(QueryBuilder.lambda(PortalLessonBatch.class).in(PortalLessonBatch::getId, ids).build())
            .stream().collect(Collectors.toMap(PortalLessonBatch::getId, m -> m.getName() == null ? "" : m.getName()));
    }

    private Map<String, String> userIdNames(List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return userMapper.selectList(QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, ids).build())
            .stream().filter(u -> u.getName() != null)
            .collect(Collectors.toMap(ZhiyuUser::getId, ZhiyuUser::getName));
    }

    private Map<String, String> kpIdNames(List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return knowledgePointMapper.selectList(QueryBuilder.lambda(KnowledgePoint.class).in(KnowledgePoint::getId, ids).build())
            .stream().collect(Collectors.toMap(KnowledgePoint::getId, k -> k.getName() == null ? "" : k.getName()));
    }

    private Map<String, Long> nodeCountMap(List<String> courseIds) {
        if (courseIds.isEmpty()) {
            return Map.of();
        }
        return nodeMapper.countNodesByCourseIds(courseIds).stream()
            .collect(Collectors.toMap(SystemCourseNodeMapper.NodeCountRow::getCourseId,
                r -> r.getCnt() == null ? 0L : r.getCnt()));
    }

    private Map<String, Long> viewCountMap(List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return viewCounterMapper.selectList(QueryBuilder.lambda(PortalViewCounter.class)
                .eq(PortalViewCounter::getTargetType, "course")
                .in(PortalViewCounter::getTargetId, ids).build())
            .stream().collect(Collectors.toMap(PortalViewCounter::getTargetId,
                c -> c.getCnt() == null ? 0L : c.getCnt()));
    }

    private List<String> mapOrdered(List<String> ids, Map<String, String> nameMap) {
        if (ids == null) {
            return null;
        }
        List<String> out = new ArrayList<>(ids.size());
        for (String id : ids) {
            out.add(nameMap.getOrDefault(id, ""));
        }
        return out;
    }

    // ---------- 工具 ----------

    private LambdaQueryBuilder<PortalCourse> baseListWrapper(String tenantId, String search, String type,
                                                            String category, String status, String batchId) {
        LambdaQueryBuilder<PortalCourse> wrapper = QueryBuilder.lambda(PortalCourse.class)
            .eq(PortalCourse::getTenantId, tenantId);
        if (type != null && !type.isEmpty()) {
            wrapper.eq(PortalCourse::getType, type);
        }
        if (category != null && !category.isEmpty()) {
            wrapper.eq(PortalCourse::getCategory, category);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(PortalCourse::getStatus, status);
        }
        if (batchId != null && !batchId.isEmpty()) {
            wrapper.eq(PortalCourse::getBatchId, batchId);
        }
        if (search != null && !search.isEmpty()) {
            wrapper.and(w -> w.like(PortalCourse::getName, search).or().like(PortalCourse::getCode, search));
        }
        return wrapper;
    }

    private boolean canTransition(String from, String to) {
        Set<String> allowed = ALLOWED_TRANSITIONS.get(from);
        return allowed != null && allowed.contains(to);
    }

    private PortalCourse fetchOwned(String id) {
        PortalCourse course = courseMapper.selectById(id);
        if (course == null) {
            throw new ApiException(404, "not_found", "课程不存在");
        }
        verifyTenantOwnership(course.getTenantId());
        return course;
    }

    private void verifyTenantOwnership(String entityTenantId) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        if (entityTenantId != null && !entityTenantId.equals(tenantId)) {
            throw new ApiException(403, "forbidden", "无权操作：资源不属于您的租户");
        }
    }

    private boolean userExistsInTenant(String userId, String tenantId) {
        ZhiyuUser user = userMapper.selectById(userId);
        return user != null && tenantId.equals(user.getTenantId());
    }

    private boolean isStudent() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            return false;
        }
        try {
            ZhiyuUser user = userMapper.selectById(userId);
            return user != null && "student".equals(user.getRole());
        } catch (Exception e) {
            return false;
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

    private long clampLimit(long limit, long defaultLimit) {
        if (limit <= 0) {
            return defaultLimit;
        }
        return Math.min(limit, 200);
    }

    private String generateUniqueCode(String tenantId, String prefix) {
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 10; i++) {
            StringBuilder sb = new StringBuilder(prefix).append('-');
            for (int j = 0; j < 8; j++) {
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (!courseMapper.existsCode(tenantId, code)) {
                return code;
            }
        }
        throw new ApiException(500, "internal_error", "生成课程代码失败");
    }

    static String nextVersion(String v) {
        int major = 1;
        int minor = 0;
        String s = v == null ? "" : v.trim();
        int start = 0;
        int end = s.length();
        while (start < end && (s.charAt(start) == 'v' || s.charAt(start) == 'V')) {
            start++;
        }
        while (end > start && (s.charAt(end - 1) == 'v' || s.charAt(end - 1) == 'V')) {
            end--;
        }
        String digits = s.substring(start, end);
        String[] parts = digits.split("\\.");
        if (parts.length > 0) {
            try {
                major = Integer.parseInt(parts[0].trim());
            } catch (NumberFormatException ignored) {
                // 按 V1.0 起算
            }
        }
        if (parts.length > 1) {
            try {
                minor = Integer.parseInt(parts[1].trim());
            } catch (NumberFormatException ignored) {
                // 按 0 起算
            }
        }
        minor++;
        if (minor >= 10) {
            major++;
            minor = 0;
        }
        return "V" + major + "." + minor;
    }

    private boolean empty(String s) {
        return s == null || s.isEmpty();
    }

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
    }

    private String toJson(Map<String, Object> map) {
        try {
            return MAPPER.writeValueAsString(map == null ? Map.of() : map);
        } catch (Exception e) {
            throw new ApiException(400, "bad_request", "评估数据格式不正确");
        }
    }

    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, Object> v = MAPPER.readValue(json, MAP_REF);
            return v == null ? new LinkedHashMap<>() : v;
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }
}
