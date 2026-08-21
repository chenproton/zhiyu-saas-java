package org.dromara.zhiyu.service.impl.affairs;

import lombok.RequiredArgsConstructor;
import org.dromara.common.mybatis.core.query.LambdaQueryBuilder;
import org.dromara.common.mybatis.core.query.QueryBuilder;
import org.dromara.zhiyu.core.page.ListResponse;
import org.dromara.zhiyu.core.security.TenantContext;
import org.dromara.zhiyu.core.web.ApiException;
import org.dromara.zhiyu.domain.affairs.TeachingPlan;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TermDto;
import org.dromara.zhiyu.domain.dto.affairs.AffairsDtos.TermPayload;
import org.dromara.zhiyu.domain.affairs.ScheduleEntry;
import org.dromara.zhiyu.domain.affairs.Term;
import org.dromara.zhiyu.mapper.affairs.AffairsScheduleMapper;
import org.dromara.zhiyu.mapper.affairs.TeachingPlanMapper;
import org.dromara.zhiyu.mapper.affairs.TermMapper;
import org.dromara.zhiyu.service.affairs.ITermService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * 学期服务实现（对齐 Go 语义：列表 search 名称 + isCurrent 过滤，start_date DESC 排序；
 * 置当前时清空其他学期）。
 *
 * @author zhiyu
 */
@RequiredArgsConstructor
@Service
public class TermServiceImpl implements ITermService {

    private final TermMapper termMapper;
    private final TeachingPlanMapper teachingPlanMapper;
    private final AffairsScheduleMapper scheduleMapper;

    @Override
    public ListResponse<TermDto> list(String search, String isCurrent, long limit, long offset) {
        String tenantId = requireTenant();
        long safeLimit = clampLimit(limit);
        long safeOffset = Math.max(offset, 0);

        LambdaQueryBuilder<Term> wrapper = QueryBuilder.lambda(Term.class)
            .eq(Term::getTenantId, tenantId)
            .likeIfText(Term::getName, search);
        if ("true".equals(isCurrent)) {
            wrapper.eq(Term::getIsCurrent, true);
        }
        long total = termMapper.selectCount(wrapper.build());
        wrapper.orderByDesc(Term::getStartDate)
            .last("LIMIT " + safeLimit + " OFFSET " + safeOffset);
        List<Term> rows = termMapper.selectList(wrapper.build());
        return ListResponse.of(rows.stream().map(this::toDto).toList(), total);
    }

    @Override
    public TermDto get(String id) {
        return toDto(fetchOwned(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TermDto create(TermPayload p) {
        String tenantId = requireTenant();
        validate(p);
        int weeks = p.getWeeksCount() == null || p.getWeeksCount() <= 0 ? 16 : p.getWeeksCount();
        boolean isCurrent = Boolean.TRUE.equals(p.getIsCurrent());
        if (isCurrent) {
            termMapper.clearCurrent(tenantId);
        }
        Term term = new Term();
        term.setTenantId(tenantId);
        term.setName(p.getName());
        term.setStartDate(parseDate(p.getStartDate()));
        term.setEndDate(parseDate(p.getEndDate()));
        term.setWeeksCount(weeks);
        term.setIsCurrent(isCurrent);
        termMapper.insert(term);
        return toDto(fetchOwned(term.getId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TermDto update(String id, TermPayload p) {
        String tenantId = requireTenant();
        Term existing = fetchOwned(id);
        validate(p);
        int weeks = p.getWeeksCount() == null || p.getWeeksCount() <= 0 ? 16 : p.getWeeksCount();
        boolean isCurrent = p.getIsCurrent() != null ? p.getIsCurrent() : Boolean.TRUE.equals(existing.getIsCurrent());
        if (isCurrent) {
            termMapper.clearCurrentExcept(tenantId, id);
        }
        existing.setName(p.getName());
        existing.setStartDate(parseDate(p.getStartDate()));
        existing.setEndDate(parseDate(p.getEndDate()));
        existing.setWeeksCount(weeks);
        existing.setIsCurrent(isCurrent);
        termMapper.updateById(existing);
        return toDto(fetchOwned(id));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String delete(String id) {
        requireTenant();
        fetchOwned(id);
        long refs = teachingPlanMapper.selectCount(
                QueryBuilder.lambda(TeachingPlan.class).eq(TeachingPlan::getTermId, id).build())
            + scheduleMapper.selectCount(
                QueryBuilder.lambda(ScheduleEntry.class).eq(ScheduleEntry::getTermId, id).build());
        if (refs > 0) {
            throw new ApiException(409, "conflict", "该学期已被教学计划或排课引用，无法删除");
        }
        termMapper.deleteById(id);
        return id;
    }

    // ---------- 工具 ----------

    private void validate(TermPayload p) {
        if (p.getName() == null || p.getName().isEmpty()
            || p.getStartDate() == null || p.getStartDate().isEmpty()
            || p.getEndDate() == null || p.getEndDate().isEmpty()) {
            throw new ApiException(400, "bad_request", "缺少必填字段");
        }
    }

    private LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw new ApiException(400, "bad_request", "日期格式应为 YYYY-MM-DD");
        }
    }

    private Term fetchOwned(String id) {
        String tenantId = requireTenant();
        Term term = termMapper.selectOne(QueryBuilder.lambda(Term.class)
            .eq(Term::getId, id).eq(Term::getTenantId, tenantId).build());
        if (term == null) {
            throw new ApiException(404, "not_found", "学期不存在");
        }
        return term;
    }

    private TermDto toDto(Term t) {
        TermDto dto = new TermDto();
        dto.setId(t.getId());
        dto.setName(t.getName());
        dto.setStartDate(t.getStartDate() == null ? null : t.getStartDate().toString());
        dto.setEndDate(t.getEndDate() == null ? null : t.getEndDate().toString());
        dto.setWeeksCount(t.getWeeksCount());
        dto.setIsCurrent(t.getIsCurrent());
        dto.setCreatedAt(t.getCreatedAt());
        return dto;
    }

    private long clampLimit(long limit) {
        if (limit <= 0) {
            return 50;
        }
        return Math.min(limit, 200);
    }

    private String requireTenant() {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new ApiException(403, "forbidden", "缺少租户信息");
        }
        return tenantId;
    }
}
