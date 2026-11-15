/**
 * Game sound cues. Every cue goes through the site's existing Web Audio
 * graph (hooks/crystalAudio) and is silent unless the Sound toggle is on.
 */
import { useSoundStore } from "@/store/useSoundStore";
import type { GameEvent } from "./engine.ts";

function soundOn(): boolean {
  return useSoundStore.getState().enabled;
}

/** Map engine events to cues. Called once per rendered frame. */
export function playEvents(events: GameEvent[]): void {
  if (!soundOn() || events.length === 0) return;
}
