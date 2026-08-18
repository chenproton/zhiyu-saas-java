package middleware

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type OpLogEntry struct {
	TenantID   string
	UserID     string
	UserName   string
	Module     string
	Action     string
	TargetType *string
	TargetID   *string
	Detail     string
	IP         string
	Status     string
}

type OpLogBuffer struct {
	ch     chan OpLogEntry
	db     *pgxpool.Pool
	ctx    context.Context
	cancel context.CancelFunc
	done   chan struct{}
}

const oplogBufferSize = 4096
const oplogBatchSize = 200
const oplogFlushInterval = 5 * time.Second

func NewOpLogBuffer(db *pgxpool.Pool) *OpLogBuffer {
	ctx, cancel := context.WithCancel(context.Background())
	b := &OpLogBuffer{
		ch:     make(chan OpLogEntry, oplogBufferSize),
		db:     db,
		ctx:    ctx,
		cancel: cancel,
		done:   make(chan struct{}),
	}
	go b.flushLoop()
	return b
}

func (b *OpLogBuffer) Enqueue(entry OpLogEntry) {
	select {
	case b.ch <- entry:
	default:
		slog.Warn("oplog buffer full, dropping entry", "module", entry.Module)
	}
}

func (b *OpLogBuffer) Shutdown() {
	b.cancel()
	<-b.done
}

func (b *OpLogBuffer) flushLoop() {
	defer close(b.done)
	ticker := time.NewTicker(oplogFlushInterval)
	defer ticker.Stop()

	batch := make([]OpLogEntry, 0, oplogBatchSize)

	for {
		select {
		case entry := <-b.ch:
			batch = append(batch, entry)
			if len(batch) >= oplogBatchSize {
				b.flushSafe(batch)
				batch = batch[:0]
			}
		case <-ticker.C:
			if len(batch) > 0 {
				b.flushSafe(batch)
				batch = batch[:0]
			}
		case <-b.ctx.Done():
			for {
				select {
				case entry := <-b.ch:
					batch = append(batch, entry)
				default:
					if len(batch) > 0 {
						b.flushSafe(batch)
					}
					return
				}
			}
		}
	}
}

// flushSafe 每次 flush 独立 recover：flush 内 panic 只丢当前批，不终止 flushLoop
// （否则循环永久退出、后续操作日志静默丢失）。
func (b *OpLogBuffer) flushSafe(entries []OpLogEntry) {
	defer func() {
		if rec := recover(); rec != nil {
			slog.Error("oplog flush panic", "panic", rec)
		}
	}()
	b.flush(entries)
}

func (b *OpLogBuffer) flush(entries []OpLogEntry) {
	// 不基于 b.ctx：Shutdown 会先 cancel 它，导致关机前的最后一次 flush 必然失败丢日志
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	batch := &pgx.Batch{}
	for _, e := range entries {
		batch.Queue(
			`INSERT INTO operation_logs (tenant_id, user_id, user_name, module, action, target_type, target_id, detail, ip, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
			e.TenantID, e.UserID, e.UserName, e.Module, e.Action, e.TargetType, e.TargetID, e.Detail, e.IP, e.Status,
		)
	}

	br := b.db.SendBatch(ctx, batch)
	defer br.Close()

	for range entries {
		if _, err := br.Exec(); err != nil {
			slog.Warn("oplog batch insert failed", "error", err)
		}
	}
}
