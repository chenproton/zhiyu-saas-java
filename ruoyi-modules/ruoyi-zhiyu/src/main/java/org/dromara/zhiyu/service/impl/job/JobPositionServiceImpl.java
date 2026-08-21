package org.dromara.zhiyu.service.impl.job;

import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.util.ZhiyuJsonUtils;
import org.dromara.zhiyu.core.constant.ZhiyuStatusConstants;
import org.dromara.zhiyu.core.util.ZhiyuStringUtils;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.ZhiyuUser;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CareerPositionDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.CloneRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.ContentReviewRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.FavoriteStatusDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.FullPositionAbilityBinding;
import org.dromara.zhiyu.domain.dto.job.JobDtos.FullPositionAbilityDomain;
import org.dromara.zhiyu.domain.dto.job.JobDtos.FullPositionCertificate;
import org.dromara.zhiyu.domain.dto.job.JobDtos.FullPositionResponsibility;
import org.dromara.zhiyu.domain.dto.job.JobDtos.InviteRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionCreateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionUpdateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.SaveFullPositionRequest;
import org.dromara.zhiyu.domain.favorites.ZhiyuFavoriteCounter;
import org.dromara.zhiyu.domain.job.JobAbilityDomain;
import org.dromara.zhiyu.domain.job.JobAbilityPoint;
import org.dromara.zhiyu.domain.job.JobCareerPosition;
import org.dromara.zhiyu.domain.job.JobCareerPositionMajor;
import org.dromara.zhiyu.domain.job.JobPositionAbilityBinding;
import org.dromara.zhiyu.domain.job.JobPositionCertificate;
import org.dromara.zhiyu.domain.job.JobPositionFavorite;
import org.dromara.zhiyu.domain.job.JobPositionResponsibility;
import org.dromara.zhiyu.domain.portal.PortalMajor;
import org.dromara.zhiyu.domain.portal.PortalViewCounter;
import org.dromara.zhiyu.mapper.ZhiyuUserMapper;
import org.dromara.zhiyu.mapper.favorites.ZhiyuFavoriteCounterMapper;
import org.dromara.zhiyu.mapper.job.JobAbilityDomainMapper;
import org.dromara.zhiyu.mapper.job.JobAbilityPointMapper;
import org.dromara.zhiyu.mapper.job.JobCareerPositionMajorMapper;
import org.dromara.zhiyu.mapper.job.JobCareerPositionMapper;
import org.dromara.zhiyu.mapper.job.JobLandingMapper;
import org.dromara.zhiyu.mapper.job.JobPositionAbilityBindingMapper;
import org.dromara.zhiyu.mapper.job.JobPositionCertificateMapper;
import org.dromara.zhiyu.mapper.job.JobPositionFavoriteMapper;
import org.dromara.zhiyu.mapper.job.JobPositionResponsibilityMapper;
import org.dromara.zhiyu.mapper.job.JobResourceSnapshotMapper;
import org.dromara.zhiyu.mapper.portal.PortalMajorMapper;
import org.dromara.zhiyu.mapper.portal.PortalViewCounterMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.job.IJobPositionService;
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
 * 岗位服务实现（对齐 Go position_handler.go + service/position.go + position_clone.go +
 * content_actions.go + landing.go + snapshot.go 语义）。
 *
 * <p>关键对齐点：</p>
 * <ul>
 *   <li>列表租户内可见，默认排除 archived（显式传 status 时精确匹配）；</li>
 *   <li>状态流转允许表与 Go allowedStatusTransitions 一致，流转用 CAS 更新防并发双发；</li>
 *   <li>删除保护：存在岗位能力成绩/学生画像/被已发布场景引用时 409 拒绝，事务内清理无外键表；</li>
 *   <li>SaveFull/克隆在事务内全量重写职责/绑定/能力域/证书并重映射 ID；</li>
 *   <li>目标岗位（landing）走组织树 WITH RECURSIVE（JobLandingMapper），ID 列表复用列表组装。</li>
 * </ul>
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class JobPositionServiceImpl implements IJobPositionService {

    /** 编码字母表（对齐 Go entityCodeAlphabet） */
    private static final String CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    private static final TypeReference<List<Object>> OBJECT_LIST_REF = new TypeReference<>() {
    };

    /** 允许的状态流转（key=当前状态，value=可进入状态集合；对齐 Go allowedStatusTransitions） */
    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
        ZhiyuStatusConstants.DRAFT, Set.of(ZhiyuStatusConstants.PENDING, "archived"),
        ZhiyuStatusConstants.REJECTED, Set.of(ZhiyuStatusConstants.DRAFT, ZhiyuStatusConstants.PENDING, "archived"),
        ZhiyuStatusConstants.PENDING, Set.of(ZhiyuStatusConstants.DRAFT, ZhiyuStatusConstants.APPROVED, ZhiyuStatusConstants.REJECTED),
        ZhiyuStatusConstants.APPROVED, Set.of(ZhiyuStatusConstants.DRAFT, ZhiyuStatusConstants.PUBLISHED, "archived"),
        ZhiyuStatusConstants.PUBLISHED, Set.of(ZhiyuStatusConstants.DRAFT, "archived"),
        "archived", Set.of(ZhiyuStatusConstants.DRAFT)
    );

    private final SystemGuard systemGuard;
    private final JobCareerPositionMapper positionMapper;
    private final JobCareerPositionMajorMapper majorMapper;
    private final JobPositionAbilityBindingMapper bindingMapper;
    private final JobPositionResponsibilityMapper responsibilityMapper;
    private final JobPositionCertificateMapper certificateMapper;
    private final JobAbilityDomainMapper abilityDomainMapper;
    private final JobAbilityPointMapper abilityPointMapper;
    private final JobPositionFavoriteMapper favoriteMapper;
    private final JobLandingMapper landingMapper;
    private final JobResourceSnapshotMapper snapshotMapper;
    private final ZhiyuFavoriteCounterMapper favoriteCounterMapper;
    private final PortalMajorMapper portalMajorMapper;
    private final PortalViewCounterMapper viewCounterMapper;
    private final ZhiyuUserMapper userMapper;

    // ---------- 列表 / 详情 ----------

    @Override
    public ListResponse<CareerPositionDto> list(String search, String status, String batchId, String positionType,
                                                long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);

        LambdaQueryBuilder<JobCareerPosition> wrapper = baseListWrapper(tenantId, search, batchId, positionType, status);
        long total = positionMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(JobCareerPosition::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<JobCareerPosition> rows = positionMapper.selectList(wrapper.build());
        return ListResponse.of(assembleList(rows), total);
    }

    @Override
    public ListResponse<CareerPositionDto> publicList(String search, String positionType, long limit, long offset) {
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);

        LambdaQueryBuilder<JobCareerPosition> wrapper = QueryBuilder.lambda(JobCareerPosition.class)
            .eq(JobCareerPosition::getTenantId, tenantId)
            .eq(JobCareerPosition::getStatus, ZhiyuStatusConstants.PUBLISHED)
            .eqIfText(JobCareerPosition::getPositionType, positionType);
        if (search != null && !search.isEmpty()) {
            wrapper.like(JobCareerPosition::getName, search);
        }
        long total = positionMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(JobCareerPosition::getCreatedAt)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<JobCareerPosition> rows = positionMapper.selectList(wrapper.build());
        return ListResponse.of(assembleList(rows), total);
    }

    @Override
    public CareerPositionDto get(String id) {
        systemGuard.requireUser();
        JobCareerPosition pos = fetchOwned(id);
        // 视图计数异步记录（失败仅记日志不阻塞，对齐 Go recordViewAsync）
        try {
            positionMapper.insertViewLog(id, TenantContext.getUserId(), TenantContext.getTenantId());
            positionMapper.incrementViewCounter(id);
        } catch (Exception e) {
            log.warn("record position view failed, positionId={}", id, e);
        }
        return assembleDetail(pos);
    }

    @Override
    public CareerPositionDto publicGet(String id) {
        systemGuard.requireUser();
        JobCareerPosition pos = fetchOwned(id);
        try {
            positionMapper.insertViewLog(id, TenantContext.getUserId(), TenantContext.getTenantId());
            positionMapper.incrementViewCounter(id);
        } catch (Exception e) {
            log.warn("record position view failed, positionId={}", id, e);
        }
        return assembleDetail(pos);
    }

    // ---------- 创建 / 更新 / 删除 ----------

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto create(PositionCreateRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        if (req.getName() == null || req.getName().isEmpty() || req.getPositionType() == null
            || req.getPositionType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (positionMapper.existsNameNew(tenantId, req.getName())) {
            throw new ApiException(409, "conflict", "岗位名称已存在，请使用其他名称");
        }
        String version = req.getVersion() == null || req.getVersion().isEmpty() ? "V1.0" : req.getVersion();
        String code = generateUniqueCode(tenantId);
        String id = UUID.randomUUID().toString();

        positionMapper.insertPosition(id, tenantId, code, emptyToNull(req.getBatchId()), req.getName(),
            emptyToNull(req.getShortName()), emptyToNull(req.getIndustryId()), req.getPositionType(),
            req.getSalaryMin(), req.getSalaryMax(), emptyToNull(req.getCoverImage()),
            emptyToNull(req.getDescription()), coalesce(req.getRequirements()), emptyToNull(req.getCareerPath()),
            version, ZhiyuStatusConstants.DRAFT, userId, coalesce(req.getCollaborators()), "school", null);
        rewriteMajors(id, coalesce(req.getMajorIds()));
        return assembleDetail(fetchOwned(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto update(String id, PositionUpdateRequest req) {
        systemGuard.requireUser();
        JobCareerPosition existing = fetchOwned(id);
        if (req.getName() != null && !req.getName().isEmpty()
            && positionMapper.existsName(existing.getTenantId(), req.getName(), id)) {
            throw new ApiException(409, "conflict", "岗位名称已存在，请使用其他名称");
        }
        String name = req.getName() == null || req.getName().isEmpty() ? existing.getName() : req.getName();
        String positionType = req.getPositionType() == null || req.getPositionType().isEmpty()
            ? existing.getPositionType() : req.getPositionType();
        // 仅 null 视为未携带；显式空串可清空（与 Go Description/CoverImage 等字段语义一致）
        String shortName = req.getShortName() != null ? req.getShortName() : existing.getShortName();
        List<String> majorIds = req.getMajorIds() != null ? req.getMajorIds() : fetchMajorIds(id);
        List<String> requirements = req.getRequirements() != null ? req.getRequirements() : existing.getRequirements();
        List<String> collaborators = req.getCollaborators() != null ? req.getCollaborators() : existing.getCollaborators();
        String industryId = req.getIndustryId() != null ? req.getIndustryId() : existing.getIndustryId();
        Integer salaryMin = req.getSalaryMin() != null ? req.getSalaryMin() : existing.getSalaryMin();
        Integer salaryMax = req.getSalaryMax() != null ? req.getSalaryMax() : existing.getSalaryMax();
        String coverImage = req.getCoverImage() != null ? req.getCoverImage() : existing.getCoverImage();
        String description = req.getDescription() != null ? req.getDescription() : existing.getDescription();
        String careerPath = req.getCareerPath() != null ? req.getCareerPath() : existing.getCareerPath();
        String version = req.getVersion() == null || req.getVersion().isEmpty() ? existing.getVersion() : req.getVersion();
        String batchId = req.getBatchId() != null ? req.getBatchId() : existing.getBatchId();

        positionMapper.updatePosition(id, batchId, name, shortName, industryId, positionType,
            salaryMin, salaryMax, coverImage, description, requirements, careerPath, version, collaborators);
        rewriteMajors(id, majorIds);
        return assembleDetail(fetchOwned(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String delete(String id) {
        systemGuard.requireUser();
        JobCareerPosition existing = fetchOwned(id);
        if (positionMapper.existsInUse(id)) {
            throw new ApiException(409, "conflict", "该岗位已存在能力测评数据或被已发布场景引用，无法删除");
        }
        // 清理无外键约束的关联表，防止孤儿数据残留（对齐 Go PositionStore.Delete）
        positionMapper.cleanupJobAbilityResults(id);
        positionMapper.cleanupStudentPortraits(id);
        positionMapper.cleanupAbilityAggregateLogs(id);
        positionMapper.cleanupCertificationWeights(id);
        positionMapper.cleanupCertificationGradeData(id);
        positionMapper.cleanupCertificationRules(id);
        positionMapper.cleanupViewCounters(id);
        positionMapper.cleanupFavoriteCounters(id);
        positionMapper.cleanupPositionFavorites(id);
        majorMapper.delete(QueryBuilder.lambda(JobCareerPositionMajor.class)
            .eq(JobCareerPositionMajor::getCareerPositionId, id).build());
        positionMapper.deletePendingApproval(id);
        positionMapper.deletePositionById(id);
        return id;
    }

    // ---------- 完整保存 / 克隆 ----------

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto saveFull(String id, SaveFullPositionRequest req) {
        String tenantId = systemGuard.requireTenant();
        systemGuard.requireUser();
        JobCareerPosition existing = fetchOwned(id);
        if (req.getName() == null || req.getName().isEmpty() || req.getPositionType() == null
            || req.getPositionType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 能力点/证书预写入与 SaveFull 同事务：回滚时不留孤儿库条目
        Map<String, String> abilityPointMap = new LinkedHashMap<>();
        for (FullPositionAbilityBinding b : safe(req.getAbilityBindings())) {
            if ("public".equals(b.getSource())) {
                if (notBlank(b.getPublicAbilityId())) {
                    abilityPointMap.put(b.getId(), b.getPublicAbilityId());
                } else if (notBlank(b.getAbilityPointId())) {
                    abilityPointMap.put(b.getId(), b.getAbilityPointId());
                }
                continue;
            }
            if (!"custom".equals(b.getSource()) || b.getName() == null || b.getName().isBlank()) {
                continue;
            }
            String pointId = prepareAbilityPoint(tenantId, b.getName(), b.getDescription(), b.getAttributes());
            if (pointId != null) {
                abilityPointMap.put(b.getId(), pointId);
            }
        }
        Map<String, String> certificateMap = new LinkedHashMap<>();
        for (FullPositionCertificate cert : safe(req.getCertificates())) {
            if (cert.getName() == null || cert.getName().isBlank()) {
                continue;
            }
            String libId = prepareCertificate(tenantId, cert.getName(), cert.getUrl(),
                cert.getDescription(), cert.getImage());
            if (libId != null) {
                certificateMap.put(cert.getName(), libId);
            }
        }

        List<Integer> salaryRange = req.getSalaryRange();
        Integer salaryMin = salaryRange != null && salaryRange.size() > 0 ? salaryRange.get(0) : null;
        Integer salaryMax = salaryRange != null && salaryRange.size() > 1 ? salaryRange.get(1) : null;

        positionMapper.updatePosition(id, ZhiyuStringUtils.blankToNull(req.getBatchId()), req.getName(),
            req.getShortName(), ZhiyuStringUtils.blankToNull(req.getIndustry()), req.getPositionType(),
            salaryMin, salaryMax, ZhiyuStringUtils.blankToNull(req.getCoverImage()), ZhiyuStringUtils.blankToNull(req.getDescription()),
            coalesce(req.getRequirements()), ZhiyuStringUtils.blankToNull(req.getCareerPath()),
            req.getVersion() == null || req.getVersion().isEmpty() ? existing.getVersion() : req.getVersion(),
            coalesce(req.getCollaborators()));
        rewriteMajors(id, coalesce(req.getMajors()));

        // 证书绑定重写
        certificateMapper.delete(QueryBuilder.lambda(JobPositionCertificate.class)
            .eq(JobPositionCertificate::getCareerPositionId, id).build());
        for (String libId : certificateMap.values()) {
            certificateMapper.insertPositionCertificate(UUID.randomUUID().toString(), tenantId, id, libId);
        }

        // 职责/绑定/能力域全量重写
        abilityDomainMapper.delete(QueryBuilder.lambda(JobAbilityDomain.class)
            .eq(JobAbilityDomain::getCareerPositionId, id).build());
        bindingMapper.delete(QueryBuilder.lambda(JobPositionAbilityBinding.class)
            .eq(JobPositionAbilityBinding::getCareerPositionId, id).build());
        responsibilityMapper.delete(QueryBuilder.lambda(JobPositionResponsibility.class)
            .eq(JobPositionResponsibility::getCareerPositionId, id).build());

        Map<String, String> respIdMap = new LinkedHashMap<>();
        int idx = 0;
        for (FullPositionResponsibility resp : safe(req.getResponsibilities())) {
            String respId = UUID.randomUUID().toString();
            respIdMap.put(resp.getId(), respId);
            JobPositionResponsibility entity = new JobPositionResponsibility();
            entity.setId(respId);
            entity.setTenantId(tenantId);
            entity.setCareerPositionId(id);
            entity.setName(resp.getName());
            entity.setDescription(ZhiyuStringUtils.blankToNull(resp.getDescription()));
            entity.setSortOrder(idx);
            responsibilityMapper.insert(entity);
            idx++;
        }

        Map<String, String> bindingIdMap = new LinkedHashMap<>();
        for (FullPositionAbilityBinding b : safe(req.getAbilityBindings())) {
            String respBackendId = respIdMap.get(b.getResponsibilityId());
            String abilityPointId = abilityPointMap.get(b.getId());
            if (respBackendId == null || abilityPointId == null) {
                continue;
            }
            JobPositionAbilityBinding entity = new JobPositionAbilityBinding();
            entity.setId(UUID.randomUUID().toString());
            entity.setTenantId(tenantId);
            entity.setCareerPositionId(id);
            entity.setResponsibilityId(respBackendId);
            entity.setAbilityPointId(abilityPointId);
            entity.setSource(b.getSource());
            entity.setDomain(ZhiyuStringUtils.blankToNull(b.getDomain()));
            entity.setRequiredLevel(b.getLevel());
            entity.setRubricDescription(ZhiyuStringUtils.blankToNull(b.getRubricDescription()));
            entity.setAttributes(coalesce(b.getAttributes()));
            // 对齐 Go toFullPositionSaveParams：请求体无 weight 字段，绑定权重恒为 0
            entity.setWeight(java.math.BigDecimal.ZERO);
            // 唯一键冲突时更新而非报错（对齐 Go ON CONFLICT DO UPDATE + RETURNING id）
            bindingMapper.upsertBinding(entity);
            JobPositionAbilityBinding saved = bindingMapper.selectBindingByUnique(id, respBackendId, abilityPointId);
            if (saved != null) {
                bindingIdMap.put(b.getId(), saved.getId());
            }
        }

        int domainIdx = 0;
        for (FullPositionAbilityDomain ad : safe(req.getAbilityDomains())) {
            List<String> newBindingIds = new ArrayList<>();
            for (String oldId : safe(ad.getBindingIds())) {
                String newId = bindingIdMap.get(oldId);
                if (newId != null) {
                    newBindingIds.add(newId);
                }
            }
            JobAbilityDomain entity = new JobAbilityDomain();
            entity.setTenantId(tenantId);
            entity.setCareerPositionId(id);
            entity.setName(ad.getName());
            entity.setDescription(ZhiyuStringUtils.blankToNull(ad.getDescription()));
            entity.setBindingIds(newBindingIds);
            entity.setSortOrder(domainIdx);
            abilityDomainMapper.insert(entity);
            domainIdx++;
        }
        return assembleDetail(fetchOwned(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto clone(String id, CloneRequest req) {
        String tenantId = systemGuard.requireTenant();
        String userId = systemGuard.requireUser();
        JobCareerPosition src = positionMapper.selectById(id);
        if (src == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        if (src.getTenantId() != null && !src.getTenantId().equals(tenantId)) {
            throw new ApiException(403, "forbidden", "权限不足");
        }
        String newName = req.getName() == null || req.getName().isEmpty()
            ? src.getName() + " (克隆)" : req.getName();
        String newId = UUID.randomUUID().toString();
        String code = generateUniqueCode(tenantId);

        positionMapper.insertPosition(newId, tenantId, code, src.getBatchId(), newName, src.getShortName(),
            src.getIndustryId(), src.getPositionType(), src.getSalaryMin(), src.getSalaryMax(),
            src.getCoverImage(), src.getDescription(), coalesce(src.getRequirements()), src.getCareerPath(),
            src.getVersion(), ZhiyuStatusConstants.DRAFT, userId, coalesce(src.getCollaborators()), "school", null);

        // 专业绑定
        List<JobCareerPositionMajor> majors = majorMapper.selectList(
            QueryBuilder.lambda(JobCareerPositionMajor.class)
                .eq(JobCareerPositionMajor::getCareerPositionId, id).build());
        for (JobCareerPositionMajor m : majors) {
            JobCareerPositionMajor nm = new JobCareerPositionMajor();
            nm.setCareerPositionId(newId);
            nm.setMajorId(m.getMajorId());
            majorMapper.insert(nm);
        }

        // 职责（旧 ID → 新 ID 映射）
        Map<String, String> respIdMap = new LinkedHashMap<>();
        List<JobPositionResponsibility> resps = responsibilityMapper.selectList(
            QueryBuilder.lambda(JobPositionResponsibility.class)
                .eq(JobPositionResponsibility::getCareerPositionId, id)
                .orderByAsc(JobPositionResponsibility::getSortOrder).build());
        for (JobPositionResponsibility r : resps) {
            String newRespId = UUID.randomUUID().toString();
            respIdMap.put(r.getId(), newRespId);
            JobPositionResponsibility nr = new JobPositionResponsibility();
            nr.setId(newRespId);
            nr.setTenantId(tenantId);
            nr.setCareerPositionId(newId);
            nr.setName(r.getName());
            nr.setDescription(r.getDescription());
            nr.setSortOrder(r.getSortOrder());
            responsibilityMapper.insert(nr);
        }

        // 能力绑定（重映射职责）
        Map<String, String> bindingIdMap = new LinkedHashMap<>();
        List<JobPositionAbilityBinding> bindings = bindingMapper.selectList(
            QueryBuilder.lambda(JobPositionAbilityBinding.class)
                .eq(JobPositionAbilityBinding::getCareerPositionId, id).build());
        for (JobPositionAbilityBinding b : bindings) {
            String newRespId = respIdMap.get(b.getResponsibilityId());
            if (newRespId == null) {
                continue;
            }
            String newBindingId = UUID.randomUUID().toString();
            bindingIdMap.put(b.getId(), newBindingId);
            JobPositionAbilityBinding nb = new JobPositionAbilityBinding();
            nb.setId(newBindingId);
            nb.setTenantId(tenantId);
            nb.setCareerPositionId(newId);
            nb.setResponsibilityId(newRespId);
            nb.setAbilityPointId(b.getAbilityPointId());
            nb.setSource(b.getSource());
            nb.setDomain(b.getDomain());
            nb.setRequiredLevel(b.getRequiredLevel());
            nb.setRubricDescription(b.getRubricDescription());
            nb.setAttributes(b.getAttributes());
            nb.setWeight(b.getWeight());
            bindingMapper.insert(nb);
        }

        // 能力域（重映射绑定 ID）
        List<JobAbilityDomain> domains = abilityDomainMapper.selectList(
            QueryBuilder.lambda(JobAbilityDomain.class)
                .eq(JobAbilityDomain::getCareerPositionId, id)
                .orderByAsc(JobAbilityDomain::getSortOrder).build());
        for (JobAbilityDomain d : domains) {
            List<String> newBindingIds = new ArrayList<>();
            for (String oldId : safe(d.getBindingIds())) {
                String mapped = bindingIdMap.get(oldId);
                if (mapped != null) {
                    newBindingIds.add(mapped);
                }
            }
            JobAbilityDomain nd = new JobAbilityDomain();
            nd.setTenantId(tenantId);
            nd.setCareerPositionId(newId);
            nd.setName(d.getName());
            nd.setDescription(d.getDescription());
            nd.setBindingIds(newBindingIds);
            nd.setSortOrder(d.getSortOrder());
            abilityDomainMapper.insert(nd);
        }

        // 证书（复制证书库绑定）
        List<JobPositionCertificate> certs = certificateMapper.selectList(
            QueryBuilder.lambda(JobPositionCertificate.class)
                .eq(JobPositionCertificate::getCareerPositionId, id).build());
        for (JobPositionCertificate c : certs) {
            certificateMapper.insertPositionCertificate(UUID.randomUUID().toString(), tenantId, newId,
                c.getCertificateLibraryId());
        }
        return assembleDetail(fetchOwned(newId));
    }

    // ---------- 状态流转 / 审核 / 邀请 ----------

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto submit(String id) {
        return transition(id, ZhiyuStatusConstants.PENDING);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto withdraw(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto saveDraft(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto publish(String id) {
        return transition(id, ZhiyuStatusConstants.PUBLISHED);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto archive(String id) {
        return transition(id, "archived");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto unpublish(String id) {
        return transition(id, ZhiyuStatusConstants.DRAFT);
    }

    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto transition(String id, String toStatus) {
        systemGuard.requireUser();
        JobCareerPosition pos = fetchOwned(id);
        String tenantId = systemGuard.requireTenant();
        String currentStatus = pos.getStatus();

        if (!canTransition(currentStatus, toStatus)) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作（岗位）");
        }
        // CAS 更新：仅当状态仍为读取时的值才流转，防止并发双发
        int rows = positionMapper.casTransition(id, tenantId, currentStatus, toStatus);
        if (rows == 0) {
            throw new ApiException(500, "internal_error", "状态流转失败");
        }
        // 从审批中撤回时，同步删除审批中心对应的待审批记录
        if (ZhiyuStatusConstants.PENDING.equals(currentStatus) && ZhiyuStatusConstants.DRAFT.equals(toStatus)) {
            positionMapper.deletePendingApproval(id);
        }
        return assembleDetail(fetchOwned(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto review(String id, ContentReviewRequest req) {
        systemGuard.requireUser();
        String toStatus;
        if (ZhiyuStatusConstants.APPROVED.equals(req.getStatus())) {
            toStatus = ZhiyuStatusConstants.APPROVED;
        } else if (ZhiyuStatusConstants.REJECTED.equals(req.getStatus())) {
            toStatus = ZhiyuStatusConstants.REJECTED;
        } else {
            throw new ApiException(400, "bad_request", "无效的审核状态");
        }
        JobCareerPosition pos = fetchOwned(id);
        String tenantId = systemGuard.requireTenant();
        // CAS 审核：仅 pending 可审
        int rows = positionMapper.casReview(id, tenantId, toStatus);
        if (rows == 0) {
            throw new ApiException(400, "bad_request", "岗位不存在或不在待处理状态");
        }
        return assembleDetail(fetchOwned(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CareerPositionDto invite(String id, InviteRequest req) {
        systemGuard.requireUser();
        JobCareerPosition pos = fetchOwned(id);
        String tenantId = systemGuard.requireTenant();
        if (req.getUserId() == null || req.getUserId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少用户ID");
        }
        // 协作者必须属于本租户用户，防止跨租户协作者引用
        if (!userExistsInTenant(req.getUserId(), tenantId)) {
            throw new ApiException(400, "bad_request", "用户不存在或不属于本租户");
        }
        positionMapper.inviteCollaborator(id, req.getUserId());
        return assembleDetail(fetchOwned(id));
    }

    // ---------- 收藏 ----------

    @Override
    public FavoriteStatusDto getFavorite(String id) {
        String userId = systemGuard.requireUser();
        checkPositionTenant(id);
        boolean isFavorite = favoriteMapper.selectCount(
                QueryBuilder.lambda(JobPositionFavorite.class)
                    .eq(JobPositionFavorite::getUserId, userId)
                    .eq(JobPositionFavorite::getCareerPositionId, id)
                    .build()) > 0;
        int count = favoriteCount(id);
        FavoriteStatusDto dto = new FavoriteStatusDto();
        dto.setIsFavorite(isFavorite);
        dto.setFavoriteCount(count);
        return dto;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public FavoriteStatusDto toggleFavorite(String id) {
        String userId = systemGuard.requireUser();
        checkPositionTenant(id);
        boolean exists = favoriteMapper.selectCount(
                QueryBuilder.lambda(JobPositionFavorite.class)
                    .eq(JobPositionFavorite::getUserId, userId)
                    .eq(JobPositionFavorite::getCareerPositionId, id)
                    .build()) > 0;
        boolean isFavorite;
        if (exists) {
            favoriteMapper.delete(QueryBuilder.lambda(JobPositionFavorite.class)
                .eq(JobPositionFavorite::getUserId, userId)
                .eq(JobPositionFavorite::getCareerPositionId, id).build());
            favoriteCounterMapper.decrement("career_position", id);
            isFavorite = false;
        } else {
            JobPositionFavorite f = new JobPositionFavorite();
            f.setUserId(userId);
            f.setCareerPositionId(id);
            favoriteMapper.insert(f);
            favoriteCounterMapper.increment("career_position", id);
            isFavorite = true;
        }
        FavoriteStatusDto dto = new FavoriteStatusDto();
        dto.setIsFavorite(isFavorite);
        dto.setFavoriteCount(favoriteCount(id));
        return dto;
    }

    @Override
    public ListResponse<CareerPositionDto> listFavorites(long limit, long offset) {
        String userId = systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        long total = positionMapper.countFavoritePositions(userId, tenantId);
        List<String> ids = positionMapper.selectFavoritePositionIds(userId, tenantId, (int) safeLimit, (int) safeOffset);
        if (ids.isEmpty()) {
            return ListResponse.of(new ArrayList<>(), total);
        }
        List<JobCareerPosition> rows = positionMapper.selectList(
            QueryBuilder.lambda(JobCareerPosition.class).in(JobCareerPosition::getId, ids).build());
        Map<String, JobCareerPosition> byId = rows.stream()
            .collect(Collectors.toMap(JobCareerPosition::getId, r -> r));
        List<JobCareerPosition> ordered = new ArrayList<>(ids.size());
        for (String pid : ids) {
            JobCareerPosition p = byId.get(pid);
            if (p != null) {
                ordered.add(p);
            }
        }
        return ListResponse.of(assembleList(ordered), total);
    }

    // ---------- 快照 ----------

    @Override
    public Map<String, Object> getSnapshot(String id, String version) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        JobResourceSnapshotMapper.JobLiveState live = snapshotMapper.selectPositionLiveState(id, tenantId);
        if (live == null) {
            throw new ApiException(404, "not_found", "资源不存在或未发布");
        }
        String v = version;
        if (v == null || v.isEmpty()) {
            v = snapshotMapper.selectLatestVersion(tenantId, JobResourceSnapshotMapper.TYPE_POSITION, id);
        }
        if (v != null && !v.isEmpty()) {
            String data = snapshotMapper.selectSnapshotData(tenantId, JobResourceSnapshotMapper.TYPE_POSITION, id, v);
            if (data != null) {
                return parseBundle(data);
            }
        }
        // 快照缺档（历史数据）：回退 live 现场组装；仅当请求版本与 live 版本一致且已发布
        if (!ZhiyuStatusConstants.PUBLISHED.equals(live.status)) {
            throw new ApiException(404, "not_found", "资源不存在或未发布");
        }
        if (version != null && !version.isEmpty() && !version.equals(live.version)) {
            throw new ApiException(404, "not_found", "资源不存在或未发布");
        }
        Map<String, Object> bundle = buildLivePositionBundle(tenantId, id);
        if (bundle == null) {
            throw new ApiException(404, "not_found", "资源不存在或未发布");
        }
        return bundle;
    }

    // ---------- 落地页目标岗位 ----------

    @Override
    public ListResponse<CareerPositionDto> listTargetPositions() {
        String userId = systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        List<String> ids = landingMapper.selectTargetPositionIds(tenantId, userId);
        if (ids.isEmpty()) {
            return ListResponse.of(new ArrayList<>(), 0);
        }
        List<JobCareerPosition> rows = positionMapper.selectList(
            QueryBuilder.lambda(JobCareerPosition.class).in(JobCareerPosition::getId, ids).build());
        Map<String, JobCareerPosition> byId = rows.stream()
            .collect(Collectors.toMap(JobCareerPosition::getId, r -> r));
        List<JobCareerPosition> ordered = new ArrayList<>(ids.size());
        for (String pid : ids) {
            JobCareerPosition p = byId.get(pid);
            if (p != null) {
                ordered.add(p);
            }
        }
        return ListResponse.of(assembleList(ordered), ordered.size());
    }

    // ---------- 组装 ----------

    private List<CareerPositionDto> assembleList(List<JobCareerPosition> rows) {
        if (rows.isEmpty()) {
            return new ArrayList<>();
        }
        List<String> ids = rows.stream().map(JobCareerPosition::getId).toList();
        Map<String, List<String>> majorIdsByPosition = majorIdsByPosition(ids);
        Set<String> userIds = new LinkedHashSet<>();
        for (JobCareerPosition p : rows) {
            if (p.getCreatedBy() != null) {
                userIds.add(p.getCreatedBy());
            }
            if (p.getCollaborators() != null) {
                userIds.addAll(p.getCollaborators());
            }
        }
        Map<String, String> userNames = userNameMap(new ArrayList<>(userIds));
        Map<String, String> majorNames = majorNameMap(collectMajorIds(majorIdsByPosition));
        Map<String, Long> favoriteMap = counterMap("career_position", ids, "favorite_counters");
        Map<String, Long> viewMap = counterMap("career_position", ids, "view_counters");
        Map<String, Long> abilityCountMap = abilityCountMap(ids);

        List<CareerPositionDto> items = new ArrayList<>(rows.size());
        for (JobCareerPosition p : rows) {
            CareerPositionDto dto = toDto(p);
            List<String> majorIds = majorIdsByPosition.getOrDefault(p.getId(), List.of());
            dto.setMajorIds(majorIds);
            dto.setMajorNames(mapOrdered(majorIds, majorNames));
            dto.setCreatedByName(p.getCreatedBy() == null ? null : userNames.getOrDefault(p.getCreatedBy(), p.getCreatedBy()));
            dto.setCollaboratorNames(mapOrdered(p.getCollaborators(), userNames));
            dto.setFavoriteCount(favoriteMap.getOrDefault(p.getId(), 0L).intValue());
            dto.setViewCount(viewMap.getOrDefault(p.getId(), 0L).intValue());
            dto.setAbilityCount(abilityCountMap.getOrDefault(p.getId(), 0L).intValue());
            items.add(dto);
        }
        return items;
    }

    private CareerPositionDto assembleDetail(JobCareerPosition p) {
        CareerPositionDto dto = toDto(p);
        List<String> majorIds = fetchMajorIds(p.getId());
        dto.setMajorIds(majorIds);
        dto.setMajorNames(mapOrdered(majorIds, majorNameMap(new LinkedHashSet<>(majorIds))));
        dto.setCreatedByName(p.getCreatedBy() == null ? null
            : userNameMap(List.of(p.getCreatedBy())).getOrDefault(p.getCreatedBy(), p.getCreatedBy()));
        dto.setCollaboratorNames(mapOrdered(p.getCollaborators(), userNameMap(coalesce(p.getCollaborators()))));
        dto.setFavoriteCount(favoriteCount(p.getId()));
        dto.setViewCount(counterMap("career_position", List.of(p.getId()), "view_counters")
            .getOrDefault(p.getId(), 0L).intValue());
        dto.setAbilityCount(abilityCountMap(List.of(p.getId())).getOrDefault(p.getId(), 0L).intValue());
        return dto;
    }

    private CareerPositionDto toDto(JobCareerPosition p) {
        CareerPositionDto dto = new CareerPositionDto();
        dto.setId(p.getId());
        dto.setCode(p.getCode());
        dto.setBatchId(p.getBatchId());
        dto.setName(p.getName());
        dto.setShortName(p.getShortName());
        dto.setIndustryId(p.getIndustryId());
        dto.setPositionType(p.getPositionType());
        dto.setSalaryMin(p.getSalaryMin());
        dto.setSalaryMax(p.getSalaryMax());
        dto.setCoverImage(p.getCoverImage());
        dto.setDescription(p.getDescription());
        dto.setRequirements(p.getRequirements());
        dto.setCareerPath(p.getCareerPath());
        dto.setVersion(p.getVersion());
        dto.setStatus(p.getStatus());
        dto.setSourceType(p.getSourceType());
        dto.setSourceEnterpriseId(p.getSourceEnterpriseId());
        dto.setCreatedBy(p.getCreatedBy());
        dto.setCollaborators(p.getCollaborators());
        dto.setCreatedAt(p.getCreatedAt());
        dto.setUpdatedAt(p.getUpdatedAt());
        return dto;
    }

    // ---------- 快照 live 组装（对齐 BuildPositionSnapshot） ----------

    private Map<String, Object> buildLivePositionBundle(String tenantId, String positionId) {
        Map<String, Object> bundle = new LinkedHashMap<>();
        bundle.put("position", parseObject(snapshotMapper.buildPositionObj(positionId, tenantId)));
        bundle.put("career_position_majors", parseList(snapshotMapper.buildPositionMajors(positionId)));
        bundle.put("position_responsibilities", parseList(snapshotMapper.buildPositionResponsibilities(positionId)));
        bundle.put("position_ability_bindings", parseList(snapshotMapper.buildPositionAbilityBindings(positionId)));
        bundle.put("ability_domains", parseList(snapshotMapper.buildAbilityDomains(positionId)));
        bundle.put("position_certificates", parseList(snapshotMapper.buildPositionCertificates(positionId)));
        bundle.put("certification_rules", parseList(snapshotMapper.buildCertificationRules(positionId)));
        bundle.put("certification_weights", parseList(snapshotMapper.buildCertificationWeights(positionId)));
        bundle.put("certification_ability_items", parseList(snapshotMapper.buildCertificationAbilityItems(positionId)));
        bundle.put("certification_ability_points", parseList(snapshotMapper.buildCertificationAbilityPoints(positionId)));
        List<String> apIds = snapshotMapper.collectPositionAbilityPointIds(positionId);
        if (!apIds.isEmpty()) {
            bundle.put("ability_points", parseList(snapshotMapper.buildAbilityPoints(apIds, tenantId)));
        } else {
            bundle.put("ability_points", new ArrayList<>());
        }
        return bundle;
    }

    // ---------- 关联批量查询（避免 N+1） ----------

    private Map<String, List<String>> majorIdsByPosition(List<String> positionIds) {
        if (positionIds.isEmpty()) {
            return Map.of();
        }
        List<JobCareerPositionMajor> rows = majorMapper.selectList(
            QueryBuilder.lambda(JobCareerPositionMajor.class)
                .in(JobCareerPositionMajor::getCareerPositionId, positionIds).build());
        return rows.stream().collect(Collectors.groupingBy(JobCareerPositionMajor::getCareerPositionId,
            Collectors.mapping(JobCareerPositionMajor::getMajorId, Collectors.toList())));
    }

    private List<String> fetchMajorIds(String positionId) {
        List<JobCareerPositionMajor> rows = majorMapper.selectList(
            QueryBuilder.lambda(JobCareerPositionMajor.class)
                .eq(JobCareerPositionMajor::getCareerPositionId, positionId).build());
        return rows.stream().map(JobCareerPositionMajor::getMajorId).toList();
    }

    private Set<String> collectMajorIds(Map<String, List<String>> majorIdsByPosition) {
        Set<String> ids = new LinkedHashSet<>();
        for (List<String> list : majorIdsByPosition.values()) {
            ids.addAll(list);
        }
        return ids;
    }

    private Map<String, String> majorNameMap(Set<String> majorIds) {
        if (majorIds.isEmpty()) {
            return Map.of();
        }
        try {
            return portalMajorMapper.selectList(
                    QueryBuilder.lambda(PortalMajor.class).in(PortalMajor::getId, new ArrayList<>(majorIds)).build())
                .stream()
                .filter(m -> m.getName() != null)
                .collect(Collectors.toMap(PortalMajor::getId, PortalMajor::getName));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, String> userNameMap(List<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return userMapper.selectList(
                    QueryBuilder.lambda(ZhiyuUser.class).in(ZhiyuUser::getId, ids).build())
                .stream()
                .filter(u -> u.getName() != null)
                .collect(Collectors.toMap(ZhiyuUser::getId, ZhiyuUser::getName));
        } catch (Exception e) {
            return Map.of();
        }
    }

    /** 通用计数表查询（favorite_counters/view_counters，按 target_id 聚合）。 */
    private Map<String, Long> counterMap(String targetType, List<String> ids, String table) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            List<PortalViewCounter> counters;
            if ("favorite_counters".equals(table)) {
                counters = favoriteCounterMapper.selectList(
                        QueryBuilder.lambda(ZhiyuFavoriteCounter.class)
                            .eq(ZhiyuFavoriteCounter::getTargetType, targetType)
                            .in(ZhiyuFavoriteCounter::getTargetId, ids).build())
                    .stream()
                    .map(c -> {
                        PortalViewCounter vc = new PortalViewCounter();
                        vc.setTargetId(c.getTargetId());
                        vc.setCnt(c.getCnt());
                        return vc;
                    })
                    .toList();
            } else {
                counters = viewCounterMapper.selectList(
                    QueryBuilder.lambda(PortalViewCounter.class)
                        .eq(PortalViewCounter::getTargetType, targetType)
                        .in(PortalViewCounter::getTargetId, ids).build());
            }
            return counters.stream().collect(Collectors.toMap(PortalViewCounter::getTargetId,
                c -> c.getCnt() == null ? 0L : c.getCnt()));
        } catch (Exception e) {
            return Map.of();
        }
    }

    private Map<String, Long> abilityCountMap(List<String> positionIds) {
        if (positionIds.isEmpty()) {
            return Map.of();
        }
        List<JobPositionAbilityBinding> rows = bindingMapper.selectList(
            QueryBuilder.lambda(JobPositionAbilityBinding.class)
                .in(JobPositionAbilityBinding::getCareerPositionId, positionIds).build());
        return rows.stream().collect(Collectors.groupingBy(JobPositionAbilityBinding::getCareerPositionId,
            Collectors.counting()));
    }

    private int favoriteCount(String positionId) {
        try {
            List<ZhiyuFavoriteCounter> rows = favoriteCounterMapper.selectList(
                QueryBuilder.lambda(ZhiyuFavoriteCounter.class)
                    .eq(ZhiyuFavoriteCounter::getTargetType, "career_position")
                    .eq(ZhiyuFavoriteCounter::getTargetId, positionId).build());
            return rows.isEmpty() ? 0 : rows.get(0).getCnt() == null ? 0 : rows.get(0).getCnt().intValue();
        } catch (Exception e) {
            return 0;
        }
    }

    // ---------- 工具 ----------

    /** 能力点 find-or-create（tenant_id+name 唯一；对齐 Go PrepareAbilityPoint）。 */
    private String prepareAbilityPoint(String tenantId, String name, String description, List<String> attributes) {
        JobAbilityPoint existing = abilityPointMapper.selectOne(
            QueryBuilder.lambda(JobAbilityPoint.class)
                .eq(JobAbilityPoint::getTenantId, tenantId).eq(JobAbilityPoint::getName, name)
                .last("LIMIT 1").build());
        if (existing != null) {
            return existing.getId();
        }
        String newId = UUID.randomUUID().toString();
        String code = generateUniqueAbilityCode(tenantId);
        JobAbilityPoint point = new JobAbilityPoint();
        point.setId(newId);
        point.setTenantId(tenantId);
        point.setName(name);
        point.setCode(code);
        point.setDescription(ZhiyuStringUtils.blankToNull(description));
        point.setAttributes(coalesce(attributes));
        point.setIsPublic(true);
        try {
            abilityPointMapper.insert(point);
        } catch (Exception ignored) {
            // 并发首建冲突（唯一键）：回查实际入库行
        }
        JobAbilityPoint saved = abilityPointMapper.selectOne(
            QueryBuilder.lambda(JobAbilityPoint.class)
                .eq(JobAbilityPoint::getTenantId, tenantId).eq(JobAbilityPoint::getName, name)
                .last("LIMIT 1").build());
        return saved == null ? newId : saved.getId();
    }

    /** 证书库 find-or-create（tenant_id+name 唯一；对齐 Go PrepareCertificate）。 */
    private String prepareCertificate(String tenantId, String name, String url, String description, String image) {
        String libId = certificateMapper.selectLibraryId(tenantId, name);
        if (libId != null) {
            return libId;
        }
        String newId = UUID.randomUUID().toString();
        certificateMapper.insertLibrary(newId, tenantId, name, ZhiyuStringUtils.blankToNull(url), ZhiyuStringUtils.blankToNull(description),
            ZhiyuStringUtils.blankToNull(image));
        String saved = certificateMapper.selectLibraryId(tenantId, name);
        return saved == null ? newId : saved;
    }

    /** 重写岗位专业绑定（先删后插，对齐 Go Update 事务语义）。 */
    private void rewriteMajors(String positionId, List<String> majorIds) {
        majorMapper.delete(QueryBuilder.lambda(JobCareerPositionMajor.class)
            .eq(JobCareerPositionMajor::getCareerPositionId, positionId).build());
        for (String majorId : majorIds) {
            JobCareerPositionMajor m = new JobCareerPositionMajor();
            m.setCareerPositionId(positionId);
            m.setMajorId(majorId);
            majorMapper.insert(m);
        }
    }

    /** 生成岗位编码（GW-8 位随机，租户内唯一，重试 10 次；对齐 Go GenerateUniqueEntityCode）。 */
    private String generateUniqueCode(String tenantId) {
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 10; i++) {
            String code = randomCode("GW");
            if (!positionMapper.existsCode(tenantId, code)) {
                return code;
            }
        }
        throw new ApiException(500, "internal_error", "生成岗位编码失败");
    }

    /** 生成能力点编码（NL-8 位随机，租户内唯一，重试 10 次）。 */
    private String generateUniqueAbilityCode(String tenantId) {
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 10; i++) {
            String code = randomCode("NL");
            if (!abilityPointMapper.existsCode(tenantId, code)) {
                return code;
            }
        }
        throw new ApiException(500, "internal_error", "生成能力点编码失败");
    }

    private String randomCode(String prefix) {
        SecureRandom random = new SecureRandom();
        StringBuilder sb = new StringBuilder(prefix).append('-');
        for (int j = 0; j < 8; j++) {
            sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    /** 状态流转允许判定。 */
    private boolean canTransition(String from, String to) {
        Set<String> allowed = ALLOWED_TRANSITIONS.get(from);
        return allowed != null && allowed.contains(to);
    }

    /** 查询记录归属（不存在/他租户按 404/403 处理，对齐 Go Get + verifyTenantOwnership）。 */
    private JobCareerPosition fetchOwned(String id) {
        JobCareerPosition pos = positionMapper.selectById(id);
        if (pos == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        verifyTenantOwnership(pos.getTenantId());
        return pos;
    }

    /** 校验岗位归属当前租户（不存在/他租户按 404/403 处理）。 */
    private void checkPositionTenant(String id) {
        String tenantId = positionMapper.selectTenantId(id);
        if (tenantId == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        verifyTenantOwnership(tenantId);
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

    /** 校验用户属于当前租户。 */
    private boolean userExistsInTenant(String userId, String tenantId) {
        ZhiyuUser user = userMapper.selectById(userId);
        return user != null && tenantId.equals(user.getTenantId());
    }

    private LambdaQueryBuilder<JobCareerPosition> baseListWrapper(String tenantId, String search, String batchId,
                                                                  String positionType, String status) {
        LambdaQueryBuilder<JobCareerPosition> wrapper = QueryBuilder.lambda(JobCareerPosition.class)
            .eq(JobCareerPosition::getTenantId, tenantId);
        if (status != null && !status.isEmpty()) {
            wrapper.eq(JobCareerPosition::getStatus, status);
        } else {
            wrapper.ne(JobCareerPosition::getStatus, "archived");
        }
        wrapper.eqIfText(JobCareerPosition::getBatchId, batchId);
        wrapper.eqIfText(JobCareerPosition::getPositionType, positionType);
        if (search != null && !search.isEmpty()) {
            wrapper.like(JobCareerPosition::getName, search);
        }
        return wrapper;
    }

    private String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    private boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
    }

    private <T> List<T> safe(List<T> list) {
        return list == null ? List.of() : list;
    }

    private Map<String, Object> parseBundle(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, Object> m = ZhiyuJsonUtils.MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {
            });
            return m == null ? new LinkedHashMap<>() : m;
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    private Object parseObject(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return ZhiyuJsonUtils.MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception e) {
            return null;
        }
    }

    private List<Object> parseList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            Object v = ZhiyuJsonUtils.MAPPER.readValue(json, OBJECT_LIST_REF);
            return v == null ? new ArrayList<>() : (List<Object>) v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    /** 按 ID 顺序映射名称（未命中元素置空串，对齐 Go COALESCE 空串语义）。 */
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
}
