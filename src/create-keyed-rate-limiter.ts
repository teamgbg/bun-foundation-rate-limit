/**
 * @system rate-limit
 * @status handwritten
 * @edit edit directly
 *
 * Per-key sliding-window rate limiter. Each key (e.g., IP address, user ID)
 * gets its own independent sliding window. Auto-registers into the global
 * registry. Stale keys are pruned automatically.
 */

import { rateLimitRegistry } from "./registry.ts";
import type { KeyedRateLimiter, KeyedRateLimitOptions } from "./types.ts";

export function createKeyedRateLimiter(
	name: string,
	opts: KeyedRateLimitOptions,
): KeyedRateLimiter {
	const windowMs = opts.windowMs;
	const maxRequests = opts.maxRequests;
	const maxKeys = opts.maxKeys ?? 10_000;
	const windows = new Map<string, number[]>();

	function prune(key: string, now: number): number[] {
		const cutoff = now - windowMs;
		let timestamps = windows.get(key);
		if (!timestamps) {
			timestamps = [];
			windows.set(key, timestamps);
			return timestamps;
		}
		while (timestamps.length > 0 && (timestamps[0] ?? 0) < cutoff) {
			timestamps.shift();
		}
		if (timestamps.length === 0) {
			windows.delete(key);
			return [];
		}
		return timestamps;
	}

	function evictStaleKeys(): void {
		if (windows.size <= maxKeys) return;
		const now = Date.now();
		for (const [key, timestamps] of windows) {
			if (
				timestamps.length === 0 ||
				now - (timestamps[0] ?? 0) > windowMs * 2
			) {
				windows.delete(key);
			}
			if (windows.size <= maxKeys) break;
		}
	}

	const limiter: KeyedRateLimiter = {
		name,

		tryAcquire(key: string): boolean {
			if (!rateLimitRegistry.isEnabled(name)) return true;
			const now = Date.now();
			const timestamps = prune(key, now);
			if (timestamps.length >= maxRequests) return false;
			timestamps.push(now);
			if (!windows.has(key)) windows.set(key, timestamps);
			evictStaleKeys();
			return true;
		},

		remaining(key: string): number {
			const timestamps = prune(key, Date.now());
			return Math.max(0, maxRequests - timestamps.length);
		},

		isExhausted(key: string): boolean {
			const timestamps = prune(key, Date.now());
			return timestamps.length >= maxRequests;
		},

		reset(key?: string): void {
			if (key) {
				windows.delete(key);
			} else {
				windows.clear();
			}
		},

		get keyCount(): number {
			return windows.size;
		},
	};

	rateLimitRegistry.registerKeyed(limiter);
	return limiter;
}
