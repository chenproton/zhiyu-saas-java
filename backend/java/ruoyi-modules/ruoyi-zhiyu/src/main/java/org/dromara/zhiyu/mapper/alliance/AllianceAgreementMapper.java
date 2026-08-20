package org.dromara.zhiyu.mapper.alliance;

import lombok.Data;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.alliance.AllianceAgreement;

import java.time.LocalDate;
import java.util.List;

/**
 * 合作协议 Mapper（alliance_agreements 表）。
 *
 * @author zhiyu
 */
public interface AllianceAgreementMapper extends BaseMapperPlus<AllianceAgreement, AllianceAgreement> {

    @Insert("INSERT INTO alliance_agreements (id, tenant_id, name, type, content, start_date, end_date, status,"
        + " enterprise_ids, project_ids, attachments, is_public, created_by, created_at, updated_at)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{type}, #{content}, #{startDate}, #{endDate}, #{status},"
        + " CAST(#{enterpriseIds} AS jsonb), CAST(#{projectIds} AS jsonb), CAST(#{attachments} AS jsonb),"
        + " #{isPublic}, #{createdBy}, NOW(), NOW())")
    int insertAgreement(AllianceAgreement a);

    @Update("UPDATE alliance_agreements SET name = #{name}, type = #{type}, content = #{content},"
        + " start_date = #{startDate}, end_date = #{endDate}, status = #{status},"
        + " enterprise_ids = CAST(#{enterpriseIds} AS jsonb), project_ids = CAST(#{projectIds} AS jsonb),"
        + " attachments = CAST(#{attachments} AS jsonb), is_public = #{isPublic}, updated_at = NOW()"
        + " WHERE id = #{id} AND tenant_id = #{tenantId}")
    int updateAgreement(AllianceAgreement a);

    @Delete("DELETE FROM alliance_agreements WHERE id = #{id} AND tenant_id = #{tenantId}")
    int deleteAgreement(@Param("id") String id, @Param("tenantId") String tenantId);

    @Update("UPDATE alliance_projects SET agreement_ids = COALESCE(("
        + " SELECT jsonb_agg(x) FROM jsonb_array_elements_text(agreement_ids) x WHERE x <> #{id}"
        + "), '[]'::jsonb), updated_at = NOW() WHERE jsonb_exists(agreement_ids, #{id}) AND tenant_id = #{tenantId}")
    int removeAgreementRefFromProjects(@Param("id") String id, @Param("tenantId") String tenantId);

    @Data
    class PublicAgreementRow {
        private String id;
        private String name;
        private String type;
        private String status;
        private LocalDate startDate;
        private LocalDate endDate;
        private String enterpriseIds;
        private String projectIds;
    }

    @Select("SELECT id, name, type, status, start_date, end_date, enterprise_ids, project_ids"
        + " FROM alliance_agreements a"
        + " WHERE a.tenant_id = #{tenantId} AND a.is_public = true AND ("
        + "   EXISTS (SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid"
        + "     JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true"
        + "     JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + "       AND l.is_public = true AND l.status != 'terminated')"
        + "   OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(a.project_ids) pid"
        + "     JOIN alliance_projects p ON p.id = pid::uuid AND p.is_public = true AND p.tenant_id = #{tenantId}"
        + "     JOIN jsonb_array_elements_text(p.enterprise_ids) eid ON true"
        + "     JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true"
        + "     JOIN alliance_enterprise_links l ON l.enterprise_id = pe.id AND l.tenant_id = #{tenantId}"
        + "       AND l.is_public = true AND l.status != 'terminated'))"
        + " ORDER BY a.created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<PublicAgreementRow> listPublicAgreementsByTenant(@Param("tenantId") String tenantId,
                                                          @Param("limit") int limit,
                                                          @Param("offset") int offset);

    @Select("SELECT id, name, type, status, start_date, end_date, enterprise_ids, project_ids"
        + " FROM alliance_agreements a"
        + " WHERE a.is_public = true AND ("
        + "   EXISTS (SELECT 1 FROM jsonb_array_elements_text(a.enterprise_ids) eid"
        + "     JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true)"
        + "   OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(a.project_ids) pid"
        + "     JOIN alliance_projects p ON p.id = pid::uuid AND p.is_public = true"
        + "     JOIN jsonb_array_elements_text(p.enterprise_ids) eid ON true"
        + "     JOIN partner_enterprises pe ON pe.id = eid::uuid AND pe.enable_public = true))"
        + " ORDER BY a.created_at DESC LIMIT #{limit} OFFSET #{offset}")
    List<PublicAgreementRow> listPublicAgreementsGlobal(@Param("limit") int limit,
                                                        @Param("offset") int offset);
}
