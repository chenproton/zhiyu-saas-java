package org.dromara.zhiyu.mapper.alliance;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AllianceSchoolInfo;

/**
 * 联盟前台公开统计 Mapper（Go store/alliance_enterprise_store.go GetPublicStats 语义）。
 *
 * @author zhiyu
 */
public interface AllianceStatsMapper extends BaseMapperPlus<AllianceSchoolInfo, AllianceSchoolInfo> {

    @Select("SELECT COUNT(*) FROM partner_enterprises pe WHERE pe.enable_public = true AND EXISTS ("
        + " SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + " AND l.is_public = true AND l.status != 'terminated')")
    int countPublicEnterprisesByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT COUNT(*) FROM partner_enterprises WHERE enable_public = true")
    int countPublicEnterprisesGlobal();

    @Select("SELECT COUNT(*) FROM alliance_projects p WHERE p.is_public = true AND p.tenant_id = #{tenantId} AND EXISTS ("
        + " SELECT 1 FROM jsonb_array_elements_text(p.enterprise_ids) eid"
        + " JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true"
        + " JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + " AND l.is_public = true AND l.status != 'terminated')")
    int countPublicProjectsByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT COUNT(*) FROM alliance_projects p WHERE p.is_public = true AND EXISTS ("
        + " SELECT 1 FROM jsonb_array_elements_text(p.enterprise_ids) eid"
        + " JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true)")
    int countPublicProjectsGlobal();

    @Select("SELECT COUNT(*) FROM alliance_achievements a WHERE a.is_public = true AND a.tenant_id = #{tenantId} AND EXISTS ("
        + " SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid"
        + " JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true"
        + " JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + " AND l.is_public = true AND l.status != 'terminated')")
    int countPublicAchievementsByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT COUNT(*) FROM alliance_achievements a WHERE a.is_public = true AND EXISTS ("
        + " SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid"
        + " JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true)")
    int countPublicAchievementsGlobal();

    @Select("SELECT COUNT(*) FROM alliance_experts x WHERE x.is_public = true AND x.status = 'active'"
        + " AND EXISTS (SELECT 1 FROM partner_enterprises pe WHERE pe.id = x.enterprise_id AND pe.enable_public = true)"
        + " AND EXISTS (SELECT 1 FROM alliance_enterprise_links l WHERE l.enterprise_id = x.enterprise_id"
        + " AND l.tenant_id = #{tenantId} AND l.is_public = true AND l.status != 'terminated')")
    int countPublicExpertsByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT COUNT(*) FROM alliance_experts x WHERE x.is_public = true AND x.status = 'active'"
        + " AND EXISTS (SELECT 1 FROM partner_enterprises pe WHERE pe.id = x.enterprise_id AND pe.enable_public = true)")
    int countPublicExpertsGlobal();

    @Select("SELECT COUNT(*) FROM alliance_brands WHERE is_public = true AND status != 'archived' AND tenant_id = #{tenantId}")
    int countPublicBrandsByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT COUNT(*) FROM alliance_brands WHERE is_public = true AND status != 'archived'")
    int countPublicBrandsGlobal();
}
