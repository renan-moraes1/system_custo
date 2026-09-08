CREATE TABLE `expense_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`scope` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_expense_categories_company_scope_name` ON `expense_categories` (`company_id`,`scope`,`name`);--> statement-breakpoint
CREATE INDEX `idx_expense_categories_company_scope` ON `expense_categories` (`company_id`,`scope`);