import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const subjects = sqliteTable('subjects', {
  did: text('did').primaryKey(),
  fingerprint: text('fingerprint').notNull(),
  noteFound: integer('note_found', { mode: 'boolean' }).notNull().default(false),
  noteUrl: text('note_url'),
  noteValue: text('note_value'),
  firstSeenAt: text('first_seen_at').notNull(),
  lastCheckedAt: text('last_checked_at').notNull(),
}, (table) => [uniqueIndex('idx_subjects_fingerprint').on(table.fingerprint)]);

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(),
  did: text('did').notNull().references(() => subjects.did, { onDelete: 'cascade' }),
  room: text('room').notNull(),
  seq: integer('seq').notNull(),
  nonce: text('nonce'),
  sourceTimestamp: text('source_timestamp'),
  body: text('body').notNull(),
  sourceUrl: text('source_url').notNull(),
  provenance: text('provenance', { enum: ['live-technocore', 'imported-receipt'] }).notNull(),
  archivedAt: text('archived_at').notNull(),
}, (table) => [
  uniqueIndex('idx_activities_did_room_seq').on(table.did, table.room, table.seq),
  index('idx_activities_did_archived_at').on(table.did, table.archivedAt),
]);

export const artifacts = sqliteTable('artifacts', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').notNull().references(() => activities.id, { onDelete: 'cascade' }),
  did: text('did').notNull().references(() => subjects.did, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  kind: text('kind', { enum: ['github'] }).notNull(),
  archivedAt: text('archived_at').notNull(),
}, (table) => [
  uniqueIndex('idx_artifacts_activity_url').on(table.activityId, table.url),
  index('idx_artifacts_did').on(table.did),
]);

export const snapshots = sqliteTable('snapshots', {
  id: text('id').primaryKey(),
  did: text('did').notNull().references(() => subjects.did, { onDelete: 'cascade' }),
  checkedAt: text('checked_at').notNull(),
  source: text('source', { enum: ['live-technocore', 'imported-receipt'] }).notNull(),
  roomsScanned: integer('rooms_scanned').notNull(),
  activityCount: integer('activity_count').notNull(),
  artifactCount: integer('artifact_count').notNull(),
}, (table) => [index('idx_snapshots_did_checked_at').on(table.did, table.checkedAt)]);
