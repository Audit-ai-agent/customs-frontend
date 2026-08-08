/**
 * Browser-side defence in depth for immutable official-knowledge citations.
 *
 * The Backend validates the same registry host set before it persists a new
 * Agent response.  This parser also protects legacy or malformed API data:
 * a citation outside the approved HTTPS public hosts is shown as unavailable,
 * never as a clickable external link.
 */

const OFFICIAL_GUIDANCE_HOSTS = new Set([
  "law.go.kr",
  "www.law.go.kr",
  "customs.go.kr",
  "www.customs.go.kr",
  "dream.kotra.or.kr",
]);

export function officialGuidanceUrl(value: string): URL | null {
  try {
    // `URL` normalises permissive spellings such as a missing slash or a
    // default port.  Official registry citations must retain an exact raw
    // HTTPS authority so the Browser applies the same fail-closed boundary
    // as Backend and Agent before it makes an external link clickable.
    const authorityMatch = /^https:\/\/([^/?#\s]+)/iu.exec(value);
    if (authorityMatch === null || value !== value.trim()) return null;
    const url = new URL(value);
    // `URL.port` normalizes a scheme's default port to an empty string.
    // Compare the raw authority too: a registry citation never needs an
    // explicit port (including `:443`) or a rewritten authority spelling.
    const authority = authorityMatch[1];
    if (!authority) return null;
    if (
      url.protocol !== "https:"
      || !OFFICIAL_GUIDANCE_HOSTS.has(url.hostname)
      || url.username
      || url.password
      || url.port
      || authority.includes(":")
      || authority.toLowerCase() !== url.host.toLowerCase()
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}
