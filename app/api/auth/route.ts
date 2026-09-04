import {
  createSession,
  getAdminSetupToken,
  getAuthenticatedUserFromRequest,
  getDb,
  hashPassword,
  hashSessionToken,
  isSameOrigin,
  PASSWORD_ITERATIONS,
  sessionCookie,
  SESSION_COOKIE,
  secureSecretEqual,
  verifyPassword,
} from '@/app/db-auth';

type LoginUser = {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  failedLoginCount: number;
  lockedUntil: string | null;
};

const defaults = [200, 65, 300, 480, 288, 1100, 2000, 162100, 46000, 21000, 7000];

export async function GET(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);
  return Response.json({ authenticated: Boolean(user), user });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: 'Origem da solicitação inválida.' }, { status: 403 });
  const body = await readJson(request);
  if (!body) return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
  const action = textValue(body.action);

  if (action === 'setupAdmin') return setupAdmin(request, body);
  if (action === 'login') return login(request, body);
  if (action === 'logout') return logout(request);
  return Response.json({ error: 'Ação inválida.' }, { status: 400 });
}

async function setupAdmin(request: Request, body: Record<string, unknown>) {
  const db = getDb();
  const setupToken = textValue(body.setupToken);
  const configuredToken = getAdminSetupToken();
  const name = textValue(body.name).trim();
  const companyName = textValue(body.companyName).trim();
  const email = normalizeEmail(body.email);
  const password = textValue(body.password);
  const cnpj = textValue(body.cnpj).replace(/\D/g, '') || null;

  if (configuredToken.length < 24 || !(await secureSecretEqual(setupToken, configuredToken))) {
    return Response.json({ error: 'Código de ativação inválido.' }, { status: 403 });
  }

  const adminExists = await db.prepare("SELECT id FROM auth_users WHERE system_role = 'system_admin' LIMIT 1").first();
  if (adminExists) return Response.json({ error: 'O administrador principal já foi configurado.' }, { status: 409 });

  if (name.length < 2 || name.length > 80 || companyName.length < 2 || companyName.length > 80) {
    return Response.json({ error: 'Informe seu nome e o nome da empresa.' }, { status: 400 });
  }
  if (!isValidEmail(email)) return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
  if (!isStrongPassword(password)) return Response.json({ error: 'A senha deve ter ao menos 10 caracteres, uma letra e um número.' }, { status: 400 });
  if (cnpj && cnpj.length !== 14) return Response.json({ error: 'Informe um CNPJ válido ou deixe o campo vazio.' }, { status: 400 });

  const existingUser = await db.prepare('SELECT id FROM auth_users WHERE email = ?').bind(email).first();
  if (existingUser) return Response.json({ error: 'Este e-mail já possui uma conta.' }, { status: 409 });

  const userId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const passwordData = await hashPassword(password);
  const legacyCompany = await db.prepare(`SELECT c.id
    FROM companies c
    WHERE lower(c.owner_email) = ?
      AND NOT EXISTS (SELECT 1 FROM auth_users u WHERE u.company_id = c.id)
    LIMIT 1`).bind(email).first<{ id: string }>();
  const companyId = legacyCompany?.id ?? crypto.randomUUID();

  const statements: D1PreparedStatement[] = [];
  if (legacyCompany) {
    statements.push(db.prepare('UPDATE companies SET owner_user_id = ?, owner_email = ? WHERE id = ?').bind(userId, email, companyId));
  } else {
    statements.push(db.prepare('INSERT INTO companies (id, owner_user_id, owner_email, name, legal_name, cnpj, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(companyId, userId, email, companyName, companyName, cnpj, createdAt));
    statements.push(db.prepare('INSERT INTO finance_settings (company_id, iss, pis, cofins, irpj, csll, inss_socio, inss_patronal, pro_labore_cents, contador_cents, plano_saude_cents, emissao_nota_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(companyId, ...defaults));
  }
  statements.push(db.prepare('INSERT INTO auth_users (id, company_id, email, name, password_hash, password_salt, password_iterations, system_role, failed_login_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)')
    .bind(userId, companyId, email, name, passwordData.hash, passwordData.salt, passwordData.iterations, 'system_admin', createdAt));

  try {
    await db.batch(statements);
  } catch {
    return Response.json({ error: 'Não foi possível criar a conta. Verifique se o e-mail ou CNPJ já está cadastrado.' }, { status: 409 });
  }

  const session = await createSession(userId);
  return Response.json({ ok: true }, { status: 201, headers: { 'Set-Cookie': sessionCookie(session.token, request) } });
}

async function login(request: Request, body: Record<string, unknown>) {
  const db = getDb();
  const email = normalizeEmail(body.email);
  const password = textValue(body.password);
  if (!isValidEmail(email) || !password) return invalidCredentials();

  const user = await db.prepare(`SELECT id, email, password_hash AS passwordHash, password_salt AS passwordSalt,
    password_iterations AS passwordIterations, failed_login_count AS failedLoginCount, locked_until AS lockedUntil
    FROM auth_users WHERE email = ?`).bind(email).first<LoginUser>();

  if (!user) {
    await hashPassword(password, 'MDAwMDAwMDAwMDAwMDAwMDAwMDAw', PASSWORD_ITERATIONS);
    return invalidCredentials();
  }

  const now = new Date();
  if (user.lockedUntil && new Date(user.lockedUntil) > now) {
    return Response.json({ error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' }, { status: 429 });
  }

  const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt, user.passwordIterations);
  if (!valid) {
    const failures = user.failedLoginCount + 1;
    const lockedUntil = failures >= 5 ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() : null;
    await db.prepare('UPDATE auth_users SET failed_login_count = ?, locked_until = ? WHERE id = ?').bind(failures >= 5 ? 0 : failures, lockedUntil, user.id).run();
    return invalidCredentials();
  }

  await db.prepare('UPDATE auth_users SET failed_login_count = 0, locked_until = NULL WHERE id = ?').bind(user.id).run();
  await db.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(now.toISOString()).run();
  const session = await createSession(user.id);
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie(session.token, request) } });
}

async function logout(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  if (token) await getDb().prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await hashSessionToken(token)).run();
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie('', request, 0) } });
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
function normalizeEmail(value: unknown) { return textValue(value).trim().toLowerCase(); }
function isValidEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
function isStrongPassword(value: string) { return value.length >= 10 && value.length <= 128 && /[A-Za-zÀ-ÿ]/.test(value) && /\d/.test(value); }
function invalidCredentials() { return Response.json({ error: 'E-mail ou senha inválidos.' }, { status: 401 }); }
