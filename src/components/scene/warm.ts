/**
 * Shader warm-up that never blocks what is on screen.
 *
 * Firefox (ANGLE) has no KHR_parallel_shader_compile: the first draw or
 * status query of a program waits for its link, which takes seconds on a
 * software renderer. So nothing here ever draws or queries a program that
 * is not known to be linked:
 *
 * - guardScene(): before every render of a guarded scene, any object whose
 *   material has no linked program for this render (target kind,
 *   transparency, instancing, material version) is drawn with a cheap
 *   stand-in (lit materials -> a tinted MeshBasicMaterial) or skipped
 *   (custom shaders, whose look cannot be stood in for), and the material
 *   is queued. The real material is swapped back once linked.
 * - The queue compiles ONE program at a time, issued from an idle slot
 *   (requestIdleCallback, rAF fallback) with a 4 ms budget, and does not
 *   issue the next until a fence (or KHR_parallel_shader_compile, where a
 *   browser has it) says the link is done. Polling a fence with a zero
 *   timeout returns at once, so the main thread never waits on a link.
 * - Order by need: the WAKE hero first, then its hidden shards, then the
 *   flood, then DREAM, then the Archive (only once the hero is up).
 * - Pre-warm (things not yet drawn) has a 3 s budget per phase; whatever
 *   is left compiles later, on first use, through the same stand-in path.
 * - A one-off fill-rate probe picks the session's profile (see GfxProfile).
 */
import * as THREE from "three";
import { useSyncExternalStore } from "react";

/* ── Profile ───────────────────────────────────────────────────── */

/**
 * full: as designed. reduced (slow renderer, e.g. software WebGL): hero
 * glass backdrop 512 and 4 samples, Archive DPR 1, no Archive pre-warm.
 *
 * Chosen by timing a fixed DRAW workload, not a shader link: on ANGLE the
 * hardware path links more slowly than WARP (a 100-line shader: ~1.2 s on
 * a GTX 980, ~65 ms on WARP), so link time would demote fast GPUs. 40
 * full-screen draws of a small shader at 1024^2 take ~15-20 ms on a GTX
 * 980 and ~300 ms on WARP; the cut is 150 ms.
 */
export type GfxProfile = "full" | "reduced";
const PROFILE_KEY = "gfx-profile-v1";
const PROBE_CUT_MS = 150;

let profile: GfxProfile = readStoredProfile();
let profileKnown = profile !== "full" || hasStoredProfile();
const profileListeners = new Set<() => void>();

function hasStoredProfile(): boolean {
  try {
    return typeof window !== "undefined" && sessionStorage.getItem(PROFILE_KEY) !== null;
  } catch {
    return false;
  }
}
function readStoredProfile(): GfxProfile {
  try {
    if (typeof window === "undefined") return "full";
    const q = new URLSearchParams(window.location.search).get("gfx");
    if (q === "full" || q === "reduced") return q;
    return sessionStorage.getItem(PROFILE_KEY) === "reduced" ? "reduced" : "full";
  } catch {
    return "full";
  }
}
function setProfile(p: GfxProfile, probeMs: number | null, renderer: string) {
  profile = p;
  profileKnown = true;
  try {
    sessionStorage.setItem(PROFILE_KEY, p);
  } catch {
    // private mode: re-probed next load
  }
  const info = { profile: p, probeMs, renderer };
  (window as unknown as { __gfxProfile?: typeof info }).__gfxProfile = info;
  console.info(`[gfx] profile: ${p}${probeMs !== null ? ` (probe ${probeMs.toFixed(0)} ms, cut ${PROBE_CUT_MS} ms)` : " (this session)"} on ${renderer}`);
  profileListeners.forEach((l) => l());
}

export function getGfxProfile(): GfxProfile {
  return profile;
}
export function useGfxProfile(): GfxProfile {
  return useSyncExternalStore(
    (cb) => {
      profileListeners.add(cb);
      return () => profileListeners.delete(cb);
    },
    () => profile,
    () => "full",
  );
}

function rendererName(ctx: WebGL2RenderingContext): string {
  try {
    const e = ctx.getExtension("WEBGL_debug_renderer_info");
    return String(e ? ctx.getParameter(e.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER));
  } catch {
    return "?";
  }
}

/* ── Scheduling primitives ─────────────────────────────────────── */

const FRAME_BUDGET_MS = 4;
const PREWARM_CEILING_MS = 3000;

type Phase = "page" | "archive";
type Kind = "screen" | "fbo";

interface Task {
  gl: THREE.WebGLRenderer;
  /** Called if the task is dropped unrun (pre-warm past the ceiling). */
  onDrop?: () => void;
  phase: Phase;
  /** Lower runs first. */
  priority: number;
  /** Pre-warm (nothing draws it yet): dropped once the phase budget is spent. */
  pre: boolean;
  label: string;
  /** A large program (lit material): held until the hero has drawn. */
  heavy?: boolean;
  /** Issue the work; return a promise-like completion check. */
  issue: () => Completion;
}
/** Polled each frame until true; never blocks. */
type Completion = () => boolean;

const queue: Task[] = [];
/** Phases whose canvas is suspended: their links would only hold up the one on screen. */
const pausedPhases = new Set<Phase>();
/**
 * Pause a phase's compiles (the page while the Archive is open: its links
 * occupy the GPU process the Archive's frames go through) and resume them.
 */
export function setPhasePaused(phase: Phase, paused: boolean): void {
  if (paused) pausedPhases.add(phase);
  else {
    pausedPhases.delete(phase);
    if (queue.length) pump();
  }
}
/** The marquee has drawn real glyphs with its real program (see guardScene). */
let heroDrawn = false;
let inFlight: { task: Task; done: Completion } | null = null;
let pumping = false;
const phaseStart: Partial<Record<Phase, number>> = {};
const phaseListeners = new Map<Phase, Set<() => void>>();

/**
 * An idle slot with FRAME_BUDGET_MS to spare, or, after IDLE_WAIT_MS of
 * waiting (counted from the first request, so a page that is never idle
 * cannot starve the queue), the next one regardless.
 */
const IDLE_WAIT_MS = 100;
function idle(cb: () => void, since = performance.now()) {
  const ric = (window as unknown as { requestIdleCallback?: (f: (d: IdleDeadline) => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (!ric) {
    requestAnimationFrame(() => cb());
    return;
  }
  const left = Math.max(1, IDLE_WAIT_MS - (performance.now() - since));
  ric((d) => (d.timeRemaining() >= FRAME_BUDGET_MS || d.didTimeout || performance.now() - since >= IDLE_WAIT_MS ? cb() : idle(cb, since)), { timeout: left });
}

function pump() {
  if (pumping) return;
  pumping = true;
  const step = () => {
    // Poll the program in flight (cheap, never blocks); at most one issue per frame
    if (inFlight) {
      if (!inFlight.done()) {
        requestAnimationFrame(step);
        return;
      }
      inFlight = null;
    }
    dropExpired();
    if (!queue.length) {
      pumping = false;
      notifyPhases();
      return;
    }
    queue.sort((a, b) => a.priority - b.priority);
    // Large links wait until the hero's text has drawn (or the ceiling):
    // troika builds its glyphs with WebGL and a synchronous read, which in
    // Firefox queue behind any link in flight
    const heroGate = !heroDrawn && performance.now() - (phaseStart.page ?? 0) < PREWARM_CEILING_MS;
    const idx = queue.findIndex((t) => !pausedPhases.has(t.phase) && (!heroGate || !t.heavy || t.phase !== "page"));
    if (idx < 0) {
      setTimeout(() => requestAnimationFrame(step), 100);
      return;
    }
    const task = queue.splice(idx, 1)[0];
    idle(() => {
      const t0 = performance.now();
      try {
        inFlight = { task, done: task.issue() };
      } catch {
        inFlight = null;
      }
      const spent = performance.now() - t0;
      if (spent > 50) slowIssues.push({ label: task.label, ms: Math.round(spent) });
      notifyPhases();
      requestAnimationFrame(step);
    });
  };
  requestAnimationFrame(step);
}

/** Test hook: any issue that itself took >50 ms on the main thread. */
const slowIssues: { label: string; ms: number }[] = [];

function dropExpired() {
  const now = performance.now();
  for (let i = queue.length - 1; i >= 0; i--) {
    const t = queue[i];
    const s = phaseStart[t.phase];
    if (t.pre && s !== undefined && now - s > PREWARM_CEILING_MS) {
      queue.splice(i, 1);
      t.onDrop?.();
      dropped[t.phase] = (dropped[t.phase] ?? 0) + 1;
    }
  }
}
const dropped: Partial<Record<Phase, number>> = {};

function enqueue(t: Task) {
  if (phaseStart[t.phase] === undefined) phaseStart[t.phase] = performance.now();
  queue.push(t);
  pump();
}

function pending(phase: Phase, maxPriority = Infinity): boolean {
  if (inFlight && inFlight.task.phase === phase && inFlight.task.priority <= maxPriority) return true;
  return queue.some((t) => t.phase === phase && t.priority <= maxPriority);
}

function notifyPhases() {
  phaseListeners.forEach((set) => set.forEach((l) => l()));
}

/** Calls back (once) when nothing in `phase` up to `maxPriority` is queued or in flight. */
export function whenSettled(phase: Phase, maxPriority: number, cb: () => void): () => void {
  let live = true;
  const check = () => {
    if (!live || pending(phase, maxPriority) || phaseStart[phase] === undefined) return;
    live = false;
    set.delete(check);
    cb();
  };
  const set = phaseListeners.get(phase) ?? new Set();
  phaseListeners.set(phase, set);
  set.add(check);
  queueMicrotask(check);
  return () => {
    live = false;
    set.delete(check);
  };
}

/* ── Completion: KHR_parallel_shader_compile, else a fence ──────── */

function completionFor(gl: THREE.WebGLRenderer): Completion {
  const ctx = gl.getContext() as WebGL2RenderingContext;
  if (typeof ctx.fenceSync !== "function") {
    // WebGL1: no way to ask without blocking; give it a frame
    let frames = 0;
    return () => ++frames > 1;
  }
  const fence = ctx.fenceSync(ctx.SYNC_GPU_COMMANDS_COMPLETE, 0);
  ctx.flush();
  return () => {
    if (!fence) return true;
    const s = ctx.clientWaitSync(fence, 0, 0);
    if (s === ctx.TIMEOUT_EXPIRED) return false;
    ctx.deleteSync(fence);
    return true;
  };
}

function hasParallelCompile(gl: THREE.WebGLRenderer): boolean {
  return gl.extensions.has("KHR_parallel_shader_compile");
}

/* ── Readiness ─────────────────────────────────────────────────── */

const ready = new WeakMap<THREE.Material, Set<string>>();
const queued = new WeakMap<THREE.Material, Set<string>>();

/**
 * What a program depends on that can change between compile and render:
 * target kind, transparency, instancing, and the material's version (a
 * patch such as applyCrystalShader sets needsUpdate: a program compiled
 * before it is not the one the render will use). Except for transparent
 * double-sided materials: three draws those as a back and a front pass and
 * bumps the version for each, on every render and every compile, so their
 * version means nothing (a versioned key never matched and the queue
 * recompiled the same program forever).
 */
function keyOf(m: THREE.Material, kind: Kind, transparent: boolean, instanced: boolean): string {
  const twoPass = transparent && m.side === THREE.DoubleSide && !m.forceSinglePass;
  return `${kind}|${transparent ? 1 : 0}|${instanced ? 1 : 0}|${twoPass ? "*" : m.version}`;
}
function isReady(m: THREE.Material, key: string): boolean {
  return ready.get(m)?.has(key) ?? false;
}
/**
 * True once the material's on-screen program is linked (the variant for an
 * instanced or a plain draw). The Archive holds its curtain on this for
 * the seal glass, so the first frame a visitor sees is glass.
 */
export function isReadyOnScreen(m: THREE.Material, instanced: boolean): boolean {
  return isReady(m, keyOf(m, "screen", m.transparent, instanced));
}

/** userData.warmEarly: compiled ahead of everything else in its phase,
 * and never dropped when the pre-warm budget runs out. */
const EARLY = -40;

function markReady(m: THREE.Material, key: string) {
  let s = ready.get(m);
  if (!s) ready.set(m, (s = new Set()));
  s.add(key);
}

/** Lit materials get a stand-in; anything else is skipped until ready. */
function isLit(m: THREE.Material): boolean {
  const x = m as THREE.Material & { isMeshStandardMaterial?: boolean; isMeshLambertMaterial?: boolean; isMeshPhongMaterial?: boolean; isMeshToonMaterial?: boolean };
  return !!(x.isMeshStandardMaterial || x.isMeshLambertMaterial || x.isMeshPhongMaterial || x.isMeshToonMaterial);
}

const standIns = new WeakMap<THREE.Material, THREE.MeshBasicMaterial>();
/**
 * A tinted MeshBasicMaterial, always transparent (one program variant per
 * look). Glass (userData.warmAlpha) becomes a pale see-through tint, so the
 * crystal reads as ice from the first frame; the real glass replaces it.
 */
function standInFor(m: THREE.Material): THREE.MeshBasicMaterial {
  let s = standIns.get(m);
  if (s) return s;
  const src = m as THREE.MeshStandardMaterial;
  const glass = !!m.userData.warmAlpha;
  s = new THREE.MeshBasicMaterial({
    color: src.color ? src.color.clone() : new THREE.Color("#ffffff"),
    map: glass ? null : src.map ?? null,
    transparent: true,
    opacity: glass ? 0.35 : src.opacity,
    side: src.side,
    depthWrite: glass ? false : src.depthWrite,
    depthTest: src.depthTest,
    fog: src.fog,
    toneMapped: src.toneMapped,
  });
  s.userData.standIn = true;
  standIns.set(m, s);
  return s;
}

/* ── Compile tasks ─────────────────────────────────────────────── */

const _fallbackCamera = new THREE.PerspectiveCamera();
const fboTargets = new WeakMap<THREE.WebGLRenderer, THREE.WebGLRenderTarget>();
function fboFor(gl: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  let t = fboTargets.get(gl);
  if (!t) fboTargets.set(gl, (t = new THREE.WebGLRenderTarget(1, 1)));
  return t;
}

interface CompileJob {
  gl: THREE.WebGLRenderer;
  object: THREE.Object3D;
  material: THREE.Material;
  scene: THREE.Scene;
  camera: THREE.Camera;
  kind: Kind;
  transparent: boolean;
}

/**
 * Compile exactly the program this object + material will need: same
 * render-target kind (three keys programs on output colour space and tone
 * mapping), same transparency (OPAQUE define), same scene (lights,
 * environment), the object itself (instancing). Only this material is
 * attached while compiling, so one program is issued.
 */
/** The program compile() just built or picked for this material. */
type ProgramRef = { getUniforms?: () => unknown; cacheKey?: string } | undefined;
function issueCompile(job: CompileJob): { done: Completion; program: ProgramRef } {
  const { gl, object, material, scene, camera, kind, transparent } = job;
  const mesh = object as THREE.Mesh;
  const prevMat = mesh.material;
  const prevTr = material.transparent;
  const prevRT = gl.getRenderTarget();
  try {
    // (compile() walks the object's whole subtree, visible or not; our
    // drawables have no children, so this is one program)
    mesh.material = material;
    material.transparent = transparent;
    gl.setRenderTarget(kind === "fbo" ? fboFor(gl) : null);
    if (hasParallelCompile(gl)) {
      let ok = false;
      const pr = gl.compileAsync(object, camera, scene);
      const program = programOf(gl, material);
      pr.then(
        () => (ok = true),
        () => (ok = true),
      );
      return { done: () => ok, program };
    }
    gl.compile(object, camera, scene);
    // Capture it now: a frame drawn while it links can point the material's
    // currentProgram at another variant before we get to touch this one
    const program = programOf(gl, material);
    return { done: completionFor(gl), program };
  } finally {
    gl.setRenderTarget(prevRT);
    material.transparent = prevTr;
    mesh.material = prevMat;
  }
}

/**
 * three's first use of a program makes synchronous queries (info log,
 * uniform locations). In Firefox those wait for everything queued in the
 * GPU process, so a first use while another link is in flight waits out
 * that whole link. Do the first use here, the moment this program is
 * linked and before the next is issued: it returns at once, and later
 * draws make no synchronous calls for it.
 */
const touched = new WeakSet<object>();
function programOf(gl: THREE.WebGLRenderer, material: THREE.Material): ProgramRef {
  return (gl.properties.get(material) as { currentProgram?: ProgramRef }).currentProgram;
}
function touchProgram(program: ProgramRef) {
  try {
    program?.getUniforms?.();
    if (program) touched.add(program);
  } catch {
    // diagnostics only; the draw would do the same
  }
}

function queueMaterial(job: CompileJob, phase: Phase, priority: number, pre: boolean) {
  const inst = !!(job.object as THREE.InstancedMesh).isInstancedMesh;
  const key = keyOf(job.material, job.kind, job.transparent, inst);
  if (isReady(job.material, key)) return;
  let q = queued.get(job.material);
  if (!q) queued.set(job.material, (q = new Set()));
  if (q.has(key)) {
    // Already queued as pre-warm and now needed on screen: promote it
    if (!pre) for (const t of queue) if (t.label === labelOf(job, key) && t.pre) {
      t.pre = false;
      t.priority = Math.min(t.priority, priority);
    }
    return;
  }
  q.add(key);
  enqueue({
    gl: job.gl,
    phase,
    priority,
    pre,
    heavy: isLit(job.material),
    label: labelOf(job, key),
    // Dropped unrun: forget it was queued, so a first draw queues it again
    onDrop: () => queued.get(job.material)?.delete(key),
    issue: () => {
      // Gone, or swapped for another material since it was queued: nothing to do
      if (!job.object.parent && !(job.object as THREE.Scene).isScene) return () => true;
      const definesBefore = definesOf(job.material);
      const { done, program } = issueCompile(job);
      return () => {
        if (!done()) return false;
        // onBeforeCompile changed the material's defines (drei does): the
        // program just built is keyed on the old ones and the render will
        // want another. Build that one too before calling it ready.
        if (definesOf(job.material) !== definesBefore) {
          queued.get(job.material)?.delete(key);
          queueMaterial(job, phase, priority, pre);
          return true;
        }
        touchProgram(program);
        // ...and every other program three holds for this material (a
        // transparent double-sided one compiles a back and a front pass)
        const all = (job.gl.properties.get(job.material) as { programs?: Map<string, ProgramRef> }).programs;
        all?.forEach((pr) => touchProgram(pr));
        markReady(job.material, key);
        queued.get(job.material)?.delete(key);
        return true;
      };
    },
  });
}

/** troika's text geometry: glyphs are instances (0 until the font has synced). */
function glyphCount(o: THREE.Object3D): number {
  const g = (o as THREE.Mesh).geometry as THREE.InstancedBufferGeometry | undefined;
  const n = g?.instanceCount ?? 0;
  // three's default is Infinity: not synced yet
  return Number.isFinite(n) ? n : 0;
}

function definesOf(m: THREE.Material): string {
  return JSON.stringify((m as THREE.Material & { defines?: Record<string, unknown> }).defines ?? null);
}

function labelOf(job: CompileJob, key: string): string {
  return `${job.material.type}#${job.material.id}${job.material.userData.warmFirst ? "[marquee]" : ""}${job.material.userData.standIn ? "[stand-in]" : ""} ${key}`;
}


/* ── PMREM pre-link ────────────────────────────────────────────── */

/** drei <Environment resolution> used by StudioEnvironment (PMREM keys depend on it). */
const ENV_CUBE_SIZE = 512;
const pmremDone = new WeakSet<THREE.WebGLRenderer>();
const NOOP = new Set(["render", "setRenderTarget", "clear", "clearColor", "clearDepth", "clearStencil", "setViewport", "setScissor", "setScissorTest", "setClearColor", "setClearAlpha", "compile", "copyFramebufferToTexture", "readRenderTargetPixels", "initRenderTarget"]);

/**
 * three converts an environment cube map to its prefiltered (PMREM) form
 * the first time an environment-lit material is compiled or drawn, and
 * that conversion builds and first-uses its own shaders synchronously
 * (~0.4 s on a software renderer). Pre-link them in the background: run a
 * throwaway PMREMGenerator against a renderer proxy whose draws do nothing
 * (it creates the very materials the real conversion will use, with the
 * same defines for the same cube size), then compile those through the
 * queue, one per step. The real conversion then finds them linked.
 */
function prelinkPMREM(gl: THREE.WebGLRenderer, phase: Phase): void {
  if (pmremDone.has(gl)) return;
  pmremDone.add(gl);
  let mats: THREE.Material[] = [];
  let box: THREE.Mesh | null = null;
  try {
    const g = new THREE.PMREMGenerator(gl) as unknown as Record<string, unknown> & { fromCubemap: (t: THREE.CubeTexture) => unknown };
    g._renderer = new Proxy(gl, {
      get(t, k) {
        if (typeof k === "string" && NOOP.has(k)) return () => {};
        if (k === "getRenderTarget") return () => null;
        const v = Reflect.get(t, k, t);
        return typeof v === "function" ? v.bind(t) : v;
      },
      set() {
        return true;
      },
    });
    const cube = new THREE.CubeTexture(Array.from({ length: 6 }, () => ({ width: ENV_CUBE_SIZE, height: ENV_CUBE_SIZE })));
    cube.isRenderTargetTexture = true;
    g.fromCubemap(cube);
    mats = ["_cubemapMaterial", "_ggxMaterial", "_integrationMaterial", "_blurMaterial"]
      .map((k) => g[k] as THREE.Material | null)
      .filter((m): m is THREE.Material => !!m);
    box = (g._boxMesh as THREE.Mesh) ?? null;
  } catch {
    return; // internals moved: the conversion just compiles on first use
  }
  if (!box) return;
  const holder = new THREE.Scene();
  for (const m of mats) {
    const mesh = new THREE.Mesh(box.geometry, m);
    holder.add(mesh);
    queueMaterial({ gl, object: mesh, material: m, scene: holder, camera: _fallbackCamera, kind: "fbo", transparent: m.transparent }, phase, -50, false);
  }
}

/* ── Guarding a scene ──────────────────────────────────────────── */

/**
 * ?warmdebug=1: window.__warmDebug lists every guarded render that still
 * had to build a program, or first-used one the queue had not linked and
 * touched: the two ways a draw can block on a link. Empty means none did.
 */
const DEBUG = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("warmdebug") === "1";
const debugLog: { what: string; kind: string; detail: string[] }[] = [];
if (DEBUG) (window as unknown as { __warmDebug?: typeof debugLog }).__warmDebug = debugLog;

interface GuardOptions {
  phase: Phase;
  /** Priority of anything this scene draws now (lower first). */
  priority: () => number;
}

type Drawable = THREE.Object3D & { material?: THREE.Material | THREE.Material[]; isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean };

/**
 * Before each render of `scene`: stand in for, or skip, anything whose
 * program is not linked for this render, and queue it; restore after.
 */
export function guardScene(scene: THREE.Scene, gl: THREE.WebGLRenderer, opts: GuardOptions): () => void {
  prelinkPMREM(gl, opts.phase);
  const swapped: { o: Drawable; mat: THREE.Material | THREE.Material[] }[] = [];
  const hidden: THREE.Object3D[] = [];
  // three calls a Scene's hooks as (renderer, scene, camera, renderTarget)
  type SceneHook = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target?: THREE.WebGLRenderTarget | null) => void;
  const prevBefore = scene.onBeforeRender as unknown as SceneHook;
  const prevAfter = scene.onAfterRender as unknown as SceneHook;
  let progCount = 0;
  let lastKind: Kind = "screen";
  const before: SceneHook = (renderer, sc, camera, target) => {
    prevBefore.call(scene, renderer, sc, camera, target);
    const kind: Kind = target ? "fbo" : "screen";
    lastKind = kind;
    if (DEBUG) progCount = gl.info.programs?.length ?? 0;
    const base = opts.priority();
    scene.traverseVisible((obj) => {
      const o = obj as Drawable;
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
      const inst = !!(o as THREE.InstancedMesh).isInstancedMesh;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      let swap = false;
      let skip = false;
      const out = mats.map((m) => {
        if (m.userData.standIn) return m;
        const key = keyOf(m, kind, m.transparent, inst);
        if (isReady(m, key)) {
          // Test hook: the first frame something drew for real on screen (the composite)
          if (kind === "screen" && opts.phase === "page") {
            const tw = window as unknown as { __screenDrawnAt?: number };
            tw.__screenDrawnAt ??= performance.now();
          }
          if (!heroDrawn && m.userData.warmFirst && glyphCount(o) > 0) {
            heroDrawn = true;
            // Test hook (scripts/perf/slow.mjs): the hero's headline first drew
            (window as unknown as { __heroDrawnAt?: number }).__heroDrawnAt = performance.now();
          }
          return m;
        }
        // userData.warmFirst (the marquee): the hero's main content, ahead of the rest
        const prio = m.userData.warmEarly ? EARLY : base - (m.userData.warmFirst ? 5 : 0);
        queueMaterial({ gl, object: o, material: m, scene, camera, kind, transparent: m.transparent }, opts.phase, prio + (isLit(m) ? 0.5 : 0), false);
        if (isLit(m)) {
          const s = standInFor(m);
          s.opacity = m.userData.warmAlpha ? 0.35 * m.opacity : m.opacity;
          const sk = keyOf(s, kind, true, inst);
          if (isReady(s, sk)) {
            swap = true;
            return s;
          }
          // The stand-in first (it is what shows), just ahead of the real one
          queueMaterial({ gl, object: o, material: s, scene, camera, kind, transparent: true }, opts.phase, prio, false);
        }
        skip = true;
        return m;
      });
      // Test hook: the crystal (glass, stand-in or real) first drew
      if (!skip && mats.some((m) => m.userData.warmAlpha)) {
        const tw = window as unknown as { __crystalDrawnAt?: number; __archiveGlassDrawnAt?: number };
        if (opts.phase === "page") tw.__crystalDrawnAt ??= performance.now();
        else tw.__archiveGlassDrawnAt ??= performance.now();
      }
      if (skip) {
        o.visible = false;
        hidden.push(o);
      } else if (swap) {
        swapped.push({ o, mat: o.material });
        o.material = Array.isArray(o.material) ? out : out[0];
      }
    });
  };
  const after: SceneHook = (renderer, sc, camera, target) => {
    if (DEBUG) {
      // (three passes no target to onAfterRender: the kind is the before-hook's)
      scene.traverseVisible((obj) => {
        const o = obj as Drawable;
        if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          const cp = (gl.properties.get(m) as { currentProgram?: { cacheKey: string } }).currentProgram;
          if (cp && !touched.has(cp)) {
            debugLog.push({ what: "first use in a render", kind: lastKind, detail: [`${m.type}#${m.id}`, cp.cacheKey.slice(0, 80)] });
            touched.add(cp);
          }
        }
      });
      const progs = gl.info.programs ?? [];
      if (progs.length > progCount) {
        debugLog.push({ what: "program built in a render", kind: lastKind, detail: progs.slice(progCount).map((pr) => (pr as unknown as { cacheKey: string }).cacheKey.slice(0, 80)) });
      }
    }
    for (const s of swapped) s.o.material = s.mat;
    for (const o of hidden) o.visible = true;
    swapped.length = 0;
    hidden.length = 0;
    prevAfter.call(scene, renderer, sc, camera, target);
  };
  scene.onBeforeRender = before as unknown as typeof scene.onBeforeRender;
  scene.onAfterRender = after as unknown as typeof scene.onAfterRender;
  return () => {
    scene.onBeforeRender = prevBefore as unknown as typeof scene.onBeforeRender;
    scene.onAfterRender = prevAfter as unknown as typeof scene.onAfterRender;
  };
}

/**
 * Queue everything in `scene` (hidden objects too) as pre-warm, for the
 * given render-target kinds. Pre-warm stops when the phase's 3 s budget is
 * spent; the rest compiles on first use (stand-in meanwhile).
 */
export function prewarmScene(
  scene: THREE.Scene,
  gl: THREE.WebGLRenderer,
  opts: { phase: Phase; priority: number; kinds: Kind[]; camera?: THREE.Camera; hiddenPriority?: number },
): void {
  const camera = opts.camera ?? _fallbackCamera;
  scene.traverse((obj) => {
    const o = obj as Drawable;
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
    let visible = true;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) visible = false;
    const prio = visible ? opts.priority : opts.hiddenPriority ?? opts.priority;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m.userData.standIn) continue;
      // Crystal glass never draws into a backdrop (it is hidden for it)
      const kinds = m.userData.warmAlpha ? opts.kinds.filter((k) => k !== "fbo" || opts.kinds.length === 1) : opts.kinds;
      for (const kind of kinds) {
        // One variant: the one the material is in (crystal glass is always
        // transparent, see applyCrystalShader)
        const early = !!m.userData.warmEarly;
        queueMaterial({ gl, object: o, material: m, scene, camera, kind, transparent: m.transparent }, opts.phase, (early ? EARLY : prio) + (isLit(m) ? 0.5 : 0), !early);
      }
    }
  });
}

/* ── The probe: picks the profile (first program of the session) ── */

let probed = false;
/**
 * Queued first: link a tiny program (fenced), then time 40 full-screen
 * draws at 1024^2 (fenced). Never blocks: both waits are fence polls.
 */
export function probeProfile(gl: THREE.WebGLRenderer): void {
  if (probed) return;
  probed = true;
  const ctx = gl.getContext() as WebGL2RenderingContext;
  const name = rendererName(ctx);
  if (profileKnown) {
    setProfile(profile, null, name);
    return;
  }
  // A renderer that names itself as software needs no probe (and the probe's
  // draws would only cost it more time)
  if (/basic render driver|swiftshader|llvmpipe|softpipe|software/i.test(name)) {
    setProfile("reduced", null, name + " [software]");
    return;
  }
  let stage = 0;
  let prog: WebGLProgram | null = null;
  let fbo: WebGLFramebuffer | null = null;
  let tex: WebGLTexture | null = null;
  let done: Completion = () => true;
  let t0 = 0;
  enqueue({
    gl,
    phase: "page",
    priority: -100,
    pre: false,
    label: "profile probe",
    issue: () => {
      if (typeof ctx.fenceSync !== "function") {
        setProfile("full", null, name);
        return () => true;
      }
      let body = "";
      for (let i = 0; i < 24; i++) body += `v += sin(v * ${(i % 7) + 1}.1 + uv.x * ${i}.3) * cos(uv.y * ${i % 11}.7 + v);\n`;
      const fs = `#version 300 es\nprecision highp float; out vec4 o; in vec2 uv; void main(){ float v = uv.x; ${body} o = vec4(v); }`;
      const vs = `#version 300 es\nout vec2 uv; void main(){ vec2 q = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); uv = q; gl_Position = vec4(q * 2.0 - 1.0, 0.0, 1.0); }`;
      const mk = (t: number, s: string) => {
        const x = ctx.createShader(t)!;
        ctx.shaderSource(x, s);
        ctx.compileShader(x);
        return x;
      };
      prog = ctx.createProgram();
      ctx.attachShader(prog, mk(ctx.VERTEX_SHADER, vs));
      ctx.attachShader(prog, mk(ctx.FRAGMENT_SHADER, fs));
      ctx.linkProgram(prog);
      done = completionFor(gl);
      return () => {
        if (!done()) return false;
        if (stage === 0) {
          // Linked: now the timed draws, into a private 1024^2 target
          stage = 1;
          tex = ctx.createTexture();
          ctx.bindTexture(ctx.TEXTURE_2D, tex);
          ctx.texStorage2D(ctx.TEXTURE_2D, 1, ctx.RGBA8, 1024, 1024);
          fbo = ctx.createFramebuffer();
          ctx.bindFramebuffer(ctx.FRAMEBUFFER, fbo);
          ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, tex, 0);
          ctx.viewport(0, 0, 1024, 1024);
          ctx.useProgram(prog);
          t0 = performance.now();
          for (let i = 0; i < 40; i++) ctx.drawArrays(ctx.TRIANGLES, 0, 3);
          done = completionFor(gl);
          gl.resetState();
          return false;
        }
        const ms = performance.now() - t0;
        ctx.deleteFramebuffer(fbo);
        ctx.deleteTexture(tex);
        ctx.deleteProgram(prog);
        gl.resetState();
        setProfile(ms > PROBE_CUT_MS ? "reduced" : "full", ms, name);
        return true;
      };
    },
  });
}

/* ── Test hooks ────────────────────────────────────────────────── */

if (typeof window !== "undefined") {
  (window as unknown as { __warm?: () => unknown }).__warm = () => ({
    profile,
    queued: queue.map((t) => `${t.phase}:${t.priority}${t.pre ? " pre" : ""} ${t.label}`),
    inFlight: inFlight?.task.label ?? null,
    dropped,
    slowIssues,
    phaseStart,
  });
}

/* ── Idle slicing for main-thread builds ───────────────────────── */

const SLICE_BUDGET_MS = 6;
const sliceJobs: Iterator<unknown>[] = [];
let slicing = false;
/**
 * Run a resumable build (an iterator: one cheap step per next()) in idle
 * slots, SLICE_BUDGET_MS at a time, one job after another in the order
 * given. Used for the crystal's procedural textures and logo geometry,
 * which, built synchronously on mount, blocked the main thread for over a
 * second on a slow machine.
 */
export function sliceIdle(job: Iterator<unknown>): void {
  sliceJobs.push(job);
  if (slicing || typeof window === "undefined") return;
  slicing = true;
  const run = () => {
    const t0 = performance.now();
    while (sliceJobs.length && performance.now() - t0 < SLICE_BUDGET_MS) {
      if (sliceJobs[0].next().done) sliceJobs.shift();
    }
    if (sliceJobs.length) idle(run);
    else slicing = false;
  };
  idle(run);
}
