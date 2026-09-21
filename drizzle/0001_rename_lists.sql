ALTER TABLE `items` RENAME TO `list_items`;--> statement-breakpoint
ALTER TABLE `boards` RENAME TO `lists`;--> statement-breakpoint
ALTER TABLE `list_items` RENAME COLUMN "board_id" TO "list_id";--> statement-breakpoint
DROP INDEX `idx_items_submission`;--> statement-breakpoint
DROP INDEX `idx_items_content`;--> statement-breakpoint
DROP INDEX `idx_items_rank`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_list_items_submission` ON `list_items` (`list_id`,`submission_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_list_items_content` ON `list_items` (`list_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `idx_list_items_rank` ON `list_items` (`list_id`,`score`,`created_at`,`id`);--> statement-breakpoint
DROP INDEX `boards_slug_unique`;--> statement-breakpoint
DROP INDEX `idx_boards_created`;--> statement-breakpoint
CREATE UNIQUE INDEX `lists_slug_unique` ON `lists` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_lists_created` ON `lists` (`created_at`,`id`);