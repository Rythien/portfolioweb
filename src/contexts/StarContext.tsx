"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface StarContextValue {
  foundStars: string[];
  totalStars: number;
  collectStar: (id: string) => void;
  isGameUnlocked: boolean;
  notification: string | null;
}

const TOTAL_STARS = 5;

const StarContext = createContext<StarContextValue>({
  foundStars: [],
  totalStars: TOTAL_STARS,
  collectStar: () => {},
  isGameUnlocked: false,
  notification: null,
});

export const useStars = () => useContext(StarContext);

export function StarProvider({ children }: { children: React.ReactNode }) {
  const [foundStars, setFoundStars] = useState<string[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("searon_stars_found");
      if (saved) {
        const parsed = JSON.parse(saved);
        queueMicrotask(() => {
          setFoundStars(parsed);
        });
      }
    } catch {}
  }, []);

  const collectStar = (id: string) => {
    if (foundStars.includes(id)) return;

    const next = [...foundStars, id];
    setFoundStars(next);
    try {
      localStorage.setItem("searon_stars_found", JSON.stringify(next));
    } catch {}

    const remaining = TOTAL_STARS - next.length;
    if (remaining === 0) {
      setNotification("ALL ARTIFACTS FOUND · LAB GAME UNLOCKED");
    } else {
      setNotification(`ARTIFACT DISCOVERED [${next.length}/${TOTAL_STARS}] · ${remaining} REMAINING`);
    }

    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  return (
    <StarContext.Provider
      value={{
        foundStars,
        totalStars: TOTAL_STARS,
        collectStar,
        isGameUnlocked: foundStars.length >= TOTAL_STARS,
        notification,
      }}
    >
      {children}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-[#050505]/95 border border-white/20 text-[#edebe6] px-4 py-2 font-mono text-label uppercase tracking-widest backdrop-blur-md shadow-2xl flex items-center gap-3 animate-fade-in"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#edebe6] animate-ping" />
          <span>{notification}</span>
        </div>
      )}
    </StarContext.Provider>
  );
}

export function HiddenStar({ id, className = "" }: { id: string; className?: string }) {
  const { foundStars, collectStar } = useStars();
  const isCollected = foundStars.includes(id);

  return (
    <button
      onClick={() => collectStar(id)}
      aria-label="Secret celestial glyph"
      title={isCollected ? "Artifact catalogued" : "???"}
      className={`inline-flex items-center justify-center p-1 opacity-25 hover:opacity-100 transition-opacity focus:outline-none ${className}`}
    >
      <span className="font-mono text-label">
        {isCollected ? "✦" : "✧"}
      </span>
    </button>
  );
}
