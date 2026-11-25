CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `app_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`scene` text DEFAULT 'title' NOT NULL,
	`scene_started_at` integer NOT NULL,
	`scene_message` text DEFAULT '' NOT NULL,
	`draw_done_at` integer,
	`vote_round` integer DEFAULT 0 NOT NULL,
	`vote_status` text DEFAULT 'closed' NOT NULL,
	`vote_gift_ids` text DEFAULT '[]' NOT NULL,
	`krampus_ids` text DEFAULT '[]' NOT NULL,
	`krampus_score` real,
	`revealed_krampus` integer DEFAULT false NOT NULL,
	`champion_ids` text DEFAULT '[]' NOT NULL,
	`champion_stars` integer DEFAULT 0 NOT NULL,
	`revealed_champion` integer DEFAULT false NOT NULL,
	`current_contest_id` text,
	FOREIGN KEY (`current_contest_id`) REFERENCES `contest`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `contest` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'individual' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gift_vote` (
	`round` integer NOT NULL,
	`voter_id` text NOT NULL,
	`gift_giver_id` text NOT NULL,
	`score` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`round`, `voter_id`, `gift_giver_id`),
	FOREIGN KEY (`voter_id`) REFERENCES `participant`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`gift_giver_id`) REFERENCES `participant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `participant` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email` text,
	`name` text NOT NULL,
	`avatar_url` text,
	`avatar_key` text,
	`wishlist` text DEFAULT '' NOT NULL,
	`in_santa` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participant_user_id_unique` ON `participant` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `participant_email_unique` ON `participant` (`email`);--> statement-breakpoint
CREATE TABLE `santa_assignment` (
	`giver_id` text PRIMARY KEY NOT NULL,
	`receiver_id` text NOT NULL,
	`assigned_at` integer NOT NULL,
	`changed` integer DEFAULT false NOT NULL,
	`email_sent_at` integer,
	`email_error` text,
	FOREIGN KEY (`giver_id`) REFERENCES `participant`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`receiver_id`) REFERENCES `participant`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `santa_assignment_receiver_id_unique` ON `santa_assignment` (`receiver_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `star` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` text NOT NULL,
	`contest_id` text,
	`award_batch_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participant`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contest_id`) REFERENCES `contest`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `star_participant_idx` ON `star` (`participant_id`);--> statement-breakpoint
CREATE INDEX `star_batch_idx` ON `star` (`award_batch_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);