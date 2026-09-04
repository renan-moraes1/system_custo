import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';

type Bindings = { DB: D1Database };

export type AuthenticatedUser = {
  userId: string;
  companyId: string;
  email: string;
  name: string;
};

export const SESSION_COOKIE = 'kca_session';
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
export const PASSWORD_ITERATIONS = 210000;

export function getDb() {
  return (env as unknown as Bindings).DB;
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  return findSessionUser(cookieStore.get(SESSION_COOKIE)?.value ?? null);
}

export async function getAuthenticatedUserFromRequest(request: Request): Promise<AuthenticatedUser | null> {
  return findSessionUser(readCookie(request.headers.get('cookie'), SESSION_COOKIE));
}

async function findSessionUser(token: string | null): Promise<AuthenticatedUser | null> {
  if (!token || token.length < 32 || token.length > 128) return null;
  const tokenHash = await sha256(token);
  return getDb().prepare(`SELECT u.id AS userId, u.company_id AS companyId, u.email, u.name
    FROM auth_sessions s
    INNER JOIN auth_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?`)
    .bind(tokenHash, new Date().toISOString())
    .first<AuthenticatedUser>();
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_DURATION_SECONDS * 1000);
  await getDb().prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(tokenHash, userId, expiresAt.toISOString(), createdAt.toISOString())
    .run();
  return { token, tokenHash, expiresAt };
}

export async function hashPassword(password: string, salt = randomToken(18), iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: decodeBase64Url(salt), iterations }, key, 256);
  return { hash: encodeBase64Url(new Uint8Array(bits)), salt, iterations };
}

export async function verifyPassword(password: string, expectedHash: string, salt: string, iterations: number) {
  const candidate = await hashPassword(password, salt, iterations);
  return constantTimeEqual(candidate.hash, expectedHash);
}

export async function hashSessionToken(token: string) {
  return sha256(token);
}

export function sessionCookie(token: string, request: Request, maxAge = SESSION_DURATION_SECONDS) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

function readCookie(header: string | null, name: string) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

function randomToken(size: number) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return encodeBase64Url(new Uint8Array(digest));
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
