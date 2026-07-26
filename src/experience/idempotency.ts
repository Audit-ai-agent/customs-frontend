import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

/**
 * Produces a bounded, non-secret retry key without persisting the source text.
 * Callers must pass an ordered string tuple so JSON serialization is stable.
 */
export function derivedIdempotencyKey(
  prefix: "assistant" | "conversation",
  values: readonly string[],
): string {
  const bytes = new TextEncoder().encode(JSON.stringify(values));
  return `${prefix}-${bytesToHex(sha256(bytes))}`;
}
