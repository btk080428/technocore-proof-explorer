import { env } from 'cloudflare:workers';

export const DID_PATTERN = /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/;
export type Provenance = 'live-technocore' | 'imported-receipt';
export type PublicActivity = { room: string; seq: number; nonce: number | string | null; ts: string | null; text: string; provenance?: Provenance; archivedAt?: string };
export type PublicArtifact = { url: string; kind: 'github'; room: string; seq: number };
export type ProofRecord = {
  did: string;
  fingerprint: string;
  note: { found: boolean; url: string; value: string | null };
  activities: PublicActivity[];
  artifacts: PublicArtifact[];
  roomsScanned: number;
  checkedAt: string;
};

type ArchiveRow = {
  room: string;
  seq: number;
  nonce: string | null;
  source_timestamp: string | null;
  body: string;
  provenance: Provenance;
  archived_at: string;
};
type ArtifactRow = { url: string; kind: 'github'; room: string; seq: number };
type SubjectRow = {
  did: string;
  fingerprint: string;
  note_found: number;
  note_url: string | null;
  note_value: string | null;
  last_checked_at: string;
};

function database() {
  return (env as unknown as { DB: D1Database }).DB;
}

let schemaReady: Promise<void> | null = null;
export function ensureSchema() {
  if (schemaReady) return schemaReady;
  const db = database();
  schemaReady = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS subjects (
      did TEXT PRIMARY KEY NOT NULL,
      fingerprint TEXT NOT NULL,
      note_found INTEGER DEFAULT 0 NOT NULL,
      note_url TEXT,
      note_value TEXT,
      first_seen_at TEXT NOT NULL,
      last_checked_at TEXT NOT NULL
    )`),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_fingerprint ON subjects (fingerprint)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY NOT NULL,
      did TEXT NOT NULL REFERENCES subjects(did) ON DELETE CASCADE,
      room TEXT NOT NULL,
      seq INTEGER NOT NULL,
      nonce TEXT,
      source_timestamp TEXT,
      body TEXT NOT NULL,
      source_url TEXT NOT NULL,
      provenance TEXT NOT NULL,
      archived_at TEXT NOT NULL
    )`),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_did_room_seq ON activities (did, room, seq)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_activities_did_archived_at ON activities (did, archived_at)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY NOT NULL,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      did TEXT NOT NULL REFERENCES subjects(did) ON DELETE CASCADE,
      url TEXT NOT NULL,
      kind TEXT NOT NULL,
      archived_at TEXT NOT NULL
    )`),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_artifacts_activity_url ON artifacts (activity_id, url)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_artifacts_did ON artifacts (did)'),
    db.prepare(`CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY NOT NULL,
      did TEXT NOT NULL REFERENCES subjects(did) ON DELETE CASCADE,
      checked_at TEXT NOT NULL,
      source TEXT NOT NULL,
      rooms_scanned INTEGER NOT NULL,
      activity_count INTEGER NOT NULL,
      artifact_count INTEGER NOT NULL
    )`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_snapshots_did_checked_at ON snapshots (did, checked_at)'),
  ]).then(() => undefined).catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isPublicRoom(room: string) {
  return room.length > 0 && room.length <= 96 && !room.toLowerCase().startsWith('p-');
}

function activityId(did: string, room: string, seq: number) {
  return `${did}|${room}|${seq}`;
}

export async function archiveRecord(record: ProofRecord, provenance: Provenance) {
  await ensureSchema();
  const db = database();
  const archivedAt = new Date().toISOString();
  const activities = record.activities.filter((item) => isPublicRoom(item.room));
  const activityKeys = new Set(activities.map((item) => `${item.room}|${item.seq}`));
  const artifacts = record.artifacts.filter((item) => isPublicRoom(item.room) && activityKeys.has(`${item.room}|${item.seq}`));

  await db.prepare(`INSERT INTO subjects
    (did, fingerprint, note_found, note_url, note_value, first_seen_at, last_checked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(did) DO UPDATE SET
      fingerprint = excluded.fingerprint,
      note_found = MAX(subjects.note_found, excluded.note_found),
      note_url = COALESCE(excluded.note_url, subjects.note_url),
      note_value = COALESCE(excluded.note_value, subjects.note_value),
      last_checked_at = MAX(subjects.last_checked_at, excluded.last_checked_at)`)
    .bind(record.did, record.fingerprint, Number(record.note.found), record.note.url || null, record.note.value, archivedAt, record.checkedAt).run();

  for (const item of activities) {
    const id = activityId(record.did, item.room, item.seq);
    await db.prepare(`INSERT INTO activities
      (id, did, room, seq, nonce, source_timestamp, body, source_url, provenance, archived_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(did, room, seq) DO UPDATE SET
        nonce = COALESCE(excluded.nonce, activities.nonce),
        source_timestamp = COALESCE(excluded.source_timestamp, activities.source_timestamp),
        body = excluded.body,
        provenance = CASE WHEN activities.provenance = 'live-technocore' THEN activities.provenance ELSE excluded.provenance END,
        archived_at = MIN(activities.archived_at, excluded.archived_at)`)
      .bind(id, record.did, item.room, item.seq, item.nonce === null ? null : String(item.nonce), item.ts, item.text, `https://technocore.chat/r/${encodeURIComponent(item.room)}`, provenance, archivedAt).run();
  }

  for (const item of artifacts) {
    const parentId = activityId(record.did, item.room, item.seq);
    const id = `${parentId}|${item.url}`;
    await db.prepare(`INSERT INTO artifacts (id, activity_id, did, url, kind, archived_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(activity_id, url) DO NOTHING`)
      .bind(id, parentId, record.did, item.url, item.kind, archivedAt).run();
  }

  await db.prepare(`INSERT INTO snapshots
    (id, did, checked_at, source, rooms_scanned, activity_count, artifact_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), record.did, record.checkedAt, provenance, record.roomsScanned, activities.length, artifacts.length).run();

  return { archivedAt, activitiesStored: activities.length, artifactsStored: artifacts.length, provenance };
}

export async function readArchive(did: string) {
  await ensureSchema();
  const db = database();
  const subject = await db.prepare(`SELECT did, fingerprint, note_found, note_url, note_value, last_checked_at
    FROM subjects WHERE did = ?`).bind(did).first<SubjectRow>();
  if (!subject) return null;

  const activityResult = await db.prepare(`SELECT room, seq, nonce, source_timestamp, body, provenance, archived_at
    FROM activities WHERE did = ? ORDER BY COALESCE(source_timestamp, archived_at) DESC, seq DESC LIMIT 200`)
    .bind(did).all<ArchiveRow>();
  const artifactResult = await db.prepare(`SELECT a.url, a.kind, x.room, x.seq
    FROM artifacts a JOIN activities x ON x.id = a.activity_id
    WHERE a.did = ? ORDER BY a.archived_at DESC`)
    .bind(did).all<ArtifactRow>();
  const rows = activityResult.results || [];
  const importedCount = rows.filter((row) => row.provenance === 'imported-receipt').length;
  const liveCount = rows.length - importedCount;

  return {
    did: subject.did,
    fingerprint: subject.fingerprint,
    note: { found: Boolean(subject.note_found), url: subject.note_url || '', value: subject.note_value },
    activities: rows.map((row) => ({ room: row.room, seq: row.seq, nonce: row.nonce, ts: row.source_timestamp, text: row.body, provenance: row.provenance, archivedAt: row.archived_at })),
    artifacts: artifactResult.results || [],
    roomsScanned: 0,
    checkedAt: subject.last_checked_at,
    archive: { found: true, liveCount, importedCount, totalActivities: rows.length, oldestArchivedAt: rows.at(-1)?.archived_at || null },
  };
}
