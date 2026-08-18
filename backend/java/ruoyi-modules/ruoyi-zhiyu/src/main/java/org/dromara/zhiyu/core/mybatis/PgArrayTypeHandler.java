package org.dromara.zhiyu.core.mybatis;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;

import java.sql.Array;
import java.sql.CallableStatement;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/**
 * PostgreSQL 数组列（uuid[]/varchar[]）↔ {@link List}&lt;String&gt; 类型处理器。
 *
 * <p>zhiyu-saas 现有表大量使用 PG 数组列（schedule_entries.class_node_ids、
 * exam_usages.target_ids、announcements.target_roles 等），MyBatis-Plus 默认
 * 无法将 PG 数组映射为 Java List，这里按 Go 版 JSONSliceToStrings/parseUUIDs
 * 语义做读写转换（读取时逐元素 to string；写入按 text[] 元素创建）。</p>
 *
 * @author zhiyu
 */
@MappedTypes(List.class)
@MappedJdbcTypes(JdbcType.ARRAY)
public class PgArrayTypeHandler extends BaseTypeHandler<List<String>> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, List<String> parameter, JdbcType jdbcType)
        throws SQLException {
        Connection conn = ps.getConnection();
        Array array = conn.createArrayOf("text", parameter.toArray());
        ps.setArray(i, array);
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return toList(rs.getArray(columnName));
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return toList(rs.getArray(columnIndex));
    }

    @Override
    public List<String> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return toList(cs.getArray(columnIndex));
    }

    private List<String> toList(Array array) throws SQLException {
        if (array == null) {
            return null;
        }
        Object raw = array.getArray();
        if (raw == null) {
            return null;
        }
        Object[] elements = (Object[]) raw;
        List<String> out = new ArrayList<>(elements.length);
        for (Object el : elements) {
            if (el != null) {
                out.add(el.toString());
            }
        }
        return out;
    }
}
