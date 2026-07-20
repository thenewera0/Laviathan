"use client";

// The Leviathan Super Core — a living galactic singularity (Reference Image 1).
// A tilted accretion disk with log-spiral arms (blue/violet + gold), a dark
// singularity heart ringed by a gold-white event horizon, a central violet
// flare with a gold twist, tick-marked dial rings, a vertical axis beam with
// terminal nodes, orbiting dark bodies riding the disk, and a starfield.
// Fully animated and audio/state reactive; floats over the floor stage (Image 2).

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useLeviathan, type EntityState } from "@/lib/store";
import {
  AXIS_FRAGMENT,
  AXIS_VERTEX,
  CORE_FRAGMENT,
  CORE_VERTEX,
  DISK_FRAGMENT,
  DISK_VERTEX,
  FLARE_FRAGMENT,
  FLARE_VERTEX,
  PEDESTAL_FRAGMENT,
  PEDESTAL_VERTEX,
  RING_FRAGMENT,
  RING_VERTEX,
} from "./shaders";

// ---- Scene tuning (safe to tweak to taste) ------------------------------
const GALAXY_SCALE = 0.82;     // overall size of the disk assembly
const DISK_TILT = -1.16;       // radians; how flat the ellipse reads (~-66°)
const DISK_SPIN = 0.05;        // in-plane rotation speed of the disk
const DISK_RADIUS = 2.4;       // must match DISK_R / dial-ring layout below
// -------------------------------------------------------------------------

const STATE_PARAMS: Record<
  EntityState,
  { amp: number; freq: number; flowSpeed: number; glow: number; scale: number }
> = {
  idle: { amp: 0.19, freq: 1.55, flowSpeed: 0.34, glow: 0.9, scale: 1.0 },
  listening: { amp: 0.24, freq: 1.95, flowSpeed: 0.6, glow: 1.2, scale: 1.05 },
  thinking: { amp: 0.2, freq: 2.5, flowSpeed: 1.6, glow: 1.1, scale: 0.98 },
  speaking: { amp: 0.15, freq: 1.7, flowSpeed: 0.8, glow: 1.35, scale: 1.03 },
  error: { amp: 0.07, freq: 1.2, flowSpeed: 0.1, glow: 0.3, scale: 0.85 },
};

function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

type U = Record<string, { value: number }>;

// --- SINGULARITY HEART -----------------------------------------------------
function SingularityHeart({ uniforms }: { uniforms: U }) {
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => {
    if (!mesh.current) return;
    mesh.current.rotation.y += dt * 0.15;
    mesh.current.rotation.z += dt * 0.05;
  });
  return (
    <mesh ref={mesh} scale={0.26}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={CORE_VERTEX}
        fragmentShader={CORE_FRAGMENT}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  );
}

// --- CENTRAL FLARE (camera-facing billboard) -------------------------------
function CentralFlare({ uniforms }: { uniforms: U }) {
  return (
    <mesh scale={0.62}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={FLARE_VERTEX}
        fragmentShader={FLARE_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// --- ACCRETION DISK FIELD --------------------------------------------------
function AccretionDiskField({ uniforms }: { uniforms: U }) {
  return (
    <mesh>
      <planeGeometry args={[DISK_RADIUS * 2.15, DISK_RADIUS * 2.15, 1, 1]} />
      <shaderMaterial
        vertexShader={DISK_VERTEX}
        fragmentShader={DISK_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// --- TICK-MARKED DIAL RINGS (coplanar with the disk) -----------------------
function DialRings({ uniforms }: { uniforms: U }) {
  const rings: Array<{ r: number; tube: number; colorType: number }> = [
    { r: 0.95, tube: 0.006, colorType: 0 },
    { r: 1.4, tube: 0.007, colorType: 0 },
    { r: 1.85, tube: 0.006, colorType: 2 },
    { r: 0.62, tube: 0.008, colorType: 1 }, // inner gold graduation
  ];
  return (
    <group>
      {rings.map((ring, i) => (
        <mesh key={i}>
          <torusGeometry args={[ring.r, ring.tube, 8, 240]} />
          <shaderMaterial
            vertexShader={RING_VERTEX}
            fragmentShader={RING_FRAGMENT}
            uniforms={{ ...uniforms, uRingColorType: { value: ring.colorType } }}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

// --- SPIRAL PARTICLE STREAKS (ride the disk plane) -------------------------
function SpiralParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const count = 900;
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const blue = [0.2, 0.5, 1.0];
    const violet = [0.55, 0.2, 1.0];
    const gold = [1.0, 0.65, 0.15];
    const randn = () => Math.random() + Math.random() + Math.random() - 1.5;
    for (let i = 0; i < count; i++) {
      const r = 0.35 + Math.pow(Math.random(), 0.7) * (DISK_RADIUS - 0.4);
      const isGold = Math.random() < 0.4;
      const armAngle = isGold ? Math.PI : 0.0;
      const theta = armAngle + 2.6 * Math.log(r) + randn() * 0.2;
      pos[i * 3] = r * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(theta);
      pos[i * 3 + 2] = randn() * 0.05;
      const c = isGold ? gold : Math.random() < 0.4 ? violet : blue;
      col[i * 3] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
    }
    return { positions: pos, colors: col };
  }, []);

  const ref = useRef<THREE.Points>(null!);
  useFrame((_, dt) => {
    if (!reducedMotion && ref.current) ref.current.rotation.z += dt * DISK_SPIN * 1.4;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.022}
        vertexColors
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// --- ORBITING DARK BODIES (sit on the disk plane) --------------------------
function OrbitingDarkBodies() {
  const bodies = useMemo(() => {
    const out: Array<{ pos: [number, number, number]; r: number }> = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    for (let i = 0; i < 9; i++) {
      const radius = rand(0.7, DISK_RADIUS + 0.2);
      const theta = rand(0, Math.PI * 2);
      out.push({
        pos: [radius * Math.cos(theta), radius * Math.sin(theta), rand(-0.05, 0.05)],
        r: rand(0.05, 0.1),
      });
    }
    return out;
  }, []);
  return (
    <group>
      {bodies.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <sphereGeometry args={[b.r, 24, 24]} />
          <meshStandardMaterial color="#04060a" roughness={0.25} metalness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// --- VERTICAL AXIS BEAM + TERMINAL NODES -----------------------------------
function VerticalAxis({ uniforms }: { uniforms: U }) {
  const node = (y: number) => (
    <group position={[0, y, 0]}>
      <mesh>
        <ringGeometry args={[0.05, 0.08, 32]} />
        <meshBasicMaterial color="#7cc4ff" side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.012, 0.012, 5.2, 16]} />
        <shaderMaterial
          vertexShader={AXIS_VERTEX}
          fragmentShader={AXIS_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {node(2.6)}
      {node(-2.6)}
    </group>
  );
}

// --- FLOOR PEDESTAL STAGE (dashboard context) ------------------------------
function FloorPedestalStage({ uniforms }: { uniforms: U }) {
  return (
    <group position={[0, -2.3, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.0, 7.0]} />
        <shaderMaterial
          vertexShader={PEDESTAL_VERTEX}
          fragmentShader={PEDESTAL_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <ringGeometry args={[1.2, 1.25, 64]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <ringGeometry args={[2.0, 2.06, 64]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

// --- STARFIELD (blue + gold) -----------------------------------------------
function Starfield({ reducedMotion }: { reducedMotion: boolean }) {
  const count = 520;
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 13;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 9;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1.5;
      const gold = Math.random() < 0.3;
      col[i * 3] = gold ? 1.0 : 0.5;
      col[i * 3 + 1] = gold ? 0.75 : 0.7;
      col[i * 3 + 2] = gold ? 0.35 : 1.0;
    }
    return { positions: pos, colors: col };
  }, []);
  const ref = useRef<THREE.Points>(null!);
  useFrame((_, dt) => {
    if (!reducedMotion && ref.current) {
      ref.current.rotation.y += dt * 0.015;
      ref.current.rotation.z += dt * 0.004;
    }
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.016}
        vertexColors
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// --- CORE ASSEMBLY ---------------------------------------------------------
function SuperCoreBody({ reducedMotion }: { reducedMotion: boolean }) {
  const mainGroup = useRef<THREE.Group>(null!);
  const spinGroup = useRef<THREE.Group>(null!);
  const flow = useRef(0);
  const smoothedAudio = useRef(0);
  const { pointer } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uAmp: { value: STATE_PARAMS.idle.amp },
      uFreq: { value: STATE_PARAMS.idle.freq },
      uGlow: { value: STATE_PARAMS.idle.glow },
      uAudio: { value: 0 },
      uListen: { value: 0 },
      uThink: { value: 0 },
      uSpeak: { value: 0 },
      uError: { value: 0 },
    }),
    []
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { entityState, audioLevel, facePos } = useLeviathan.getState();
    const p = STATE_PARAMS[entityState];

    const motionScale = reducedMotion ? 0.15 : 1;
    flow.current += dt * p.flowSpeed * motionScale;
    uniforms.uTime.value += dt;
    uniforms.uFlow.value = flow.current;

    const targetAudio = reducedMotion ? 0 : audioLevel;
    smoothedAudio.current =
      targetAudio > smoothedAudio.current
        ? damp(smoothedAudio.current, targetAudio, 22, dt)
        : damp(smoothedAudio.current, targetAudio, 6, dt);
    uniforms.uAudio.value = smoothedAudio.current;

    uniforms.uAmp.value = damp(uniforms.uAmp.value, p.amp, 3.5, dt);
    uniforms.uFreq.value = damp(uniforms.uFreq.value, p.freq, 3.5, dt);
    uniforms.uGlow.value = damp(uniforms.uGlow.value, p.glow, 4, dt);
    uniforms.uListen.value = damp(uniforms.uListen.value, entityState === "listening" ? 1 : 0, 4.5, dt);
    uniforms.uThink.value = damp(uniforms.uThink.value, entityState === "thinking" ? 1 : 0, 4.5, dt);
    uniforms.uSpeak.value = damp(uniforms.uSpeak.value, entityState === "speaking" ? 1 : 0, 4.5, dt);
    uniforms.uError.value = damp(uniforms.uError.value, entityState === "error" ? 1 : 0, 4.5, dt);

    if (spinGroup.current && !reducedMotion) {
      spinGroup.current.rotation.z += dt * DISK_SPIN * (1 + smoothedAudio.current * 0.6);
    }

    if (mainGroup.current) {
      const fx = facePos ? facePos.x : pointer.x;
      const fy = facePos ? facePos.y : pointer.y;
      const lean = (uniforms.uListen.value * 0.3 + 0.05) * (facePos ? 1.4 : 1);
      mainGroup.current.position.x = damp(mainGroup.current.position.x, fx * lean, 3, dt);
      mainGroup.current.position.y = damp(mainGroup.current.position.y, fy * lean * 0.5, 3, dt);
      mainGroup.current.rotation.y = damp(mainGroup.current.rotation.y, fx * 0.12, 2.5, dt);
    }
  });

  return (
    <group ref={mainGroup} scale={GALAXY_SCALE}>
      {/* Tilted disk plane; inner group spins in-plane */}
      <group rotation={[DISK_TILT, 0, 0]}>
        <group ref={spinGroup}>
          <AccretionDiskField uniforms={uniforms} />
          <DialRings uniforms={uniforms} />
          <SpiralParticles reducedMotion={reducedMotion} />
          <OrbitingDarkBodies />
        </group>
      </group>

      {/* Upright elements at the singularity */}
      <SingularityHeart uniforms={uniforms} />
      <CentralFlare uniforms={uniforms} />
      <VerticalAxis uniforms={uniforms} />
      <FloorPedestalStage uniforms={uniforms} />
    </group>
  );
}

export default function Entity() {
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
      style={{ position: "absolute", inset: 0, zIndex: 0 }}
    >
      <ambientLight intensity={0.06} />
      <directionalLight position={[-2, 2, 2]} intensity={1.4} color="#38bdf8" />
      <directionalLight position={[2, -2, -2]} intensity={1.0} color="#f59e0b" />
      <directionalLight position={[0, 0, 5]} intensity={0.5} color="#60a5fa" />

      <SuperCoreBody reducedMotion={reducedMotion} />
      <Starfield reducedMotion={reducedMotion} />

      <EffectComposer>
        <Bloom
          intensity={1.25}
          luminanceThreshold={0.35}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
        <ChromaticAberration
          offset={new THREE.Vector2(0.0008, 0.0005)}
          radialModulation={false}
          modulationOffset={0}
        />
        <Noise opacity={0.015} />
        <Vignette eskil={false} offset={0.15} darkness={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
