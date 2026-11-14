import * as THREE from "three";

/**
 * Clock-shaped adapter over THREE.Timer.
 *
 * R3F 9.x drives its frame loop through the THREE.Clock surface
 * (getDelta, elapsedTime, oldTime, start/stop, running) and constructs a
 * Clock itself; THREE.Clock is deprecated as of r183. Swapping this into
 * the root store moves timing onto THREE.Timer (including its Page
 * Visibility handling, so a backgrounded tab returns with a zero delta
 * instead of one huge jump) without changing what useFrame sees.
 */
export class TimerClock {
  autoStart = true;
  startTime = 0;
  oldTime = 0;
  elapsedTime = 0;
  running = false;

  private timer = new THREE.Timer();

  constructor() {
    if (typeof document !== "undefined") this.timer.connect(document);
  }

  start() {
    this.timer.reset();
    this.startTime = performance.now();
    this.oldTime = this.startTime;
    this.elapsedTime = 0;
    this.running = true;
  }

  stop() {
    this.getElapsedTime();
    this.running = false;
    this.autoStart = false;
  }

  getElapsedTime() {
    this.getDelta();
    return this.elapsedTime;
  }

  getDelta() {
    if (this.autoStart && !this.running) {
      this.start();
      return 0;
    }
    if (!this.running) return 0;
    this.timer.update();
    const delta = this.timer.getDelta();
    this.oldTime = performance.now();
    this.elapsedTime += delta;
    return delta;
  }

  dispose() {
    this.timer.dispose();
  }
}

const CLOCK_DEPRECATION = "Clock: This module has been deprecated";

/**
 * R3F constructs one THREE.Clock while creating its store, before
 * onCreated can swap in TimerClock, and the deprecation fires in that
 * constructor. Mute exactly that message until the swap has happened;
 * every other three.js message passes through unchanged.
 */
export function muteClockDeprecationUntilSwapped(): () => void {
  const previous = THREE.getConsoleFunction();
  THREE.setConsoleFunction((level: "log" | "warn" | "error", message: string, ...params: unknown[]) => {
    if (level === "warn" && typeof message === "string" && message.includes(CLOCK_DEPRECATION)) {
      return;
    }
    if (previous) {
      previous(level, message, ...params);
      return;
    }
    const fn = (console as unknown as Record<string, (...a: unknown[]) => void>)[level] ?? console.log;
    const trace = params[0] as { isStackTrace?: boolean; getError?: (m: string) => unknown } | undefined;
    if (trace?.isStackTrace && trace.getError) fn(trace.getError(message));
    else fn(message, ...params);
  });
  return () => THREE.setConsoleFunction(previous);
}
