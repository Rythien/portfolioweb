"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { applyCrystalShader, getFrostNormalMap, getRoughnessMap } from "@/components/crystal/crystalMaterial";
import { SEAL, type SealSpot } from "./layout";

/**
 * A seal: one project frozen inside a faceted block of ice, orbited by
 * shards. One facet is lit; that is the target the pulse will be released
 * at (not built yet). Three hits free the project.
 *
 * Built from a slightly irregular dodecahedron: 12 pentagonal facets read
 * as cut ice at a distance, and each facet is 3 triangles in order, so a
 * facet is easy to address (facet i = triangles 3i..3i+2).
 */

function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Non-indexed dodecahedron, vertices nudged per facet so it is not a die. */
function sealGeometry(seed: number): THREE.BufferGeometry {
  const g = new THREE.DodecahedronGeometry(SEAL.radius, 0).toNonIndexed();
  const rnd = lcg(seed);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  // Same corner, same nudge (corners are shared by three facets)
  const nudge = new Map<string, THREE.Vector3>();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!nudge.has(key)) nudge.set(key, new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(SEAL.radius * 0.16));
    v.add(nudge.get(key)!);
    // Taller than wide: a standing seal, not a ball
    v.y *= 1.22;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // Planar UVs for the frost maps (they tile)
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) * 0.35 + pos.getZ(i) * 0.2;
    uv[i * 2 + 1] = pos.getY(i) * 0.35;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/** One facet of the seal geometry, pushed out a hair, for the lit overlay. */
function facetGeometry(seal: THREE.BufferGeometry, facet: number): { geo: THREE.BufferGeometry; center: THREE.Vector3; normal: THREE.Vector3 } {
  const pos = seal.getAttribute("position") as THREE.BufferAttribute;
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < 9; k++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, facet * 9 + k));
  const center = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(9);
  const normal = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[2], pts[0])).normalize();
  if (normal.dot(center) < 0) normal.negate();
  const out = new Float32Array(27);
  pts.forEach((p, k) => {
    const q = p.clone().addScaledVector(normal, 0.03);
    out.set([q.x, q.y, q.z], k * 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(out, 3));
  return { geo, center, normal };
}

/** A small irregular shard: an octahedron with its corners pulled about. */
function shardGeometry(): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(1, 0).toNonIndexed();
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const rnd = lcg(4711);
  const seen = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(2)},${pos.getY(i).toFixed(2)},${pos.getZ(i).toFixed(2)}`;
    if (!seen.has(key)) seen.set(key, [0.55 + rnd() * 0.7, 0.8 + rnd() * 1.4, 0.4 + rnd() * 0.5]);
    const [sx, sy, sz] = seen.get(key)!;
    pos.setXYZ(i, pos.getX(i) * sx, pos.getY(i) * sy, pos.getZ(i) * sz);
  }
  g.computeVertexNormals();
  return g;
}

/** Project covers, created once with the right colour space (they stream in). */
const _covers = new Map<string, THREE.Texture>();
function coverTexture(url: string): THREE.Texture {
  let t = _covers.get(url);
  if (!t) {
    t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    _covers.set(url, t);
  }
  return t;
}

const _shardGeo = typeof window !== "undefined" ? shardGeometry() : null;

/** Lit facet: a soft glow that breathes, brightest at the facet centre. */
const FACET_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uCenter;
  uniform float uSize;
  varying vec3 vLocal;
  void main() {
    // Brightest at the facet centre, a lit rim where it meets the cut
    float r = clamp(distance(vLocal, uCenter) / uSize, 0.0, 1.0);
    float breathe = 0.75 + 0.25 * sin(uTime * 2.2);
    float a = (1.0 - smoothstep(0.0, 1.0, r)) * 0.85 + 0.15;
    gl_FragColor = vec4(uColor * a * breathe, 1.0);
  }
`;
const FACET_VERT = /* glsl */ `
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

interface Orbiter {
  radius: number;
  speed: number;
  phase: number;
  tilt: THREE.Quaternion;
  scale: number;
  spin: THREE.Vector3;
  bob: number;
}

function makeOrbiters(seed: number): Orbiter[] {
  const rnd = lcg(seed);
  // Three rings, each tilted its own way, a few shards per ring
  const rings = [0, 1, 2].map(() =>
    new THREE.Quaternion().setFromEuler(new THREE.Euler((rnd() - 0.5) * 1.6, rnd() * Math.PI * 2, (rnd() - 0.5) * 1.6)),
  );
  const out: Orbiter[] = [];
  for (let i = 0; i < SEAL.orbiters; i++) {
    const ring = i % rings.length;
    out.push({
      radius: SEAL.radius * (1.75 + ring * 0.42 + rnd() * 0.25),
      speed: (0.16 + rnd() * 0.14) * (ring === 1 ? -1 : 1),
      phase: rnd() * Math.PI * 2,
      tilt: rings[ring],
      scale: 0.22 + rnd() * 0.38,
      spin: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(1.6),
      bob: rnd() * Math.PI * 2,
    });
  }
  return out;
}

interface SealProps {
  spot: SealSpot;
  index: number;
  /** DREAM cover of the project held inside. */
  cover: string;
  reduced: boolean;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export default function Seal({ spot, index, cover, reduced }: SealProps) {
  const body = useRef<THREE.Group>(null);
  const coverRef = useRef<THREE.Mesh>(null);
  const facetMat = useRef<THREE.ShaderMaterial>(null);
  const swarm = useRef<THREE.InstancedMesh>(null);
  const coverTex = useMemo(() => coverTexture(cover), [cover]);
  const geo = useMemo(() => sealGeometry(101 + index * 37), [index]);
  const facet = useMemo(() => facetGeometry(geo, SEAL.litFacet[index % SEAL.litFacet.length]), [geo, index]);
  const orbiters = useMemo(() => makeOrbiters(900 + index * 53), [index]);
  const facetUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color("#fff3c4") },
      uCenter: { value: facet.center.clone() },
      uSize: { value: SEAL.radius * 0.7 },
    }),
    [facet],
  );
  const iceMaps = useMemo(() => ({ normal: getFrostNormalMap(), rough: getRoughnessMap() }), []);


  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const k = reduced ? 0.35 : 1;
    if (body.current) {
      body.current.rotation.y += delta * 0.08 * k * (index % 2 ? -1 : 1);
      body.current.position.y = reduced ? 0 : Math.sin(t * 0.4 + index) * 0.25;
    }
    if (facetMat.current) facetMat.current.uniforms.uTime.value = reduced ? 0 : t;
    if (coverRef.current) {
      coverRef.current.quaternion.copy(state.camera.quaternion);
      coverRef.current.position.y = body.current?.position.y ?? 0;
    }
    const sw = swarm.current;
    if (sw) {
      orbiters.forEach((o, i) => {
        const a = o.phase + t * o.speed * k;
        _p.set(Math.cos(a) * o.radius, Math.sin(t * 0.5 + o.bob) * 0.3 * k, Math.sin(a) * o.radius).applyQuaternion(o.tilt);
        _e.set(o.spin.x * t * k, o.spin.y * t * k, o.spin.z * t * k);
        _q.setFromEuler(_e);
        _s.setScalar(o.scale);
        _m.compose(_p, _q, _s);
        sw.setMatrixAt(i, _m);
      });
      sw.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group position={spot.pos}>
      {/* The project, frozen inside: always turned to you, opaque so the
          ice refracts it, unfogged so it reads from across the void */}
      <mesh ref={coverRef} renderOrder={0}>
        <planeGeometry args={[SEAL.radius * 1.2, SEAL.radius * 1.2 * 0.75]} />
        <meshBasicMaterial map={coverTex} color="#f1edff" side={THREE.DoubleSide} toneMapped={false} fog={false} />
      </mesh>
      <group ref={body}>
        {/* A faint inner glow so the frozen project reads as held light */}
        <pointLight color="#c9b8ff" intensity={6} distance={SEAL.radius * 3} decay={1.5} />
        {/* The ice */}
        <mesh geometry={geo}>
          <meshPhysicalMaterial
            transmission={1}
            thickness={SEAL.radius * 0.9}
            ior={1.31}
            roughness={1}
            roughnessMap={iceMaps.rough}
            normalMap={iceMaps.normal}
            normalScale={new THREE.Vector2(0.09, 0.09)}
            color="#d9cffd"
            attenuationColor="#a99be6"
            attenuationDistance={SEAL.radius * 3}
            clearcoat={0.6}
            clearcoatRoughness={0.1}
            envMapIntensity={1.2}
            specularIntensity={1}
            ref={(m: THREE.Material | null) => applyCrystalShader(m)}
          />
        </mesh>
        {/* Crisp cut edges */}
        <lineSegments>
          <edgesGeometry args={[geo, 20]} />
          <lineBasicMaterial color="#e9e2ff" transparent opacity={0.35} />
        </lineSegments>
        {/* The lit facet: the target */}
        <mesh geometry={facet.geo} renderOrder={2}>
          <shaderMaterial
            ref={facetMat}
            uniforms={facetUniforms}
            vertexShader={FACET_VERT}
            fragmentShader={FACET_FRAG}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      {/* Shards in orbit: three tilted rings, the middle one counter-rotating */}
      {_shardGeo && (
        <instancedMesh ref={swarm} args={[_shardGeo, undefined, orbiters.length]} frustumCulled={false}>
          <meshPhysicalMaterial
            transmission={1}
            thickness={0.3}
            ior={1.31}
            roughness={1}
            roughnessMap={iceMaps.rough}
            color="#f5f2ff"
            attenuationColor="#d4ccf6"
            attenuationDistance={6}
            clearcoat={0.6}
            clearcoatRoughness={0.1}
            envMapIntensity={2.2}
            specularIntensity={1}
            ref={(m: THREE.Material | null) => applyCrystalShader(m)}
            flatShading
          />
        </instancedMesh>
      )}
    </group>
  );
}
