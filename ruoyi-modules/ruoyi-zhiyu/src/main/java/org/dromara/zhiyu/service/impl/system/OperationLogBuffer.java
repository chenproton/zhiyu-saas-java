package org.dromara.zhiyu.service.impl.system;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.dromara.zhiyu.domain.system.SystemOperationLog;
import org.dromara.zhiyu.mapper.system.SystemOperationLogMapper;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * 操作日志异步缓冲批量写入（对齐 Go internal/middleware/oplog_buffer.go 的 OpLogBuffer）。
 *
 * <p>有界队列（4096）非阻塞投递，满载丢弃并告警（审计不得阻塞/拖垮主流程）；
 * 单后台线程攒批：满 200 条或每 5 秒 flush 一次；每批独立 try-catch，
 * 单批失败只丢当前批，线程不退出；shutdown 时排空剩余日志。</p>
 *
 * @author zhiyu
 */
@Slf4j
@Component
public class OperationLogBuffer {

    /** 缓冲容量（对齐 Go oplogBufferSize） */
    private static final int BUFFER_SIZE = 4096;
    /** 单批刷写条数（对齐 Go oplogBatchSize） */
    private static final int BATCH_SIZE = 200;
    /** 刷写间隔毫秒（对齐 Go oplogFlushInterval=5s） */
    private static final long FLUSH_INTERVAL_MILLIS = 5000;

    private final SystemOperationLogMapper operationLogMapper;
    private final BlockingQueue<SystemOperationLog> queue = new ArrayBlockingQueue<>(BUFFER_SIZE);
    private final Thread worker;
    private volatile boolean running = true;

    public OperationLogBuffer(SystemOperationLogMapper operationLogMapper) {
        this.operationLogMapper = operationLogMapper;
        this.worker = new Thread(this::flushLoop, "zhiyu-oplog-flush");
        this.worker.setDaemon(true);
        this.worker.start();
    }

    /**
     * 非阻塞投递；满载丢弃并告警（对齐 Go Enqueue 的 select-default 语义）。
     */
    public void enqueue(SystemOperationLog entry) {
        if (!queue.offer(entry)) {
            log.warn("zhiyu 操作日志缓冲已满，丢弃 module={}", entry.getModule());
        }
    }

    private void flushLoop() {
        List<SystemOperationLog> batch = new ArrayList<>(BATCH_SIZE);
        while (running) {
            try {
                SystemOperationLog entry = queue.poll(FLUSH_INTERVAL_MILLIS, TimeUnit.MILLISECONDS);
                if (entry != null) {
                    batch.add(entry);
                    if (batch.size() >= BATCH_SIZE) {
                        flushSafe(batch);
                        batch = new ArrayList<>(BATCH_SIZE);
                    }
                } else if (!batch.isEmpty()) {
                    flushSafe(batch);
                    batch = new ArrayList<>(BATCH_SIZE);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }

    /**
     * 每批独立兜底：flush 内异常只丢当前批，不终止 flush 线程
     * （否则循环永久退出、后续操作日志静默丢失，对齐 Go flushSafe 的 recover）。
     */
    private void flushSafe(List<SystemOperationLog> batch) {
        try {
            for (SystemOperationLog entry : batch) {
                operationLogMapper.insert(entry);
            }
        } catch (Throwable t) {
            log.warn("zhiyu 操作日志批量写入失败，丢弃本批 {} 条，原因={}", batch.size(), t.getMessage());
        }
    }

    /**
     * 停机时排空剩余日志（对齐 Go Shutdown：cancel 后排空 channel 再 flush）。
     */
    @PreDestroy
    public void shutdown() {
        running = false;
        worker.interrupt();
        List<SystemOperationLog> rest = new ArrayList<>();
        queue.drainTo(rest);
        if (!rest.isEmpty()) {
            flushSafe(rest);
        }
    }
}
