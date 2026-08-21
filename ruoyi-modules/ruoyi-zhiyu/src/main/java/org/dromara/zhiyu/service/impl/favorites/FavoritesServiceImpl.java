package org.dromara.zhiyu.service.impl.favorites;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.favorites.FavoritesDtos.FavoriteAIKBDto;
import org.dromara.zhiyu.domain.dto.favorites.FavoritesDtos.FavoriteAIAgentDto;
import org.dromara.zhiyu.domain.dto.favorites.FavoritesDtos.FavoriteCourseDto;
import org.dromara.zhiyu.domain.dto.favorites.FavoritesDtos.FavoriteExamDto;
import org.dromara.zhiyu.domain.dto.favorites.FavoritesDtos.FavoriteListResponse;
import org.dromara.zhiyu.domain.dto.favorites.FavoritesDtos.FavoriteQuestionBankDto;
import org.dromara.zhiyu.domain.dto.favorites.FavoritesDtos.FavoriteScenarioDto;
import org.dromara.zhiyu.domain.dto.favorites.FavoritesDtos.FavoriteStatus;
import org.dromara.zhiyu.domain.favorites.FavAIKB;
import org.dromara.zhiyu.domain.favorites.FavAIAgent;
import org.dromara.zhiyu.domain.favorites.FavQuestionBank;
import org.dromara.zhiyu.domain.favorites.ZhiyuFavoriteCounter;
import org.dromara.zhiyu.domain.favorites.ZhiyuUserFavorite;
import org.dromara.zhiyu.domain.portal.PortalCommunityReply;
import org.dromara.zhiyu.domain.portal.PortalExam;
import org.dromara.zhiyu.domain.portal.PortalExamQuestion;
import org.dromara.zhiyu.domain.portal.PortalIndustry;
import org.dromara.zhiyu.domain.portal.PortalLessonBatch;
import org.dromara.zhiyu.domain.portal.PortalMajor;
import org.dromara.zhiyu.domain.portal.PortalOrganization;
import org.dromara.zhiyu.domain.portal.PortalScenario;
import org.dromara.zhiyu.domain.portal.PortalScenarioTask;
import org.dromara.zhiyu.domain.portal.PortalViewCounter;
import org.dromara.zhiyu.domain.lesson.LessonCourse;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.favorites.FavAIKBMapper;
import org.dromara.zhiyu.mapper.favorites.FavAIAgentMapper;
import org.dromara.zhiyu.mapper.favorites.FavQuestionBankMapper;
import org.dromara.zhiyu.mapper.favorites.ZhiyuFavoriteCounterMapper;
import org.dromara.zhiyu.mapper.favorites.ZhiyuUserFavoriteMapper;
import org.dromara.zhiyu.mapper.portal.PortalExamMapper;
import org.dromara.zhiyu.mapper.portal.PortalExamQuestionMapper;
import org.dromara.zhiyu.mapper.portal.PortalIndustryMapper;
import org.dromara.zhiyu.mapper.portal.PortalLessonBatchMapper;
import org.dromara.zhiyu.mapper.portal.PortalMajorMapper;
import org.dromara.zhiyu.mapper.portal.PortalOrganizationMapper;
import org.dromara.zhiyu.mapper.portal.PortalScenarioMapper;
import org.dromara.zhiyu.mapper.portal.PortalScenarioTaskMapper;
import org.dromara.zhiyu.mapper.portal.PortalViewCounterMapper;
import org.dromara.zhiyu.mapper.lesson.LessonCourseMapper;
import org.dromara.zhiyu.service.favorites.IFavoritesService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
 * 通用收藏服务实现（对齐 Go favorites_handler.go + store/favorites.go 语义）。
 *
 * <p>收藏对象归属校验：目标必须属于当前租户（不存在/他租户按不存在处理 404）；
 * ai_kb/ai_agent 仅已发布对象可收藏（私有内容不暴露存在性）。
 * ToggleFavorite 收藏表与计数在同一事务内更新，仅在实际删除/插入后调整计数，避免并发漂移。</p>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class FavoritesServiceImpl implements IFavoritesService {

    public static final String TYPE_SCENE = "scene";
    public static final String TYPE_COURSE = "course";
    public static final String TYPE_QUESTION_BANK = "question_bank";
    public static final String TYPE_EXAM = "exam";
    public static final String TYPE_AI_KB = "ai_kb";
    public static final String TYPE_AI_AGENT = "ai_agent";

    private final ZhiyuUserFavoriteMapper favoriteMapper;
    private final ZhiyuFavoriteCounterMapper counterMapper;
    private final PortalScenarioMapper scenarioMapper;
    private final LessonCourseMapper courseMapper;
    private final FavQuestionBankMapper questionBankMapper;
    private final PortalExamMapper examMapper;
    private final FavAIKBMapper aiKbMapper;
    private final FavAIAgentMapper aiAgentMapper;
    private final ZhiyuUserMapper userMapper;
    private final PortalMajorMapper majorMapper;
    private final PortalIndustryMapper industryMapper;
    private final PortalLessonBatchMapper lessonBatchMapper;
    private final PortalOrganizationMapper organizationMapper;
    private final PortalScenarioTaskMapper scenarioTaskMapper;
    private final PortalExamQuestionMapper examQuestionMapper;
    private final PortalViewCounterMapper viewCounterMapper;

    @Override
    public FavoriteStatus getFavorite(String targetType, String targetId) {
        String userId = requireUser();
        if (!isValidType(targetType)) {
            throw new ApiException(400, "bad_request", "不支持的收藏类型");
        }
        checkTargetTenant(targetType, targetId);
        boolean isFavorite = favoriteMapper.selectCount(
                QueryBuilder.lambda(ZhiyuUserFavorite.class)
                    .eq(ZhiyuUserFavorite::getUserId, userId)
                    .eq(ZhiyuUserFavorite::getTargetType, targetType)
                    .eq(ZhiyuUserFavorite::getTargetId, targetId)
                    .build()) > 0;
        int count = favoriteCount(targetType, targetId);
        FavoriteStatus status = new FavoriteStatus();
        status.setIsFavorite(isFavorite);
        status.setFavoriteCount(count);
        return status;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FavoriteStatus toggleFavorite(String targetType, String targetId) {
        String userId = requireUser();
        if (!isValidType(targetType)) {
            throw new ApiException(400, "bad_request", "不支持的收藏类型");
        }
        checkTargetTenant(targetType, targetId);

        boolean exists = favoriteMapper.selectCount(
                QueryBuilder.lambda(ZhiyuUserFavorite.class)
                    .eq(ZhiyuUserFavorite::getUserId, userId)
                    .eq(ZhiyuUserFavorite::getTargetType, targetType)
                    .eq(ZhiyuUserFavorite::getTargetId, targetId)
                    .build()) > 0;

        boolean toggled;
        if (exists) {
            favoriteMapper.delete(
                QueryBuilder.lambda(ZhiyuUserFavorite.class)
                    .eq(ZhiyuUserFavorite::getUserId, userId)
                    .eq(ZhiyuUserFavorite::getTargetType, targetType)
                    .eq(ZhiyuUserFavorite::getTargetId, targetId)
                    .build());
            counterMapper.decrement(targetType, targetId);
            toggled = false;
        } else {
            ZhiyuUserFavorite fav = new ZhiyuUserFavorite();
            fav.setUserId(userId);
            fav.setTargetType(targetType);
            fav.setTargetId(targetId);
            boolean inserted = true;
            try {
                favoriteMapper.insert(fav);
            } catch (DuplicateKeyException e) {
                // 并发下该行可能已被另一请求插入（对齐 Go ON DUPLICATE KEY UPDATE id = id 静默 no-op）
                inserted = false;
            }
            if (inserted) {
                counterMapper.increment(targetType, targetId);
            }
            toggled = true;
        }
        FavoriteStatus status = new FavoriteStatus();
        status.setIsFavorite(toggled);
        status.setFavoriteCount(favoriteCount(targetType, targetId));
        return status;
    }

    @Override
    public FavoriteListResponse list() {
        String userId = requireUser();
        String tenantId = TenantContext.getTenantId() == null ? "" : TenantContext.getTenantId();

        FavoriteListResponse resp = new FavoriteListResponse();
        resp.setScene(listScenes(userId, tenantId));
        resp.setCourse(listCourses(userId, tenantId));
        resp.setQuestionBank(listQuestionBanks(userId, tenantId));
        resp.setExam(listExams(userId, tenantId));
        resp.setAiKb(listAIKBs(userId, tenantId));
        resp.setAiAgent(listAIAgents(userId, tenantId));
        return resp;
    }

    // ---------- 各类型收藏列表 ----------

    private List<FavoriteScenarioDto> listScenes(String userId, String tenantId) {
        List<String> ids = favoriteTargetIds(userId, TYPE_SCENE);
        if (ids.isEmpty()) {
            return new ArrayList<>();
        }
        List<PortalScenario> rows = scenarioMapper.selectList(
            QueryBuilder.lambda(PortalScenario.class)
                .in(PortalScenario::getId, ids)
                .eq(PortalScenario::getTenantId, tenantId)
                .eq(PortalScenario::getStatus, "published")
                .build());
        Map<String, PortalScenario> byId = rows.stream()
            .collect(Collectors.toMap(PortalScenario::getId, Function.identity()));

        Map<String, String> creatorNames = userNameMap(
            rows.stream().map(PortalScenario::getCreatorId).filter(java.util.Objects::nonNull).collect(Collectors.toSet()));
        Map<String, Long> viewMap = viewCounterMap("scenario", ids);

        // 行业/专业名称（批量）
        Set<String> industryIds = new LinkedHashSet<>();
        Set<String> professionIds = new LinkedHashSet<>();
        for (PortalScenario s : rows) {
            if (s.getIndustryIds() != null) {
                industryIds.addAll(s.getIndustryIds());
            }
            if (s.getProfessionIds() != null) {
                professionIds.addAll(s.getProfessionIds());
            }
        }
        Map<String, String> industryNames = nameMapByIds(industryMapper, PortalIndustry.class, industryIds);
        Map<String, String> professionNames = nameMapByIds(majorMapper, PortalMajor.class, professionIds);

        // 任务数（批量）
        Map<String, Long> taskCounts = new HashMap<>();
        if (!rows.isEmpty()) {
            List<PortalScenarioTask> tasks = scenarioTaskMapper.selectList(
                QueryBuilder.lambda(PortalScenarioTask.class)
                    .in(PortalScenarioTask::getScenarioId, ids)
                    .build());
            taskCounts = tasks.stream().collect(Collectors.groupingBy(PortalScenarioTask::getScenarioId, Collectors.counting()));
        }

        List<FavoriteScenarioDto> items = new ArrayList<>();
        for (String id : ids) {
            PortalScenario s = byId.get(id);
            if (s == null) {
                continue;
            }
            FavoriteScenarioDto dto = new FavoriteScenarioDto();
            dto.setId(s.getId());
            dto.setName(s.getName());
            dto.setCode(s.getCode());
            dto.setCoverImage(s.getCoverImage());
            dto.setCareerPositionId(s.getCareerPositionId());
            dto.setIndustryIds(s.getIndustryIds());
            dto.setIndustryNames(mapOrdered(s.getIndustryIds(), industryNames));
            dto.setProfessionIds(s.getProfessionIds());
            dto.setProfessionNames(mapOrdered(s.getProfessionIds(), professionNames));
            dto.setBatchId(s.getBatchId());
            dto.setDifficulty(s.getDifficulty());
            dto.setVersion(s.getVersion());
            dto.setViewCount(viewMap.getOrDefault(id, 0L).intValue());
            dto.setStatus(s.getStatus());
            dto.setSourceType(s.getSourceType());
            dto.setSourceEnterpriseId(s.getSourceEnterpriseId());
            dto.setBackground(s.getBackground());
            dto.setDeliveryGoal(s.getDeliveryGoal());
            dto.setCreatorId(s.getCreatorId());
            dto.setCreatorName(s.getCreatorId() == null ? null : creatorNames.get(s.getCreatorId()));
            dto.setCoBuilderIds(s.getCoBuilderIds());
            dto.setCreatedAt(s.getCreatedAt());
            dto.setUpdatedAt(s.getUpdatedAt());
            dto.setPublishTime(s.getPublishTime());
            dto.setTaskCount(taskCounts.getOrDefault(id, 0L).intValue());
            items.add(dto);
        }
        return items;
    }

    private List<FavoriteCourseDto> listCourses(String userId, String tenantId) {
        List<String> ids = favoriteTargetIds(userId, TYPE_COURSE);
        if (ids.isEmpty()) {
            return new ArrayList<>();
        }
        List<LessonCourse> rows = courseMapper.selectList(
            QueryBuilder.lambda(LessonCourse.class)
                .in(LessonCourse::getId, ids)
                .eq(LessonCourse::getTenantId, tenantId)
                .eq(LessonCourse::getStatus, "published")
                .build());
        Map<String, LessonCourse> byId = rows.stream()
            .collect(Collectors.toMap(LessonCourse::getId, Function.identity()));

        Set<String> creatorIds = rows.stream().map(LessonCourse::getCreatorId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Set<String> majorIds = rows.stream().map(LessonCourse::getMajorId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Set<String> industryIds = rows.stream().map(LessonCourse::getIndustryId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Set<String> batchIds = rows.stream().map(LessonCourse::getBatchId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());

        Map<String, String> creatorNames = userNameMap(creatorIds);
        Map<String, String> majorNames = nameMapByIds(majorMapper, PortalMajor.class, majorIds);
        Map<String, String> industryNames = nameMapByIds(industryMapper, PortalIndustry.class, industryIds);
        Map<String, String> batchNames = nameMapByIds(lessonBatchMapper, PortalLessonBatch.class, batchIds);
        Map<String, Long> viewMap = viewCounterMap("course", ids);

        List<FavoriteCourseDto> items = new ArrayList<>();
        for (String id : ids) {
            LessonCourse c = byId.get(id);
            if (c == null) {
                continue;
            }
            FavoriteCourseDto dto = new FavoriteCourseDto();
            dto.setId(c.getId());
            dto.setCode(c.getCode());
            dto.setName(c.getName());
            dto.setType(c.getType());
            dto.setCategory(c.getCategory());
            dto.setMajorId(c.getMajorId());
            dto.setMajorName(c.getMajorId() == null ? null : majorNames.get(c.getMajorId()));
            dto.setDescription(c.getDescription());
            dto.setTeacherId(c.getTeacherId());
            dto.setIndustryId(c.getIndustryId());
            dto.setIndustryName(c.getIndustryId() == null ? null : industryNames.get(c.getIndustryId()));
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
            dto.setKnowledgePointIds(c.getKnowledgePointIds());
            dto.setAbilityPointIds(c.getAbilityPointIds());
            dto.setResourceIds(c.getResourceIds());
            dto.setCreatorId(c.getCreatorId());
            dto.setCreatorName(c.getCreatorId() == null ? null : creatorNames.get(c.getCreatorId()));
            dto.setCoCreatorIds(c.getCoCreatorIds());
            dto.setBatchId(c.getBatchId());
            dto.setBatchName(c.getBatchId() == null ? null : batchNames.get(c.getBatchId()));
            dto.setNodeCount(c.getNodeCount() == null ? 0 : c.getNodeCount());
            dto.setResourceCount(c.getResourceCount() == null ? 0 : c.getResourceCount());
            dto.setStudyCount(c.getStudyCount() == null ? 0 : c.getStudyCount());
            dto.setViewCount(viewMap.getOrDefault(id, 0L).intValue());
            dto.setCreatedAt(c.getCreatedAt());
            dto.setUpdatedAt(c.getUpdatedAt());
            items.add(dto);
        }
        return items;
    }

    private List<FavoriteQuestionBankDto> listQuestionBanks(String userId, String tenantId) {
        List<String> ids = favoriteTargetIds(userId, TYPE_QUESTION_BANK);
        if (ids.isEmpty()) {
            return new ArrayList<>();
        }
        List<FavQuestionBank> rows = questionBankMapper.selectList(
            QueryBuilder.lambda(FavQuestionBank.class)
                .in(FavQuestionBank::getId, ids)
                .eq(FavQuestionBank::getTenantId, tenantId)
                .eq(FavQuestionBank::getStatus, "published")
                .build());
        Map<String, FavQuestionBank> byId = rows.stream()
            .collect(Collectors.toMap(FavQuestionBank::getId, Function.identity()));
        Set<String> creatorIds = rows.stream().map(FavQuestionBank::getCreatorId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<String, String> creatorNames = userNameMap(creatorIds);
        Map<String, String> collaboratorNames = userNameMap(rows.stream()
            .map(FavQuestionBank::getCollaboratorIds)
            .filter(java.util.Objects::nonNull)
            .flatMap(List::stream)
            .collect(Collectors.toSet()));

        List<FavoriteQuestionBankDto> items = new ArrayList<>();
        for (String id : ids) {
            FavQuestionBank b = byId.get(id);
            if (b == null) {
                continue;
            }
            FavoriteQuestionBankDto dto = new FavoriteQuestionBankDto();
            dto.setId(b.getId());
            dto.setCode(b.getCode());
            dto.setName(b.getName());
            dto.setDescription(b.getDescription());
            dto.setCoverImage(b.getCoverImage());
            dto.setStatus(b.getStatus());
            dto.setQuestionCount(b.getQuestionCount() == null ? 0 : b.getQuestionCount());
            dto.setCreatorId(b.getCreatorId());
            dto.setCreatorName(b.getCreatorId() == null ? null : creatorNames.get(b.getCreatorId()));
            dto.setCollaboratorIds(b.getCollaboratorIds());
            dto.setCollaboratorNames(mapOrdered(b.getCollaboratorIds(), collaboratorNames));
            dto.setCollaboratorDeptIds(b.getCollaboratorDeptIds());
            dto.setBatchId(b.getBatchId());
            dto.setVersion(b.getVersion());
            dto.setOwnerType(b.getOwnerType());
            dto.setIsDraftPool(b.getIsDraftPool());
            dto.setCreatedAt(b.getCreatedAt());
            dto.setUpdatedAt(b.getUpdatedAt());
            items.add(dto);
        }
        return items;
    }

    private List<FavoriteExamDto> listExams(String userId, String tenantId) {
        List<String> ids = favoriteTargetIds(userId, TYPE_EXAM);
        if (ids.isEmpty()) {
            return new ArrayList<>();
        }
        List<PortalExam> rows = examMapper.selectList(
            QueryBuilder.lambda(PortalExam.class)
                .in(PortalExam::getId, ids)
                .eq(PortalExam::getTenantId, tenantId)
                .eq(PortalExam::getStatus, "published")
                .eq(PortalExam::getIsTemp, false)
                .build());
        Map<String, PortalExam> byId = rows.stream()
            .collect(Collectors.toMap(PortalExam::getId, Function.identity()));
        Set<String> creatorIds = rows.stream().map(PortalExam::getCreatorId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<String, String> creatorNames = userNameMap(creatorIds);
        Map<String, String> collaboratorNames = userNameMap(rows.stream()
            .map(PortalExam::getCollaboratorIds)
            .filter(java.util.Objects::nonNull)
            .flatMap(List::stream)
            .collect(Collectors.toSet()));

        // 题目数（批量）
        Map<String, Long> questionCounts = new HashMap<>();
        if (!rows.isEmpty()) {
            List<PortalExamQuestion> questions = examQuestionMapper.selectList(
                QueryBuilder.lambda(PortalExamQuestion.class).in(PortalExamQuestion::getExamId, ids).build());
            questionCounts = questions.stream().collect(Collectors.groupingBy(PortalExamQuestion::getExamId, Collectors.counting()));
        }

        List<FavoriteExamDto> items = new ArrayList<>();
        for (String id : ids) {
            PortalExam e = byId.get(id);
            if (e == null) {
                continue;
            }
            FavoriteExamDto dto = new FavoriteExamDto();
            dto.setId(e.getId());
            dto.setCode(e.getCode());
            dto.setName(e.getName());
            dto.setDescription(e.getDescription());
            dto.setStatus(e.getStatus());
            dto.setTotalScore(e.getTotalScore());
            dto.setDuration(e.getDuration());
            dto.setQuestionCount(questionCounts.getOrDefault(id, 0L).intValue());
            dto.setCoverImage(e.getCoverImage());
            dto.setCollaboratorIds(e.getCollaboratorIds());
            dto.setCollaboratorNames(mapOrdered(e.getCollaboratorIds(), collaboratorNames));
            dto.setCollaboratorDeptIds(e.getCollaboratorDeptIds());
            dto.setBatchId(e.getBatchId());
            dto.setVersion(e.getVersion());
            dto.setOwnerType(e.getOwnerType());
            dto.setCreatorId(e.getCreatorId());
            dto.setCreatorName(e.getCreatorId() == null ? null : creatorNames.get(e.getCreatorId()));
            dto.setIsTemp(e.getIsTemp());
            dto.setCreatedAt(e.getCreatedAt());
            dto.setUpdatedAt(e.getUpdatedAt());
            items.add(dto);
        }
        return items;
    }

    private List<FavoriteAIKBDto> listAIKBs(String userId, String tenantId) {
        List<String> ids = favoriteTargetIds(userId, TYPE_AI_KB);
        if (ids.isEmpty()) {
            return new ArrayList<>();
        }
        List<FavAIKB> rows = aiKbMapper.selectList(
            QueryBuilder.lambda(FavAIKB.class)
                .in(FavAIKB::getId, ids)
                .eq(FavAIKB::getTenantId, tenantId)
                .eq(FavAIKB::getStatus, "published")
                .build());
        Map<String, FavAIKB> byId = rows.stream()
            .collect(Collectors.toMap(FavAIKB::getId, Function.identity()));

        Set<String> ownerIds = rows.stream().map(FavAIKB::getOwnerId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Set<String> majorIds = rows.stream().map(FavAIKB::getMajorId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Set<String> deptIds = rows.stream().map(FavAIKB::getDepartmentId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<String, String> ownerNames = userNameMap(ownerIds);
        Map<String, String> majorNames = nameMapByIds(majorMapper, PortalMajor.class, majorIds);
        Map<String, String> deptNames = nameMapByIds(organizationMapper, PortalOrganization.class, deptIds);
        Map<String, Long> viewMap = viewCounterMap("ai_kb", ids);

        List<FavoriteAIKBDto> items = new ArrayList<>();
        for (String id : ids) {
            FavAIKB kb = byId.get(id);
            if (kb == null) {
                continue;
            }
            FavoriteAIKBDto dto = new FavoriteAIKBDto();
            dto.setId(kb.getId());
            dto.setName(kb.getName());
            dto.setDescription(kb.getDescription());
            dto.setTags(kb.getTags());
            dto.setCoverImage(kb.getCoverImage());
            dto.setStatus(kb.getStatus());
            dto.setReviewComment(kb.getReviewComment());
            dto.setDocCount(kb.getDocCount() == null ? 0 : kb.getDocCount());
            dto.setAskCount(kb.getAskCount() == null ? 0L : kb.getAskCount());
            dto.setViewCount(viewMap.getOrDefault(id, 0L).intValue());
            dto.setOwnerId(kb.getOwnerId());
            dto.setMajorId(kb.getMajorId());
            dto.setDepartmentId(kb.getDepartmentId());
            dto.setMajorName(kb.getMajorId() == null ? null : majorNames.get(kb.getMajorId()));
            dto.setDepartmentName(kb.getDepartmentId() == null ? null : deptNames.get(kb.getDepartmentId()));
            dto.setKbType(kb.getKbType());
            dto.setOwnerName(kb.getOwnerId() == null ? null : ownerNames.get(kb.getOwnerId()));
            dto.setCreatedAt(kb.getCreatedAt());
            dto.setUpdatedAt(kb.getUpdatedAt());
            items.add(dto);
        }
        return items;
    }

    private List<FavoriteAIAgentDto> listAIAgents(String userId, String tenantId) {
        List<String> ids = favoriteTargetIds(userId, TYPE_AI_AGENT);
        if (ids.isEmpty()) {
            return new ArrayList<>();
        }
        List<FavAIAgent> rows = aiAgentMapper.selectList(
            QueryBuilder.lambda(FavAIAgent.class)
                .in(FavAIAgent::getId, ids)
                .eq(FavAIAgent::getTenantId, tenantId)
                .eq(FavAIAgent::getStatus, "published")
                .build());
        Map<String, FavAIAgent> byId = rows.stream()
            .collect(Collectors.toMap(FavAIAgent::getId, Function.identity()));

        Set<String> ownerIds = rows.stream().map(FavAIAgent::getOwnerId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Set<String> majorIds = rows.stream().map(FavAIAgent::getMajorId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Set<String> deptIds = rows.stream().map(FavAIAgent::getDepartmentId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        Map<String, String> ownerNames = userNameMap(ownerIds);
        Map<String, String> majorNames = nameMapByIds(majorMapper, PortalMajor.class, majorIds);
        Map<String, String> deptNames = nameMapByIds(organizationMapper, PortalOrganization.class, deptIds);
        Map<String, Long> viewMap = viewCounterMap("ai_agent", ids);

        List<FavoriteAIAgentDto> items = new ArrayList<>();
        for (String id : ids) {
            FavAIAgent a = byId.get(id);
            if (a == null) {
                continue;
            }
            FavoriteAIAgentDto dto = new FavoriteAIAgentDto();
            dto.setId(a.getId());
            dto.setName(a.getName());
            dto.setAvatar(a.getAvatar());
            dto.setDescription(a.getDescription());
            dto.setCoverImage(a.getCoverImage());
            dto.setGreeting(a.getGreeting());
            dto.setSystemPrompt(a.getSystemPrompt());
            dto.setStatus(a.getStatus());
            dto.setReviewComment(a.getReviewComment());
            dto.setChatCount(a.getChatCount() == null ? 0L : a.getChatCount());
            dto.setViewCount(viewMap.getOrDefault(id, 0L).intValue());
            dto.setMajorId(a.getMajorId());
            dto.setDepartmentId(a.getDepartmentId());
            dto.setMajorName(a.getMajorId() == null ? null : majorNames.get(a.getMajorId()));
            dto.setDepartmentName(a.getDepartmentId() == null ? null : deptNames.get(a.getDepartmentId()));
            dto.setOwnerId(a.getOwnerId());
            dto.setOwnerName(a.getOwnerId() == null ? null : ownerNames.get(a.getOwnerId()));
            dto.setCreatedAt(a.getCreatedAt());
            dto.setUpdatedAt(a.getUpdatedAt());
            items.add(dto);
        }
        return items;
    }

    // ---------- 助手 ----------

    /** 用户收藏目标 ID（按收藏时间倒序） */
    private List<String> favoriteTargetIds(String userId, String targetType) {
        List<ZhiyuUserFavorite> favs = favoriteMapper.selectList(
            QueryBuilder.lambda(ZhiyuUserFavorite.class)
                .eq(ZhiyuUserFavorite::getUserId, userId)
                .eq(ZhiyuUserFavorite::getTargetType, targetType)
                .orderByDesc(ZhiyuUserFavorite::getCreatedAt)
                .build());
        return favs.stream().map(ZhiyuUserFavorite::getTargetId).toList();
    }

    private int favoriteCount(String targetType, String targetId) {
        try {
            ZhiyuFavoriteCounter counter = counterMapper.selectOne(
                QueryBuilder.lambda(ZhiyuFavoriteCounter.class)
                    .eq(ZhiyuFavoriteCounter::getTargetType, targetType)
                    .eq(ZhiyuFavoriteCounter::getTargetId, targetId)
                    .build());
            return counter == null || counter.getCnt() == null ? 0 : counter.getCnt().intValue();
        } catch (Exception e) {
            log.warn("favorite count query failed", e);
            return 0;
        }
    }

    /** 收藏目标归属校验（不存在/他租户按不存在处理 404；ai_kb/ai_agent 仅已发布） */
    private void checkTargetTenant(String targetType, String targetId) {
        String tenantId = TenantContext.getTenantId() == null ? "" : TenantContext.getTenantId();
        String targetTenant = targetTenantOf(targetType, targetId);
        if (targetTenant == null || !targetTenant.equals(tenantId)) {
            throw new ApiException(404, "not_found", "收藏对象不存在");
        }
    }

    private String targetTenantOf(String targetType, String targetId) {
        try {
            return switch (targetType) {
                case TYPE_SCENE -> {
                    PortalScenario s = scenarioMapper.selectOne(
                        QueryBuilder.lambda(PortalScenario.class).eq(PortalScenario::getId, targetId).build());
                    yield s == null ? null : s.getTenantId();
                }
                case TYPE_COURSE -> {
                    LessonCourse c = courseMapper.selectOne(
                        QueryBuilder.lambda(LessonCourse.class).eq(LessonCourse::getId, targetId).build());
                    yield c == null ? null : c.getTenantId();
                }
                case TYPE_QUESTION_BANK -> {
                    FavQuestionBank b = questionBankMapper.selectOne(
                        QueryBuilder.lambda(FavQuestionBank.class).eq(FavQuestionBank::getId, targetId).build());
                    yield b == null ? null : b.getTenantId();
                }
                case TYPE_EXAM -> {
                    PortalExam e = examMapper.selectOne(
                        QueryBuilder.lambda(PortalExam.class).eq(PortalExam::getId, targetId).build());
                    yield e == null ? null : e.getTenantId();
                }
                case TYPE_AI_KB -> {
                    FavAIKB kb = aiKbMapper.selectOne(
                        QueryBuilder.lambda(FavAIKB.class)
                            .eq(FavAIKB::getId, targetId)
                            .eq(FavAIKB::getStatus, "published")
                            .build());
                    yield kb == null ? null : kb.getTenantId();
                }
                case TYPE_AI_AGENT -> {
                    FavAIAgent a = aiAgentMapper.selectOne(
                        QueryBuilder.lambda(FavAIAgent.class)
                            .eq(FavAIAgent::getId, targetId)
                            .eq(FavAIAgent::getStatus, "published")
                            .build());
                    yield a == null ? null : a.getTenantId();
                }
                default -> null;
            };
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isValidType(String targetType) {
        return TYPE_SCENE.equals(targetType) || TYPE_COURSE.equals(targetType)
            || TYPE_QUESTION_BANK.equals(targetType) || TYPE_EXAM.equals(targetType)
            || TYPE_AI_KB.equals(targetType) || TYPE_AI_AGENT.equals(targetType);
    }

    private String requireUser() {
        String userId = TenantContext.getUserId();
        if (userId == null || userId.isBlank()) {
            throw new ApiException(401, "unauthorized", "请先登录");
        }
        return userId;
    }

    private Map<String, String> userNameMap(Set<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return userMapper.selectList(QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, ids).build())
                .stream()
                .filter(u -> u.getName() != null)
                .collect(Collectors.toMap(ZhiyuUser::getId, ZhiyuUser::getName));
        } catch (Exception e) {
            log.warn("favorites user name batch query failed", e);
            return Map.of();
        }
    }

    private <T> Map<String, String> nameMapByIds(com.baomidou.mybatisplus.core.mapper.BaseMapper<T> mapper, Class<T> clazz, Set<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<String, String> map = new LinkedHashMap<>();
        try {
            List<String> idList = new ArrayList<>(ids);
            StringBuilder placeholders = new StringBuilder();
            for (int i = 0; i < idList.size(); i++) {
                if (i > 0) {
                    placeholders.append(',');
                }
                placeholders.append('{').append(i).append('}');
            }
            List<T> rows = mapper.selectList(
                QueryBuilder.lambda(clazz).apply("id IN (" + placeholders + ")", idList.toArray()).build());
            for (T row : rows) {
                String id = readField(row, "id");
                String name = readField(row, "name");
                if (id != null && name != null) {
                    map.put(id, name);
                }
            }
        } catch (Exception e) {
            log.warn("favorites name batch query failed for " + clazz.getSimpleName(), e);
        }
        return map;
    }

    /** 按 ID 顺序映射名称（未命中元素置 null，对齐 Go COALESCE 空串语义） */
    private List<String> mapOrdered(List<String> ids, Map<String, String> nameMap) {
        if (ids == null || ids.isEmpty()) {
            return null;
        }
        List<String> out = new ArrayList<>(ids.size());
        for (String id : ids) {
            String name = nameMap.get(id);
            out.add(name == null ? null : name);
        }
        return out;
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
            log.warn("favorites view counter query failed", e);
        }
        return map;
    }

    /** 反射读取实体字段（仅 id/name，本地小工具） */
    private String readField(Object row, String field) {
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
