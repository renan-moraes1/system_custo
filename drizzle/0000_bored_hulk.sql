CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`expense_date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_expenses_expense_date` ON `expenses` (`expense_date`);--> statement-breakpoint
CREATE TABLE `finance_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`iss` integer DEFAULT 200 NOT NULL,
	`pis` integer DEFAULT 65 NOT NULL,
	`cofins` integer DEFAULT 300 NOT NULL,
	`irpj` integer DEFAULT 480 NOT NULL,
	`csll` integer DEFAULT 288 NOT NULL,
	`inss_socio` integer DEFAULT 1100 NOT NULL,
	`inss_patronal` integer DEFAULT 2000 NOT NULL,
	`pro_labore_cents` integer DEFAULT 162100 NOT NULL,
	`contador_cents` integer DEFAULT 46000 NOT NULL,
	`plano_saude_cents` integer DEFAULT 21000 NOT NULL,
	`emissao_nota_cents` integer DEFAULT 7000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`note_number` text NOT NULL,
	`client_name` text NOT NULL,
	`issue_date` text NOT NULL,
	`gross_cents` integer NOT NULL,
	`status` text DEFAULT 'recebida' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_invoices_issue_date` ON `invoices` (`issue_date`);