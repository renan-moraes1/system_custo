ALTER TABLE `expenses` ADD `scope` text DEFAULT 'pj' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `payment_method` text DEFAULT 'pix' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `payment_detail` text;--> statement-breakpoint
ALTER TABLE `expenses` ADD `installments` integer DEFAULT 1 NOT NULL;