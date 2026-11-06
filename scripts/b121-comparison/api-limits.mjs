/** API study cumulative budget, distinct from provider per-request context capacity. */
import { LIMITS as ORIGINAL_LIMITS } from "./session.mjs";
export const LIMITS = Object.freeze({
	...ORIGINAL_LIMITS,
	inputTokens: 1000000,
});
