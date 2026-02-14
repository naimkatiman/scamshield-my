import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Env, QueueMessage, WarningCardPayload } from "../src/types";
import * as verdictService from "../src/core/verdictService";

// Mock the verdict service so we can force failures
vi.mock("../src/core/verdictService", async (importOriginal) => {
    const actual = await importOriginal<typeof verdictService>();
    return {
        ...actual,
        evaluateVerdict: vi.fn(),
    };
});

/**
 * We test the processQueueMessage logic by calling the default export's queue() handler.
 */

// We need to dynamically import because the module sets up Hono globally
const { default: worker } = await import("../src/index");

function createMockKV(): KVNamespace {
    const store = new Map<string, string>();
    return {
        get: vi.fn(async (key: string) => {
            const val = store.get(key);
            return val ?? null;
        }),
        put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
        delete: vi.fn(async () => { }),
        list: vi.fn(async () => ({ keys: [], list_complete: true, cacheStatus: null })),
        getWithMetadata: vi.fn(async () => ({ value: null, metadata: null, cacheStatus: null })),
    } as unknown as KVNamespace;
}

function createMockDB(): D1Database {
    const createStatementResult = () => ({
        first: vi.fn(async () => ({ total: 0 })),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => ({ meta: { last_row_id: 1 } })),
    });

    return {
        prepare: vi.fn(() => {
            const direct = createStatementResult();
            return {
                ...direct,
                bind: vi.fn((..._args: unknown[]) => createStatementResult()),
            };
        }),
    } as unknown as D1Database;
}

function makeEnv(): Env {
    return {
        DB: createMockDB(),
        CACHE_KV: createMockKV(),
        RATE_LIMIT_KV: createMockKV(),
        FILES_BUCKET: {
            put: vi.fn(async () => ({})),
            get: vi.fn(async () => null),
        } as unknown as R2Bucket,
        ENRICHMENT_QUEUE: { send: vi.fn() } as unknown as Env["ENRICHMENT_QUEUE"],
        ASSETS: {} as unknown as Fetcher,
        APP_NAME: "ScamShield MY",
        REGION: "MY",
        PROVIDER_MODE: "mock",
        JWT_SECRET: "test-jwt-secret",
        GOOGLE_CLIENT_ID: "test-client-id",
        GOOGLE_CLIENT_SECRET: "test-client-secret",
        GOOGLE_REDIRECT_URI: "https://example.test/callback",
    };
}

interface MockMessage<T> {
    body: T;
    attempts: number;
    ack: ReturnType<typeof vi.fn>;
    retry: ReturnType<typeof vi.fn>;
}

const validCard: WarningCardPayload = {
    verdict: "HIGH_RISK",
    headline: "Test card",
    identifiers: { wallet: "0xabc" },
    reasons: ["reason1", "reason2", "reason3"],
};

function makeBatch<T>(messages: MockMessage<T>[]): MessageBatch<T> {
    return {
        queue: "scamshield-enrichment",
        messages: messages as unknown as Message<T>[],
        ackAll: vi.fn(),
        retryAll: vi.fn(),
    } as unknown as MessageBatch<T>;
}

describe("queue consumer", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Default success behavior
        vi.mocked(verdictService.evaluateVerdict).mockResolvedValue({
            key: "test",
            result: { verdict: "LEGIT", score: 0, reasons: ["r1", "r2", "r3"], sources: [], nextActions: [] },
            pendingEnrichment: false,
            providerErrors: [],
            timings: {},
            cached: false,
        });
    });

    it("acks a successful enrich_verdict message", async () => {
        const msg: MockMessage<QueueMessage> = {
            body: {
                type: "enrich_verdict",
                payload: {
                    type: "contract",
                    value: "0x1234567890abcdef1234567890abcdef12345678",
                },
            },
            attempts: 1,
            ack: vi.fn(),
            retry: vi.fn(),
        };

        const batch = makeBatch([msg]);
        await worker.queue(batch, makeEnv());

        expect(msg.ack).toHaveBeenCalledOnce();
        expect(msg.retry).not.toHaveBeenCalled();
    });

    it("acks a successful render_card message", async () => {
        const card: WarningCardPayload = {
            verdict: "HIGH_RISK",
            headline: "Test card",
            identifiers: { wallet: "0xabc" },
            reasons: ["reason1", "reason2", "reason3"],
        };
        const msg: MockMessage<QueueMessage> = {
            body: { type: "render_card", payload: { slug: "test-slug", card } },
            attempts: 1,
            ack: vi.fn(),
            retry: vi.fn(),
        };

        const batch = makeBatch([msg]);
        await worker.queue(batch, makeEnv());

        expect(msg.ack).toHaveBeenCalledOnce();
        expect(msg.retry).not.toHaveBeenCalled();
    });

    it("acks a rollup_heatmap message", async () => {
        const msg: MockMessage<QueueMessage> = {
            body: { type: "rollup_heatmap", payload: {} },
            attempts: 1,
            ack: vi.fn(),
            retry: vi.fn(),
        };

        const batch = makeBatch([msg]);
        await worker.queue(batch, makeEnv());

        expect(msg.ack).toHaveBeenCalledOnce();
    });

    it("retries a message on failure when under MAX_QUEUE_RETRIES", async () => {
        // Force evaluateVerdict to fail
        vi.mocked(verdictService.evaluateVerdict).mockRejectedValue(new Error("Transient failure"));

        const msg: MockMessage<QueueMessage> = {
            body: {
                type: "enrich_verdict",
                payload: { type: "contract", value: "0x1234567890abcdef1234567890abcdef12345678" },
            },
            attempts: 1, // Under MAX_QUEUE_RETRIES (3)
            ack: vi.fn(),
            retry: vi.fn(),
        };

        const batch = makeBatch([msg]);
        await worker.queue(batch, makeEnv());

        // Should NOT ack, should retry instead since attempts=1 < 3
        expect(msg.retry).toHaveBeenCalledOnce();
        expect(msg.ack).not.toHaveBeenCalled();
    });

    it("dead-letters a message when attempts >= MAX_QUEUE_RETRIES", async () => {
        // Force evaluateVerdict to fail
        vi.mocked(verdictService.evaluateVerdict).mockRejectedValue(new Error("Persistent failure"));

        const failEnv = makeEnv();
        // Use real DB mock that we can spy on for auditEvent
        const auditRunSpy = vi.fn(async () => ({ meta: { last_row_id: 1 } }));
        failEnv.DB = {
            prepare: vi.fn((sql: string) => {
                // Let audit_events INSERT succeed
                if (sql.includes("audit_events")) {
                    return {
                        bind: vi.fn(() => ({
                            run: auditRunSpy,
                        })),
                    };
                }
                return { bind: vi.fn() };
            }),
        } as unknown as D1Database;

        const msg: MockMessage<QueueMessage> = {
            body: {
                type: "enrich_verdict",
                payload: { type: "contract", value: "0x1234567890abcdef1234567890abcdef12345678" },
            },
            attempts: 3, // At MAX_QUEUE_RETRIES
            ack: vi.fn(),
            retry: vi.fn(),
        };

        const batch = makeBatch([msg]);
        await worker.queue(batch, failEnv);

        // Should ack (dead-letter), not retry
        expect(msg.ack).toHaveBeenCalledOnce();
        expect(msg.retry).not.toHaveBeenCalled();
        // Should have written audit event for dead-letter
        expect(auditRunSpy).toHaveBeenCalledOnce();
    });

    it("silently drops render_card with missing slug", async () => {
        const msg: MockMessage<QueueMessage> = {
            body: { type: "render_card", payload: { card: { verdict: "UNKNOWN", headline: "x", identifiers: {}, reasons: [] } } },
            attempts: 1,
            ack: vi.fn(),
            retry: vi.fn(),
        };

        const batch = makeBatch([msg]);
        await worker.queue(batch, makeEnv());

        // Should ack (no error thrown, processQueueMessage returns early)
        expect(msg.ack).toHaveBeenCalledOnce();
    });

    it("silently drops enrich_verdict with invalid type", async () => {
        const msg: MockMessage<QueueMessage> = {
            body: { type: "enrich_verdict", payload: { type: "invalid", value: "something" } },
            attempts: 1,
            ack: vi.fn(),
            retry: vi.fn(),
        };

        const batch = makeBatch([msg]);
        await worker.queue(batch, makeEnv());

        expect(msg.ack).toHaveBeenCalledOnce();
    });

    it("processes multiple messages in a single batch", async () => {
        const msg1: MockMessage<QueueMessage> = {
            body: { type: "rollup_heatmap", payload: {} },
            attempts: 1,
            ack: vi.fn(),
            retry: vi.fn(),
        };
        const msg2: MockMessage<QueueMessage> = {
            body: { type: "render_card", payload: { slug: "s", card: validCard } },
            attempts: 1,
            ack: vi.fn(),
            retry: vi.fn(),
        };

        await worker.queue(makeBatch([msg1, msg2]), makeEnv());
        expect(msg1.ack).toHaveBeenCalledOnce();
        expect(msg2.ack).toHaveBeenCalledOnce();
    });
});
