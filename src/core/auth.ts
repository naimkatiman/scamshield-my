import { SignJWT, jwtVerify } from "jose";
import type { Env, Session, User } from "../types";

const encoder = new TextEncoder();

const SESSION_COOKIE_NAME = "scamshield_session";
const CSRF_COOKIE_NAME = "scamshield_csrf";
const OAUTH_STATE_COOKIE_NAME = "scamshield_oauth_state";
const OAUTH_VERIFIER_COOKIE_NAME = "scamshield_oauth_verifier";

interface CookieOptions {
  maxAgeSec?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function jwtSecretKey(secret: string): Uint8Array {
  return encoder.encode(secret);
}

function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const path = options.path ?? "/";
  const secure = options.secure ?? true;
  const httpOnly = options.httpOnly ?? true;
  const sameSite = options.sameSite ?? "Lax";
  const maxAge = options.maxAgeSec;

  const parts = [`${name}=${value}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  if (typeof maxAge === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  }
  return parts.join("; ");
}

function equalTokensTimingSafe(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;

  for (let i = 0; i < len; i += 1) {
    const av = i < aBytes.length ? aBytes[i] : 0;
    const bv = i < bBytes.length ? bBytes[i] : 0;
    diff |= av ^ bv;
  }

  return diff === 0;
}

async function pkceChallengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return encodeBase64Url(new Uint8Array(digest));
}

function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

// -- JWT helpers (jose / HS256) --

export async function createJWT(session: Session, secret: string): Promise<string> {
  return new SignJWT({
    userId: session.userId,
    email: session.email,
    role: session.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(session.exp)
    .sign(jwtSecretKey(secret));
}

export async function verifyJWT(token: string, secret: string): Promise<Session | null> {
  try {
    const verified = await jwtVerify(token, jwtSecretKey(secret), { algorithms: ["HS256"] });
    const payload = verified.payload;

    if (
      typeof payload.userId !== "string"
      || typeof payload.email !== "string"
      || typeof payload.role !== "string"
      || typeof payload.exp !== "number"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

// -- Google OAuth helpers --

export interface GoogleAuthOptions {
  state?: string;
  codeChallenge?: string;
  loginHint?: string;
  forceAccountSelection?: boolean;
}

export async function createOAuthLoginContext(): Promise<{
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}> {
  const state = randomToken(24);
  const codeVerifier = randomToken(48);
  const codeChallenge = await pkceChallengeFromVerifier(codeVerifier);
  return { state, codeVerifier, codeChallenge };
}

export function getGoogleAuthURL(env: Env, options: GoogleAuthOptions = {}): string {
  const prompt = options.forceAccountSelection ? "select_account consent" : "select_account";
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt,
  });

  if (options.state) {
    params.set("state", options.state);
  }
  if (options.codeChallenge) {
    params.set("code_challenge", options.codeChallenge);
    params.set("code_challenge_method", "S256");
  }
  if (options.loginHint) {
    params.set("login_hint", options.loginHint);
  }
  if (options.forceAccountSelection) {
    params.set("max_age", "0");
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function exchangeGoogleCode(
  code: string,
  env: Env,
  codeVerifier?: string,
): Promise<GoogleUserInfo | null> {
  try {
    const payload = new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    });
    if (codeVerifier) {
      payload.set("code_verifier", codeVerifier);
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
    });

    if (!tokenRes.ok) return null;
    const tokens = (await tokenRes.json()) as GoogleTokenResponse;

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userRes.ok) return null;
    return (await userRes.json()) as GoogleUserInfo;
  } catch {
    return null;
  }
}

// -- D1 user management --

function parseAdminEmails(rawList: string | undefined): Set<string> {
  if (!rawList) return new Set();
  return new Set(
    rawList
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function findOrCreateUser(db: D1Database, email: string, env: Env): Promise<User> {
  const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);
  const isAdmin = adminEmails.has(email.toLowerCase());
  const existing = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<User>();
  if (existing) {
    // Promote to admin if email is in admin list but role isn't set yet
    if (isAdmin && existing.role !== "admin") {
      await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(existing.id).run();
      existing.role = "admin";
    }
    return existing;
  }

  const id = crypto.randomUUID();
  const role = isAdmin ? "admin" : "user";
  await db.prepare("INSERT INTO users (id, email, role) VALUES (?, ?, ?)")
    .bind(id, email, role).run();

  return { id, email, role, created_at: new Date().toISOString() };
}

// -- Usage quota --

export async function getUsageToday(
  db: D1Database,
  userId: string | null,
  ip: string,
  action?: string,
): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  if (userId) {
    if (action) {
      const row = await db.prepare(
        "SELECT COUNT(*) as cnt FROM usage_logs WHERE user_id = ? AND day = ? AND action = ?",
      )
        .bind(userId, day, action).first<{ cnt: number }>();
      return row?.cnt ?? 0;
    }

    const row = await db.prepare("SELECT COUNT(*) as cnt FROM usage_logs WHERE user_id = ? AND day = ?")
      .bind(userId, day).first<{ cnt: number }>();
    return row?.cnt ?? 0;
  }

  if (action) {
    const row = await db.prepare(
      "SELECT COUNT(*) as cnt FROM usage_logs WHERE user_id IS NULL AND ip = ? AND day = ? AND action = ?",
    )
      .bind(ip, day, action).first<{ cnt: number }>();
    return row?.cnt ?? 0;
  }

  const row = await db.prepare("SELECT COUNT(*) as cnt FROM usage_logs WHERE user_id IS NULL AND ip = ? AND day = ?")
    .bind(ip, day).first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

export async function recordUsage(db: D1Database, userId: string | null, ip: string, action: string): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  await db.prepare("INSERT INTO usage_logs (user_id, ip, action, day) VALUES (?, ?, ?, ?)")
    .bind(userId, ip, action, day).run();
}

// -- Session extraction from cookie --

export function getCookie(req: Request, name: string): string | null {
  const cookie = req.headers.get("Cookie") ?? "";
  if (!cookie) {
    return null;
  }

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function getSessionFromRequest(req: Request, secret: string): Promise<Session | null> {
  const token = getCookie(req, SESSION_COOKIE_NAME);
  if (!token) return null;
  return verifyJWT(token, secret);
}

export function hasSessionCookie(req: Request): boolean {
  return Boolean(getCookie(req, SESSION_COOKIE_NAME));
}

export function buildSessionCookie(token: string, maxAgeSec = 86400): string {
  return serializeCookie(SESSION_COOKIE_NAME, token, {
    maxAgeSec,
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
}

export function buildSessionClearCookie(): string {
  return buildSessionCookie("", 0);
}

export function createCsrfToken(): string {
  return randomToken(24);
}

export function buildCsrfCookie(token: string, maxAgeSec = 86400): string {
  return serializeCookie(CSRF_COOKIE_NAME, token, {
    maxAgeSec,
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
  });
}

export function buildCsrfClearCookie(): string {
  return buildCsrfCookie("", 0);
}

export function validateCsrfRequest(req: Request): boolean {
  const cookieToken = getCookie(req, CSRF_COOKIE_NAME);
  const headerToken = req.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken) {
    return false;
  }
  return equalTokensTimingSafe(cookieToken, headerToken.trim());
}

export function buildOAuthStateCookie(state: string, maxAgeSec = 600): string {
  return serializeCookie(OAUTH_STATE_COOKIE_NAME, state, {
    maxAgeSec,
    path: "/api/auth",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
}

export function buildOAuthVerifierCookie(verifier: string, maxAgeSec = 600): string {
  return serializeCookie(OAUTH_VERIFIER_COOKIE_NAME, verifier, {
    maxAgeSec,
    path: "/api/auth",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
}

export function buildOAuthStateClearCookie(): string {
  return buildOAuthStateCookie("", 0);
}

export function buildOAuthVerifierClearCookie(): string {
  return buildOAuthVerifierCookie("", 0);
}

export function buildOAuthCleanupCookies(): string[] {
  return [
    buildOAuthStateClearCookie(),
    buildOAuthVerifierClearCookie(),
  ];
}

export function getOauthStateCookie(req: Request): string | null {
  return getCookie(req, OAUTH_STATE_COOKIE_NAME);
}

export function getOauthVerifierCookie(req: Request): string | null {
  return getCookie(req, OAUTH_VERIFIER_COOKIE_NAME);
}

export function validateOauthState(req: Request, requestState: string | null): boolean {
  const expected = getOauthStateCookie(req);
  if (!requestState || !expected) {
    return false;
  }
  return equalTokensTimingSafe(requestState, expected);
}

export const DAILY_LIMIT_FREE = 3;
export const DAILY_LIMIT_LOGIN = 30;
