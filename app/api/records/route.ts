import { env } from 'cloudflare:workers';

type Bindings = { DB: D1Database };

const defaults = {
  id: 1,
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

function getDb() {
  return (env as unknown as Bindings).DB;
}

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

export async function GET() {
  const db = getDb();
  const [invoiceResult, expenseResult, settings] = await Promise.all([
    db.prepare('SELECT id, note_number AS noteNumber, client_name AS clientName, issue_date AS issueDate, gross_cents AS grossCents, status, created_at AS createdAt FROM invoices ORDER BY issue_date DESC, created_at DESC LIMIT 100').all(),
    db.prepare('SELECT id, description, category, expense_date AS expenseDate, amount_cents AS amountCents, created_at AS createdAt FROM expenses ORDER BY expense_date DESC, created_at DESC LIMIT 100').all(),
    db.prepare('SELECT id, iss, pis, cofins, irpj, csll, inss_socio AS inssSocio, inss_patronal AS inssPatronal, pro_labore_cents AS proLaboreCents, contador_cents AS contadorCents, plano_saude_cents AS planoSaudeCents, emissao_nota_cents AS emissaoNotaCents FROM finance_settings WHERE id = 1').first(),
  ]);

  return json({
    invoices: invoiceResult.results,
    expenses: expenseResult.results,
    settings: settings ?? defaults,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const db = getDb();

  if (body.type === 'invoice') {
    const noteNumber = String(body.noteNumber ?? '').trim();
    const clientName = String(body.clientName ?? '').trim();
    const issueDate = String(body.issueDate ?? '');
    const grossCents = Math.round(Number(body.grossCents));
    const status = body.status === 'pendente' ? 'pendente' : 'recebida';
    if (!noteNumber || !clientName || !/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || !Number.isFinite(grossCents) || grossCents <= 0) {
      return json({ error: 'Preencha os dados obrigatórios da nota.' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO invoices (id, note_number, client_name, issue_date, gross_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, noteNumber, clientName, issueDate, grossCents, status, new Date().toISOString())
      .run();
    return json({ id }, { status: 201 });
  }

  if (body.type === 'expense') {
    const description = String(body.description ?? '').trim();
    const category = String(body.category ?? '').trim();
    const expenseDate = String(body.expenseDate ?? '');
    const amountCents = Math.round(Number(body.amountCents));
    if (!description || !category || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate) || !Number.isFinite(amountCents) || amountCents <= 0) {
      return json({ error: 'Preencha os dados obrigatórios do gasto.' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO expenses (id, description, category, expense_date, amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, description, category, expenseDate, amountCents, new Date().toISOString())
      .run();
    return json({ id }, { status: 201 });
  }

  if (body.type === 'settings') {
    const fields = ['iss', 'pis', 'cofins', 'irpj', 'csll', 'inssSocio', 'inssPatronal', 'proLaboreCents', 'contadorCents', 'planoSaudeCents', 'emissaoNotaCents'] as const;
    const values = fields.map((field) => Math.round(Number(body[field])));
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      return json({ error: 'Os parâmetros precisam ser valores positivos.' }, { status: 400 });
    }
    await db.prepare(`INSERT INTO finance_settings (id, iss, pis, cofins, irpj, csll, inss_socio, inss_patronal, pro_labore_cents, contador_cents, plano_saude_cents, emissao_nota_cents)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET iss=excluded.iss, pis=excluded.pis, cofins=excluded.cofins, irpj=excluded.irpj, csll=excluded.csll, inss_socio=excluded.inss_socio, inss_patronal=excluded.inss_patronal, pro_labore_cents=excluded.pro_labore_cents, contador_cents=excluded.contador_cents, plano_saude_cents=excluded.plano_saude_cents, emissao_nota_cents=excluded.emissao_nota_cents`)
      .bind(...values)
      .run();
    return json({ ok: true });
  }

  return json({ error: 'Tipo de lançamento inválido.' }, { status: 400 });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const id = url.searchParams.get('id');
  if (!id || (type !== 'invoice' && type !== 'expense')) {
    return json({ error: 'Lançamento inválido.' }, { status: 400 });
  }
  const table = type === 'invoice' ? 'invoices' : 'expenses';
  await getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  return json({ ok: true });
}
