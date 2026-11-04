"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface DreamModeContextType {
  isDreamMode: boolean;
  toggleDreamMode: () => void;
  openDreamMode: () => void;
  closeDreamMode: () => void;
}

const DreamModeContext = createContext<DreamModeContextType | undefined>(undefined);

export function DreamModeProvider({ children }: { children: ReactNode }) {
  const [isDreamMode, setIsDreamMode] = useState(false);

  const toggleDreamMode = () => setIsDreamMode((prev) => !prev);
  const openDreamMode = () => setIsDreamMode(true);
  const closeDreamMode = () => setIsDreamMode(false);

  return (
    <DreamModeContext.Provider
      value={{
        isDreamMode,
        toggleDreamMode,
        openDreamMode,
        closeDreamMode,
      }}
    >
      {children}
      {/* 
        Phase 2 R3F 3D Canvas Mount:
        Persistent container prepared for React Three Fiber canvas injection without DOM tree re-renders.
      */}
      <div
        id="dream-canvas-container"
        aria-hidden="true"
        className={`fixed inset-0 z-40 transition-opacity duration-700 pointer-events-none ${
          isDreamMode ? "opacity-100 pointer-events-auto" : "opacity-0"
        }`}
      />
    </DreamModeContext.Provider>
  );
}

export function useDreamMode() {
  const context = useContext(DreamModeContext);
  if (!context) {
    throw new Error("useDreamMode must be used within a DreamModeProvider");
  }
  return context;
}
