import type { Env, Session, User } from "../types";

// ── JWT helpers (HMAC-SHA256 via Web Crypto) ──

async function hmacSign(payload: string, secret: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    return btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncode(obj: unknown): string {
    return btoa(JSON.stringify(obj))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): unknown {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(padded));
}

export async function createJWT(session: Session, secret: string): Promise<string> {
    const header = base64UrlEncode({ alg: "HS256", typ: "JWT" });
    const payload = base64UrlEncode(session);
    const signature = await hmacSign(`${header}.${payload}`, secret);
    return `${header}.${payload}.${signature}`;
}

export async function verifyJWT(token: string, secret: string): Promise<Session | null> {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const [header, payload, signature] = parts;
        const expected = await hmacSign(`${header}.${payload}`, secret);
        if (signature !== expected) return null;
        const session = base64UrlDecode(payload) as Session;
        if (session.exp && session.exp < Math.floor(Date.now() / 1000)) return null;
        return session;
    } catch {
        return null;
    }
}

// ── Google OAuth helpers ──

export function getGoogleAuthURL(env: Env): string {
    const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope: "openid email profile",
        access_type: "online",
        prompt: "select_account",
    });
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

export async function exchangeGoogleCode(code: string, env: Env): Promise<GoogleUserInfo | null> {
    try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: env.GOOGLE_CLIENT_ID,
                client_secret: env.GOOGLE_CLIENT_SECRET,
                redirect_uri: env.GOOGLE_REDIRECT_URI,
                grant_type: "authorization_code",
            }),
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

// ── D1 user management ──

export async function findOrCreateUser(db: D1Database, email: string): Promise<User> {
    const existing = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<User>();
    if (existing) return existing;

    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO users (id, email, role) VALUES (?, ?, 'user')")
        .bind(id, email).run();

    return { id, email, role: "user", created_at: new Date().toISOString() };
}

// ── Usage quota ──

export async function getUsageToday(db: D1Database, userId: string | null, ip: string): Promise<number> {
    const day = new Date().toISOString().slice(0, 10);
    if (userId) {
        const row = await db.prepare("SELECT COUNT(*) as cnt FROM usage_logs WHERE user_id = ? AND day = ?")
            .bind(userId, day).first<{ cnt: number }>();
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

// ── Session extraction from cookie ──

export async function getSessionFromRequest(req: Request, secret: string): Promise<Session | null> {
    const cookie = req.headers.get("Cookie") ?? "";
    const match = cookie.match(/scamshield_session=([^;]+)/);
    if (!match) return null;
    return verifyJWT(match[1], secret);
}

export function buildSessionCookie(token: string, maxAgeSec = 86400): string {
    return `scamshield_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export const DAILY_LIMIT_FREE = 3;
export const DAILY_LIMIT_LOGIN = 30;
