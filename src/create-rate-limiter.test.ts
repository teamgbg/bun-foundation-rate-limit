// @system codegen
// @status generated
// @edit change the suite in the owned-suites band, then re-run codegen. Hand-edits are overwritten.
//
// This suite's assertions are OWNED by the codegen band: the band module
// carries them verbatim, this file is the emission, and hand edits here are
// overwritten on the next run. The rationale each assertion carries moved
// with it into the band.

import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "./create-rate-limiter.ts";

describe("acquire (outbound: wait, never refuse)", () => {
	// THE GAP THIS CLOSES: the primitive only had tryAcquire(), which answers
	// "may I?" with a boolean. That is right for INBOUND traffic — refusing a
	// caller over its limit IS the correct outcome. Outbound is the opposite: we
	// are the caller, and the only useful response to the ceiling is to slow down.
	// With no waiting form, every integration reached for after-the-fact retry,
	// which reacts to a 429 instead of preventing it. Measured 2026-08-13: zero
	// api adapters and zero sync handlers used this primitive at all.
	test("waits for a slot instead of refusing", async () => {
		const rl = createRateLimiter("test:acquire-waits", { windowMs: 120, maxEvents: 2 });
		const start = Date.now();
		await rl.acquire();
		await rl.acquire();
		expect(rl.isExhausted).toBe(true);
		// The third must WAIT for the window rather than throw or return false.
		await rl.acquire();
		expect(Date.now() - start).toBeGreaterThanOrEqual(100);
	});

	test("does not wait while slots remain", async () => {
		const rl = createRateLimiter("test:acquire-fast", { windowMs: 5000, maxEvents: 5 });
		const start = Date.now();
		await rl.acquire();
		await rl.acquire();
		expect(Date.now() - start).toBeLessThan(50);
		expect(rl.remaining).toBe(3);
	});

	test("honours an abort signal rather than waiting forever", async () => {
		const rl = createRateLimiter("test:acquire-abort", { windowMs: 60_000, maxEvents: 1 });
		await rl.acquire();
		const ctl = new AbortController();
		ctl.abort();
		await expect(rl.acquire(ctl.signal)).rejects.toThrow("aborted");
	});
});
