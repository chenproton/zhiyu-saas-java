package org.dromara.zhiyu.service.impl.job;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.util.ZhiyuStringUtils;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionAbilityBindingDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionAbilityRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionCertificateDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionCertificateRequest;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionResponsibilityDto;
import org.dromara.zhiyu.domain.dto.job.JobDtos.PositionResponsibilityRequest;
import org.dromara.zhiyu.domain.job.JobAbilityPoint;
import org.dromara.zhiyu.domain.job.JobPositionAbilityBinding;
import org.dromara.zhiyu.domain.job.JobPositionCertificate;
import org.dromara.zhiyu.domain.job.JobPositionResponsibility;
import org.dromara.zhiyu.mapper.job.JobAbilityPointMapper;
import org.dromara.zhiyu.mapper.job.JobCareerPositionMapper;
import org.dromara.zhiyu.mapper.job.JobPositionAbilityBindingMapper;
import org.dromara.zhiyu.mapper.job.JobPositionCertificateMapper;
import org.dromara.zhiyu.mapper.job.JobPositionResponsibilityMapper;
import org.dromara.zhiyu.service.system.SystemGuard;
import org.dromara.zhiyu.service.job.IJobPositionConfigService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 岗位配置服务实现（对齐 Go position_config.go + position_ability_handler.go +
 * position_responsibility_handler.go + position_certificate_handler.go 语义）。
 *
 * <p>租户安全要点：职责/证书无 tenant_id 归属语义，经关联岗位做「间接归属」校验
 * （不匹配按不存在处理 404）；能力绑定经岗位租户校验（403）；创建证书时
 * find-or-create 证书库条目（tenant_id+name 唯一）。</p>
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class JobPositionConfigServiceImpl implements IJobPositionConfigService {

    private final SystemGuard systemGuard;
    private final JobPositionAbilityBindingMapper bindingMapper;
    private final JobPositionResponsibilityMapper responsibilityMapper;
    private final JobPositionCertificateMapper certificateMapper;
    private final JobCareerPositionMapper positionMapper;
    private final JobAbilityPointMapper abilityPointMapper;

    // ---------- 岗位-能力绑定 ----------

    @Override
    public ListResponse<PositionAbilityBindingDto> listBindings(String careerPositionId, String responsibilityId,
                                                                long limit, long offset) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<JobPositionAbilityBinding> wrapper = QueryBuilder.lambda(JobPositionAbilityBinding.class)
            .eq(JobPositionAbilityBinding::getTenantId, tenantId)
            .eqIfText(JobPositionAbilityBinding::getCareerPositionId, careerPositionId)
            .eqIfText(JobPositionAbilityBinding::getResponsibilityId, responsibilityId);
        long total = bindingMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(JobPositionAbilityBinding::getId)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<JobPositionAbilityBinding> rows = bindingMapper.selectList(wrapper.build());
        List<PositionAbilityBindingDto> items = new ArrayList<>(rows.size());
        for (JobPositionAbilityBinding b : rows) {
            items.add(toBindingDto(b, resolveAbilityName(b.getAbilityPointId(), tenantId)));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public PositionAbilityBindingDto createBinding(PositionAbilityRequest req) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()
            || req.getResponsibilityId() == null || req.getResponsibilityId().isEmpty()
            || req.getAbilityPointId() == null || req.getAbilityPointId().isEmpty()
            || req.getRequiredLevel() == null || req.getRequiredLevel().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        String source = req.getSource() == null || req.getSource().isEmpty() ? "custom" : req.getSource();
        // 校验岗位归属当前租户，防止跨租户写绑定
        String posTenant = positionMapper.selectTenantId(req.getCareerPositionId());
        if (posTenant == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        verifyTenantOwnership(posTenant);
        // 职责必须属于当前岗位；能力点必须属于当前租户（防跨租户引用）
        JobPositionResponsibility resp = responsibilityMapper.selectById(req.getResponsibilityId());
        if (resp == null || !req.getCareerPositionId().equals(resp.getCareerPositionId())) {
            throw new ApiException(404, "not_found", "职责不存在");
        }
        if (!abilityExistsInTenant(req.getAbilityPointId(), tenantId)) {
            throw new ApiException(404, "not_found", "能力点不存在");
        }
        JobPositionAbilityBinding entity = new JobPositionAbilityBinding();
        entity.setTenantId(tenantId);
        entity.setCareerPositionId(req.getCareerPositionId());
        entity.setResponsibilityId(req.getResponsibilityId());
        entity.setAbilityPointId(req.getAbilityPointId());
        entity.setSource(source);
        entity.setDomain(ZhiyuStringUtils.blankToNull(req.getDomain()));
        entity.setRequiredLevel(req.getRequiredLevel());
        entity.setRubricDescription(ZhiyuStringUtils.blankToNull(req.getRubricDescription()));
        entity.setAttributes(coalesce(req.getAttributes()));
        entity.setWeight(req.getWeight());
        bindingMapper.insert(entity);
        JobPositionAbilityBinding saved = bindingMapper.selectBindingById(entity.getId());
        if (saved == null) {
            throw new ApiException(500, "internal_error", "创建绑定失败");
        }
        return toBindingDto(saved, resolveAbilityName(saved.getAbilityPointId(), tenantId));
    }

    @Override
    public PositionAbilityBindingDto updateBinding(String id, PositionAbilityRequest req) {
        systemGuard.requireUser();
        JobPositionAbilityBinding binding = bindingMapper.selectBindingById(id);
        if (binding == null) {
            throw new ApiException(404, "not_found", "绑定不存在");
        }
        String positionTenantId = positionMapper.selectTenantId(binding.getCareerPositionId());
        if (positionTenantId == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        verifyTenantOwnership(positionTenantId);
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()
            || req.getResponsibilityId() == null || req.getResponsibilityId().isEmpty()
            || req.getAbilityPointId() == null || req.getAbilityPointId().isEmpty()
            || req.getRequiredLevel() == null || req.getRequiredLevel().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        if (!req.getCareerPositionId().equals(binding.getCareerPositionId())) {
            String newPosTenant = positionMapper.selectTenantId(req.getCareerPositionId());
            if (newPosTenant == null) {
                throw new ApiException(404, "not_found", "岗位不存在");
            }
            verifyTenantOwnership(newPosTenant);
        }
        // 部分更新兜底：非必填字段未携带回退已有值（防全列覆盖清空 source/domain/weight 等）
        String source = req.getSource() == null || req.getSource().isEmpty() ? binding.getSource() : req.getSource();
        String domain = req.getDomain() != null ? req.getDomain() : binding.getDomain();
        String rubric = req.getRubricDescription() != null ? req.getRubricDescription() : binding.getRubricDescription();
        List<String> attributes = req.getAttributes() != null ? req.getAttributes() : binding.getAttributes();
        java.math.BigDecimal weight = req.getWeight() != null ? req.getWeight() : binding.getWeight();

        JobPositionAbilityBinding update = new JobPositionAbilityBinding();
        update.setId(id);
        update.setTenantId(binding.getTenantId());
        update.setCareerPositionId(req.getCareerPositionId());
        update.setResponsibilityId(req.getResponsibilityId());
        update.setAbilityPointId(req.getAbilityPointId());
        update.setSource(source);
        update.setDomain(ZhiyuStringUtils.blankToNull(domain));
        update.setRequiredLevel(req.getRequiredLevel());
        update.setRubricDescription(ZhiyuStringUtils.blankToNull(rubric));
        update.setAttributes(coalesce(attributes));
        update.setWeight(weight);
        bindingMapper.updateById(update);
        JobPositionAbilityBinding saved = bindingMapper.selectBindingById(id);
        if (saved == null) {
            throw new ApiException(500, "internal_error", "更新绑定失败");
        }
        return toBindingDto(saved, resolveAbilityName(saved.getAbilityPointId(), systemGuard.requireTenant()));
    }

    @Override
    public String deleteBinding(String id) {
        systemGuard.requireUser();
        JobPositionAbilityBinding binding = bindingMapper.selectBindingById(id);
        if (binding == null) {
            throw new ApiException(404, "not_found", "绑定不存在");
        }
        String positionTenantId = positionMapper.selectTenantId(binding.getCareerPositionId());
        if (positionTenantId == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        verifyTenantOwnership(positionTenantId);
        bindingMapper.deleteById(id);
        return id;
    }

    // ---------- 岗位职责 ----------

    @Override
    public ListResponse<PositionResponsibilityDto> listResponsibilities(String careerPositionId, long limit, long offset) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        LambdaQueryBuilder<JobPositionResponsibility> wrapper = QueryBuilder.lambda(JobPositionResponsibility.class)
            .eq(JobPositionResponsibility::getTenantId, tenantId)
            .eqIfText(JobPositionResponsibility::getCareerPositionId, careerPositionId);
        long total = responsibilityMapper.selectCount(wrapper.build());
        wrapper.orderByAsc(JobPositionResponsibility::getSortOrder)
            .orderByAsc(JobPositionResponsibility::getId)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<JobPositionResponsibility> rows = responsibilityMapper.selectList(wrapper.build());
        List<PositionResponsibilityDto> items = new ArrayList<>(rows.size());
        for (JobPositionResponsibility r : rows) {
            items.add(toResponsibilityDto(r));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public PositionResponsibilityDto getResponsibility(String id) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        JobPositionResponsibility item = responsibilityMapper.selectById(id);
        if (item == null) {
            throw new ApiException(404, "not_found", "岗位职责不存在");
        }
        // 间接租户归属校验：实体无 tenant_id 归属语义，经关联岗位确认租户
        checkIndirectTenant(item.getCareerPositionId(), tenantId);
        return toResponsibilityDto(item);
    }

    @Override
    public PositionResponsibilityDto createResponsibility(PositionResponsibilityRequest req) {
        systemGuard.requireUser();
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()
            || req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 创建时校验岗位归属（403）
        String positionTenantId = positionMapper.selectTenantId(req.getCareerPositionId());
        if (positionTenantId == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        verifyTenantOwnership(positionTenantId);
        JobPositionResponsibility entity = new JobPositionResponsibility();
        entity.setTenantId(positionTenantId);
        entity.setCareerPositionId(req.getCareerPositionId());
        entity.setName(req.getName());
        entity.setDescription(ZhiyuStringUtils.blankToNull(req.getDescription()));
        entity.setSortOrder(req.getSortOrder() == null ? 0 : req.getSortOrder());
        responsibilityMapper.insert(entity);
        return toResponsibilityDto(entity);
    }

    @Override
    public PositionResponsibilityDto updateResponsibility(String id, PositionResponsibilityRequest req) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        JobPositionResponsibility existing = responsibilityMapper.selectById(id);
        if (existing == null) {
            throw new ApiException(404, "not_found", "岗位职责不存在");
        }
        checkIndirectTenant(existing.getCareerPositionId(), tenantId);
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()
            || req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 部分更新兜底：未携带字段回退已有值（防全列覆盖清空 description/sortOrder）
        String careerPositionId = req.getCareerPositionId();
        String name = req.getName();
        String description = req.getDescription() != null ? req.getDescription() : existing.getDescription();
        int sortOrder = req.getSortOrder() != null && req.getSortOrder() != 0 ? req.getSortOrder()
            : (existing.getSortOrder() == null ? 0 : existing.getSortOrder());
        // 校验目标岗位属于当前租户（职责移动路径），防止跨租户写
        if (!careerPositionId.equals(existing.getCareerPositionId())) {
            String posTenant = positionMapper.selectTenantId(careerPositionId);
            if (posTenant == null || !posTenant.equals(tenantId)) {
                throw new ApiException(404, "not_found", "岗位职责不存在");
            }
        }
        JobPositionResponsibility update = new JobPositionResponsibility();
        update.setId(id);
        update.setTenantId(tenantId);
        update.setCareerPositionId(careerPositionId);
        update.setName(name);
        update.setDescription(ZhiyuStringUtils.blankToNull(description));
        update.setSortOrder(sortOrder);
        responsibilityMapper.updateById(update);
        JobPositionResponsibility saved = responsibilityMapper.selectById(id);
        return toResponsibilityDto(saved);
    }

    @Override
    public String deleteResponsibility(String id) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        JobPositionResponsibility existing = responsibilityMapper.selectById(id);
        if (existing == null) {
            throw new ApiException(404, "not_found", "岗位职责不存在");
        }
        checkIndirectTenant(existing.getCareerPositionId(), tenantId);
        responsibilityMapper.deleteById(id);
        return id;
    }

    // ---------- 岗位证书 ----------

    @Override
    public ListResponse<PositionCertificateDto> listCertificates(String careerPositionId, long limit, long offset) {
        systemGuard.requireUser();
        if (careerPositionId == null || careerPositionId.isEmpty()) {
            return ListResponse.of(new ArrayList<>(), 0);
        }
        // 校验岗位归属当前租户，防止枚举他租户岗位证书
        String posTenant = positionMapper.selectTenantId(careerPositionId);
        if (posTenant == null) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
        verifyTenantOwnership(posTenant);
        String tenantId = systemGuard.requireTenant();
        long safeLimit = systemGuard.clampLimit(limit, 50);
        long safeOffset = Math.max(offset, 0);
        long total = certificateMapper.countCertificates(tenantId, careerPositionId);
        List<JobPositionCertificate> rows = certificateMapper.selectCertificates(tenantId, careerPositionId,
            (int) safeLimit, (int) safeOffset);
        List<PositionCertificateDto> items = new ArrayList<>(rows.size());
        for (JobPositionCertificate c : rows) {
            items.add(toCertificateDto(c));
        }
        return ListResponse.of(items, total);
    }

    @Override
    public PositionCertificateDto getCertificate(String id) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        JobPositionCertificate item = checkCertTenant(id, tenantId);
        return toCertificateDto(item);
    }

    @Override
    public PositionCertificateDto createCertificate(PositionCertificateRequest req) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()
            || req.getName() == null || req.getName().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 校验证书挂载的岗位属于当前租户
        checkPositionTenant(req.getCareerPositionId(), tenantId);
        // find-or-create 证书库条目后绑定
        String libraryId = findOrCreateLibrary(tenantId, req.getName(), req.getUrl(),
            req.getDescription(), req.getImageUrl());
        String certId = UUID.randomUUID().toString();
        certificateMapper.insertPositionCertificate(certId, tenantId, req.getCareerPositionId(), libraryId);
        JobPositionCertificate saved = certificateMapper.selectCertificateById(certId);
        if (saved == null) {
            throw new ApiException(500, "internal_error", "创建证书失败");
        }
        return toCertificateDto(saved);
    }

    @Override
    public PositionCertificateDto updateCertificate(String id, PositionCertificateRequest req) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        JobPositionCertificate existing = checkCertTenant(id, tenantId);
        if (req.getCareerPositionId() == null || req.getCareerPositionId().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
        // 校验改绑的目标岗位同样属于当前租户
        checkPositionTenant(req.getCareerPositionId(), tenantId);
        String libraryId = null;
        if (req.getName() != null && !req.getName().isEmpty()) {
            // 提供名称时 find-or-create 证书库并重绑
            libraryId = findOrCreateLibrary(tenantId, req.getName(), req.getUrl(),
                req.getDescription(), req.getImageUrl());
        }
        certificateMapper.updatePositionCertificate(id, req.getCareerPositionId(), libraryId);
        JobPositionCertificate saved = certificateMapper.selectCertificateById(id);
        if (saved == null) {
            throw new ApiException(500, "internal_error", "更新证书失败");
        }
        return toCertificateDto(saved);
    }

    @Override
    public String deleteCertificate(String id) {
        systemGuard.requireUser();
        String tenantId = systemGuard.requireTenant();
        checkCertTenant(id, tenantId);
        certificateMapper.deletePositionCertificate(id);
        return id;
    }

    // ---------- 工具 ----------

    /** 校验证书所属岗位归属当前租户（不匹配按不存在处理）。 */
    private JobPositionCertificate checkCertTenant(String id, String tenantId) {
        JobPositionCertificate item = certificateMapper.selectCertificateById(id);
        if (item == null) {
            throw new ApiException(404, "not_found", "证书不存在");
        }
        String posTenant = positionMapper.selectTenantId(item.getCareerPositionId());
        if (posTenant == null || !posTenant.equals(tenantId)) {
            throw new ApiException(404, "not_found", "证书不存在");
        }
        return item;
    }

    /** 校验岗位归属当前租户。 */
    private void checkPositionTenant(String careerPositionId, String tenantId) {
        String posTenant = positionMapper.selectTenantId(careerPositionId);
        if (posTenant == null || !posTenant.equals(tenantId)) {
            throw new ApiException(404, "not_found", "岗位不存在");
        }
    }

    /** 间接租户归属校验（职责无 tenant 归属语义，经关联岗位确认）。 */
    private void checkIndirectTenant(String careerPositionId, String tenantId) {
        String posTenant = positionMapper.selectTenantId(careerPositionId);
        if (posTenant == null || !posTenant.equals(tenantId)) {
            throw new ApiException(404, "not_found", "岗位职责不存在");
        }
    }

    /** find-or-create 证书库条目（tenant_id+name 唯一；对齐 Go findOrCreateLibrary）。 */
    private String findOrCreateLibrary(String tenantId, String name, String url, String description, String imageUrl) {
        String libId = certificateMapper.selectLibraryId(tenantId, name);
        if (libId != null) {
            return libId;
        }
        String newId = UUID.randomUUID().toString();
        certificateMapper.insertLibrary(newId, tenantId, name, ZhiyuStringUtils.blankToNull(url), ZhiyuStringUtils.blankToNull(description),
            ZhiyuStringUtils.blankToNull(imageUrl));
        String saved = certificateMapper.selectLibraryId(tenantId, name);
        return saved == null ? newId : saved;
    }

    private boolean abilityExistsInTenant(String abilityPointId, String tenantId) {
        JobAbilityPoint point = abilityPointMapper.selectById(abilityPointId);
        return point != null && tenantId.equals(point.getTenantId());
    }

    private String resolveAbilityName(String abilityPointId, String tenantId) {
        if (abilityPointId == null || abilityPointId.isEmpty()) {
            return null;
        }
        JobAbilityPoint point = abilityPointMapper.selectById(abilityPointId);
        return point == null ? null : point.getName();
    }

    private PositionAbilityBindingDto toBindingDto(JobPositionAbilityBinding b, String abilityName) {
        PositionAbilityBindingDto dto = new PositionAbilityBindingDto();
        dto.setId(b.getId());
        dto.setCareerPositionId(b.getCareerPositionId());
        dto.setResponsibilityId(b.getResponsibilityId());
        dto.setAbilityPointId(b.getAbilityPointId());
        dto.setAbilityName(abilityName);
        dto.setSource(b.getSource());
        dto.setDomain(b.getDomain());
        dto.setRequiredLevel(b.getRequiredLevel());
        dto.setRubricDescription(b.getRubricDescription());
        dto.setAttributes(b.getAttributes());
        dto.setWeight(b.getWeight());
        return dto;
    }

    private PositionResponsibilityDto toResponsibilityDto(JobPositionResponsibility r) {
        PositionResponsibilityDto dto = new PositionResponsibilityDto();
        dto.setId(r.getId());
        dto.setCareerPositionId(r.getCareerPositionId());
        dto.setName(r.getName());
        dto.setDescription(r.getDescription());
        dto.setSortOrder(r.getSortOrder());
        return dto;
    }

    private PositionCertificateDto toCertificateDto(JobPositionCertificate c) {
        PositionCertificateDto dto = new PositionCertificateDto();
        dto.setId(c.getId());
        dto.setCareerPositionId(c.getCareerPositionId());
        dto.setCertificateLibraryId(c.getCertificateLibraryId());
        dto.setName(c.getName());
        dto.setUrl(c.getUrl());
        dto.setDescription(c.getDescription());
        dto.setImageUrl(c.getImageUrl());
        return dto;
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

    private List<String> coalesce(List<String> list) {
        return list == null ? List.of() : list;
    }
}
