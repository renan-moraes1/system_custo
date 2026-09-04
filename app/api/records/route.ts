import { getAuthenticatedUserFromRequest, getDb, isSameOrigin } from '@/app/db-auth';

type CompanyRow = { id: string; name: string; legalName: string | null; cnpj: string | null };

const defaults = {
  iss: 200,
  pis: 65,
  cofins: 300,
  irpj: 480,
  csll: 288,
  inssSocio: 1100,
  inssPatronal: 2000,
  proLaboreCents: 162100,
  contadorCents: 46000,
  planoSaudeCents: 21000,
  emissaoNotaCents: 7000,
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

async function getCompany(db: D1Database, companyId: string) {
  return db.prepare('SELECT id, name, legal_name AS legalName, cnpj FROM companies WHERE id = ?')
    .bind(companyId)
    .first<CompanyRow>();
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) return json({ error: 'Faça login para continuar.' }, { status: 401 });

  const db = getDb();
  const company = await getCompany(db, user.companyId);
  if (!company) return json({ error: 'Empresa não encontrada.' }, { status: 403 });

  const [invoiceResult, expenseResult, settings] = await Promise.all([
    db.prepare('SELECT id, note_number AS noteNumber, client_name AS clientName, issue_date AS issueDate, gross_cents AS grossCents, status, created_at AS createdAt FROM invoices WHERE company_id = ? ORDER BY issue_date DESC, created_at DESC LIMIT 100')
      .bind(company.id)
      .all(),
    db.prepare('SELECT id, description, category, expense_date AS expenseDate, amount_cents AS amountCents, created_at AS createdAt FROM expenses WHERE company_id = ? ORDER BY expense_date DESC, created_at DESC LIMIT 100')
      .bind(company.id)
      .all(),
    db.prepare('SELECT iss, pis, cofins, irpj, csll, inss_socio AS inssSocio, inss_patronal AS inssPatronal, pro_labore_cents AS proLaboreCents, contador_cents AS contadorCents, plano_saude_cents AS planoSaudeCents, emissao_nota_cents AS emissaoNotaCents FROM finance_settings WHERE company_id = ?')
      .bind(company.id)
      .first(),
  ]);

  return json({
    user: { displayName: user.name, email: user.email, systemRole: user.systemRole },
    company,
    invoices: invoiceResult.results,
    expenses: expenseResult.results,
    settings: settings ?? defaults,
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Origem da solicitação inválida.' }, { status: 403 });
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) return json({ error: 'Faça login para continuar.' }, { status: 401 });

  const body = await readJson(request);
  if (!body) return json({ error: 'Solicitação inválida.' }, { status: 400 });
  const db = getDb();
  const company = await getCompany(db, user.companyId);
  if (!company) return json({ error: 'Empresa não encontrada.' }, { status: 403 });

  if (body.type === 'invoice') {
    const noteNumber = textValue(body.noteNumber).trim();
    const clientName = textValue(body.clientName).trim();
    const issueDate = textValue(body.issueDate);
    const grossCents = Math.round(Number(body.grossCents));
    const status = body.status === 'pendente' ? 'pendente' : 'recebida';
    if (!noteNumber || !clientName || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || !Number.isFinite(grossCents) || grossCents <= 0) {
      return json({ error: 'Preencha os dados obrigatórios da nota.' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO invoices (id, company_id, note_number, client_name, issue_date, gross_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, company.id, noteNumber, clientName, issueDate, grossCents, status, new Date().toISOString())
      .run();
    return json({ id }, { status: 201 });
  }

  if (body.type === 'expense') {
    const description = textValue(body.description).trim();
    const category = textValue(body.category).trim();
    const expenseDate = textValue(body.expenseDate);
    const amountCents = Math.round(Number(body.amountCents));
    if (!description || !category || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || !Number.isFinite(amountCents) || amountCents <= 0) {
      return json({ error: 'Preencha os dados obrigatórios do gasto.' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO expenses (id, company_id, description, category, expense_date, amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, company.id, description, category, expenseDate, amountCents, new Date().toISOString())
      .run();
    return json({ id }, { status: 201 });
  }

  if (body.type === 'settings') {
    const fields = ['iss', 'pis', 'cofins', 'irpj', 'csll', 'inssSocio', 'inssPatronal', 'proLaboreCents', 'contadorCents', 'planoSaudeCents', 'emissaoNotaCents'] as const;
    const values = fields.map((field) => Math.round(Number(body[field])));
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      return json({ error: 'Os parâmetros precisam ser valores positivos.' }, { status: 400 });
    }
    await db.prepare(`INSERT INTO finance_settings (company_id, iss, pis, cofins, irpj, csll, inss_socio, inss_patronal, pro_labore_cents, contador_cents, plano_saude_cents, emissao_nota_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(company_id) DO UPDATE SET iss=excluded.iss, pis=excluded.pis, cofins=excluded.cofins, irpj=excluded.irpj, csll=excluded.csll, inss_socio=excluded.inss_socio, inss_patronal=excluded.inss_patronal, pro_labore_cents=excluded.pro_labore_cents, contador_cents=excluded.contador_cents, plano_saude_cents=excluded.plano_saude_cents, emissao_nota_cents=excluded.emissao_nota_cents`)
      .bind(company.id, ...values)
      .run();
    return json({ ok: true });
  }

  return json({ error: 'Tipo de lançamento inválido.' }, { status: 400 });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return json({ error: 'Origem da solicitação inválida.' }, { status: 403 });
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) return json({ error: 'Faça login para continuar.' }, { status: 401 });
  const db = getDb();
  const company = await getCompany(db, user.companyId);
  if (!company) return json({ error: 'Empresa não encontrada.' }, { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');
  if (!id || (type !== 'invoice' && type !== 'expense')) {
    return json({ error: 'Lançamento inválido.' }, { status: 400 });
  }
  const table = type === 'invoice' ? 'invoices' : 'expenses';
  await db.prepare(`DELETE FROM ${table} WHERE id = ? AND company_id = ?`).bind(id, company.id).run();
  return json({ ok: true });
}

async function readJson(request: Request) {
  try {
    const value = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function textValue(value: unknown) { return typeof value === 'string' ? value : ''; }
