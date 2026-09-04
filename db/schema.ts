import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable(
  'companies',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id').notNull(),
    ownerEmail: text('owner_email').notNull(),
    name: text('name').notNull(),
    legalName: text('legal_name'),
    cnpj: text('cnpj'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [uniqueIndex('idx_companies_owner_user_id').on(table.ownerUserId)],
);

export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id'),
    noteNumber: text('note_number').notNull(),
    clientName: text('client_name').notNull(),
    issueDate: text('issue_date').notNull(),
    grossCents: integer('gross_cents').notNull(),
    status: text('status').notNull().default('recebida'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_invoices_issue_date').on(table.issueDate),
    index('idx_invoices_company_date').on(table.companyId, table.issueDate),
  ],
);

export const expenses = sqliteTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id'),
    description: text('description').notNull(),
    category: text('category').notNull(),
    expenseDate: text('expense_date').notNull(),
    amountCents: integer('amount_cents').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_expenses_expense_date').on(table.expenseDate),
    index('idx_expenses_company_date').on(table.companyId, table.expenseDate),
  ],
);

export const financeSettings = sqliteTable('finance_settings', {
  id: integer('id').primaryKey(),
  companyId: text('company_id'),
  iss: integer('iss').notNull().default(200),
  pis: integer('pis').notNull().default(65),
  cofins: integer('cofins').notNull().default(300),
  irpj: integer('irpj').notNull().default(480),
  csll: integer('csll').notNull().default(288),
  inssSocio: integer('inss_socio').notNull().default(1100),
  inssPatronal: integer('inss_patronal').notNull().default(2000),
  proLaboreCents: integer('pro_labore_cents').notNull().default(162100),
  contadorCents: integer('contador_cents').notNull().default(46000),
  planoSaudeCents: integer('plano_saude_cents').notNull().default(21000),
  emissaoNotaCents: integer('emissao_nota_cents').notNull().default(7000),
}, (table) => [uniqueIndex('idx_finance_settings_company_id').on(table.companyId)]);
