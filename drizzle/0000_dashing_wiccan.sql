CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`creator_handle` text,
	`approval_id` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boards_slug_unique` ON `boards` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_boards_created` ON `boards` (`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`submission_hash` text NOT NULL,
	`content_hash` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`source_url` text,
	`source_host` text,
	`author` text,
	`score` integer NOT NULL,
	`raw_score` text NOT NULL,
	`approval_id` text NOT NULL,
	`score_id` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "items_score_bounds" CHECK("items"."score" BETWEEN 0 AND 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_items_submission` ON `items` (`board_id`,`submission_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_items_content` ON `items` (`board_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_items_rank` ON `items` (`board_id`,`score`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `operation_locks` (
	`key` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_expiry` ON `rate_limits` (`expires_at`);