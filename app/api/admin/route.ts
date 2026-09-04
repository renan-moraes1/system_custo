import { getAuthenticatedUserFromRequest, getDb, hashPassword, isSameOrigin } from '@/app/db-auth';

const defaults = [200, 65, 300, 480, 288, 1100, 2000, 162100, 46000, 21000, 7000];

export async function GET(request: Request) {
  const user = await requireSystemAdmin(request);
  if (user instanceof Response) return user;

  const result = await getDb().prepare(`SELECT c.id, c.name, c.cnpj, c.created_at AS createdAt,
    u.name AS adminName, u.email AS adminEmail
    FROM companies c
    LEFT JOIN auth_users u ON u.id = c.owner_user_id
    ORDER BY c.created_at DESC
    LIMIT 200`).all();
  return Response.json({ companies: result.results });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: 'Origem da solicitação inválida.' }, { status: 403 });
  const user = await requireSystemAdmin(request);
  if (user instanceof Response) return user;

  const body = await readJson(request);
  if (!body) return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });

  const adminName = textValue(body.adminName).trim();
  const companyName = textValue(body.companyName).trim();
  const email = textValue(body.email).trim().toLowerCase();
  const password = textValue(body.password);
  const cnpj = textValue(body.cnpj).replace(/\D/g, '') || null;

  if (adminName.length < 2 || adminName.length > 80 || companyName.length < 2 || companyName.length > 80) {
    return Response.json({ error: 'Informe o responsável e o nome da empresa.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
  }
  if (password.length < 10 || password.length > 128 || !/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    return Response.json({ error: 'A senha deve ter ao menos 10 caracteres, uma letra e um número.' }, { status: 400 });
  }
  if (cnpj && cnpj.length !== 14) return Response.json({ error: 'Informe um CNPJ válido ou deixe o campo vazio.' }, { status: 400 });

  const db = getDb();
  const existing = await db.prepare('SELECT id FROM auth_users WHERE email = ?').bind(email).first();
  if (existing) return Response.json({ error: 'Este e-mail já possui uma conta.' }, { status: 409 });

  const userId = crypto.randomUUID();
  const companyId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const passwordData = await hashPassword(password);

  try {
    await db.batch([
      db.prepare('INSERT INTO companies (id, owner_user_id, owner_email, name, legal_name, cnpj, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(companyId, userId, email, companyName, companyName, cnpj, createdAt),
      db.prepare('INSERT INTO finance_settings (company_id, iss, pis, cofins, irpj, csll, inss_socio, inss_patronal, pro_labore_cents, contador_cents, plano_saude_cents, emissao_nota_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(companyId, ...defaults),
      db.prepare('INSERT INTO auth_users (id, company_id, email, name, password_hash, password_salt, password_iterations, system_role, failed_login_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)')
        .bind(userId, companyId, email, adminName, passwordData.hash, passwordData.salt, passwordData.iterations, 'company_admin', createdAt),
    ]);
  } catch {
    return Response.json({ error: 'Não foi possível cadastrar. Verifique se o e-mail ou CNPJ já existe.' }, { status: 409 });
  }

  return Response.json({ id: companyId }, { status: 201 });
}

async function requireSystemAdmin(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) return Response.json({ error: 'Faça login para continuar.' }, { status: 401 });
  if (user.systemRole !== 'system_admin') return Response.json({ error: 'Acesso restrito ao administrador principal.' }, { status: 403 });
  return user;
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
