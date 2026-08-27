CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`did` text NOT NULL,
	`room` text NOT NULL,
	`seq` integer NOT NULL,
	`nonce` text,
	`source_timestamp` text,
	`body` text NOT NULL,
	`source_url` text NOT NULL,
	`provenance` text NOT NULL,
	`archived_at` text NOT NULL,
	FOREIGN KEY (`did`) REFERENCES `subjects`(`did`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_activities_did_room_seq` ON `activities` (`did`,`room`,`seq`);--> statement-breakpoint
CREATE INDEX `idx_activities_did_archived_at` ON `activities` (`did`,`archived_at`);--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`did` text NOT NULL,
	`url` text NOT NULL,
	`kind` text NOT NULL,
	`archived_at` text NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`did`) REFERENCES `subjects`(`did`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_artifacts_activity_url` ON `artifacts` (`activity_id`,`url`);--> statement-breakpoint
CREATE INDEX `idx_artifacts_did` ON `artifacts` (`did`);--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`did` text NOT NULL,
	`checked_at` text NOT NULL,
	`source` text NOT NULL,
	`rooms_scanned` integer NOT NULL,
	`activity_count` integer NOT NULL,
	`artifact_count` integer NOT NULL,
	FOREIGN KEY (`did`) REFERENCES `subjects`(`did`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_snapshots_did_checked_at` ON `snapshots` (`did`,`checked_at`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`did` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`note_found` integer DEFAULT false NOT NULL,
	`note_url` text,
	`note_value` text,
	`first_seen_at` text NOT NULL,
	`last_checked_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_subjects_fingerprint` ON `subjects` (`fingerprint`);