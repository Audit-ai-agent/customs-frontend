/**
 * Motion hooks ported from the KRDS mockup (dev/mockup-react/src/lib/motion.js).
 * Count-up and entrance effects are presentation only; they never delay or
 * reorder real data. Reduced-motion users get the final state immediately —
 * on a government workbench that is a requirement, not a preference.
 */
import { useEffect, useRef, useState } from "react";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== "function") return undefined;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Counts from the previous value to `target`; continues rather than restarting. */
export function useCountUp(target: number, options: { duration?: number; decimals?: number } = {}): number {
  const { duration = 900, decimals = 0 } = options;
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const fromRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    if (reduced || typeof requestAnimationFrame !== "function") {
      setValue(target);
      fromRef.current = target;
      return undefined;
    }
    const from = fromRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = from + (target - from) * easeOut(t);
      setValue(next);
      if (t < 1) frameRef.current = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration, reduced]);

  useEffect(() => {
    fromRef.current = value;
  });

  return decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value);
}
