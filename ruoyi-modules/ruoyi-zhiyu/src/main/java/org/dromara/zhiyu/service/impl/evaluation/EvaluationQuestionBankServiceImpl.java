package org.dromara.zhiyu.service.impl.evaluation;

import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.util.ZhiyuJsonUtils;
import org.dromara.zhiyu.core.constant.ZhiyuStatusConstants;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateQuestionBankRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.CreateQuestionRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.QuestionBankDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.QuestionDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.RandomDrawQuestionDto;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.RandomDrawQuestionRequest;
import org.dromara.zhiyu.domain.dto.evaluation.EvaluationDtos.ReviewRequest;
import org.dromara.zhiyu.domain.evaluation.EvaluationQuestion;
import org.dromara.zhiyu.domain.evaluation.EvaluationQuestionBank;
import org.dromara.zhiyu.domain.evaluation.EvaluationRandomDrawQuestion;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationQuestionBankMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationQuestionMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationRandomDrawQuestionMapper;
import org.dromara.zhiyu.mapper.evaluation.EvaluationSnapshotMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.evaluation.IEvaluationQuestionBankService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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
 * 题库/题目/随机抽题服务实现（对齐 Go question_bank_handler.go + question_handler.go +
 * random_draw_question_handler.go + content_actions.go + store 层语义）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class EvaluationQuestionBankServiceImpl implements IEvaluationQuestionBankService {

    /** 编码字母表（对齐 Go entityCodeAlphabet） */
    private static final String CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    private static final TypeReference<List<String>> STRING_LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<List<Object>> OBJECT_LIST_REF = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> MAP_REF = new TypeReference<>() {
    };

    /** 允许的状态流转（对齐 Go allowedStatusTransitions） */
    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
        ZhiyuStatusConstants.DRAFT, Set.of(ZhiyuStatusConstants.PENDING, "archived"),
        ZhiyuStatusConstants.REJECTED, Set.of(ZhiyuStatusConstants.DRAFT, ZhiyuStatusConstants.PENDING, "archived"),
        ZhiyuStatusConstants.PENDING, Set.of(ZhiyuStatusConstants.DRAFT, ZhiyuStatusConstants.APPROVED, ZhiyuStatusConstants.REJECTED),
        ZhiyuStatusConstants.APPROVED, Set.of(ZhiyuStatusConstants.DRAFT, ZhiyuStatusConstants.PUBLISHED, "archived"),
        ZhiyuStatusConstants.PUBLISHED, Set.of(ZhiyuStatusConstants.DRAFT, "archived"),
        "archived", Set.of(ZhiyuStatusConstants.DRAFT)
    );

    private final SystemGuard systemGuard;
    private final EvaluationQuestionBankMapper bankMapper;
    private final EvaluationQuestionMapper questionMapper;
    private final EvaluationRandomDrawQuestionMapper randomDrawMapper;
    private final EvaluationSnapshotMapper snapshotMapper;
    private final ZhiyuUserMapper userMapper;

    // ==================== 题库 question-banks ====================

    @Override
    public ListResponse<QuestionBankDto> listBanks(String search, String status, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        // 确保用户草稿池存在（对齐 Go List 前置 EnsureDraftPool；失败仅记日志不阻断）
        try {
            ensureDraftPool(tenantId, userId);
        } catch (Exception ignored) {
            // 草稿池确保失败不阻断列表
        }
        LambdaQueryBuilder<EvaluationQuestionBank> wrapper = QueryBuilder.lambda(EvaluationQuestionBank.class)
            .eq(EvaluationQuestionBank::getTenantId, tenantId);
        if (search != null && !search.isBlank()) {
            String pattern = toLikePattern(search);
            wrapper.and(w -> w.apply("name LIKE {0} ESCAPE '\\'", pattern)
                .or().apply("description LIKE {0} ESCAPE '\\'", pattern));
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(EvaluationQuestionBank::getStatus, status);
        }
        long total = bankMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(EvaluationQuestionBank::getIsDraftPool)
            .orderByDesc(EvaluationQuestionBank::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<EvaluationQuestionBank> rows = bankMapper.selectList(wrapper.build());
        return ListResponse.of(assembleBanks(rows), total);
    }

    @Override
    public QuestionBankDto getBank(String id) {
        systemGuard.requireUser();
        EvaluationQuestionBank bank = fetchBank(id);
        // 学生仅可读已发布题库（决策 7）
        if (isStudent() && !ZhiyuStatusConstants.PUBLISHED.equals(bank.getStatus())) {
            throw new ApiException(404, "not_found", "题库不存在");
        }
        return assembleBank(bank);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QuestionBankDto createBank(CreateQuestionBankRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String id = UUID.randomUUID().toString();
        String code = generateUniqueCode(tenantId, "TK", bankMapper::existsCode);
        bankMapper.insertBank(id, tenantId, code, req.getName(), emptyToNull(req.getDescription()),
            emptyToNull(req.getCoverImage()), userId, coalesce(req.getCollaboratorIds()),
            coalesce(req.getCollaboratorDeptIds()), emptyToNull(req.getBatchId()));
        replaceKps(id, coalesce(req.getKnowledgePointIds()));
        return assembleBank(fetchBank(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QuestionBankDto updateBank(String id, CreateQuestionBankRequest req) {
        systemGuard.requireUser();
        EvaluationQuestionBank existing = fetchBank(id);
        String tenantId = systemGuard.requireTenant();
        if (Boolean.TRUE.equals(existing.getIsDraftPool())) {
            throw new ApiException(403, "forbidden", "草稿库不允许编辑");
        }
        String name = req.getName() == null || req.getName().isEmpty() ? existing.getName() : req.getName();
        String description = req.getDescription() != null ? emptyToNull(req.getDescription()) : existing.getDescription();
        String coverImage = req.getCoverImage() != null ? emptyToNull(req.getCoverImage()) : existing.getCoverImage();
        List<String> collaboratorIds = req.getCollaboratorIds() != null ? coalesce(req.getCollaboratorIds())
            : coalesce(existing.getCollaboratorIds());
        List<String> collaboratorDeptIds = req.getCollaboratorDeptIds() != null ? coalesce(req.getCollaboratorDeptIds())
            : coalesce(existing.getCollaboratorDeptIds());
        String batchId = req.getBatchId() != null ? emptyToNull(req.getBatchId()) : existing.getBatchId();
        bankMapper.updateBank(id, tenantId, name, description, coverImage, collaboratorIds, collaboratorDeptIds, batchId);
        if (req.getKnowledgePointIds() != null) {
            replaceKps(id, coalesce(req.getKnowledgePointIds()));
        }
        return assembleBank(fetchBank(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String deleteBank(String id) {
        systemGuard.requireUser();
        EvaluationQuestionBank bank = fetchBank(id);
        String tenantId = systemGuard.requireTenant();
        if (Boolean.TRUE.equals(bank.getIsDraftPool())) {
            throw new ApiException(403, "forbidden", "草稿库不允许删除");
        }
        // 引用检查：题库下题目已被试卷组卷时禁止删除（级联会损坏试卷快照）
        if (bankMapper.countBankQuestionRefs(id) > 0) {
            throw new ApiException(409, "conflict", "题库内题目已被试卷引用，无法删除");
        }
        bankMapper.deleteKps(id);
        questionMapper.delete(QueryBuilder.lambda(EvaluationQuestion.class)
            .eq(EvaluationQuestion::getBankId, id).eq(EvaluationQuestion::getTenantId, tenantId).build());
        bankMapper.deleteById(id);
        return id;
    }

    // ---------- 状态流转 / 审核 / 邀请 ----------

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QuestionBankDto submitBank(String id) {
        return transition(id, ZhiyuStatusConstants.PENDING);
    }

    @Override
    public QuestionBankDto reviewBank(String id, ReviewRequest req) {
        systemGuard.requireUser();
        String toStatus;
        if (ZhiyuStatusConstants.APPROVED.equals(req.getStatus())) {
            toStatus = ZhiyuStatusConstants.APPROVED;
        } else if (ZhiyuStatusConstants.REJECTED.equals(req.getStatus())) {
            toStatus = ZhiyuStatusConstants.REJECTED;
        } else {
            throw new ApiException(400, "bad_request", "无效的审核状态");
        }
        EvaluationQuestionBank bank = fetchBank(id);
        String tenantId = systemGuard.requireTenant();
        int rows = bankMapper.casTransition(id, tenantId, ZhiyuStatusConstants.PENDING, toStatus);
        if (rows == 0) {
            throw new ApiException(400, "bad_request", "题库不存在或不在待处理状态");
        }
        return assembleBank(fetchBank(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QuestionBankDto publishBank(String id) {
        return transition(id, ZhiyuStatusConstants.PUBLISHED);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QuestionBankDto archiveBank(String id) {
        return transition(id, "archived");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QuestionBankDto unpublishBank(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QuestionBankDto withdrawBank(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public QuestionBankDto saveDraftBank(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    public QuestionBankDto inviteBank(String id, InviteRequest req) {
        systemGuard.requireUser();
        EvaluationQuestionBank bank = fetchBank(id);
        if (req.getUserId() == null || req.getUserId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少用户ID");
        }
        String tenantId = systemGuard.requireTenant();
        if (!userInTenant(req.getUserId(), tenantId)) {
            throw new ApiException(400, "bad_request", "用户不存在或不属于本租户");
        }
        bankMapper.inviteCollaborator(id, req.getUserId());
        return assembleBank(fetchBank(id));
    }

    /**
     * 状态流转（对齐 Go ContentActions.transition：CAS + 撤回清理审批记录 + 发布 bump 版本并落快照）。
     */
    @Transactional(rollbackFor = Exception.class)
    protected QuestionBankDto transition(String id, String toStatus) {
        systemGuard.requireUser();
        EvaluationQuestionBank bank = fetchBank(id);
        String tenantId = systemGuard.requireTenant();
        if (Boolean.TRUE.equals(bank.getIsDraftPool())) {
            throw new ApiException(400, "bad_request", "不能对草稿池执行此操作");
        }
        String currentStatus = bank.getStatus();
        Set<String> allowed = ALLOWED_TRANSITIONS.get(currentStatus);
        if (allowed == null || !allowed.contains(toStatus)) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作（题库）");
        }
        int rows = bankMapper.casTransition(id, tenantId, currentStatus, toStatus);
        if (rows == 0) {
            throw new ApiException(500, "internal_error", "状态流转失败");
        }
        if (ZhiyuStatusConstants.PENDING.equals(currentStatus) && ZhiyuStatusConstants.DRAFT.equals(toStatus)) {
            bankMapper.deletePendingApproval("question_bank", id);
        }
        if (ZhiyuStatusConstants.PUBLISHED.equals(toStatus)) {
            String version = nextVersion(bank.getVersion());
            bankMapper.bumpVersion(id, tenantId, version);
            saveBankSnapshot(tenantId, id, version);
        }
        return assembleBank(fetchBank(id));
    }

    @Override
    public Map<String, Object> bankSnapshot(String id, String version) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        Map<String, Object> bundle = getQuestionBankBundle(tenantId, id, version);
        if (bundle == null) {
            throw new ApiException(404, "not_found", "资源不存在或未发布");
        }
        if (isStudent()) {
            stripAnswers(bundle, "questions", "answer", "analysis");
        }
        return bundle;
    }

    // ==================== 题目 questions ====================

    @Override
    public ListResponse<QuestionDto> listQuestions(String search, String bankId, String type, String status,
                                                   long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 20);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<EvaluationQuestion> wrapper = QueryBuilder.lambda(EvaluationQuestion.class)
            .eq(EvaluationQuestion::getTenantId, tenantId);
        if (search != null && !search.isBlank()) {
            wrapper.apply("content LIKE {0} ESCAPE '\\'", toLikePattern(search));
        }
        if (bankId != null && !bankId.isBlank()) {
            wrapper.eq(EvaluationQuestion::getBankId, bankId);
        }
        if (type != null && !type.isBlank()) {
            wrapper.eq(EvaluationQuestion::getType, type);
        }
        if (status != null && !status.isBlank()) {
            wrapper.eq(EvaluationQuestion::getStatus, status);
        }
        long total = questionMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(EvaluationQuestion::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<EvaluationQuestion> rows = questionMapper.selectList(wrapper.build());
        return ListResponse.of(rows.stream().map(this::toQuestionDto).toList(), total);
    }

    @Override
    public QuestionDto getQuestion(String id) {
        systemGuard.requireUser();
        return toQuestionDto(fetchQuestion(id));
    }

    @Override
    public QuestionDto createQuestion(CreateQuestionRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        if (req.getBankId() == null || req.getBankId().isEmpty() || req.getContent() == null || req.getContent().isEmpty()
            || req.getType() == null || req.getType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 校验目标题库属于当前租户，防止跨租户写他人题库
        checkBankTenant(tenantId, req.getBankId());
        String id = UUID.randomUUID().toString();
        String code = generateUniqueCode(tenantId, "TM", questionMapper::existsCode);
        questionMapper.insertQuestion(id, tenantId, code, req.getBankId(), req.getType(), req.getContent(),
            toJson(coalesce(req.getOptions())), toAnswerJson(req.getAnswer()), emptyToNull(req.getAnalysis()),
            req.getScore() == null ? BigDecimal.ZERO : req.getScore(), emptyToNull(req.getDifficulty()),
            coalesce(req.getKnowledgePoints()), userId, emptyToNull(req.getSource()));
        return toQuestionDto(fetchQuestion(id));
    }

    @Override
    public QuestionDto updateQuestion(String id, CreateQuestionRequest req) {
        systemGuard.requireUser();
        EvaluationQuestion existing = fetchQuestion(id);
        String tenantId = systemGuard.requireTenant();
        String bankId = req.getBankId() == null || req.getBankId().isEmpty() ? existing.getBankId() : req.getBankId();
        String type = req.getType() == null || req.getType().isEmpty() ? existing.getType() : req.getType();
        String content = req.getContent() == null || req.getContent().isEmpty() ? existing.getContent() : req.getContent();
        String analysis = req.getAnalysis() != null ? emptyToNull(req.getAnalysis()) : existing.getAnalysis();
        BigDecimal score = req.getScore() != null ? req.getScore()
            : (existing.getScore() == null ? BigDecimal.ZERO : existing.getScore());
        String difficulty = req.getDifficulty() != null ? emptyToNull(req.getDifficulty()) : existing.getDifficulty();
        String source = req.getSource() != null ? emptyToNull(req.getSource()) : existing.getSource();
        List<String> options = req.getOptions() != null ? coalesce(req.getOptions())
            : parseStringList(existing.getOptions());
        List<String> knowledgePoints = req.getKnowledgePoints() != null ? coalesce(req.getKnowledgePoints())
            : coalesce(existing.getKnowledgePointIds());
        String answer = req.getAnswer() != null ? toAnswerJson(req.getAnswer()) : existing.getAnswer();
        if (content.isEmpty() || type.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        checkBankTenant(tenantId, bankId);
        questionMapper.updateQuestion(id, tenantId, bankId, type, content, toJson(options), answer, analysis,
            score, difficulty, knowledgePoints, source);
        return toQuestionDto(fetchQuestion(id));
    }

    @Override
    public String deleteQuestion(String id) {
        systemGuard.requireUser();
        fetchQuestion(id);
        String tenantId = systemGuard.requireTenant();
        // 引用检查：题目已被试卷组卷时禁止删除（级联会损坏试卷快照）
        if (questionMapper.countQuestionRefs(id) > 0) {
            throw new ApiException(409, "conflict", "该题目已被试卷引用，无法删除");
        }
        questionMapper.delete(QueryBuilder.lambda(EvaluationQuestion.class)
            .eq(EvaluationQuestion::getId, id).eq(EvaluationQuestion::getTenantId, tenantId).build());
        return id;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int batchCreateQuestions(String bankId, List<CreateQuestionRequest> items) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        if (bankId == null || bankId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少题库ID");
        }
        checkBankTenant(tenantId, bankId);
        if (items == null || items.isEmpty()) {
            return 0;
        }
        int count = 0;
        for (CreateQuestionRequest item : items) {
            if (item.getType() == null || item.getType().isEmpty() || item.getContent() == null || item.getContent().isEmpty()) {
                continue;
            }
            String id = UUID.randomUUID().toString();
            String code = generateUniqueCode(tenantId, "TM", questionMapper::existsCode);
            questionMapper.insertQuestion(id, tenantId, code, bankId, item.getType(), item.getContent(),
                toJson(coalesce(item.getOptions())), toAnswerJson(item.getAnswer()),
                emptyToNull(item.getAnalysis()), item.getScore() == null ? BigDecimal.ZERO : item.getScore(),
                emptyToNull(item.getDifficulty()), coalesce(item.getKnowledgePoints()), userId,
                emptyToNull(item.getSource()));
            count++;
        }
        return count;
    }

    // ==================== 随机抽题 random-draw-questions ====================

    @Override
    public ListResponse<RandomDrawQuestionDto> listRandomDraw(String search, String majorId, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 200);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<EvaluationRandomDrawQuestion> wrapper = QueryBuilder.lambda(EvaluationRandomDrawQuestion.class)
            .eq(EvaluationRandomDrawQuestion::getTenantId, tenantId);
        if (search != null && !search.isBlank()) {
            String pattern = toLikePattern(search);
            wrapper.and(w -> w.apply("name LIKE {0} ESCAPE '\\'", pattern)
                .or().apply("description LIKE {0} ESCAPE '\\'", pattern));
        }
        if (majorId != null && !majorId.isBlank()) {
            wrapper.eq(EvaluationRandomDrawQuestion::getMajorId, majorId);
        }
        long total = randomDrawMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(EvaluationRandomDrawQuestion::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<EvaluationRandomDrawQuestion> rows = randomDrawMapper.selectList(wrapper.build());
        return ListResponse.of(assembleRandomDraws(rows), total);
    }

    @Override
    public RandomDrawQuestionDto getRandomDraw(String id) {
        systemGuard.requireUser();
        return toRandomDrawDto(fetchRandomDraw(id));
    }

    @Override
    public RandomDrawQuestionDto createRandomDraw(RandomDrawQuestionRequest req) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (randomDrawMapper.existsName(tenantId, req.getName())) {
            throw new ApiException(409, "conflict", "现场问答题名称已存在");
        }
        String id = UUID.randomUUID().toString();
        randomDrawMapper.insertQuestion(id, tenantId, req.getName(), emptyToNull(req.getDescription()),
            emptyToNull(req.getAnswer()), emptyToNull(req.getMajorId()));
        return toRandomDrawDto(fetchRandomDraw(id));
    }

    @Override
    public RandomDrawQuestionDto updateRandomDraw(String id, RandomDrawQuestionRequest req) {
        systemGuard.requireUser();
        EvaluationRandomDrawQuestion existing = fetchRandomDraw(id);
        String tenantId = systemGuard.requireTenant();
        if (req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String name = req.getName() == null || req.getName().isEmpty() ? existing.getName() : req.getName();
        String description = req.getDescription() != null ? emptyToNull(req.getDescription()) : existing.getDescription();
        String answer = req.getAnswer() != null ? emptyToNull(req.getAnswer()) : existing.getAnswer();
        String majorId = req.getMajorId() != null ? emptyToNull(req.getMajorId()) : existing.getMajorId();
        randomDrawMapper.updateQuestion(id, tenantId, name, description, answer, majorId);
        return toRandomDrawDto(fetchRandomDraw(id));
    }

    @Override
    public String deleteRandomDraw(String id) {
        systemGuard.requireUser();
        fetchRandomDraw(id);
        String tenantId = systemGuard.requireTenant();
        randomDrawMapper.delete(QueryBuilder.lambda(EvaluationRandomDrawQuestion.class)
            .eq(EvaluationRandomDrawQuestion::getId, id).eq(EvaluationRandomDrawQuestion::getTenantId, tenantId).build());
        return id;
    }

    // ==================== 快照 ====================

    /** 题库快照 bundle 读取（GetBundle 语义：版本解析→快照→live 回退，学生剥离答案/解析） */
    Map<String, Object> getQuestionBankBundle(String tenantId, String bankId, String version) {
        String v = version;
        if (v == null || v.isEmpty()) {
            v = snapshotMapper.latestVersion(tenantId, "question_banks", bankId);
        }
        if (v != null && !v.isEmpty()) {
            org.dromara.zhiyu.domain.evaluation.EvaluationResourceSnapshot snap = snapshotMapper.selectOne(
                QueryBuilder.lambda(org.dromara.zhiyu.domain.evaluation.EvaluationResourceSnapshot.class)
                    .eq(org.dromara.zhiyu.domain.evaluation.EvaluationResourceSnapshot::getTenantId, tenantId)
                    .eq(org.dromara.zhiyu.domain.evaluation.EvaluationResourceSnapshot::getResourceType, "question_banks")
                    .eq(org.dromara.zhiyu.domain.evaluation.EvaluationResourceSnapshot::getResourceId, bankId)
                    .eq(org.dromara.zhiyu.domain.evaluation.EvaluationResourceSnapshot::getVersion, v).build());
            if (snap != null && snap.getSnapshotData() != null) {
                return parseJsonMap(snap.getSnapshotData());
            }
        }
        // 快照缺档：回退 live（仅当 live status=published 且请求版本与 live 版本一致）
        EvaluationQuestionBank live = fetchBankScoped(bankId, tenantId);
        if (live == null || !ZhiyuStatusConstants.PUBLISHED.equals(live.getStatus())) {
            return null;
        }
        String liveVersion = live.getVersion() == null ? "" : live.getVersion();
        if (version != null && !version.isEmpty() && !version.equals(liveVersion)) {
            return null;
        }
        return buildBankLiveBundle(live);
    }

    /** live 现场组装题库 bundle（schema 与快照 jsonb 一致：{question_bank, questions}） */
    Map<String, Object> buildBankLiveBundle(EvaluationQuestionBank bank) {
        Map<String, Object> bundle = new LinkedHashMap<>();
        Map<String, Object> bankObj = new LinkedHashMap<>();
        bankObj.put("id", bank.getId());
        bankObj.put("code", bank.getCode());
        bankObj.put("name", bank.getName());
        bankObj.put("description", bank.getDescription());
        bankObj.put("cover_image", bank.getCoverImage());
        bankObj.put("status", bank.getStatus());
        bankObj.put("question_count", bank.getQuestionCount());
        bankObj.put("collaborator_ids", bank.getCollaboratorIds());
        bankObj.put("collaborator_dept_ids", bank.getCollaboratorDeptIds());
        bankObj.put("batch_id", bank.getBatchId());
        bankObj.put("version", bank.getVersion());
        bankObj.put("owner_type", bank.getOwnerType());
        bankObj.put("is_draft_pool", bank.getIsDraftPool());
        bundle.put("question_bank", bankObj);
        List<EvaluationQuestion> questions = questionMapper.selectList(QueryBuilder.lambda(EvaluationQuestion.class)
            .eq(EvaluationQuestion::getBankId, bank.getId())
            .eq(EvaluationQuestion::getTenantId, bank.getTenantId())
            .eq(EvaluationQuestion::getStatus, ZhiyuStatusConstants.PUBLISHED)
            .orderByAsc(EvaluationQuestion::getCreatedAt).build());
        List<Map<String, Object>> qList = new ArrayList<>();
        for (EvaluationQuestion q : questions) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", q.getId());
            m.put("code", q.getCode());
            m.put("bank_id", q.getBankId());
            m.put("type", q.getType());
            m.put("content", q.getContent());
            m.put("options", parseStringList(q.getOptions()));
            m.put("answer", parseAnswer(q.getAnswer()));
            m.put("analysis", q.getAnalysis());
            m.put("score", q.getScore());
            m.put("difficulty", q.getDifficulty());
            m.put("knowledge_point_ids", q.getKnowledgePointIds());
            m.put("source", q.getSource());
            m.put("status", q.getStatus());
            m.put("created_at", q.getCreatedAt());
            qList.add(m);
        }
        bundle.put("questions", qList);
        return bundle;
    }

    /** 发布事务内保存题库快照 */
    void saveBankSnapshot(String tenantId, String bankId, String version) {
        EvaluationQuestionBank bank = fetchBankScoped(bankId, tenantId);
        String data = toJson(buildBankLiveBundle(bank));
        org.dromara.zhiyu.domain.evaluation.EvaluationResourceSnapshot snap =
            new org.dromara.zhiyu.domain.evaluation.EvaluationResourceSnapshot();
        snap.setTenantId(tenantId);
        snap.setResourceType("question_banks");
        snap.setResourceId(bankId);
        snap.setVersion(version);
        snap.setSnapshotData(data);
        snapshotMapper.insert(snap);
    }

    // ==================== 组装 ====================

    private List<QuestionBankDto> assembleBanks(List<EvaluationQuestionBank> rows) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> ids = rows.stream().map(EvaluationQuestionBank::getId).toList();
        Map<String, Long> countMap = toIdLongMap(bankMapper.countQuestionsByBankIds(ids), "bank_id", "cnt");
        Map<String, List<String>> kpMap = toIdListMap(bankMapper.selectKpByBankIds(ids), "bank_id", "kp_id");
        Map<String, String> userNameMap = userNameMap(collectUserIds(rows));
        List<QuestionBankDto> items = new ArrayList<>(rows.size());
        for (EvaluationQuestionBank b : rows) {
            QuestionBankDto dto = toBankDto(b);
            dto.setQuestionCount(countMap.getOrDefault(b.getId(), 0L).intValue());
            dto.setKnowledgePointIds(kpMap.getOrDefault(b.getId(), new ArrayList<>()));
            dto.setCreatorName(b.getCreatorId() == null ? null : userNameMap.get(b.getCreatorId()));
            dto.setCollaboratorNames(mapOrdered(b.getCollaboratorIds(), userNameMap));
            items.add(dto);
        }
        return items;
    }

    private QuestionBankDto assembleBank(EvaluationQuestionBank b) {
        QuestionBankDto dto = toBankDto(b);
        dto.setQuestionCount(questionMapper.selectCount(QueryBuilder.lambda(EvaluationQuestion.class)
            .eq(EvaluationQuestion::getBankId, b.getId()).build()).intValue());
        List<Map<String, Object>> kps = bankMapper.selectKpByBankIds(List.of(b.getId()));
        dto.setKnowledgePointIds(toIdListMap(kps, "bank_id", "kp_id").getOrDefault(b.getId(), new ArrayList<>()));
        Map<String, String> userNameMap = userNameMap(collectUserIds(List.of(b)));
        dto.setCreatorName(b.getCreatorId() == null ? null : userNameMap.get(b.getCreatorId()));
        dto.setCollaboratorNames(mapOrdered(b.getCollaboratorIds(), userNameMap));
        return dto;
    }

    private QuestionBankDto toBankDto(EvaluationQuestionBank b) {
        QuestionBankDto dto = new QuestionBankDto();
        dto.setId(b.getId());
        dto.setCode(b.getCode());
        dto.setName(b.getName());
        dto.setDescription(b.getDescription());
        dto.setCoverImage(b.getCoverImage());
        dto.setStatus(b.getStatus());
        dto.setQuestionCount(b.getQuestionCount());
        dto.setCreatorId(b.getCreatorId());
        dto.setCollaboratorIds(b.getCollaboratorIds());
        dto.setCollaboratorDeptIds(b.getCollaboratorDeptIds());
        dto.setBatchId(b.getBatchId());
        dto.setVersion(b.getVersion());
        dto.setOwnerType(b.getOwnerType());
        dto.setIsDraftPool(b.getIsDraftPool());
        dto.setCreatedAt(b.getCreatedAt());
        dto.setUpdatedAt(b.getUpdatedAt());
        return dto;
    }

    private QuestionDto toQuestionDto(EvaluationQuestion q) {
        QuestionDto dto = new QuestionDto();
        dto.setId(q.getId());
        dto.setCode(q.getCode());
        dto.setBankId(q.getBankId());
        dto.setType(q.getType());
        dto.setContent(q.getContent());
        dto.setOptions(parseStringList(q.getOptions()));
        dto.setAnswer(parseAnswer(q.getAnswer()));
        dto.setAnalysis(q.getAnalysis());
        dto.setScore(q.getScore());
        dto.setDifficulty(q.getDifficulty());
        dto.setKnowledgePoints(q.getKnowledgePointIds());
        dto.setCreatorId(q.getCreatorId());
        dto.setSource(q.getSource());
        dto.setStatus(q.getStatus());
        dto.setCreatedAt(q.getCreatedAt());
        return dto;
    }

    private List<RandomDrawQuestionDto> assembleRandomDraws(List<EvaluationRandomDrawQuestion> rows) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        Set<String> majorIds = new LinkedHashSet<>();
        for (EvaluationRandomDrawQuestion q : rows) {
            if (q.getMajorId() != null) {
                majorIds.add(q.getMajorId());
            }
        }
        Map<String, String> majorNames = majorIds.isEmpty() ? Map.of() : toIdStringMap(
            randomDrawMapper.selectMajorNames(new ArrayList<>(majorIds)), "id", "name");
        List<RandomDrawQuestionDto> items = new ArrayList<>(rows.size());
        for (EvaluationRandomDrawQuestion q : rows) {
            RandomDrawQuestionDto dto = toRandomDrawDto(q);
            dto.setMajorName(q.getMajorId() == null ? null : majorNames.get(q.getMajorId()));
            items.add(dto);
        }
        return items;
    }

    private RandomDrawQuestionDto toRandomDrawDto(EvaluationRandomDrawQuestion q) {
        RandomDrawQuestionDto dto = new RandomDrawQuestionDto();
        dto.setId(q.getId());
        dto.setName(q.getName());
        dto.setDescription(q.getDescription());
        dto.setAnswer(q.getAnswer());
        dto.setMajorId(q.getMajorId());
        dto.setCreatedAt(q.getCreatedAt());
        dto.setUpdatedAt(q.getUpdatedAt());
        return dto;
    }

    // ==================== 内部 ====================

    private EvaluationQuestionBank fetchBank(String id) {
        String tenantId = systemGuard.requireTenant();
        EvaluationQuestionBank bank = bankMapper.selectOne(QueryBuilder.lambda(EvaluationQuestionBank.class)
            .eq(EvaluationQuestionBank::getId, id).eq(EvaluationQuestionBank::getTenantId, tenantId).build());
        if (bank == null) {
            throw new ApiException(404, "not_found", "题库不存在");
        }
        return bank;
    }

    private EvaluationQuestionBank fetchBankScoped(String id, String tenantId) {
        return bankMapper.selectOne(QueryBuilder.lambda(EvaluationQuestionBank.class)
            .eq(EvaluationQuestionBank::getId, id).eq(EvaluationQuestionBank::getTenantId, tenantId).build());
    }

    private EvaluationQuestion fetchQuestion(String id) {
        String tenantId = systemGuard.requireTenant();
        EvaluationQuestion q = questionMapper.selectOne(QueryBuilder.lambda(EvaluationQuestion.class)
            .eq(EvaluationQuestion::getId, id).eq(EvaluationQuestion::getTenantId, tenantId).build());
        if (q == null) {
            throw new ApiException(404, "not_found", "题目不存在");
        }
        return q;
    }

    private EvaluationRandomDrawQuestion fetchRandomDraw(String id) {
        String tenantId = systemGuard.requireTenant();
        EvaluationRandomDrawQuestion q = randomDrawMapper.selectOne(
            QueryBuilder.lambda(EvaluationRandomDrawQuestion.class)
                .eq(EvaluationRandomDrawQuestion::getId, id)
                .eq(EvaluationRandomDrawQuestion::getTenantId, tenantId).build());
        if (q == null) {
            throw new ApiException(404, "not_found", "随机抽题不存在");
        }
        return q;
    }

    private void checkBankTenant(String tenantId, String bankId) {
        if (bankId == null || bankId.isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少题库 ID");
        }
        if (fetchBankScoped(bankId, tenantId) == null) {
            throw new ApiException(404, "not_found", "题库不存在");
        }
    }

    private void ensureDraftPool(String tenantId, String userId) {
        if (bankMapper.countDraftPool(tenantId, userId) > 0) {
            return;
        }
        String code = generateUniqueCode(tenantId, "TK", bankMapper::existsCode);
        bankMapper.insertDraftPool(UUID.randomUUID().toString(), tenantId, code, userId);
    }

    private void replaceKps(String bankId, List<String> kps) {
        bankMapper.deleteKps(bankId);
        if (!kps.isEmpty()) {
            bankMapper.insertKps(bankId, kps);
        }
    }

    private boolean userInTenant(String userId, String tenantId) {
        try {
            return userMapper.selectOne(QueryBuilder.lambda(ZhiyuUser.class)
                .eq(ZhiyuUser::getId, userId).eq(ZhiyuUser::getTenantId, tenantId).build()) != null;
        } catch (Exception e) {
            return false;
        }
    }

    /** 批量用户姓名（key=id，value=name） */
    private Map<String, String> userNameMap(List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return userMapper.selectList(QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, ids).build())
                .stream().filter(u -> u.getName() != null)
                .collect(Collectors.toMap(ZhiyuUser::getId, ZhiyuUser::getName));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private List<String> collectUserIds(List<EvaluationQuestionBank> rows) {
        Set<String> ids = new LinkedHashSet<>();
        for (EvaluationQuestionBank b : rows) {
            if (b.getCreatorId() != null) {
                ids.add(b.getCreatorId());
            }
            if (b.getCollaboratorIds() != null) {
                ids.addAll(b.getCollaboratorIds());
            }
        }
        return new ArrayList<>(ids);
    }

    private Map<String, Long> toIdLongMap(List<Map<String, Object>> rows, String idKey, String valKey) {
        Map<String, Long> map = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String id = String.valueOf(row.get(idKey));
            Object val = row.get(valKey);
            map.put(id, val == null ? 0L : ((Number) val).longValue());
        }
        return map;
    }

    private Map<String, List<String>> toIdListMap(List<Map<String, Object>> rows, String idKey, String valKey) {
        Map<String, List<String>> map = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            map.computeIfAbsent(String.valueOf(row.get(idKey)), k -> new ArrayList<>())
                .add(String.valueOf(row.get(valKey)));
        }
        return map;
    }

    private Map<String, String> toIdStringMap(List<Map<String, Object>> rows, String idKey, String valKey) {
        Map<String, String> map = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Object v = row.get(valKey);
            map.put(String.valueOf(row.get(idKey)), v == null ? "" : String.valueOf(v));
        }
        return map;
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

    private void stripAnswers(Map<String, Object> bundle, String key, String... fields) {
        Object raw = bundle.get(key);
        if (!(raw instanceof List<?> rows)) {
            return;
        }
        List<Object> cleaned = new ArrayList<>();
        for (Object row : rows) {
            if (row instanceof Map<?, ?> m) {
                Map<String, Object> copy = new LinkedHashMap<>();
                m.forEach((k, v) -> copy.put(String.valueOf(k), v));
                for (String f : fields) {
                    copy.remove(f);
                }
                cleaned.add(copy);
            } else {
                cleaned.add(row);
            }
        }
        bundle.put(key, cleaned);
    }

    // ==================== 工具 ====================

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
            }
        }
        if (parts.length > 1) {
            try {
                minor = Integer.parseInt(parts[1].trim());
            } catch (NumberFormatException ignored) {
            }
        }
        minor++;
        if (minor >= 10) {
            major++;
            minor = 0;
        }
        return "V" + major + "." + minor;
    }

    private String generateUniqueCode(String tenantId, String prefix,
                                      java.util.function.BiFunction<String, String, Boolean> exists) {
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 10; i++) {
            StringBuilder sb = new StringBuilder(prefix).append('-');
            for (int j = 0; j < 8; j++) {
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (!Boolean.TRUE.equals(exists.apply(tenantId, code))) {
                return code;
            }
        }
        throw new ApiException(500, "internal_error", "生成" + prefix + "编码失败");
    }

    List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> v = ZhiyuJsonUtils.MAPPER.readValue(json, STRING_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    List<Object> parseObjectList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<Object> v = ZhiyuJsonUtils.MAPPER.readValue(json, OBJECT_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    Map<String, Object> parseJsonMap(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, Object> v = ZhiyuJsonUtils.MAPPER.readValue(json, MAP_REF);
            return v == null ? new LinkedHashMap<>() : v;
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    /** 解析 answer 文本（JSON 数组文本 → List；解析失败回退单元素列表） */
    List<String> parseAnswer(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> v = ZhiyuJsonUtils.MAPPER.readValue(json, STRING_LIST_REF);
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return List.of(json);
        }
    }

    /** 序列化 answer（string | string[] → JSON 数组文本，如 ["A"]） */
    String toAnswerJson(Object answer) {
        if (answer == null) {
            return "[]";
        }
        if (answer instanceof List<?> list) {
            return toJson(list);
        }
        return toJson(List.of(String.valueOf(answer)));
    }

    String toJson(Object v) {
        try {
            return ZhiyuJsonUtils.MAPPER.writeValueAsString(v);
        } catch (Exception e) {
            return "{}";
        }
    }

    private String toLikePattern(String s) {
        if (s == null || s.isEmpty()) {
            return "";
        }
        return "%" + s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
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

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
    }
}
