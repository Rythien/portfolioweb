"use client";

import { useEffect, useRef, useState } from "react";
import { useThemeStore } from "@/store/useThemeStore";

export default function ModeDebug() {
  const mode = useThemeStore((s) => s.mode);
  const transitioning = useThemeStore((s) => s.transitioning);
  const clickOrigin = useThemeStore((s) => s.clickOrigin);

  const [dataMode, setDataMode] = useState("wake");
  const [floodLevel, setFloodLevel] = useState(0);
  const [crystal, setCrystal] = useState<Record<string, string>>({});
  const rafRef = useRef(0);

  useEffect(() => {
    const tick = () => {
      setDataMode(document.documentElement.dataset.mode || "?");
      const win = window as unknown as {
        __modeDebug?: { floodProgress: number };
        __crystalDebug?: Record<string, unknown>;
      };
      setFloodLevel(win.__modeDebug?.floodProgress ?? 0);
      const cd = win.__crystalDebug;
      if (cd) {
        setCrystal({
          mounted: String(cd.mounted ?? false),
          visible: String(cd.visible ?? "?"),
          scale: String(cd.scale ?? "?"),
          worldPos: String(cd.worldPos ?? "?"),
          material: String(cd.materialType ?? "?"),
          parentScene: String(cd.parentSceneUuid ?? "?").slice(0, 8),
          rootScene: String(cd.rootSceneUuid ?? "?").slice(0, 8),
          renderTarget: String(cd.renderTargetActive ?? "?"),
          shards: String(cd.shardCount ?? 0),
        });
      } else {
        setCrystal({ mounted: "false" });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        zIndex: 9999,
        background: "rgba(0,0,0,0.82)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.6,
        padding: "8px 12px",
        borderRadius: 6,
        pointerEvents: "none",
        whiteSpace: "pre",
        border: "1px solid rgba(0,255,0,0.2)",
      }}
    >
      {`store.mode  : ${mode}
data-mode   : ${dataMode}
flood level : ${floodLevel.toFixed(3)}
animating   : ${floodLevel > 0.003 && floodLevel < 0.997}
click origin: ${clickOrigin ? `${clickOrigin.x.toFixed(0)}, ${clickOrigin.y.toFixed(0)}` : "null"}
─── crystal ───
mounted     : ${crystal.mounted ?? "?"}
visible     : ${crystal.visible ?? "?"}
scale       : ${crystal.scale ?? "?"}
worldPos    : ${crystal.worldPos ?? "?"}
material    : ${crystal.material ?? "?"}
parentScene : ${crystal.parentScene ?? "?"}
rootScene   : ${crystal.rootScene ?? "?"}
renderTarget: ${crystal.renderTarget ?? "?"}
shards      : ${crystal.shards ?? "?"}`}
    </div>
  );
}
