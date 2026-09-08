import { getAuthenticatedUserFromRequest, getDb, isSameOrigin } from '@/app/db-auth';

type Scope = 'pj' | 'pf';
type PaymentMethod = 'cartao_credito' | 'cartao_debito' | 'pix' | 'boleto' | 'dinheiro' | 'transferencia' | 'debito_automatico' | 'outros';
type CategoryRow = { id: string; name: string; scope: Scope; keywords: string };

const builtInCategories: Record<Scope, string[]> = {
  pj: ['Software', 'Equipamento', 'Viagem', 'Serviços', 'Marketing', 'Impostos', 'Escritório', 'Saúde', 'Outros'],
  pf: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Compras', 'Outros'],
};

const categoryRules: Record<Scope, Array<[string, RegExp]>> = {
  pj: [
    ['Saúde', /\b(unimed|amil|bradesco sa[uú]de|plano de sa[uú]de|farm[aá]cia|consulta|exame|dentista)\b/i],
    ['Impostos', /\b(imposto|das|darf|tributo|iss|irpj|csll|cofins|pis|inss|taxa municipal)\b/i],
    ['Marketing', /\b(an[uú]ncio|marketing|publicidade|tr[aá]fego pago|google ads|meta ads|instagram ads)\b/i],
    ['Software', /\b(software|licen[cç]a|saas|cloud|nuvem|hosting|hospedagem web|dom[ií]nio|servidor|vps|microsoft 365|google workspace|github)\b/i],
    ['Equipamento', /\b(computador|notebook|monitor|teclado|mouse|impressora|celular|equipamento|hardware|headset)\b/i],
    ['Viagem', /\b(hotel|passagem|viagem|ped[aá]gio|combust[ií]vel|gasolina|estacionamento|uber|t[aá]xi)\b/i],
    ['Serviços', /\b(contador|contabilidade|consultoria|servi[cç]o|freelancer|manuten[cç][aã]o|internet|telefone)\b/i],
    ['Escritório', /\b(escrit[oó]rio|papelaria|material de escrit[oó]rio|aluguel comercial|coworking|caf[eé])\b/i],
  ],
  pf: [
    ['Saúde', /\b(farm[aá]cia|m[eé]dico|consulta|exame|rem[eé]dio|academia|unimed|amil|dentista|terapia|plano de sa[uú]de)\b/i],
    ['Alimentação', /\b(mercado|supermercado|restaurante|almo[cç]o|jantar|ifood|comida|lanche|padaria|a[cç]ougue|hortifruti)\b/i],
    ['Transporte', /\b(uber|99|combust[ií]vel|gasolina|etanol|estacionamento|ped[aá]gio|transporte|[oô]nibus|metr[oô]|oficina)\b/i],
    ['Moradia', /\b(aluguel|condom[ií]nio|energia|conta de luz|conta de [aá]gua|internet residencial|g[aá]s|iptu|manuten[cç][aã]o da casa)\b/i],
    ['Educação', /\b(curso|faculdade|escola|livro|educa[cç][aã]o|mensalidade escolar|material escolar)\b/i],
    ['Assinaturas', /\b(netflix|spotify|amazon prime|prime video|disney|hbo|max|assinatura|streaming)\b/i],
    ['Lazer', /\b(cinema|viagem|show|lazer|jogo|bar|passeio|festa)\b/i],
    ['Compras', /\b(roupa|cal[cç]ado|shopping|compra|amazon|mercado livre|magazine|eletr[oô]nico)\b/i],
  ],
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: 'Origem da solicitação inválida.' }, { status: 403 });
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) return Response.json({ error: 'Faça login para continuar.' }, { status: 401 });

  const body = await readJson(request);
  const command = textValue(body?.command).trim().replace(/\s+/g, ' ');
  const clientToday = /^\d{4}-\d{2}-\d{2}$/.test(textValue(body?.today)) ? textValue(body?.today) : new Date().toISOString().slice(0, 10);
  if (command.length < 4 || command.length > 500) {
    return Response.json({ error: 'Escreva o lançamento com valor e uma breve descrição.' }, { status: 400 });
  }

  const db = getDb();
  const company = await db.prepare('SELECT id FROM companies WHERE id = ?').bind(user.companyId).first<{ id: string }>();
  if (!company) return Response.json({ error: 'Empresa não encontrada.' }, { status: 403 });

  const invoiceCommand = isInvoiceCommand(command);
  const amountCents = parseMoney(command, invoiceCommand);
  if (!amountCents || amountCents <= 0) {
    return Response.json({ error: 'Não encontrei o valor. Use, por exemplo, “R$ 180,00”.' }, { status: 400 });
  }

  const date = parseDate(command, clientToday);
  if (invoiceCommand) return createInvoice(db, company.id, command, date, amountCents);

  const defaultScope: Scope = body?.defaultScope === 'pf' ? 'pf' : 'pj';
  const scope = parseScope(command, defaultScope);
  const customCategories = await db.prepare('SELECT id, name, scope, keywords FROM expense_categories WHERE company_id = ? AND scope = ? ORDER BY name COLLATE NOCASE')
    .bind(company.id, scope)
    .all<CategoryRow>();
  const category = await resolveCategory(db, company.id, command, scope, customCategories.results);
  const paymentMethod = parsePaymentMethod(command);
  const paymentDetail = parsePaymentDetail(command, paymentMethod);
  const installments = parseInstallments(command);
  const description = parseDescription(command);
  const id = crypto.randomUUID();

  await db.prepare('INSERT INTO expenses (id, company_id, description, category, scope, payment_method, payment_detail, installments, expense_date, amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, company.id, description, category.name, scope, paymentMethod, paymentDetail, installments, date, amountCents, new Date().toISOString())
    .run();

  return Response.json({
    ok: true,
    id,
    type: 'expense',
    createdCategory: category.created,
    record: { description, category: category.name, scope, paymentMethod, paymentDetail, installments, date, amountCents },
  }, { status: 201 });
}

async function createInvoice(db: D1Database, companyId: string, command: string, date: string, grossCents: number) {
  const noteMatch = command.match(/(?:nota(?:\s+fiscal)?|nf)\s*(?:n(?:[úu]mero)?\s*)?[º°o.]?\s*([0-9][A-Za-z0-9./-]*)/i);
  const clientMatch = command.match(/(?:para\s+(?:o\s+)?cliente|cliente|para)\s+(.+?)(?=\s+(?:no valor|de\s+r\$|por\s+r\$|r\$|recebida|pendente|hoje|ontem|dia\s+\d)|[,;.]|$)/i);
  const noteNumber = noteMatch?.[1]?.trim();
  const clientName = clientMatch?.[1]?.trim().slice(0, 80);
  if (!noteNumber || !clientName) {
    return Response.json({ error: 'Para lançar uma nota, informe o número e o cliente. Ex.: “Nota 123 para cliente ACME de R$ 5.000”.' }, { status: 400 });
  }
  const status = /pendente|a receber|ainda n[aã]o recebi/i.test(command) ? 'pendente' : 'recebida';
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO invoices (id, company_id, note_number, client_name, issue_date, gross_cents, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, companyId, noteNumber, clientName, date, grossCents, status, new Date().toISOString())
    .run();
  return Response.json({ ok: true, id, type: 'invoice', record: { noteNumber, clientName, date, grossCents, status } }, { status: 201 });
}

async function resolveCategory(db: D1Database, companyId: string, command: string, scope: Scope, custom: CategoryRow[]) {
  const explicitMatch = command.match(/categoria\s*[:=-]?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 &-]{1,39})(?=\s+(?:no|na|via|pelo|em|dia|hoje|ontem|cart[aã]o|pix|boleto)|[,;.]|$)/i);
  const explicit = explicitMatch?.[1]?.trim().replace(/\s+/g, ' ');
  const allCategories = [...builtInCategories[scope], ...custom.map((item) => item.name)];
  if (explicit) {
    const existing = allCategories.find((name) => normalize(name) === normalize(explicit));
    if (existing) return { name: existing, created: false };
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO expense_categories (id, company_id, name, scope, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, companyId, explicit, scope, new Date().toISOString())
      .run();
    return { name: explicit, created: true };
  }
  const normalizedCommand = normalize(command);
  const customMatch = custom.find((item) => containsTerm(normalizedCommand, item.name));
  if (customMatch) return { name: customMatch.name, created: false };
  const keywordMatch = custom.find((item) => item.keywords.split(',').some((keyword) => containsTerm(normalizedCommand, keyword)));
  if (keywordMatch) return { name: keywordMatch.name, created: false };
  const rule = categoryRules[scope].find(([, pattern]) => pattern.test(normalizedCommand));
  return { name: rule?.[0] ?? 'Outros', created: false };
}

function parseMoney(command: string, invoiceCommand: boolean) {
  const match = command.match(/r\$\s*([0-9.]+(?:,[0-9]{1,2})?)/i)
    ?? command.match(/([0-9.]+(?:,[0-9]{1,2})?)\s*reais\b/i)
    ?? (invoiceCommand
      ? command.match(/(?:no\s+valor(?:\s+de)?|valor(?:\s+de)?|de)\s+([0-9.]+(?:,[0-9]{1,2})?)(?!\s*x\b)/i)
      : command.match(/(?:paguei|gastei|comprei|pagar|pago|lancei)\s+(?:o\s+valor\s+de\s+)?([0-9.]+(?:,[0-9]{1,2})?)(?!\s*x\b)/i));
  if (!match) return null;
  const raw = match[1];
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw;
  const value = Number(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function parseDate(command: string, reference: string) {
  const explicit = command.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (explicit) {
    const value = `${explicit[3]}-${explicit[2].padStart(2, '0')}-${explicit[1].padStart(2, '0')}`;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value) return value;
  }
  if (/\bontem\b/i.test(command)) {
    const date = new Date(`${reference}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }
  return reference;
}

function parseScope(command: string, fallback: Scope): Scope {
  if (/\b(pessoal|particular|pf)\b/i.test(command)) return 'pf';
  if (/\b(empresa|empresarial|corporativo|pj|kca)\b/i.test(command)) return 'pj';
  return fallback;
}

function parsePaymentMethod(command: string): PaymentMethod {
  if (/d[eé]bito autom[aá]tico/i.test(command)) return 'debito_automatico';
  if (/cart[aã]o(?:\s+de)?\s+cr[eé]dito|\bcr[eé]dito\b/i.test(command)) return 'cartao_credito';
  if (/cart[aã]o(?:\s+de)?\s+d[eé]bito|\bd[eé]bito\b/i.test(command)) return 'cartao_debito';
  if (/\bpix\b/i.test(command)) return 'pix';
  if (/boleto/i.test(command)) return 'boleto';
  if (/dinheiro|esp[eé]cie/i.test(command)) return 'dinheiro';
  if (/transfer[eê]ncia|ted|doc\b/i.test(command)) return 'transferencia';
  if (/cart[aã]o/i.test(command)) return 'cartao_credito';
  return 'outros';
}

function parsePaymentDetail(command: string, method: PaymentMethod) {
  const pattern = method.startsWith('cartao') ? /cart[aã]o(?:\s+de\s+(?:cr[eé]dito|d[eé]bito))?\s+(?:(?:de|do|da)\s+)?([A-Za-zÀ-ÿ0-9-]{2,24})/i : /conta\s+(?:(?:de|do|da)\s+)?([A-Za-zÀ-ÿ0-9-]{2,24})/i;
  const detail = pattern.exec(command)?.[1];
  if (!detail || /^(de|do|da|em|no|na|via|hoje|ontem)$/i.test(detail)) return null;
  return detail.slice(0, 80);
}

function parseInstallments(command: string) {
  const match = command.match(/\b(\d{1,2})\s*x\b/i) ?? command.match(/\b(\d{1,2})\s*parcelas?\b/i);
  const value = match ? Number(match[1]) : 1;
  return Number.isInteger(value) && value >= 1 && value <= 48 ? value : 1;
}

function parseDescription(command: string) {
  const explicit = command.match(/descri[cç][aã]o\s*[:=-]\s*([^,;]+)/i)?.[1]?.trim();
  if (explicit) return capitalize(explicit.slice(0, 120));
  const money = command.match(/r\$\s*[0-9.]+(?:,[0-9]{1,2})?|[0-9.]+(?:,[0-9]{1,2})?\s*reais|(?:paguei|gastei|comprei|pagar|pago|lancei)\s+(?:o\s+valor\s+de\s+)?[0-9.]+(?:,[0-9]{1,2})?/i);
  const beforeMoney = money?.index === undefined ? '' : command.slice(0, money.index).replace(/^(eu\s+)?(paguei|gastei|comprei|pagar|pago|lancei)\s+/i, '').trim();
  if (beforeMoney.length >= 2) return capitalize(beforeMoney.slice(0, 120));
  const afterMoney = money ? command.slice((money.index ?? 0) + money[0].length).replace(/^\s*(de|em|por|no|na|no valor de)\s+/i, '').split(/\s+(?:no cart[aã]o|via|pelo|com pix|hoje|ontem|categoria|em \d+\s*x)\b/i)[0].trim() : '';
  if (afterMoney.length >= 2) return capitalize(afterMoney.slice(0, 120));
  return capitalize(command.slice(0, 120));
}

function isInvoiceCommand(command: string) {
  return /^\s*nota\s+\d|\bnota fiscal\b|\bnf\s*\d|\b(?:emiti|enviei|recebi)\s+(?:uma\s+)?nota\b/i.test(command);
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function containsTerm(normalizedCommand: string, rawTerm: string) {
  const commandWords = ` ${normalizedCommand.replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const termWords = normalize(rawTerm).replace(/[^a-z0-9]+/g, ' ').trim();
  return termWords.length >= 2 && commandWords.includes(` ${termWords} `);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function readJson(request: Request) {
  try {
    const value = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}
