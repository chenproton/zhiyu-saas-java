CREATE TABLE job_run_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    job_name LONGTEXT NOT NULL,
    started_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at   DATETIME,
    status VARCHAR(32) NOT NULL DEFAULT 'running',
    rows_affected bigint NOT NULL DEFAULT 0,
    error LONGTEXT
);

CREATE INDEX idx_job_run_logs_started_at ON job_run_logs (started_at DESC);
