-- 002_reports_table.sql
-- Weekly / on-demand report snapshots

CREATE TABLE reports (
    id            SERIAL PRIMARY KEY,
    report_data   JSONB        NOT NULL,
    period_start  TIMESTAMPTZ  NOT NULL,
    period_end    TIMESTAMPTZ  NOT NULL,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    sent_at       TIMESTAMPTZ
);
