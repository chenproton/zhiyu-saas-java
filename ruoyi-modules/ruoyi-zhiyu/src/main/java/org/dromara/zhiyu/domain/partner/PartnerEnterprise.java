package org.dromara.zhiyu.domain.partner;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.zhiyu.core.domain.BaseZhiyuEntity;
import org.dromara.zhiyu.core.mybatis.JsonStringListTypeHandler;

import java.util.List;

/**
 * 企业主体（partner_enterprises 表，Go→Java 迁移）。
 *
 * <p>cooperationTypes/photos 为 jsonb 字符串数组列，经
 * {@link JsonStringListTypeHandler} 映射为 {@link List}&lt;String&gt;。</p>
 *
 * @author zhiyu
 */
@Data
@EqualsAndHashCode(callSuper = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@TableName("partner_enterprises")
public class PartnerEnterprise extends BaseZhiyuEntity {

    /** 租户 ID */
    private String tenantId;

    /** 企业名称（全局唯一） */
    private String name;

    /** 行业 */
    private String industry;

    /** 地区 */
    private String region;

    /** 企业描述 */
    private String description;

    /** Logo URL */
    private String logoUrl;

    /** 封面图 */
    private String coverImage;

    /** 合作类型（jsonb 字符串数组） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> cooperationTypes;

    /** 联系人 */
    private String contactPerson;

    /** 联系电话 */
    private String contactPhone;

    /** 联系邮箱 */
    private String contactEmail;

    /** 地址 */
    private String address;

    /** 统一社会信用代码 */
    private String unifiedSocialCreditCode;

    /** 成立年份 */
    private Integer establishedYear;

    /** 员工数 */
    private Integer employeeCount;

    /** 营业执照照片（jsonb 字符串数组） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> businessLicensePhotos;

    /** 资质照片（jsonb 字符串数组） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> qualificationPhotos;

    /** 知识产权照片（jsonb 字符串数组） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> intellectualPropertyPhotos;

    /** 封面照片（jsonb 字符串数组） */
    @TableField(typeHandler = JsonStringListTypeHandler.class)
    private List<String> coverPhotos;

    /** 企业侧"愿意对外展示"开关 */
    private Boolean enablePublic;
}
