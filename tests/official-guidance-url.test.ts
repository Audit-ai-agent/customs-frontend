import { describe, expect, it } from "vitest";
import { officialGuidanceUrl } from "../src/official-guidance-url";

describe("official guidance citation URL boundary", () => {
  it("accepts only exact V1/V2 registry HTTPS page URLs without user info or a port", () => {
    expect(officialGuidanceUrl("https://www.law.go.kr/법령/관세법")?.hostname).toBe("www.law.go.kr");
    expect(officialGuidanceUrl("https://www.customs.go.kr/kcs/cm/cntnts/cntntsView.do?cntntsId=817&mi=2819")?.hostname).toBe("www.customs.go.kr");
    expect(officialGuidanceUrl("https://www2.customs.go.kr/kcs/cm/cntnts/cntntsView.do?cntntsId=818&mi=2820")?.hostname).toBe("www2.customs.go.kr");
    expect(officialGuidanceUrl("https://dream.kotra.or.kr/dream/cms/com/index.do?MENU_ID=4070")?.hostname).toBe("dream.kotra.or.kr");
  });

  it.each([
    "http://www.customs.go.kr/kcs/guide",
    "https://untrusted.example/guide",
    "https://www.customs.go.kr/kcs/guide",
    "HtTpS://WWW.CUSTOMS.GO.KR/kcs/cm/cntnts/cntntsView.do?cntntsId=817&mi=2819",
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
