/**
 * @system rate-limit
 * @status handwritten
 * @edit edit directly
 *
 * Configured-primitive entry point for the rate-limit package.
 */

import { rateLimitRegistry } from "./registry.ts";
import type { RateLimitConfig } from "./types.ts";

export function configure(opts: RateLimitConfig): void {
	if (opts.overrides) {
		for (const [name, override] of Object.entries(opts.overrides)) {
			if (override.enabled === false) {
				rateLimitRegistry.disable(name);
			} else if (override.enabled === true) {
				rateLimitRegistry.enable(name);
			}
		}
	}
}
