"use client";

import { useEffect, useCallback } from "react";

// Konami code sequence
const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export function useNegativeMode() {
  const toggleTheme = useCallback(() => {
    const isCurrentlyInverted =
      document.documentElement.getAttribute("data-theme") === "inverted";

    const updateDOM = () => {
      if (isCurrentlyInverted) {
        document.documentElement.removeAttribute("data-theme");
      } else {
        document.documentElement.setAttribute("data-theme", "inverted");
      }
    };

    // Use View Transitions API if supported for circular wipe
    if (
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      typeof (document as Document & { startViewTransition?: (cb: () => void) => void }).startViewTransition === "function"
    ) {
      (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(updateDOM);
    } else {
      updateDOM();
    }
  }, []);

  useEffect(() => {
    let keyIndex = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === KONAMI_CODE[keyIndex]) {
        keyIndex++;
        if (keyIndex === KONAMI_CODE.length) {
          keyIndex = 0;
          toggleTheme();
        }
      } else {
        keyIndex = 0;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleTheme]);

  return { toggleTheme };
}

export default function NegativeMode() {
  useNegativeMode();
  return null;
}
