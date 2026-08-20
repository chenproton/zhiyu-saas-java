package org.dromara.zhiyu.mapper.evaluation;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;
import org.dromara.common.mybatis.core.mapper.BaseMapperPlus;
import org.dromara.zhiyu.domain.evaluation.JobRunLog;

/**
 * 定时任务执行记录 Mapper（job_run_logs 表；对齐 Go scheduler.startJobRun/finishJobRun）。
 *
 * @author zhiyu
 */
public interface JobRunLogMapper extends BaseMapperPlus<JobRunLog, JobRunLog> {

    /** 写入执行开始记录（status=running），返回日志 ID。 */
    @Insert("INSERT INTO job_run_logs (job_name, status) VALUES (#{jobName}, 'running') RETURNING id")
    String insertRunning(@Param("jobName") String jobName);

    /** 回填执行结果（finished_at/status/error；成功时 error 置空串，对齐 Go finishJobRun）。 */
    @Update("UPDATE job_run_logs SET finished_at = NOW(), status = #{status}, error = #{error}"
        + " WHERE id = #{id}")
    int finish(@Param("id") String id, @Param("status") String status, @Param("error") String error);
}
