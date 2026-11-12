"use client";

import { useRef, useEffect } from "react";
import { useFractureStore } from "@/store/useFractureStore";

export default function CrystalCursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const posRef = useRef({ x: -100, y: -100 });
  const currentRef = useRef({ x: -100, y: -100 });
  const rafRef = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      posRef.current.x = e.clientX;
      posRef.current.y = e.clientY;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      const ring = ringRef.current;
      const label = labelRef.current;
      if (!ring || !label) return;

      currentRef.current.x += (posRef.current.x - currentRef.current.x) * 0.12;
      currentRef.current.y += (posRef.current.y - currentRef.current.y) * 0.12;

      const { cursorLabel } = useFractureStore.getState();
      const active = cursorLabel.length > 0;

      ring.style.transform = `translate(${currentRef.current.x}px, ${currentRef.current.y}px) translate(-50%, -50%) scale(${active ? 1 : 0.3})`;
      ring.style.opacity = active ? "1" : "0";
      label.textContent = cursorLabel;
    }
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div
      ref={ringRef}
      className="pointer-events-none fixed top-0 left-0 z-[9999] flex items-center justify-center transition-opacity duration-200"
      style={{
        width: 80,
        height: 80,
        borderRadius: "50%",
        border: "1.5px solid rgba(26,26,30,0.5)",
        opacity: 0,
      }}
    >
      <span
        ref={labelRef}
        className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/70 select-none"
      />
    </div>
  );
}
