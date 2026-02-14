import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../src/core/logger";

describe("logger deep masking", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it("masks EVM addresses nested in objects", () => {
        logger.info("test", {
            payload: { wallet: "0x1234567890abcdef1234567890abcdef12345678" },
        });
        const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
        expect(output.payload.wallet).toBe("0x1234...5678");
    });

    it("masks emails nested in objects", () => {
        logger.info("test", {
            user: { email: "secret@example.com" },
        });
        const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
        expect(output.user.email).toContain("***@");
        expect(output.user.email).not.toContain("secret@");
    });

    it("masks strings in arrays", () => {
        logger.info("test", {
            addresses: ["0x1234567890abcdef1234567890abcdef12345678", "plain text"],
        });
        const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
        expect(output.addresses[0]).toBe("0x1234...5678");
        expect(output.addresses[1]).toBe("plain text");
    });

    it("preserves non-string values in nested objects", () => {
        logger.info("test", {
            meta: { count: 42, active: true },
        });
        const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
        expect(output.meta.count).toBe(42);
        expect(output.meta.active).toBe(true);
    });

    it("handles deeply nested structures", () => {
        logger.info("test", {
            l1: { l2: { l3: { addr: "0x1234567890abcdef1234567890abcdef12345678" } } },
        });
        const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
        expect(output.l1.l2.l3.addr).toBe("0x1234...5678");
    });

    it("handles arrays of objects", () => {
        logger.info("test", {
            items: [
                { addr: "0x1234567890abcdef1234567890abcdef12345678" },
                { addr: "clean" },
            ],
        });
        const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
        expect(output.items[0].addr).toBe("0x1234...5678");
        expect(output.items[1].addr).toBe("clean");
    });
});
