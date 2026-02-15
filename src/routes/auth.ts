import type { Hono } from "hono";
import { ensureGamificationProfile, getGamificationProfile } from "../db/gamification";
import {
  buildCsrfClearCookie,
  buildCsrfCookie,
  buildOAuthCleanupCookies,
  buildOAuthStateCookie,
  buildOAuthVerifierCookie,
  buildSessionClearCookie,
  buildSessionCookie,
  createCsrfToken,
  createJWT,
  createOAuthLoginContext,
  DAILY_LIMIT_FREE,
  DAILY_LIMIT_LOGIN,
  exchangeGoogleCode,
  findOrCreateUser,
  getGoogleAuthURL,
  getOauthVerifierCookie,
  getSessionFromRequest,
  getUsageToday,
  validateOauthState,
} from "../core/auth";
import type { Env, Session } from "../types";

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function appendSetCookies(headers: Headers, cookies: readonly string[]): void {
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie);
  }
}

export function registerAuthRoutes(app: Hono<{ Bindings: Env }>): void {
  /* -- Auth Routes (Google OAuth) -- */

  app.get("/api/auth/login", async (c) => {
    const switchUser = /^(1|true|yes)$/i.test(c.req.query("switch") ?? "");
    const loginHint = c.req.query("login_hint")?.trim();
    const oauth = await createOAuthLoginContext();
    const url = getGoogleAuthURL(c.env, {
      state: oauth.state,
      codeChallenge: oauth.codeChallenge,
      loginHint: loginHint || undefined,
      forceAccountSelection: switchUser,
    });
    const headers = new Headers({ Location: url });
    headers.set("Cache-Control", "no-store, max-age=0");

    const cookies: string[] = [
      buildOAuthStateCookie(oauth.state),
      buildOAuthVerifierCookie(oauth.codeVerifier),
    ];

    if (switchUser) {
      cookies.unshift(buildSessionClearCookie(), buildCsrfClearCookie());
    }

    appendSetCookies(headers, cookies);
    return new Response(null, { status: 302, headers });
  });

  app.get("/api/auth/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code) return jsonError("Missing authorization code.", 400);
    if (!validateOauthState(c.req.raw, state ?? null)) {
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      appendSetCookies(headers, buildOAuthCleanupCookies());
      return new Response(JSON.stringify({ error: "Invalid OAuth state." }), {
        status: 400,
        headers,
      });
    }

    const codeVerifier = getOauthVerifierCookie(c.req.raw) ?? undefined;
    const googleUser = await exchangeGoogleCode(code, c.env, codeVerifier);
    if (!googleUser) {
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      appendSetCookies(headers, buildOAuthCleanupCookies());
      return new Response(JSON.stringify({ error: "Google authentication failed." }), {
        status: 401,
        headers,
      });
    }

    const user = await findOrCreateUser(c.env.DB, googleUser.email, c.env);
    await ensureGamificationProfile(c.env.DB, user.id).catch(() => { });
    const session: Session = {
      userId: user.id,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 86400,
    };

    const token = await createJWT(session, c.env.JWT_SECRET);
    const csrfToken = createCsrfToken();
    const headers = new Headers({ Location: "/app" });
    appendSetCookies(headers, [
      buildSessionCookie(token),
      buildCsrfCookie(csrfToken),
      ...buildOAuthCleanupCookies(),
    ]);
    return new Response(null, {
      status: 302,
      headers,
    });
  });

  app.get("/api/auth/me", async (c) => {
    const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
    if (!session) return c.json({ authenticated: false });

    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const usedToday = await getUsageToday(c.env.DB, session.userId, ip);
    const limit = DAILY_LIMIT_LOGIN;
    const gamification = await getGamificationProfile(c.env.DB, session.userId).catch(() => null);

    return c.json({
      authenticated: true,
      email: session.email,
      role: session.role,
      usage: { used: usedToday, limit, remaining: Math.max(0, limit - usedToday) },
      gamification: gamification
        ? {
          totalPoints: gamification.totalPoints,
          currentStreakDays: gamification.currentStreakDays,
          premiumUnlocked: gamification.premiumUnlocked,
        }
        : null,
    });
  });

  app.get("/api/auth/logout", (c) => {
    const headers = new Headers({ Location: "/app" });
    appendSetCookies(headers, [
      buildSessionClearCookie(),
      buildCsrfClearCookie(),
    ]);
    return new Response(null, {
      status: 302,
      headers,
    });
  });

  app.get("/api/quota", async (c) => {
    const session = await getSessionFromRequest(c.req.raw, c.env.JWT_SECRET);
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const userId = session?.userId ?? null;

    const usedToday = await getUsageToday(c.env.DB, userId, ip);
    const limit = session ? DAILY_LIMIT_LOGIN : DAILY_LIMIT_FREE;
    const gamification = userId ? await getGamificationProfile(c.env.DB, userId).catch(() => null) : null;
    const streak = gamification?.currentStreakDays ?? 0;

    return c.json({
      authenticated: Boolean(session),
      used: usedToday,
      limit,
      remaining: Math.max(0, limit - usedToday),
      streak,
      gamification: gamification
        ? {
          totalPoints: gamification.totalPoints,
          currentStreakDays: gamification.currentStreakDays,
          premiumUnlocked: gamification.premiumUnlocked,
        }
        : null,
    });
  });
}
