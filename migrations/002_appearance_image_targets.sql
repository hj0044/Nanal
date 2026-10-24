-- Non-destructive dynamic image targets, for every currently registered or future AP ID.
-- Apply AFTER migrations/001_appearance_assets.sql. Never reset existing identity or variant rows.
CREATE TABLE IF NOT EXISTS appearance_image_targets (
 appearance_id TEXT NOT NULL REFERENCES appearance_identities(appearance_id),
 slot TEXT NOT NULL CHECK(slot IN ('portrait','fullBody')),
 target_count INTEGER NOT NULL CHECK(target_count BETWEEN 0 AND 9999),
 source TEXT NOT NULL CHECK(source IN ('verified_official_reservation','explicit_owner_target')),
 profile_sha256 TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 PRIMARY KEY(appearance_id,slot)
);
CREATE TABLE IF NOT EXISTS appearance_image_target_audit (
 audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
 appearance_id TEXT NOT NULL,
 slot TEXT NOT NULL CHECK(slot IN ('portrait','fullBody')),
 previous_target INTEGER,
 next_target INTEGER NOT NULL,
 source TEXT NOT NULL,
 profile_sha256 TEXT NOT NULL,
 recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_appearance_target_audit_id ON appearance_image_target_audit(appearance_id,slot,recorded_at);
