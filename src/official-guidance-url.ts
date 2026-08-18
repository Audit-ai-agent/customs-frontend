/**
 * Browser-side defence in depth for immutable official-knowledge citations.
 *
 * The Backend validates the same versioned registry projection before it
 * persists a new Agent response.  This parser also protects legacy or
 * malformed API data: a citation outside the *exact* public registry URI set
 * is shown as unavailable, never as a clickable external link.  The imported
 * manifests contain public page metadata only; they contain no raw source,
 * local path, source hash, or provider result.
 */

import registryV1 from "../contracts/evidence/v3/guidance_registry_v1.manifest.json";
import registryV2 from "../contracts/evidence/v3/guidance_registry_v2.manifest.json";

interface GuidanceRegistryManifest {
  readonly sources: readonly { readonly official_uri: string }[];
}

function officialUris(...registries: readonly GuidanceRegistryManifest[]): ReadonlySet<string> {
  const values = registries.flatMap((registry) => registry.sources.map((source) => source.official_uri));
  return new Set(values);
}

const OFFICIAL_GUIDANCE_URIS = officialUris(registryV1, registryV2);
const OFFICIAL_GUIDANCE_HOSTS = new Set(
  [...OFFICIAL_GUIDANCE_URIS].map((value) => new URL(value).hostname),
);

export function officialGuidanceUrl(value: string): URL | null {
  try {
    // `URL` normalises permissive spellings such as a missing slash or a
    // default port.  Official registry citations must retain an exact raw
    // HTTPS authority so the Browser applies the same fail-closed boundary
    // as Backend and Agent before it makes an external link clickable.
    if (!OFFICIAL_GUIDANCE_URIS.has(value)) return null;
    const authorityMatch = /^https:\/\/([^/?#\s]+)/u.exec(value);
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
