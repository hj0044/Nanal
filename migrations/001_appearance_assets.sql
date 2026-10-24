-- Game-side D1 database for manually reviewed ChatGPT-generated image variants.
CREATE TABLE IF NOT EXISTS appearance_identities (
 appearance_id TEXT PRIMARY KEY,
 gender TEXT NOT NULL CHECK(gender IN ('여성','남성')),
 age_min INTEGER NOT NULL,
 age_max INTEGER NOT NULL,
 profile_sha256 TEXT NOT NULL,
 portrait_anchor_sha256 TEXT NOT NULL,
 full_body_anchor_sha256 TEXT NOT NULL,
 source TEXT NOT NULL CHECK(source='reviewed_official_reservation'),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS appearance_variants (
 asset_id TEXT PRIMARY KEY,
 request_key TEXT NOT NULL UNIQUE,
 appearance_id TEXT NOT NULL REFERENCES appearance_identities(appearance_id),
 gender TEXT NOT NULL,
 age_min INTEGER NOT NULL,
 age_max INTEGER NOT NULL,
 slot TEXT NOT NULL CHECK(slot IN ('portrait','fullBody')),
 profile_sha256 TEXT NOT NULL,
 anchor_sha256 TEXT NOT NULL,
 file_sha256 TEXT NOT NULL,
 storage_key TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'awaiting_review' CHECK(status IN ('awaiting_review','approved','blocked')),
 review_note TEXT,
 approved_at TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_appearance_variants_approved ON appearance_variants(status,approved_at);
CREATE INDEX IF NOT EXISTS idx_appearance_variants_identity ON appearance_variants(appearance_id,status);
