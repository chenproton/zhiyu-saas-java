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
 * PostgreSQL uuid[] 列 ↔ {@link List}&lt;String&gt; 类型处理器。
 *
 * <p>{@link PgArrayTypeHandler} 写入时按 text[] 创建数组，对 uuid[] 列会报
 * 「column is of type uuid[] but expression is of type text[]」。本处理器按 uuid[]
 * 创建（值须为合法 UUID 字符串，读回时逐元素 toString）。</p>
 *
 * @author zhiyu
 */
@MappedTypes(List.class)
@MappedJdbcTypes(JdbcType.ARRAY)
public class PgUuidArrayTypeHandler extends BaseTypeHandler<List<String>> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, List<String> parameter, JdbcType jdbcType)
        throws SQLException {
        Connection conn = ps.getConnection();
        Array array = conn.createArrayOf("uuid", parameter.toArray());
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
