"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { crystalEvents } from "@/hooks/crystalState";
import { useSoundStore } from "@/store/useSoundStore";
import { playCrack, playReassemble } from "@/hooks/crystalAudio";

export { initAudioContext, playTick } from "@/hooks/crystalAudio";

/** Scene-side: plays the crack / reassemble cues off the crystal events. */
export function useCrystalSound() {
  const enabledRef = useRef(false);

  useEffect(() => {
    return useSoundStore.subscribe((s) => {
      enabledRef.current = s.enabled;
    });
  }, []);

  useFrame(() => {
    if (!enabledRef.current) {
      crystalEvents.burst = false;
      crystalEvents.reassemble = false;
      return;
    }
    if (crystalEvents.burst) {
      crystalEvents.burst = false;
      playCrack();
    }
    if (crystalEvents.reassemble) {
      crystalEvents.reassemble = false;
      playReassemble();
    }
  });
}
