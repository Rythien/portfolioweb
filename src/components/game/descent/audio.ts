/**
 * Game sound cues. Every cue goes through the site's existing Web Audio
 * graph (hooks/crystalAudio) and is silent unless the Sound toggle is on;
 * with sound off no AudioContext is even created.
 */
import { useSoundStore } from "@/store/useSoundStore";
import {
  playChime,
  playCrack,
  playIceCrack,
  playReassemble,
  playRise,
  playThud,
  playWhoosh,
  setPadOpen,
} from "@/hooks/crystalAudio";
import { DIFFICULTY_CAP_METRES } from "./entities.ts";
import type { GameEvent } from "./engine.ts";

function soundOn(): boolean {
  return useSoundStore.getState().enabled;
}

/** Map engine events to cues. Called once per rendered frame. */
export function playEvents(events: GameEvent[]): void {
  if (events.length === 0 || !soundOn()) return;
  for (const e of events) {
    switch (e.type) {
      case "crack":
      case "break":
        playIceCrack();
        break;
      case "shatter":
        playCrack();
        break;
      case "damage":
        playThud();
        break;
      case "mote":
        playChime();
        break;
      case "life":
        playChime(1.5);
        break;
      case "band":
        if (e.band > 0) playRise();
        break;
      case "best":
        playReassemble();
        break;
      case "dash":
        playWhoosh();
        break;
    }
  }
}

/** The dream pad underneath opens up as the gem goes deeper. */
export function updatePad(depthM: number): void {
  setPadOpen(depthM / DIFFICULTY_CAP_METRES);
}

export function resetPad(): void {
  setPadOpen(0);
}
