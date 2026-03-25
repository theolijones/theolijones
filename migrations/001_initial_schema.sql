-- 001_initial_schema.sql
-- Core tables for IP Sentinel

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'viewer'
                        CHECK (role IN ('admin', 'viewer')),
    name            VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT NOW(),
    last_login      TIMESTAMPTZ
);

CREATE TABLE companies (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    logo_url          VARCHAR(512),
    notes             TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    created_by_user_id INTEGER REFERENCES users(id),
    is_active         BOOLEAN     DEFAULT true
);

CREATE TABLE social_accounts (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER      NOT NULL REFERENCES companies(id),
    platform        VARCHAR(20)  NOT NULL
                        CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'x')),
    handle          VARCHAR(255) NOT NULL,
    account_url     VARCHAR(512),
    apify_actor_id  VARCHAR(255),
    is_active       BOOLEAN      DEFAULT true,
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE posts (
    id                  SERIAL PRIMARY KEY,
    social_account_id   INTEGER      NOT NULL REFERENCES social_accounts(id),
    platform_post_id    VARCHAR(255) NOT NULL,
    caption             TEXT,
    post_url            VARCHAR(512),
    thumbnail_url       VARCHAR(512),
    posted_at           TIMESTAMPTZ,
    scraped_at          TIMESTAMPTZ  DEFAULT NOW(),
    analysis_status     VARCHAR(20)  DEFAULT 'pending'
                            CHECK (analysis_status IN ('pending', 'analysed', 'error')),
    UNIQUE (social_account_id, platform_post_id)
);

CREATE TABLE infractions (
    id                  SERIAL PRIMARY KEY,
    post_id             INTEGER      NOT NULL REFERENCES posts(id),
    detected_ip_types   JSONB,
    confidence_score    NUMERIC,
    analysis_notes      TEXT,
    detected_at         TIMESTAMPTZ  DEFAULT NOW(),
    is_dismissed        BOOLEAN      DEFAULT false,
    dismissed_by_user_id INTEGER     REFERENCES users(id),
    dismissed_at        TIMESTAMPTZ,
    dismissed_reason    TEXT
);

CREATE TABLE email_alerts (
    id                SERIAL PRIMARY KEY,
    infraction_id     INTEGER      NOT NULL REFERENCES infractions(id),
    recipient_email   VARCHAR(255) NOT NULL,
    sent_at           TIMESTAMPTZ  DEFAULT NOW(),
    alert_type        VARCHAR(20)  NOT NULL
                          CHECK (alert_type IN ('immediate', 'weekly'))
);

CREATE TABLE mailing_list (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    name        VARCHAR(255),
    is_active   BOOLEAN     DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE settings (
    key              VARCHAR(255) PRIMARY KEY,
    value            TEXT,
    updated_at       TIMESTAMPTZ  DEFAULT NOW(),
    updated_by_user_id INTEGER    REFERENCES users(id)
);

CREATE TABLE job_locks (
    key         VARCHAR(255) PRIMARY KEY,
    locked_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- Default settings: Apify actor IDs for each platform
INSERT INTO settings (key, value) VALUES
    ('apify_actor_instagram', 'apify/instagram-post-scraper'),
    ('apify_actor_facebook',  'apify/facebook-posts-scraper'),
    ('apify_actor_tiktok',    'apify/tiktok-scraper'),
    ('apify_actor_x',         'apify/twitter-scraper');
