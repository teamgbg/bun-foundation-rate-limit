/**
 * @system rate-limit
 * @status handwritten
 * @edit edit directly
 *
 * Process-global registry of all rate limiters for observability and control.
 */

import type {
	KeyedRateLimiter,
	KeyedRateLimiterStats,
	RateLimiter,
	RateLimiterStats,
} from "./types.ts";

interface ManagedEntry {
	limiter: RateLimiter;
	enabled: boolean;
}

interface ManagedKeyedEntry {
	limiter: KeyedRateLimiter;
	enabled: boolean;
}

const entries = new Map<string, ManagedEntry>();
const keyedEntries = new Map<string, ManagedKeyedEntry>();

export const rateLimitRegistry = {
	register(limiter: RateLimiter): void {
		if (entries.has(limiter.name)) {
			throw new Error(`[rate-limit] duplicate limiter name: "${limiter.name}"`);
		}
		entries.set(limiter.name, { limiter, enabled: true });
	},

	registerKeyed(limiter: KeyedRateLimiter): void {
		if (keyedEntries.has(limiter.name)) {
			throw new Error(
				`[rate-limit] duplicate keyed limiter name: "${limiter.name}"`,
			);
		}
		keyedEntries.set(limiter.name, { limiter, enabled: true });
	},

	getAll(): RateLimiterStats[] {
		return [...entries.values()].map((e) => statsFor(e));
	},

	getAllKeyed(): KeyedRateLimiterStats[] {
		return [...keyedEntries.values()].map((e) => keyedStatsFor(e));
	},

	disable(name: string): void {
		const entry = entries.get(name) ?? keyedEntries.get(name);
		if (entry) entry.enabled = false;
	},

	enable(name: string): void {
		const entry = entries.get(name) ?? keyedEntries.get(name);
		if (entry) entry.enabled = true;
	},

	isEnabled(name: string): boolean {
		return (entries.get(name) ?? keyedEntries.get(name))?.enabled ?? true;
	},
};

function statsFor(entry: ManagedEntry): RateLimiterStats {
	return {
		name: entry.limiter.name,
		windowMs: 0,
		maxEvents: 0,
		remaining: entry.limiter.remaining,
		isExhausted: entry.limiter.isExhausted,
		enabled: entry.enabled,
	};
}

function keyedStatsFor(entry: ManagedKeyedEntry): KeyedRateLimiterStats {
	return {
		name: entry.limiter.name,
		windowMs: 0,
		maxRequests: 0,
		maxKeys: 0,
		keyCount: entry.limiter.keyCount,
		enabled: entry.enabled,
	};
}
