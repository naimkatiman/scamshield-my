import { describe, expect, it } from "vitest";
import { findOrCreateUser, getUsageToday, recordUsage } from "../src/core/auth";
import type { Env } from "../src/types";

interface UserRow {
  id: string;
  email: string;
  role: "user" | "admin" | "beta";
  created_at: string;
}

interface UsageRow {
  user_id: string | null;
  ip: string;
  action: string;
  day: string;
}

function createMockDB() {
  const usersByEmail = new Map<string, UserRow>();
  const usersById = new Map<string, UserRow>();
  const usageRows: UsageRow[] = [];

  const db = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => {
          if (sql.includes("SELECT * FROM users WHERE email = ?")) {
            const email = String(args[0] ?? "");
            return usersByEmail.get(email) ?? null;
          }

          if (sql.includes("WHERE user_id = ? AND day = ? AND action = ?")) {
            const userId = String(args[0] ?? "");
            const day = String(args[1] ?? "");
            const action = String(args[2] ?? "");
            const cnt = usageRows.filter((row) => row.user_id === userId && row.day === day && row.action === action).length;
            return { cnt };
          }

          if (sql.includes("WHERE user_id = ? AND day = ?")) {
            const userId = String(args[0] ?? "");
            const day = String(args[1] ?? "");
            const cnt = usageRows.filter((row) => row.user_id === userId && row.day === day).length;
            return { cnt };
          }

          if (sql.includes("WHERE user_id IS NULL AND ip = ? AND day = ? AND action = ?")) {
            const ip = String(args[0] ?? "");
            const day = String(args[1] ?? "");
            const action = String(args[2] ?? "");
            const cnt = usageRows.filter((row) => row.user_id === null && row.ip === ip && row.day === day && row.action === action).length;
            return { cnt };
          }

          if (sql.includes("WHERE user_id IS NULL AND ip = ? AND day = ?")) {
            const ip = String(args[0] ?? "");
            const day = String(args[1] ?? "");
            const cnt = usageRows.filter((row) => row.user_id === null && row.ip === ip && row.day === day).length;
            return { cnt };
          }

          return null;
        },
        run: async () => {
          if (sql.includes("UPDATE users SET role = 'admin' WHERE id = ?")) {
            const id = String(args[0] ?? "");
            const user = usersById.get(id);
            if (user) {
              const updated: UserRow = { ...user, role: "admin" };
              usersById.set(id, updated);
              usersByEmail.set(updated.email, updated);
            }
            return { meta: { last_row_id: 0 } };
          }

          if (sql.includes("INSERT INTO users (id, email, role) VALUES (?, ?, ?)")) {
            const row: UserRow = {
              id: String(args[0] ?? ""),
              email: String(args[1] ?? ""),
              role: String(args[2] ?? "user") as UserRow["role"],
              created_at: new Date().toISOString(),
            };
            usersById.set(row.id, row);
            usersByEmail.set(row.email, row);
            return { meta: { last_row_id: 1 } };
          }

          if (sql.includes("INSERT INTO usage_logs (user_id, ip, action, day) VALUES (?, ?, ?, ?)")) {
            usageRows.push({
              user_id: (args[0] as string | null) ?? null,
              ip: String(args[1] ?? ""),
              action: String(args[2] ?? ""),
              day: String(args[3] ?? ""),
            });
            return { meta: { last_row_id: usageRows.length } };
          }

          return { meta: { last_row_id: 0 } };
        },
      }),
    }),
  } as unknown as D1Database;

  return { db, usersByEmail, usageRows };
}

function makeEnv(adminEmails = ""): Env {
  return {
    DB: {} as D1Database,
    CACHE_KV: {} as KVNamespace,
    RATE_LIMIT_KV: {} as KVNamespace,
    FILES_BUCKET: {} as R2Bucket,
    ENRICHMENT_QUEUE: {} as Env["ENRICHMENT_QUEUE"],
    ASSETS: {} as Fetcher,
    APP_NAME: "ScamShield MY",
    REGION: "MY",
    ADMIN_EMAILS: adminEmails,
    JWT_SECRET: "test-jwt-secret",
    GOOGLE_CLIENT_ID: "test-google-client-id",
    GOOGLE_CLIENT_SECRET: "test-google-client-secret",
    GOOGLE_REDIRECT_URI: "https://example.test/callback",
  };
}

describe("auth helpers", () => {
  it("assigns admin role from ADMIN_EMAILS", async () => {
    const { db } = createMockDB();
    const env = makeEnv("Admin@Example.com,ops@example.com");

    const user = await findOrCreateUser(db, "admin@example.com", env);
    expect(user.role).toBe("admin");
  });

  it("promotes an existing user when email becomes admin", async () => {
    const { db, usersByEmail } = createMockDB();
    const user = await findOrCreateUser(db, "member@example.com", makeEnv(""));
    expect(user.role).toBe("user");

    const promoted = await findOrCreateUser(db, "member@example.com", makeEnv("member@example.com"));
    expect(promoted.role).toBe("admin");
    expect(usersByEmail.get("member@example.com")?.role).toBe("admin");
  });

  it("supports action-scoped daily usage counts", async () => {
    const { db } = createMockDB();
    const userId = "user-1";

    await recordUsage(db, userId, "1.2.3.4", "verdict");
    await recordUsage(db, userId, "1.2.3.4", "ai_chat");
    await recordUsage(db, userId, "1.2.3.4", "ai_chat");

    const allCount = await getUsageToday(db, userId, "1.2.3.4");
    const chatCount = await getUsageToday(db, userId, "1.2.3.4", "ai_chat");

    expect(allCount).toBe(3);
    expect(chatCount).toBe(2);
  });

  it("supports action-scoped counts for anonymous IP users", async () => {
    const { db } = createMockDB();

    await recordUsage(db, null, "9.8.7.6", "verdict");
    await recordUsage(db, null, "9.8.7.6", "ai_chat");
    await recordUsage(db, null, "1.1.1.1", "ai_chat");

    const anonAll = await getUsageToday(db, null, "9.8.7.6");
    const anonChat = await getUsageToday(db, null, "9.8.7.6", "ai_chat");

    expect(anonAll).toBe(2);
    expect(anonChat).toBe(1);
  });
});
