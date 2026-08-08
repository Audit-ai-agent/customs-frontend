import { describe, expect, it } from "vitest";
import { officialGuidanceUrl } from "../src/official-guidance-url";

describe("official guidance citation URL boundary", () => {
  it("accepts only registry HTTPS hosts without user info or a port", () => {
    expect(officialGuidanceUrl("https://www.law.go.kr/법령/관세법")?.hostname).toBe("www.law.go.kr");
    expect(officialGuidanceUrl("https://www.customs.go.kr/kcs/guide")?.hostname).toBe("www.customs.go.kr");
    expect(officialGuidanceUrl("https://dream.kotra.or.kr/dream/guide")?.hostname).toBe("dream.kotra.or.kr");
    expect(officialGuidanceUrl("HtTpS://WWW.CUSTOMS.GO.KR/kcs/guide")?.hostname).toBe("www.customs.go.kr");
  });

  it.each([
    "http://www.customs.go.kr/kcs/guide",
    "https://untrusted.example/guide",
    "https://user@www.customs.go.kr/kcs/guide",
    "https://www.customs.go.kr:443/kcs/guide",
    "HTTPS://www.customs.go.kr:443/kcs/guide",
    "hTtPs://www.customs.go.kr:/kcs/guide",
    "https:/www.customs.go.kr/kcs/guide",
    "https:///www.customs.go.kr/kcs/guide",
  ])("refuses an unsafe or non-registry URL", (value) => {
    expect(officialGuidanceUrl(value)).toBeNull();
  });
});
