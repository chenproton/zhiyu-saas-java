package org.dromara.zhiyu.service.impl.partner;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.partner.CoBuildPositionDto;
import org.dromara.zhiyu.domain.dto.partner.CoBuildScenarioDto;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.CoBuildUserOption;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.EvaluationMethodsResponse;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.MethodInput;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.PositionCreateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ReorderRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.SaveEvaluationMethodsRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.SaveFullPositionRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.SaveWeightsRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.ScenarioCreateRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.TaskRequest;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.WeightItem;
import org.dromara.zhiyu.domain.dto.partner.TaskEvaluationMethodDto;
import org.dromara.zhiyu.domain.job.JobAbilityDomain;
import org.dromara.zhiyu.domain.job.JobAbilityPoint;
import org.dromara.zhiyu.domain.job.JobCareerPosition;
import org.dromara.zhiyu.domain.job.JobPositionAbilityBinding;
import org.dromara.zhiyu.domain.job.JobPositionCertificate;
import org.dromara.zhiyu.domain.job.JobPositionResponsibility;
import org.dromara.zhiyu.domain.partner.PartnerEnterprise;
import org.dromara.zhiyu.domain.lesson.LessonCourse;
import org.dromara.zhiyu.domain.portal.PortalExam;
import org.dromara.zhiyu.domain.portal.PortalIndustry;
import org.dromara.zhiyu.domain.portal.PortalMajor;
import org.dromara.zhiyu.domain.portal.PortalScenario;
import org.dromara.zhiyu.domain.scene.SceneEvalMethod;
import org.dromara.zhiyu.domain.scene.SceneRubricTemplate;
import org.dromara.zhiyu.domain.scene.SceneScenario;
import org.dromara.zhiyu.domain.scene.SceneScenarioTask;
import org.dromara.zhiyu.domain.scene.SceneWeightConfig;
import org.dromara.zhiyu.mapper.partner.PartnerApprovalMapper;
import org.dromara.zhiyu.mapper.partner.PartnerCooperationMapper;
import org.dromara.zhiyu.mapper.partner.PartnerEnterpriseLinkMapper;
import org.dromara.zhiyu.mapper.partner.PartnerEnterpriseMapper;
import org.dromara.zhiyu.mapper.partner.PartnerEvalMapper;
import org.dromara.zhiyu.mapper.partner.PartnerPositionMapper;
import org.dromara.zhiyu.mapper.partner.PartnerResourceGrantMapper;
import org.dromara.zhiyu.mapper.partner.PartnerScenarioMapper;
import org.dromara.zhiyu.mapper.partner.PartnerScenarioTaskMapper;
import org.dromara.zhiyu.mapper.partner.PartnerSchoolSourceMapper;
import org.dromara.zhiyu.domain.dto.partner.PartnerSchoolSourceDtos;
import org.dromara.zhiyu.mapper.scene.SceneWeightConfigMapper;
import org.dromara.zhiyu.mapper.job.JobAbilityDomainMapper;
import org.dromara.zhiyu.mapper.job.JobAbilityPointMapper;
import org.dromara.zhiyu.mapper.job.JobPositionAbilityBindingMapper;
import org.dromara.zhiyu.mapper.job.JobPositionCertificateMapper;
import org.dromara.zhiyu.mapper.job.JobPositionResponsibilityMapper;
import org.dromara.zhiyu.mapper.lesson.LessonCourseMapper;
import org.dromara.zhiyu.mapper.portal.PortalExamMapper;
import org.dromara.zhiyu.mapper.portal.PortalIndustryMapper;
import org.dromara.zhiyu.mapper.portal.PortalMajorMapper;
import org.dromara.zhiyu.mapper.portal.PortalScenarioMapper;
import org.dromara.zhiyu.mapper.scene.SceneRubricTemplateMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.partner.IPartnerCoBuildService;
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
 * 企业端资源共建服务实现（对齐 Go partner_cobuild_handler.go + service/partner_cobuild.go 语义）。
 *
 * @author zhiyu
 */
@Slf4j
@RequiredArgsConstructor
@Service
public class PartnerCoBuildServiceImpl implements IPartnerCoBuildService {

    private static final String CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> EDITABLE_STATUSES = Set.of("draft", "pending", "rejected");

    private final SystemGuard systemGuard;
    private final PartnerPositionMapper positionMapper;
    private final PartnerScenarioMapper scenarioMapper;
    private final PartnerScenarioTaskMapper taskMapper;
    private final PartnerEvalMapper evalMapper;
    private final PartnerResourceGrantMapper grantMapper;
    private final PartnerApprovalMapper approvalMapper;
    private final PartnerEnterpriseMapper enterpriseMapper;
    private final PartnerEnterpriseLinkMapper linkMapper;
    private final PartnerSchoolSourceMapper schoolSourceMapper;
    private final PartnerCooperationMapper cooperationMapper;
    private final SceneWeightConfigMapper weightMapper;
    private final JobPositionResponsibilityMapper responsibilityMapper;
    private final JobPositionCertificateMapper certificateMapper;
    private final JobPositionAbilityBindingMapper abilityBindingMapper;
    private final JobAbilityDomainMapper abilityDomainMapper;
    private final JobAbilityPointMapper abilityPointMapper;
    private final SceneRubricTemplateMapper rubricTemplateMapper;
    private final LessonCourseMapper courseMapper;
    private final PortalExamMapper examMapper;
    private final PortalScenarioMapper portalScenarioMapper;
    private final PortalIndustryMapper industryMapper;
    private final PortalMajorMapper majorMapper;

    // ===== 岗位 =====

    @Override
    public ListResponse<CoBuildPositionDto> listPositions(String schoolTenantId, String search, long limit, long offset) {
        String enterpriseId = resolveEnterpriseId();
        long safeLimit = clampLimit(limit);
        long safeOffset = Math.max(offset, 0);
        List<String> ids = positionMapper.selectPositionIds(enterpriseId, schoolTenantId, search, (int) safeLimit,
            (int) safeOffset);
        long total = positionMapper.countPositions(enterpriseId, schoolTenantId, search);
        if (ids.isEmpty()) {
            return ListResponse.of(List.of(), total);
        }
        List<JobCareerPosition> rows = positionMapper.selectList(
            QueryBuilder.lambda(JobCareerPosition.class).in(JobCareerPosition::getId, ids).build());
        // 按 ids 顺序重排
        Map<String, JobCareerPosition> byId = rows.stream().collect(Collectors.toMap(JobCareerPosition::getId, p -> p));
        List<JobCareerPosition> ordered = ids.stream().map(byId::get).filter(java.util.Objects::nonNull).toList();
        return ListResponse.of(assemblePositions(ordered), total);
    }

    @Override
    public CoBuildPositionDto getPosition(String id) {
        String enterpriseId = resolveEnterpriseId();
        JobCareerPosition pos = accessiblePosition(enterpriseId, id);
        return assemblePositions(List.of(pos)).get(0);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CoBuildPositionDto createPosition(PositionCreateRequest req) {
        String enterpriseId = resolveEnterpriseId();
        String userId = systemGuard.requireUser();
        if (req.getSchoolTenantId() == null || req.getSchoolTenantId().isEmpty()
            || req.getName() == null || req.getName().isEmpty()
            || req.getPositionType() == null || req.getPositionType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        requireActiveLink(enterpriseId, req.getSchoolTenantId());
        String version = req.getVersion() == null || req.getVersion().isEmpty() ? "V1.0" : req.getVersion();
        String id = UUID.randomUUID().toString();
        String code = generateUniqueCode("GW", req.getSchoolTenantId(), positionMapper::existsCode);
        positionMapper.insertCoBuildPosition(id, req.getSchoolTenantId(), code, req.getBatchId(), req.getName(),
            req.getShortName(), req.getIndustryId(), req.getPositionType(), req.getSalaryMin(), req.getSalaryMax(),
            req.getCoverImage(), req.getDescription(), req.getRequirements() == null ? List.of() : req.getRequirements(),
            req.getCareerPath(), version, "draft", userId,
            req.getCollaborators() == null ? List.of() : req.getCollaborators(), "enterprise", enterpriseId, null);
        for (String majorId : req.getMajorIds() == null ? List.<String>of() : req.getMajorIds()) {
            positionMapper.insertMajor(id, majorId);
        }
        grantMapper.addResourceId(req.getSchoolTenantId(), enterpriseId, "position", id, userId);
        return getPosition(id);
    }

    @Override
    public CoBuildPositionDto updatePosition(String id, PositionCreateRequest req) {
        String enterpriseId = resolveEnterpriseId();
        JobCareerPosition existing = checkPositionWritable(enterpriseId, id);

        String name = req.getName() == null || req.getName().isEmpty() ? existing.getName() : req.getName();
        String positionType = req.getPositionType() == null || req.getPositionType().isEmpty()
            ? existing.getPositionType() : req.getPositionType();
        String shortName = req.getShortName() != null ? req.getShortName() : existing.getShortName();
        String batchId = req.getBatchId() != null ? req.getBatchId() : existing.getBatchId();
        String industryId = req.getIndustryId() != null ? req.getIndustryId() : existing.getIndustryId();
        Integer salaryMin = req.getSalaryMin() != null ? req.getSalaryMin() : existing.getSalaryMin();
        Integer salaryMax = req.getSalaryMax() != null ? req.getSalaryMax() : existing.getSalaryMax();
        String coverImage = req.getCoverImage() != null ? req.getCoverImage() : existing.getCoverImage();
        String description = req.getDescription() != null ? req.getDescription() : existing.getDescription();
        String careerPath = req.getCareerPath() != null ? req.getCareerPath() : existing.getCareerPath();
        String version = req.getVersion() == null || req.getVersion().isEmpty() ? existing.getVersion() : req.getVersion();
        List<String> requirements = req.getRequirements() != null ? req.getRequirements() : existing.getRequirements();
        List<String> collaborators = req.getCollaborators() != null ? req.getCollaborators() : existing.getCollaborators();
        List<String> majorIds = req.getMajorIds() != null ? req.getMajorIds() : fetchPositionMajorIds(id);

        positionMapper.updateCoBuildPosition(id, batchId, name, shortName, industryId, positionType, salaryMin,
            salaryMax, coverImage, description, requirements, careerPath, version, collaborators);
        if (req.getMajorIds() != null) {
            positionMapper.deleteMajors(id);
            for (String majorId : majorIds) {
                positionMapper.insertMajor(id, majorId);
            }
        }
        return getPosition(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String deletePosition(String id) {
        String enterpriseId = resolveEnterpriseId();
        checkPositionWritable(enterpriseId, id);
        if (positionMapper.existsInUse(id)) {
            throw new ApiException(409, "conflict", "该资源已存在成绩记录或活跃绑定，无法删除");
        }
        positionMapper.cleanupJobAbilityResults(id);
        positionMapper.cleanupStudentPortraits(id);
        positionMapper.cleanupAggregateLogs(id);
        positionMapper.cleanupViewCounters(id);
        positionMapper.cleanupFavoriteCounters(id);
        positionMapper.deletePositionById(id);
        grantMapper.removeResourceId("position", id);
        grantMapper.deleteEmptyGrants("position");
        return id;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CoBuildPositionDto saveFullPosition(String id, SaveFullPositionRequest req) {
        String enterpriseId = resolveEnterpriseId();
        JobCareerPosition pos = accessiblePosition(enterpriseId, id);
        String schoolTenantId = pos.getTenantId();
        if (req.getName() == null || req.getName().isEmpty() || req.getPositionType() == null || req.getPositionType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }

        List<Integer> salaryRange = req.getSalaryRange() == null ? List.of() : req.getSalaryRange();
        Integer salaryMin = salaryRange.size() > 0 ? salaryRange.get(0) : null;
        Integer salaryMax = salaryRange.size() > 1 ? salaryRange.get(1) : null;

        positionMapper.updateCoBuildPosition(id, req.getBatchId(), req.getName(), req.getShortName(), req.getIndustry(),
            req.getPositionType(), salaryMin, salaryMax, req.getCoverImage(), req.getDescription(),
            req.getRequirements() == null ? List.of() : req.getRequirements(), req.getCareerPath(),
            req.getVersion() == null || req.getVersion().isEmpty() ? "V1.0" : req.getVersion(),
            req.getCollaborators() == null ? List.of() : req.getCollaborators());

        // 专业
        positionMapper.deleteMajors(id);
        for (String majorId : req.getMajors() == null ? List.<String>of() : req.getMajors()) {
            positionMapper.insertMajor(id, majorId);
        }

        // 职责（记录 client id → 后端 id 映射）
        positionMapper.deleteResponsibilities(id);
        Map<String, String> respIdMap = new LinkedHashMap<>();
        int idx = 0;
        for (PartnerDtosResponsibilityItem r : wrapResponsibilities(req)) {
            String rid = UUID.randomUUID().toString();
            positionMapper.insertResponsibility(rid, schoolTenantId, id, r.getName(), r.getDescription(), idx++);
            respIdMap.put(r.getId(), rid);
        }

        // 证书
        positionMapper.deleteCertificates(id);
        for (PartnerDtosCertificateItem c : wrapCertificates(req)) {
            String libId = positionMapper.selectCertificateLibraryId(schoolTenantId, c.getName());
            if (libId == null) {
                libId = UUID.randomUUID().toString();
                positionMapper.insertCertificateLibrary(libId, schoolTenantId, c.getName(), c.getUrl(),
                    c.getDescription(), c.getImage());
            }
            positionMapper.insertCertificate(UUID.randomUUID().toString(), schoolTenantId, id, libId);
        }

        // 能力绑定 / 能力域
        positionMapper.deleteAbilityDomains(id);
        positionMapper.deleteAbilityBindings(id);
        Map<String, String> bindingIdMap = new LinkedHashMap<>();
        for (PartnerDtosAbilityBindingItem b : wrapAbilityBindings(req)) {
            String backendRespId = respIdMap.get(b.getResponsibilityId());
            if (backendRespId == null) {
                continue;
            }
            String abilityPointId = b.getAbilityPointId();
            if (abilityPointId == null || abilityPointId.isEmpty()) {
                abilityPointId = b.getPublicAbilityId();
            }
            if (abilityPointId == null || abilityPointId.isEmpty()) {
                abilityPointId = positionMapper.selectAbilityPointId(schoolTenantId, b.getName());
            }
            if (abilityPointId == null) {
                abilityPointId = UUID.randomUUID().toString();
                positionMapper.insertAbilityPoint(abilityPointId, schoolTenantId, b.getName(), b.getDescription(),
                    generateUniqueCode("NL", schoolTenantId, positionMapper::existsCode),
                    b.getAttributes() == null ? List.of() : b.getAttributes());
            }
            String bindingId = UUID.randomUUID().toString();
            positionMapper.upsertAbilityBinding(bindingId, schoolTenantId,
                id, backendRespId, abilityPointId, b.getSource(), b.getDomain(), b.getLevel(), b.getRubricDescription(),
                b.getAttributes() == null ? List.of() : b.getAttributes(), BigDecimal.ZERO);
            // 冲突命中时新 id 未生效，回读唯一键对应已存在行 id
            String actualId = positionMapper.selectAbilityBindingId(id, backendRespId, abilityPointId);
            bindingIdMap.put(b.getId(), actualId == null ? bindingId : actualId);
        }
        for (PartnerDtosAbilityDomainItem ad : wrapAbilityDomains(req)) {
            List<String> newBindingIds = new ArrayList<>();
            for (String oldId : ad.getBindingIds() == null ? List.<String>of() : ad.getBindingIds()) {
                String mapped = bindingIdMap.get(oldId);
                if (mapped != null) {
                    newBindingIds.add(mapped);
                }
            }
            positionMapper.insertAbilityDomain(UUID.randomUUID().toString(), schoolTenantId, id, ad.getName(),
                ad.getDescription(), newBindingIds, 0);
        }

        resetToDraftPosition(id, schoolTenantId);
        return getPosition(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CoBuildPositionDto submitPosition(String id) {
        String enterpriseId = resolveEnterpriseId();
        String userId = systemGuard.requireUser();
        JobCareerPosition pos = ownedPosition(enterpriseId, id);
        requireActiveLink(enterpriseId, pos.getTenantId());
        String schoolTenantId = pos.getTenantId();
        if (positionMapper.casTransition(id, schoolTenantId, pos.getStatus(), "pending") == 0) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作");
        }
        approvalMapper.insertPendingApproval(UUID.randomUUID().toString(), schoolTenantId, "career_position", id, userId);
        return getPosition(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CoBuildPositionDto withdrawPosition(String id) {
        String enterpriseId = resolveEnterpriseId();
        JobCareerPosition pos = ownedPosition(enterpriseId, id);
        requireActiveLink(enterpriseId, pos.getTenantId());
        if (positionMapper.casTransition(id, pos.getTenantId(), pos.getStatus(), "draft") == 0) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作");
        }
        approvalMapper.deletePendingApproval("career_position", id);
        return getPosition(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CoBuildPositionDto editSourcePosition(String id) {
        String enterpriseId = resolveEnterpriseId();
        String userId = systemGuard.requireUser();
        JobCareerPosition src = positionMapper.selectById(id);
        if (src == null) {
            throw new ApiException(404, "not_found", "岗位不存在或未授权");
        }
        if (enterpriseId.equals(src.getSourceEnterpriseId())) {
            throw new ApiException(409, "conflict", "当前状态不允许编辑或删除");
        }
        String grantTenantId = grantMapper.selectGrantTenantId(enterpriseId, "position", id);
        if (grantTenantId == null || !grantTenantId.equals(src.getTenantId())) {
            throw new ApiException(404, "not_found", "岗位不存在或未授权");
        }
        requireActiveLink(enterpriseId, src.getTenantId());
        String existingDraft = positionMapper.selectDraftIdBySource(enterpriseId, id);
        if (existingDraft != null) {
            return getPosition(existingDraft);
        }
        String newId = UUID.randomUUID().toString();
        String code = generateUniqueCode("GW", src.getTenantId(), positionMapper::existsCode);
        positionMapper.insertCoBuildPosition(newId, src.getTenantId(), code, src.getBatchId(), src.getName(),
            src.getShortName(), src.getIndustryId(), src.getPositionType(), src.getSalaryMin(), src.getSalaryMax(),
            src.getCoverImage(), src.getDescription(), src.getRequirements() == null ? List.of() : src.getRequirements(),
            src.getCareerPath(), src.getVersion(), "draft", userId,
            src.getCollaborators() == null ? List.of() : src.getCollaborators(), "enterprise", enterpriseId, id);
        for (String majorId : fetchPositionMajorIds(id)) {
            positionMapper.insertMajor(newId, majorId);
        }
        // 深拷贝子表（对齐 Go CopyPositionAsDraft + position_clone：职责/证书/能力绑定/能力域）。
        // 能力绑定需重映射 responsibility_id，能力域需重映射 binding_ids。
        copyPositionChildren(id, newId, src.getTenantId());
        return getPosition(newId);
    }

    /**
     * 岗位 draft 深拷贝子表：职责、证书、能力绑定、能力域。
     * 新 id 均为 UUID；source_resource_id 标记由主表 insertCoBuildPosition 维护。
     */
    private void copyPositionChildren(String srcId, String newId, String tenantId) {
        // 职责（记录旧 id → 新 id 映射，供能力绑定重挂）
        Map<String, String> respIdMap = new LinkedHashMap<>();
        for (JobPositionResponsibility r : responsibilityMapper.selectList(
            QueryBuilder.lambda(JobPositionResponsibility.class)
                .eq(JobPositionResponsibility::getCareerPositionId, srcId)
                .orderByAsc(JobPositionResponsibility::getSortOrder).build())) {
            String rid = UUID.randomUUID().toString();
            positionMapper.insertResponsibility(rid, tenantId, newId, r.getName(), r.getDescription(),
                r.getSortOrder() == null ? 0 : r.getSortOrder());
            respIdMap.put(r.getId(), rid);
        }

        // 证书（仅复制 certificate_library_id 绑定）
        for (JobPositionCertificate c : certificateMapper.selectRawByPosition(srcId)) {
            positionMapper.insertCertificate(UUID.randomUUID().toString(), tenantId, newId, c.getCertificateLibraryId());
        }

        // 能力绑定（重挂新职责 id；upsert 后回读实际 id 用于能力域 binding_ids 重映射）
        Map<String, String> bindingIdMap = new LinkedHashMap<>();
        for (JobPositionAbilityBinding b : abilityBindingMapper.selectList(
            QueryBuilder.lambda(JobPositionAbilityBinding.class)
                .eq(JobPositionAbilityBinding::getCareerPositionId, srcId).build())) {
            String newRespId = respIdMap.get(b.getResponsibilityId());
            if (newRespId == null) {
                continue;
            }
            String bindingId = UUID.randomUUID().toString();
            positionMapper.upsertAbilityBinding(bindingId, tenantId,
                newId, newRespId, b.getAbilityPointId(), b.getSource(), b.getDomain(), b.getRequiredLevel(),
                b.getRubricDescription(), b.getAttributes() == null ? List.of() : b.getAttributes(),
                b.getWeight() == null ? BigDecimal.ZERO : b.getWeight());
            // 冲突命中时新 id 未生效，回读唯一键对应已存在行 id
            String actualId = positionMapper.selectAbilityBindingId(newId, newRespId, b.getAbilityPointId());
            bindingIdMap.put(b.getId(), actualId == null ? bindingId : actualId);
        }

        // 能力域（binding_ids 由旧绑定 id 重映射为新绑定 id）
        for (JobAbilityDomain ad : abilityDomainMapper.selectList(
            QueryBuilder.lambda(JobAbilityDomain.class)
                .eq(JobAbilityDomain::getCareerPositionId, srcId)
                .orderByAsc(JobAbilityDomain::getSortOrder).build())) {
            List<String> newBindingIds = new ArrayList<>();
            for (String oldId : ad.getBindingIds() == null ? List.<String>of() : ad.getBindingIds()) {
                String mapped = bindingIdMap.get(oldId);
                if (mapped != null) {
                    newBindingIds.add(mapped);
                }
            }
            positionMapper.insertAbilityDomain(UUID.randomUUID().toString(), tenantId, newId, ad.getName(),
                ad.getDescription(), newBindingIds, ad.getSortOrder() == null ? 0 : ad.getSortOrder());
        }
    }

    // ===== 岗位子资源 =====

    @Override
    public ListResponse<JobPositionResponsibility> listPositionResponsibilities(String id) {
        String schoolTenantId = ownedPositionTenant(id);
        List<JobPositionResponsibility> rows = responsibilityMapper.selectList(
            QueryBuilder.lambda(JobPositionResponsibility.class)
                .eq(JobPositionResponsibility::getCareerPositionId, id)
                .orderByAsc(JobPositionResponsibility::getSortOrder)
                .build());
        return ListResponse.of(rows, rows.size());
    }

    @Override
    public ListResponse<JobPositionCertificate> listPositionCertificates(String id, long limit, long offset) {
        String schoolTenantId = ownedPositionTenant(id);
        List<JobPositionCertificate> rows = certificateMapper.selectCertificates(schoolTenantId, id, (int) clampLimit(limit),
            (int) Math.max(offset, 0));
        long total = certificateMapper.countCertificates(schoolTenantId, id);
        return ListResponse.of(rows, total);
    }

    @Override
    public ListResponse<JobPositionAbilityBinding> listPositionAbilityBindings(String id) {
        String schoolTenantId = ownedPositionTenant(id);
        return listAbilityBindings(schoolTenantId, id);
    }

    @Override
    public ListResponse<JobAbilityDomain> listPositionAbilityDomains(String id) {
        ownedPositionTenant(id);
        List<JobAbilityDomain> rows = abilityDomainMapper.selectList(
            QueryBuilder.lambda(JobAbilityDomain.class)
                .eq(JobAbilityDomain::getCareerPositionId, id)
                .orderByAsc(JobAbilityDomain::getSortOrder)
                .build());
        return ListResponse.of(rows, rows.size());
    }

    // ===== 场景 =====

    @Override
    public ListResponse<CoBuildScenarioDto> listScenarios(String schoolTenantId, String search, long limit, long offset) {
        String enterpriseId = resolveEnterpriseId();
        long safeLimit = clampLimit(limit);
        List<String> ids = scenarioMapper.selectScenarioIds(enterpriseId, schoolTenantId, search, (int) safeLimit,
            (int) Math.max(offset, 0));
        long total = scenarioMapper.countScenarios(enterpriseId, schoolTenantId, search);
        if (ids.isEmpty()) {
            return ListResponse.of(List.of(), total);
        }
        List<SceneScenario> rows = scenarioMapper.selectList(
            QueryBuilder.lambda(SceneScenario.class).in(SceneScenario::getId, ids).build());
        Map<String, SceneScenario> byId = rows.stream().collect(Collectors.toMap(SceneScenario::getId, s -> s));
        List<SceneScenario> ordered = ids.stream().map(byId::get).filter(java.util.Objects::nonNull).toList();
        return ListResponse.of(assembleScenarios(ordered), total);
    }

    @Override
    public CoBuildScenarioDto getScenario(String id) {
        String enterpriseId = resolveEnterpriseId();
        SceneScenario sc = accessibleScenario(enterpriseId, id);
        return assembleScenarios(List.of(sc)).get(0);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CoBuildScenarioDto createScenario(ScenarioCreateRequest req) {
        String enterpriseId = resolveEnterpriseId();
        String userId = systemGuard.requireUser();
        if (req.getSchoolTenantId() == null || req.getSchoolTenantId().isEmpty()
            || req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        requireActiveLink(enterpriseId, req.getSchoolTenantId());
        String version = req.getVersion() == null || req.getVersion().isEmpty() ? "V1.0" : req.getVersion();
        int difficulty = req.getDifficulty() == null || req.getDifficulty() == 0 ? 1 : req.getDifficulty();
        String id = UUID.randomUUID().toString();
        String code = generateUniqueCode("CJ", req.getSchoolTenantId(), scenarioMapper::existsCode);
        scenarioMapper.insertCoBuildScenario(id, req.getName(), code, req.getCoverImage(), req.getCareerPositionId(),
            req.getIndustryIds() == null ? List.of() : req.getIndustryIds(),
            req.getProfessionIds() == null ? List.of() : req.getProfessionIds(),
            req.getBatchId(), difficulty, version, "draft", req.getBackground(), req.getDeliveryGoal(), userId,
            req.getCoBuilderIds() == null ? List.of() : req.getCoBuilderIds(), req.getSchoolTenantId(), "enterprise",
            enterpriseId, null);
        grantMapper.addResourceId(req.getSchoolTenantId(), enterpriseId, "scenario", id, userId);
        return getScenario(id);
    }

    @Override
    public CoBuildScenarioDto updateScenario(String id, ScenarioCreateRequest req) {
        String enterpriseId = resolveEnterpriseId();
        SceneScenario existing = accessibleScenario(enterpriseId, id);

        String name = req.getName() == null || req.getName().isEmpty() ? existing.getName() : req.getName();
        String version = req.getVersion() == null || req.getVersion().isEmpty() ? existing.getVersion() : req.getVersion();
        int difficulty = req.getDifficulty() == null || req.getDifficulty() == 0
            ? (existing.getDifficulty() == null ? 1 : existing.getDifficulty()) : req.getDifficulty();
        List<String> industryIds = req.getIndustryIds() != null ? req.getIndustryIds() : existing.getIndustryIds();
        List<String> professionIds = req.getProfessionIds() != null ? req.getProfessionIds() : existing.getProfessionIds();
        List<String> coBuilderIds = req.getCoBuilderIds() != null ? req.getCoBuilderIds() : existing.getCoBuilderIds();

        scenarioMapper.updateCoBuildScenario(id, name, req.getCoverImage() != null ? req.getCoverImage() : existing.getCoverImage(),
            req.getCareerPositionId() != null ? req.getCareerPositionId() : existing.getCareerPositionId(),
            industryIds, professionIds, req.getBatchId() != null ? req.getBatchId() : existing.getBatchId(),
            difficulty, version, req.getBackground() != null ? req.getBackground() : existing.getBackground(),
            req.getDeliveryGoal() != null ? req.getDeliveryGoal() : existing.getDeliveryGoal(), coBuilderIds);
        resetToDraftScenario(id, existing.getTenantId());
        return getScenario(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String deleteScenario(String id) {
        String enterpriseId = resolveEnterpriseId();
        SceneScenario sc = checkScenarioWritable(enterpriseId, id);
        if (scenarioMapper.existsEvaluationResults(id)) {
            throw new ApiException(409, "conflict", "该资源已存在成绩记录或活跃绑定，无法删除");
        }
        scenarioMapper.unbindTeachingPlanEntries(id);
        scenarioMapper.unbindScheduleEntries(id);
        scenarioMapper.deleteScenarioById(id);
        grantMapper.removeResourceId("scenario", id);
        grantMapper.deleteEmptyGrants("scenario");
        return id;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CoBuildScenarioDto submitScenario(String id) {
        String enterpriseId = resolveEnterpriseId();
        String userId = systemGuard.requireUser();
        SceneScenario sc = ownedScenario(enterpriseId, id);
        requireActiveLink(enterpriseId, sc.getTenantId());
        if (scenarioMapper.casTransition(id, sc.getTenantId(), sc.getStatus(), "pending") == 0) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作");
        }
        approvalMapper.insertPendingApproval(UUID.randomUUID().toString(), sc.getTenantId(), "scenario", id, userId);
        return getScenario(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CoBuildScenarioDto withdrawScenario(String id) {
        String enterpriseId = resolveEnterpriseId();
        SceneScenario sc = ownedScenario(enterpriseId, id);
        requireActiveLink(enterpriseId, sc.getTenantId());
        if (scenarioMapper.casTransition(id, sc.getTenantId(), sc.getStatus(), "draft") == 0) {
            throw new ApiException(409, "conflict", "当前状态不允许该操作");
        }
        approvalMapper.deletePendingApproval("scenario", id);
        return getScenario(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public CoBuildScenarioDto editSourceScenario(String id) {
        String enterpriseId = resolveEnterpriseId();
        String userId = systemGuard.requireUser();
        SceneScenario src = scenarioMapper.selectById(id);
        if (src == null || src.getTenantId() == null) {
            throw new ApiException(404, "not_found", "场景方案不存在或未授权");
        }
        if (enterpriseId.equals(src.getSourceEnterpriseId())) {
            throw new ApiException(409, "conflict", "当前状态不允许编辑或删除");
        }
        String grantTenantId = grantMapper.selectGrantTenantId(enterpriseId, "scenario", id);
        if (grantTenantId == null || !grantTenantId.equals(src.getTenantId())) {
            throw new ApiException(404, "not_found", "场景方案不存在或未授权");
        }
        requireActiveLink(enterpriseId, src.getTenantId());
        String existingDraft = scenarioMapper.selectDraftIdBySource(enterpriseId, id);
        if (existingDraft != null) {
            return getScenario(existingDraft);
        }
        String newId = UUID.randomUUID().toString();
        String code = generateUniqueCode("CJ", src.getTenantId(), scenarioMapper::existsCode);
        scenarioMapper.insertCoBuildScenario(newId, src.getName(), code, src.getCoverImage(), src.getCareerPositionId(),
            src.getIndustryIds() == null ? List.of() : src.getIndustryIds(),
            src.getProfessionIds() == null ? List.of() : src.getProfessionIds(),
            src.getBatchId(), src.getDifficulty() == null ? 1 : src.getDifficulty(), src.getVersion(), "draft",
            src.getBackground(), src.getDeliveryGoal(), userId,
            src.getCoBuilderIds() == null ? List.of() : src.getCoBuilderIds(), src.getTenantId(), "enterprise",
            enterpriseId, id);
        // 复制任务
        List<SceneScenarioTask> tasks = taskMapper.selectList(
            QueryBuilder.lambda(SceneScenarioTask.class).eq(SceneScenarioTask::getScenarioId, id)
                .orderByAsc(SceneScenarioTask::getSortOrder).build());
        for (SceneScenarioTask t : tasks) {
            String newTaskId = UUID.randomUUID().toString();
            taskMapper.insertTask(newTaskId, newId, t.getName(), t.getCode(), t.getSortOrder(), t.getDescription(),
                t.getDetailedDescription(), t.getDescriptionPdf(), t.getEstimatedHours(), t.getTaskType(),
                t.getDifficulty(), t.getBackground(), t.getDependencyIds() == null ? List.of() : t.getDependencyIds(),
                t.getIsReferenced(), t.getSourceScenarioId(),
                t.getKnowledgePointIds() == null ? List.of() : t.getKnowledgePointIds(),
                t.getAbilityPointIds() == null ? List.of() : t.getAbilityPointIds(),
                t.getResourceIds() == null ? List.of() : t.getResourceIds(),
                t.getEvalData() == null ? "{}" : t.getEvalData(), src.getTenantId());
        }
        return getScenario(newId);
    }

    // ===== 任务 =====

    @Override
    public ListResponse<SceneScenarioTask> listTasks(String scenarioId) {
        String enterpriseId = resolveEnterpriseId();
        SceneScenario sc = accessibleScenario(enterpriseId, scenarioId);
        List<SceneScenarioTask> rows = taskMapper.selectList(
            QueryBuilder.lambda(SceneScenarioTask.class)
                .eq(SceneScenarioTask::getScenarioId, scenarioId)
                .orderByAsc(SceneScenarioTask::getSortOrder)
                .build());
        return ListResponse.of(rows, rows.size());
    }

    @Override
    public SceneScenarioTask createTask(String scenarioId, TaskRequest req) {
        String enterpriseId = resolveEnterpriseId();
        SceneScenario sc = checkScenarioWritable(enterpriseId, scenarioId);
        if (req.getName() == null || req.getName().isEmpty() || req.getCode() == null || req.getCode().isEmpty()
            || req.getTaskType() == null || req.getTaskType().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String id = UUID.randomUUID().toString();
        taskMapper.insertTask(id, scenarioId, req.getName(), req.getCode(), req.getSortOrder() == null ? 0 : req.getSortOrder(),
            req.getDescription(), req.getDetailedDescription(), req.getDescriptionPdf(), req.getEstimatedHours(),
            req.getTaskType(), req.getDifficulty(), req.getBackground(),
            req.getDependencyIds() == null ? List.of() : req.getDependencyIds(), req.getIsReferenced(),
            req.getSourceScenarioId(), req.getKnowledgePointIds() == null ? List.of() : req.getKnowledgePointIds(),
            req.getAbilityPointIds() == null ? List.of() : req.getAbilityPointIds(),
            req.getResourceIds() == null ? List.of() : req.getResourceIds(),
            evalDataToJson(req.getEvalData()), sc.getTenantId());
        return taskMapper.selectById(id);
    }

    @Override
    public SceneScenarioTask updateTask(String taskId, TaskRequest req) {
        String enterpriseId = resolveEnterpriseId();
        SceneScenarioTask existing = taskMapper.selectById(taskId);
        if (existing == null) {
            throw new ApiException(404, "not_found", "场景任务不存在");
        }
        SceneScenario sc = ownedScenario(enterpriseId, existing.getScenarioId());
        if (!EDITABLE_STATUSES.contains(sc.getStatus())) {
            throw new ApiException(409, "conflict", "当前状态不允许编辑或删除");
        }
        requireActiveLink(enterpriseId, sc.getTenantId());

        String name = req.getName() == null || req.getName().isEmpty() ? existing.getName() : req.getName();
        String code = req.getCode() == null || req.getCode().isEmpty() ? existing.getCode() : req.getCode();
        int sortOrder = req.getSortOrder() == null ? (existing.getSortOrder() == null ? 0 : existing.getSortOrder()) : req.getSortOrder();
        taskMapper.updateTask(taskId, sc.getTenantId(), existing.getScenarioId(), name, code, sortOrder,
            req.getDescription() != null ? req.getDescription() : existing.getDescription(),
            req.getDetailedDescription() != null ? req.getDetailedDescription() : existing.getDetailedDescription(),
            req.getDescriptionPdf() != null ? req.getDescriptionPdf() : existing.getDescriptionPdf(),
            req.getEstimatedHours() != null ? req.getEstimatedHours() : existing.getEstimatedHours(),
            req.getTaskType() == null || req.getTaskType().isEmpty() ? existing.getTaskType() : req.getTaskType(),
            req.getDifficulty() != null ? req.getDifficulty() : existing.getDifficulty(),
            req.getBackground() != null ? req.getBackground() : existing.getBackground(),
            req.getDependencyIds() != null ? req.getDependencyIds() : (existing.getDependencyIds() == null ? List.of() : existing.getDependencyIds()),
            req.getIsReferenced() != null ? req.getIsReferenced() : existing.getIsReferenced(),
            req.getSourceScenarioId() != null ? req.getSourceScenarioId() : existing.getSourceScenarioId(),
            req.getKnowledgePointIds() != null ? req.getKnowledgePointIds() : (existing.getKnowledgePointIds() == null ? List.of() : existing.getKnowledgePointIds()),
            req.getAbilityPointIds() != null ? req.getAbilityPointIds() : (existing.getAbilityPointIds() == null ? List.of() : existing.getAbilityPointIds()),
            req.getResourceIds() != null ? req.getResourceIds() : (existing.getResourceIds() == null ? List.of() : existing.getResourceIds()),
            req.getEvalData() != null ? evalDataToJson(req.getEvalData()) : (existing.getEvalData() == null ? "{}" : existing.getEvalData()));
        return taskMapper.selectById(taskId);
    }

    @Override
    public String deleteTask(String taskId) {
        String enterpriseId = resolveEnterpriseId();
        SceneScenarioTask existing = taskMapper.selectById(taskId);
        if (existing == null) {
            throw new ApiException(404, "not_found", "场景任务不存在");
        }
        SceneScenario sc = ownedScenario(enterpriseId, existing.getScenarioId());
        if (!EDITABLE_STATUSES.contains(sc.getStatus())) {
            throw new ApiException(409, "conflict", "当前状态不允许编辑或删除");
        }
        requireActiveLink(enterpriseId, sc.getTenantId());
        taskMapper.deleteTask(taskId, sc.getTenantId());
        return taskId;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean reorderTasks(String scenarioId, ReorderRequest req) {
        String enterpriseId = resolveEnterpriseId();
        checkScenarioWritable(enterpriseId, scenarioId);
        List<String> taskIds = req.getTaskIds() == null ? List.of() : req.getTaskIds();
        for (int i = 0; i < taskIds.size(); i++) {
            taskMapper.reorderTask(taskIds.get(i), scenarioId, i);
        }
        return true;
    }

    // ===== 测评方式 =====

    @Override
    public EvaluationMethodsResponse getTaskEvaluationMethods(String taskId) {
        String enterpriseId = resolveEnterpriseId();
        String tenantId = accessibleTaskTenant(enterpriseId, taskId);
        List<SceneEvalMethod> methods = evalMapper.selectList(
            QueryBuilder.lambda(SceneEvalMethod.class)
                .eq(SceneEvalMethod::getTaskId, taskId)
                .eq(SceneEvalMethod::getTenantId, tenantId)
                .build());
        EvaluationMethodsResponse resp = new EvaluationMethodsResponse();
        List<TaskEvaluationMethodDto> out = new ArrayList<>();
        for (SceneEvalMethod m : methods) {
            out.add(toMethodDto(m));
        }
        resp.setMethods(out);
        return resp;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public EvaluationMethodsResponse saveTaskEvaluationMethods(String taskId, SaveEvaluationMethodsRequest req) {
        String enterpriseId = resolveEnterpriseId();
        String userId = systemGuard.requireUser();
        SceneScenarioTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new ApiException(404, "not_found", "场景任务不存在");
        }
        SceneScenario sc = ownedScenario(enterpriseId, task.getScenarioId());
        if (!EDITABLE_STATUSES.contains(sc.getStatus())) {
            throw new ApiException(409, "conflict", "当前状态不允许编辑或删除");
        }
        requireActiveLink(enterpriseId, sc.getTenantId());
        String tenantId = sc.getTenantId();

        evalMapper.lockTaskEval(taskId + ":" + tenantId);
        int currentVersion = evalMapper.selectMaxVersion(taskId, tenantId) == null ? 0 : evalMapper.selectMaxVersion(taskId, tenantId);
        if (req.getVersion() != null && req.getVersion() < currentVersion) {
            throw new ApiException(409, "conflict", "评价规则已被其他会话修改");
        }
        int nextVersion = (req.getVersion() == null ? currentVersion : req.getVersion()) + 1;

        for (MethodInput m : req.getMethods() == null ? List.<MethodInput>of() : req.getMethods()) {
            evalMapper.upsertMethod(tenantId, taskId, m.getMethodKey(), m.getWeight(),
                m.getEvalObject(), m.getScoreType(), toJson(m.getEvalSubjects()), m.getStandardName(),
                m.getStandardMode(), toJson(m.getResourceConfig()), nextVersion, m.getIsEnabled() == null || m.getIsEnabled());
            // 冲突命中时回读唯一键（task_id + method_key）对应行 id
            String configId = evalMapper.selectMethodId(tenantId, taskId, m.getMethodKey());
            evalMapper.deleteEvalPoints(configId);
            evalMapper.deleteScoreRules(configId);
            evalMapper.deleteReviewSteps(configId);
            for (PartnerDtosEvalPointInput ep : wrapEvalPoints(m)) {
                evalMapper.insertEvalPoint(tenantId, configId, ep.getName(), ep.getDescription(), ep.getSubType(),
                    ep.getTypes() == null ? List.of() : ep.getTypes(), ep.getWeight(), ep.getScoringMethod(),
                    toJson(ep.getGradeMapping()), ep.getKnowledgePointIds() == null ? List.of() : ep.getKnowledgePointIds(),
                    ep.getAbilityPointIds() == null ? List.of() : ep.getAbilityPointIds(),
                    ep.getSortOrder() == null ? 0 : ep.getSortOrder());
            }
            for (PartnerDtosScoreRuleInput sr : wrapScoreRules(m)) {
                evalMapper.insertScoreRule(tenantId, configId, sr.getName(), sr.getDescription(), sr.getRule(),
                    sr.getWeight(), sr.getSortOrder() == null ? 0 : sr.getSortOrder());
            }
            for (PartnerDtosReviewStepInput rs : wrapReviewSteps(m)) {
                evalMapper.insertReviewStep(tenantId, configId, rs.getLabel(), rs.getDescription(), rs.getEnabled(),
                    rs.getSubjectType(), rs.getWeight(), rs.getSortOrder() == null ? 0 : rs.getSortOrder(),
                    rs.getAssignedUserIds() == null ? List.of() : rs.getAssignedUserIds());
            }
        }
        return getTaskEvaluationMethods(taskId);
    }

    // ===== 权重 =====

    @Override
    public ListResponse<SceneWeightConfig> listScenarioWeights(String scenarioId) {
        String enterpriseId = resolveEnterpriseId();
        SceneScenario sc = accessibleScenario(enterpriseId, scenarioId);
        List<SceneWeightConfig> rows = weightMapper.selectList(
            QueryBuilder.lambda(SceneWeightConfig.class)
                .eq(SceneWeightConfig::getScenarioId, scenarioId)
                .eq(SceneWeightConfig::getTenantId, sc.getTenantId())
                .build());
        return ListResponse.of(rows, rows.size());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean saveScenarioWeights(String scenarioId, SaveWeightsRequest req) {
        String enterpriseId = resolveEnterpriseId();
        SceneScenario sc = checkScenarioWritable(enterpriseId, scenarioId);
        String tenantId = sc.getTenantId();
        for (WeightItem w : req.getWeights() == null ? List.<WeightItem>of() : req.getWeights()) {
            if (w.getTaskId() == null || w.getTaskId().isEmpty()) {
                throw new ApiException(400, "bad_request", "缺少任务 id");
            }
            weightMapper.upsert(tenantId, scenarioId, w.getTaskId(), w.getWeight());
        }
        return true;
    }

    // ===== 合作学校只读数据源 =====

    @Override
    public ListResponse<JobAbilityPoint> listSchoolAbilities(String schoolTenantId, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        LambdaQueryBuilder<JobAbilityPoint> w = QueryBuilder.lambda(JobAbilityPoint.class)
            .eq(JobAbilityPoint::getTenantId, schoolTenantId);
        if (search != null && !search.isEmpty()) {
            w.like(JobAbilityPoint::getName, search);
        }
        long total = abilityPointMapper.selectCount(w.build());
        w.orderByDesc(JobAbilityPoint::getCreatedAt).last("LIMIT " + clampLimit(limit) + " OFFSET " + Math.max(offset, 0));
        return ListResponse.of(abilityPointMapper.selectList(w.build()), total);
    }

    @Override
    public ListResponse<SceneRubricTemplate> listSchoolEvaluationMethods(String schoolTenantId, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        LambdaQueryBuilder<SceneRubricTemplate> w = QueryBuilder.lambda(SceneRubricTemplate.class)
            .eq(SceneRubricTemplate::getTenantId, schoolTenantId);
        if (search != null && !search.isEmpty()) {
            w.like(SceneRubricTemplate::getName, search);
        }
        long total = rubricTemplateMapper.selectCount(w.build());
        w.orderByDesc(SceneRubricTemplate::getCreatedAt).last("LIMIT " + clampLimit(limit) + " OFFSET " + Math.max(offset, 0));
        return ListResponse.of(rubricTemplateMapper.selectList(w.build()), total);
    }

    @Override
    public ListResponse<CoBuildUserOption> listSchoolCoBuilders(String schoolTenantId) {
        requireSchoolAccess(schoolTenantId);
        List<CoBuildUserOption> out = new ArrayList<>();
        for (PartnerCooperationMapper.CoBuilderRow r : cooperationMapper.listSchoolTeachers(schoolTenantId)) {
            CoBuildUserOption o = new CoBuildUserOption();
            o.setId(r.getId());
            o.setName(r.getName());
            o.setGroup("teacher");
            out.add(o);
        }
        for (PartnerCooperationMapper.CoBuilderRow r : cooperationMapper.listSchoolExperts(schoolTenantId)) {
            CoBuildUserOption o = new CoBuildUserOption();
            o.setId(r.getUserId());
            o.setName(r.getName());
            o.setGroup("expert");
            o.setTitle(r.getTitle());
            o.setExpertId(r.getExpertId());
            o.setEnterpriseName(r.getEnterpriseName());
            out.add(o);
        }
        return ListResponse.of(out, out.size());
    }

    @Override
    public ListResponse<PartnerSchoolSourceDtos.KnowledgePointDto> listSchoolKnowledgePoints(String schoolTenantId, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        return ListResponse.of(schoolSourceMapper.listKnowledgePoints(schoolTenantId, search, (int) clampLimit(limit),
            (int) Math.max(offset, 0)), schoolSourceMapper.countKnowledgePoints(schoolTenantId, search));
    }

    @Override
    public ListResponse<LessonCourse> listSchoolCourses(String schoolTenantId, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        LambdaQueryBuilder<LessonCourse> w = QueryBuilder.lambda(LessonCourse.class)
            .eq(LessonCourse::getTenantId, schoolTenantId);
        if (search != null && !search.isEmpty()) {
            w.like(LessonCourse::getName, search);
        }
        long total = courseMapper.selectCount(w.build());
        w.orderByDesc(LessonCourse::getCreatedAt).last("LIMIT " + clampLimit(limit) + " OFFSET " + Math.max(offset, 0));
        return ListResponse.of(courseMapper.selectList(w.build()), total);
    }

    @Override
    public ListResponse<JobPositionAbilityBinding> listSchoolAbilityBindings(String schoolTenantId, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        List<JobPositionAbilityBinding> rows = abilityBindingMapper.selectList(
            QueryBuilder.lambda(JobPositionAbilityBinding.class)
                .eq(JobPositionAbilityBinding::getTenantId, schoolTenantId)
                .last("LIMIT " + clampLimit(limit) + " OFFSET " + Math.max(offset, 0))
                .build());
        return ListResponse.of(rows, rows.size());
    }

    @Override
    public ListResponse<PartnerSchoolSourceDtos.QuestionBankDto> listSchoolQuestionBanks(String schoolTenantId, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        return ListResponse.of(schoolSourceMapper.listQuestionBanks(schoolTenantId, search, (int) clampLimit(limit),
            (int) Math.max(offset, 0)), schoolSourceMapper.countQuestionBanks(schoolTenantId, search));
    }

    @Override
    public ListResponse<PartnerSchoolSourceDtos.QuestionDto> listSchoolQuestions(String schoolTenantId, String bankId, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        return ListResponse.of(schoolSourceMapper.listQuestions(schoolTenantId, bankId, search, (int) clampLimit(limit),
            (int) Math.max(offset, 0)), schoolSourceMapper.countQuestions(schoolTenantId, bankId, search));
    }

    @Override
    public ListResponse<PartnerSchoolSourceDtos.RandomDrawQuestionDto> listSchoolRandomDrawQuestions(String schoolTenantId, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        return ListResponse.of(schoolSourceMapper.listRandomDrawQuestions(schoolTenantId, search, (int) clampLimit(limit),
            (int) Math.max(offset, 0)), schoolSourceMapper.countRandomDrawQuestions(schoolTenantId, search));
    }

    @Override
    public ListResponse<PortalExam> listSchoolExams(String schoolTenantId, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        LambdaQueryBuilder<PortalExam> w = QueryBuilder.lambda(PortalExam.class)
            .eq(PortalExam::getTenantId, schoolTenantId);
        if (search != null && !search.isEmpty()) {
            w.like(PortalExam::getName, search);
        }
        long total = examMapper.selectCount(w.build());
        w.orderByDesc(PortalExam::getCreatedAt).last("LIMIT " + clampLimit(limit) + " OFFSET " + Math.max(offset, 0));
        return ListResponse.of(examMapper.selectList(w.build()), total);
    }

    @Override
    public ListResponse<PartnerSchoolSourceDtos.MajorDto> listSchoolMajors(String schoolTenantId, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        return ListResponse.of(schoolSourceMapper.listMajors(schoolTenantId, search, (int) clampLimit(limit),
            (int) Math.max(offset, 0)), schoolSourceMapper.countMajors(schoolTenantId, search));
    }

    @Override
    public ListResponse<PortalScenario> listSchoolScenarios(String schoolTenantId, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        LambdaQueryBuilder<PortalScenario> w = QueryBuilder.lambda(PortalScenario.class)
            .eq(PortalScenario::getTenantId, schoolTenantId);
        if (search != null && !search.isEmpty()) {
            w.like(PortalScenario::getName, search);
        }
        long total = portalScenarioMapper.selectCount(w.build());
        w.orderByDesc(PortalScenario::getCreatedAt).last("LIMIT " + clampLimit(limit) + " OFFSET " + Math.max(offset, 0));
        return ListResponse.of(portalScenarioMapper.selectList(w.build()), total);
    }

    @Override
    public ListResponse<SceneScenarioTask> listSchoolTasks(String schoolTenantId, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        LambdaQueryBuilder<SceneScenarioTask> w = QueryBuilder.lambda(SceneScenarioTask.class)
            .eq(SceneScenarioTask::getTenantId, schoolTenantId);
        if (search != null && !search.isEmpty()) {
            w.like(SceneScenarioTask::getName, search);
        }
        long total = taskMapper.selectCount(w.build());
        w.orderByAsc(SceneScenarioTask::getSortOrder).last("LIMIT " + clampLimit(limit) + " OFFSET " + Math.max(offset, 0));
        return ListResponse.of(taskMapper.selectList(w.build()), total);
    }

    @Override
    public ListResponse<PartnerSchoolSourceDtos.ResourceDto> listSchoolResources(String schoolTenantId, String resourceType, String search, long limit, long offset) {
        requireSchoolAccess(schoolTenantId);
        return ListResponse.of(schoolSourceMapper.listResources(schoolTenantId, resourceType, search, (int) clampLimit(limit),
            (int) Math.max(offset, 0)), schoolSourceMapper.countResources(schoolTenantId, resourceType, search));
    }

    // ===== 组装 =====

    private List<CoBuildPositionDto> assemblePositions(List<JobCareerPosition> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        List<String> ids = rows.stream().map(JobCareerPosition::getId).toList();
        Map<String, String> schoolNames = positionMapper.selectSchoolNames(ids).stream()
            .collect(Collectors.toMap(PartnerPositionMapper.IdNameRow::getId, PartnerPositionMapper.IdNameRow::getName, (a, b) -> a));
        Map<String, List<String>> majorIdsByPos = new LinkedHashMap<>();
        Set<String> allMajorIds = new LinkedHashSet<>();
        for (PartnerPositionMapper.PosMajorRow r : positionMapper.selectPositionMajorIds(ids)) {
            majorIdsByPos.computeIfAbsent(r.getCareerPositionId(), k -> new ArrayList<>()).add(r.getMajorId());
            allMajorIds.add(r.getMajorId());
        }
        Map<String, String> majorNames = allMajorIds.isEmpty() ? Map.of()
            : positionMapper.selectMajorNames(new ArrayList<>(allMajorIds)).stream()
                .collect(Collectors.toMap(PartnerPositionMapper.IdNameRow::getId, PartnerPositionMapper.IdNameRow::getName, (a, b) -> a));

        List<CoBuildPositionDto> out = new ArrayList<>(rows.size());
        for (JobCareerPosition p : rows) {
            CoBuildPositionDto dto = new CoBuildPositionDto();
            copyPosition(p, dto);
            dto.setSchoolName(schoolNames.getOrDefault(p.getId(), ""));
            List<String> majorIds = majorIdsByPos.getOrDefault(p.getId(), List.of());
            dto.setMajorIds(majorIds);
            dto.setMajorNames(majorIds.stream().map(id -> majorNames.getOrDefault(id, "")).toList());
            out.add(dto);
        }
        return out;
    }

    private List<CoBuildScenarioDto> assembleScenarios(List<SceneScenario> rows) {
        if (rows.isEmpty()) {
            return List.of();
        }
        List<String> ids = rows.stream().map(SceneScenario::getId).toList();
        Map<String, String> schoolNames = scenarioMapper.selectSchoolNames(ids).stream()
            .collect(Collectors.toMap(PartnerScenarioMapper.IdNameRow::getId, PartnerScenarioMapper.IdNameRow::getName, (a, b) -> a));
        Set<String> industryIds = new LinkedHashSet<>();
        Set<String> professionIds = new LinkedHashSet<>();
        for (SceneScenario s : rows) {
            if (s.getIndustryIds() != null) {
                industryIds.addAll(s.getIndustryIds());
            }
            if (s.getProfessionIds() != null) {
                professionIds.addAll(s.getProfessionIds());
            }
        }
        Map<String, String> industryNames = industryIds.isEmpty() ? Map.of()
            : industryMapper.selectList(QueryBuilder.lambda(PortalIndustry.class).in(PortalIndustry::getId, new ArrayList<>(industryIds)).build())
                .stream().collect(Collectors.toMap(PortalIndustry::getId, PortalIndustry::getName, (a, b) -> a));
        Map<String, String> professionNames = professionIds.isEmpty() ? Map.of()
            : majorMapper.selectList(QueryBuilder.lambda(PortalMajor.class).in(PortalMajor::getId, new ArrayList<>(professionIds)).build())
                .stream().collect(Collectors.toMap(PortalMajor::getId, PortalMajor::getName, (a, b) -> a));

        List<CoBuildScenarioDto> out = new ArrayList<>(rows.size());
        for (SceneScenario s : rows) {
            CoBuildScenarioDto dto = new CoBuildScenarioDto();
            copyScenario(s, dto);
            dto.setSchoolName(schoolNames.getOrDefault(s.getId(), ""));
            dto.setIndustryNames(s.getIndustryIds() == null ? List.of()
                : s.getIndustryIds().stream().map(id -> industryNames.getOrDefault(id, "")).toList());
            dto.setProfessionNames(s.getProfessionIds() == null ? List.of()
                : s.getProfessionIds().stream().map(id -> professionNames.getOrDefault(id, "")).toList());
            out.add(dto);
        }
        return out;
    }

    private void copyPosition(JobCareerPosition s, CoBuildPositionDto d) {
        d.setId(s.getId());
        d.setTenantId(s.getTenantId());
        d.setBatchId(s.getBatchId());
        d.setCode(s.getCode());
        d.setName(s.getName());
        d.setShortName(s.getShortName());
        d.setIndustryId(s.getIndustryId());
        d.setPositionType(s.getPositionType());
        d.setSalaryMin(s.getSalaryMin());
        d.setSalaryMax(s.getSalaryMax());
        d.setCoverImage(s.getCoverImage());
        d.setDescription(s.getDescription());
        d.setRequirements(s.getRequirements());
        d.setCareerPath(s.getCareerPath());
        d.setVersion(s.getVersion());
        d.setStatus(s.getStatus());
        d.setCreatedBy(s.getCreatedBy());
        d.setCollaborators(s.getCollaborators());
        d.setViewCount(s.getViewCount());
        d.setSourceType(s.getSourceType());
        d.setSourceEnterpriseId(s.getSourceEnterpriseId());
        d.setSourceResourceId(s.getSourceResourceId());
        d.setCreatedAt(s.getCreatedAt());
        d.setUpdatedAt(s.getUpdatedAt());
    }

    private void copyScenario(SceneScenario s, CoBuildScenarioDto d) {
        d.setId(s.getId());
        d.setName(s.getName());
        d.setCode(s.getCode());
        d.setCoverImage(s.getCoverImage());
        d.setCareerPositionId(s.getCareerPositionId());
        d.setIndustryIds(s.getIndustryIds());
        d.setProfessionIds(s.getProfessionIds());
        d.setBatchId(s.getBatchId());
        d.setDifficulty(s.getDifficulty());
        d.setVersion(s.getVersion());
        d.setStatus(s.getStatus());
        d.setBackground(s.getBackground());
        d.setDeliveryGoal(s.getDeliveryGoal());
        d.setCreatorId(s.getCreatorId());
        d.setCoBuilderIds(s.getCoBuilderIds());
        d.setTenantId(s.getTenantId());
        d.setPublishTime(s.getPublishTime());
        d.setSourceType(s.getSourceType());
        d.setSourceEnterpriseId(s.getSourceEnterpriseId());
        d.setSourceResourceId(s.getSourceResourceId());
        d.setCreatedAt(s.getCreatedAt());
        d.setUpdatedAt(s.getUpdatedAt());
    }

    private TaskEvaluationMethodDto toMethodDto(SceneEvalMethod m) {
        TaskEvaluationMethodDto d = new TaskEvaluationMethodDto();
        d.setId(m.getId());
        d.setTaskId(m.getTaskId());
        d.setMethodKey(m.getMethodKey());
        d.setWeight(m.getWeight());
        d.setEvalObject(m.getEvalObject());
        d.setScoreType(m.getScoreType());
        d.setEvalSubjects(m.getEvalSubjects());
        d.setRubricTemplateId(m.getRubricTemplateId());
        d.setStandardName(m.getStandardName());
        d.setStandardMode(m.getStandardMode());
        d.setResourceConfig(m.getResourceConfig());
        d.setVersion(m.getVersion());
        d.setIsEnabled(m.getIsEnabled());
        List<TaskEvaluationMethodDto.EvalPoint> points = new ArrayList<>();
        for (PartnerEvalMapper.EvalPointRow r : evalMapper.selectEvalPoints(m.getId())) {
            TaskEvaluationMethodDto.EvalPoint ep = new TaskEvaluationMethodDto.EvalPoint();
            ep.setId(r.getId());
            ep.setConfigId(r.getConfigId());
            ep.setName(r.getName());
            ep.setDescription(r.getDescription());
            ep.setSubType(r.getSubType());
            ep.setTypes(parseStringList(r.getTypes()));
            ep.setWeight(r.getWeight());
            ep.setScoringMethod(r.getScoringMethod());
            ep.setGradeMapping(r.getGradeMapping());
            ep.setKnowledgePointIds(parseStringList(r.getKnowledgePointIds()));
            ep.setAbilityPointIds(parseStringList(r.getAbilityPointIds()));
            ep.setSortOrder(r.getSortOrder());
            points.add(ep);
        }
        d.setEvalPoints(points);
        List<TaskEvaluationMethodDto.ScoreRule> rules = new ArrayList<>();
        for (PartnerEvalMapper.ScoreRuleRow r : evalMapper.selectScoreRules(m.getId())) {
            TaskEvaluationMethodDto.ScoreRule sr = new TaskEvaluationMethodDto.ScoreRule();
            sr.setId(r.getId());
            sr.setConfigId(r.getConfigId());
            sr.setName(r.getName());
            sr.setDescription(r.getDescription());
            sr.setRule(r.getRule());
            sr.setWeight(r.getWeight());
            sr.setSortOrder(r.getSortOrder());
            rules.add(sr);
        }
        d.setScoreRules(rules);
        List<TaskEvaluationMethodDto.ReviewStep> steps = new ArrayList<>();
        for (PartnerEvalMapper.ReviewStepRow r : evalMapper.selectReviewSteps(m.getId())) {
            TaskEvaluationMethodDto.ReviewStep rs = new TaskEvaluationMethodDto.ReviewStep();
            rs.setId(r.getId());
            rs.setConfigId(r.getConfigId());
            rs.setLabel(r.getLabel());
            rs.setDescription(r.getDescription());
            rs.setEnabled(r.getEnabled());
            rs.setSubjectType(r.getSubjectType());
            rs.setAssignedUserIds(parseStringList(r.getAssignedUserIds()));
            rs.setWeight(r.getWeight());
            rs.setSortOrder(r.getSortOrder());
            steps.add(rs);
        }
        d.setReviewSteps(steps);
        return d;
    }

    private ListResponse<JobPositionAbilityBinding> listAbilityBindings(String tenantId, String positionId) {
        List<JobPositionAbilityBinding> rows = abilityBindingMapper.selectList(
            QueryBuilder.lambda(JobPositionAbilityBinding.class)
                .eq(JobPositionAbilityBinding::getTenantId, tenantId)
                .eq(JobPositionAbilityBinding::getCareerPositionId, positionId)
                .build());
        if (!rows.isEmpty()) {
            Set<String> apIds = new LinkedHashSet<>();
            for (JobPositionAbilityBinding b : rows) {
                if (b.getAbilityPointId() != null) {
                    apIds.add(b.getAbilityPointId());
                }
            }
            Map<String, String> names = abilityPointMapper.selectList(
                    QueryBuilder.lambda(JobAbilityPoint.class).in(JobAbilityPoint::getId, new ArrayList<>(apIds)).build())
                .stream().collect(Collectors.toMap(JobAbilityPoint::getId, JobAbilityPoint::getName, (a, b) -> a));
            rows.forEach(b -> b.setAbilityName(names.get(b.getAbilityPointId())));
        }
        return ListResponse.of(rows, rows.size());
    }

    // ===== 可见性 / 归属 =====

    private JobCareerPosition accessiblePosition(String enterpriseId, String id) {
        JobCareerPosition pos = positionMapper.selectById(id);
        if (pos == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        if (enterpriseId.equals(pos.getSourceEnterpriseId())) {
            return pos;
        }
        String grantTenantId = grantMapper.selectGrantTenantId(enterpriseId, "position", id);
        if (grantTenantId == null || !grantTenantId.equals(pos.getTenantId())) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        return pos;
    }

    private JobCareerPosition ownedPosition(String enterpriseId, String id) {
        JobCareerPosition pos = positionMapper.selectById(id);
        if (pos == null || !enterpriseId.equals(pos.getSourceEnterpriseId())) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        return pos;
    }

    private JobCareerPosition checkPositionWritable(String enterpriseId, String id) {
        JobCareerPosition pos = ownedPosition(enterpriseId, id);
        if (!EDITABLE_STATUSES.contains(pos.getStatus())) {
            throw new ApiException(409, "conflict", "当前状态不允许编辑或删除");
        }
        requireActiveLink(enterpriseId, pos.getTenantId());
        return pos;
    }

    private String ownedPositionTenant(String id) {
        String enterpriseId = resolveEnterpriseId();
        return accessiblePosition(enterpriseId, id).getTenantId();
    }

    private SceneScenario accessibleScenario(String enterpriseId, String id) {
        SceneScenario sc = scenarioMapper.selectById(id);
        if (sc == null) {
            throw new ApiException(404, "not_found", "场景方案不存在");
        }
        if (enterpriseId.equals(sc.getSourceEnterpriseId())) {
            return sc;
        }
        String grantTenantId = grantMapper.selectGrantTenantId(enterpriseId, "scenario", id);
        if (grantTenantId == null || sc.getTenantId() == null || !grantTenantId.equals(sc.getTenantId())) {
            throw new ApiException(404, "not_found", "场景方案不存在");
        }
        return sc;
    }

    private SceneScenario ownedScenario(String enterpriseId, String id) {
        SceneScenario sc = scenarioMapper.selectById(id);
        if (sc == null || sc.getTenantId() == null || !enterpriseId.equals(sc.getSourceEnterpriseId())) {
            throw new ApiException(404, "not_found", "场景方案不存在");
        }
        return sc;
    }

    private SceneScenario checkScenarioWritable(String enterpriseId, String id) {
        SceneScenario sc = ownedScenario(enterpriseId, id);
        if (!EDITABLE_STATUSES.contains(sc.getStatus())) {
            throw new ApiException(409, "conflict", "当前状态不允许编辑或删除");
        }
        requireActiveLink(enterpriseId, sc.getTenantId());
        return sc;
    }

    private String accessibleTaskTenant(String enterpriseId, String taskId) {
        SceneScenarioTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new ApiException(404, "not_found", "场景任务不存在");
        }
        SceneScenario sc = accessibleScenario(enterpriseId, task.getScenarioId());
        return sc.getTenantId();
    }

    private void resetToDraftPosition(String id, String tenantId) {
        String status = positionMapper.selectStatus(id);
        if (!"draft".equals(status)) {
            positionMapper.casTransition(id, tenantId, status, "draft");
        }
    }

    private void resetToDraftScenario(String id, String tenantId) {
        String status = scenarioMapper.selectStatus(id);
        if (!"draft".equals(status)) {
            scenarioMapper.casTransition(id, tenantId, status, "draft");
        }
    }

    private void requireActiveLink(String enterpriseId, String schoolTenantId) {
        String status = linkMapper.selectStatusByEnterprise(enterpriseId, schoolTenantId);
        if (!"active".equals(status)) {
            throw new ApiException(403, "forbidden", "目标学校与本企业无生效中的合作关系");
        }
    }

    private void requireSchoolAccess(String schoolTenantId) {
        requireActiveLink(resolveEnterpriseId(), schoolTenantId);
    }

    private List<String> fetchPositionMajorIds(String positionId) {
        return positionMapper.selectPositionMajorIds(List.of(positionId)).stream()
            .map(PartnerPositionMapper.PosMajorRow::getMajorId).toList();
    }

    private String resolveEnterpriseId() {
        String tenantId = systemGuard.requireTenant();
        PartnerEnterprise enterprise = enterpriseMapper.selectList(
            QueryBuilder.lambda(PartnerEnterprise.class).eq(PartnerEnterprise::getTenantId, tenantId).build())
            .stream().findFirst().orElse(null);
        if (enterprise == null) {
            throw new ApiException(404, "not_found", "企业不存在");
        }
        return enterprise.getId();
    }

    private String generateUniqueCode(String prefix, String tenantId,
                                      java.util.function.BiFunction<String, String, Boolean> existsFn) {
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 10; i++) {
            StringBuilder sb = new StringBuilder(prefix).append('-');
            for (int j = 0; j < 8; j++) {
                sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (!Boolean.TRUE.equals(existsFn.apply(tenantId, code))) {
                return code;
            }
        }
        throw new ApiException(500, "internal_error", "生成编码失败");
    }

    private String evalDataToJson(Map<String, Object> evalData) {
        return toJson(evalData);
    }

    private String toJson(Object o) {
        if (o == null) {
            return "{}";
        }
        try {
            return MAPPER.writeValueAsString(o);
        } catch (Exception e) {
            return "{}";
        }
    }

    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> v = MAPPER.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {
            });
            return v == null ? new ArrayList<>() : v;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private long clampLimit(long limit) {
        if (limit <= 0) {
            return 20;
        }
        return Math.min(limit, 200);
    }

    // ===== 请求项包装（避免冗长泛型，直接展开） =====

    private List<PartnerDtosResponsibilityItem> wrapResponsibilities(SaveFullPositionRequest req) {
        return req.getResponsibilities() == null ? List.of() : req.getResponsibilities().stream()
            .map(r -> new PartnerDtosResponsibilityItem(r.getId(), r.getName(), r.getDescription())).toList();
    }

    private List<PartnerDtosCertificateItem> wrapCertificates(SaveFullPositionRequest req) {
        return req.getCertificates() == null ? List.of() : req.getCertificates().stream()
            .map(c -> new PartnerDtosCertificateItem(c.getId(), c.getName(), c.getUrl(), c.getDescription(), c.getImage())).toList();
    }

    private List<PartnerDtosAbilityBindingItem> wrapAbilityBindings(SaveFullPositionRequest req) {
        return req.getAbilityBindings() == null ? List.of() : req.getAbilityBindings().stream()
            .map(b -> new PartnerDtosAbilityBindingItem(b.getId(), b.getResponsibilityId(), b.getSource(),
                b.getPublicAbilityId(), b.getAbilityPointId(), b.getName(), b.getLevel(), b.getRubricDescription(),
                b.getDescription(), b.getAttributes(), b.getDomain())).toList();
    }

    private List<PartnerDtosAbilityDomainItem> wrapAbilityDomains(SaveFullPositionRequest req) {
        return req.getAbilityDomains() == null ? List.of() : req.getAbilityDomains().stream()
            .map(ad -> new PartnerDtosAbilityDomainItem(ad.getId(), ad.getName(), ad.getDescription(), ad.getBindingIds())).toList();
    }

    private List<PartnerDtosEvalPointInput> wrapEvalPoints(MethodInput m) {
        return m.getEvalPoints() == null ? List.of() : m.getEvalPoints().stream()
            .map(ep -> new PartnerDtosEvalPointInput(ep.getName(), ep.getDescription(), ep.getSubType(), ep.getTypes(),
                ep.getWeight(), ep.getScoringMethod(), ep.getGradeMapping(), ep.getKnowledgePointIds(),
                ep.getAbilityPointIds(), ep.getSortOrder())).toList();
    }

    private List<PartnerDtosScoreRuleInput> wrapScoreRules(MethodInput m) {
        return m.getScoreRules() == null ? List.of() : m.getScoreRules().stream()
            .map(sr -> new PartnerDtosScoreRuleInput(sr.getName(), sr.getDescription(), sr.getRule(), sr.getWeight(),
                sr.getSortOrder())).toList();
    }

    private List<PartnerDtosReviewStepInput> wrapReviewSteps(MethodInput m) {
        return m.getReviewSteps() == null ? List.of() : m.getReviewSteps().stream()
            .map(rs -> new PartnerDtosReviewStepInput(rs.getLabel(), rs.getDescription(), rs.getEnabled(),
                rs.getSubjectType(), rs.getAssignedUserIds(), rs.getWeight(), rs.getSortOrder())).toList();
    }

    // ===== 轻量请求项（@Data @AllArgsConstructor 生成 getter 与全参构造） =====

    @lombok.Data
    @lombok.AllArgsConstructor
    private static class PartnerDtosResponsibilityItem {
        private String id;
        private String name;
        private String description;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    private static class PartnerDtosCertificateItem {
        private String id;
        private String name;
        private String url;
        private String description;
        private String image;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    private static class PartnerDtosAbilityBindingItem {
        private String id;
        private String responsibilityId;
        private String source;
        private String publicAbilityId;
        private String abilityPointId;
        private String name;
        private String level;
        private String rubricDescription;
        private String description;
        private List<String> attributes;
        private String domain;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    private static class PartnerDtosAbilityDomainItem {
        private String id;
        private String name;
        private String description;
        private List<String> bindingIds;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    private static class PartnerDtosEvalPointInput {
        private String name;
        private String description;
        private String subType;
        private List<String> types;
        private BigDecimal weight;
        private String scoringMethod;
        private List<Object> gradeMapping;
        private List<String> knowledgePointIds;
        private List<String> abilityPointIds;
        private Integer sortOrder;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    private static class PartnerDtosScoreRuleInput {
        private String name;
        private String description;
        private String rule;
        private BigDecimal weight;
        private Integer sortOrder;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    private static class PartnerDtosReviewStepInput {
        private String label;
        private String description;
        private Boolean enabled;
        private String subjectType;
        private List<String> assignedUserIds;
        private BigDecimal weight;
        private Integer sortOrder;
    }
}
