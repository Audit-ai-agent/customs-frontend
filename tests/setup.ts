import { afterEach } from "vitest";

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => undefined,
});

// axe-core probes canvas while checking text contrast. jsdom intentionally
// leaves it unimplemented, so expose only the harmless surface axe needs.
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: () => ({
    fillStyle: "#000000",
    font: "16px sans-serif",
    fillText: () => undefined,
    getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
    measureText: () => ({ width: 0 }),
  }),
});

// jsdom logs a not-implemented error when axe asks for ::before/::after
// styles. The base element style is sufficient for this non-rendering test
// environment; deterministic token tests cover the focus/contrast colors.
const getComputedStyle = window.getComputedStyle.bind(window);
Object.defineProperty(window, "getComputedStyle", {
  configurable: true,
  value: (element: Element) => getComputedStyle(element),
});

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
