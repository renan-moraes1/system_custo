CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`name` text NOT NULL,
	`legal_name` text,
	`cnpj` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_companies_owner_user_id` ON `companies` (`owner_user_id`);--> statement-breakpoint
ALTER TABLE `expenses` ADD `company_id` text;--> statement-breakpoint
CREATE INDEX `idx_expenses_company_date` ON `expenses` (`company_id`,`expense_date`);--> statement-breakpoint
ALTER TABLE `finance_settings` ADD `company_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_finance_settings_company_id` ON `finance_settings` (`company_id`);--> statement-breakpoint
ALTER TABLE `invoices` ADD `company_id` text;--> statement-breakpoint
CREATE INDEX `idx_invoices_company_date` ON `invoices` (`company_id`,`issue_date`);