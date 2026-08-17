package org.dromara.zhiyu.core.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * zhiyu 业务实体基类（Go→Java 迁移：保留 PostgreSQL UUID 主键与现有审计字段命名）。
 *
 * <p>zhiyu-saas 现有 170 张业务表：主键为 PG uuid（gen_random_uuid 默认值），
 * 审计字段为 created_at/updated_at（部分表有 created_by，字段覆盖不均）。
 * 为与现有表结构完全对齐（数据库不动）：</p>
 * <ul>
 *   <li>主键用 {@code @TableId(type = IdType.ASSIGN_UUID)}，不沿用框架雪花 ID；</li>
 *   <li>审计字段按表实际拥有的列在具体实体上声明，本基类只承载共有主键；
 *       继承本类并不要求表里存在 created_at/updated_at 列。</li>
 * </ul>
 *
 * @author zhiyu
 */
@Data
public class BaseZhiyuEntity implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /** 主键（UUID，插入时由 ASSIGN_UUID 生成，等价 PG gen_random_uuid 语义） */
    @TableId(value = "id", type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * 创建时间（对齐现有列 created_at；表无此列时 insertStrategy=NOT_NULL 自动跳过）
     */
    private OffsetDateTime createdAt;

    /**
     * 更新时间（对齐现有列 updated_at；表无此列时 insertStrategy=NOT_NULL 自动跳过）
     */
    private OffsetDateTime updatedAt;
}
