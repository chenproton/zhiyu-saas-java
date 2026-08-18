package org.dromara.zhiyu.mapper.job;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.job.JobPositionCertificate;

import java.util.List;

/**
 * 岗位证书 Mapper（position_certificates 表，Go→Java 迁移）。
 *
 * <p>证书详情/列表需 JOIN certificate_library 带出名称/链接/描述/图片，走自定义 SQL；
 * find-or-create 证书库条目的逻辑由 Service 编排（对齐 Go PositionCertificateStore）。</p>
 *
 * @author zhiyu
 */
public interface JobPositionCertificateMapper extends BaseMapperPlus<JobPositionCertificate, JobPositionCertificate> {

    String SELECT_COLUMNS = "pc.id, pc.tenant_id, pc.career_position_id, pc.certificate_library_id,"
        + " cl.name, cl.url, cl.description, cl.image_url";

    String FROM_CLAUSE = "FROM position_certificates pc"
        + " JOIN certificate_library cl ON cl.id = pc.certificate_library_id";

    /**
     * 分页查询岗位证书（含证书库详情；按证书名升序）。
     */
    @Select("<script>SELECT " + SELECT_COLUMNS + " " + FROM_CLAUSE
        + " WHERE pc.tenant_id = #{tenantId}"
        + " <if test=\"careerPositionId != null and careerPositionId != ''\">AND pc.career_position_id = #{careerPositionId}::uuid</if>"
        + " ORDER BY cl.name ASC LIMIT #{limit} OFFSET #{offset}</script>")
    List<JobPositionCertificate> selectCertificates(@Param("tenantId") String tenantId,
                                                    @Param("careerPositionId") String careerPositionId,
                                                    @Param("limit") int limit, @Param("offset") int offset);

    /**
     * 岗位证书总数（与 {@link #selectCertificates} 同条件）。
     */
    @Select("<script>SELECT COUNT(*) " + FROM_CLAUSE
        + " WHERE pc.tenant_id = #{tenantId}"
        + " <if test=\"careerPositionId != null and careerPositionId != ''\">AND pc.career_position_id = #{careerPositionId}::uuid</if>"
        + "</script>")
    long countCertificates(@Param("tenantId") String tenantId, @Param("careerPositionId") String careerPositionId);

    /**
     * 按 ID 查询岗位证书（含证书库详情）。
     */
    @Select("SELECT " + SELECT_COLUMNS + " " + FROM_CLAUSE + " WHERE pc.id = #{id}")
    JobPositionCertificate selectCertificateById(@Param("id") String id);

    /**
     * 按岗位查询证书绑定原始行（深拷贝用，仅本表实际列，避免 JOIN 结果列映射到本表）。
     */
    @Select("SELECT id, tenant_id, career_position_id, certificate_library_id"
        + " FROM position_certificates WHERE career_position_id = #{positionId}::uuid")
    List<JobPositionCertificate> selectRawByPosition(@Param("positionId") String positionId);

    /**
     * 按名称查找证书库条目（find-or-create 第一步）。
     */
    @Select("SELECT id FROM certificate_library WHERE tenant_id = #{tenantId} AND name = #{name}")
    String selectLibraryId(@Param("tenantId") String tenantId, @Param("name") String name);

    /**
     * 创建证书库条目（find-or-create 第二步；并发首建冲突时静默跳过）。
     */
    @Insert("INSERT INTO certificate_library (id, tenant_id, name, url, description, image_url)"
        + " VALUES (#{id}, #{tenantId}, #{name}, #{url}, #{description}, #{imageUrl})"
        + " ON CONFLICT (tenant_id, name) DO NOTHING")
    int insertLibrary(@Param("id") String id, @Param("tenantId") String tenantId, @Param("name") String name,
                      @Param("url") String url, @Param("description") String description,
                      @Param("imageUrl") String imageUrl);

    /**
     * 创建岗位证书绑定。
     */
    @Insert("INSERT INTO position_certificates (id, tenant_id, career_position_id, certificate_library_id)"
        + " VALUES (#{id}, #{tenantId}, #{careerPositionId}, #{libraryId})")
    int insertPositionCertificate(@Param("id") String id, @Param("tenantId") String tenantId,
                                  @Param("careerPositionId") String careerPositionId,
                                  @Param("libraryId") String libraryId);

    /**
     * 更新岗位证书（提供名称时重绑证书库；否则仅移动岗位）。
     */
    @Update("<script>UPDATE position_certificates SET"
        + " <if test=\"libraryId != null\">certificate_library_id = #{libraryId},</if>"
        + " career_position_id = #{careerPositionId} WHERE id = #{id}</script>")
    int updatePositionCertificate(@Param("id") String id, @Param("careerPositionId") String careerPositionId,
                                  @Param("libraryId") String libraryId);

    /**
     * 删除岗位证书。
     */
    @Delete("DELETE FROM position_certificates WHERE id = #{id}")
    int deletePositionCertificate(@Param("id") String id);
}
