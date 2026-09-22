/**
 * @system rate-limit
 * @status handwritten
 * @edit edit directly
 *
 * Sliding-window rate limiter with auto-registration into the global registry.
 */

		/**
		 * WAIT for a slot instead of refusing. This is the OUTBOUND half of the
		 * capability, and its absence is why no adapter used this primitive.
		 *
		 * `tryAcquire` answers "may I?" with a boolean, which is right for INBOUND
		 * traffic — a caller over its limit gets a 429 and that IS the correct
		 * outcome. Outbound is the opposite: we are the caller, being refused is
		 * never the desired outcome, and the only useful response is to slow down.
		 * With no waiting form, every integration reached for after-the-fact retry
		 * instead, which cannot prevent a 429 — it can only react to one.
		 *
		 * Sleeps until the oldest event in the window expires, so throughput
		 * converges on the declared ceiling rather than bursting into it.
		 */

import { rateLimitRegistry } from "./registry.ts";
import type { RateLimiter, RateLimitOptions } from "./types.ts";

export function createRateLimiter(
	name: string,
	opts: RateLimitOptions,
): RateLimiter {
	const timestamps: number[] = [];
	const windowMs = opts.windowMs;
	const maxEvents = opts.maxEvents;

	function prune(now: number): void {
		const cutoff = now - windowMs;
		while (timestamps.length > 0 && (timestamps[0] ?? 0) < cutoff) {
			timestamps.shift();
		}
	}

	const limiter: RateLimiter = {
		name,

		tryAcquire(): boolean {
			if (!rateLimitRegistry.isEnabled(name)) return true;
			const now = Date.now();
			prune(now);
			if (timestamps.length >= maxEvents) return false;
			timestamps.push(now);
			return true;
		},

		get remaining(): number {
			prune(Date.now());
			return Math.max(0, maxEvents - timestamps.length);
		},

		get isExhausted(): boolean {
			prune(Date.now());
			return timestamps.length >= maxEvents;
		},

		reset(): void {
			timestamps.length = 0;
		},

		async acquire(signal?: AbortSignal): Promise<void> {
			for (;;) {
				if (signal?.aborted) throw new Error(`${name}: aborted while awaiting a slot`);
				if (limiter.tryAcquire()) return;
				const now = Date.now();
				prune(now);
				const oldest = timestamps[0];
				// +1ms so the wait lands after the window edge, never exactly on it.
				const waitMs = oldest === undefined ? 0 : Math.max(1, oldest + windowMs - now + 1);
				await new Promise((resolve) => setTimeout(resolve, waitMs));
			}
		},
	};

	rateLimitRegistry.register(limiter);
	return limiter;
}
