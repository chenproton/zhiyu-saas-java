CREATE TABLE job_run_logs (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name      text NOT NULL,
    started_at    timestamptz NOT NULL DEFAULT now(),
    finished_at   timestamptz,
    status        text NOT NULL DEFAULT 'running',
    rows_affected bigint NOT NULL DEFAULT 0,
    error         text
);

CREATE INDEX idx_job_run_logs_started_at ON job_run_logs (started_at DESC);
