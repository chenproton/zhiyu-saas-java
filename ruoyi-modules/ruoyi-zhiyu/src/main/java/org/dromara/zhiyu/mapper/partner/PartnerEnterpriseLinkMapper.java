package org.dromara.zhiyu.mapper.partner;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.partner.PartnerEnterpriseLink;
import org.dromara.zhiyu.domain.dto.partner.PartnerDtos.School;

import java.util.List;

/**
 * 合作关联 Mapper（alliance_enterprise_links 表，Go→Java 迁移）。
 *
 * @author zhiyu
 */
public interface PartnerEnterpriseLinkMapper extends BaseMapperPlus<PartnerEnterpriseLink, PartnerEnterpriseLink> {

    /** 企业侧合作学校反向视图（link + 学校名称）。 */
    @Select("SELECT l.id AS linkId, l.tenant_id AS tenantId, t.name AS schoolName, l.relation_type AS relationType,"
        + " l.status AS status, l.rating AS rating, l.enterprise_type AS enterpriseType, l.is_public AS isPublic,"
        + " l.created_at AS createdAt"
        + " FROM alliance_enterprise_links l"
        + " JOIN partner_enterprises e ON e.id = l.enterprise_id"
        + " JOIN tenants t ON t.id = l.tenant_id"
        + " WHERE e.tenant_id = #{enterpriseTenantId} ORDER BY t.name")
    List<School> listSchools(@Param("enterpriseTenantId") String enterpriseTenantId);

    /** 查询企业与指定学校租户的合作关联视图（无关联返回 null）。 */
    @Select("SELECT l.id AS linkId, l.tenant_id AS tenantId, t.name AS schoolName, l.relation_type AS relationType,"
        + " l.status AS status, l.rating AS rating, l.enterprise_type AS enterpriseType, l.is_public AS isPublic,"
        + " l.created_at AS createdAt"
        + " FROM alliance_enterprise_links l"
        + " JOIN partner_enterprises e ON e.id = l.enterprise_id"
        + " JOIN tenants t ON t.id = l.tenant_id"
        + " WHERE e.tenant_id = #{enterpriseTenantId} AND l.tenant_id = #{schoolTenantId} LIMIT 1")
    School getSchool(@Param("enterpriseTenantId") String enterpriseTenantId,
                     @Param("schoolTenantId") String schoolTenantId);

    /** 更新企业与指定学校合作关联的 status（流转校验在 service 层）。 */
    @Update("UPDATE alliance_enterprise_links SET status = #{status}, updated_at = NOW()"
        + " WHERE tenant_id = #{schoolTenantId}"
        + " AND enterprise_id = (SELECT id FROM partner_enterprises WHERE tenant_id = #{enterpriseTenantId})")
    int updateSchoolStatus(@Param("enterpriseTenantId") String enterpriseTenantId,
                           @Param("schoolTenantId") String schoolTenantId, @Param("status") String status);

    /** 企业合作学校数（服务台 schoolCount，对齐 Go CountByEnterpriseTenant）。 */
    @Select("SELECT COUNT(*) FROM alliance_enterprise_links WHERE enterprise_id = (SELECT id FROM partner_enterprises WHERE tenant_id = #{enterpriseTenantId})")
    long countByEnterpriseTenant(@Param("enterpriseTenantId") String enterpriseTenantId);

    /** 近 months 个月每月新增合作学校数（服务台柱状图）。 */
    @Select("SELECT to_char(d, 'YYYY-MM') AS month,"
        + " COALESCE((SELECT COUNT(*) FROM alliance_enterprise_links l"
        + "   JOIN partner_enterprises e ON e.id = l.enterprise_id"
        + "   WHERE e.tenant_id = #{enterpriseTenantId}"
        + "   AND date_trunc('month', l.created_at) = date_trunc('month', d)), 0) AS count"
        + " FROM generate_series(date_trunc('month', NOW()) - make_interval(months => #{months} - 1),"
        + " date_trunc('month', NOW()), '1 month') d ORDER BY month")
    List<MonthCountRow> countMonthlyLinks(@Param("enterpriseTenantId") String enterpriseTenantId,
                                          @Param("months") int months);

    /** 月计数行。 */
    class MonthCountRow {
        private String month;
        private long count;

        public String getMonth() {
            return month;
        }

        public void setMonth(String month) {
            this.month = month;
        }

        public long getCount() {
            return count;
        }

        public void setCount(long count) {
            this.count = count;
        }
    }

    /** 直接按企业 ID 查询 link status（requireActiveLink 用）。 */
    @Select("SELECT status FROM alliance_enterprise_links WHERE enterprise_id = #{enterpriseId} AND tenant_id = #{schoolTenantId} LIMIT 1")
    String selectStatusByEnterprise(@Param("enterpriseId") String enterpriseId,
                                    @Param("schoolTenantId") String schoolTenantId);
}
