import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("WCAG color tokens", () => {
  it("keeps small cyan text at WCAG AA contrast on the white product surface", () => {
    expect(contrast(cssToken("cyan"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("provides a two-layer focus indicator with 3:1 contrast on light and dark surfaces", () => {
    const focusColor = css.match(/outline:\s*3px\s+solid\s+(#[0-9a-f]{6})/i)?.[1];
    expect(focusColor).toBeDefined();
    expect(contrast(focusColor!, "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(contrast("#ffffff", cssToken("navy"))).toBeGreaterThanOrEqual(3);
    expect(css).toMatch(/box-shadow:\s*0\s+0\s+0\s+5px\s+#fff/i);
  });
});

function cssToken(name: string): string {
  const value = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  if (!value) throw new Error(`missing CSS token --${name}`);
  return value;
}

function contrast(left: string, right: string): number {
  const lighter = Math.max(luminance(left), luminance(right));
  const darker = Math.min(luminance(left), luminance(right));
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string): number {
  const normalized = hex.length === 4
    ? `#${[...hex.slice(1)].map((part) => part.repeat(2)).join("")}`
    : hex;
  const channels = [1, 3, 5].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}
